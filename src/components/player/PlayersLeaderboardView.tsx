import React, { useState } from 'react';
import { db } from '../../services/db';
import { User, Tournament } from '../../types';
import {
  Trophy,
  Search,
  Award,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Star,
  X,
  Share2,
  Medal,
  Target,
  Flame,
} from 'lucide-react';

interface PlayersLeaderboardViewProps {
  currentUser: User;
  onSelectTournament?: (t: Tournament) => void;
}

export const PlayersLeaderboardView: React.FC<PlayersLeaderboardViewProps> = ({
  currentUser,
  onSelectTournament,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [selectedOrganizer, setSelectedOrganizer] = useState<{
    org: User;
    stats: any;
    tours: Tournament[];
  } | null>(null);

  const rankedPlayers = db.getRankedPlayers();

  const filteredPlayers = rankedPlayers.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.user.name.toLowerCase().includes(term) ||
      (p.user.gamertag && p.user.gamertag.toLowerCase().includes(term)) ||
      (p.user.favGame && p.user.favGame.toLowerCase().includes(term))
    );
  });

  const top3 = rankedPlayers.slice(0, 3);

  return (
    <div className="space-y-6 pb-24">
      {/* Header Banner */}
      <div className="bg-slate-850 border border-emerald-500/30 p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500 text-slate-950 font-black rounded-2xl flex items-center justify-center shadow-lg shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
              Lifetime Competitor Leaderboard
            </h1>
            <p className="text-xs text-slate-400">
              Data-Driven Lifetime Ratings & Career Statistics from Completed Tournaments
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search players by name, gamertag, or game..."
          className="w-full bg-slate-900 border border-slate-750 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition-all shadow-inner"
        />
      </div>

      {/* Top 3 Podium Cards */}
      {!searchTerm && top3.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Hall of Champions — Top 3
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {top3.map((rp, index) => {
              const medals = [
                { bg: 'bg-amber-950/40', border: 'border-amber-500/50', badge: '🥇 #1 CHAMPION', text: 'text-amber-300' },
                { bg: 'bg-slate-850', border: 'border-slate-400/50', badge: '🥈 #2 RUNNER-UP', text: 'text-slate-200' },
                { bg: 'bg-amber-950/20', border: 'border-amber-700/50', badge: '🥉 #3 THIRD PLACE', text: 'text-amber-500' },
              ][index];

              return (
                <div
                  key={rp.user.id}
                  onClick={() => setSelectedPlayer(rp)}
                  className={`${medals.bg} border ${medals.border} p-4 rounded-3xl shadow-lg cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden group`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-950/80 ${medals.text} border ${medals.border}`}>
                      {medals.badge}
                    </span>
                    <span className="text-xs font-mono font-black text-emerald-400">
                      {rp.rankPoints} RATING
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <img
                      src={rp.user.profileImage || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150'}
                      alt={rp.user.name}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-700 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-white text-sm truncate group-hover:text-emerald-300 transition-colors">
                        {rp.user.gamertag || rp.user.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">{rp.user.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-300 font-medium mt-1">
                        <span className="text-amber-300 font-bold">🏆 {rp.wins} Wins</span>
                        <span>•</span>
                        <span>Events: {rp.eventsPlayed}</span>
                        <span>•</span>
                        <span>Best: {rp.bestFinishLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="bg-slate-900 border border-slate-750 rounded-3xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-xs font-extrabold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            Global Competitor Leaderboard ({filteredPlayers.length})
          </h2>
          <span className="text-[10px] text-slate-400 font-mono">Sorted by Rating & Tie-breakers</span>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Player</th>
                <th className="p-3 text-center">Player Rating</th>
                <th className="p-3 text-center">Events</th>
                <th className="p-3 text-center">Wins</th>
                <th className="p-3 text-center">Top 3</th>
                <th className="p-3 text-right">Best Finish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No players found matching "{searchTerm}".
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((rp) => {
                  const isMe = rp.user.id === currentUser.id;
                  return (
                    <tr
                      key={rp.user.id}
                      onClick={() => setSelectedPlayer(rp)}
                      className={`cursor-pointer transition-colors hover:bg-slate-800/80 ${
                        isMe ? 'bg-emerald-500/10' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Rank */}
                      <td className="p-3 font-mono font-bold">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs ${
                            rp.globalRank === 1
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : rp.globalRank === 2
                              ? 'bg-slate-300 text-slate-950 font-black'
                              : rp.globalRank === 3
                              ? 'bg-amber-700 text-white font-black'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          #{rp.globalRank}
                        </span>
                      </td>

                      {/* Player */}
                      <td className="p-3 min-w-[160px]">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={rp.user.profileImage || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150'}
                            alt={rp.user.name}
                            className="w-9 h-9 rounded-xl object-cover shrink-0 border border-slate-700"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-white text-xs truncate">
                                {rp.user.gamertag || rp.user.name}
                              </span>
                              {isMe && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-black rounded-full">
                                  YOU
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                              {rp.user.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Player Rating */}
                      <td className="p-3 text-center">
                        <span className="font-mono font-extrabold text-xs text-emerald-400 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          {rp.rankPoints} PTS
                        </span>
                      </td>

                      {/* Events */}
                      <td className="p-3 text-center font-mono font-bold text-slate-300">
                        {rp.eventsPlayed}
                      </td>

                      {/* Wins */}
                      <td className="p-3 text-center font-mono font-extrabold text-amber-300">
                        {rp.wins}
                      </td>

                      {/* Top 3 */}
                      <td className="p-3 text-center font-mono font-bold text-sky-400">
                        {rp.top3}
                      </td>

                      {/* Best Finish */}
                      <td className="p-3 text-right font-mono font-bold text-slate-300">
                        <span className="px-2 py-0.5 bg-slate-800 rounded-lg text-slate-300 border border-slate-700">
                          {rp.bestFinishLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PLAYER PROFILE MODAL */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-4 pt-2 border-b border-slate-800 pb-4">
              <img
                src={selectedPlayer.user.profileImage || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150'}
                alt={selectedPlayer.user.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/50 shrink-0"
              />
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  {selectedPlayer.user.gamertag || selectedPlayer.user.name}
                </h3>
                <p className="text-xs text-slate-400">{selectedPlayer.user.name}</p>
                <p className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                  📱 Phone: {selectedPlayer.user.phoneNumber || 'Not provided'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Telegram: @{selectedPlayer.user.username}
                </p>
              </div>
            </div>

            {/* Main Calculated Statistics Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Lifetime Statistics
              </h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750">
                  <span className="block text-sm font-mono font-extrabold text-emerald-400">
                    {selectedPlayer.rankPoints} PTS
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Player Rating</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750">
                  <span className="block text-sm font-mono font-extrabold text-sky-400">
                    {selectedPlayer.eventsPlayed}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Events Played</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750">
                  <span className="block text-sm font-mono font-extrabold text-amber-300">
                    {selectedPlayer.wins}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Wins (#1)</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750">
                  <span className="block text-sm font-mono font-extrabold text-slate-300">
                    {selectedPlayer.runnerUps}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Runner-ups (#2)</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750">
                  <span className="block text-sm font-mono font-extrabold text-amber-500">
                    {selectedPlayer.top3}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Top 3 Finishes</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750">
                  <span className="block text-sm font-mono font-extrabold text-indigo-300">
                    {selectedPlayer.bestFinishLabel}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Best Finish</span>
                </div>
              </div>

              <div className="p-3 bg-slate-850 border border-slate-750 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-slate-300">Average Finish Position:</span>
                <span className="font-mono font-extrabold text-amber-300">
                  {selectedPlayer.averageFinish === 'N/A' ? 'N/A' : `#${selectedPlayer.averageFinish}`}
                </span>
              </div>
            </div>

            {/* Badges Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <Medal className="w-3.5 h-3.5 text-amber-400" />
                Tournament Badges
              </h4>

              <div className="flex flex-wrap gap-2">
                {selectedPlayer.badges && selectedPlayer.badges.length > 0 ? (
                  selectedPlayer.badges.map((b: any, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-slate-850 border border-slate-750 rounded-xl text-xs font-bold text-amber-300 flex items-center gap-1.5 shadow-sm"
                    >
                      <span>{b.icon}</span>
                      <span>{b.label}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-200 rounded-full border border-amber-500/30">
                        ×{b.count}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic p-2 bg-slate-850 rounded-xl w-full text-center border border-slate-800">
                    No badges earned from completed tournaments yet.
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                const text = `🏆 Check out ${selectedPlayer.user.name}'s profile on Sefer Gamers! Rank #${selectedPlayer.globalRank} with ${selectedPlayer.rankPoints} PTS.`;
                navigator.clipboard.writeText(text);
                alert('Copied player profile link!');
              }}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              Share Competitor Stats
            </button>
          </div>
        </div>
      )}

      {/* ORGANIZER PROFILE MODAL */}
      {selectedOrganizer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedOrganizer(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pt-2">
              <img
                src={selectedOrganizer.org.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={selectedOrganizer.org.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500/50 shrink-0"
              />
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                  {selectedOrganizer.org.name}
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                </h3>
                <p className="text-xs text-amber-300 font-semibold">Verified Tournament Organizer</p>
                <p className="text-[10px] text-slate-400">@{selectedOrganizer.org.username}</p>
              </div>
            </div>

            {/* Organizer Rating & Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750">
                <span className="block text-sm font-mono font-bold text-amber-400 flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  {selectedOrganizer.stats.rating}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">Organizer Rating</span>
              </div>

              <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750">
                <span className="block text-sm font-mono font-bold text-sky-400">
                  {selectedOrganizer.stats.totalTournaments}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">Hosted Events</span>
              </div>

              <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750">
                <span className="block text-sm font-mono font-bold text-emerald-400">
                  {selectedOrganizer.stats.totalPlayersHosted}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">Players Hosted</span>
              </div>
            </div>

            {/* Hosted Tournaments List */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-300">
                Tournaments Organized by {selectedOrganizer.org.name}
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedOrganizer.tours.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (onSelectTournament) onSelectTournament(t);
                      setSelectedOrganizer(null);
                    }}
                    className="p-3 bg-slate-850 border border-slate-750 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
                  >
                    <div className="min-w-0">
                      <h5 className="font-bold text-white text-xs truncate">{t.tournamentName}</h5>
                      <p className="text-[10px] text-slate-400">{t.game} • Fee: {t.registrationFee || 'Free'}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
