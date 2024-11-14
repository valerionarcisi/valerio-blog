import React from 'react';
import './Reel.css';

interface Props {
  url: string;
  href: string;
  title: string;
  watchedDate: string;
  album?: string;
  vote_average?: number;
  vote_count?: number;
  artist?: string;
  type: 'movie' | 'song';
}

const Reel: React.FC<Props> = ({
  url,
  title,
  watchedDate,
  href,
  vote_average,
  vote_count,
  album,
  type,
  artist,
}) => {
  return (
    <div className={`Reel ${type}`}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <div className="thumbnail">
          <img src={url} alt={title} />
        </div>
      </a>
      <div className="info">
        <h3 className="title">{title}</h3>
        {artist && <p>By {artist}</p>}
        {album && <p>Album: {album}</p>}
        {vote_average && <p>Vote Average: {vote_average}</p>}
        {vote_count && <p>Vote Count: {vote_count}</p>}
        <p>
          {album ? 'Listen' : 'Watched'} on:{' '}
          {new Date(watchedDate).toLocaleDateString('en-us', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      </div>
    </div>
  );
};

export default Reel;
