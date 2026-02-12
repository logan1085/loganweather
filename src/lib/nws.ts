const NWS_BASE_URL = "https://api.weather.gov";
const NYC_COORDS = { lat: 40.7128, lon: -74.006 };
const NWS_TIMEZONE = "America/New_York";

const USER_AGENT =
  process.env.NWS_USER_AGENT ??
  "SkyView Weather (weather-app@example.com)";

type NwsForecastPeriod = {
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  icon: string;
};

type NwsForecastResponse = {
  properties: {
    periods: NwsForecastPeriod[];
    updated: string;
  };
};

type NwsHourlyResponse = {
  properties: {
    periods: Array<
      NwsForecastPeriod & {
        probabilityOfPrecipitation?: { value: number | null };
        relativeHumidity?: { value: number | null };
      }
    >;
    updated: string;
  };
};

type NwsStationsResponse = {
  features: Array<{
    properties: {
      stationIdentifier: string;
      name: string;
    };
  }>;
};

type NwsObservationResponse = {
  properties: {
    timestamp: string;
    textDescription: string;
    temperature: { value: number | null };
    dewpoint: { value: number | null };
    windSpeed: { value: number | null };
    windDirection: { value: number | null };
    windGust: { value: number | null };
    relativeHumidity: { value: number | null };
    barometricPressure: { value: number | null };
    visibility: { value: number | null };
    heatIndex: { value: number | null };
    windChill: { value: number | null };
  };
};

type NwsPointsResponse = {
  properties: {
    forecast: string;
    forecastHourly: string;
    observationStations: string;
    relativeLocation?: {
      properties?: {
        city?: string;
        state?: string;
      };
    };
  };
};

const round = (value: number | null, digits = 0) => {
  if (value === null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const cToF = (value: number | null) =>
  value === null ? null : round(value * (9 / 5) + 32);

const mpsToMph = (value: number | null) =>
  value === null ? null : round(value * 2.23694);

const metersToMiles = (value: number | null) =>
  value === null ? null : round(value / 1609.34, 1);

const pascalToInHg = (value: number | null) =>
  value === null ? null : round(value * 0.0002953, 2);

const formatDateKey = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: NWS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

const degreesToCardinal = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return null;
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(value / 22.5) % 16;
  return directions[index];
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/geo+json",
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`NWS request failed: ${response.status} ${url}`);
  }

  return response.json() as Promise<T>;
};

export type WeatherPayload = {
  location: {
    name: string;
    lat: number;
    lon: number;
  };
  current: {
    temperatureF: number | null;
    feelsLikeF: number | null;
    condition: string;
    humidity: number | null;
    windSpeedMph: number | null;
    windGustMph: number | null;
    windDirection: string | null;
    dewPointF: number | null;
    pressureInHg: number | null;
    visibilityMiles: number | null;
    observedAt: string | null;
  };
  daily: Array<{
    date: string;
    name: string;
    highF: number | null;
    lowF: number | null;
    summary: string;
    icon: string;
  }>;
  hourly: Array<{
    time: string;
    temperatureF: number;
    summary: string;
    icon: string;
    precipChance: number | null;
    humidity: number | null;
  }>;
  updatedAt: {
    forecast: string;
    hourly: string;
  };
};

export const getWeatherByCoords = async (
  lat: number,
  lon: number,
  overrideName?: string
): Promise<WeatherPayload> => {
  const points = await fetchJson<NwsPointsResponse>(
    `${NWS_BASE_URL}/points/${lat},${lon}`
  );

  const forecastUrl = points.properties.forecast;
  const hourlyUrl = points.properties.forecastHourly;
  const stationsUrl = points.properties.observationStations;

  const [forecast, hourly, stations] = await Promise.all([
    fetchJson<NwsForecastResponse>(forecastUrl),
    fetchJson<NwsHourlyResponse>(hourlyUrl),
    fetchJson<NwsStationsResponse>(stationsUrl),
  ]);

  const stationId = stations.features?.[0]?.properties?.stationIdentifier;
  const observation = stationId
    ? await fetchJson<NwsObservationResponse>(
        `${NWS_BASE_URL}/stations/${stationId}/observations/latest`
      )
    : null;

  const locationName = overrideName ||
    [
      points.properties.relativeLocation?.properties?.city,
      points.properties.relativeLocation?.properties?.state,
    ]
      .filter(Boolean)
      .join(", ");

  const hourlyPeriods = hourly.properties.periods.slice(0, 48);

  const dailyMap = new Map<
    string,
    {
      date: string;
      name: string;
      highF: number | null;
      lowF: number | null;
      summary: string;
      icon: string;
    }
  >();

  forecast.properties.periods.forEach((period) => {
    const dateKey = formatDateKey(period.startTime);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        date: period.startTime,
        name: period.name,
        highF: null,
        lowF: null,
        summary: period.shortForecast,
        icon: period.icon,
      });
    }

    const entry = dailyMap.get(dateKey);
    if (!entry) return;

    if (period.isDaytime) {
      entry.highF = period.temperature;
      entry.summary = period.shortForecast;
      entry.icon = period.icon;
    } else {
      entry.lowF = period.temperature;
      entry.summary = entry.summary || period.shortForecast;
    }
  });

  const daily = Array.from(dailyMap.values()).slice(0, 7);

  const currentTempF = cToF(observation?.properties.temperature.value ?? null);
  const feelsLike =
    observation?.properties.heatIndex.value ??
    observation?.properties.windChill.value ??
    observation?.properties.temperature.value ??
    null;

  return {
    location: {
      name: locationName || "Unknown",
      lat,
      lon,
    },
    current: {
      temperatureF: currentTempF ?? hourlyPeriods[0]?.temperature ?? null,
      feelsLikeF: cToF(feelsLike),
      condition:
        observation?.properties.textDescription ??
        hourlyPeriods[0]?.shortForecast ??
        "Current conditions",
      humidity: round(observation?.properties.relativeHumidity.value ?? null),
      windSpeedMph: mpsToMph(observation?.properties.windSpeed.value ?? null),
      windGustMph: mpsToMph(observation?.properties.windGust.value ?? null),
      windDirection: degreesToCardinal(
        observation?.properties.windDirection.value ?? null
      ),
      dewPointF: cToF(observation?.properties.dewpoint.value ?? null),
      pressureInHg: pascalToInHg(
        observation?.properties.barometricPressure.value ?? null
      ),
      visibilityMiles: metersToMiles(
        observation?.properties.visibility.value ?? null
      ),
      observedAt: observation?.properties.timestamp ?? null,
    },
    daily,
    hourly: hourlyPeriods.map((period) => ({
      time: period.startTime,
      temperatureF: period.temperature,
      summary: period.shortForecast,
      icon: period.icon,
      precipChance: round(
        period.probabilityOfPrecipitation?.value ?? null
      ) as number | null,
      humidity: round(period.relativeHumidity?.value ?? null) as number | null,
    })),
    updatedAt: {
      forecast: forecast.properties.updated,
      hourly: hourly.properties.updated,
    },
  };
};

export const getNewYorkWeather = async (): Promise<WeatherPayload> =>
  getWeatherByCoords(NYC_COORDS.lat, NYC_COORDS.lon, "New York, NY");
