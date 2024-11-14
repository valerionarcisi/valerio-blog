import { parseString } from 'xml2js';

export const getLetterboxdRss = async (): Promise<Response> => {
  try {
    const response = await fetch('https://letterboxd.com/valenar/rss/');

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed. Status: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    throw error;
  }
};

export const parseXmlContent = (xmlContent: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    parseString(xmlContent, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
