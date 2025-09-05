import type { APIRoute } from 'astro';
import fetchHyPosts from '~/services/post';

export const GET: APIRoute = async () => {
  try {
    const posts = await fetchHyPosts();
    
    // Create search index with only necessary data
    const searchData = posts?.map(post => ({
      title: post.title,
      slug: post.slug,
      extract: post.extract,
      date: post.date,
      tags: post.tags || []
    })) || [];

    return new Response(JSON.stringify(searchData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300', // Cache for 5 minutes
      }
    });
  } catch (error) {
    console.error('Error generating search data:', error);
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};