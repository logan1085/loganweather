import { describe, expect, it, vi } from "vitest";
import {
  getForecastDateKey,
  isRecentObservation,
  parseForecastWindSpeed,
} from "@/lib/nws";

describe("getForecastDateKey", () => {
  it("groups forecast periods using the location timezone", () => {
    expect(
      getForecastDateKey(
        "2026-04-16T23:30:00-07:00",
        "America/Los_Angeles"
      )
    ).toBe("2026-04-16");
  });

  it("falls back to the ISO date when the timezone is invalid", () => {
    expect(
      getForecastDateKey("2026-04-16T23:30:00-07:00", "Mars/Phobos")
    ).toBe("2026-04-16");
  });
});

describe("parseForecastWindSpeed", () => {
  it("uses the upper bound from a forecast wind range", () => {
    expect(parseForecastWindSpeed("10 to 15 mph")).toBe(15);
  });

  it("returns null when the forecast string has no numbers", () => {
    expect(parseForecastWindSpeed("Calm")).toBeNull();
  });
});

describe("isRecentObservation", () => {
  it("accepts observations within the freshness window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T16:00:00Z"));

    expect(
      isRecentObservation(
        "2026-04-16T14:45:00Z",
        "2026-04-16T15:30:00Z"
      )
    ).toBe(true);

    vi.useRealTimers();
  });

  it("rejects stale observations", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T16:00:00Z"));

    expect(
      isRecentObservation(
        "2026-04-16T12:00:00Z",
        "2026-04-16T13:30:00Z"
      )
    ).toBe(false);

    vi.useRealTimers();
  });
});
