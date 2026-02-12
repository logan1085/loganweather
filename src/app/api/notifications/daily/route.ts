import { NextRequest, NextResponse } from "next/server";
import {
  listSubscribers,
  saveSubscribers,
  type Subscriber,
} from "@/lib/subscribers";
import { sendEmail } from "@/lib/email";
import {
  getWeatherSnapshot,
  getWeatherSnapshotByCoords,
} from "@/lib/weather-pipeline";

export const runtime = "nodejs";

const buildEmail = (
  location: string,
  summary: string,
  high: string,
  low: string,
  unsubscribeUrl: string
) => {
  return `
    <div style="font-family: Inter, Arial, sans-serif; color:#0f172a;">
      <h2 style="margin-bottom:8px;">${location} — Morning Forecast</h2>
      <p style="margin:0 0 12px;">${summary}</p>
      <p style="margin:0; font-size:14px;">High: ${high} · Low: ${low}</p>
      <p style="margin-top:16px; font-size:12px; color:#64748b;">
        SkyView Weather · <a href="${unsubscribeUrl}" style="color:#64748b;">Unsubscribe</a>
      </p>
    </div>
  `;
};

const resolveBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

const formatTemp = (valueF: number | null, unit: "F" | "C") => {
  if (valueF === null) return "—";
  if (unit === "C") {
    return `${Math.round((valueF - 32) * (5 / 9))}°C`;
  }
  return `${Math.round(valueF)}°F`;
};

const resolveTimeZone = (timeZone?: string) => {
  if (!timeZone) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "America/New_York";
  }
};

const getLocalDate = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const getLocalHour = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hourPart = parts.find((part) => part.type === "hour")?.value ?? "0";
  return Number.parseInt(hourPart, 10);
};

const isDueNow = (subscriber: Subscriber, now: Date) => {
  const localHour = getLocalHour(now, subscriber.timezone);
  const localDate = getLocalDate(now, subscriber.timezone);
  return localHour === 7 && subscriber.lastSentOn !== localDate;
};

export async function POST(request: NextRequest) {
  try {
    const subscribers = await listSubscribers();
    if (subscribers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "1";
    const now = new Date();
    const baseUrl = resolveBaseUrl();

    const dueSubscribers = force
      ? subscribers
      : subscribers.filter((subscriber) => isDueNow(subscriber, now));

    if (dueSubscribers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const weatherCache = new Map<string, Awaited<ReturnType<typeof getWeatherSnapshot>>>();

    const getSnapshotForSubscriber = async (subscriber: Subscriber) => {
      if (!subscriber.location) {
        const key = "default";
        if (!weatherCache.has(key)) {
          weatherCache.set(key, await getWeatherSnapshot());
        }
        return weatherCache.get(key)!;
      }

      const key = `${subscriber.location.lat.toFixed(3)},${subscriber.location.lon.toFixed(3)}`;
      if (!weatherCache.has(key)) {
        weatherCache.set(
          key,
          await getWeatherSnapshotByCoords(
            subscriber.location.lat,
            subscriber.location.lon,
            subscriber.location.name
          )
        );
      }
      return weatherCache.get(key)!;
    };

    const results = await Promise.allSettled(
      dueSubscribers.map(async (subscriber) => {
        const snapshot = await getSnapshotForSubscriber(subscriber);
        const today = snapshot.data.daily[0];
        const summary = today?.summary ?? snapshot.data.current.condition;
        const high = formatTemp(today?.highF ?? null, subscriber.unit);
        const low = formatTemp(today?.lowF ?? null, subscriber.unit);
        const locationName =
          subscriber.location?.name ?? snapshot.data.location.name;

        await sendEmail({
          to: subscriber.email,
          subject: "Your SkyView morning forecast",
          html: buildEmail(
            locationName,
            summary,
            high,
            low,
            `${baseUrl}/api/unsubscribe?token=${subscriber.token}`
          ),
        });

        return subscriber.email;
      })
    );

    const sentSet = new Set(
      results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value)
    );
    if (sentSet.size > 0) {
      const updatedSubscribers = subscribers.map((subscriber) => {
        if (!sentSet.has(subscriber.email)) return subscriber;
        return {
          ...subscriber,
          lastSentOn: getLocalDate(now, subscriber.timezone),
        };
      });
      await saveSubscribers(updatedSubscribers);
    }

    return NextResponse.json({ ok: true, sent: sentSet.size });
  } catch (error) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
