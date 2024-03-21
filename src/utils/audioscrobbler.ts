
export const fetchRecentTracks = async () => await fetch(
    "http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=valerionar&api_key=35dcb09bbc9c0e8bee54210bace4ba66&format=json&limit=1"
);