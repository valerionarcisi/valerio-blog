---
title: How I Display My Recently Played Music Using Last.fm API
date: "2025-09-05"
extract: "Music is a constant companion in my life, especially during my work as a developer and filmmaker. I wanted to share my musical journey with visitors to my website by automatically displaying what I've been listening to lately, without the hassle of manual updates."
tags:
  - "lastfm"
  - "javascript"
  - "music"
coverImage: "/img/blog/how-i-display-my-recently-played-music-using-lastfm-api/cmf6m7ms30hr707leynw5nthm.png"
---

Music is a constant companion in my life, especially during my work as a developer and filmmaker. I wanted to share my musical journey with visitors to my website by automatically displaying what I've been listening to lately, without the hassle of manual updates.

## The Problem

I'm an avid music listener who uses Last.fm to track my listening habits across all platforms - Spotify, Apple Music, YouTube Music, you name it. Last.fm creates a comprehensive history of everything I listen to, but I wanted this data to live on my personal website too, creating a more complete picture of my interests and daily life.

## The Solution

I built an automated system that fetches my recent tracks from Last.fm's API and displays them on my homepage alongside my watched movies, creating a rich multimedia snapshot of my current interests.

### Step 1: Last.fm API Setup

Last.fm provides a robust API for accessing user data. To get started, you need:
1. A Last.fm account with scrobbling enabled
2. An API key from Last.fm developers portal
3. Your username

The API endpoint for recent tracks follows this pattern:
```
https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=USERNAME&api_key=API_KEY&format=json
```

### Step 2: Fetching Recent Tracks

I created a service that handles the API calls and data processing:

```javascript
export const fetchRecentTracks = async (limit = 10) => {
  const API_KEY = import.meta.env.LASTFM_API_KEY;
  const USERNAME = 'valerionarcisi';
  
  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${USERNAME}&api_key=${API_KEY}&format=json&limit=${limit}`
    );
    
    const data = await response.json();
    return data.recenttracks?.track || [];
  } catch (error) {
    console.error('Error fetching Last.fm data:', error);
    return [];
  }
};
```

### Step 3: Processing Track Data

The Last.fm API returns rich metadata for each track, including:
- Song title and artist name
- Album information and artwork
- Play timestamp (or "now playing" status)
- Links to Last.fm pages

I process this data to extract what I need for display:

```javascript
const processTrackData = (tracks) => {
  return tracks.map(track => ({
    name: track.name,
    artist: track.artist['#text'] || track.artist.name,
    album: track.album['#text'],
    image: track.image[3]['#text'], // Large image size
    url: track.url,
    date: track.date ? track.date['#text'] : 'Now Playing',
    isNowPlaying: track['@attr']?.nowplaying === 'true'
  }));
};
```

### Step 4: Displaying the Music

I created a `Reel` component (the same used for movies) that displays each track with:
- Album artwork as the main visual
- Song title and artist name
- Album name
- Play date or "Now Playing" indicator
- Link to the track on Last.fm

The component includes a special indicator for currently playing tracks and graceful fallbacks for missing album artwork.

### Step 5: Performance and Reliability

To ensure a smooth user experience:
- **API caching** to respect Last.fm's rate limits
- **Fallback images** when album artwork is unavailable
- **Error handling** for network issues or API downtime
- **Loading states** while fetching data
- **Parallel execution** with movie data fetching

## The Result

My homepage now displays a live feed of my musical taste alongside my movie watching habits. Visitors can see what I'm currently listening to, discover new music through my recent plays, and get a more complete picture of my cultural interests.

The integration updates in real-time, so if I'm actively listening to music, it shows up as "Now Playing" on my site. It's like having a personal radio station that reflects my actual listening habits.

## Why Last.fm?

Unlike Spotify's API which only shows recent tracks from their platform, Last.fm aggregates listening data from multiple sources:
- Spotify, Apple Music, YouTube Music
- Local music players like iTunes or Foobar2000
- Vinyl records (with manual scrobbling)
- Live concerts and DJ sets

This gives a more complete picture of my musical life, not just what I stream on one particular service.

## Technical Benefits

- **Universal music tracking** - Works across all platforms
- **Rich metadata** - Detailed track, artist, and album info
- **Real-time updates** - Shows current listening activity
- **Historical data** - Access to complete listening history
- **Community features** - Links to Last.fm for discovery

## The Personal Touch

Music is deeply personal, and displaying my recent tracks adds authenticity to my website. It shows I'm not just a developer who codes in silence - I'm someone who finds inspiration in Radiohead, gets motivated by electronic music, and occasionally indulges in guilty pleasure pop songs.

This integration represents another piece of the puzzle in creating a truly personal website that reflects who I am beyond just my professional work.

*Want to see what I'm listening to right now? Check out the "Last Listened songs" section on my homepage, or follow my complete music journey on [Last.fm](https://last.fm/user/valerionarcisi).*