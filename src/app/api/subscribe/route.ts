import { NextResponse } from "next/server";
import { addSubscriber } from "@/lib/subscribers";

type SubscribeRequest = {
  email?: string;
  location?: {
    name?: string;
    lat?: number;
    lon?: number;
  };
  unit?: "F" | "C";
  timezone?: string;
};

export async function POST(request: Request) {
  try {
    const { email, location, unit, timezone } =
      (await request.json()) as SubscribeRequest;
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const result = await addSubscriber(email, {
      location:
        location && typeof location.lat === "number" && typeof location.lon === "number"
          ? {
              name: location.name ?? "Your location",
              lat: location.lat,
              lon: location.lon,
            }
          : undefined,
      unit,
      timezone,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Unable to subscribe" }, { status: 500 });
  }
}
