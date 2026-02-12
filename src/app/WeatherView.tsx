"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

const conditionToTheme = (condition: string) => {
  const normalized = condition.toLowerCase();
  if (normalized.includes("snow")) return "bg-snowy";
  if (normalized.includes("storm") || normalized.includes("thunder")) return "bg-stormy";
  if (normalized.includes("rain") || normalized.includes("shower")) return "bg-rainy";
  if (normalized.includes("cloud")) return "bg-cloudy";
  if (normalized.includes("night")) return "bg-night";
  return "bg-sunny";
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

  const themeClass = conditionToTheme(weather.current.condition);
  const updatedAt = meta?.fetchedAt ?? weather.updatedAt.hourly;

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
    const normalized = weather.current.condition.toLowerCase();
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
  }, [weather.current.condition]);

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
    } catch {
      setSubscribeState("error");
    }
  };

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

  const heroEmoji = conditionToEmoji(weather.current.condition);

  return (
    <div className="text-white relative">
      <div className={`weather-bg ${themeClass}`} />
      <div className="particles">
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
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">☀️</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">SkyView</h1>
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

        <main className="px-4 py-6 max-w-6xl mx-auto" id="mainContent">
          {notice ? (
            <div className="glass rounded-2xl p-4 mb-6 text-sm text-white/80">
              {notice}
            </div>
          ) : null}
          <section className="fade-in-up mb-8">
            <div className="glass rounded-3xl p-6 sm:p-10 pulse-glow">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="text-center lg:text-left">
                  <div className="flex items-center gap-2 justify-center lg:justify-start mb-2">
                    <span className="text-white/60 text-sm">📍</span>
                    <h2 className="text-2xl sm:text-3xl font-bold">
                      {weather.location.name}
                    </h2>
                  </div>
                  <p className="text-white/60 text-sm font-medium mb-6">
                    Updated {formatTime(updatedAt)} · {meta.source}
                  </p>
                  <div className="flex items-start gap-2 justify-center lg:justify-start">
                    <span className="text-8xl sm:text-9xl font-extralight temp-display leading-none">
                      {formatTemp(weather.current.temperatureF, unit)
                        .replace("°F", "")
                        .replace("°C", "")}
                    </span>
                    <span className="text-3xl font-light text-white/70 mt-2">
                      {unit === "F" ? "°F" : "°C"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-4 justify-center lg:justify-start">
                    <span className="text-lg font-medium text-white/80 capitalize">
                      {weather.current.condition}
                    </span>
                    <span className="text-white/40">|</span>
                    <span className="text-sm text-white/60">
                      Feels like {formatTemp(weather.current.feelsLikeF, unit)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 justify-center lg:justify-start text-sm text-white/50">
                    <span>{summary}</span>
                  </div>
                </div>
                <div className="relative float-anim">
                  <div className="sun-rays" />
                  <div className="text-[120px] sm:text-[160px] leading-none weather-icon">
                    {heroEmoji}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="fade-in-up mb-8" style={{ animationDelay: "0.15s" }}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-white/60">⏱</span>
              Hourly Forecast
            </h3>
            <div className="glass rounded-2xl p-4">
              <div className="flex gap-4 overflow-x-auto pb-2 hourly-scroll">
                {weather.hourly.slice(0, 12).map((hour) => {
                  const emoji = conditionToEmoji(hour.summary);
                  return (
                  <div
                    key={hour.time}
                    className="forecast-card flex-shrink-0 w-20 glass rounded-2xl p-3 text-center cursor-default"
                  >
                    <p className="text-xs text-white/60 font-medium">
                      {formatTime(hour.time)}
                    </p>
                    <div className="text-2xl my-2">{emoji}</div>
                    <p className="text-sm font-bold">
                      {formatTemp(hour.temperatureF, unit)}
                    </p>
                    <div className="mt-2 flex items-center gap-1 justify-center">
                      <span className="text-xs text-blue-300">
                        {hour.precipChance ?? 0}%
                      </span>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <section className="lg:col-span-1 fade-in-up" style={{ animationDelay: "0.2s" }}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-white/60">📅</span>
                7-Day Forecast
              </h3>
              <div className="glass rounded-2xl p-4">
                <div className="space-y-1">
                  {weather.daily.map((day) => {
                    const emoji = conditionToEmoji(day.summary);
                    return (
                    <div key={day.date} className="forecast-card flex items-center gap-3 p-3 rounded-xl">
                      <span className="text-sm font-semibold w-12 text-white/70">
                        {formatDay(day.date)}
                      </span>
                      <span className="text-lg">{emoji}</span>
                      <span className="text-sm text-white/50 w-8 text-right">
                        {formatTemp(day.lowF, unit)}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-white/10 relative mx-2">
                        <div className="absolute h-full rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 to-orange-400" style={{ left: "25%", width: "45%" }} />
                      </div>
                      <span className="text-sm font-semibold w-8">
                        {formatTemp(day.highF, unit)}
                      </span>
                    </div>
                  )})}
                </div>
              </div>
            </section>

            <section className="lg:col-span-2 fade-in-up" style={{ animationDelay: "0.25s" }}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-white/60">📊</span>
                Weather Details
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: "Humidity",
                    value: `${weather.current.humidity ?? "—"}%`,
                    desc: "Current humidity",
                  },
                  {
                    label: "Wind",
                    value: `${weather.current.windSpeedMph ?? "—"} mph`,
                    desc: weather.current.windDirection ?? "",
                  },
                  {
                    label: "Pressure",
                    value: `${weather.current.pressureInHg ?? "—"} inHg`,
                    desc: "Barometric",
                  },
                  {
                    label: "Visibility",
                    value: `${weather.current.visibilityMiles ?? "—"} mi`,
                    desc: "Line of sight",
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
                  <div key={detail.label} className="detail-card glass rounded-2xl p-5">
                    <p className="text-sm text-white/50 font-medium">{detail.label}</p>
                    <p className="text-2xl font-bold mt-2">{detail.value}</p>
                    <p className="text-xs text-white/40 mt-1">{detail.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="fade-in-up mb-8" style={{ animationDelay: "0.3s" }}>
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
