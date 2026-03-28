import type { APIRoute } from "astro";
import { fetchTrainingContext, fetchFullStats } from "~/services/strava";
import getDb from "~/lib/turso";

export const prerender = false;

const LAT = 43.256;
const LON = 13.760;

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

export const GET: APIRoute = async () => {
  async function fetchHomeWorkoutsThisWeek(): Promise<number> {
    try {
      const db = getDb();
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const res = await db.execute({
        sql: "SELECT COUNT(*) as n FROM workout_sessions WHERE completed_at >= ?",
        args: [weekStartStr],
      });
      return Number(res.rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  }

  try {
    const [training, fullStats, weather, homeWorkouts] = await Promise.all([
      fetchTrainingContext(),
      fetchFullStats(),
      fetchWeekendWeather(),
      fetchHomeWorkoutsThisWeek(),
    ]);

    return new Response(
      JSON.stringify({
        currentWeekActivities: training.currentWeekActivities,
        last4WeeklyKm: training.last4WeeklyKm,
        weekendLongRuns: training.weekendLongRuns,
        last12WeeklyElevation: training.last12WeeklyElevation,
        weeklyRunStats: fullStats.weeklyRunStats,
        weather,
        homeWorkoutsThisWeek: homeWorkouts,
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
