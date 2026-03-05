"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { WeatherPayload } from "@/lib/nws";
import type { WeatherMeta } from "@/lib/weather-pipeline";

const formatTemp = (value: number | null, unit: "F" | "C") => {
  if (value === null) return "—";
  return unit === "F"
    ? `${Math.round(value)}°F`
    : `${Math.round((value - 32) * (5 / 9))}°C`;
};

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

const formatDay = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
  }).format(new Date(iso));

type SkyTheme = {
  background: string;
  glowA: string;
  glowB: string;
  glowC: string;
};

const getSkyTheme = (condition: string, hour: number): SkyTheme => {
  const normalized = condition.toLowerCase();
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 17 && hour < 20;

  if (normalized.includes("storm") || normalized.includes("thunder")) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #04060e 0%, #0f172a 35%, #1f2937 75%, #111827 100%)"
        : "linear-gradient(160deg, #0b1120 0%, #1e293b 35%, #334155 75%, #111827 100%)",
      glowA: "rgba(99, 102, 241, 0.35)",
      glowB: "rgba(59, 130, 246, 0.2)",
      glowC: "rgba(2, 6, 23, 0.25)",
    };
  }

  if (normalized.includes("snow")) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #111827 0%, #1f2937 35%, #334155 70%, #1e293b 100%)"
        : "linear-gradient(160deg, #dbeafe 0%, #cbd5e1 35%, #bfdbfe 70%, #e2e8f0 100%)",
      glowA: "rgba(147, 197, 253, 0.3)",
      glowB: "rgba(255, 255, 255, 0.22)",
      glowC: "rgba(59, 130, 246, 0.15)",
    };
  }

  if (normalized.includes("rain") || normalized.includes("shower")) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #020617 0%, #0f172a 40%, #1e293b 75%, #334155 100%)"
        : "linear-gradient(160deg, #1e293b 0%, #334155 40%, #475569 75%, #64748b 100%)",
      glowA: "rgba(56, 189, 248, 0.25)",
      glowB: "rgba(99, 102, 241, 0.18)",
      glowC: "rgba(148, 163, 184, 0.16)",
    };
  }

  if (normalized.includes("cloud")) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #0f172a 0%, #1e293b 35%, #334155 75%, #1f2937 100%)"
        : isDusk
          ? "linear-gradient(160deg, #334155 0%, #475569 30%, #64748b 65%, #f59e0b 100%)"
          : "linear-gradient(160deg, #334155 0%, #475569 35%, #64748b 70%, #94a3b8 100%)",
      glowA: "rgba(148, 163, 184, 0.28)",
      glowB: "rgba(125, 211, 252, 0.18)",
      glowC: "rgba(251, 191, 36, 0.12)",
    };
  }

  if (isNight) {
    return {
      background: "linear-gradient(160deg, #020617 0%, #0f172a 35%, #1e1b4b 70%, #312e81 100%)",
      glowA: "rgba(99, 102, 241, 0.32)",
      glowB: "rgba(56, 189, 248, 0.16)",
      glowC: "rgba(168, 85, 247, 0.15)",
    };
  }

  if (isDawn || isDusk) {
    return {
      background: isDawn
        ? "linear-gradient(160deg, #0ea5e9 0%, #38bdf8 30%, #fb923c 65%, #fbbf24 100%)"
        : "linear-gradient(160deg, #2563eb 0%, #0ea5e9 30%, #f97316 65%, #fb7185 100%)",
      glowA: "rgba(251, 191, 36, 0.32)",
      glowB: "rgba(244, 114, 182, 0.2)",
      glowC: "rgba(14, 165, 233, 0.2)",
    };
  }

  return {
    background: "linear-gradient(160deg, #0ea5e9 0%, #38bdf8 35%, #7dd3fc 70%, #bae6fd 100%)",
    glowA: "rgba(14, 165, 233, 0.34)",
    glowB: "rgba(251, 191, 36, 0.18)",
    glowC: "rgba(56, 189, 248, 0.16)",
  };
};

const conditionToEmoji = (condition: string) => {
  const normalized = condition.toLowerCase();
  if (normalized.includes("thunder") || normalized.includes("storm")) return "⛈️";
  if (normalized.includes("snow")) return "🌨️";
  if (normalized.includes("sleet")) return "🌨️";
  if (normalized.includes("rain") || normalized.includes("shower")) return "🌧️";
  if (normalized.includes("drizzle")) return "🌦️";
  if (normalized.includes("fog") || normalized.includes("mist")) return "🌫️";
  if (normalized.includes("wind")) return "💨";
  if (normalized.includes("partly")) return "⛅";
  if (normalized.includes("cloud")) return "☁️";
  if (normalized.includes("night")) return "🌙";
  return "☀️";
};

type Particle = {
  id: string;
  left: string;
  delay: string;
  duration: string;
  size?: string;
  height?: string;
};

type WeatherViewProps = {
  initialWeather: WeatherPayload;
  initialMeta: WeatherMeta;
};

type GeoSuggestion = {
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
};

export default function WeatherView({ initialWeather, initialMeta }: WeatherViewProps) {
  const [weather, setWeather] = useState(initialWeather);
  const [meta, setMeta] = useState(initialMeta);
  const [unit, setUnit] = useState<"F" | "C">("F");
  const [email, setEmail] = useState("");
  const [subscribeState, setSubscribeState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [rain, setRain] = useState<Particle[]>([]);
  const [snow, setSnow] = useState<Particle[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [locationChosen, setLocationChosen] = useState(false);
  const [unitChosen, setUnitChosen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const updatedAt = meta?.fetchedAt ?? weather.updatedAt.hourly;
  const skyHour = useMemo(() => {
    const reference = weather.hourly[0]?.time ?? weather.updatedAt.hourly;
    const parsed = new Date(reference);
    if (Number.isNaN(parsed.getTime())) {
      return new Date().getHours();
    }
    return parsed.getHours();
  }, [weather.hourly, weather.updatedAt.hourly]);
  const visualCondition = useMemo(() => {
    const current = weather.current.condition.toLowerCase();
    const nextHour = weather.hourly[0]?.summary?.toLowerCase() ?? "";
    const precipNow = weather.hourly[0]?.precipChance ?? 0;

    const hasStormSignal =
      current.includes("storm") ||
      current.includes("thunder") ||
      nextHour.includes("storm") ||
      nextHour.includes("thunder");
    if (hasStormSignal) return "storm";

    const hasSnowSignal =
      current.includes("snow") ||
      current.includes("sleet") ||
      nextHour.includes("snow") ||
      nextHour.includes("sleet");
    if (hasSnowSignal) return "snow";

    const hasRainSignal =
      current.includes("rain") ||
      current.includes("shower") ||
      current.includes("drizzle") ||
      nextHour.includes("rain") ||
      nextHour.includes("shower") ||
      nextHour.includes("drizzle") ||
      precipNow >= 55;
    if (hasRainSignal) return "rain";

    if (current.includes("cloud") || nextHour.includes("cloud")) return "cloud";
    return current;
  }, [weather.current.condition, weather.hourly]);
  const skyTheme = getSkyTheme(visualCondition, skyHour);

  const loadWeather = async (
    lat: number,
    lon: number,
    name?: string | null,
    source: "auto" | "user" = "auto"
  ) => {
    try {
      setNotice(null);
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
      });
      if (name) params.set("name", name);

      const response = await fetch(`/api/weather?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Unable to load weather");
      }
      const payload = await response.json();
      if (payload?.data) setWeather(payload.data as WeatherPayload);
      if (payload?.meta) setMeta(payload.meta as WeatherMeta);
      if (source === "user") setLocationChosen(true);
    } catch {
      setNotice("We couldn’t load that location. Try another nearby city.");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const completed = window.localStorage.getItem("skyview_onboarding_complete");
      setShowOnboarding(completed !== "true");
    }
  }, []);

  useEffect(() => {
    const refresh = async () => {
      await loadWeather(
        weather.location.lat,
        weather.location.lon,
        weather.location.name,
        "auto"
      );
    };

    const id = window.setInterval(refresh, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [weather.location.lat, weather.location.lon, weather.location.name]);

  useEffect(() => {
    const normalized = visualCondition;
    if (normalized.includes("rain") || normalized.includes("storm")) {
      const drops = Array.from({ length: 60 }, (_, index) => ({
        id: `rain-${index}`,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 2}s`,
        duration: `${Math.random() * 0.5 + 0.5}s`,
        height: `${Math.random() * 20 + 15}px`,
      }));
      setRain(drops);
    } else {
      setRain([]);
    }

    if (normalized.includes("snow")) {
      const flakes = Array.from({ length: 40 }, (_, index) => ({
        id: `snow-${index}`,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${Math.random() * 3 + 4}s`,
        size: `${Math.random() * 4 + 3}px`,
      }));
      setSnow(flakes);
    } else {
      setSnow([]);
    }
  }, [visualCondition]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSearchStatus("idle");
      return;
    }

    setSearchStatus("loading");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/geocode?query=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("geocode failed");
        const payload = await response.json();
        setSuggestions((payload?.results as GeoSuggestion[]) ?? []);
        setSearchStatus("idle");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setSuggestions([]);
        setSearchStatus("error");
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) return;

    setSubscribeState("loading");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          unit,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: {
            name: weather.location.name,
            lat: weather.location.lat,
            lon: weather.location.lon,
          },
        }),
      });
      if (!response.ok) {
        setSubscribeState("error");
        return;
      }
      setSubscribeState("success");
      if (showOnboarding) {
        window.localStorage.setItem("skyview_onboarding_complete", "true");
        setShowOnboarding(false);
      }
    } catch {
      setSubscribeState("error");
    }
  };

  const dismissOnboarding = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("skyview_onboarding_complete", "true");
    }
    setShowOnboarding(false);
  };

  const formatSuggestionLabel = (item: GeoSuggestion) =>
    [item.name, item.admin1, item.country].filter(Boolean).join(", ");

  const handleSelectSuggestion = async (item: GeoSuggestion) => {
    const label = formatSuggestionLabel(item);
    setSearchQuery(label);
    setSuggestions([]);
    setNotice(null);
    setSearchStatus("loading");
    await loadWeather(item.lat, item.lon, label, "user");
    setSearchStatus("idle");
  };

  const handleSearchSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    if (suggestions[0]) {
      await handleSelectSuggestion(suggestions[0]);
      return;
    }

    try {
      setSearchStatus("loading");
      const response = await fetch(
        `/api/geocode?query=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error("geocode failed");
      const payload = await response.json();
      const first = (payload?.results as GeoSuggestion[])?.[0];
      if (first) {
        await handleSelectSuggestion(first);
      } else {
        setNotice("No matches found. Try a nearby city.");
      }
    } catch {
      setNotice("No matches found. Try a nearby city.");
    } finally {
      setSearchStatus("idle");
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setNotice("Geolocation isn’t supported in this browser.");
      return;
    }

    setLocationStatus("loading");
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await loadWeather(latitude, longitude, "Your location", "user");
        setLocationStatus("idle");
      },
      () => {
        setLocationStatus("error");
        setNotice("We couldn’t access your location. Try searching instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const focusSearch = () => {
    searchRef.current?.focus();
  };

  const summary = useMemo(() => {
    const day = weather.daily[0];
    if (!day) return "";
    return `H: ${formatTemp(day.highF, unit)} L: ${formatTemp(day.lowF, unit)}`;
  }, [weather.daily, unit]);

  const toUnitValue = (valueF: number | null) => {
    if (valueF === null) return null;
    if (unit === "F") return valueF;
    return (valueF - 32) * (5 / 9);
  };

  const timeBadge = useMemo(() => {
    const now = new Date();
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
    const date = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(now);
    return { time, date };
  }, [updatedAt]);

  const sparkline = useMemo(() => {
    const days = weather.daily.slice(0, 7);
    const values = days.map((day) => toUnitValue(day.highF));
    const valid = values.filter((value): value is number => value !== null);
    if (valid.length === 0 || days.length < 2) {
      return { path: "", area: "", maxIndex: 0, minIndex: 0, values };
    }

    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;

    const points = values.map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = value === null ? 50 : 100 - ((value - min) / range) * 100;
      return { x, y };
    });

    const buildPath = (pointList: Array<{ x: number; y: number }>) => {
      if (pointList.length < 2) return "";
      const smoothing = 0.18;
      let d = `M ${pointList[0].x},${pointList[0].y}`;
      for (let i = 1; i < pointList.length; i += 1) {
        const prev = pointList[i - 1];
        const current = pointList[i];
        const next = pointList[i + 1] ?? current;
        const prevPrev = pointList[i - 2] ?? prev;

        const dx1 = (current.x - prevPrev.x) * smoothing;
        const dy1 = (current.y - prevPrev.y) * smoothing;
        const dx2 = (next.x - prev.x) * smoothing;
        const dy2 = (next.y - prev.y) * smoothing;

        const cp1x = prev.x + dx1;
        const cp1y = prev.y + dy1;
        const cp2x = current.x - dx2;
        const cp2y = current.y - dy2;

        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${current.x},${current.y}`;
      }
      return d;
    };

    const path = buildPath(points);
    const area =
      path +
      ` L ${points[points.length - 1].x},100 L ${points[0].x},100 Z`;

    let maxIndex = 0;
    let minIndex = 0;
    values.forEach((value, index) => {
      if (value === null) return;
      if (value === max) maxIndex = index;
      if (value === min) minIndex = index;
    });

    return { path, area, maxIndex, minIndex, values, min, max };
  }, [weather.daily, unit]);

  const hourlyTrend = useMemo(() => {
    const hours = weather.hourly.slice(0, 12);
    if (hours.length < 2) {
      return {
        linePath: "",
        areaPath: "",
        bars: [] as Array<{ x: number; width: number; y: number; height: number; pop: number }>,
        ticks: [] as Array<{ index: number; label: string }>,
      };
    }

    const temps = hours.map((hour) => toUnitValue(hour.temperatureF) ?? 0);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const tempRange = maxTemp - minTemp || 1;

    const points = temps.map((temp, index) => {
      const x = (index / (temps.length - 1)) * 100;
      const y = 74 - ((temp - minTemp) / tempRange) * 44;
      return { x, y };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} 84 L ${points[0].x} 84 Z`;

    const barWidth = 100 / hours.length;
    const bars = hours.map((hour, index) => {
      const pop = hour.precipChance ?? 0;
      const height = (pop / 100) * 24;
      const x = index * barWidth + barWidth * 0.18;
      const width = barWidth * 0.64;
      const y = 90 - height;
      return { x, width, y, height, pop };
    });

    const tickIndexes = [0, 3, 6, 9, 11].filter((index) => index < hours.length);
    const ticks = tickIndexes.map((index) => ({
      index,
      label: formatTime(hours[index].time),
    }));

    return { linePath, areaPath, bars, ticks };
  }, [weather.hourly, unit]);

  const dailyRange = useMemo(() => {
    const lows = weather.daily.map((day) => toUnitValue(day.lowF));
    const highs = weather.daily.map((day) => toUnitValue(day.highF));
    const lowVals = lows.filter((value): value is number => value !== null);
    const highVals = highs.filter((value): value is number => value !== null);
    if (lowVals.length === 0 || highVals.length === 0) {
      return { min: 0, max: 1 };
    }
    return {
      min: Math.min(...lowVals),
      max: Math.max(...highVals),
    };
  }, [weather.daily, unit]);

  const onboardingComplete =
    locationChosen && unitChosen && subscribeState === "success";

  return (
    <div className="text-white relative">
      <div
        className="weather-bg"
        style={
          {
            background: skyTheme.background,
            ["--sky-glow-a" as string]: skyTheme.glowA,
            ["--sky-glow-b" as string]: skyTheme.glowB,
            ["--sky-glow-c" as string]: skyTheme.glowC,
          } as CSSProperties
        }
      />
      <div className="particles">
        <div
          className="sky-depth-glow"
          style={{ background: skyTheme.glowC }}
        />
        {rain.map((drop) => (
          <div
            key={drop.id}
            className="rain-particle"
            style={{
              left: drop.left,
              height: drop.height,
              animationDuration: drop.duration,
              animationDelay: drop.delay,
            }}
          />
        ))}
        {snow.map((flake) => (
          <div
            key={flake.id}
            className="snow-particle"
            style={{
              left: flake.left,
              width: flake.size,
              height: flake.size,
              animationDuration: flake.duration,
              animationDelay: flake.delay,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 min-h-screen">
        <header className="px-4 pt-6 pb-2">
          <div className="max-w-7xl mx-auto topbar flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">☀️</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">SkyView Weather</h1>
            </div>

            <div className="relative w-full sm:w-96">
              <form onSubmit={handleSearchSubmit} className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search a city or ZIP"
                  className="search-input w-full pl-11 pr-20 py-3 rounded-2xl text-white placeholder-white/50 outline-none text-sm font-medium"
                  ref={searchRef}
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-all"
                >
                  {searchStatus === "loading" ? "..." : "Go"}
                </button>
              </form>
              {suggestions.length > 0 ? (
                <div className="suggestions-dropdown absolute w-full mt-2 rounded-2xl overflow-hidden z-50">
                  {suggestions.map((item) => (
                    <button
                      key={`${item.name}-${item.lat}-${item.lon}`}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="suggestion-item w-full px-4 py-3 text-left flex items-center gap-3 transition-all"
                    >
                      <span className="text-white/50">📍</span>
                      <span className="font-medium">
                        {formatSuggestionLabel(item)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLocate}
                className="glass px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-white/20"
                disabled={locationStatus === "loading"}
                title="Use my location"
              >
                {locationStatus === "loading" ? "Locating…" : "Use my location"}
              </button>
              <button
                className={`unit-toggle px-3 py-1.5 rounded-xl text-sm font-semibold ${
                  unit === "C" ? "unit-active" : ""
                }`}
                onClick={() => {
                  setUnit("C");
                  setUnitChosen(true);
                }}
              >
                °C
              </button>
              <button
                className={`unit-toggle px-3 py-1.5 rounded-xl text-sm font-semibold ${
                  unit === "F" ? "unit-active" : ""
                }`}
                onClick={() => {
                  setUnit("F");
                  setUnitChosen(true);
                }}
              >
                °F
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 max-w-7xl mx-auto" id="mainContent">
          {showOnboarding ? (
            <section className="glass rounded-3xl p-6 sm:p-8 mb-6">
              <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-white/40">
                    Welcome to SkyView
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-semibold mt-2">
                    Let’s personalize your forecast
                  </h2>
                  <p className="text-sm text-white/60 mt-2 max-w-xl">
                    Pick your location, choose your units, and opt in to a daily
                    briefing. It takes 20 seconds.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={dismissOnboarding}
                    className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white transition-all"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={dismissOnboarding}
                    disabled={!onboardingComplete}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/20 hover:bg-white/30 transition-all disabled:opacity-40 disabled:hover:bg-white/20"
                  >
                    {onboardingComplete ? "Finish setup" : "Complete steps"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-sm font-semibold">
                      {locationChosen ? "✓" : "1"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Set your location</p>
                      <p className="text-xs text-white/50 mt-1">
                        Use GPS or search for a city.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          type="button"
                          onClick={handleLocate}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 transition-all"
                        >
                          Use my location
                        </button>
                        <button
                          type="button"
                          onClick={focusSearch}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 transition-all"
                        >
                          Search
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-sm font-semibold">
                      {unitChosen ? "✓" : "2"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Choose units</p>
                      <p className="text-xs text-white/50 mt-1">
                        Pick Fahrenheit or Celsius.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setUnit("F");
                            setUnitChosen(true);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            unit === "F" ? "bg-white/25" : "bg-white/10 hover:bg-white/20"
                          }`}
                        >
                          °F
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUnit("C");
                            setUnitChosen(true);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            unit === "C" ? "bg-white/25" : "bg-white/10 hover:bg-white/20"
                          }`}
                        >
                          °C
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-sm font-semibold">
                      {subscribeState === "success" ? "✓" : "3"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Daily briefing</p>
                      <p className="text-xs text-white/50 mt-1">
                        Get the 7:00 AM email for your city.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          document
                            .getElementById("email-section")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="mt-3 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 transition-all"
                      >
                        Jump to email sign-up
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
          {notice ? (
            <div className="glass rounded-2xl p-4 mb-6 text-sm text-white/80">
              {notice}
            </div>
          ) : null}
          <div className="dashboard-grid mb-8">
            <section className="fade-in-up hero-stage lg:col-span-2">
              <div className="glass rounded-[32px] p-6 sm:p-8 pulse-glow hero-surface">
                <div className="flex items-start gap-6">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                      Live weather feed
                    </p>
                    <h2 className="text-2xl sm:text-4xl font-semibold mt-2">
                      {weather.location.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <span className="hero-pill">Local time · {timeBadge.time}</span>
                      <span className="hero-pill">{timeBadge.date}</span>
                      <span className="hero-pill">Updated {formatTime(updatedAt)}</span>
                      <span className="hero-pill">{meta.source}</span>
                    </div>
                    <div className="flex items-end gap-2 mt-8">
                      <span className="text-[88px] sm:text-[132px] leading-none font-extralight temp-display">
                        {formatTemp(weather.current.temperatureF, unit)
                          .replace("°F", "")
                          .replace("°C", "")}
                      </span>
                      <span className="text-4xl text-white/70 mb-3">
                        {unit === "F" ? "°F" : "°C"}
                      </span>
                    </div>
                    <p className="text-base sm:text-lg text-white/80 mt-2">
                      {weather.current.condition} · Feels like {formatTemp(weather.current.feelsLikeF, unit)}
                    </p>
                    <p className="text-sm text-white/55 mt-1">{summary}</p>
                  </div>
                </div>

                <div className="hero-kpi-grid mt-7">
                  <div className="hero-kpi-card">
                    <p>Wind</p>
                    <strong>{weather.current.windSpeedMph ?? "—"} mph</strong>
                    <span>{weather.current.windDirection ?? "—"}</span>
                  </div>
                  <div className="hero-kpi-card">
                    <p>Humidity</p>
                    <strong>{weather.current.humidity ?? "—"}%</strong>
                    <span>Current</span>
                  </div>
                  <div className="hero-kpi-card">
                    <p>Visibility</p>
                    <strong>{weather.current.visibilityMiles ?? "—"} mi</strong>
                    <span>Line of sight</span>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45 mb-3">
                    Next 12 hours
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-2 hourly-scroll">
                    {weather.hourly.slice(0, 12).map((hour) => {
                      const emoji = conditionToEmoji(hour.summary);
                      return (
                        <div
                          key={hour.time}
                          className="forecast-card flex-shrink-0 min-w-[84px] px-3 py-3 rounded-2xl text-center bg-white/10 border border-white/15"
                        >
                          <p className="text-[11px] text-white/60 font-medium">
                            {formatTime(hour.time)}
                          </p>
                          <div className="text-xl my-1.5">{emoji}</div>
                          <p className="text-sm font-semibold">
                            {formatTemp(hour.temperatureF, unit)}
                          </p>
                          <p className="text-[11px] text-blue-200 mt-1">
                            {hour.precipChance ?? 0}% rain
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <aside className="fade-in-up side-stack" style={{ animationDelay: "0.12s" }}>
              <section className="glass rounded-[28px] p-5">
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <span className="text-white/60">📅</span>
                  7-Day Forecast
                </h3>
                {sparkline.path ? (
                  <div className="sparkline-wrap">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="sparklineStroke" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#fbbf24" />
                        </linearGradient>
                        <linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(96,165,250,0.35)" />
                          <stop offset="100%" stopColor="rgba(15,23,42,0.05)" />
                        </linearGradient>
                      </defs>
                      <path d={sparkline.area} className="sparkline-area" fill="url(#sparklineFill)" />
                      <path d={sparkline.path} className="sparkline-line" stroke="url(#sparklineStroke)" />
                      {sparkline.values.map((value, index) => {
                        if (value === null) return null;
                        const x = (index / (sparkline.values.length - 1)) * 100;
                        const sparkMin = sparkline.min ?? 0;
                        const sparkMax = sparkline.max ?? 1;
                        const range = sparkMax - sparkMin || 1;
                        const y = 100 - ((value - sparkMin) / range) * 100;
                        const isPeak = index === sparkline.maxIndex;
                        const isLow = index === sparkline.minIndex;
                        return (
                          <circle
                            key={`spark-${index}`}
                            cx={x}
                            cy={y}
                            r={isPeak || isLow ? 2.2 : 1.4}
                            className={
                              isPeak
                                ? "sparkline-dot sparkline-peak"
                                : isLow
                                  ? "sparkline-dot sparkline-low"
                                  : "sparkline-dot"
                            }
                          />
                        );
                      })}
                    </svg>
                    <div className="sparkline-labels">
                      <span>Weekly highs</span>
                      <span>Peak & low markers</span>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1">
                  {weather.daily.map((day) => {
                    const emoji = conditionToEmoji(day.summary);
                    const lowValue = toUnitValue(day.lowF);
                    const highValue = toUnitValue(day.highF);
                    const range = dailyRange.max - dailyRange.min || 1;
                    const lowPercent =
                      lowValue === null ? 0 : ((lowValue - dailyRange.min) / range) * 100;
                    const highPercent =
                      highValue === null ? 0 : ((highValue - dailyRange.min) / range) * 100;
                    const barLeft = Math.min(lowPercent, highPercent);
                    const barWidth = Math.max(highPercent - lowPercent, 8);

                    return (
                      <div key={day.date} className="forecast-card flex items-center gap-3 p-2.5 rounded-xl">
                        <span className="text-sm font-semibold w-10 text-white/70">
                          {formatDay(day.date)}
                        </span>
                        <span className="text-base">{emoji}</span>
                        <span className="text-sm text-white/50 w-8 text-right">
                          {formatTemp(day.lowF, unit)}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 relative mx-1">
                          <div
                            className="absolute h-full rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 to-orange-400"
                            style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold w-8">
                          {formatTemp(day.highF, unit)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="glass rounded-[28px] p-5 mt-5">
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <span className="text-white/60">📊</span>
                  Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Humidity",
                      value: `${weather.current.humidity ?? "—"}%`,
                      desc: "Current",
                    },
                    {
                      label: "Pressure",
                      value: `${weather.current.pressureInHg ?? "—"} inHg`,
                      desc: "Barometric",
                    },
                    {
                      label: "Dew Point",
                      value: formatTemp(weather.current.dewPointF, unit),
                      desc: "Moisture",
                    },
                    {
                      label: "Feels Like",
                      value: formatTemp(weather.current.feelsLikeF, unit),
                      desc: "Apparent",
                    },
                  ].map((detail) => (
                    <div key={detail.label} className="detail-card bg-white/10 border border-white/15 rounded-2xl p-4">
                      <p className="text-[11px] text-white/55 uppercase tracking-[0.1em]">{detail.label}</p>
                      <p className="text-xl font-semibold mt-2">{detail.value}</p>
                      <p className="text-xs text-white/45 mt-1">{detail.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>

          <section className="fade-in-up mb-8" style={{ animationDelay: "0.18s" }}>
            <div className="glass rounded-[28px] p-5 sm:p-6 alt-forecast-shell">
              <div className="flex items-center justify-between gap-4 mb-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                  12-Hour Trend
                </p>
                <span className="text-xs text-white/60">
                  Actual observations
                </span>
              </div>
              <div className="alt-forecast-grid" />
              <svg viewBox="0 0 100 100" className="alt-forecast-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="trendBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(125,211,252,0.34)" />
                    <stop offset="100%" stopColor="rgba(125,211,252,0.03)" />
                  </linearGradient>
                </defs>
                {hourlyTrend.areaPath ? (
                  <path d={hourlyTrend.areaPath} fill="url(#trendBand)" />
                ) : null}
                {hourlyTrend.bars.map((bar, index) => (
                  <rect
                    key={`precip-bar-${index}`}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    rx="0.9"
                    className="trend-precip-bar"
                  />
                ))}
                {hourlyTrend.linePath ? (
                  <path
                    d={hourlyTrend.linePath}
                    className="alt-track alt-track-main"
                  />
                ) : null}
              </svg>
              <div className="alt-forecast-legend">
                <span>
                  <i className="alt-legend-line alt-legend-main" />
                  Temperature
                </span>
                <span>
                  <i className="alt-legend-line alt-legend-bar" />
                  Precipitation chance
                </span>
              </div>
              <div className="alt-forecast-ticks">
                {hourlyTrend.ticks.map((tick) => (
                  <span key={`trend-tick-${tick.index}`}>
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section
            id="email-section"
            className="fade-in-up mb-8"
            style={{ animationDelay: "0.3s" }}
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-white/60">✉️</span>
              Morning Email Brief
            </h3>
            <div className="glass rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div>
                <p className="text-white/80 font-semibold">
                  Get a daily summary at 7:00 AM
                </p>
                <p className="text-sm text-white/50">
                  We’ll send the forecast for {weather.location.name}.
                </p>
              </div>
              <form onSubmit={onSubmit} className="flex w-full sm:w-auto gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@email.com"
                  className="search-input w-full sm:w-64 px-4 py-3 rounded-2xl text-white placeholder-white/50 outline-none text-sm font-medium"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-all"
                  disabled={subscribeState === "loading"}
                >
                  {subscribeState === "loading" ? "Saving" : "Notify"}
                </button>
              </form>
              {subscribeState === "success" ? (
                <span className="text-xs text-green-200">Subscribed</span>
              ) : null}
              {subscribeState === "error" ? (
                <span className="text-xs text-red-200">Try again</span>
              ) : null}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
