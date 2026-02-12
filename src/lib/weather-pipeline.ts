import { getNewYorkWeather, getWeatherByCoords, type WeatherPayload } from "@/lib/nws";

const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_TTL_MS = 30 * 60 * 1000;

type CacheEntry = { data: WeatherPayload; fetchedAt: number };
type CacheBucket = {
  cache: CacheEntry | null;
  lastGood: CacheEntry | null;
  inFlight: Promise<WeatherPayload> | null;
};

const cacheBuckets = new Map<string, CacheBucket>();

const getBucket = (key: string): CacheBucket => {
  const existing = cacheBuckets.get(key);
  if (existing) return existing;
  const bucket: CacheBucket = { cache: null, lastGood: null, inFlight: null };
  cacheBuckets.set(key, bucket);
  return bucket;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (lat?: number, lon?: number) => {
  const attempts = [0, 300, 800];
  let lastError: unknown = null;

  for (const delay of attempts) {
    if (delay > 0) await sleep(delay);
    try {
      if (typeof lat === "number" && typeof lon === "number") {
        return await getWeatherByCoords(lat, lon);
      }
      return await getNewYorkWeather();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

export type WeatherMeta = {
  source: "live" | "cache" | "stale";
  fetchedAt: string;
  ageMs: number;
};

const buildMeta = (source: WeatherMeta["source"], fetchedAt: number) => ({
  source,
  fetchedAt: new Date(fetchedAt).toISOString(),
  ageMs: Date.now() - fetchedAt,
});

const applyOverrideName = (
  data: WeatherPayload,
  overrideName?: string | null
) => {
  if (!overrideName) return data;
  return {
    ...data,
    location: {
      ...data.location,
      name: overrideName,
    },
  };
};

const getSnapshotForBucket = async (
  bucketKey: string,
  fetcher: () => Promise<WeatherPayload>,
  overrideName?: string | null
) => {
  const bucket = getBucket(bucketKey);
  const now = Date.now();

  if (bucket.cache && now - bucket.cache.fetchedAt < CACHE_TTL_MS) {
    return {
      data: applyOverrideName(bucket.cache.data, overrideName),
      meta: buildMeta("cache", bucket.cache.fetchedAt),
    };
  }

  if (!bucket.inFlight) {
    bucket.inFlight = fetcher()
      .then((data) => {
        const fetchedAt = Date.now();
        bucket.cache = { data, fetchedAt };
        bucket.lastGood = { data, fetchedAt };
        return data;
      })
      .finally(() => {
        bucket.inFlight = null;
      });
  }

  try {
    const data = await bucket.inFlight;
    const fetchedAt = bucket.cache?.fetchedAt ?? Date.now();
    return {
      data: applyOverrideName(data, overrideName),
      meta: buildMeta("live", fetchedAt),
    };
  } catch (error) {
    const fallback = bucket.lastGood ?? bucket.cache;
    if (fallback && now - fallback.fetchedAt < STALE_TTL_MS) {
      return {
        data: applyOverrideName(fallback.data, overrideName),
        meta: buildMeta("stale", fallback.fetchedAt),
      };
    }

    throw error;
  }
};

export const getWeatherSnapshotByCoords = async (
  lat: number,
  lon: number,
  overrideName?: string | null
) => {
  const bucketKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  return getSnapshotForBucket(
    `coords:${bucketKey}`,
    () => fetchWithRetry(lat, lon),
    overrideName
  );
};

export const getWeatherSnapshot = async () =>
  getSnapshotForBucket("default", () => fetchWithRetry());
