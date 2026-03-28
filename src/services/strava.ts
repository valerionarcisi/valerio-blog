import { env } from "~/lib/env";

const CLIENT_ID = env("STRAVA_CLIENT_ID");
const CLIENT_SECRET = env("STRAVA_CLIENT_SECRET");
const REFRESH_TOKEN = env("STRAVA_REFRESH_TOKEN");

const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_URL = "https://www.strava.com/api/v3";

interface TokenResponse {
  access_token: string;
  expires_at: number;
  refresh_token: string;
  token_type: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  kudos_count: number;
}

export interface NormalizedActivity {
  id: number;
  name: string;
  type: string;
  sportType: string;
  date: string;
  distance: number;
  movingTime: number;
  elevation: number;
  averageSpeed: number;
  averageHeartrate?: number;
  kudos: number;
  url: string;
}

const refreshAccessToken = async (): Promise<string> => {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Strava token. Status: ${response.status}`);
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
};

export const fetchRecentActivities = async (
  count = 5,
): Promise<NormalizedActivity[]> => {
  const accessToken = await refreshAccessToken();

  const response = await fetch(
    `${API_URL}/athlete/activities?per_page=${count}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Strava activities. Status: ${response.status}`);
  }

  const activities: StravaActivity[] = await response.json();

  return activities.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    sportType: a.sport_type,
    date: a.start_date,
    distance: a.distance,
    movingTime: a.moving_time,
    elevation: a.total_elevation_gain,
    averageSpeed: a.average_speed,
    averageHeartrate: a.average_heartrate,
    kudos: a.kudos_count,
    url: `https://www.strava.com/activities/${a.id}`,
  }));
};

export interface ActivityStats {
  totalActivities: number;
  totalDistance: number;
  totalElevation: number;
  totalMovingTime: number;
  averagePace: number;
}

export interface PeriodStats {
  weekly: ActivityStats;
  monthly: ActivityStats;
}

const computeStats = (activities: StravaActivity[]): ActivityStats => {
  const withDistance = activities.filter((a) => a.distance > 0);
  const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
  const totalElevation = activities.reduce((sum, a) => sum + a.total_elevation_gain, 0);
  const totalMovingTime = activities.reduce((sum, a) => sum + a.moving_time, 0);
  const averagePace =
    withDistance.length > 0 && totalDistance > 0
      ? totalMovingTime / (totalDistance / 1000)
      : 0;

  return {
    totalActivities: activities.length,
    totalDistance,
    totalElevation,
    totalMovingTime,
    averagePace,
  };
};

export interface DailyActivity {
  type: string;
  label: string;
  color: string;
  distance: number;
  duration: number;
  elapsedTime: number;
  name: string;
  elevation: number;
  averageSpeed: number;
  maxSpeed: number;
  averageHeartrate?: number;
  maxHeartrate?: number;
  sufferScore?: number;
  kudos: number;
  url: string;
}

export interface DailyBreakdown {
  date: string;
  distance: number;
  duration: number;
  type: string;
  color: string;
  activities: DailyActivity[];
}

export interface TypeDistribution {
  type: string;
  label: string;
  color: string;
  totalDistance: number;
  totalDuration: number;
  count: number;
  percentage: number;
}

export interface WeeklyRunStats {
  weekLabel: string;
  weekStart: string;
  distance: number;
  pace: number;
  runs: number;
  elevation: number;
}

export interface FullStats {
  periodStats: PeriodStats;
  dailyBreakdown: DailyBreakdown[];
  yearlyBreakdown: DailyBreakdown[];
  typeDistribution: TypeDistribution[];
  weeklyRunStats: WeeklyRunStats[];
}

const computeDailyBreakdown = (activities: StravaActivity[], numDays = 30): DailyBreakdown[] => {
  const days: DailyBreakdown[] = [];
  const now = new Date();

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);

    const dayActivities = activities.filter(
      (a) => a.start_date.slice(0, 10) === key,
    );

    if (dayActivities.length === 0) {
      days.push({ date: key, distance: 0, duration: 0, type: "", color: "#252528", activities: [] });
      continue;
    }

    const totalDistance = dayActivities.reduce((s, a) => s + a.distance, 0);
    const totalDuration = dayActivities.reduce((s, a) => s + a.moving_time, 0);
    const primary = dayActivities.reduce((best, a) =>
      a.moving_time > best.moving_time ? a : best,
    );

    days.push({
      date: key,
      distance: totalDistance,
      duration: totalDuration,
      type: primary.sport_type,
      color: activityColor(primary.sport_type),
      activities: dayActivities.map((a) => ({
        type: a.sport_type,
        label: activityLabel(a.sport_type),
        color: activityColor(a.sport_type),
        distance: a.distance,
        duration: a.moving_time,
        elapsedTime: a.elapsed_time,
        name: a.name,
        elevation: a.total_elevation_gain,
        averageSpeed: a.average_speed,
        maxSpeed: a.max_speed,
        averageHeartrate: a.average_heartrate,
        maxHeartrate: a.max_heartrate,
        sufferScore: a.suffer_score,
        kudos: a.kudos_count,
        url: `https://www.strava.com/activities/${a.id}`,
      })),
    });
  }

  return days;
};

const computeTypeDistribution = (activities: StravaActivity[]): TypeDistribution[] => {
  const groups = new Map<string, { distance: number; duration: number; count: number }>();

  for (const a of activities) {
    const key = a.sport_type;
    const prev = groups.get(key) ?? { distance: 0, duration: 0, count: 0 };
    groups.set(key, {
      distance: prev.distance + a.distance,
      duration: prev.duration + a.moving_time,
      count: prev.count + 1,
    });
  }

  const totalCount = activities.length;
  return Array.from(groups.entries())
    .map(([type, g]) => ({
      type,
      label: activityLabel(type),
      color: activityColor(type),
      totalDistance: g.distance,
      totalDuration: g.duration,
      count: g.count,
      percentage: totalCount > 0 ? Math.round((g.count / totalCount) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
};

const computeWeeklyRunStats = (activities: StravaActivity[], weeks: number): WeeklyRunStats[] => {
  const runs = activities.filter((a) => a.sport_type === "Run" || a.sport_type === "TrailRun");
  const result: WeeklyRunStats[] = [];
  const now = new Date();

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekRuns = runs.filter((a) => {
      const d = new Date(a.start_date);
      return d >= weekStart && d <= weekEnd;
    });

    const totalDistance = weekRuns.reduce((s, a) => s + a.distance, 0);
    const totalTime = weekRuns.reduce((s, a) => s + a.moving_time, 0);
    const totalElevation = weekRuns.reduce((s, a) => s + a.total_elevation_gain, 0);
    const avgPace = totalDistance > 0 ? totalTime / (totalDistance / 1000) : 0;

    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();
    const startM = weekStart.getMonth() + 1;
    const endM = weekEnd.getMonth() + 1;
    const label = startM === endM
      ? `${startDay}–${endDay}/${endM}`
      : `${startDay}/${startM}–${endDay}/${endM}`;

    result.push({
      weekLabel: label,
      weekStart: weekStart.toISOString().slice(0, 10),
      distance: totalDistance,
      pace: avgPace,
      runs: weekRuns.length,
      elevation: totalElevation,
    });
  }

  return result;
};

export interface WeekendLongRun {
  date: string;
  distanceM: number;
  movingTime: number;
  elevation: number;
  averageHeartrate?: number;
  averageSpeed: number;
}

export interface TrainingContext {
  currentWeekActivities: NormalizedActivity[];
  last4WeeklyKm: number[];
  weekendLongRuns: WeekendLongRun[];
  last12WeeklyElevation: number[];
}

export const fetchTrainingContext = async (): Promise<TrainingContext> => {
  const accessToken = await refreshAccessToken();
  const now = Date.now();
  const twelveWeeksAgo = Math.floor((now - 84 * 86400000) / 1000);

  const allActivities: StravaActivity[] = [];
  let page = 1;
  while (true) {
    const response = await fetch(
      `${API_URL}/athlete/activities?after=${twelveWeeksAgo}&per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw new Error(`Strava error: ${response.status}`);
    const batch: StravaActivity[] = await response.json();
    allActivities.push(...batch);
    if (batch.length < 200) break;
    page++;
  }

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const currentWeekActivities = allActivities
    .filter((a) => new Date(a.start_date) >= monday)
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: a.sport_type,
      sportType: a.sport_type,
      date: a.start_date,
      distance: a.distance,
      movingTime: a.moving_time,
      elevation: a.total_elevation_gain,
      averageSpeed: a.average_speed,
      averageHeartrate: a.average_heartrate,
      kudos: a.kudos_count,
      url: `https://www.strava.com/activities/${a.id}`,
    }));

  const last4WeeklyKm: number[] = [];
  const last12WeeklyElevation: number[] = [];
  for (let w = 1; w <= 12; w++) {
    const wEnd = new Date(monday);
    wEnd.setDate(wEnd.getDate() - (w - 1) * 7 - 1);
    wEnd.setHours(23, 59, 59, 999);
    const wStart = new Date(wEnd);
    wStart.setDate(wStart.getDate() - 6);
    wStart.setHours(0, 0, 0, 0);
    const acts = allActivities.filter((a) => {
      const d = new Date(a.start_date);
      return d >= wStart && d <= wEnd;
    });
    const km = acts.filter((a) => a.distance > 0).reduce((s, a) => s + a.distance, 0) / 1000;
    const elev = acts.reduce((s, a) => s + a.total_elevation_gain, 0);
    if (w <= 4) last4WeeklyKm.push(km);
    last12WeeklyElevation.push(elev);
  }

  const weekendLongRuns: WeekendLongRun[] = allActivities
    .filter((a) => {
      const d = new Date(a.start_date);
      const dow = d.getDay();
      return (dow === 0 || dow === 6) && a.sport_type === "Run" && a.distance >= 10000;
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .map((a) => ({
      date: a.start_date.slice(0, 10),
      distanceM: a.distance,
      movingTime: a.moving_time,
      elevation: a.total_elevation_gain,
      averageHeartrate: a.average_heartrate,
      averageSpeed: a.average_speed,
    }));

  return { currentWeekActivities, last4WeeklyKm, weekendLongRuns, last12WeeklyElevation };
};

export const fetchActivityStats = async (): Promise<PeriodStats> => {
  const { periodStats } = await fetchFullStats();
  return periodStats;
};

export const fetchFullStats = async (): Promise<FullStats> => {
  const accessToken = await refreshAccessToken();

  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 60 * 60;
  const oneMonthAgo = now - 30 * 24 * 60 * 60;
  const oneWeekAgo = now - 7 * 24 * 60 * 60;

  const allActivities: StravaActivity[] = [];
  let page = 1;
  while (true) {
    const response = await fetch(
      `${API_URL}/athlete/activities?after=${oneYearAgo}&per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch Strava stats. Status: ${response.status}`);
    }
    const batch: StravaActivity[] = await response.json();
    allActivities.push(...batch);
    if (batch.length < 200) break;
    page++;
  }

  const monthlyActivities = allActivities.filter(
    (a) => new Date(a.start_date).getTime() / 1000 >= oneMonthAgo,
  );
  const weeklyActivities = allActivities.filter(
    (a) => new Date(a.start_date).getTime() / 1000 >= oneWeekAgo,
  );

  return {
    periodStats: {
      weekly: computeStats(weeklyActivities),
      monthly: computeStats(monthlyActivities),
    },
    dailyBreakdown: computeDailyBreakdown(monthlyActivities),
    yearlyBreakdown: computeDailyBreakdown(allActivities, 365),
    typeDistribution: computeTypeDistribution(monthlyActivities),
    weeklyRunStats: computeWeeklyRunStats(allActivities, 8),
  };
};

export const formatPaceFromSecondsPerKm = (secPerKm: number): string => {
  if (secPerKm === 0) return "";
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
};

export const formatDistance = (meters: number): string => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export const formatPace = (speedMs: number, type: string): string => {
  if (type === "WeightTraining" || type === "Workout" || speedMs === 0) return "";
  const paceMinPerKm = 1000 / 60 / speedMs;
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
};

export const activityColor = (type: string): string => {
  const map: Record<string, string> = {
    Run: "#fc4c02",
    TrailRun: "#fc4c02",
    Walk: "#44b783",
    Hike: "#44b783",
    Ride: "#2d8cff",
    Swim: "#00bcd4",
    WeightTraining: "#a855f7",
    Workout: "#a855f7",
    Yoga: "#ec4899",
    Crossfit: "#a855f7",
  };
  return map[type] ?? "#8a8a8e";
};

export const activityLabel = (type: string): string => {
  const map: Record<string, string> = {
    Run: "Run",
    TrailRun: "Trail",
    Walk: "Walk",
    Hike: "Hike",
    Ride: "Ride",
    Swim: "Swim",
    WeightTraining: "Weights",
    Workout: "Workout",
    Yoga: "Yoga",
    Crossfit: "Crossfit",
  };
  return map[type] ?? type;
};
