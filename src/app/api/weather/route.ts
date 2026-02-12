import { NextRequest, NextResponse } from "next/server";
import {
  getWeatherSnapshot,
  getWeatherSnapshotByCoords,
} from "@/lib/weather-pipeline";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const name = searchParams.get("name");
  const lat = latParam ? Number.parseFloat(latParam) : null;
  const lon = lonParam ? Number.parseFloat(lonParam) : null;
  try {
    const snapshot =
      lat !== null && Number.isFinite(lat) && lon !== null && Number.isFinite(lon)
        ? await getWeatherSnapshotByCoords(lat, lon, name)
        : await getWeatherSnapshot();
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json(
      { error: "Unable to fetch weather data" },
      { status: 502 }
    );
  }
}
