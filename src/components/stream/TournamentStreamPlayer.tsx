import React, { useState } from 'react';
import { Tv, ExternalLink, AlertCircle } from 'lucide-react';
import { Tournament } from '../../types';
import { getYouTubeWatchUrl, getYouTubeEmbedUrl } from '../../utils/youtube';

interface TournamentStreamPlayerProps {
  tournament: Tournament;
}

export const TournamentStreamPlayer: React.FC<TournamentStreamPlayerProps> = ({
  tournament,
}) => {
  const [hasEmbedError, setHasEmbedError] = useState(false);

  const videoId = tournament.youtubeVideoId || '';
  if (!videoId) return null;

  const watchUrl = getYouTubeWatchUrl(videoId, tournament.youtubeStreamUrl);
  const embedUrl = getYouTubeEmbedUrl(videoId);

  return (
    <div className="space-y-2">
      {/* 1. RESPONSIVE YOUTUBE EMBED PLAYER CONTAINER */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-750 shadow-xl">
        {!hasEmbedError ? (
          <iframe
            src={embedUrl}
            title={`${tournament.tournamentName} Live Stream`}
            className="w-full h-full border-0"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            onError={() => setHasEmbedError(true)}
          />
        ) : (
          /* EMBED FAILURE FALLBACK */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-white font-black text-sm">This video can't be played here.</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                The stream owner or platform may restrict embedding on external pages. You can watch the full broadcast directly on YouTube.
              </p>
            </div>
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Watch on YouTube
            </a>
          </div>
        )}
      </div>

      {/* Stream Details Bar */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <Tv className="w-3.5 h-3.5 text-red-500" />
          <span className="truncate max-w-[200px] sm:max-w-xs">{tournament.tournamentName}</span>
        </div>

        <div className="flex items-center gap-3">
          {!hasEmbedError && (
            <button
              type="button"
              onClick={() => setHasEmbedError(true)}
              className="text-[11px] text-slate-400 hover:text-slate-300 underline"
            >
              Playback issue?
            </button>
          )}
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-bold transition-colors"
          >
            <span>Watch on YouTube</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
