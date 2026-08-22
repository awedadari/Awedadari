import React, { useState, useEffect } from 'react';
import { db, DatabaseService } from '../../services/db';
import { User, Tournament, RankedPlayerGameProfile, GameCategoryInfo } from '../../types';
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
  Info,
  Layers,
  Crown,
  Phone,
  Send,
  Gamepad2,
  TrendingUp,
  Activity,
  CheckCircle2,
} from 'lucide-react';

interface PlayersLeaderboardViewProps {
  currentUser: User;
  onSelectTournament?: (t: Tournament) => void;
}

export const PlayersLeaderboardView: React.FC<PlayersLeaderboardViewProps> = ({
  currentUser,
  onSelectTournament,
}) => {
  const [, setTick] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGameKey, setSelectedGameKey] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<RankedPlayerGameProfile | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [selectedOrganizer, setSelectedOrganizer] = useState<{
    org: User;
    stats: any;
    tours: Tournament[];
  } | null>(null);

  useEffect(() => {
    db.loadCompletedTournaments();
    return db.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const availableGames = db.getAvailableGames();

  // Set initial selected game to the most active completed game or first game
  useEffect(() => {
    if (!selectedGameKey && availableGames.length > 0) {
      const topActive = availableGames.find((g) => g.completedTournamentsCount > 0);
      setSelectedGameKey(topActive ? topActive.key : availableGames[0].key);
    }
  }, [availableGames, selectedGameKey]);

  const activeGameInfo =
    availableGames.find((g) => g.key === selectedGameKey) ||
    DatabaseService.getGameDisplayInfo(selectedGameKey || 'efootball');

  const rankedPlayers = db.getRankedPlayersForGame(selectedGameKey);

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
      <div className="bg-slate-850 border border-emerald-500/30 p-5 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 bg-emerald-500 text-slate-950 font-black rounded-2xl flex items-center justify-center shadow-lg shrink-0 text-2xl">
            {activeGameInfo.icon || '🏆'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-extrabold text-white">
                {activeGameInfo.name} Competitive Leaderboard
              </h1>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono font-bold rounded-full border border-emerald-500/30">
                1000 Baseline PTS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Independent ratings computed from official Final Results, tournament size & field strength
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowFormulaModal(true)}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
        >
          <Info className="w-4 h-4 text-sky-400" />
          Rating Rules & Formula
        </button>
      </div>

      {/* GAME CATEGORY TABS SELECTOR */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Gamepad2 className="w-4 h-4 text-emerald-400" />
            Select Game Ranking Track
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {availableGames.length} Esports Titles
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
          {availableGames.map((game) => {
            const isSelected = selectedGameKey === game.key;
            return (
              <button
                key={game.key}
                onClick={() => {
                  setSelectedGameKey(game.key);
                  setSearchTerm('');
                }}
                className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 shrink-0 border ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-950/50 scale-[1.02]'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-750'
                }`}
              >
                <span className="text-sm">{game.icon}</span>
                <span>{game.name}</span>
                {game.completedTournamentsCount > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isSelected
                        ? 'bg-slate-950 text-emerald-300'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {game.completedTournamentsCount} {game.completedTournamentsCount === 1 ? 'event' : 'events'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Search ${activeGameInfo.name} players by name or gamertag...`}
          className="w-full bg-slate-900 border border-slate-750 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition-all shadow-inner"
        />
      </div>

      {/* Top 3 Podium Cards */}
      {!searchTerm && top3.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            {activeGameInfo.name} Champions — Top 3
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {top3.map((rp, index) => {
              const medals = [
                {
                  bg: 'bg-gradient-to-b from-amber-950/50 to-slate-900',
                  border: 'border-amber-500/60',
                  badge: '🥇 #1 CHAMPION',
                  text: 'text-amber-300',
                  badgeBg: 'bg-amber-500/20 border-amber-500/40',
                },
                {
                  bg: 'bg-gradient-to-b from-slate-800/80 to-slate-900',
                  border: 'border-slate-400/60',
                  badge: '🥈 #2 RUNNER-UP',
                  text: 'text-slate-200',
                  badgeBg: 'bg-slate-400/20 border-slate-400/40',
                },
                {
                  bg: 'bg-gradient-to-b from-amber-950/30 to-slate-900',
                  border: 'border-amber-700/60',
                  badge: '🥉 #3 THIRD PLACE',
                  text: 'text-amber-500',
                  badgeBg: 'bg-amber-700/20 border-amber-700/40',
                },
              ][index];

              return (
                <div
                  key={rp.user.id}
                  onClick={() => setSelectedPlayer(rp)}
                  className={`${medals.bg} border ${medals.border} p-4 rounded-3xl shadow-lg cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden group`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${medals.text} ${medals.badgeBg} border shadow-xs`}
                    >
                      {medals.badge}
                    </span>
                    <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-xl border border-emerald-500/20">
                      {rp.stats.rating} PTS
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <img
                      src={
                        rp.user.profileImage ||
                        'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150'
                      }
                      alt={rp.user.name}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-700 shrink-0 shadow-md"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-white text-sm truncate group-hover:text-emerald-300 transition-colors">
                        {rp.user.gamertag || rp.user.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">{rp.user.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-300 font-medium mt-1">
                        <span className="text-amber-300 font-bold">🏆 {rp.stats.wins} Wins</span>
                        <span>•</span>
                        <span>Events: {rp.stats.tournamentsPlayed}</span>
                        <span>•</span>
                        <span>Best: {rp.stats.bestFinishLabel}</span>
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
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h2 className="text-xs font-extrabold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            {activeGameInfo.name} Rankings ({filteredPlayers.length})
          </h2>
          <span className="text-[10px] text-slate-400 font-mono">
            Sorted by Rating & Tie-breakers
          </span>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Competitor</th>
                <th className="p-3 text-center">Rating</th>
                <th className="p-3 text-center">Events</th>
                <th className="p-3 text-center">Wins (#1)</th>
                <th className="p-3 text-center">Podiums (Top 3)</th>
                <th className="p-3 text-center">Top 8</th>
                <th className="p-3 text-right">Best Finish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No players found matching "{searchTerm}" for {activeGameInfo.name}.
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
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                              : rp.globalRank === 2
                              ? 'bg-slate-300 text-slate-950 font-black shadow-md'
                              : rp.globalRank === 3
                              ? 'bg-amber-700 text-white font-black shadow-md'
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
                            src={
                              rp.user.profileImage ||
                              'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150'
                            }
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
                            <p className="text-[10px] text-slate-400 truncate">{rp.user.name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Player Rating */}
                      <td className="p-3 text-center">
                        <span className="font-mono font-extrabold text-xs text-emerald-400 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl inline-block shadow-xs">
                          {rp.stats.rating} PTS
                        </span>
                      </td>

                      {/* Events */}
                      <td className="p-3 text-center font-mono font-bold text-slate-300">
                        {rp.stats.tournamentsPlayed}
                      </td>

                      {/* Wins */}
                      <td className="p-3 text-center font-mono font-extrabold text-amber-300">
                        {rp.stats.wins}
                      </td>

                      {/* Top 3 */}
                      <td className="p-3 text-center font-mono font-bold text-sky-400">
                        {rp.stats.podiums}
                      </td>

                      {/* Top 8 */}
                      <td className="p-3 text-center font-mono font-bold text-indigo-300">
                        {rp.stats.top8}
                      </td>

                      {/* Best Finish */}
                      <td className="p-3 text-right font-mono font-bold text-slate-300">
                        <span className="px-2 py-0.5 bg-slate-800 rounded-lg text-slate-300 border border-slate-700 text-[11px]">
                          {rp.stats.bestFinishLabel}
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

      {/* RATING FORMULA MODAL */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowFormulaModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Awedadari Rating Engine
                </h3>
                <p className="text-[11px] text-slate-400">
                  Data-driven competitive rating calculation principles
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 space-y-1">
                <span className="font-extrabold text-emerald-400 text-xs block">
                  1. Baseline Starting Rating (1000 PTS)
                </span>
                <p className="text-[11px] text-slate-400">
                  Every player starts with 1000 PTS in each separate game category. Each game maintains its own independent rating track.
                </p>
              </div>

              <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 space-y-1.5">
                <span className="font-extrabold text-amber-400 text-xs block">
                  2. Base Placement Points Table
                </span>
                <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[11px]">
                  <span className="p-1.5 bg-slate-900 rounded-lg text-amber-300 font-bold border border-amber-500/30">
                    1st: 15 pts
                  </span>
                  <span className="p-1.5 bg-slate-900 rounded-lg text-slate-200 font-bold border border-slate-400/30">
                    2nd: 10 pts
                  </span>
                  <span className="p-1.5 bg-slate-900 rounded-lg text-amber-500 font-bold border border-amber-700/30">
                    3rd: 8 pts
                  </span>
                  <span className="p-1.5 bg-slate-900 rounded-lg text-sky-400 font-bold border border-sky-500/30">
                    4th: 6 pts
                  </span>
                  <span className="p-1.5 bg-slate-900 rounded-lg text-slate-300">5th: 4 pts</span>
                  <span className="p-1.5 bg-slate-900 rounded-lg text-slate-300">6th: 2 pts</span>
                  <span className="p-1.5 bg-slate-900 rounded-lg text-slate-300">7th: 1 pt</span>
                  <span className="p-1.5 bg-slate-900 rounded-lg text-slate-300">8th: 1 pt</span>
                </div>
              </div>

              <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 space-y-1">
                <span className="font-extrabold text-sky-400 text-xs block">
                  3. Tournament Size & Strength Multipliers
                </span>
                <p className="text-[11px] text-slate-400">
                  Larger tournaments and stronger competitor fields multiply rewards:
                </p>
                <ul className="list-disc pl-4 text-[11px] text-slate-300 space-y-0.5">
                  <li><strong>Size Multiplier:</strong> 8 players (0.5×), 16 players (1.0×), 32 players (2.0×), 64 players (4.0×).</li>
                  <li><strong>Field Strength:</strong> Scaled by the average pre-tournament rating of participating competitors (0.6× to 1.8×).</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 space-y-1">
                <span className="font-extrabold text-indigo-300 text-xs block">
                  4. Deterministic Tie-Breakers
                </span>
                <p className="text-[11px] text-slate-400">
                  1. Rating &rarr; 2. Championships &rarr; 3. Podiums (Top 3) &rarr; 4. Top 8 finishes &rarr; 5. Tournaments Played &rarr; 6. Best Finish.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFormulaModal(false)}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-md transition-all text-xs uppercase"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* PLAYER PROFILE MODAL */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-750 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-4 pt-2 border-b border-slate-800 pb-4">
              <img
                src={
                  selectedPlayer.user.profileImage ||
                  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150'
                }
                alt={selectedPlayer.user.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/50 shrink-0 shadow-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-white truncate">
                    {selectedPlayer.user.gamertag || selectedPlayer.user.name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono font-bold rounded-full border border-emerald-500/30 shrink-0">
                    Rank #{selectedPlayer.globalRank}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">{selectedPlayer.user.name}</p>
                <p className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                  📱 Phone: {selectedPlayer.user.phoneNumber || 'Not provided'}
                </p>
                {selectedPlayer.user.username && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    Telegram: @{selectedPlayer.user.username}
                  </p>
                )}
              </div>
            </div>

            {/* Selected Game Specific Statistics */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>{selectedPlayer.gameName} Career Stats</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  {selectedPlayer.stats.rating} PTS
                </span>
              </h4>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 shadow-xs">
                  <span className="block text-base font-mono font-black text-emerald-400">
                    {selectedPlayer.stats.rating} PTS
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Game Rating</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 shadow-xs">
                  <span className="block text-base font-mono font-black text-sky-400">
                    {selectedPlayer.stats.tournamentsPlayed}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Events Played</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 shadow-xs">
                  <span className="block text-base font-mono font-black text-amber-300">
                    {selectedPlayer.stats.wins}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Championships (#1)</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 shadow-xs">
                  <span className="block text-base font-mono font-black text-slate-200">
                    {selectedPlayer.stats.runnerUps}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Runner-ups (#2)</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 shadow-xs">
                  <span className="block text-base font-mono font-black text-amber-500">
                    {selectedPlayer.stats.podiums}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Podiums (Top 3)</span>
                </div>
                <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 shadow-xs">
                  <span className="block text-base font-mono font-black text-indigo-300">
                    {selectedPlayer.stats.bestFinishLabel}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Best Finish</span>
                </div>
              </div>

              <div className="p-3 bg-slate-850 border border-slate-750 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-slate-300">Average Placement:</span>
                <span className="font-mono font-extrabold text-amber-300">
                  {selectedPlayer.stats.averageFinish === 'N/A'
                    ? 'N/A'
                    : `#${selectedPlayer.stats.averageFinish}`}
                </span>
              </div>
            </div>

            {/* ALL GAME RATINGS BREAKDOWN */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                Ratings Across All Games
              </h4>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {db.getPlayerAllGameStats(selectedPlayer.user.id).map((gameStat) => {
                  const gInfo = DatabaseService.getGameDisplayInfo(gameStat.gameName);
                  return (
                    <div
                      key={gameStat.gameKey}
                      className="p-2.5 bg-slate-850 border border-slate-750 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{gInfo.icon}</span>
                        <span className="font-bold text-white truncate">{gInfo.name}</span>
                        <span className="text-[10px] text-slate-400">
                          ({gameStat.tournamentsPlayed} {gameStat.tournamentsPlayed === 1 ? 'event' : 'events'})
                        </span>
                      </div>
                      <span className="font-mono font-extrabold text-emerald-400 text-xs shrink-0">
                        {gameStat.rating} PTS
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Direct Contact Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {selectedPlayer.user.phoneNumber ? (
                <a
                  href={`tel:${selectedPlayer.user.phoneNumber}`}
                  className="py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  Call
                </a>
              ) : (
                <div className="py-2 px-3 bg-slate-800/50 border border-slate-800 text-slate-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> No Phone
                </div>
              )}

              {selectedPlayer.user.username ? (
                <a
                  href={`https://t.me/${selectedPlayer.user.username.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5 text-sky-400" />
                  Telegram
                </a>
              ) : (
                <div className="py-2 px-3 bg-slate-800/50 border border-slate-800 text-slate-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                  <Send className="w-3.5 h-3.5" /> No Telegram
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const text = `🏆 Check out ${selectedPlayer.user.name}'s profile on Awedadari! ${selectedPlayer.gameName} Rank #${selectedPlayer.globalRank} with ${selectedPlayer.stats.rating} PTS (${selectedPlayer.stats.wins} Wins).`;
                navigator.clipboard.writeText(text);
                alert('Copied player rating details to clipboard!');
              }}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              Share Competitor Card
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
              className="absolute top-4 right-4 p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pt-2">
              <img
                src={
                  selectedOrganizer.org.profileImage ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                }
                alt={selectedOrganizer.org.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500/50 shrink-0"
              />
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
                  {selectedOrganizer.org.name}
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                </h3>
                <p className="text-xs text-amber-300 font-semibold">
                  Verified Tournament Organizer
                </p>
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
                      <h5 className="font-bold text-white text-xs truncate">
                        {t.tournamentName}
                      </h5>
                      <p className="text-[10px] text-slate-400">
                        {t.game} • Fee: {t.registrationFee || 'Free'}
                      </p>
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
