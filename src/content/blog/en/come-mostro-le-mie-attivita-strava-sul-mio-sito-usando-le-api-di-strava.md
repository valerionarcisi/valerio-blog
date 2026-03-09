---
title: How I Display My Recent Strava Activities on My Website Using the Strava API
date: "2026-03-09"
extract: "I wanted to show my sports activities on my personal website. Instead of using embed widgets, I integrated the Strava API to fetch data at build time with Astro."
tags:
  - "javascript"
  - "astro"
  - "how-to"
coverImage: "https://images.unsplash.com/photo-1486218119243-13883505764c?w=1200"
coverAuthorName: "Sporlab"
coverAuthorLink: "https://unsplash.com/@sporlab"
---

Sports are an important part of my daily routine. I run, walk, work out — and I log everything on Strava. I wanted these activities to show up on my personal website too, alongside my watched movies and listened music, to give visitors a more complete snapshot of my daily life.

## The Problem

Strava offers embed widgets, but they're not very customizable and don't blend well with a custom site design. I wanted something that matched the existing look — the same horizontal scrollable cards I use for movies and music — and that would update automatically with every build.

## The Solution

I built an integration that uses the Strava API to fetch recent activities at build time with Astro and displays them as compact cards on the homepage.

### Step 1: Create the Strava App

To access the API you need to register an application at [Strava Settings](https://www.strava.com/settings/api). You'll need:

1. A Strava account
2. App name, category, website and callback domain
3. An app icon (required to get your credentials)

Once created, Strava provides a **Client ID**, **Client Secret** and an initial **Access Token** with limited scope.

### Step 2: Get the Refresh Token with the Right Scope

The initial access token only has the `read` scope, which isn't enough to read activities. You need the `activity:read_all` scope. To get it, go through the OAuth authorization flow:

```
https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&scope=activity:read_all
```

After authorizing, Strava redirects to `localhost` with a `code` in the URL. Exchange this code for a refresh token with a POST request:

```bash
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=AUTHORIZATION_CODE \
  -d grant_type=authorization_code
```

The `refresh_token` in the response is the one to save in your environment variables.

### Step 3: Create the API Service

I created `src/services/strava.ts` that handles token refresh and activity fetching:

```typescript
const refreshAccessToken = async (): Promise<string> => {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: import.meta.env.STRAVA_CLIENT_ID,
      client_secret: import.meta.env.STRAVA_CLIENT_SECRET,
      refresh_token: import.meta.env.STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  return data.access_token;
};
```

Strava access tokens expire after 6 hours, but the refresh token is permanent. On every build the service renews the token and fetches the activities:

```typescript
export const fetchRecentActivities = async (count = 5) => {
  const accessToken = await refreshAccessToken();
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${count}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const activities = await response.json();
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
    url: `https://www.strava.com/activities/${a.id}`,
  }));
};
```

### Step 4: Format the Data

The service includes helpers to format distance, duration and pace in a human-readable way:

```typescript
export const formatDistance = (meters: number): string => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

export const formatPace = (speedMs: number, type: string): string => {
  if (type === "WeightTraining" || speedMs === 0) return "";
  const paceMinPerKm = 1000 / 60 / speedMs;
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
};
```

Each activity type has an associated color — orange for running, purple for weights, blue for cycling — shown as a small colored dot in the card.

### Step 5: The ActivityCard Component

I created a compact Astro component that displays each activity as a vertical card:

- Colored dot with activity type label
- Workout name
- Stats: distance, duration, pace and elevation
- Activity date
- Direct link to Strava

The component sits inside a horizontally scrollable container (the same one used for movies and music), so cards can be swiped through without taking up too much vertical space.

### Step 6: Homepage Integration

On the homepage, activities are fetched in parallel with movies and music using `Promise.all`, with a `.catch(() => [])` to avoid blocking the render if Strava is unreachable:

```typescript
const [lastWatched, lastSongs, lastActivities] = await Promise.all([
  lastWatchedMovies(),
  fetchRecentTracks(),
  fetchRecentActivities(5).catch(() => []),
]);
```

The section only appears when there are activities to display, thanks to a simple length check on the array.

## The Result

The homepage now shows three multimedia sections — movies, music and sports — painting a complete picture of my daily life. The activity cards blend seamlessly with the existing design and update with every build.

## Environment Variables

To replicate this integration you need three variables:

- `STRAVA_CLIENT_ID` — Your app's Client ID
- `STRAVA_CLIENT_SECRET` — Your app's Client Secret
- `STRAVA_REFRESH_TOKEN` — The refresh token with `activity:read_all` scope

## Lessons Learned

- Strava's initial `read` scope does **not** include activities. You need `activity:read_all`
- The OAuth flow requires a one-time manual step, but after that the refresh token works indefinitely
- Fetching data at build time with Astro is the simplest approach: no client-side fetch, no CORS, no runtime rate limits

_Want to see my recent activities? Check out the "Latest activities" section on my homepage, or follow me on [Strava](https://www.strava.com)._
