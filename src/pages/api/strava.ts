import type { APIRoute } from "astro";
import {
  fetchRecentActivities,
  fetchActivityStats,
  formatDistance,
  formatDuration,
  formatPace,
  activityColor,
  activityLabel,
  formatPaceFromSecondsPerKm,
} from "~/services/strava";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const [activities, stats] = await Promise.all([
      fetchRecentActivities(5),
      fetchActivityStats(),
    ]);

    const formatted = activities.map((a) => ({
      ...a,
      formattedDistance: formatDistance(a.distance),
      formattedDuration: formatDuration(a.movingTime),
      formattedPace: formatPace(a.averageSpeed, a.sportType),
      color: activityColor(a.sportType),
      label: activityLabel(a.sportType),
      formattedDate: new Date(a.date).toLocaleDateString("en-us", {
        month: "short",
        day: "numeric",
      }),
      hasDistance: a.distance > 0,
      formattedElevation:
        a.elevation > 0 ? `↑${Math.round(a.elevation)}m` : "",
    }));

    const formatStats = (s: typeof stats.weekly) => ({
      distance: formatDistance(s.totalDistance),
      duration: formatDuration(s.totalMovingTime),
      pace: formatPaceFromSecondsPerKm(s.averagePace),
      elevation: s.totalElevation > 0 ? `↑${Math.round(s.totalElevation)}m` : "",
      count: s.totalActivities,
    });

    return new Response(
      JSON.stringify({
        activities: formatted,
        stats: {
          weekly: formatStats(stats.weekly),
          monthly: formatStats(stats.monthly),
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=900",
        },
      },
    );
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
