import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import { getSlugFromId, getLangFromId } from '../i18n/utils';

export async function GET(context) {
  const allEntries = await getCollection('blog');

  const items = allEntries.map((entry) => {
    const slug = getSlugFromId(entry.id);
    const lang = getLangFromId(entry.id);
    const link = lang === 'it' ? `/blog/${slug}/` : `/en/blog/${slug}/`;

    return {
      title: entry.data.title,
      pubDate: new Date(entry.data.date),
      description: entry.data.extract,
      link,
      author: 'Valerio Narcisi',
      categories: entry.data.tags || [],
      customData: entry.data.coverImage
        ? `<media:content url="${entry.data.coverImage}" type="image/jpeg" />`
        : '',
    };
  });

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items,
    customData: `
      <language>it</language>
      <managingEditor>hello@valerionarcisi.me (Valerio Narcisi)</managingEditor>
      <webMaster>hello@valerionarcisi.me (Valerio Narcisi)</webMaster>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <ttl>60</ttl>
    `,
    xmlns: {
      media: 'http://search.yahoo.com/mrss/',
      atom: 'http://www.w3.org/2005/Atom',
    }
  });
}
