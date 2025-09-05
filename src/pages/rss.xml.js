import rss from '@astrojs/rss';
import fetchHyPosts from '../services/post.js';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context) {
  const posts = await fetchHyPosts();
  
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts?.map((post) => ({
      title: post.title,
      pubDate: new Date(post.date),
      description: post.extract,
      content: post.content || post.extract, // Full content if available
      link: `/blog/${post.slug}/`,
      author: 'Valerio Narcisi',
      categories: post.tags || [],
      customData: post.coverImage?.url 
        ? `<media:content url="${post.coverImage.url}" type="image/jpeg" />` 
        : '',
    })) || [],
    customData: `
      <language>en-us</language>
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
