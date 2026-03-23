"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
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

const convertFromF = (valueF: number | null, unit: "F" | "C") => {
  if (valueF === null) return null;
  return unit === "F" ? valueF : (valueF - 32) * (5 / 9);
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
  brass: string;
  brassSoft: string;
  panelFrom: string;
  panelTo: string;
  haze: string;
};

const getSkyTheme = (condition: string, hour: number): SkyTheme => {
  const normalized = condition.toLowerCase();
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 17 && hour < 20;

  if (normalized.includes("storm") || normalized.includes("thunder")) {
    return {
      background: isNight
        ? "radial-gradient(140% 100% at 50% -10%, #1b2232 0%, #0c121d 42%, #070b14 100%)"
        : "radial-gradient(140% 100% at 50% -10%, #263247 0%, #121a29 45%, #090f1b 100%)",
      glowA: "rgba(120, 136, 173, 0.42)",
      glowB: "rgba(193, 148, 88, 0.16)",
      glowC: "rgba(17, 24, 39, 0.4)",
      brass: "#d49b52",
      brassSoft: "rgba(212, 155, 82, 0.26)",
      panelFrom: "rgba(10, 17, 30, 0.86)",
      panelTo: "rgba(22, 32, 48, 0.55)",
      haze: "rgba(52, 74, 102, 0.3)",
    };
  }

  if (normalized.includes("snow")) {
    return {
      background: isNight
        ? "radial-gradient(140% 100% at 50% -10%, #20283a 0%, #111928 46%, #0a111d 100%)"
        : "radial-gradient(140% 100% at 50% -10%, #d8e0ec 0%, #afbccf 48%, #8e9bb0 100%)",
      glowA: "rgba(176, 204, 232, 0.36)",
      glowB: "rgba(208, 219, 233, 0.24)",
      glowC: "rgba(28, 38, 54, 0.26)",
      brass: "#b4905e",
      brassSoft: "rgba(180, 144, 94, 0.24)",
      panelFrom: "rgba(18, 28, 42, 0.75)",
      panelTo: "rgba(33, 47, 67, 0.5)",
      haze: "rgba(201, 215, 231, 0.22)",
    };
  }

  if (normalized.includes("rain") || normalized.includes("shower")) {
    return {
      background: isNight
        ? "radial-gradient(140% 100% at 50% -10%, #253149 0%, #101826 45%, #080f1a 100%)"
        : "radial-gradient(140% 100% at 50% -10%, #3d4e67 0%, #1d2a3f 46%, #101a2c 100%)",
      glowA: "rgba(128, 170, 216, 0.34)",
      glowB: "rgba(210, 160, 97, 0.14)",
      glowC: "rgba(45, 65, 95, 0.24)",
      brass: "#c79457",
      brassSoft: "rgba(199, 148, 87, 0.22)",
      panelFrom: "rgba(11, 20, 33, 0.84)",
      panelTo: "rgba(31, 45, 65, 0.56)",
      haze: "rgba(125, 168, 214, 0.24)",
    };
  }

  if (normalized.includes("cloud")) {
    return {
      background: isNight
        ? "radial-gradient(140% 100% at 50% -10%, #2b3547 0%, #111a29 46%, #090f19 100%)"
        : isDusk
          ? "radial-gradient(140% 100% at 50% -10%, #4d5662 0%, #2f3b4f 44%, #1a2436 100%)"
          : "radial-gradient(140% 100% at 50% -10%, #5a6372 0%, #354254 46%, #1c273a 100%)",
      glowA: "rgba(157, 172, 197, 0.32)",
      glowB: "rgba(201, 156, 95, 0.16)",
      glowC: "rgba(72, 87, 111, 0.26)",
      brass: "#c59a63",
      brassSoft: "rgba(197, 154, 99, 0.2)",
      panelFrom: "rgba(14, 23, 38, 0.8)",
      panelTo: "rgba(35, 46, 64, 0.52)",
      haze: "rgba(170, 187, 209, 0.2)",
    };
  }

  if (isNight) {
    return {
      background: "radial-gradient(140% 100% at 50% -10%, #1c2436 0%, #111a2b 45%, #080d17 100%)",
      glowA: "rgba(102, 126, 162, 0.3)",
      glowB: "rgba(205, 157, 90, 0.18)",
      glowC: "rgba(32, 45, 66, 0.2)",
      brass: "#d5a160",
      brassSoft: "rgba(213, 161, 96, 0.2)",
      panelFrom: "rgba(9, 16, 28, 0.82)",
      panelTo: "rgba(25, 35, 53, 0.54)",
      haze: "rgba(96, 121, 161, 0.22)",
    };
  }

  if (isDawn || isDusk) {
    return {
      background: isDawn
        ? "radial-gradient(140% 100% at 50% -10%, #6a7385 0%, #334153 44%, #1b2738 100%)"
        : "radial-gradient(140% 100% at 50% -10%, #775f53 0%, #3e3f4e 44%, #1f2738 100%)",
      glowA: "rgba(211, 163, 94, 0.34)",
      glowB: "rgba(156, 122, 97, 0.24)",
      glowC: "rgba(74, 93, 121, 0.24)",
      brass: "#dca35d",
      brassSoft: "rgba(220, 163, 93, 0.24)",
      panelFrom: "rgba(15, 24, 36, 0.78)",
      panelTo: "rgba(36, 47, 67, 0.48)",
      haze: "rgba(210, 168, 108, 0.24)",
    };
  }

  return {
    background: "radial-gradient(140% 100% at 50% -10%, #445e84 0%, #243754 44%, #121d2f 100%)",
    glowA: "rgba(111, 160, 221, 0.3)",
    glowB: "rgba(201, 157, 92, 0.2)",
    glowC: "rgba(63, 94, 136, 0.2)",
    brass: "#d7a564",
    brassSoft: "rgba(215, 165, 100, 0.22)",
    panelFrom: "rgba(12, 21, 34, 0.8)",
    panelTo: "rgba(31, 43, 61, 0.5)",
    haze: "rgba(104, 146, 202, 0.18)",
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

  const updatedAt = meta?.fetchedAt ?? weather.updatedAt.hourly;
  const firstHourlySummary = weather.hourly[0]?.summary?.toLowerCase() ?? "";
  const firstHourlyPrecip = weather.hourly[0]?.precipChance ?? 0;
  const currentCondition = weather.current.condition.toLowerCase();
  const skyHour = useMemo(() => {
    const reference = weather.hourly[0]?.time ?? weather.updatedAt.hourly;
    const parsed = new Date(reference);
    if (Number.isNaN(parsed.getTime())) {
      return new Date().getHours();
    }
    return parsed.getHours();
  }, [weather.hourly, weather.updatedAt.hourly]);
  const visualCondition = useMemo(() => {
    const hasStormSignal =
      currentCondition.includes("storm") ||
      currentCondition.includes("thunder") ||
      firstHourlySummary.includes("storm") ||
      firstHourlySummary.includes("thunder");
    if (hasStormSignal) return "storm";

    const hasSnowSignal =
      currentCondition.includes("snow") ||
      currentCondition.includes("sleet") ||
      firstHourlySummary.includes("snow") ||
      firstHourlySummary.includes("sleet");
    if (hasSnowSignal) return "snow";

    const hasRainSignal =
      currentCondition.includes("rain") ||
      currentCondition.includes("shower") ||
      currentCondition.includes("drizzle") ||
      firstHourlySummary.includes("rain") ||
      firstHourlySummary.includes("shower") ||
      firstHourlySummary.includes("drizzle") ||
      firstHourlyPrecip >= 55;
    if (hasRainSignal) return "rain";

    if (currentCondition.includes("cloud") || firstHourlySummary.includes("cloud")) return "cloud";
    return currentCondition;
  }, [currentCondition, firstHourlyPrecip, firstHourlySummary]);
  const skyTheme = getSkyTheme(visualCondition, skyHour);
  const skyPhase = skyHour < 6 || skyHour >= 20 ? "night" : skyHour < 9 ? "dawn" : skyHour >= 17 ? "dusk" : "day";
  const weatherMood = visualCondition.includes("storm")
    ? "storm"
    : visualCondition.includes("snow")
      ? "snow"
      : visualCondition.includes("rain")
        ? "rain"
        : visualCondition.includes("cloud")
          ? "cloud"
          : "clear";

  const outsideHumidity = weather.current.humidity ?? 0;
  const outsideWind = weather.current.windSpeedMph ?? 0;
  const outsideFeelsLike = weather.current.feelsLikeF ?? weather.current.temperatureF ?? 0;
  const outsideWetness = Math.min(
    100,
    Math.round(firstHourlyPrecip * 0.65 + outsideHumidity * 0.35)
  );
  const outsideWindScore = Math.min(100, Math.round((outsideWind / 40) * 100));
  const outsideComfortScore = Math.max(
    0,
    100 - Math.min(100, Math.round(Math.abs(outsideFeelsLike - 68) * 2.4))
  );
  const outsideNow = {
    wetnessScore: outsideWetness,
    windScore: outsideWindScore,
    comfortScore: outsideComfortScore,
    wetnessLabel:
      outsideWetness >= 75
        ? "Street sheen"
        : outsideWetness >= 45
          ? "Damp sidewalks"
          : "Mostly dry",
    windLabel:
      outsideWind >= 25 ? "Strong gusts" : outsideWind >= 12 ? "Breezy" : "Light air",
    comfortLabel:
      outsideFeelsLike <= 38
        ? "Layer up"
        : outsideFeelsLike >= 86
          ? "Heat load"
          : "Comfort band",
  };

  const loadWeather = async (
    lat: number,
    lon: number,
    name?: string | null
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
    } catch {
      setNotice("We couldn’t load that location. Try another nearby city.");
    }
  };

  useEffect(() => {
    const refresh = async () => {
      await loadWeather(
        weather.location.lat,
        weather.location.lon,
        weather.location.name
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

  const formatSuggestionLabel = (item: GeoSuggestion) =>
    [item.name, item.admin1, item.country].filter(Boolean).join(", ");

  const handleSelectSuggestion = async (item: GeoSuggestion) => {
    const label = formatSuggestionLabel(item);
    setSearchQuery(label);
    setSuggestions([]);
    setNotice(null);
    setSearchStatus("loading");
    await loadWeather(item.lat, item.lon, label);
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
        await loadWeather(latitude, longitude, "Your location");
        setLocationStatus("idle");
      },
      () => {
        setLocationStatus("error");
        setNotice("We couldn’t access your location. Try searching instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const summary = useMemo(() => {
    const day = weather.daily[0];
    if (!day) return "";
    return `H: ${formatTemp(day.highF, unit)} L: ${formatTemp(day.lowF, unit)}`;
  }, [weather.daily, unit]);

  const now = new Date();
  const timeBadge = {
    time: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(now),
    date: new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(now),
  };

  const sparkline = useMemo(() => {
    const days = weather.daily.slice(0, 7);
    const values = days.map((day) => convertFromF(day.highF, unit));
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

  const dailyRange = useMemo(() => {
    const lows = weather.daily.map((day) => convertFromF(day.lowF, unit));
    const highs = weather.daily.map((day) => convertFromF(day.highF, unit));
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

  return (
    <div className="text-white relative">
      <div
        className={`weather-bg weather-${weatherMood} phase-${skyPhase}`}
        style={
          {
            background: skyTheme.background,
            ["--sky-glow-a" as string]: skyTheme.glowA,
            ["--sky-glow-b" as string]: skyTheme.glowB,
            ["--sky-glow-c" as string]: skyTheme.glowC,
            ["--accent-brass" as string]: skyTheme.brass,
            ["--accent-brass-soft" as string]: skyTheme.brassSoft,
            ["--surface-from" as string]: skyTheme.panelFrom,
            ["--surface-to" as string]: skyTheme.panelTo,
            ["--weather-haze" as string]: skyTheme.haze,
          } as CSSProperties
        }
      />
      <div className="particles">
        <div
          className="sky-depth-glow"
          style={{ background: skyTheme.glowC }}
        />
        <div className={`weather-veil weather-veil-${weatherMood}`} />
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
              <div className="brand-mark w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">
                <span className="brand-mark-dot" />
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
                onClick={() => setUnit("C")}
              >
                °C
              </button>
              <button
                className={`unit-toggle px-3 py-1.5 rounded-xl text-sm font-semibold ${
                  unit === "F" ? "unit-active" : ""
                }`}
                onClick={() => setUnit("F")}
              >
                °F
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 max-w-7xl mx-auto" id="mainContent">
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

                <div className="outside-strip mt-6">
                  <div className="outside-strip-head">
                    <p>Outside right now</p>
                    <span>{weather.current.condition}</span>
                  </div>
                  <div className="outside-strip-grid">
                    <div className="outside-meter">
                      <div className="outside-meter-label">
                        <span>Pavement</span>
                        <strong>{outsideNow.wetnessLabel}</strong>
                      </div>
                      <div className="outside-meter-track">
                        <div
                          className="outside-meter-fill"
                          style={{ width: `${outsideNow.wetnessScore}%` }}
                        />
                      </div>
                    </div>
                    <div className="outside-meter">
                      <div className="outside-meter-label">
                        <span>Wind rhythm</span>
                        <strong>{outsideNow.windLabel}</strong>
                      </div>
                      <div className="outside-meter-track">
                        <div
                          className="outside-meter-fill"
                          style={{ width: `${outsideNow.windScore}%` }}
                        />
                      </div>
                    </div>
                    <div className="outside-meter">
                      <div className="outside-meter-label">
                        <span>Comfort</span>
                        <strong>{outsideNow.comfortLabel}</strong>
                      </div>
                      <div className="outside-meter-track">
                        <div
                          className="outside-meter-fill"
                          style={{ width: `${outsideNow.comfortScore}%` }}
                        />
                      </div>
                    </div>
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
                          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.05" />
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
                    const lowValue = convertFromF(day.lowF, unit);
                    const highValue = convertFromF(day.highF, unit);
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
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
