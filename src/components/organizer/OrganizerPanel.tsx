import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { compressImage } from '../../utils/imageCompressor';
import {
  User,
  Tournament,
  PlayerStatus,
  TournamentStatus,
  TournamentFormat,
  TournamentGroup,
  TournamentSession,
  FinalStanding,
} from '../../types';
import { InviteModal } from '../common/InviteModal';
import {
  Trophy,
  Users,
  Swords,
  PlusCircle,
  Edit,
  Check,
  CheckCircle2,
  Trash2,
  UserPlus,
  Clock,
  Calendar,
  Layers,
  ShieldAlert,
  Save,
  Sparkles,
  Zap,
  Award,
  ChevronRight,
  AlertCircle,
  Share2,
  Plus,
  ArrowUp,
  ArrowDown,
  Settings,
  Hash,
  RefreshCw,
  Info,
  Medal,
  MapPin,
  Phone,
  ArrowLeft,
  Image as ImageIcon,
  XCircle,
  DollarSign,
  Send,
  Wallet,
  X,
  Lock,
} from 'lucide-react';

interface OrganizerPanelProps {
  user: User;
  initialSubTab?: 'tournaments' | 'players' | 'matches' | 'create_tour' | 'results' | 'progress';
}

const parseEntryFeeNum = (feeStr?: string): number => {
  if (!feeStr) return 0;
  if (feeStr.toLowerCase().includes('free')) return 0;
  const match = feeStr.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
};

export const OrganizerRevenueBreakdownTable: React.FC<{ user: User }> = ({ user }) => {
  const orgTournaments = db.getOrganizerTournaments(user.id);
  const tournamentEarningsList = orgTournaments.map((t) => {
    const players = db.getTournamentPlayers(t.id);
    const paidPlayers = players.filter((p) => p.paymentStatus === 'CONFIRMED');
    const countedPlayers = paidPlayers.length > 0 ? paidPlayers.length : players.length;
    const fee = parseEntryFeeNum(t.registrationFee);
    const collected = fee * countedPlayers;
    const orgShare = Math.round(collected * 0.90 * 100) / 100;

    return {
      tournament: t,
      feeStr: t.registrationFee || '0 ETB',
      countedPlayers,
      maxPlayers: t.maxPlayers,
      collected,
      orgShare,
    };
  });

  return (
    <div className="bg-slate-850 border border-slate-750 rounded-3xl p-5 space-y-4 shadow-lg">
      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
        <Trophy className="w-4 h-4 text-sky-400" />
        Tournament Revenue Breakdown
      </h3>

      {tournamentEarningsList.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs font-medium">
          No tournaments created yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-750 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Tournament</th>
                <th className="py-3 px-3">Entry Fee</th>
                <th className="py-3 px-3">Players</th>
                <th className="py-3 px-3">Collected</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tournamentEarningsList.map((item) => (
                <tr key={item.tournament.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-3 font-bold text-white">
                    {item.tournament.tournamentName}
                    <span className="block text-[10px] text-slate-400 font-normal">{item.tournament.game}</span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-amber-300">{item.feeStr}</td>
                  <td className="py-3 px-3 font-mono">{item.countedPlayers} / {item.maxPlayers}</td>
                  <td className="py-3 px-3 font-bold text-emerald-400">{item.orgShare.toLocaleString()} ETB</td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-750">
                      {item.tournament.status === 'Completed' || item.tournament.status === 'Finished'
                        ? 'Finished'
                        : item.tournament.status || 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const OrganizerEarningsView: React.FC<{
  user: User;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ user, showToast }) => {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawTelebirrName, setWithdrawTelebirrName] = useState<string>('');
  const [withdrawTelebirrNumber, setWithdrawTelebirrNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const orgTournaments = db.getOrganizerTournaments(user.id);
  const myWithdrawalRequests = db.getOrganizerWithdrawalRequests(user.id);

  // Calculate earnings per tournament
  const tournamentEarningsList = orgTournaments.map((t) => {
    const players = db.getTournamentPlayers(t.id);
    const paidPlayers = players.filter((p) => p.paymentStatus === 'CONFIRMED');
    const countedPlayers = paidPlayers.length > 0 ? paidPlayers.length : players.length;
    const fee = parseEntryFeeNum(t.registrationFee);
    const collected = fee * countedPlayers;
    const orgShare = Math.round(collected * 0.90 * 100) / 100;

    return {
      tournament: t,
      feeStr: t.registrationFee || '0 ETB',
      countedPlayers,
      maxPlayers: t.maxPlayers,
      collected,
      orgShare,
    };
  });

  const totalOrganizerEarnings = tournamentEarningsList.reduce((acc, curr) => acc + curr.orgShare, 0);

  const pendingWithdrawal = myWithdrawalRequests
    .filter((r) => r.status === 'Pending Approval')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const paidWithdrawal = myWithdrawalRequests
    .filter((r) => r.status === 'Paid')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const availableForWithdrawal = Math.max(0, totalOrganizerEarnings - paidWithdrawal - pendingWithdrawal);

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter a valid withdrawal amount.', 'error');
      return;
    }
    if (amountNum > availableForWithdrawal) {
      showToast(`Amount exceeds available balance (${availableForWithdrawal.toLocaleString()} ETB).`, 'error');
      return;
    }
    if (!withdrawTelebirrName.trim() || !withdrawTelebirrNumber.trim()) {
      showToast('Please provide Telebirr Name and Telebirr Number.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await db.createWithdrawalRequest({
        organizerId: user.id,
        organizerName: user.name,
        amount: amountNum,
        telebirrName: withdrawTelebirrName.trim(),
        telebirrNumber: withdrawTelebirrNumber.trim(),
      });
      showToast('Withdrawal request submitted for approval!');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawTelebirrName('');
      setWithdrawTelebirrNumber('');
    } catch (err) {
      showToast('Failed to submit withdrawal request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Request Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-850 p-5 rounded-3xl border border-slate-750 shadow-lg">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Organizer Financial & Earnings Summary
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Read-only financial summary (90% Organizer Share / 10% Admin Share) and withdrawal management.
          </p>
        </div>

        <button
          onClick={() => setShowWithdrawModal(true)}
          disabled={availableForWithdrawal <= 0}
          className={`px-5 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
            availableForWithdrawal > 0
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          <Send className="w-4 h-4 font-bold" />
          Request Withdrawal
        </button>
      </div>

      {/* Summary Cards (Requirement 6) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Collected</span>
          <p className="text-lg font-black text-white">{totalOrganizerEarnings.toLocaleString()} ETB</p>
          <p className="text-[10px] text-slate-500 font-medium">Gross revenue share</p>
        </div>

        <div className="bg-slate-850 border border-emerald-500/30 bg-emerald-500/5 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">Balance</span>
          <p className="text-xl font-black text-emerald-300">{availableForWithdrawal.toLocaleString()} ETB</p>
          <p className="text-[10px] text-emerald-400/80 font-medium">Ready for withdrawal</p>
        </div>

        <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Pending Withdrawal</span>
          <p className="text-lg font-black text-amber-400">{pendingWithdrawal.toLocaleString()} ETB</p>
          <p className="text-[10px] text-amber-500/70 font-medium">Awaiting admin approval</p>
        </div>
      </div>

      {/* Tournament Revenue Breakdown Table */}
      <OrganizerRevenueBreakdownTable user={user} />

      {/* Withdrawal Requests History */}
      <div className="bg-slate-850 border border-slate-750 rounded-3xl p-5 space-y-4 shadow-lg">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          My Withdrawal Requests History
        </h3>

        {myWithdrawalRequests.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs font-medium">
            No withdrawal requests submitted yet.
          </div>
        ) : (
          <div className="space-y-2">
            {myWithdrawalRequests.map((req) => (
              <div
                key={req.id}
                className="bg-slate-900 border border-slate-750 p-3.5 rounded-2xl flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-white">{req.amount.toLocaleString()} ETB</span>
                  {(req.telebirrName || req.telebirrNumber) && (
                    <p className="text-[11px] text-slate-300 font-medium">
                      Telebirr: <span className="font-bold">{req.telebirrName}</span> ({req.telebirrNumber})
                    </p>
                  )}
                  {req.reason && !req.telebirrName && <p className="text-[11px] text-slate-400 italic">"{req.reason}"</p>}
                  <span className="text-[10px] text-slate-500 block">
                    {new Date(req.requestedAt).toLocaleString()}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    req.status === 'Paid'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : req.status === 'Rejected'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Withdrawal Modal Dialog (Requirement 8) */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-400" />
                Request Earnings Withdrawal
              </h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl text-xs space-y-1">
              <span className="text-slate-400 block font-medium">Available for Withdrawal</span>
              <p className="text-lg font-black text-emerald-400">{availableForWithdrawal.toLocaleString()} ETB</p>
            </div>

            <form onSubmit={handleRequestWithdrawal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Withdrawal Amount (ETB) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={availableForWithdrawal}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Max: ${availableForWithdrawal}`}
                  className="w-full bg-slate-950 border border-slate-750 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Telebirr Name *</label>
                <input
                  type="text"
                  required
                  value={withdrawTelebirrName}
                  onChange={(e) => setWithdrawTelebirrName(e.target.value)}
                  placeholder="e.g. Abebe Bikila"
                  className="w-full bg-slate-950 border border-slate-750 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Telebirr Number *</label>
                <input
                  type="tel"
                  required
                  value={withdrawTelebirrNumber}
                  onChange={(e) => setWithdrawTelebirrNumber(e.target.value)}
                  placeholder="e.g. 0911223344"
                  className="w-full bg-slate-950 border border-slate-750 rounded-xl px-4 py-2.5 text-xs text-amber-300 font-mono font-bold placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg active:scale-95"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface CompletedTournamentViewPageProps {
  tournament: Tournament;
  onBack: () => void;
}

const CompletedTournamentViewPage: React.FC<CompletedTournamentViewPageProps> = ({ tournament, onBack }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PLAYERS' | 'STANDINGS' | 'MATCHES'>('OVERVIEW');

  const players = db.getTournamentPlayers(tournament.id);
  const matches = db.getMatches(tournament.id);
  const standings = tournament.finalStandings || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-850 p-4 rounded-3xl border border-slate-750 space-y-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <button
              onClick={onBack}
              className="text-[10px] font-bold text-sky-400 hover:underline flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back to My Tournaments List
            </button>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-400" />
              {tournament.tournamentName}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 font-black text-xs rounded-full border border-purple-500/30 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" /> Completed (View-Only)
            </span>
          </div>
        </div>

        {/* Lock Banner */}
        <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-2xl flex items-center gap-2 text-xs font-semibold text-purple-200">
          <Lock className="w-4 h-4 text-purple-400 shrink-0" />
          <span>This tournament is Completed. Configuration, standings, and match records are locked and view-only.</span>
        </div>

        {/* 4 View Tabs: OVERVIEW, PLAYERS, STANDINGS, MATCHES */}
        <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs font-black">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'OVERVIEW'
                ? 'bg-purple-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span className="truncate">OVERVIEW</span>
          </button>

          <button
            onClick={() => setActiveTab('PLAYERS')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'PLAYERS'
                ? 'bg-purple-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="truncate">PLAYERS ({players.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('STANDINGS')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'STANDINGS'
                ? 'bg-purple-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            <span className="truncate">STANDINGS</span>
          </button>

          <button
            onClick={() => setActiveTab('MATCHES')}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'MATCHES'
                ? 'bg-purple-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Swords className="w-3.5 h-3.5 text-sky-300" />
            <span className="truncate">MATCHES ({matches.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="bg-slate-850 border border-slate-750 rounded-3xl p-5 space-y-4 shadow-md text-xs">
          <div className="relative rounded-2xl overflow-hidden border border-slate-700 h-44">
            <img src={tournament.image} alt={tournament.tournamentName} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-950/60 p-4 flex flex-col justify-end">
              <span className="px-2.5 py-0.5 bg-sky-500/20 text-sky-300 font-extrabold text-[10px] rounded border border-sky-500/30 uppercase w-fit">
                {tournament.game}
              </span>
              <h2 className="text-lg font-black text-white mt-1 leading-snug">{tournament.tournamentName}</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900 rounded-2xl border border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Venue Name</span>
              <p className="font-extrabold text-white text-xs">{tournament.venueName || 'N/A'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
              <p className="font-extrabold text-white text-xs">{tournament.venueLocation || 'N/A'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Date & Time</span>
              <p className="font-extrabold text-sky-300 text-xs">{tournament.date} @ {tournament.time}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Registration Fee</span>
              <p className="font-extrabold text-amber-300 text-xs">{tournament.registrationFee || 'Free'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Prize Pool / Award</span>
              <p className="font-extrabold text-emerald-300 text-xs">{tournament.award || tournament.prizePool || 'Bragging Rights'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Max Players / Rounds</span>
              <p className="font-extrabold text-slate-200 text-xs">{tournament.maxPlayers} players • {tournament.maxRounds || 3} rounds</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLAYERS */}
      {activeTab === 'PLAYERS' && (
        <div className="bg-slate-850 border border-slate-750 rounded-3xl p-5 space-y-4 shadow-md text-xs">
          <div className="flex items-center justify-between border-b border-slate-750 pb-3">
            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              Tournament Roster ({players.length} Players)
            </h3>
            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
              Read-Only
            </span>
          </div>

          <div className="space-y-2">
            {players.length === 0 ? (
              <p className="p-6 text-center text-slate-500 italic">No players participated in this tournament.</p>
            ) : (
              players.map((tp, idx) => {
                const userObj = tp.user || db.getUserById(tp.userId);
                return (
                  <div
                    key={tp.userId || idx}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={userObj?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-white text-xs truncate">{userObj?.name || tp.userId}</h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          @{userObj?.gamertag || userObj?.telegramUserId || 'player'}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {tp.playerStatus || 'Checked In'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STANDINGS */}
      {activeTab === 'STANDINGS' && (
        <div className="bg-slate-850 border border-slate-750 rounded-3xl p-5 space-y-4 shadow-md text-xs">
          <div className="flex items-center justify-between border-b border-slate-750 pb-3">
            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Final Standings
            </h3>
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Published & Locked
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-750 text-slate-400 text-[10px] uppercase font-bold">
                  <th className="py-2 px-3">Rank</th>
                  <th className="py-2 px-3">Player</th>
                  <th className="py-2 px-3 text-center">Points</th>
                  <th className="py-2 px-3 text-right">Badge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {standings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500 italic">No final standings recorded.</td>
                  </tr>
                ) : (
                  standings.map((st, i) => {
                    const u = db.getUserById(st.userId);
                    return (
                      <tr key={st.userId || i} className={i === 0 ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'}>
                        <td className="py-2.5 px-3 font-black text-amber-400">
                          {st.rank === 1 ? '🥇 1st' : st.rank === 2 ? '🥈 2nd' : st.rank === 3 ? '🥉 3rd' : `#${st.rank}`}
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-white">{u?.name || st.userId}</td>
                        <td className="py-2.5 px-3 text-center text-amber-300 font-black font-mono">{st.points} pts</td>
                        <td className="py-2.5 px-3 text-right text-emerald-300 font-extrabold">{st.badge || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MATCHES */}
      {activeTab === 'MATCHES' && (
        <div className="bg-slate-850 border border-slate-750 rounded-3xl p-5 space-y-4 shadow-md text-xs">
          <div className="flex items-center justify-between border-b border-slate-750 pb-3">
            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Swords className="w-4 h-4 text-sky-400" />
              Match Records ({matches.length} Matches)
            </h3>
            <span className="text-[10px] font-bold text-sky-300 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20">
              Completed
            </span>
          </div>

          <div className="space-y-3">
            {matches.length === 0 ? (
              <p className="p-6 text-center text-slate-500 italic">No match records found for this tournament.</p>
            ) : (
              matches.map((m) => {
                const pA = m.playerA || (m.playerAId ? db.getUserById(m.playerAId) : undefined);
                const pB = m.playerB || (m.playerBId ? db.getUserById(m.playerBId) : undefined);
                return (
                  <div key={m.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase border-b border-slate-800 pb-1.5">
                      <span>{m.round}</span>
                      <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {m.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-black">
                      <div className={`flex items-center gap-2 ${m.winnerId === m.playerAId ? 'text-emerald-400' : 'text-slate-200'}`}>
                        <span>{pA?.name || 'TBD'}</span>
                        <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-amber-300">{m.playerAScore ?? 0}</span>
                      </div>
                      <span className="text-slate-500 text-[10px]">VS</span>
                      <div className={`flex items-center gap-2 ${m.winnerId === m.playerBId ? 'text-emerald-400' : 'text-slate-200'}`}>
                        <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-amber-300">{m.playerBScore ?? 0}</span>
                        <span>{pB?.name || 'TBD'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const OrganizerPanel: React.FC<OrganizerPanelProps> = ({ user }) => {
  // Real-time subscription to db store
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    return db.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Role Guard Check
  if (user.role !== 'ORGANIZER') {
    return (
      <div className="p-6 text-center bg-slate-850 border border-slate-750 rounded-3xl space-y-4 my-8 shadow-xl">
        <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/30">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-white">Organizer Access Only</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          The Organizer Control Panel is restricted to approved tournament organizers. Contact administrator to request organizer privileges.
        </p>
      </div>
    );
  }

  // Top level views: 'MY_TOURNAMENTS', 'CREATE_NEW', or 'EARNINGS'
  const [topTab, setTopTab] = useState<'MY_TOURNAMENTS' | 'CREATE_NEW' | 'EARNINGS'>('MY_TOURNAMENTS');

  // Currently selected tournament for Manager Desk (sorted Newest First)
  const rawTournaments = db.getOrganizerTournaments(user.id);
  const tournaments = [...rawTournaments].sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return b.id.localeCompare(a.id);
  });
  const [selectedDeskTourId, setSelectedDeskTourId] = useState<string | null>(null);

  const activeTournament = selectedDeskTourId ? db.getTournamentById(selectedDeskTourId) || null : null;

  const isTourCompleted = activeTournament?.status === 'Completed' || activeTournament?.status === 'Finished';
  const isTourOngoing = activeTournament?.status === 'Ongoing';
  const isTourRegistrationOpen = activeTournament?.status === 'Registration Open' || activeTournament?.status === 'Upcoming' || activeTournament?.status === 'Draft';

  // 3 Manager Desk Tabs:
  // 1. Manage Tournament
  // 2. Manage Standings
  // 3. Manage Matches
  const [activeMainTab, setActiveMainTab] = useState<'MANAGE_TOURNAMENT' | 'MANAGE_STANDINGS' | 'MANAGE_MATCHES'>(
    'MANAGE_TOURNAMENT'
  );

  // Feedback states
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Created Success Modal (Requirement 1)
  const [createdSuccessModalOpen, setCreatedSuccessModalOpen] = useState(false);

  // Invite Modal state
  const [inviteModalTour, setInviteModalTour] = useState<Tournament | null>(null);

  // Pending Check-in verification modal state (Requirement 3)
  const [pendingCheckInPlayer, setPendingCheckInPlayer] = useState<{
    tp: any;
    userObj?: User;
    codeInput: string;
  } | null>(null);

  // Registered Player detail profile modal state (Requirement 3)
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<User | null>(null);

  // Publish Final Results Confirmation Modal State
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);

  // Start Tournament Confirmation Modal State
  const [showStartConfirmModal, setShowStartConfirmModal] = useState(false);

  // Check-In Requirement Alert Modal State
  const [showCheckInAlert, setShowCheckInAlert] = useState(false);

  // =========================================================================
  // FORM FIELDS (For Edit & Create - Blank default fields per requirement 2)
  // =========================================================================
  const [formName, setFormName] = useState(activeTournament?.tournamentName || '');
  const [formGame, setFormGame] = useState(activeTournament?.game || '');
  const [formImage, setFormImage] = useState(activeTournament?.image || '');
  const [formVenue, setFormVenue] = useState(activeTournament?.venueName || '');
  const [formVenueLocation, setFormVenueLocation] = useState(activeTournament?.venueLocation || '');
  const [formFee, setFormFee] = useState(activeTournament?.registrationFee || '50 ETB');
  const [formAward, setFormAward] = useState(activeTournament?.award || activeTournament?.prizePool || '');
  const [formTelebirr, setFormTelebirr] = useState(activeTournament?.telebirrNumber || '');
  const [formTelebirrName, setFormTelebirrName] = useState(activeTournament?.telebirrAccountName || '');
  const [formDate, setFormDate] = useState(activeTournament?.date || '');
  const [formTime, setFormTime] = useState(activeTournament?.time || '');
  const [formMaxPlayers, setFormMaxPlayers] = useState(activeTournament?.maxPlayers || 16);
  const [formRegDeadline, setFormRegDeadline] = useState(activeTournament?.registrationDeadline || '');
  const [formMaxRounds, setFormMaxRounds] = useState(activeTournament?.maxRounds || 3);
  const [formPerformanceLabel, setFormPerformanceLabel] = useState(activeTournament?.performanceLabel || 'Goals');
  const [formSessionLabel, setFormSessionLabel] = useState(activeTournament?.sessionLabel || 'Match');
  const [formStatus, setFormStatus] = useState<TournamentStatus>(activeTournament?.status || 'Upcoming');
  const [customBannerUpload, setCustomBannerUpload] = useState<string>('');

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast('Banner image exceeds 4MB size limit', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        const compressed = await compressImage(base64, 800, 450, 0.75);
        setCustomBannerUpload(compressed);
        setFormImage(compressed);
        showToast('Tournament banner uploaded!');
      }
    };
    reader.readAsDataURL(file);
  };

  // Check-In Code Input State for Organizer Verification
  const [checkInCodeInput, setCheckInCodeInput] = useState('');

  // Walk-In / Guest Player State
  const [manualName, setManualName] = useState('');
  const [manualGamertag, setManualGamertag] = useState('');
  const [manualTeamName, setManualTeamName] = useState('');
  const [manualProfilePic, setManualProfilePic] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150');

  // Avatar presets for guest player
  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
  ];

  // Open a tournament desk
  const handleOpenManagerDesk = (tourId: string) => {
    setSelectedDeskTourId(tourId);
    const tour = db.getTournamentById(tourId);
    if (tour) {
      setFormName(tour.tournamentName);
      setFormGame(tour.game);
      setFormImage(tour.image);
      setFormVenue(tour.venueName || 'Nexus Gaming Lounge');
      setFormVenueLocation(tour.venueLocation || 'Bole Medhanialem, Building 3, 2nd Floor');
      setFormFee(tour.registrationFee || '50 ETB');
      setFormAward(tour.award || tour.prizePool || '');
      setFormTelebirr(tour.telebirrNumber || '');
      setFormTelebirrName(tour.telebirrAccountName || user.name);
      setFormDate(tour.date);
      setFormTime(tour.time);
      setFormMaxPlayers(tour.maxPlayers);
      setFormRegDeadline(tour.registrationDeadline || `${tour.date} 23:59`);
      setFormMaxRounds(tour.maxRounds || 3);
      setFormPerformanceLabel(tour.performanceLabel || 'Goals');
      setFormSessionLabel(tour.sessionLabel || 'Match');
      setFormStatus(tour.status);
    }
  };

  const confirmStartTournament = async () => {
    if (!activeTournament) return;

    const tourPlayers = db.getTournamentPlayers(activeTournament.id);
    const notAllCheckedIn = tourPlayers.length === 0 || tourPlayers.some((p) => p.playerStatus !== 'Checked In');

    if (notAllCheckedIn) {
      setShowStartConfirmModal(false);
      setShowCheckInAlert(true);
      setFormStatus(activeTournament.status);
      return;
    }

    const finalImage = customBannerUpload || formImage;

    const updateFields: any = {
      tournamentName: formName,
      game: formGame,
      image: finalImage,
      venueName: formVenue,
      venueLocation: formVenueLocation,
      registrationFee: formFee,
      award: formAward.trim(),
      date: formDate,
      time: formTime,
      maxPlayers: Number(formMaxPlayers),
      registrationDeadline: formRegDeadline,
      maxRounds: Number(formMaxRounds),
      performanceLabel: formPerformanceLabel,
      sessionLabel: formSessionLabel,
      status: 'Ongoing',
    };

    if (!activeTournament.isApproved) {
      updateFields.telebirrNumber = formTelebirr;
      updateFields.telebirrAccountName = formTelebirrName;
    }

    await db.updateTournament(activeTournament.id, updateFields);

    setShowStartConfirmModal(false);
    showToast('Tournament started! Status updated to Ongoing.');
  };

  const handleSaveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTournament) return;

    if (isTourCompleted) return;

    const isChangingToOngoing = isTourRegistrationOpen && formStatus === 'Ongoing';

    if (isChangingToOngoing) {
      const tourPlayers = db.getTournamentPlayers(activeTournament.id);
      const notAllCheckedIn = tourPlayers.length === 0 || tourPlayers.some((p) => p.playerStatus !== 'Checked In');

      if (notAllCheckedIn) {
        setShowCheckInAlert(true);
        setFormStatus(activeTournament.status);
        return;
      }

      setShowStartConfirmModal(true);
      return;
    }

    const finalImage = customBannerUpload || formImage;

    const updateFields: any = {
      tournamentName: formName,
      game: formGame,
      image: finalImage,
      venueName: formVenue,
      venueLocation: formVenueLocation,
      registrationFee: formFee,
      award: formAward.trim(),
      date: formDate,
      time: formTime,
      maxPlayers: Number(formMaxPlayers),
      registrationDeadline: formRegDeadline,
      maxRounds: Number(formMaxRounds),
      performanceLabel: formPerformanceLabel,
      sessionLabel: formSessionLabel,
      status: formStatus,
    };

    if (!activeTournament.isApproved) {
      updateFields.telebirrNumber = formTelebirr;
      updateFields.telebirrAccountName = formTelebirrName;
    }

    await db.updateTournament(activeTournament.id, updateFields);

    showToast('Tournament details saved successfully!');
  };

  const handleCreateNewTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Please enter a tournament name', 'error');
      return;
    }

    const newTour = await db.createTournament({
      tournamentName: formName.trim(),
      game: formGame.trim() || 'eFootball 2026',
      image: customBannerUpload || formImage || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
      date: formDate,
      time: formTime,
      maxPlayers: Number(formMaxPlayers),
      registrationDeadline: formRegDeadline,
      status: 'Upcoming',
      organizerId: user.id,
      venueName: formVenue,
      venueLocation: formVenueLocation,
      registrationFee: formFee,
      award: formAward.trim(),
      telebirrNumber: formTelebirr,
      telebirrAccountName: formTelebirrName,
      maxRounds: Number(formMaxRounds),
      performanceLabel: formPerformanceLabel,
      sessionLabel: formSessionLabel,
      isApproved: false, // REQUIRES ADMIN APPROVAL!
    });

    // Reset form fields
    setFormName('');
    setCreatedSuccessModalOpen(true);
    setTopTab('MY_TOURNAMENTS');
  };

  const handleAddManualPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTournament) return;
    if (!manualName.trim()) {
      showToast('Please enter player name', 'error');
      return;
    }
    await db.addManualPlayerToTournament(
      activeTournament.id,
      manualName.trim(),
      manualGamertag.trim(),
      manualTeamName.trim(),
      manualProfilePic
    );
    setManualName('');
    setManualGamertag('');
    setManualTeamName('');
    showToast('Guest player added to roster!');
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        const compressed = await compressImage(base64, 200, 200, 0.7);
        setManualProfilePic(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  // =========================================================================
  // TAB 2: MANAGE STANDINGS STATE & HANDLERS
  // =========================================================================
  const [standingsSubTab, setStandingsSubTab] = useState<'ROUNDS' | 'FINAL_RESULT'>('ROUNDS');
  const [selectedStandingsRound, setSelectedStandingsRound] = useState<number>(1);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [finalRows, setFinalRows] = useState<FinalStanding[]>([]);
  const [selectedPlayerForFinals, setSelectedPlayerForFinals] = useState<string>('');

  const initializeFinalRows = () => {
    if (!activeTournament) return;
    if (activeTournament.finalStandings && activeTournament.finalStandings.length > 0) {
      setFinalRows([...activeTournament.finalStandings]);
    } else {
      // Empty by default for manual control
      setFinalRows([]);
    }
  };

  const handleAddPlayerToFinals = () => {
    if (!selectedPlayerForFinals) return;
    const defaultBadge =
      finalRows.length === 0 ? 'Champion' : finalRows.length === 1 ? 'Runner-up' : finalRows.length === 2 ? 'Third Place' : '';
    const newRow: FinalStanding = {
      userId: selectedPlayerForFinals,
      rank: finalRows.length + 1,
      points: 0,
      performance: 0,
      badge: defaultBadge,
    };
    setFinalRows((prev) => [...prev, newRow]);
    setSelectedPlayerForFinals('');
  };

  const handleRemoveFinalRow = (index: number) => {
    const updated = finalRows.filter((_, i) => i !== index).map((row, idx) => ({ ...row, rank: idx + 1 }));
    setFinalRows(updated);
  };

  const handleMoveFinalRow = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= finalRows.length) return;
    const updated = [...finalRows];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updated.forEach((r, i) => (r.rank = i + 1));
    setFinalRows(updated);
  };

  const handleAddGroupInRound = async () => {
    if (!activeTournament) return;
    await db.createGroup(activeTournament.id, newGroupNameInput.trim() || undefined, selectedStandingsRound);
    setNewGroupNameInput('');
    showToast(`New group created in Round ${selectedStandingsRound}`);
  };

  const handleTogglePlayerInGroup = async (groupId: string, userId: string, currentGroup: TournamentGroup) => {
    const isInside = currentGroup.playerIds.includes(userId);
    let updated: string[];
    if (isInside) {
      updated = currentGroup.playerIds.filter((id) => id !== userId);
    } else {
      updated = [...currentGroup.playerIds, userId];
    }
    await db.updateGroup(groupId, { playerIds: updated });
  };

  const handleUpdatePlayerStatusInGroup = async (
    groupId: string,
    userId: string,
    currentGroup: TournamentGroup,
    status: 'Waiting' | 'Qualified' | 'Eliminated' | 'Champion'
  ) => {
    const statuses = { ...(currentGroup.playerStatuses || {}) };
    statuses[userId] = status;
    await db.updateGroup(groupId, { playerStatuses: statuses });
    showToast('Player status updated');
  };

  // =========================================================================
  // TAB 3: MANAGE MATCHES STATE & HANDLERS
  // =========================================================================
  const [selectedMatchRound, setSelectedMatchRound] = useState<number>(1);
  const [newSessionNameInput, setNewSessionNameInput] = useState('');
  const [scoresBuffer, setScoresBuffer] = useState<Record<string, Record<string, { points: number; performance: number }>>>({});

  const handleGetScoreInput = (sessionId: string, userId: string, defaultPoints = 0, defaultPerf = 0) => {
    if (scoresBuffer[sessionId]?.[userId]) {
      return scoresBuffer[sessionId][userId];
    }
    const sess = db.getTournamentSessions(activeTournament?.id || '').find((s) => s.id === sessionId);
    const existing = sess?.scores?.find((sc) => sc.userId === userId);
    return {
      points: existing ? existing.points : defaultPoints,
      performance: existing ? existing.performance : defaultPerf,
    };
  };

  const handleSetScoreInput = (sessionId: string, userId: string, field: 'points' | 'performance', val: number) => {
    const current = handleGetScoreInput(sessionId, userId);
    setScoresBuffer((prev) => ({
      ...prev,
      [sessionId]: {
        ...(prev[sessionId] || {}),
        [userId]: {
          ...current,
          [field]: val,
        },
      },
    }));
  };

  const handleSavePlayerScoreInSession = async (sessionId: string, userId: string) => {
    const scoreObj = handleGetScoreInput(sessionId, userId);
    await db.saveSessionPlayerScore(sessionId, userId, scoreObj.points, scoreObj.performance);
    showToast('Score saved! Standings automatically updated.');
  };

  const handleCreateNewSession = async () => {
    if (!activeTournament) return;
    await db.createSession(activeTournament.id, selectedMatchRound, newSessionNameInput.trim() || undefined);
    setNewSessionNameInput('');
    showToast(`Session created in Round ${selectedMatchRound}`);
  };

  return (
    <div className="space-y-4 pb-24">
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

      {/* TOP NAVIGATION TABS: "My Tournaments" */}
      <div className="bg-slate-850 p-2.5 rounded-3xl border border-slate-750 flex items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTopTab('MY_TOURNAMENTS');
              setSelectedDeskTourId(null);
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
              topTab === 'MY_TOURNAMENTS'
                ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            My Tournaments
          </button>

          <button
            onClick={() => {
              setTopTab('EARNINGS');
              setSelectedDeskTourId(null);
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
              topTab === 'EARNINGS'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-900 text-emerald-400 hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Earnings
          </button>
        </div>

        {selectedDeskTourId && topTab === 'MY_TOURNAMENTS' && (
          <button
            onClick={() => setSelectedDeskTourId(null)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-bold rounded-xl flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> List
          </button>
        )}
      </div>

      {/* =====================================================================
          VIEW EARNINGS: ORGANIZER FINANCIAL SUMMARY & WITHDRAWALS
          ===================================================================== */}
      {topTab === 'EARNINGS' && (
        <OrganizerEarningsView user={user} showToast={showToast} />
      )}

      {/* =====================================================================
          VIEW A: MY TOURNAMENTS LIST (When no desk is opened or topTab = MY_TOURNAMENTS)
          ===================================================================== */}
      {topTab === 'MY_TOURNAMENTS' && !selectedDeskTourId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Trophy className="w-4.5 h-4.5 text-sky-400" />
                My Created Tournaments ({tournaments.length})
              </h2>
              <p className="text-[11px] text-slate-400">Select a tournament to open its Manager Desk</p>
            </div>
            <button
              onClick={() => {
                setTopTab('CREATE_NEW');
                setFormName('');
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Create New
            </button>
          </div>

          {tournaments.length === 0 ? (
            <div className="p-8 text-center bg-slate-850 border border-slate-750 rounded-3xl space-y-3">
              <Trophy className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">You haven't created any tournaments yet.</p>
              <button
                onClick={() => {
                  setTopTab('CREATE_NEW');
                  setFormName('');
                }}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-black text-xs rounded-xl"
              >
                + Create First Tournament
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {[
                {
                  title: 'Pending Approval',
                  badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
                  items: tournaments.filter((t) => !t.isApproved),
                },
                {
                  title: 'Registration Open',
                  badgeColor: 'border-sky-500/30 text-sky-300 bg-sky-500/10',
                  items: tournaments.filter(
                    (t) => (t.status === 'Registration Open' || t.status === 'Upcoming') && t.isApproved
                  ),
                },
                {
                  title: 'Ongoing',
                  badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
                  items: tournaments.filter(
                    (t) => (t.status === 'Ongoing' || t.status === 'Live') && t.isApproved
                  ),
                },
                {
                  title: 'Finished',
                  badgeColor: 'border-slate-700 text-slate-400 bg-slate-800/50',
                  items: tournaments.filter(
                    (t) => (t.status === 'Finished' || t.status === 'Completed') && t.isApproved
                  ),
                },
              ]
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.title} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <span>{group.title}</span>
                        <span className={`px-2 py-0.5 text-[10px] rounded-full border ${group.badgeColor}`}>
                          {group.items.length}
                        </span>
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {group.items.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => handleOpenManagerDesk(t.id)}
                          className="bg-slate-850 border border-slate-750 hover:border-sky-500/50 rounded-3xl overflow-hidden p-3.5 space-y-3 cursor-pointer transition-all shadow-md group"
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={t.image}
                              alt={t.tournamentName}
                              className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-slate-700"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider">
                                  {t.game}
                                </span>

                                {/* Status Badge */}
                                {!t.isApproved ? (
                                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-extrabold text-[10px] rounded-full border border-amber-500/30">
                                    Pending Approval
                                  </span>
                                ) : t.status === 'Ongoing' || t.status === 'Live' ? (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] rounded-full border border-emerald-500/30">
                                    Ongoing
                                  </span>
                                ) : t.status === 'Completed' || t.status === 'Finished' ? (
                                  <span className="px-2 py-0.5 bg-slate-800 text-slate-400 font-extrabold text-[10px] rounded-full">
                                    Finished
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 font-extrabold text-[10px] rounded-full border border-sky-500/30">
                                    Registration Open
                                  </span>
                                )}
                              </div>

                              <h3 className="font-black text-white text-sm truncate mt-0.5 group-hover:text-sky-300 transition-colors">
                                {t.tournamentName}
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-sky-400" /> {t.date}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-rose-400" /> {t.venueName || 'Venue'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {(() => {
                            const registeredPlayersCount = db.getTournamentPlayers(t.id).length;
                            const isRegistrationOpen = t.status === 'Registration Open' || t.status === 'Upcoming';
                            const canDelete = isRegistrationOpen && registeredPlayersCount === 0;

                            return (
                              <div className="pt-2 border-t border-slate-800 flex flex-col gap-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 font-mono">
                                    Players: <strong className="text-white">{registeredPlayersCount}</strong> / {t.maxPlayers}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      disabled={!canDelete}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!canDelete) {
                                          if (registeredPlayersCount > 0) {
                                            showToast('This tournament cannot be deleted because players have already registered.', 'error');
                                          } else {
                                            showToast('This tournament cannot be deleted unless status is Registration Open.', 'error');
                                          }
                                          return;
                                        }
                                        if (window.confirm(`Are you sure you want to permanently delete your tournament "${t.tournamentName}"?`)) {
                                          db.deleteTournament(t.id);
                                        }
                                      }}
                                      className={`p-1.5 rounded-xl border transition-all ${
                                        canDelete
                                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 active:scale-95'
                                          : 'bg-slate-800/40 text-slate-600 border-slate-800/80 cursor-not-allowed opacity-50'
                                      }`}
                                      title={
                                        registeredPlayersCount > 0
                                          ? 'This tournament cannot be deleted because players have already registered.'
                                          : !isRegistrationOpen
                                          ? 'This tournament cannot be deleted unless status is Registration Open.'
                                          : 'Delete Tournament'
                                      }
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    <span className="text-sky-400 font-black flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                      Open Manager Desk <ChevronRight className="w-4 h-4" />
                                    </span>
                                  </div>
                                </div>
                                {registeredPlayersCount > 0 && (
                                  <p className="text-[10px] text-rose-400/90 font-medium italic text-right">
                                    This tournament cannot be deleted because players have already registered.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VIEW B: CREATE NEW TOURNAMENT FORM (When topTab = CREATE_NEW)
          ===================================================================== */}
      {topTab === 'CREATE_NEW' && (
        <div className="bg-slate-850 border border-slate-750 rounded-3xl p-4 sm:p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-750 pb-3">
            <h2 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Plus className="w-4.5 h-4.5 text-amber-400" />
              Create New Tournament
            </h2>
            <button
              onClick={() => setTopTab('MY_TOURNAMENTS')}
              className="text-xs text-slate-400 hover:text-white font-bold"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateNewTournament} className="space-y-4 text-xs font-medium">
            {/* Tournament Banner Upload Field */}
            <div className="space-y-2 p-3 bg-slate-900 border border-slate-750 rounded-2xl">
              <label className="text-amber-400 font-bold flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Tournament Banner Image
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-48 h-24 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shrink-0">
                  <img
                    src={customBannerUpload || formImage || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'}
                    alt="Tournament Banner Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded-full">
                      Preview
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <p className="text-[11px] text-slate-300">
                    Upload a custom banner image for your tournament card. (Recommended 16:9 aspect ratio)
                  </p>
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl cursor-pointer text-xs transition-all shadow-sm active:scale-95">
                    <Zap className="w-3.5 h-3.5" />
                    Upload Custom Banner
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tournament Name */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold">Tournament Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Nexus eFootball Champions League"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-semibold focus:outline-hidden focus:border-amber-400"
                  required
                />
              </div>

              {/* Game Title */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold">Game Title</label>
                <input
                  type="text"
                  value={formGame}
                  onChange={(e) => setFormGame(e.target.value)}
                  placeholder="e.g. eFootball 2026, EA FC 26, Tekken 8"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-semibold focus:outline-hidden focus:border-amber-400"
                  required
                />
              </div>

              {/* Date & Time */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold">Event Date & Time</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-400"
                  />
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Entry Fee */}
              <div className="space-y-1">
                <label className="text-amber-300 font-bold">Registration Entry Fee</label>
                <input
                  type="text"
                  value={formFee}
                  onChange={(e) => setFormFee(e.target.value)}
                  placeholder="Fee (e.g. 50 ETB or Free)"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-hidden focus:border-amber-400"
                  required
                />
              </div>

              {/* Tournament Award (Optional) */}
              <div className="space-y-1">
                <label className="text-amber-300 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" /> Tournament Award (Optional)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Free text (e.g. 1,000 ETB, Trophy, Medal)</span>
                </label>
                <input
                  type="text"
                  value={formAward}
                  onChange={(e) => setFormAward(e.target.value)}
                  placeholder="e.g. 1,000 ETB, Champion Trophy, Gaming Keyboard (Optional)"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-medium focus:outline-hidden focus:border-amber-400 text-sm"
                />
              </div>

              {/* Organizer Phone Number (Requirement 2) */}
              <div className="space-y-1">
                <label className="text-emerald-400 font-bold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Organizer Phone Number
                </label>
                <input
                  type="text"
                  value={formTelebirr}
                  onChange={(e) => setFormTelebirr(e.target.value)}
                  placeholder="e.g. 0911223344"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold focus:outline-hidden focus:border-emerald-400"
                  required
                />
              </div>

              {/* Gamezone Venue Name & Location (Requirement 4) */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold">Gamezone / Venue Name</label>
                <input
                  type="text"
                  value={formVenue}
                  onChange={(e) => setFormVenue(e.target.value)}
                  placeholder="e.g. Nexus Gaming Hub"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-semibold focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" /> Gamezone Location
                </label>
                <input
                  type="text"
                  value={formVenueLocation}
                  onChange={(e) => setFormVenueLocation(e.target.value)}
                  placeholder="e.g. Bole Medhanialem, Building 3, 2nd Floor"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-semibold focus:outline-hidden focus:border-amber-400"
                />
              </div>

              {/* Max Players & Reg Deadline */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold">Max Players & Registration Deadline</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={formMaxPlayers}
                    onChange={(e) => setFormMaxPlayers(Number(e.target.value))}
                    placeholder="Max Players"
                    min={2}
                    max={256}
                    className="bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={formRegDeadline}
                    onChange={(e) => setFormRegDeadline(e.target.value)}
                    placeholder="Deadline (YYYY-MM-DD)"
                    className="bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Number of Rounds */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold">Number of Rounds</label>
                <input
                  type="number"
                  value={formMaxRounds}
                  onChange={(e) => setFormMaxRounds(Number(e.target.value))}
                  min={1}
                  max={20}
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-hidden focus:border-amber-400"
                />
              </div>

              {/* Performance Label */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold">Performance Label (Stat Column)</label>
                <input
                  type="text"
                  value={formPerformanceLabel}
                  onChange={(e) => setFormPerformanceLabel(e.target.value)}
                  placeholder="e.g. Goals, Kills, Points"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-400 font-bold"
                />
              </div>

              {/* Session Label */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold">Session Label (Match Units)</label>
                <input
                  type="text"
                  value={formSessionLabel}
                  onChange={(e) => setFormSessionLabel(e.target.value)}
                  placeholder="e.g. Match, Lobby, Session"
                  className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-amber-400 font-bold"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
              >
                <Save className="w-4 h-4" /> Create Tournament
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          VIEW C: TOURNAMENT MANAGER DESK (When topTab = MY_TOURNAMENTS & activeTournament selected)
          ===================================================================== */}
      {topTab === 'MY_TOURNAMENTS' && activeTournament && (
        isTourCompleted ? (
          <CompletedTournamentViewPage
            tournament={activeTournament}
            onBack={() => setSelectedDeskTourId(null)}
          />
        ) : (
          <div className="space-y-4">
          {/* Header for Selected Tournament */}
          <div className="bg-slate-850 p-4 rounded-3xl border border-slate-750 space-y-3 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <button
                  onClick={() => setSelectedDeskTourId(null)}
                  className="text-[10px] font-bold text-sky-400 hover:underline flex items-center gap-1 mb-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to My Tournaments List
                </button>
                <h1 className="text-base font-black text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {activeTournament.tournamentName}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                {!activeTournament.isApproved ? (
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 font-black text-xs rounded-full border border-amber-500/30">
                    Pending Admin Approval
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-black text-xs rounded-full border border-emerald-500/30">
                    {activeTournament.status}
                  </span>
                )}
              </div>
            </div>

            {/* THREE MAIN DESK TABS */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-black">
              <button
                onClick={() => setActiveMainTab('MANAGE_TOURNAMENT')}
                className={`py-2 px-2 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${
                  activeMainTab === 'MANAGE_TOURNAMENT'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  <span className="truncate">EDIT</span>
                </div>
                {(isTourOngoing || isTourCompleted) && (
                  <span className="text-[9px] font-bold opacity-80">(View Only)</span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveMainTab('MANAGE_STANDINGS');
                  initializeFinalRows();
                }}
                className={`py-2 px-2 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${
                  activeMainTab === 'MANAGE_STANDINGS'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  <span className="truncate">STANDINGS</span>
                </div>
                {isTourOngoing && (
                  <span className="text-[9px] font-bold opacity-80">(Editable)</span>
                )}
              </button>

              <button
                onClick={() => setActiveMainTab('MANAGE_MATCHES')}
                className={`py-2 px-2 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${
                  activeMainTab === 'MANAGE_MATCHES'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5" />
                  <span className="truncate">MATCHES</span>
                </div>
                {isTourOngoing && (
                  <span className="text-[9px] font-bold opacity-80">(Editable)</span>
                )}
              </button>
            </div>
          </div>

          {/* DESK TAB 1: MANAGE TOURNAMENT */}
          {activeMainTab === 'MANAGE_TOURNAMENT' && (
            <div className="space-y-4">
              {/* Configuration Form */}
              <div className="bg-slate-850 border border-slate-750 rounded-3xl p-4 sm:p-5 space-y-4 shadow-md">
                <h3 className="font-extrabold text-white text-sm flex items-center gap-2 border-b border-slate-750 pb-2">
                  <Settings className="w-4 h-4 text-amber-400" />
                  Edit Tournament Configuration
                </h3>

                {isTourOngoing && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>This tournament is Ongoing (Live Matches). Configuration is view-only and locked.</span>
                  </div>
                )}

                {isTourCompleted && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center gap-2 text-xs font-bold text-purple-300">
                    <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>This tournament is Completed. Configuration is read-only and locked.</span>
                  </div>
                )}

                <form onSubmit={handleSaveTournament} className="space-y-4 text-xs font-medium">
                  <fieldset disabled={isTourOngoing || isTourCompleted} className="space-y-4 disabled:opacity-80">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold">Tournament Name</label>
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-semibold focus:outline-hidden focus:border-amber-400"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold">Game Title</label>
                        <input
                          type="text"
                          value={formGame}
                          onChange={(e) => setFormGame(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-semibold focus:outline-hidden focus:border-amber-400"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold">Event Date & Time</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={formDate}
                            onChange={(e) => setFormDate(e.target.value)}
                            className="bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white"
                          />
                          <input
                            type="time"
                            value={formTime}
                            onChange={(e) => setFormTime(e.target.value)}
                            className="bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white"
                          />
                        </div>
                      </div>

                      {/* Banner Image Upload */}
                      <div className="space-y-2 p-3 bg-slate-900 border border-slate-750 rounded-2xl">
                        <label className="text-amber-400 font-bold flex items-center gap-1.5 text-xs">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          Update Tournament Banner Image
                        </label>
                        <div className="flex items-center gap-3">
                          <img
                            src={customBannerUpload || formImage || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800'}
                            alt="Banner Preview"
                            className="w-24 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                          <label className={`px-3 py-1.5 text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-sm ${
                            isTourOngoing || isTourCompleted
                              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-400 cursor-pointer'
                          }`}>
                            Upload New Banner
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleBannerFileChange}
                              className="hidden"
                              disabled={isTourOngoing || isTourCompleted}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-amber-300 font-bold">Registration Entry Fee</label>
                        <input
                          type="text"
                          value={formFee}
                          onChange={(e) => setFormFee(e.target.value)}
                          placeholder="Fee (e.g. 50 ETB or Free)"
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-amber-300 font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-amber-300 font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-amber-400" /> Tournament Award (Optional)
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">Free text (e.g. 1,000 ETB, Trophy, Medal)</span>
                        </label>
                        <input
                          type="text"
                          value={formAward}
                          onChange={(e) => setFormAward(e.target.value)}
                          placeholder="e.g. 1,000 ETB, Champion Trophy, Gaming Keyboard (Optional)"
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-medium text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-emerald-400 font-bold">Phone Number</label>
                        <input
                          type="text"
                          value={formTelebirr}
                          onChange={(e) => setFormTelebirr(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold">Gamezone / Venue Name</label>
                        <input
                          type="text"
                          value={formVenue}
                          onChange={(e) => setFormVenue(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-semibold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-400 font-bold">Gamezone Location</label>
                        <input
                          type="text"
                          value={formVenueLocation}
                          onChange={(e) => setFormVenueLocation(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-semibold"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-slate-400 font-bold">Tournament Status</label>
                        <select
                          value={isTourCompleted ? 'Completed' : formStatus}
                          disabled={isTourOngoing || isTourCompleted}
                          onChange={(e) => setFormStatus(e.target.value as TournamentStatus)}
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-amber-400 font-black cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {!isTourOngoing && !isTourCompleted && (
                            <option value="Registration Open">Registration Open</option>
                          )}
                          <option value="Ongoing">Ongoing (Live Matches)</option>
                          {isTourCompleted && (
                            <option value="Completed" disabled>Completed (Finished)</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </fieldset>

                  {!isTourOngoing && !isTourCompleted && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <Save className="w-4 h-4" /> Save Configuration
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* PLAYER MANAGEMENT SECTION (Requirement 3) */}
              <div className="bg-slate-850 border border-slate-750 rounded-3xl p-4 sm:p-5 space-y-4 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-750 pb-3">
                  <div>
                    <h3 className="font-extrabold text-white text-sm flex items-center gap-2 capitalize">
                      <Users className="w-4 h-4 text-sky-400" />
                      players ({db.getTournamentPlayers(activeTournament.id).length} / {activeTournament.maxPlayers})
                    </h3>
                    <p className="text-[11px] text-slate-400">View registered player roster, payment approval status & verify codes</p>
                  </div>

                  <button
                    onClick={() => setInviteModalTour(activeTournament)}
                    className="px-3 py-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center gap-1 hover:bg-amber-500/20 transition-colors shrink-0"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Invite Link
                  </button>
                </div>

                {/* Organizer Code Check-In Box (Requirement 3) */}
                <div className="p-3.5 bg-slate-900 border border-sky-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-sky-300">
                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                    <span>Code Verification</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Enter a player's Code (e.g. <span className="font-mono text-amber-300 font-bold">SG-1001</span>) to verify attendance:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={checkInCodeInput}
                      onChange={(e) => setCheckInCodeInput(e.target.value)}
                      placeholder="Enter Player Code..."
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold uppercase flex-1 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={async () => {
                        if (!checkInCodeInput.trim()) return;
                        const players = db.getTournamentPlayers(activeTournament.id);
                        const cleanInput = checkInCodeInput.trim().replace(/^SG-/, '');
                        const matchingPlayer = players.find(
                          (p) =>
                            p.checkInCode === checkInCodeInput.trim() ||
                            p.checkInCode.replace(/^SG-/, '') === cleanInput
                        );

                        if (matchingPlayer) {
                          setPendingCheckInPlayer({
                            tp: matchingPlayer,
                            userObj: matchingPlayer.user || db.getUserById(matchingPlayer.userId),
                            codeInput: checkInCodeInput.trim(),
                          });
                        } else {
                          showToast('Invalid or unrecognized Code.', 'error');
                        }
                      }}
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
                    >
                      Verify Code
                    </button>
                  </div>
                </div>



                {/* Player Roster List */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 block px-1">Registered Player Roster (Click player for full profile):</span>
                  {db.getTournamentPlayers(activeTournament.id).length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6 bg-slate-900 rounded-2xl">
                      No players registered for this tournament yet.
                    </p>
                  ) : (
                    db.getTournamentPlayers(activeTournament.id).map((tp) => (
                      <div
                        key={tp.userId}
                        onClick={() => {
                          const userObj = tp.user || db.getUserById(tp.userId);
                          if (userObj) setSelectedUserForDetail(userObj);
                        }}
                        className="p-3.5 bg-slate-900 hover:bg-slate-850 rounded-2xl border border-slate-800 hover:border-sky-500/40 flex flex-col gap-3 text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={tp.user?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-white hover:text-sky-300 transition-colors">{tp.user?.name || tp.userId}</h4>
                                <span className="text-[10px] text-sky-400 font-mono">@{tp.user?.gamertag || 'gamer'}</span>
                                {tp.user?.teamName && (
                                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 font-bold text-[10px] rounded-full border border-amber-500/20">
                                    {tp.user.teamName}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Code: <span className="font-mono text-amber-300 font-extrabold">{tp.checkInCode.replace(/^SG-/, '')}</span>
                              </p>
                            </div>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              tp.playerStatus === 'Checked In'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {tp.playerStatus}
                          </span>
                        </div>

                        {/* Payment Verification & Actions Row */}
                        <div className="pt-2 border-t border-slate-850 flex flex-wrap items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                          {/* Payment status badge */}
                          <div className="flex items-center gap-2">
                            {tp.paymentStatus === 'PENDING_APPROVAL' && (
                              <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                <Clock className="w-3 h-3" /> Pending Admin Approval
                              </span>
                            )}

                            {tp.paymentStatus === 'CONFIRMED' && (
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Payment Approved
                              </span>
                            )}

                            {tp.paymentStatus === 'REJECTED' && (
                              <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                <AlertCircle className="w-3 h-3" /> Payment Rejected
                              </span>
                            )}

                            {(!tp.paymentStatus || (tp.paymentStatus as string) === 'UNPAID') && (
                              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                Unpaid
                              </span>
                            )}
                          </div>

                          {/* Check-In & Remove Actions */}
                          <div className="flex items-center gap-2">
                            {(() => {
                              const isApprovedByAdmin = tp.paymentStatus === 'CONFIRMED';
                              const isCheckedIn = tp.playerStatus === 'Checked In';
                              const isLocked = isTourOngoing || isTourCompleted;

                              return (
                                <button
                                  disabled={isLocked || (!isCheckedIn && !isApprovedByAdmin)}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (isLocked) {
                                      showToast('Cannot change check-in status after tournament has started.', 'error');
                                      return;
                                    }
                                    if (!isCheckedIn && !isApprovedByAdmin) {
                                      showToast('Player registration must first be approved by the Admin before check-in.', 'error');
                                      return;
                                    }
                                    const newStatus: PlayerStatus = isCheckedIn ? 'Registered' : 'Checked In';
                                    await db.updatePlayerStatus(activeTournament.id, tp.userId, newStatus);
                                    showToast(newStatus === 'Checked In' ? 'Player Marked Checked-In!' : 'Check-in reset');
                                  }}
                                  className={`px-3 py-1 rounded-lg font-black text-[10px] uppercase transition-all ${
                                    isLocked
                                      ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed border border-slate-750/60 opacity-60'
                                      : isCheckedIn
                                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                                      : isApprovedByAdmin
                                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                                      : 'bg-slate-800/40 text-slate-500 cursor-not-allowed border border-slate-750/60 opacity-60'
                                  }`}
                                  title={
                                    isLocked
                                      ? 'Check-in status is locked after tournament has started.'
                                      : !isCheckedIn && !isApprovedByAdmin
                                      ? 'Player registration must first be approved by the Admin before check-in.'
                                      : ''
                                  }
                                >
                                  {isCheckedIn ? 'Checked In ✓' : isLocked ? 'Locked' : 'Mark Checked-In'}
                                </button>
                              );
                            })()}

                            {!isTourOngoing && !isTourCompleted && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`Remove ${tp.user?.name || 'player'} from tournament?`)) {
                                    await db.removePlayerFromTournament(activeTournament.id, tp.userId);
                                    showToast('Player removed from tournament');
                                  }
                                }}
                                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg font-bold text-[10px]"
                                title="Remove player"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DESK TAB 2: MANAGE STANDINGS */}
          {activeMainTab === 'MANAGE_STANDINGS' && (
            <div className="space-y-4">
              {isTourRegistrationOpen ? (
                <div className="p-8 text-center bg-slate-850 border border-slate-750 rounded-3xl space-y-3 shadow-md">
                  <Lock className="w-10 h-10 text-amber-400 mx-auto" />
                  <h3 className="text-base font-extrabold text-white">Standings Locked</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Standings management becomes available after the tournament status is set to Ongoing.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-850 border border-slate-750 rounded-3xl p-4 sm:p-5 space-y-4 shadow-md">
                  {isTourCompleted && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center gap-2 text-xs font-bold text-purple-300">
                      <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>This tournament is Completed. Standings are locked and read-only.</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-b border-slate-750 pb-3">
                  <div className="flex gap-2 bg-slate-900 p-1 rounded-xl">
                    <button
                      onClick={() => setStandingsSubTab('ROUNDS')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        standingsSubTab === 'ROUNDS' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
                      }`}
                    >
                      Round Groups & Standings
                    </button>
                    <button
                      onClick={() => {
                        setStandingsSubTab('FINAL_RESULT');
                        initializeFinalRows();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        standingsSubTab === 'FINAL_RESULT' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
                      }`}
                    >
                      Final Results
                    </button>
                  </div>
                </div>

                {standingsSubTab === 'ROUNDS' ? (
                  <div className="space-y-4">
                    {/* Round Selector */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      <span className="text-xs font-bold text-slate-400 shrink-0">Round:</span>
                      {Array.from({ length: activeTournament.maxRounds || 3 }, (_, i) => i + 1).map((r) => (
                        <button
                          key={r}
                          onClick={() => setSelectedStandingsRound(r)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all ${
                            selectedStandingsRound === r
                              ? 'bg-sky-500 text-slate-950 shadow-md'
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          Round {r}
                        </button>
                      ))}
                    </div>

                    {/* Create Group Box */}
                    <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-2">
                      <input
                        type="text"
                        value={newGroupNameInput}
                        onChange={(e) => setNewGroupNameInput(e.target.value)}
                        placeholder={`Group Name e.g. Group A (Round ${selectedStandingsRound})`}
                        className="bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white font-medium flex-1"
                      />
                      <button
                        onClick={handleAddGroupInRound}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md shrink-0"
                      >
                        + Create Group
                      </button>
                    </div>

                    {/* Groups List */}
                    {(() => {
                      const groups = db.getTournamentGroups(activeTournament.id).filter((g) => g.roundNumber === selectedStandingsRound);
                      if (groups.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800 text-xs">
                            No groups created for Round {selectedStandingsRound} yet. Click "+ Create Group" above.
                          </div>
                        );
                      }

                      const registeredPlayers = db.getTournamentPlayers(activeTournament.id);

                      return groups.map((grp) => {
                        const standings = db.getGroupStandingsWithAccumulated(activeTournament.id, grp.id);

                        return (
                          <div key={grp.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="font-black text-amber-300 text-xs">{grp.groupName}</span>
                              <button
                                onClick={async () => {
                                  if (confirm(`Delete ${grp.groupName}?`)) {
                                    await db.deleteGroup(grp.id);
                                    showToast('Group deleted');
                                  }
                                }}
                                className="text-slate-500 hover:text-rose-400 text-xs"
                              >
                                Delete Group
                              </button>
                            </div>

                            {/* Player Assignment checkboxes */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold block">Assign Registered Players to {grp.groupName}:</span>
                              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-850 rounded-xl border border-slate-800 text-xs">
                                {registeredPlayers.map((tp) => {
                                  const isAssigned = grp.playerIds.includes(tp.userId);
                                  return (
                                    <button
                                      key={tp.userId}
                                      onClick={() => handleTogglePlayerInGroup(grp.id, tp.userId, grp)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                        isAssigned
                                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                      }`}
                                    >
                                      {isAssigned ? '✓ ' : '+ '}
                                      {tp.user?.name || tp.userId}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Group Standings Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                                  <tr>
                                    <th className="p-2">Rank</th>
                                    <th className="p-2">Player</th>
                                    <th className="p-2 text-center">Points</th>
                                    <th className="p-2 text-center">{activeTournament.performanceLabel || 'Goals'}</th>
                                    <th className="p-2 text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                  {standings.map((st) => (
                                    <tr key={st.userId} className="hover:bg-slate-800/30">
                                      <td className="p-2 font-mono font-bold text-amber-400">#{st.rank}</td>
                                      <td className="p-2 font-bold text-white flex items-center gap-2">
                                        <img
                                          src={st.user?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                          alt=""
                                          className="w-5 h-5 rounded-full object-cover"
                                        />
                                        <span>{st.user?.name || st.userId}</span>
                                      </td>
                                      <td className="p-2 text-center font-black font-mono text-amber-300">{st.points}</td>
                                      <td className="p-2 text-center font-mono text-slate-300">{st.performance}</td>
                                      <td className="p-2 text-right">
                                        <select
                                          value={st.status}
                                          onChange={(e) =>
                                            handleUpdatePlayerStatusInGroup(
                                              grp.id,
                                              st.userId,
                                              grp,
                                              e.target.value as any
                                            )
                                          }
                                          className="bg-slate-950 border border-slate-750 text-[10px] font-bold rounded px-1.5 py-0.5 text-amber-300"
                                        >
                                          <option value="Waiting">Waiting</option>
                                          <option value="Qualified">Qualified</option>
                                          <option value="Eliminated">Eliminated</option>
                                          <option value="Champion">Champion</option>
                                        </select>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  /* MANUAL FINAL RESULTS EDITOR */
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="font-extrabold text-white text-xs">Final Results Draft Editor</h4>
                        <p className="text-[10px] text-slate-400">
                          Manually build and organize final standings. Click 'Publish Final Results' to make visible to players.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowPublishConfirmModal(true)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all active:scale-95"
                      >
                        Publish Final Results
                      </button>
                    </div>

                    {/* Add Player Bar */}
                    {(() => {
                      const registeredPlayers = db.getTournamentPlayers(activeTournament.id);
                      const availablePlayers = registeredPlayers.filter(
                        (tp) => !finalRows.some((fr) => fr.userId === tp.userId)
                      );

                      return (
                        <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-2">
                          <select
                            value={selectedPlayerForFinals}
                            onChange={(e) => setSelectedPlayerForFinals(e.target.value)}
                            className="bg-slate-850 border border-slate-750 text-xs font-bold text-white rounded-xl px-3 py-2 flex-1 min-w-[200px]"
                          >
                            <option value="">-- Select Registered Player to Add --</option>
                            {availablePlayers.map((tp) => (
                              <option key={tp.userId} value={tp.userId}>
                                {tp.user?.name || tp.userId} {tp.user?.gamertag ? `(${tp.user.gamertag})` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handleAddPlayerToFinals}
                            disabled={!selectedPlayerForFinals}
                            className="px-4 py-2 bg-emerald-500 disabled:opacity-40 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md flex items-center gap-1 shrink-0"
                          >
                            <Plus className="w-4 h-4 font-black" /> Add Player
                          </button>
                        </div>
                      );
                    })()}

                    {/* Standings Table Editor */}
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto">
                      {finalRows.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-xs font-bold">
                          No players in Final Results yet. Select a player above and click "+ Add Player".
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs min-w-[550px]">
                          <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                            <tr>
                              <th className="p-2.5">Rank</th>
                              <th className="p-2.5 text-center">Order</th>
                              <th className="p-2.5">Player</th>
                              <th className="p-2.5 text-center">Points</th>
                              <th className="p-2.5 text-center">{activeTournament.performanceLabel || 'Goals/Kills'}</th>
                              <th className="p-2.5 text-center">Badge / Title</th>
                              <th className="p-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {finalRows.map((r, idx) => {
                              const u = db.getUserById(r.userId);
                              return (
                                <tr key={r.userId} className="hover:bg-slate-850/50 transition-colors">
                                  <td className="p-2.5 font-bold font-mono text-amber-400 text-center w-12">
                                    #{idx + 1}
                                  </td>
                                  <td className="p-2.5 text-center w-16">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => handleMoveFinalRow(idx, 'up')}
                                        disabled={idx === 0}
                                        className="p-1 text-slate-400 hover:text-amber-400 disabled:opacity-20 font-black"
                                        title="Move Up"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        onClick={() => handleMoveFinalRow(idx, 'down')}
                                        disabled={idx === finalRows.length - 1}
                                        className="p-1 text-slate-400 hover:text-amber-400 disabled:opacity-20 font-black"
                                        title="Move Down"
                                      >
                                        ▼
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-2.5 font-bold text-white flex items-center gap-2 min-w-[140px]">
                                    <img
                                      src={u?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                      alt=""
                                      className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-700"
                                    />
                                    <span className="truncate">{u?.name || u?.gamertag || r.userId}</span>
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <input
                                      type="number"
                                      value={r.points}
                                      onChange={(e) => {
                                        const updated = [...finalRows];
                                        updated[idx].points = Number(e.target.value);
                                        setFinalRows(updated);
                                      }}
                                      className="bg-slate-850 border border-slate-750 text-xs font-mono font-bold text-amber-300 rounded px-2 py-1 text-center w-16"
                                    />
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <input
                                      type="number"
                                      value={r.performance}
                                      onChange={(e) => {
                                        const updated = [...finalRows];
                                        updated[idx].performance = Number(e.target.value);
                                        setFinalRows(updated);
                                      }}
                                      className="bg-slate-850 border border-slate-750 text-xs font-mono text-slate-200 rounded px-2 py-1 text-center w-16"
                                    />
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <input
                                      type="text"
                                      value={r.badge || ''}
                                      onChange={(e) => {
                                        const updated = [...finalRows];
                                        updated[idx].badge = e.target.value;
                                        setFinalRows(updated);
                                      }}
                                      placeholder="e.g. Champion"
                                      className="bg-slate-850 border border-slate-750 text-[11px] font-bold text-amber-300 rounded px-2 py-1 text-center w-28"
                                    />
                                  </td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      onClick={() => handleRemoveFinalRow(idx)}
                                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs"
                                      title="Remove from Final Results"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* DESK TAB 3: MANAGE MATCHES */}
          {activeMainTab === 'MANAGE_MATCHES' && (
            <div className="space-y-4">
              {isTourRegistrationOpen ? (
                <div className="p-8 text-center bg-slate-850 border border-slate-750 rounded-3xl space-y-3 shadow-md">
                  <Lock className="w-10 h-10 text-purple-400 mx-auto" />
                  <h3 className="text-base font-extrabold text-white">Matches Locked</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Matches management becomes available after the tournament status is set to Ongoing.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-850 border border-slate-750 rounded-3xl p-4 sm:p-5 space-y-4 shadow-md">
                  {isTourCompleted && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center gap-2 text-xs font-bold text-purple-300">
                      <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>This tournament is Completed. Match records are locked and read-only.</span>
                    </div>
                  )}
                  {/* Round Selector */}
                <div className="flex items-center justify-between border-b border-slate-750 pb-3">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="text-xs font-bold text-slate-400 shrink-0">Round:</span>
                    {Array.from({ length: activeTournament.maxRounds || 3 }, (_, i) => i + 1).map((r) => (
                      <button
                        key={r}
                        onClick={() => setSelectedMatchRound(r)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all ${
                          selectedMatchRound === r
                            ? 'bg-sky-500 text-slate-950 shadow-md'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        Round {r}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSessionNameInput}
                      onChange={(e) => setNewSessionNameInput(e.target.value)}
                      placeholder={`${activeTournament.sessionLabel || 'Match'} Name`}
                      className="bg-slate-900 border border-slate-750 text-xs font-medium text-white px-3 py-1.5 rounded-xl w-36"
                    />
                    <button
                      onClick={handleCreateNewSession}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md shrink-0"
                    >
                      + Create {activeTournament.sessionLabel || 'Match'}
                    </button>
                  </div>
                </div>

                {/* Sessions List */}
                {(() => {
                  const sessions = db.getTournamentSessions(activeTournament.id).filter((s) => s.roundNumber === selectedMatchRound);
                  if (sessions.length === 0) {
                    return (
                      <div className="p-8 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800 text-xs">
                        No {activeTournament.sessionLabel?.toLowerCase() || 'match'} sessions created for Round {selectedMatchRound}. Click "+ Create" above.
                      </div>
                    );
                  }

                  const registeredPlayers = db.getTournamentPlayers(activeTournament.id);

                  return sessions.map((sess, idx) => (
                    <div key={sess.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-extrabold text-sky-400 text-xs">
                          {sess.name || `${activeTournament.sessionLabel || 'Match'} #${idx + 1}`} (Round {selectedMatchRound})
                        </span>
                        <button
                          onClick={async () => {
                            if (confirm('Delete this session?')) {
                              await db.deleteSession(sess.id);
                              showToast('Session deleted');
                            }
                          }}
                          className="text-slate-500 hover:text-rose-400 text-xs"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Add player to session */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">Add Competitors to this session:</span>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-850 rounded-xl border border-slate-800 text-xs max-h-24 overflow-y-auto">
                          {registeredPlayers.map((tp) => {
                            const isAdded = sess.scores.some((sc) => sc.userId === tp.userId);
                            return (
                              <button
                                key={tp.userId}
                                onClick={async () => {
                                  if (isAdded) {
                                    await db.removePlayerFromSession(sess.id, tp.userId);
                                  } else {
                                    await db.addPlayerToSession(sess.id, tp.userId);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                  isAdded
                                    ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {isAdded ? '✓ ' : '+ '}
                                {tp.user?.name || tp.userId}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Score inputs for session */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                            <tr>
                              <th className="p-2.5">Player</th>
                              <th className="p-2.5 text-center">Points</th>
                              <th className="p-2.5 text-center">{activeTournament.performanceLabel || 'Goals'}</th>
                              <th className="p-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50 font-medium">
                            {sess.scores.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-4 text-center text-slate-500 text-xs">
                                  No players added to this match session yet.
                                </td>
                              </tr>
                            ) : (
                              sess.scores.map((sc) => {
                                const userObj = db.getUserById(sc.userId);
                                const currentScoreInput = handleGetScoreInput(sess.id, sc.userId, sc.points, sc.performance);

                                return (
                                  <tr key={sc.userId} className="hover:bg-slate-800/40">
                                    <td className="p-2.5 font-bold text-white flex items-center gap-2">
                                      <img
                                        src={userObj?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                        alt=""
                                        className="w-6 h-6 rounded-full object-cover"
                                      />
                                      <span>{userObj?.name || sc.userId}</span>
                                    </td>

                                    <td className="p-2.5 text-center">
                                      <input
                                        type="number"
                                        value={currentScoreInput.points}
                                        onChange={(e) =>
                                          handleSetScoreInput(sess.id, sc.userId, 'points', Number(e.target.value))
                                        }
                                        className="w-20 bg-slate-950 border border-slate-750 text-center font-black text-amber-400 text-sm rounded-xl p-1 focus:outline-hidden focus:border-amber-400"
                                      />
                                    </td>

                                    <td className="p-2.5 text-center">
                                      <input
                                        type="number"
                                        value={currentScoreInput.performance}
                                        onChange={(e) =>
                                          handleSetScoreInput(sess.id, sc.userId, 'performance', Number(e.target.value))
                                        }
                                        className="w-20 bg-slate-950 border border-slate-750 text-center font-black text-sky-400 text-sm rounded-xl p-1 focus:outline-hidden focus:border-amber-400"
                                      />
                                    </td>

                                    <td className="p-2.5 text-right">
                                      <button
                                        onClick={() => handleSavePlayerScoreInSession(sess.id, sc.userId)}
                                        className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all active:scale-95"
                                      >
                                        SAVE
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ));
                })()}
              </div>
              )}
            </div>
          )}
        </div>
        )
      )}

      {/* CREATED SUCCESS MODAL (Requirement 1) */}
      {createdSuccessModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="text-base font-extrabold text-white">Tournament Created!</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Tournament created successfully. Wait for the admin to approve it.
            </p>
            <button
              onClick={() => setCreatedSuccessModalOpen(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md"
            >
              Okay, Got It
            </button>
          </div>
        </div>
      )}

      {/* Invite Modal for Organizers */}
      {inviteModalTour && (
        <InviteModal tournament={inviteModalTour} onClose={() => setInviteModalTour(null)} />
      )}

      {/* PENDING CHECK-IN CONFIRMATION MODAL (Requirement 3) */}
      {pendingCheckInPlayer && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setPendingCheckInPlayer(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <span className="px-2.5 py-0.5 bg-sky-500/20 text-sky-300 text-[10px] font-extrabold rounded-full uppercase border border-sky-500/30">
                Check-In Verification
              </span>
              <h3 className="text-base font-extrabold text-white">Confirm Player Identity</h3>
            </div>

            <div className="flex items-center gap-3 bg-slate-850 p-3.5 rounded-2xl border border-slate-750">
              <img
                src={pendingCheckInPlayer.userObj?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt=""
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-white text-sm truncate">{pendingCheckInPlayer.userObj?.name || 'Player'}</h4>
                <p className="text-xs text-sky-400 font-mono">@{pendingCheckInPlayer.userObj?.username || pendingCheckInPlayer.userObj?.gamertag || 'user'}</p>
                <p className="text-[11px] text-slate-400 font-medium">Gamertag: <strong className="text-slate-200">{pendingCheckInPlayer.userObj?.gamertag || 'N/A'}</strong></p>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Telegram Name:</span>
                <span className="font-bold text-white">@{pendingCheckInPlayer.userObj?.username || pendingCheckInPlayer.userObj?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {pendingCheckInPlayer.userObj?.phoneNumber ||
                   (activeTournament?.telebirrNumber) ||
                   'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Code:</span>
                <span className="font-mono font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {pendingCheckInPlayer.tp.checkInCode.replace(/^SG-/, '')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Registration Status:</span>
                <span className="font-bold text-sky-300">{pendingCheckInPlayer.tp.playerStatus || 'Registered'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Approval:</span>
                <span className={`font-black uppercase ${
                  pendingCheckInPlayer.tp.paymentStatus === 'CONFIRMED'
                    ? 'text-emerald-400'
                    : pendingCheckInPlayer.tp.paymentStatus === 'REJECTED'
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}>
                  {pendingCheckInPlayer.tp.paymentStatus === 'CONFIRMED'
                    ? 'Approved'
                    : pendingCheckInPlayer.tp.paymentStatus === 'REJECTED'
                    ? 'Rejected'
                    : 'Pending Approval'}
                </span>
              </div>
            </div>

            {pendingCheckInPlayer.tp.paymentStatus !== 'CONFIRMED' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs font-semibold space-y-1">
                <p className="font-extrabold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" /> Admin Approval Required
                </p>
                <p className="text-[11px] text-amber-200/90 leading-tight">
                  This player cannot be checked in because their registration must first be approved by the Admin.
                </p>
              </div>
            )}

            <button
              disabled={pendingCheckInPlayer.tp.paymentStatus !== 'CONFIRMED' || isTourOngoing || isTourCompleted}
              onClick={async () => {
                if (!activeTournament) return;
                if (isTourOngoing || isTourCompleted) {
                  showToast('Cannot check in players after the tournament has started.', 'error');
                  return;
                }
                if (pendingCheckInPlayer.tp.paymentStatus !== 'CONFIRMED') {
                  showToast('Player registration must first be approved by the Admin before check-in.', 'error');
                  return;
                }
                const codeToVerify = pendingCheckInPlayer.tp.checkInCode || pendingCheckInPlayer.codeInput;
                const result = await db.verifyCheckInCode(activeTournament.id, codeToVerify);
                if (result.success) {
                  await db.updatePlayerStatus(activeTournament.id, pendingCheckInPlayer.tp.userId, 'Checked In');
                  showToast(`Check-in confirmed for ${pendingCheckInPlayer.userObj?.name || 'player'}!`, 'success');
                  setCheckInCodeInput('');
                } else {
                  showToast(result.message, 'error');
                }
                setPendingCheckInPlayer(null);
              }}
              className={`w-full py-3 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                pendingCheckInPlayer.tp.paymentStatus === 'CONFIRMED' && !isTourOngoing && !isTourCompleted
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-98 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750 opacity-60'
              }`}
            >
              {isTourOngoing || isTourCompleted
                ? 'Tournament Started (Check-In Locked)'
                : pendingCheckInPlayer.tp.paymentStatus === 'CONFIRMED'
                ? '✓ Confirm Check-in'
                : 'Awaiting Admin Payment Approval'}
            </button>
          </div>
        </div>
      )}

      {/* CLICKABLE USER PROFILE DETAIL MODAL (Requirement 3) */}
      {selectedUserForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedUserForDetail(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
            >
              ✕
            </button>

            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <img
                src={selectedUserForDetail.profileImage}
                alt={selectedUserForDetail.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-400"
              />
              <div>
                <h3 className="text-lg font-black text-white">{selectedUserForDetail.name}</h3>
                <span className="inline-block mt-0.5 px-2.5 py-0.5 text-[10px] font-black uppercase rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Role: {selectedUserForDetail.role}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">Rating / ELO</span>
                <span className="font-extrabold text-amber-300 text-sm">{selectedUserForDetail.rating || 1200} ELO</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">Joined Date</span>
                <span className="font-extrabold text-slate-200">
                  {selectedUserForDetail.createdAt ? new Date(selectedUserForDetail.createdAt).toLocaleDateString() : 'Jan 2026'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">Telegram Info</span>
                <span className="font-mono font-bold text-sky-300">
                  @{selectedUserForDetail.username || 'N/A'} (ID: {selectedUserForDetail.telegramUserId})
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">Organizer Phone</span>
                <span className="font-mono font-bold text-emerald-400">
                  {selectedUserForDetail.phoneNumber ||
                   db.getOrganizerTournaments(selectedUserForDetail.id).find((t) => t.telebirrNumber)?.telebirrNumber ||
                   'N/A'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 col-span-2">
                <span className="text-[10px] text-slate-400 block font-bold">Gamertag</span>
                <span className="font-bold text-slate-200">{selectedUserForDetail.gamertag || 'N/A'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 col-span-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tournaments Joined:</span>
                  <span className="font-bold text-white">
                    {db.getTournaments().filter((t) =>
                      db.getTournamentPlayers(t.id).some((p) => p.userId === selectedUserForDetail.id)
                    ).length}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedUserForDetail(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl"
            >
              Close Profile
            </button>
          </div>
        </div>
      )}

      {/* PUBLISH FINAL RESULTS CONFIRMATION MODAL (Requirement 3) */}
      {showPublishConfirmModal && activeTournament && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowPublishConfirmModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="space-y-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                🏆 Publish Final Results?
              </h3>
              <div className="space-y-2 text-xs text-slate-300">
                <p className="font-semibold text-slate-200">Publishing the Final Results will:</p>
                <ul className="space-y-1 pl-4 list-disc text-slate-300 font-medium">
                  <li>Mark the tournament as <strong>Completed</strong>.</li>
                  <li>Prevent any further changes to this tournament.</li>
                </ul>
                <p className="text-rose-400 font-bold text-xs pt-1">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowPublishConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!activeTournament) return;
                  await db.updateTournament(activeTournament.id, {
                    finalStandings: finalRows,
                    status: 'Completed',
                  });
                  showToast('Final Results published successfully!');
                  setShowPublishConfirmModal(false);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Publish Final Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* START TOURNAMENT CONFIRMATION MODAL */}
      {showStartConfirmModal && activeTournament && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => {
                setFormStatus(activeTournament.status);
                setShowStartConfirmModal(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="space-y-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                ⚡ Start Tournament?
              </h3>
              <div className="space-y-2 text-xs text-slate-300">
                <p className="font-semibold text-slate-200">Starting the tournament will:</p>
                <ul className="space-y-1 pl-4 list-disc text-slate-300 font-medium">
                  <li>Close player registration.</li>
                  <li>Enable Standings management.</li>
                  <li>Enable Matches management.</li>
                  <li>Prevent returning to Registration Open.</li>
                </ul>
                <p className="text-rose-400 font-bold text-xs pt-1">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setFormStatus(activeTournament.status);
                  setShowStartConfirmModal(false);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStartTournament}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Start Tournament
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECK-IN REQUIRED ALERT MODAL */}
      {showCheckInAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center relative">
            <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-sm font-bold text-white leading-relaxed">
              To start the tournament all registered players should be Checked-in.
            </p>
            <button
              onClick={() => setShowCheckInAlert(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-wider"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
