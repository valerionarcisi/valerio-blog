import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getSlugFromId, getLangFromId } from '~/i18n/utils';

export const GET: APIRoute = async () => {
  try {
    const allEntries = await getCollection('blog');

    const searchData = allEntries.map(entry => ({
      title: entry.data.title,
      slug: getSlugFromId(entry.id),
      lang: getLangFromId(entry.id),
      extract: entry.data.extract,
      date: entry.data.date,
      tags: entry.data.tags || [],
    }));

    return new Response(JSON.stringify(searchData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300',
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
