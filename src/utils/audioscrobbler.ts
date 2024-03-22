export const AUDIO_SCROBBLER_API_KEY = "35dcb09bbc9c0e8bee54210bace4ba66";
export const AUDIO_SCROBBLER_USER = "valerionar";
export const AUDIO_SCROBBLER_VERSION = '2.0';

export const fetchRecentTracks = async (method = "user.getrecenttracks", format = "json", limit = "1") => {

    const params = new URLSearchParams();
    params.append("method", method);
    params.append("user", AUDIO_SCROBBLER_USER);
    params.append("api_key", AUDIO_SCROBBLER_API_KEY);
    params.append("format", format);
    params.append("limit", limit);

    return await fetch(`http://ws.audioscrobbler.com/2.0/?${params.toString()}`).then((response) => response.json());
}