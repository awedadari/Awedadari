import React from 'react';
import { User, Tournament, TournamentPlayer } from '../../types';
import { db } from '../../services/db';
import {
  X,
  User as UserIcon,
  Phone,
  Send,
  Trophy,
  Award,
  Calendar,
  Gamepad2,
  Shield,
  CheckCircle2,
  Star,
  ExternalLink,
  Crown,
  Medal,
} from 'lucide-react';

interface PlayerDetailModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  userId,
  isOpen,
  onClose,
  currentUser,
}) => {
  if (!isOpen || !userId) return null;

  const targetUser = db.getUserById(userId);
  if (!targetUser) return null;

  // Gather stats
  const allTournaments = db.getTournaments();
  const playerRegistrations = db.getTournamentPlayersForUser(userId);
  const registeredTournaments = allTournaments.filter((t) =>
    playerRegistrations.some((p) => p.tournamentId === t.id)
  );

  // Calculate total wins/championships
  let championships = 0;
  let runnerUps = 0;
  allTournaments.forEach((t) => {
    if (t.finalStandings && t.finalStandings.length > 0) {
      const standing = t.finalStandings.find((s) => s.userId === userId);
      if (standing) {
        if (standing.rank === 1) championships++;
        else if (standing.rank === 2) runnerUps++;
      }
    }
  });

  const cleanTgHandle = targetUser.telegramUserId
    ? targetUser.telegramUserId.replace(/^tg_/, '').replace(/^@/, '')
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 p-5 text-slate-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
          <div className="relative shrink-0">
            <img
              src={targetUser.profileImage}
              alt={targetUser.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-sky-500/50 shadow-md"
            />
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                targetUser.role === 'ORGANIZER' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white truncate">{targetUser.name}</h2>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                  targetUser.role === 'ORGANIZER'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                }`}
              >
                {targetUser.role}
              </span>
            </div>

            <p className="text-xs text-sky-400 font-mono font-semibold">
              @{targetUser.username || targetUser.gamertag}
            </p>

            {targetUser.gamertag && (
              <p className="text-xs text-slate-300 flex items-center gap-1 mt-1 font-semibold">
                <Gamepad2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Gamertag: <span className="text-amber-300">{targetUser.gamertag}</span>
              </p>
            )}

            {targetUser.favGame && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Fav Game: <strong className="text-slate-200">{targetUser.favGame}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Bio / Description */}
        {targetUser.bio && (
          <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed italic">
            "{targetUser.bio}"
          </div>
        )}

        {/* Direct Contact Buttons (Requirement 9 & 7) */}
        <div className="grid grid-cols-2 gap-2.5">
          {targetUser.phoneNumber ? (
            <a
              href={`tel:${targetUser.phoneNumber}`}
              className="py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
              Call ({targetUser.phoneNumber})
            </a>
          ) : (
            <div className="py-2.5 px-3 bg-slate-800/50 border border-slate-800 text-slate-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-1">
              <Phone className="w-3.5 h-3.5" /> No Phone Added
            </div>
          )}

          {cleanTgHandle ? (
            <a
              href={`https://t.me/${cleanTgHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Send className="w-4 h-4 text-sky-400" />
              Telegram (@{cleanTgHandle})
            </a>
          ) : (
            <div className="py-2.5 px-3 bg-slate-800/50 border border-slate-800 text-slate-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-1">
              <Send className="w-3.5 h-3.5" /> No Telegram Handle
            </div>
          )}
        </div>

        {/* Player Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center">
            <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <div className="text-base font-black text-white">{registeredTournaments.length}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Tournaments</div>
          </div>

          <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center">
            <Crown className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <div className="text-base font-black text-amber-300">{championships}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Titles</div>
          </div>

          <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center">
            <Medal className="w-5 h-5 text-sky-400 mx-auto mb-1" />
            <div className="text-base font-black text-sky-300">{runnerUps}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Runner-ups</div>
          </div>
        </div>

        {/* Game-Specific Competitive Ratings */}
        {(() => {
          const gameStats = db.getPlayerAllGameStats(userId);
          if (gameStats.length === 0) return null;
          return (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Gamepad2 className="w-4 h-4 text-emerald-400" /> Competitive Game Ratings
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {gameStats.map((gs) => (
                  <div
                    key={gs.gameKey}
                    className="p-2.5 bg-slate-850 border border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-1">
                      <span className="font-bold text-white text-xs block truncate">{gs.gameName}</span>
                      <span className="text-[10px] text-slate-400">
                        {gs.tournamentsPlayed} {gs.tournamentsPlayed === 1 ? 'event' : 'events'}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 shrink-0">
                      {gs.rating} PTS
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Attended Tournaments History */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-sky-400" /> Tournament History ({registeredTournaments.length})
          </h3>

          {registeredTournaments.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No tournaments attended yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {registeredTournaments.map((t) => {
                const reg = playerRegistrations.find((p) => p.tournamentId === t.id);
                const standing = t.finalStandings?.find((s) => s.userId === userId);

                return (
                  <div
                    key={t.id}
                    className="p-3 bg-slate-850 border border-slate-800 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={t.image}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                      />
                      <div>
                        <h4 className="font-bold text-white leading-tight">{t.tournamentName}</h4>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{t.game}</span>
                          <span>•</span>
                          <span>{t.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {standing ? (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black text-[10px] rounded-full flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-400" /> Rank #{standing.rank}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-sky-500/10 text-sky-300 font-bold text-[10px] rounded-full">
                          {reg?.playerStatus || 'Registered'}
                        </span>
                      )}
                      {reg?.checkInCode && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Code: {reg.checkInCode.replace(/^SG-/, '')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
