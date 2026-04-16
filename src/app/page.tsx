import WeatherView from "@/app/WeatherView";
import { getWeatherSnapshot } from "@/lib/weather-pipeline";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getWeatherSnapshot();
  return (
    <WeatherView initialWeather={snapshot.data} initialMeta={snapshot.meta} />
  );
}
