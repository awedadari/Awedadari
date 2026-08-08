import React, { useState } from 'react';
import { db } from '../../services/db';
import { telegramService } from '../../services/telegramService';
import { User, Tournament, TournamentStatus } from '../../types';
import { Trophy, Plus, Calendar, Clock, Users, Swords, Settings, Edit2, CheckCircle2, X, AlertCircle } from 'lucide-react';

interface OrganizerTournamentCenterProps {
  user: User;
  onOpenPanelWithTab: (subTab: 'create_tour' | 'players' | 'matches' | 'results' | 'progress') => void;
}

export const OrganizerTournamentCenter: React.FC<OrganizerTournamentCenterProps> = ({
  user,
  onOpenPanelWithTab,
}) => {
  const tournaments = db.getTournaments();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [startConfirmTour, setStartConfirmTour] = useState<Tournament | null>(null);
  const [showCheckInAlert, setShowCheckInAlert] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    telegramService.triggerHaptic('success');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleUpdateStatus = (id: string, status: TournamentStatus) => {
    db.updateTournamentStatus(id, status);
    showToast(`Status updated to "${status}"`);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-2 text-xs font-bold shadow-lg animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-100 flex items-center gap-2 tracking-tight">
            <Trophy className="w-5 h-5 text-amber-400" />
            Organizer Tournament Desk
          </h1>
          <p className="text-xs text-slate-400">All tournaments hosted by your venue</p>
        </div>
        <button
          onClick={() => {
            onOpenPanelWithTab('create_tour');
            telegramService.triggerHaptic('light');
          }}
          className="flex items-center gap-1.5 text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2 rounded-xl shadow-md transition-all active:scale-95 min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          Create New
        </button>
      </div>

      {/* Tournaments List with Organizer Controls */}
      <div className="space-y-3">
        {tournaments.length === 0 ? (
          <div className="text-center py-10 bg-slate-850 rounded-2xl border border-slate-750 p-6 space-y-3">
            <Trophy className="w-10 h-10 text-amber-500/40 mx-auto" />
            <p className="text-sm font-bold text-slate-200">No Tournaments Created Yet</p>
            <p className="text-xs text-slate-400">Create your venue's first 1v1 Esports tournament to get started!</p>
            <button
              onClick={() => onOpenPanelWithTab('create_tour')}
              className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Tournament
            </button>
          </div>
        ) : (
          tournaments.map((t) => {
            const players = db.getTournamentPlayers(t.id);
            const matches = db.getMatches(t.id);
            const isCompleted = t.status === 'Completed' || t.status === 'Finished';
            const isOngoing = t.status === 'Ongoing';

            return (
              <div
                key={t.id}
                className="bg-slate-850 border border-slate-750 rounded-2xl p-4 space-y-3 shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={t.image}
                      alt={t.tournamentName}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-sky-300 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 uppercase">
                        {t.game}
                      </span>
                      <h3 className="font-extrabold text-white text-sm mt-1 leading-snug truncate">{t.tournamentName}</h3>
                      <p className="text-xs text-slate-400 truncate">
                        {t.date} @ {t.time} • Max {t.maxPlayers} Players
                      </p>
                    </div>
                  </div>

                  {/* Status Selector */}
                  <select
                    value={isCompleted ? 'Completed' : t.status}
                    disabled={isCompleted}
                    onChange={(e) => {
                      const newStatus = e.target.value as TournamentStatus;
                      if (newStatus === 'Ongoing' && !isOngoing && !isCompleted) {
                        const tourPlayers = db.getTournamentPlayers(t.id);
                        const notAllCheckedIn = tourPlayers.length === 0 || tourPlayers.some((p) => p.playerStatus !== 'Checked In');
                        if (notAllCheckedIn) {
                          setShowCheckInAlert(true);
                          return;
                        }
                        setStartConfirmTour(t);
                      } else if (!isOngoing && !isCompleted) {
                        handleUpdateStatus(t.id, newStatus);
                      }
                    }}
                    className="bg-slate-900 border border-slate-700 text-xs font-black text-amber-400 px-2.5 py-1.5 rounded-xl focus:outline-hidden cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {!isOngoing && !isCompleted && (
                      <option value="Registration Open">Registration Open</option>
                    )}
                    <option value="Ongoing">Ongoing (Live Matches)</option>
                    {isCompleted && (
                      <option value="Completed" disabled>Completed (Finished)</option>
                    )}
                  </select>
                </div>

                {/* Roster & Match Quick Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1 font-medium">
                      <Users className="w-3.5 h-3.5 text-sky-400" /> Roster:
                    </span>
                    <strong className="text-white font-extrabold">
                      {players.length} / {t.maxPlayers}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1 font-medium">
                      <Swords className="w-3.5 h-3.5 text-purple-400" /> Matches:
                    </span>
                    <strong className="text-white font-extrabold">{matches.length}</strong>
                  </div>
                </div>

                {/* Organizer Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-750 text-xs font-bold">
                  <button
                    onClick={() => {
                      onOpenPanelWithTab('players');
                      telegramService.triggerHaptic('light');
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl border border-slate-700 min-h-[38px]"
                  >
                    Manage Players ({players.length})
                  </button>
                  <button
                    onClick={() => {
                      onOpenPanelWithTab('matches');
                      telegramService.triggerHaptic('light');
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl border border-slate-700 min-h-[38px]"
                  >
                    Add Match
                  </button>
                  <button
                    onClick={() => {
                      onOpenPanelWithTab('results');
                      telegramService.triggerHaptic('light');
                    }}
                    className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold rounded-xl border border-amber-500/30 min-h-[38px]"
                  >
                    Enter Scores
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* START TOURNAMENT CONFIRMATION MODAL */}
      {startConfirmTour && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 text-slate-100 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setStartConfirmTour(null)}
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
                onClick={() => setStartConfirmTour(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const tourPlayers = db.getTournamentPlayers(startConfirmTour.id);
                  const notAllCheckedIn = tourPlayers.length === 0 || tourPlayers.some((p) => p.playerStatus !== 'Checked In');
                  if (notAllCheckedIn) {
                    setStartConfirmTour(null);
                    setShowCheckInAlert(true);
                    return;
                  }
                  handleUpdateStatus(startConfirmTour.id, 'Ongoing');
                  setStartConfirmTour(null);
                }}
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
