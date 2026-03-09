const CLIENT_ID = import.meta.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.STRAVA_CLIENT_SECRET;
const REFRESH_TOKEN = import.meta.env.STRAVA_REFRESH_TOKEN;

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

export const fetchActivityStats = async (): Promise<PeriodStats> => {
  const accessToken = await refreshAccessToken();

  const now = Math.floor(Date.now() / 1000);
  const oneMonthAgo = now - 30 * 24 * 60 * 60;
  const oneWeekAgo = now - 7 * 24 * 60 * 60;

  const response = await fetch(
    `${API_URL}/athlete/activities?after=${oneMonthAgo}&per_page=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Strava stats. Status: ${response.status}`);
  }

  const activities: StravaActivity[] = await response.json();

  const weeklyActivities = activities.filter(
    (a) => new Date(a.start_date).getTime() / 1000 >= oneWeekAgo,
  );

  return {
    weekly: computeStats(weeklyActivities),
    monthly: computeStats(activities),
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
