import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { telegramService } from '../../services/telegramService';
import { User, Tournament, Match } from '../../types';
import { PlayersLeaderboardView } from './PlayersLeaderboardView';
import {
  Trophy,
  Gamepad2,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  UserCheck,
  ArrowRight,
  Shield,
  Zap,
  AlertCircle,
  Sparkles,
  Heart,
  Star,
  Bell,
  Search,
  Users,
  ShieldCheck,
  Swords,
  Flame,
  Award,
  Tv,
  Check,
  ChevronRight,
  Send,
  Building,
} from 'lucide-react';

interface PlayerHomeProps {
  user: User;
  onNavigateToTournaments: () => void;
  onNavigateToProfile: () => void;
  onNavigateToPlayers?: () => void;
  onSelectTournament?: (t: Tournament) => void;
}

// Helper to parse numeric prize pool from string (e.g. "10,000 ETB" -> 10000)
const parsePrizePool = (prizeStr: string): number => {
  if (!prizeStr) return 0;
  const numStr = prizeStr.replace(/[^0-9]/g, '');
  return numStr ? parseInt(numStr, 10) : 0;
};

export const PlayerHome: React.FC<PlayerHomeProps> = ({
  user,
  onNavigateToTournaments,
  onNavigateToProfile,
  onNavigateToPlayers,
  onSelectTournament,
}) => {
  const approvedTournaments = db.getApprovedTournaments();
  
  // Requirement 2a: Featured tournaments sorted by highest to lowest prize pool / award (top 3)
  const top3PrizeTournaments = [...approvedTournaments]
    .sort((a, b) => parsePrizePool(b.award || b.prizePool || '') - parsePrizePool(a.award || a.prizePool || ''))
    .slice(0, 3);

  const topPlayers = db.getRankedPlayers().slice(0, 4);
  const notifications = db.getNotifications(user.id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('ALL');

  // Gamertag local editing state
  const [editingGamertag, setEditingGamertag] = useState(false);
  const [gamertagInput, setGamertagInput] = useState(user.gamertag || '');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    setGamertagInput(user.gamertag || '');
  }, [user.id, user.gamertag]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    telegramService.triggerHaptic(type === 'success' ? 'success' : 'warning');
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveGamertag = () => {
    if (!gamertagInput.trim()) {
      showToast('Please enter a valid gamertag', 'error');
      return;
    }
    db.updateUser({ id: user.id, gamertag: gamertagInput.trim() });
    setEditingGamertag(false);
    showToast('Gamertag updated successfully!');
  };

  // Requirement 3: Updated Game Categories
  const gameCategories = [
    { id: 'ALL', name: 'All Games', icon: '🎮' },
    { id: 'eFootball', name: 'eFootball', icon: '⚽' },
    { id: 'PUBG Mobile', name: 'PUBG Mobile', icon: '🎯' },
    { id: 'Asphalt Legends Unite', name: 'Asphalt Legends Unite', icon: '🏎️' },
    { id: 'Call of Duty: Mobile', name: 'Call of Duty: Mobile', icon: '💥' },
    { id: 'Ludo King', name: 'Ludo King', icon: '🎲' },
    { id: 'Shadow Fight 4: Arena', name: 'Shadow Fight 4: Arena', icon: '⚔️' },
    { id: '8 Ball Pool', name: '8 Ball Pool', icon: '🎱' },
    { id: 'Chess.com', name: 'Chess.com', icon: '♟️' },
  ];

  // Requirement 2b: Feature matches under "Final Results"
  const allMatches = db.getAllMatches();
  const finalResultsMatches = allMatches.filter((m) => {
    const isFinished = m.status === 'Finished' || !!m.winnerId;
    const isFinalRound = m.round.toLowerCase().includes('final') || m.round.toLowerCase().includes('semi');
    const matchesGameFilter =
      selectedGameFilter === 'ALL' ||
      (m.tournament?.game || '').toLowerCase().includes(selectedGameFilter.toLowerCase());
    return (isFinished || isFinalRound) && matchesGameFilter;
  });

  // Requirement 2d: Top Organizers sorted by total prize/award given so far
  const allUsers = db.getUsers();
  const topOrganizers = allUsers
    .filter((u) => u.role === 'ORGANIZER')
    .map((org) => {
      const orgTournaments = db.getOrganizerTournaments(org.id);
      const totalPrizeGiven = orgTournaments.reduce(
        (acc, t) => acc + parsePrizePool(t.award || t.prizePool || ''),
        0
      );
      const stats = db.getOrganizerStats(org.id);
      return {
        org,
        tournamentsCount: orgTournaments.length,
        totalPrizeGiven,
        stats,
      };
    })
    .sort((a, b) => b.totalPrizeGiven - a.totalPrizeGiven);

  // Categorized tournaments for Home screen sections
  const filteredTournaments = approvedTournaments.filter((t) => {
    if (selectedGameFilter === 'ALL') return true;
    return t.game.toLowerCase().includes(selectedGameFilter.toLowerCase());
  });

  const happeningNow = filteredTournaments.filter(
    (t) => t.status === 'Ongoing' || t.status === 'Live'
  );

  // Requirement 2: Open Tournaments sorted by highest number of registered players
  const registrationOpen = filteredTournaments
    .filter((t) => t.status === 'Registration Open' || t.status === 'Upcoming')
    .sort((a, b) => {
      const regA = db.getTournamentPlayers(a.id).length;
      const regB = db.getTournamentPlayers(b.id).length;
      if (regB !== regA) {
        return regB - regA;
      }
      return b.id.localeCompare(a.id);
    });

  const startingSoon = filteredTournaments.filter(
    (t) => t.status === 'Registration Open' || t.status === 'Upcoming'
  );

  const recentlyFinished = filteredTournaments.filter(
    (t) => t.status === 'Finished' || t.status === 'Completed'
  );

  const happeningNowCount = approvedTournaments.filter(
    (t) => t.status === 'Ongoing' || t.status === 'Live'
  ).length;

  const registrationOpenCount = approvedTournaments.filter(
    (t) => t.status === 'Registration Open' || t.status === 'Upcoming'
  ).length;

  const finishedTodayCount = approvedTournaments.filter(
    (t) => t.status === 'Finished' || t.status === 'Completed'
  ).length;

  const totalRegisteredTodayCount = approvedTournaments.reduce((acc, t) => {
    return acc + db.getTournamentPlayers(t.id).length;
  }, 0);

  return (
    <div className="space-y-5 pb-28">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-semibold shadow-lg animate-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* DIVERSE HERO HUB BANNER */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-sky-500/30 p-5 shadow-2xl space-y-4">

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              Tournament Center
            </span>
          </div>

          {/* Requirement 1: Stable Push Notification Alert Bar */}
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              telegramService.triggerHaptic('light');
            }}
            className="relative p-2.5 bg-slate-900/90 border border-slate-750 text-slate-300 hover:text-white rounded-2xl transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            title="Push Notifications"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">Alerts</span>
            {unreadCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[9px] font-mono font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl font-black text-white leading-snug tracking-tight">
            COMPETE. WIN. CLIMB THE RANKS.
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-sm leading-relaxed">
            Welcome, <strong className="text-amber-400">{user.name}</strong>! Discover local console gamezones, tournament brackets & real-time match results.
          </p>
        </div>

        {/* Gamertag & Team Card */}
        <div className="relative z-10 p-3.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-750 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Gamer Tag</span>
                {user.teamName && (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 font-bold text-[9px] rounded-full border border-amber-500/20">
                    {user.teamName}
                  </span>
                )}
              </div>
              {editingGamertag ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={gamertagInput}
                    onChange={(e) => setGamertagInput(e.target.value)}
                    className="bg-slate-850 border border-slate-700 text-xs text-white px-2 py-1 rounded-lg focus:outline-none focus:border-sky-500 w-full"
                    placeholder="Enter Gamertag..."
                  />
                  <button
                    onClick={handleSaveGamertag}
                    className="text-xs px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg font-bold shrink-0"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p className="text-xs font-black text-emerald-400 truncate mt-0.5">
                  {user.gamertag ? `@${user.gamertag}` : <span className="text-amber-400 font-normal">No gamertag set</span>}
                </p>
              )}
            </div>
          </div>

          {!editingGamertag && (
            <button
              onClick={() => {
                setEditingGamertag(true);
                telegramService.triggerHaptic('light');
              }}
              className="text-xs text-sky-400 hover:text-sky-300 font-bold px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 rounded-xl transition-colors shrink-0 ml-2 border border-sky-500/20"
            >
              {user.gamertag ? 'Edit Tag' : 'Set Tag'}
            </button>
          )}
        </div>
      </div>

      {/* Push Notifications Drawer */}
      {showNotifications && (
        <div className="bg-slate-900 border border-slate-750 p-4 rounded-3xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-xs flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              Notifications ({notifications.length})
            </h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-2 text-center">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => db.markNotificationRead(n.id)}
                  className={`p-2.5 rounded-2xl border text-xs space-y-1 transition-all cursor-pointer ${
                    n.read
                      ? 'bg-slate-850 border-slate-800 text-slate-400'
                      : 'bg-sky-500/10 border-sky-500/30 text-sky-200 font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{n.title}</span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* GAME CATEGORIES CAROUSEL (Requirement 3) */}
      <div className="space-y-2">
        <span className="text-xs font-black text-slate-300 uppercase tracking-wider block px-1">
          Game Categories
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {gameCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedGameFilter(cat.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold shrink-0 border transition-all flex items-center gap-1.5 ${
                selectedGameFilter === cat.id
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                  : 'bg-slate-850 text-slate-300 border-slate-750 hover:bg-slate-800'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* QUICK FEATURE CARDS GRID */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={onNavigateToTournaments}
          className="p-3.5 bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-2xl text-left transition-all shadow-md group"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Trophy className="w-4 h-4" />
          </div>
          <h3 className="font-black text-white text-xs">Browse Tournaments</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Join live eSports brackets</p>
        </button>

        <button
          onClick={onNavigateToPlayers}
          className="p-3.5 bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-2xl text-left transition-all shadow-md group"
        >
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="font-black text-white text-xs">Player Leaderboard</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Ranked Ethiopian gamers</p>
        </button>
      </div>

      {/* =========================================================================
          SECTION 1: TODAY'S ACTIVITY (Informational Statistics)
          ========================================================================= */}
      <div className="bg-slate-850 border border-slate-750 p-4 rounded-3xl space-y-3 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-xs font-black text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
            <Building className="w-4 h-4 text-sky-400" /> Today's Activity
          </h2>
          <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">
            Live Overview
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
              Ongoing Tournaments
            </span>
            <span className="text-lg font-black font-mono text-emerald-400 block">
              {happeningNowCount}
            </span>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
              Registration Open
            </span>
            <span className="text-lg font-black font-mono text-amber-300 block">
              {registrationOpenCount}
            </span>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
              Finished Today
            </span>
            <span className="text-lg font-black font-mono text-sky-400 block">
              {finishedTodayCount}
            </span>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">
              Total Players Registered
            </span>
            <span className="text-lg font-black font-mono text-indigo-400 block">
              {totalRegisteredTodayCount}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: OPEN TOURNAMENTS
          ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Open Tournaments
          </h2>
          <button onClick={onNavigateToTournaments} className="text-xs text-amber-400 font-bold hover:underline">
            View All &rarr;
          </button>
        </div>

        {registrationOpen.length === 0 ? (
          <div className="p-6 text-center bg-slate-850 rounded-2xl border border-slate-750 text-xs text-slate-400 font-bold">
            No open tournaments at the moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {registrationOpen.slice(0, 3).map((t) => {
              const regCount = db.getTournamentPlayers(t.id).length;
              const slotsLeft = Math.max(0, t.maxPlayers - regCount);

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    if (onSelectTournament) onSelectTournament(t);
                    else onNavigateToTournaments();
                  }}
                  className="bg-slate-850 border border-slate-750 hover:border-amber-500/40 rounded-3xl p-4 space-y-3 shadow-lg cursor-pointer transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={t.image}
                      alt={t.tournamentName}
                      className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-slate-750"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
                          {t.game}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold rounded-full">
                          {slotsLeft} {slotsLeft === 1 ? 'Slot Left' : 'Slots Left'}
                        </span>
                      </div>

                      <h3 className="font-black text-white text-sm truncate group-hover:text-amber-300 transition-colors mt-0.5">
                        {t.tournamentName}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-sky-400" /> {t.date}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                          Entry Fee: {t.registrationFee || '50 ETB'}
                        </span>
                        {(t.award || t.prizePool) && (
                          <span className="flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                            <Award className="w-3 h-3 text-amber-400" /> Award: {t.award || t.prizePool}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">
                      Players: <strong className="text-white">{regCount}</strong> / {t.maxPlayers}
                    </span>
                    <button className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-xl flex items-center gap-1 shadow-sm">
                      View Details & Register <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 3: GLOBAL COMPETITOR LEADERBOARD
          ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            Global Competitor Leaderboard
          </h2>
          <button onClick={onNavigateToPlayers} className="text-xs text-emerald-400 font-bold hover:underline">
            View All Ranks &rarr;
          </button>
        </div>

        <PlayersLeaderboardView currentUser={user} onSelectTournament={onSelectTournament} />
      </div>
    </div>
  );
};
