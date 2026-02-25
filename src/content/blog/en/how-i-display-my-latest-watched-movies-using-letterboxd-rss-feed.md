---
title: How I Display My Latest Watched Movies Using Letterboxd RSS Feed
date: "2025-09-05"
extract: "As a filmmaker and cinephile, I wanted to showcase my latest watched movies on my personal website. Instead of manually updating a list every time I watch something new, I decided to automate this process using Letterboxd's RSS feed and some smart integration."
tags:
  - "letterboxd"
  - "movies"
  - "javascript"
coverImage: "/img/blog/how-i-display-my-latest-watched-movies-using-letterboxd-rss-feed/cmf6lzl380c4v07le5r2apkfc.png"
---

As a filmmaker and cinephile, I wanted to showcase my latest watched movies on my personal website. Instead of manually updating a list every time I watch something new, I decided to automate this process using Letterboxd's RSS feed and some smart integration.

## The Problem

I'm an active user of Letterboxd, where I log every movie I watch and rate them. However, I wanted visitors to my website to see what I've been watching recently without having to maintain two separate lists - one on Letterboxd and another on my site.

## The Solution

I built an automated system that fetches my latest watched movies from Letterboxd's RSS feed and displays them beautifully on my homepage, complete with movie posters, ratings, and watch dates.

### Step 1: Accessing Letterboxd RSS Feed

Letterboxd provides RSS feeds for user activities. The feed URL follows this pattern:
```
https://letterboxd.com/username/rss/
```

This feed contains all your recent activity, including watched movies, reviews, and diary entries.

### Step 2: Parsing the RSS Feed

I created a service that fetches and parses the XML content from Letterboxd:

```javascript
export const getLetterboxdRss = async () => {
  const response = await fetch('https://letterboxd.com/valerionarcisi/rss/');
  return response;
};

export const parseXmlContent = async (xmlString) => {
  const parser = new xml2js.Parser();
  return new Promise((resolve, reject) => {
    parser.parseString(xmlString, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};
```

### Step 3: Extracting Movie Information

The RSS feed includes TMDb (The Movie Database) IDs for each movie, which I use to fetch additional movie details like high-quality posters and ratings:

```javascript
const lastWatchedMovies = async () => {
  const xml = await getLetterboxdRss();
  const parsedXml = await parseXmlContent(await xml.text());

  const moviePromises = parsedXml.rss.channel[0].item
    .filter((item) => item?.["tmdb:movieId"]?.[0])
    .map(async (item) => {
      try {
        const movie = await getMovieById(item["tmdb:movieId"][0]);
        return { ...movie, ...item };
      } catch (error) {
        console.error(`Failed to fetch movie with ID ${item["tmdb:movieId"][0]}`, error);
        return null;
      }
    });

  const watchedMovies = await Promise.all(moviePromises);
  return watchedMovies.filter(Boolean);
};
```

### Step 4: Displaying the Movies

I created a custom `Reel` component that displays each movie with:
- Movie poster from TMDb
- Title from Letterboxd
- My rating (vote_average)
- Watch date
- Link to my Letterboxd review

The component handles the visual presentation with hover effects and responsive design.

### Step 5: Performance Optimization

To ensure fast page loads, I:
- **Parallelize API calls** using `Promise.all()`
- **Cache TMDb responses** to avoid hitting rate limits
- **Handle errors gracefully** when movie data isn't available
- **Optimize images** using Astro's built-in image optimization

## The Result

Now my homepage automatically displays my latest watched movies in an elegant horizontal scrolling carousel. Visitors can see what I've been watching, my ratings, and click through to read my full reviews on Letterboxd.

This integration keeps my website dynamic and personal while requiring zero manual maintenance. Every time I log a movie on Letterboxd, it automatically appears on my site within minutes.

## Technical Benefits

- **Automated content updates** - No manual intervention required
- **Real-time synchronization** - New watches appear automatically
- **Rich metadata** - Combines Letterboxd data with TMDb details
- **Performance optimized** - Parallel API calls and error handling
- **Mobile responsive** - Works beautifully on all devices

This approach demonstrates how RSS feeds can still be powerful tools for content syndication and personal website automation in 2025. Sometimes the simplest solutions are the most effective!

*Want to see it in action? Check out the "Last watched movies" section on my homepage, or view my complete film diary on [Letterboxd](https://letterboxd.com/valerionarcisi/).*