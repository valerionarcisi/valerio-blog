import React, { useEffect, useState } from 'react';
import { fetchRecentTracks, type AudioScubblerResponse, type TTrack } from '~/services/audioscrobbler'; // Assicurati che il percorso sia corretto
import Reel from './Reel';

const FetchSongs: React.FC = () => {
  const [lastSongs, setLastSongs] = useState<AudioScubblerResponse | null>(null);

  useEffect(() => {
    const loadSongs = async () => {
      try {
        const response = await fetchRecentTracks();
        setLastSongs(response);
      } catch (error) {
        console.error('Error fetching songs:', error);
      }
    };

    loadSongs();
  }, []); // Empty array means this effect runs once when the component mounts

  if (!lastSongs) {
    return <div>Loading...</div>; // Mostra un messaggio di caricamento finché i dati non sono pronti
  }

  return (
    <div className="ReelContainer">
      {lastSongs.recenttracks.track.map((song: TTrack) => (
        <Reel
          key={song.url}
          type="song"
          artist={song.artist['#text']}
          album={song.album['#text']}
          url={song.image[3]['#text']}
          href={song.url}
          title={song.name}
          watchedDate={song?.date ? song.date['#text'] : new Date().toLocaleDateString('en-us', { year: 'numeric', month: 'short', day: 'numeric' })}
        />
      ))}
    </div>
  );
};

export default FetchSongs;
