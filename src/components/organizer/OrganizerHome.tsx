import React from 'react';
import { db } from '../../services/db';
import { User } from '../../types';
import { OrganizerRevenueBreakdownTable } from './OrganizerPanel';
import {
  Shield,
  Plus,
  Users,
  Trophy,
  Play,
  Clock,
  Building,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface OrganizerHomeProps {
  user: User;
  onNavigateToPanel: (subTab?: 'create_tour' | 'players' | 'matches' | 'results' | 'progress') => void;
  onNavigateToTournaments: () => void;
}

export const OrganizerHome: React.FC<OrganizerHomeProps> = ({ user, onNavigateToPanel }) => {
  const organizerTournaments = db.getOrganizerTournaments(user.id);

  const ongoingCount = organizerTournaments.filter((t) => t.status === 'Ongoing').length;

  // Total players hosted across all organizer's tournaments
  const totalPlayersHosted = organizerTournaments.reduce((acc, t) => {
    return acc + db.getTournamentPlayers(t.id).length;
  }, 0);

  // Pending payment screenshots needing review
  const pendingPaymentCount = organizerTournaments.reduce((acc, t) => {
    const players = db.getTournamentPlayers(t.id);
    return acc + players.filter((p) => p.paymentStatus === 'PENDING_APPROVAL').length;
  }, 0);

  // All pending registration requests for this organizer
  const pendingRequests = organizerTournaments.flatMap((t) => {
    const players = db.getTournamentPlayers(t.id);
    return players
      .filter((p) => p.paymentStatus === 'PENDING_APPROVAL')
      .map((p) => ({
        tournament: t,
        playerRecord: p,
        userObj: p.user || db.getUserById(p.userId),
      }));
  });

  return (
    <div className="space-y-5 pb-28">
      {/* ORGANIZER VENUE CONTROL HERO BANNER */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 border border-amber-500/30 p-5 shadow-2xl space-y-4">
        {/* Glow accent */}
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-amber-400" />
            Organizer Control Center
          </span>
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-amber-400" /> Approved Host
          </span>
        </div>

        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl font-black text-white leading-snug">
            WELCOME, {user.name.toUpperCase()}!
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-sm leading-relaxed">
            Manage tournament registrations, player check-in verification, station brackets & Telegram bot alerts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 grid grid-cols-2 gap-2.5 pt-2">
          <button
            onClick={() => onNavigateToPanel('create_tour')}
            className="flex items-center justify-center gap-2 p-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs shadow-lg transition-all active:scale-95 uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 font-black" />
            Create Tournament
          </button>
          <button
            onClick={() => onNavigateToPanel('players')}
            className="flex items-center justify-center gap-2 p-3 bg-slate-850 hover:bg-slate-800 text-slate-200 font-black rounded-2xl text-xs border border-slate-700 transition-all active:scale-95 uppercase tracking-wider"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            Your Tournaments
          </button>
        </div>
      </div>

      {/* PENDING APPROVAL NOTIFICATION BOX */}
      {pendingPaymentCount > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-3xl flex items-center justify-between gap-3 shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-amber-300 text-xs">Pending Registrations</h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                <strong>{pendingPaymentCount}</strong> registered player(s) awaiting Admin payment approval.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToPanel('players')}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shrink-0 shadow-md"
          >
            Review &rarr;
          </button>
        </div>
      )}

      {/* METRICS DASHBOARD GRID */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-2xl text-center shadow-md">
          <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-xl font-black text-white">{organizerTournaments.length}</p>
          <p className="text-[10px] text-slate-400 uppercase font-extrabold">My Tourneys</p>
        </div>

        <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-2xl text-center shadow-md">
          <Users className="w-5 h-5 text-sky-400 mx-auto mb-1" />
          <p className="text-xl font-black text-sky-400">{totalPlayersHosted}</p>
          <p className="text-[10px] text-slate-400 uppercase font-extrabold">Players Hosted</p>
        </div>

        <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-2xl text-center shadow-md">
          <Play className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-xl font-black text-emerald-400">{ongoingCount}</p>
          <p className="text-[10px] text-slate-400 uppercase font-extrabold">Live Matches</p>
        </div>
      </div>

      {/* REQUESTS DASHBOARD CARD */}
      <div className="bg-slate-850 border border-slate-750 rounded-3xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Requests
          </h3>
          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
            {pendingRequests.length} Pending
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-750 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3">Tournament</th>
                <th className="py-2.5 px-3">Payment Status</th>
                <th className="py-2.5 px-3">Submitted At</th>
                <th className="py-2.5 px-3 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 italic text-xs">
                    No pending registration payment requests.
                  </td>
                </tr>
              ) : (
                pendingRequests.map((req) => (
                  <tr key={`${req.tournament.id}-${req.playerRecord.userId}`} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                      <img
                        src={req.userObj?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0"
                      />
                      <span>{req.userObj?.name || req.playerRecord.userId}</span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      {req.tournament.tournamentName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Pending Approval
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                      {req.playerRecord.paymentSubmittedAt
                        ? new Date(req.playerRecord.paymentSubmittedAt).toLocaleDateString()
                        : req.playerRecord.registrationDate
                        ? new Date(req.playerRecord.registrationDate).toLocaleDateString()
                        : 'Today'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-[10px] font-medium text-slate-400 italic">
                        {req.playerRecord.paymentStatus === 'CONFIRMED'
                          ? 'Approved by Admin'
                          : req.playerRecord.paymentStatus === 'REJECTED'
                          ? 'Rejected by Admin'
                          : 'Awaiting Admin Review'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EARNINGS DASHBOARD CARD (Reusing Tournament Revenue Breakdown) */}
      <div className="space-y-2">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">Earnings</h3>
        <OrganizerRevenueBreakdownTable user={user} />
      </div>
    </div>
  );
};
