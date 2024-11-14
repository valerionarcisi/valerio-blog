import { z as zod } from 'astro:content';

export const AUDIO_SCROBBLER_API_KEY = '35dcb09bbc9c0e8bee54210bace4ba66';
export const AUDIO_SCROBBLER_USER = 'valerionar';
export const AUDIO_SCROBBLER_VERSION = '2.0';

const Track = zod.object({
  name: zod.string(),
  url: zod.string(),
  date: zod
    .object({
      '#text': zod.string(),
    })
    .optional(),
  album: zod.object({
    '#text': zod.string(),
  }),
  artist: zod.object({
    '#text': zod.string(),
  }),
  image: zod.array(
    zod.object({
      '#text': zod.string(),
      size: zod.string(),
    })
  ),
});

const AudioScubblerSchema = zod.object({
  recenttracks: zod.object({
    track: zod.array(
      Track
    ),
  }),
});

export type AudioScubblerResponse = zod.infer<typeof AudioScubblerSchema>;
export type AudioScubblerTrack = zod.infer<typeof Track>;

export const fetchRecentTracks = async (
  method = 'user.getrecenttracks',
  format = 'json',
  limit = '20'
): Promise<AudioScubblerTrack[]> => {
  const params = new URLSearchParams({
    method,
    user: AUDIO_SCROBBLER_USER,
    api_key: AUDIO_SCROBBLER_API_KEY,
    format,
    limit,
  });

  try {
    const response = await fetch(
      `http://ws.audioscrobbler.com/2.0/?${params.toString()}`
    );

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`Failed to fetch tracks. Status: ${response.status}`);
    }

    const jsonData = await response.json();

    // Validate the JSON response with Zod schema
    const parsedData = AudioScubblerSchema.parse(jsonData).recenttracks.track.filter(
      (track) => track.image[0]['#text'] !== 'https://lastfm.freetls.fastly.net/i/u/34s/2a96cbd8b46e442fc41c2b86b821562f.png'
    )

    return parsedData;
  } catch (error) {
    if (error instanceof zod.ZodError) {
      console.error('Validation error:', error.errors);
      throw new Error('Invalid data format received from API');
    } else {
      console.error('Error fetching recent tracks:', error);
      throw error;
    }
  }
};
