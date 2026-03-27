import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import { fetchTrainingContext, fetchFullStats } from "~/services/strava";

export const prerender = false;

const LAT = 45.464;
const LON = 9.190;

async function fetchWeekendWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=precipitation_probability_max,temperature_2m_max,weathercode&forecast_days=7&timezone=Europe%2FRome`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const days = data.daily.time as string[];
    const rain = data.daily.precipitation_probability_max as number[];
    const temp = data.daily.temperature_2m_max as number[];
    const code = data.daily.weathercode as number[];
    const result: Record<string, { rain: number; temp: number; code: number }> = {};
    days.forEach((d, i) => { result[d] = { rain: rain[i], temp: temp[i], code: code[i] }; });
    return result;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, import.meta.env.ADMIN_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [training, fullStats, weather] = await Promise.all([
      fetchTrainingContext(),
      fetchFullStats(),
      fetchWeekendWeather(),
    ]);

    return new Response(
      JSON.stringify({
        currentWeekActivities: training.currentWeekActivities,
        last4WeeklyKm: training.last4WeeklyKm,
        weekendLongRuns: training.weekendLongRuns,
        last12WeeklyElevation: training.last12WeeklyElevation,
        weeklyRunStats: fullStats.weeklyRunStats,
        weather,
      }),
      { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=900" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
