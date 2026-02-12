import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type GeoResult = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("country", "US");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to geocode location." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { results?: GeoResult[] };
    const results =
      data.results?.map((result) => ({
        name: result.name,
        admin1: result.admin1,
        country: result.country,
        lat: result.latitude,
        lon: result.longitude,
      })) ?? [];

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Unable to geocode location." },
      { status: 502 }
    );
  }
}
