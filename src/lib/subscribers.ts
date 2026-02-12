import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "subscribers.json");

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const DEFAULT_TIMEZONE = "America/New_York";
const DEFAULT_UNIT = "F" as const;

export type Subscriber = {
  email: string;
  location?: {
    name: string;
    lat: number;
    lon: number;
  };
  unit: "F" | "C";
  timezone: string;
  token: string;
  subscribedAt: string;
  lastSentOn?: string;
};

const ensureFile = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, JSON.stringify([]));
  }
};

const generateToken = () => crypto.randomBytes(16).toString("hex");

const migrate = (raw: unknown): { data: Subscriber[]; changed: boolean } => {
  if (!Array.isArray(raw)) return { data: [], changed: true };

  if (raw.length === 0) {
    return { data: [], changed: false };
  }

  if (typeof raw[0] === "string") {
    return {
      data: (raw as string[]).map((email) => ({
        email: normalizeEmail(email),
        unit: DEFAULT_UNIT,
        timezone: DEFAULT_TIMEZONE,
        token: generateToken(),
        subscribedAt: new Date().toISOString(),
      })),
      changed: true,
    };
  }

  const updated = (raw as Subscriber[]).map((entry) => ({
    email: normalizeEmail(entry.email),
    location: entry.location,
    unit: entry.unit ?? DEFAULT_UNIT,
    timezone: entry.timezone ?? DEFAULT_TIMEZONE,
    token: entry.token || generateToken(),
    subscribedAt: entry.subscribedAt ?? new Date().toISOString(),
    lastSentOn: entry.lastSentOn,
  }));

  return { data: updated, changed: true };
};

const readAll = async (): Promise<Subscriber[]> => {
  await ensureFile();
  const contents = await fs.readFile(FILE_PATH, "utf-8");
  const parsed = JSON.parse(contents) as unknown;
  const { data, changed } = migrate(parsed);
  if (changed) {
    await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2));
  }
  return data;
};

const writeAll = async (emails: Subscriber[]) => {
  await ensureFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(emails, null, 2));
};

const isEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const addSubscriber = async (
  email: string,
  options?: {
    location?: Subscriber["location"];
    unit?: Subscriber["unit"];
    timezone?: string;
  }
) => {
  const normalized = normalizeEmail(email);
  if (!isEmail(normalized)) {
    return { ok: false, message: "Invalid email" };
  }

  const subscribers = await readAll();
  const existing = subscribers.find((entry) => entry.email === normalized);
  if (existing) {
    existing.location = options?.location ?? existing.location;
    existing.unit = options?.unit ?? existing.unit;
    existing.timezone = options?.timezone ?? existing.timezone;
    await writeAll(subscribers);
    return { ok: true, message: "Already subscribed" };
  }

  subscribers.push({
    email: normalized,
    location: options?.location,
    unit: options?.unit ?? DEFAULT_UNIT,
    timezone: options?.timezone ?? DEFAULT_TIMEZONE,
    token: generateToken(),
    subscribedAt: new Date().toISOString(),
  });
  await writeAll(subscribers);
  return { ok: true, message: "Subscribed" };
};

export const listSubscribers = async () => readAll();

export const updateSubscriber = async (subscriber: Subscriber) => {
  const subscribers = await readAll();
  const index = subscribers.findIndex((entry) => entry.email === subscriber.email);
  if (index === -1) return false;
  subscribers[index] = subscriber;
  await writeAll(subscribers);
  return true;
};

export const saveSubscribers = async (subscribers: Subscriber[]) => {
  await writeAll(subscribers);
};

export const removeSubscriberByToken = async (token: string) => {
  const subscribers = await readAll();
  const filtered = subscribers.filter((entry) => entry.token !== token);
  if (filtered.length === subscribers.length) return false;
  await writeAll(filtered);
  return true;
};
