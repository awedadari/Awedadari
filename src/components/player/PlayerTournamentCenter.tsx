import React, { useState } from 'react';
import { db, auth } from '../../services/db';
import { compressImage } from '../../utils/imageCompressor';
import { telegramService } from '../../services/telegramService';
import { normalizePhoneNumber } from '../../utils/phoneUtils';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { User, Tournament, Match } from '../../types';
import { InviteModal } from '../common/InviteModal';
import { PaginationControls } from '../common/PaginationControls';
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Users,
  Swords,
  Filter,
  CheckCircle2,
  XCircle,
  Search,
  Info,
  AlertCircle,
  RefreshCw,
  Share2,
  ShieldCheck,
  Shield,
  Star,
  Phone,
  Copy,
  Check,
  Award,
  Tv,
  Key,
  Send,
  Loader2,
} from 'lucide-react';
import { TournamentStreamPlayer } from '../stream/TournamentStreamPlayer';

interface PlayerTournamentCenterProps {
  user: User;
  initialTournament?: Tournament | null;
}

export const PlayerTournamentCenter: React.FC<PlayerTournamentCenterProps> = ({ user, initialTournament }) => {
  const [selectedGame, setSelectedGame] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(initialTournament || null);
  const [detailTab, setDetailTab] = useState<'INFO' | 'ROSTER' | 'WATCH_RESULTS' | 'ORGANIZER'>('INFO');
  const [watchSubTab, setWatchSubTab] = useState<'STANDINGS' | 'MATCHES'>('STANDINGS');
  const [playerStandingsTab, setPlayerStandingsTab] = useState<number | 'FINAL_RESULTS'>(1);
  const [playerSelectedRound, setPlayerSelectedRound] = useState<number>(1);
  const [, setTick] = useState<number>(0);

  React.useEffect(() => {
    if (initialTournament) {
      setActiveTournament(initialTournament);
      setDetailTab('INFO');
      setWatchSubTab('STANDINGS');
      setPlayerStandingsTab(1);
    }
  }, [initialTournament]);

  // Subscribe to scoped tournament data (players, matches, groups, sessions, scores)
  React.useEffect(() => {
    if (activeTournament) {
      db.subscribeToTournament(activeTournament.id);
    }
  }, [activeTournament?.id]);

  // Load completed tournaments on-demand when user selects Finished or ALL status filter
  React.useEffect(() => {
    if (selectedStatus === 'Finished' || selectedStatus === 'Completed' || selectedStatus === 'ALL') {
      db.loadCompletedTournaments();
    }
  }, [selectedStatus]);

  React.useEffect(() => {
    const unsub = db.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);
  
  // Custom toast and confirmation states
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [confirmUnregisterId, setConfirmUnregisterId] = useState<string | null>(null);

  // Invite Modal state
  const [inviteTourModal, setInviteTourModal] = useState<Tournament | null>(null);

  // Payment Proof Registration Modal state
  const [paymentRegisterTourId, setPaymentRegisterTourId] = useState<string | null>(null);
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState<string>('');
  const [regPhoneNumber, setRegPhoneNumber] = useState<string>(user.phoneNumber || '');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Registration Code Modal state
  const [codeRegisterTour, setCodeRegisterTour] = useState<Tournament | null>(null);
  const [enteredCode, setEnteredCode] = useState<string>('');
  const [codeRegisterError, setCodeRegisterError] = useState<string | null>(null);
  const [isSubmittingCode, setIsSubmittingCode] = useState<boolean>(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    telegramService.triggerHaptic(type === 'success' ? 'success' : 'warning');
    setTimeout(() => setToast(null), 3000);
  };

  // Keep active tournament fresh in real-time
  const liveActiveTournament = activeTournament
    ? db.getTournamentById(activeTournament.id) || activeTournament
    : null;

  // Sort tournaments from newest created to oldest created
  const allTournaments = db.getApprovedTournaments().sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.id.localeCompare(a.id);
  });

  const filteredTournaments = allTournaments.filter((t) => {
    if (selectedGame !== 'ALL' && t.game !== selectedGame && t.game.toLowerCase() !== selectedGame.toLowerCase()) return false;
    if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = t.tournamentName.toLowerCase().includes(q);
      const matchGame = t.game.toLowerCase().includes(q);
      const matchVenue = (t.venueName || '').toLowerCase().includes(q);
      const matchLoc = (t.venueLocation || '').toLowerCase().includes(q);
      const matchCode = t.tournamentCode ? t.tournamentCode.toLowerCase().includes(q) || `#${t.tournamentCode}`.toLowerCase().includes(q) : false;
      if (!matchName && !matchGame && !matchVenue && !matchLoc && !matchCode) return false;
    }
    return true;
  });

  const [tournamentsPage, setTournamentsPage] = useState(1);
  const [tournamentsPageSize, setTournamentsPageSize] = useState(10);

  const paginatedTournamentsFallback = filteredTournaments.slice(
    (tournamentsPage - 1) * tournamentsPageSize,
    tournamentsPage * tournamentsPageSize
  );

  const tournamentsPagination = useCursorPagination<Tournament>({
    fetchPage: async (pageSize, lastDoc) => {
      const res = await db.getPaginatedTournaments({
        pageSize,
        lastDoc,
        isApproved: true,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        game: selectedGame === 'ALL' ? undefined : selectedGame,
        searchTerm: searchQuery,
      });
      return {
        items: res.tournaments,
        lastDoc: res.lastDoc,
        hasMore: res.hasMore,
      };
    },
    pageSize: tournamentsPageSize,
    dependencies: [selectedGame, selectedStatus, searchQuery],
  });

  const handleOpenRegisterPaymentModal = (tournamentId: string) => {
    setRegPhoneNumber(user.phoneNumber || '');
    setPaymentRegisterTourId(tournamentId);
    setPaymentScreenshotUrl('');
  };

  const handlePaymentScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      showToast('Image size exceeds 4MB limit.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        const compressed = await compressImage(base64, 600, 800, 0.6);
        setPaymentScreenshotUrl(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentRegisterTourId) return;

    const currentAuthUid = auth.currentUser?.uid || null;
    const isAnonymous = auth.currentUser?.isAnonymous ?? null;
    const isUidMatch = currentAuthUid === user.id;
    const screenshotLength = paymentScreenshotUrl ? paymentScreenshotUrl.length : 0;

    console.log('PAYMENT_DEBUG: SUBMIT INITIATED', {
      tournamentId: paymentRegisterTourId,
      userId: user.id,
      hasScreenshot: Boolean(paymentScreenshotUrl),
      screenshotLength,
      authUid: currentAuthUid,
      isAnonymous,
      isUidMatch,
    });

    const effectivePhone = user.phoneNumber || regPhoneNumber;
    const cleanPhone = effectivePhone.trim() ? normalizePhoneNumber(effectivePhone.trim()) : '';
    if (!cleanPhone) {
      showToast('A valid phone number is required to register for tournaments.', 'error');
      return;
    }

    if (!paymentScreenshotUrl) {
      showToast('Please upload a screenshot of your payment receipt.', 'error');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      // Step 1: Save normalized phone number to user profile
      setRegPhoneNumber(cleanPhone);
      console.log('PAYMENT_DEBUG: STEP 1 updateUser START', {
        userId: user.id,
        phoneNumber: cleanPhone,
      });

      const updateUserRes = await db.updateUser({
        id: user.id,
        phoneNumber: cleanPhone,
      });

      console.log('PAYMENT_DEBUG: STEP 1 updateUser RESULT', {
        success: updateUserRes,
      });

      // Step 2: Submit payment proof
      console.log('PAYMENT_DEBUG: STEP 2 registerPlayerWithPaymentProof START', {
        tournamentId: paymentRegisterTourId,
        userId: user.id,
        screenshotLength,
      });

      const success = await db.registerPlayerWithPaymentProof(
        paymentRegisterTourId,
        user.id,
        paymentScreenshotUrl
      );

      console.log('PAYMENT_DEBUG: STEP 2 registerPlayerWithPaymentProof RESULT', {
        success,
      });

      if (success) {
        console.log('PAYMENT_DEBUG: FINAL OUTCOME -> SUCCESS (Payment proof submitted)');
        showToast('Payment proof submitted! Organizer will verify your registration.');
        setPaymentRegisterTourId(null);
        setPaymentScreenshotUrl('');
      } else {
        console.warn('PAYMENT_DEBUG: FINAL OUTCOME -> REGISTRATION FAILED (registerPlayerWithPaymentProof returned false)');
        showToast('Registration failed or tournament is full.', 'error');
      }
    } catch (err: any) {
      console.error('PAYMENT_DEBUG: FINAL OUTCOME -> EXCEPTION THROWN', {
        name: err?.name,
        code: err?.code,
        message: err?.message,
      });
      showToast(err?.message || 'Failed to submit payment receipt. Please try again.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleUnregisterConfirm = () => {
    if (confirmUnregisterId) {
      db.unregisterPlayer(confirmUnregisterId, user.id);
      showToast('Registration cancelled.');
      setConfirmUnregisterId(null);
    }
  };

  const handleStartRegistration = (tournament: Tournament) => {
    const method =
      tournament.registrationMethod ||
      (tournament.registrationFee && tournament.registrationFee !== 'Free' && tournament.registrationFee !== '0 ETB' && tournament.registrationFee !== 'Registration Code'
        ? 'PAYMENT'
        : 'OPEN');

    if (method === 'CODE') {
      setCodeRegisterTour(tournament);
      setEnteredCode('');
      setCodeRegisterError(null);
    } else if (method === 'PAYMENT') {
      handleOpenRegisterPaymentModal(tournament.id);
    } else {
      handleDirectOpenRegister(tournament.id);
    }
  };

  const handleDirectOpenRegister = async (tournamentId: string) => {
    try {
      const success = await db.registerPlayer(tournamentId, user.id);
      if (success) {
        showToast('Registration confirmed! Welcome to the tournament.');
      } else {
        showToast('Registration failed or tournament is full.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to register.', 'error');
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeRegisterTour) return;
    const cleanCode = enteredCode.trim().toUpperCase();

    if (!cleanCode) {
      setCodeRegisterError('Please enter your 6-character registration code.');
      return;
    }
    if (cleanCode.length !== 6) {
      setCodeRegisterError('Registration code must be exactly 6 characters.');
      return;
    }

    setIsSubmittingCode(true);
    setCodeRegisterError(null);
    try {
      const result = await db.registerPlayerWithCode(
        codeRegisterTour.id,
        user.id,
        cleanCode,
        user.name,
        user.gamertag
      );

      if (result.success) {
        showToast(result.message || 'Registration successful! You are confirmed for this challenge.');
        setCodeRegisterTour(null);
        setEnteredCode('');
      } else {
        setCodeRegisterError(result.message || 'Failed to register with code.');
        showToast(result.message || 'Registration failed.', 'error');
      }
    } catch (err: any) {
      setCodeRegisterError(err?.message || 'An unexpected error occurred. Please try again.');
      showToast(err?.message || 'Failed to register.', 'error');
    } finally {
      setIsSubmittingCode(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Toast Notification Banner */}
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

      {/* Confirmation Modal for Unregistering */}
      {confirmUnregisterId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-4 max-w-sm w-full space-y-3 shadow-2xl">
            <h3 className="font-bold text-white text-sm">Cancel Tournament Registration?</h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to withdraw your spot? You can re-register anytime if slots are available.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmUnregisterId(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Keep Spot
              </button>
              <button
                onClick={handleUnregisterConfirm}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Yes, Cancel Spot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-100 flex items-center gap-2 tracking-tight">
            <Trophy className="w-5 h-5 text-amber-400" />
            Tournament Center
          </h1>
          <p className="text-xs text-slate-400">Browse 1v1 venue tournaments, check rosters & live scores</p>
        </div>

        {/* Tournament Name Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, game, or code (e.g. 0001)..."
            className="w-full bg-slate-850 border border-slate-750 rounded-2xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-amber-400 transition-colors font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Game Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium no-scrollbar">
          {['ALL', ...db.getRecentGames()].map((game) => (
            <button
              key={game}
              onClick={() => {
                setSelectedGame(game);
                telegramService.triggerHaptic('light');
              }}
              className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all font-bold min-h-[36px] ${
                selectedGame === game
                  ? 'bg-sky-500 text-slate-950 shadow-md scale-102'
                  : 'bg-slate-850 text-slate-300 hover:bg-slate-800 border border-slate-750'
              }`}
            >
              {game === 'ALL' ? 'All Tournaments' : game}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-850 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-1" />
          <span className="font-bold text-slate-300 shrink-0">Status:</span>
          {['ALL', 'Upcoming', 'Ongoing', 'Completed'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setSelectedStatus(st);
                telegramService.triggerHaptic('light');
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap text-xs ${
                selectedStatus === st
                  ? 'bg-slate-750 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tournament Cards Grid */}
      <div className="space-y-3">
        {tournamentsPagination.isLoading && tournamentsPagination.items.length === 0 ? (
          <div className="text-center py-10 bg-slate-850 rounded-2xl border border-slate-750 p-6 space-y-3 animate-pulse">
            <Trophy className="w-10 h-10 text-slate-500 mx-auto" />
            <p className="text-sm text-slate-300 font-bold">Loading tournaments...</p>
          </div>
        ) : (tournamentsPagination.items.length > 0 ? tournamentsPagination.items : paginatedTournamentsFallback).length === 0 ? (
          <div className="text-center py-10 bg-slate-850 rounded-2xl border border-slate-750 p-6 space-y-3">
            <Trophy className="w-10 h-10 text-slate-600 mx-auto" />
            <div>
              <p className="text-sm text-slate-200 font-bold">No tournaments found</p>
              <p className="text-xs text-slate-500 mt-0.5">No tournaments match your selected game and status filters.</p>
            </div>
            <button
              onClick={() => {
                setSelectedGame('ALL');
                setSelectedStatus('ALL');
                telegramService.triggerHaptic('light');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-sky-400 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset Filters
            </button>
          </div>
        ) : (
          (tournamentsPagination.items.length > 0 ? tournamentsPagination.items : paginatedTournamentsFallback).map((t) => {
            const isRegistered = db.isPlayerRegistered(t.id, user.id);
            const confirmedPlayers = db.getConfirmedTournamentPlayers(t.id);
            const pendingPlayers = db.getPendingTournamentPlayers(t.id);
            const players = db.getTournamentPlayers(t.id);
            const matches = db.getMatches(t.id);
            const userPlayerRecord = players.find((p) => p.userId === user.id);
            const isFull = confirmedPlayers.length >= t.maxPlayers;

            return (
              <div
                key={t.id}
                className="bg-slate-850 border border-slate-750 rounded-2xl overflow-hidden shadow-md hover:border-sky-500/40 transition-all"
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="relative sm:w-1/3 h-32 sm:h-auto bg-slate-800 shrink-0">
                    <img src={t.image} alt={t.tournamentName} className="w-full h-full object-cover" />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-slate-900/90 backdrop-blur-md rounded-full text-[10px] font-black text-sky-300 border border-sky-500/30">
                      {t.game}
                    </span>
                    <span
                      className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        t.status === 'Ongoing'
                          ? 'bg-emerald-500 text-slate-950'
                          : t.status === 'Completed'
                          ? 'bg-purple-500 text-white'
                          : isFull
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-sky-600 text-white'
                      }`}
                    >
                      {isFull && t.status === 'Registration Open' ? 'FULL' : t.status}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-extrabold text-slate-100 text-sm leading-tight">{t.tournamentName}</h3>
                        {t.tournamentCode && (
                          <span className="font-mono text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 shrink-0">
                            #{t.tournamentCode}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-sky-400" />
                          {t.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-sky-400" />
                          {t.time}
                        </span>
                        <span className="flex items-center gap-1 text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="text-slate-200 font-bold">{t.venueLocation || t.venueName || 'Addis Ababa'}</span>
                        </span>
                        {t.registrationMethod === 'CODE' ? (
                          <span className="flex items-center gap-1 font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                            <Key className="w-3 h-3 text-amber-400" />
                            Entry: Code Required
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                            Fee: {t.registrationFee || '50 ETB'}
                          </span>
                        )}
                        {(t.award || t.prizePool) && (
                          <span className="flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                            <Award className="w-3.5 h-3.5 text-amber-400" />
                            Award: {t.award || t.prizePool}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-semibold text-slate-300">
                          <Users className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-emerald-400 font-extrabold">{confirmedPlayers.length}</span>/{t.maxPlayers} Confirmed
                          {pendingPlayers.length > 0 && (
                            <span className="text-[10px] text-amber-400">({pendingPlayers.length} Pending)</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {userPlayerRecord && (
                      <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-750 flex flex-col gap-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Your Registration Status:</span>
                          <div className="flex items-center gap-1.5">
                            {userPlayerRecord.paymentStatus === 'PENDING_APPROVAL' && (
                              <span className="text-[10px] text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                                Payment Reviewing
                              </span>
                            )}
                            <span
                              className={`font-black px-2.5 py-0.5 rounded text-[10px] uppercase ${
                                userPlayerRecord.playerStatus === 'Checked In'
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : userPlayerRecord.playerStatus === 'Champion'
                                  ? 'bg-amber-400 text-slate-950 font-black'
                                  : userPlayerRecord.playerStatus === 'Playing'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : userPlayerRecord.playerStatus === 'Eliminated'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : userPlayerRecord.paymentStatus === 'CONFIRMED'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {userPlayerRecord.playerStatus === 'Checked In'
                                ? 'Checked In ✓'
                                : userPlayerRecord.paymentStatus === 'CONFIRMED'
                                ? 'Confirmed'
                                : userPlayerRecord.playerStatus}
                            </span>
                          </div>
                        </div>
                        {userPlayerRecord.checkInCode && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                            <span className="text-slate-400 text-[11px] font-medium">Your Code:</span>
                            <span className="font-mono font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[11px]">
                              {userPlayerRecord.checkInCode.replace(/^SG-/, '')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-750">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setActiveTournament(t);
                            setDetailTab('INFO');
                            setWatchSubTab('STANDINGS');
                            setPlayerStandingsTab(1);
                            telegramService.triggerHaptic('light');
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 px-3 py-2 rounded-xl border border-slate-700 transition-colors min-h-[38px] capitalize"
                        >
                          <Info className="w-3.5 h-3.5 text-sky-400" />
                          view more
                        </button>

                        <button
                          onClick={() => setInviteTourModal(t)}
                          className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30 transition-colors flex items-center gap-1 font-extrabold text-xs"
                          title="Invite players to this tournament"
                        >
                          <Share2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Invite</span>
                        </button>
                      </div>

                      {isRegistered ? (
                        userPlayerRecord?.paymentStatus === 'PENDING_APPROVAL' ? (
                          <span className="text-[11px] font-extrabold text-amber-300 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                            Pending Approval
                          </span>
                        ) : userPlayerRecord?.registrationMethod === 'CODE' ? (
                          <span className="text-[11px] font-extrabold text-amber-300 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                            <Key className="w-3.5 h-3.5 text-amber-400" />
                            Registered (Code)
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold text-emerald-300 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Registered (Confirmed)
                          </span>
                        )
                      ) : (
                        <button
                          onClick={() => handleStartRegistration(t)}
                          disabled={isFull || t.status === 'Ongoing' || t.status === 'Completed' || t.status === 'Finished'}
                          className={`text-xs font-extrabold px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 min-h-[38px] flex items-center gap-1.5 ${
                            t.registrationMethod === 'CODE'
                              ? 'text-slate-950 bg-amber-400 hover:bg-amber-300'
                              : 'text-slate-950 bg-sky-400 hover:bg-sky-300'
                          } disabled:opacity-50`}
                        >
                          {t.registrationMethod === 'CODE' && !isFull && t.status !== 'Ongoing' && t.status !== 'Completed' && t.status !== 'Finished' && (
                            <Key className="w-3.5 h-3.5" />
                          )}
                          {t.status === 'Ongoing' || t.status === 'Completed' || t.status === 'Finished'
                            ? 'Registration Closed'
                            : isFull
                            ? 'Tournament Full'
                            : t.registrationMethod === 'CODE'
                            ? 'Register with Code'
                            : 'Register'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <PaginationControls
        currentPage={tournamentsPagination.currentPage}
        totalItems={tournamentsPagination.totalItemsEstimate > 0 ? tournamentsPagination.totalItemsEstimate : filteredTournaments.length}
        pageSize={tournamentsPagination.pageSize}
        onPageChange={(p) => tournamentsPagination.goToPage(p)}
        onPageSizeChange={(size) => {
          setTournamentsPageSize(size);
          tournamentsPagination.changePageSize(size);
        }}
        itemLabel="tournaments"
      />

      {/* TOURNAMENT DETAIL MODAL */}
      {activeTournament && (() => {
        const activePlayers = db.getTournamentPlayers(activeTournament.id);
        const activeConfirmed = activePlayers.filter((p) => p.paymentStatus === 'CONFIRMED' || p.playerStatus === 'Checked In' || p.playerStatus === 'Playing' || p.playerStatus === 'Champion' || p.playerStatus === 'Eliminated');
        const isActiveFull = activeConfirmed.length >= activeTournament.maxPlayers;
        const isActiveRegistered = activePlayers.some((p) => p.userId === user.id);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Top Banner */}
            <div className="relative h-36 bg-slate-800 shrink-0">
              <img
                src={activeTournament.image}
                alt={activeTournament.tournamentName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-900/60" />
              <button
                onClick={() => setActiveTournament(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-slate-800 border border-slate-700"
              >
                ✕
              </button>
              <div className="absolute bottom-3 left-4 right-4">
                <span className="px-2.5 py-0.5 bg-sky-500 text-slate-950 text-[10px] font-black rounded-full uppercase">
                  {activeTournament.game}
                </span>
                <h2 className="text-lg font-black text-white leading-tight mt-1">
                  {activeTournament.tournamentName}
                </h2>
              </div>
            </div>

            {/* Detail Tabs - OVERVIEW, PLAYERS, WATCH & RESULTS */}
            <div className="flex border-b border-slate-800 bg-slate-850 px-4 text-xs font-semibold overflow-x-auto no-scrollbar">
              <button
                onClick={() => setDetailTab('INFO')}
                className={`py-3 px-4 border-b-2 font-black uppercase whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  detailTab === 'INFO'
                    ? 'border-sky-400 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Info className="w-3.5 h-3.5 text-sky-400" />
                OVERVIEW
              </button>
              <button
                onClick={() => setDetailTab('ROSTER')}
                className={`py-3 px-4 border-b-2 font-black uppercase whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  detailTab === 'ROSTER'
                    ? 'border-sky-400 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-sky-400" />
                PLAYERS ({liveActiveTournament ? db.getTournamentPlayers(liveActiveTournament.id).length : 0})
              </button>
              <button
                onClick={() => {
                  setDetailTab('WATCH_RESULTS');
                  setWatchSubTab('STANDINGS');
                  setPlayerStandingsTab(1);
                }}
                className={`py-3 px-4 border-b-2 font-black uppercase whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  detailTab === 'WATCH_RESULTS'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Tv className="w-3.5 h-3.5 text-amber-400" />
                WATCH & RESULTS
              </button>
            </div>

            {/* Detail Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {detailTab === 'INFO' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-850 rounded-2xl border border-slate-800">
                    <div>
                      <p className="text-slate-400 font-medium">Date & Time</p>
                      <p className="font-extrabold text-white text-sm">
                        {activeTournament.date} @ {activeTournament.time}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">
                        {activeTournament.registrationMethod === 'CODE' ? 'Access Method' : 'Entry Fee'}
                      </p>
                      <p className="font-extrabold text-amber-300 text-sm flex items-center gap-1">
                        {activeTournament.registrationMethod === 'CODE' && <Key className="w-3.5 h-3.5 text-amber-400" />}
                        {activeTournament.registrationMethod === 'CODE'
                          ? 'Registration Code'
                          : activeTournament.registrationFee || '50 ETB'}
                      </p>
                    </div>
                    {(activeTournament.award || activeTournament.prizePool) && (
                      <div className="col-span-2 pt-2 border-t border-slate-800">
                        <p className="text-slate-400 font-medium flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-400" /> Tournament Award
                        </p>
                        <p className="font-extrabold text-amber-400 text-sm">
                          {activeTournament.award || activeTournament.prizePool}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-400" />
                      Venue & Station Credentials
                    </h4>
                    <div className="text-slate-300 bg-slate-850 p-3 rounded-2xl border border-slate-800 space-y-1">
                      <p className="font-extrabold text-white text-sm">
                        {activeTournament.venueName || 'Nexus Gaming Lounge'}
                      </p>
                      <p className="text-slate-400 text-xs">
                        📍 {activeTournament.venueLocation || 'Bole Medhanialem, Building 3, Floor 2'}
                      </p>
                      {activeTournament.telebirrNumber && (
                        <p className="text-emerald-400 font-mono text-xs font-bold pt-1">
                          📞 {activeTournament.telebirrNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-300 mb-1">Official Venue Rules</h4>
                    <p className="text-slate-300 bg-slate-850 p-3 rounded-2xl border border-slate-800 leading-relaxed font-medium">
                      {activeTournament.rules || 'Standard 1v1 competitive rules. Fair play expected.'}
                    </p>
                  </div>
                </div>
              )}

              {detailTab === 'ROSTER' && (
                <div className="space-y-2">
                  {db.getTournamentPlayers(activeTournament.id).length === 0 ? (
                    <div className="p-6 text-center text-slate-500 bg-slate-850 rounded-2xl">
                      No registered players yet. Be the first to join!
                    </div>
                  ) : (
                    db.getTournamentPlayers(activeTournament.id).map((tp) => (
                      <div
                        key={tp.userId}
                        className="flex items-center justify-between p-2.5 bg-slate-850 rounded-xl border border-slate-800"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={tp.user?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-slate-700"
                          />
                          <div>
                            <p className="font-bold text-xs text-white">{tp.user?.name || tp.userId}</p>
                            <p className="text-[10px] text-sky-400 font-mono">
                              Gamertag: {tp.user?.gamertag || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            tp.playerStatus === 'Champion'
                              ? 'bg-amber-400 text-slate-950'
                              : tp.playerStatus === 'Playing'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : tp.playerStatus === 'Eliminated'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {tp.playerStatus}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* WATCH & RESULTS TAB */}
              {detailTab === 'WATCH_RESULTS' && (
                <div className="space-y-4">
                  {/* LEVEL 1 — YOUTUBE VIDEO (IF CONFIGURED) */}
                  {Boolean((liveActiveTournament || activeTournament).youtubeVideoId) && (
                    <TournamentStreamPlayer
                      tournament={liveActiveTournament || activeTournament}
                    />
                  )}

                  {/* LEVEL 2 — STANDINGS | MATCHES TABS */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setWatchSubTab('STANDINGS');
                        setPlayerStandingsTab(1);
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                        watchSubTab === 'STANDINGS'
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      Standings
                    </button>
                    <button
                      type="button"
                      onClick={() => setWatchSubTab('MATCHES')}
                      className={`py-2 px-3 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                        watchSubTab === 'MATCHES'
                          ? 'bg-sky-400 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      Matches
                    </button>
                  </div>

                  {/* STANDINGS SUB-TAB */}
                  {watchSubTab === 'STANDINGS' && (
                    <div className="space-y-4">
                      {/* Standings Navigation: Round Tabs + Final Results */}
                      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        {Array.from({ length: activeTournament.maxRounds || 3 }, (_, i) => i + 1).map((r) => (
                          <button
                            key={r}
                            onClick={() => setPlayerStandingsTab(r)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                              playerStandingsTab === r
                                ? 'bg-sky-500 text-slate-950 font-black'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                            }`}
                          >
                            Round {r}
                          </button>
                        ))}
                        <button
                          onClick={() => setPlayerStandingsTab('FINAL_RESULTS')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                            playerStandingsTab === 'FINAL_RESULTS'
                              ? 'bg-sky-500 text-slate-950 font-black'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                          }`}
                        >
                          Final Results
                        </button>
                      </div>

                      {playerStandingsTab !== 'FINAL_RESULTS' ? (
                        <div className="space-y-3">
                          {/* Groups inside selected round */}
                          {(() => {
                            const selectedRound = typeof playerStandingsTab === 'number' ? playerStandingsTab : 1;
                            const tournamentId = liveActiveTournament ? liveActiveTournament.id : activeTournament.id;
                            const groups = db.getTournamentGroups(tournamentId).filter((g) => g.roundNumber === selectedRound);
                            if (groups.length === 0) {
                              return (
                                <div className="p-8 text-center text-slate-500 bg-slate-850 rounded-2xl border border-slate-800">
                                  No groups created for Round {selectedRound} yet.
                                </div>
                              );
                            }
                        const perfLabel = (liveActiveTournament || activeTournament).performanceLabel || 'Goals';

                        return groups.map((grp) => {
                          const standings = db.getGroupStandingsWithAccumulated(tournamentId, grp.id);
                          return (
                            <div key={grp.id} className="bg-slate-850 rounded-2xl border border-slate-750 p-3 space-y-2">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="font-extrabold text-amber-300 text-xs">{grp.groupName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">Read-Only View</span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                                    <tr>
                                      <th className="p-2">Rank</th>
                                      <th className="p-2">Player</th>
                                      <th className="p-2 text-center">Points</th>
                                      <th className="p-2 text-center">{perfLabel}</th>
                                      <th className="p-2 text-right">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/50 font-medium">
                                    {standings.map((st) => (
                                      <tr key={st.userId} className="hover:bg-slate-800/40">
                                        <td className="p-2 font-mono font-bold text-amber-400">#{st.rank}</td>
                                        <td className="p-2 font-bold text-white flex items-center gap-2">
                                          <img
                                            src={st.user?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                            alt=""
                                            className="w-5 h-5 rounded-full object-cover shrink-0"
                                          />
                                          <span className="truncate max-w-[120px]">{st.user?.name || st.userId}</span>
                                        </td>
                                        <td className="p-2 text-center font-extrabold font-mono text-amber-300">{st.points}</td>
                                        <td className="p-2 text-center font-mono text-slate-300">{st.performance}</td>
                                        <td className="p-2 text-right">
                                          <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                              st.status === 'Champion'
                                                ? 'bg-amber-400 text-slate-950'
                                                : st.status === 'Qualified'
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : st.status === 'Eliminated'
                                                ? 'bg-rose-500/20 text-rose-300'
                                                : 'bg-slate-800 text-slate-400'
                                            }`}
                                          >
                                            {st.status}
                                          </span>
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
                    /* FINAL RESULT SUB-TAB */
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-white text-xs flex items-center justify-between">
                        <span>Final Results</span>
                        <span className="text-[10px] text-amber-400 font-mono">Published Standings</span>
                      </h4>

                      {(!activeTournament.finalStandings || activeTournament.finalStandings.length === 0) ? (
                        <div className="p-8 text-center text-slate-500 bg-slate-850 rounded-2xl border border-slate-800 space-y-1">
                          <p className="font-bold text-slate-300 text-xs">No Final Results Published</p>
                          <p className="text-[11px] text-slate-400">The organizer has not published final standings for this tournament yet.</p>
                        </div>
                      ) : (
                        <div className="bg-slate-850 rounded-2xl border border-slate-750 overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                              <tr>
                                <th className="p-2.5">Rank</th>
                                <th className="p-2.5">Player</th>
                                <th className="p-2.5 text-center">Total Points</th>
                                <th className="p-2.5 text-center">{activeTournament.performanceLabel || 'Goals'}</th>
                                <th className="p-2.5 text-right">Badge / Title</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                              {activeTournament.finalStandings.map((fs) => {
                                const playerUser = db.getUsers().find((u) => u.id === fs.userId);
                                return (
                                  <tr key={fs.userId} className={fs.rank === 1 ? 'bg-amber-500/10' : ''}>
                                    <td className="p-2.5 font-bold font-mono text-amber-400">
                                      {fs.rank === 1 ? '🥇 #1' : fs.rank === 2 ? '🥈 #2' : fs.rank === 3 ? '🥉 #3' : `#${fs.rank}`}
                                    </td>
                                    <td className="p-2.5 font-bold text-white flex items-center gap-2">
                                      <img
                                        src={playerUser?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                        alt=""
                                        className="w-6 h-6 rounded-full object-cover shrink-0"
                                      />
                                      <span>{playerUser?.name || fs.userId}</span>
                                    </td>
                                    <td className="p-2.5 text-center font-extrabold font-mono text-amber-300">{fs.points}</td>
                                    <td className="p-2.5 text-center font-mono text-slate-300">{fs.performance}</td>
                                    <td className="p-2.5 text-right">
                                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-extrabold text-[10px] rounded-full border border-amber-500/30">
                                        {fs.badge || (fs.rank === 1 ? 'CHAMPION 🏆' : fs.rank === 2 ? 'RUNNER-UP 🥈' : fs.rank === 3 ? '3RD PLACE 🥉' : `RANK #${fs.rank}`)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MATCHES SUB-TAB */}
              {watchSubTab === 'MATCHES' && (
                <div className="space-y-4">
                  {/* Round Selector Tabs */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {Array.from({ length: activeTournament.maxRounds || 3 }, (_, i) => i + 1).map((r) => (
                      <button
                        key={r}
                        onClick={() => setPlayerSelectedRound(r)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          playerSelectedRound === r
                            ? 'bg-sky-500 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                        }`}
                      >
                        Round {r}
                      </button>
                    ))}
                  </div>

                  {/* Render Sessions for the selected round */}
                  {(() => {
                    const tournamentId = liveActiveTournament ? liveActiveTournament.id : activeTournament.id;
                    const groups = db.getTournamentGroups(tournamentId).filter((g) => g.roundNumber === playerSelectedRound);
                    if (groups.length === 0) {
                      return (
                        <div className="p-8 text-center text-slate-500 bg-slate-850 rounded-2xl border border-slate-800">
                          No sessions created for Round {playerSelectedRound} yet.
                        </div>
                      );
                    }

                    const sessionLabel = (liveActiveTournament || activeTournament).sessionLabel || 'Match';
                    const perfLabel = (liveActiveTournament || activeTournament).performanceLabel || 'Goals';

                    return groups.map((grp) => {
                      const sessions = db.getTournamentSessions(tournamentId).filter((s) => s.roundNumber === playerSelectedRound);
                      if (sessions.length === 0) {
                        return (
                          <div key={grp.id} className="p-4 bg-slate-850 rounded-2xl border border-slate-800 text-xs text-slate-400">
                            No {sessionLabel.toLowerCase()} entries in {grp.groupName} for Round {playerSelectedRound}.
                          </div>
                        );
                      }

                      return (
                        <div key={grp.id} className="space-y-3">
                          <h4 className="font-extrabold text-amber-300 text-xs">{grp.groupName} - {sessionLabel} List</h4>
                          {sessions.map((sess, idx) => (
                            <div key={sess.id} className="bg-slate-850 rounded-2xl border border-slate-750 p-3 space-y-2">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <span className="font-bold text-sky-400 text-xs">{sessionLabel} #{idx + 1}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Round {sess.roundNumber}
                                </span>
                              </div>

                              <table className="w-full text-left text-xs">
                                <thead className="text-slate-500 font-mono text-[10px] uppercase border-b border-slate-800">
                                  <tr>
                                    <th className="py-1">Player</th>
                                    <th className="py-1 text-center">Points</th>
                                    <th className="py-1 text-right">{perfLabel}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40 font-medium">
                                  {sess.scores.map((sc) => {
                                    const u = db.getUsers().find((usr) => usr.id === sc.userId);
                                    return (
                                      <tr key={sc.userId}>
                                        <td className="py-1.5 font-bold text-white flex items-center gap-2">
                                          <img
                                            src={u?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                            alt=""
                                            className="w-5 h-5 rounded-full object-cover shrink-0"
                                          />
                                          <span>{u?.name || sc.userId}</span>
                                        </td>
                                        <td className="py-1.5 text-center font-extrabold font-mono text-amber-300">{sc.points}</td>
                                        <td className="py-1.5 text-right font-mono text-slate-300">{sc.performance}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
                </div>
              )}

              {/* ORGANIZER PROFILE & HISTORY TAB */}
              {detailTab === 'ORGANIZER' && (() => {
                const org = db.getUsers().find((u) => u.id === activeTournament.organizerId);
                const stats = db.getOrganizerStats(activeTournament.organizerId);
                const orgTournaments = db.getOrganizerTournaments(activeTournament.organizerId);

                return (
                  <div className="space-y-4">
                    {/* Organizer Header Card */}
                    <div className="p-4 bg-slate-850 rounded-2xl border border-slate-750 flex items-center gap-4">
                      <img
                        src={org?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt={org?.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shrink-0 shadow-md"
                      />
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-white text-base truncate">{org?.name || 'Tournament Organizer'}</h3>
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-amber-400" />
                            Verified Host
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">Gamertag: <span className="text-sky-400 font-mono font-bold">@{org?.gamertag || 'organizer'}</span></p>
                        <div className="flex items-center gap-3 text-xs text-amber-400 font-bold pt-0.5">
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {stats.rating.toFixed(1)} / 5.0 Rating ({stats.ratingCount} reviews)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 bg-slate-850 rounded-2xl border border-slate-800 text-center space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Hosted</span>
                        <span className="text-base font-extrabold text-white">{stats.totalTournaments}</span>
                        <span className="text-[10px] text-slate-500 block">Tournaments</span>
                      </div>
                      <div className="p-3 bg-slate-850 rounded-2xl border border-slate-800 text-center space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block">Active Events</span>
                        <span className="text-base font-extrabold text-emerald-400">{stats.activeTournaments}</span>
                        <span className="text-[10px] text-slate-500 block">Live / Upcoming</span>
                      </div>
                      <div className="p-3 bg-slate-850 rounded-2xl border border-slate-800 text-center space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block">Players Hosted</span>
                        <span className="text-base font-extrabold text-amber-400">{stats.totalPlayersHosted}</span>
                        <span className="text-[10px] text-slate-500 block">Gamers</span>
                      </div>
                    </div>

                    {/* Telebirr & Contact Info */}
                    <div className="p-3 bg-slate-850 rounded-2xl border border-slate-750 space-y-2">
                      <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-sky-400" />
                        Organizer Contact & Telebirr Info
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-bold">Telebirr Name</span>
                          <span className="font-extrabold text-slate-100">
                            {activeTournament.telebirrAccountName || activeTournament.telebirrName || 'Not Set'}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-bold">Telebirr Number</span>
                          <span className="font-extrabold text-amber-300 font-mono">
                            {activeTournament.telebirrNumber || 'Not Set'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tournament History List */}
                    <div className="space-y-2">
                      <h4 className="font-extrabold text-slate-200 text-xs">Tournament History by {org?.name}</h4>
                      {orgTournaments.length === 0 ? (
                        <p className="text-xs text-slate-500 p-4 bg-slate-850 rounded-2xl text-center">No other tournaments found.</p>
                      ) : (
                        <div className="space-y-2">
                          {orgTournaments.map((t) => (
                            <div key={t.id} className="p-3 bg-slate-850 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2.5">
                                <img src={t.image} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                                <div>
                                  <p className="font-bold text-white leading-tight">{t.tournamentName}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">{t.game} • {t.date}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                t.status === 'Ongoing' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {t.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => setInviteTourModal(activeTournament)}
                className="text-xs font-bold px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30 flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4 text-amber-400" />
                Invite Players
              </button>
              <button
                onClick={() => handleStartRegistration(activeTournament)}
                disabled={isActiveRegistered || isActiveFull || activeTournament.status === 'Ongoing' || activeTournament.status === 'Completed' || activeTournament.status === 'Finished'}
                className={`text-xs font-extrabold px-4 py-2 ${
                  activeTournament.registrationMethod === 'CODE'
                    ? 'bg-amber-400 hover:bg-amber-300'
                    : 'bg-sky-400 hover:bg-sky-300'
                } disabled:opacity-50 text-slate-950 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5`}
              >
                {activeTournament.registrationMethod === 'CODE' && !isActiveRegistered && !isActiveFull && activeTournament.status !== 'Ongoing' && activeTournament.status !== 'Completed' && activeTournament.status !== 'Finished' && (
                  <Key className="w-3.5 h-3.5" />
                )}
                {isActiveRegistered
                  ? 'Registered'
                  : activeTournament.status === 'Ongoing' || activeTournament.status === 'Completed' || activeTournament.status === 'Finished'
                  ? 'Registration Closed'
                  : isActiveFull
                  ? 'Tournament Full'
                  : activeTournament.registrationMethod === 'CODE'
                  ? 'Register with Code'
                  : 'Register'}
              </button>
              <button
                onClick={() => setActiveTournament(null)}
                className="text-xs font-bold px-5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    })()}

      {/* PAYMENT SCREENSHOT UPLOAD MODAL */}
      {paymentRegisterTourId && (() => {
        const paymentTour = allTournaments.find((t) => t.id === paymentRegisterTourId);
        const teleNumber = paymentTour?.telebirrNumber || '';
        const teleName = paymentTour?.telebirrAccountName || paymentTour?.telebirrName || '';
        const fee = paymentTour?.registrationFee || '50 ETB';
        const location = paymentTour?.venueLocation || paymentTour?.venueName || 'Gamezone Location';

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-750 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  Upload Screenshot of Your Payment
                </h3>
                <button
                  onClick={() => {
                    setPaymentRegisterTourId(null);
                    setPaymentScreenshotUrl('');
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitPaymentProof} className="space-y-4">
                {/* Payment Credentials Box */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs space-y-2">
                  <p className="font-bold text-emerald-300 flex items-center justify-between">
                    <span>Payment & Transfer Details:</span>
                    <span className="text-amber-400 font-mono font-extrabold">{fee}</span>
                  </p>

                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Telebirr Name</span>
                      <span className="font-extrabold text-white">{teleName || 'Not Provided'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Telebirr Number</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-extrabold text-amber-300">{teleNumber || 'Not Provided'}</span>
                        {teleNumber && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(teleNumber);
                              setCopiedPhone(true);
                              setTimeout(() => setCopiedPhone(false), 2000);
                            }}
                            className="text-[10px] text-sky-400 hover:underline font-bold ml-1"
                          >
                            {copiedPhone ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/80 flex items-center gap-1.5 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">Gamezone / Venue Location:</span>
                        <span className="font-semibold text-slate-200">{location}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-slate-300">
                    Send <strong className="text-amber-300">{fee}</strong> via Telebirr to the phone number above. Once sent, upload a screenshot of your payment receipt below for organizer approval.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold text-xs mb-1.5 flex items-center justify-between flex-wrap gap-1">
                    <span>Your Verified Contact Number</span>
                    <span className="text-emerald-400 text-[10px] uppercase font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verified Identity
                    </span>
                  </label>

                  <div className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white font-mono flex items-center justify-between">
                    <span className="font-semibold text-emerald-300">{user.phoneNumber || regPhoneNumber || 'Phone Verified'}</span>
                    <span className="text-[10px] text-slate-400 font-sans">Identity Linked</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Organizers use your verified phone number for 1v1 match call-outs and payment verification.
                  </p>
                  <p className="text-[10px] text-emerald-400/90 flex items-center gap-1 mt-0.5 font-medium">
                    <Shield className="w-3 h-3 shrink-0" /> Private • Only visible to this tournament's organizers
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold text-xs mb-1.5">
                    Payment Receipt Screenshot
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePaymentScreenshotFileChange}
                    className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-sky-500 file:text-slate-950 hover:file:bg-sky-400 cursor-pointer"
                  />
                </div>

                {paymentScreenshotUrl && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold">Uploaded Screenshot Preview:</p>
                    <div className="h-44 w-full bg-slate-950 rounded-xl border border-slate-750 overflow-hidden flex items-center justify-center">
                      <img
                        src={paymentScreenshotUrl}
                        alt="Payment Receipt Screenshot"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentRegisterTourId(null);
                      setPaymentScreenshotUrl('');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!paymentScreenshotUrl || isSubmittingPayment}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    {isSubmittingPayment ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Payment Receipt'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* REGISTRATION CODE MODAL */}
      {codeRegisterTour && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                  <Key className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm">
                    Enter Registration Code
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {codeRegisterTour.tournamentName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCodeRegisterTour(null);
                  setEnteredCode('');
                  setCodeRegisterError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  This challenge requires an authorized registration code provided by the organizer. Each code is single-use and confirms your spot.
                </span>
              </div>

              {/* Player Identity Confirmation */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Registering Account:</span>
                  <span className="font-extrabold text-white text-xs">{user.name}</span>
                </div>
                <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  @{user.gamertag}
                </span>
              </div>

              {/* Code Input Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>6-Character Code</span>
                  <span className="text-[10px] text-slate-400">Case-insensitive</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={enteredCode}
                    onChange={(e) => {
                      setEnteredCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                      if (codeRegisterError) setCodeRegisterError(null);
                    }}
                    placeholder="E.G. A9B2X7"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-4 py-3 text-center text-xl font-mono font-black tracking-widest text-amber-300 placeholder-slate-600 focus:outline-hidden"
                    autoFocus
                  />
                  {enteredCode.length > 0 && (
                    <span className="absolute right-3.5 top-3.5 text-xs font-mono font-bold text-slate-500">
                      {enteredCode.length}/6
                    </span>
                  )}
                </div>
              </div>

              {codeRegisterError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{codeRegisterError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setCodeRegisterTour(null);
                    setEnteredCode('');
                    setCodeRegisterError(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enteredCode.trim().length !== 6 || isSubmittingCode}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                >
                  {isSubmittingCode ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      Confirm Registration
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHARE / INVITE MODAL */}
      {inviteTourModal && (
        <InviteModal tournament={inviteTourModal} onClose={() => setInviteTourModal(null)} />
      )}
    </div>
  );
};

