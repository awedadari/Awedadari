import React, { useState } from 'react';
import { db } from '../../services/db';
import { User, Tournament, Match } from '../../types';
import {
  Gamepad2,
  Send,
  Edit3,
  Trophy,
  Check,
  Shield,
  Camera,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  ChevronRight,
  X,
  MapPin,
  Calendar,
  Swords,
  Award,
  Sparkles,
} from 'lucide-react';

interface PlayerProfileProps {
  user: User;
}

export const PlayerProfile: React.FC<PlayerProfileProps> = ({ user }) => {
  const [gamertag, setGamertag] = useState(user.gamertag || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [saved, setSaved] = useState(false);

  React.useEffect(() => {
    setGamertag(user.gamertag || '');
    setPhoneNumber(user.phoneNumber || '');
  }, [user.id, user.gamertag, user.phoneNumber]);

  // Profile Image Upload State
  const [uploadingImage, setUploadingImage] = useState(false);

  // Organizer Request State
  const [showOrgReqModal, setShowOrgReqModal] = useState(false);
  const [orgReason, setOrgReason] = useState('');
  const [orgReqSubmittedMsg, setOrgReqSubmittedMsg] = useState('');

  // Selected Tournament History Modal State (Requirement 3)
  const [selectedTournamentHistory, setSelectedTournamentHistory] = useState<Tournament | null>(null);

  const userTournaments = db
    .getTournaments()
    .filter((t) => db.isPlayerRegistered(t.id, user.id))
    .sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return b.id.localeCompare(a.id);
    });

  const orgRequests = db.getOrganizerRequests();
  const userOrgReq = orgRequests.find((r) => r.userId === user.id);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.updateUser({
      id: user.id,
      gamertag: gamertag.trim(),
      phoneNumber: phoneNumber.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('File size exceeds 3MB. Please choose a smaller image.');
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        await db.updateUserProfilePhoto(user.id, base64);
      }
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitOrgRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.submitOrganizerRequest(user.id, orgReason.trim());
    setOrgReqSubmittedMsg('Your organizer request has been sent to the administrator for review.');
    setShowOrgReqModal(false);
    setOrgReason('');
    setTimeout(() => setOrgReqSubmittedMsg(''), 5000);
  };

  const handleTogglePerspectiveRole = async () => {
    try {
      await db.toggleUserRole(user.id);
    } catch (err: any) {
      setOrgReqSubmittedMsg('⚠️ Organizer privileges require Admin approval. Submit a request using the form below.');
      setTimeout(() => setOrgReqSubmittedMsg(''), 5000);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header Profile Card */}
      <div className="bg-slate-850 border border-slate-750 rounded-2xl p-5 text-center relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/10 rounded-full blur-xl pointer-events-none" />

        {/* Profile Avatar with Camera Change Overlay */}
        <div className="relative w-24 h-24 mx-auto group">
          <img
            src={user.profileImage}
            alt={user.name}
            className="w-24 h-24 rounded-full object-cover border-4 border-slate-750 shadow-md group-hover:opacity-90 transition-opacity"
          />
          <label
            htmlFor="profile-image-upload"
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center border-2 border-slate-900 cursor-pointer shadow-lg hover:bg-blue-500 transition-transform active:scale-95"
            title="Change Profile Picture"
          >
            {uploadingImage ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </label>
          <input
            id="profile-image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            className="hidden"
          />
        </div>

        <h2 className="text-lg font-bold text-white mt-3">{user.name}</h2>
        <p className="text-xs text-sky-400 font-mono flex items-center justify-center gap-1 mt-0.5">
          <Send className="w-3 h-3" />
          @{user.username}
        </p>
        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
          Telegram User ID: <strong className="text-white">{user.telegramUserId}</strong>
        </p>

        {/* Phone Badge */}
        {user.phoneNumber ? (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-full text-xs font-mono font-bold">
            <Phone className="w-3 h-3 text-emerald-400" />
            {user.phoneNumber}
          </div>
        ) : (
          <div className="mt-2 inline-flex items-center gap-1 px-3 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-full text-[11px] font-bold">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Phone Number Required
          </div>
        )}

        {/* Current Role Badge & Switcher */}
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              user.role === 'ORGANIZER'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Role: {user.role}
          </div>

          <button
            onClick={handleTogglePerspectiveRole}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-bold rounded-full border border-slate-700 flex items-center gap-1 transition-all active:scale-95"
            title="Switch your current perspective for testing"
          >
            <RefreshCw className="w-3 h-3 text-sky-400" />
            Switch to {user.role === 'PLAYER' ? 'ORGANIZER' : 'PLAYER'}
          </button>
        </div>
      </div>

      {/* REQUEST ORGANIZER PRIVILEGES SECTION */}
      {user.role === 'PLAYER' && (
        <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Organizer Access Status
            </h3>

            {userOrgReq?.status === 'pending' && (
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 animate-pulse" />
                Request Pending Admin Review
              </span>
            )}

            {userOrgReq?.status === 'approved' && (
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Approved by Admin
              </span>
            )}
          </div>

          {orgReqSubmittedMsg && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-medium">
              {orgReqSubmittedMsg}
            </div>
          )}

          <p className="text-xs text-slate-400 leading-relaxed">
            Want to host tournaments, manage brackets, and review player payments? Request organizer privileges from the app owner.
          </p>

          {!userOrgReq || userOrgReq.status === 'rejected' ? (
            <button
              onClick={() => setShowOrgReqModal(true)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
            >
              <ShieldCheck className="w-4 h-4" />
              Request Organizer Privileges
            </button>
          ) : userOrgReq.status === 'pending' ? (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-amber-300 flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Your request is under review by the administrator. Check back soon.</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Requirement 1: Phone Number Input in Credentials Form */}
      <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-emerald-400" />
          Gamertag & Required Contact Info
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">1v1 Esports Gamertag</label>
            <div className="relative">
              <input
                type="text"
                value={gamertag}
                onChange={(e) => setGamertag(e.target.value)}
                placeholder="e.g. Apex_Striker99, IronFist_Dave"
                className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 font-semibold"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Organizers use your gamertag to set up 1v1 console stations.
            </p>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-sky-400" />
                Phone Number
              </span>
              <span className="text-rose-400 text-[10px] font-bold uppercase">* Required for Tournaments</span>
            </label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. +251 91 234 5678 or 0911223344"
              className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Used by organizers to verify payment proof & send match notifications.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
          >
            {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Edit3 className="w-4 h-4" />}
            {saved ? 'Profile Saved Successfully!' : 'Save Profile Changes'}
          </button>
        </form>
      </div>

      {/* Requirement 3: Clickable "My Tournaments" History Section */}
      <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            My Tournaments ({userTournaments.length})
          </h3>
          <span className="text-[10px] text-slate-400 italic">Click any item for full history</span>
        </div>

        {userTournaments.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">You have not registered for any tournaments yet.</p>
        ) : (
          <div className="space-y-2">
            {userTournaments.map((t) => {
              const players = db.getTournamentPlayers(t.id);
              const playerRecord = players.find((p) => p.userId === user.id);
              const matches = db.getAllMatches().filter(
                (m) => m.tournamentId === t.id && (m.playerAId === user.id || m.playerBId === user.id)
              );
              const wins = matches.filter((m) => m.winnerId === user.id).length;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTournamentHistory(t)}
                  className="p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-750 hover:border-amber-500/40 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all shadow-md group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={t.image}
                      alt={t.tournamentName}
                      className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-700"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                        {t.tournamentName}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {t.game} • {t.date} • <span className="text-emerald-400 font-bold">{wins} Wins</span>
                      </p>
                      {playerRecord?.checkInCode && (
                        <p className="text-[10px] text-amber-300 font-mono font-bold mt-0.5">
                          Check-in Code: {playerRecord.checkInCode.replace(/^SG-/, '')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {playerRecord?.paymentStatus === 'PENDING_APPROVAL' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Payment Pending
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {playerRecord?.playerStatus || 'Registered'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Requirement 3 Modal: Tournament Match & Standing History */}
      {selectedTournamentHistory && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedTournamentHistory(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="space-y-2 border-b border-slate-800 pb-3 pr-8">
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-black rounded-full uppercase border border-amber-500/30">
                {selectedTournamentHistory.game}
              </span>
              <h3 className="text-base font-black text-white leading-snug">
                {selectedTournamentHistory.tournamentName}
              </h3>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-sky-400" /> {selectedTournamentHistory.date}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-400" /> {selectedTournamentHistory.venueName || 'Online'}
                </span>
                <span className="flex items-center gap-1 text-amber-300 font-bold">
                  Fee: {selectedTournamentHistory.registrationFee || '50 ETB'}
                </span>
              </div>
            </div>

            {/* Player Performance Overview Card */}
            {(() => {
              const players = db.getTournamentPlayers(selectedTournamentHistory.id);
              const pRecord = players.find((p) => p.userId === user.id);
              const tMatches = db.getAllMatches().filter(
                (m) => m.tournamentId === selectedTournamentHistory.id && (m.playerAId === user.id || m.playerBId === user.id)
              );
              const wins = tMatches.filter((m) => m.winnerId === user.id).length;
              const losses = tMatches.filter((m) => m.winnerId && m.winnerId !== user.id).length;

              return (
                <div className="p-3.5 bg-slate-850 rounded-2xl border border-slate-750 space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-extrabold uppercase">Status</span>
                      <span className="font-extrabold text-amber-300">{pRecord?.playerStatus || 'Registered'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-extrabold uppercase">Matches</span>
                      <span className="font-mono font-bold text-white">{tMatches.length} Played</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-extrabold uppercase">Record</span>
                      <span className="font-mono font-bold text-emerald-400">{wins}W - {losses}L</span>
                    </div>
                  </div>

                  {pRecord?.checkInCode && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-bold">Your Check-In Code:</span>
                      <span className="font-mono font-black text-amber-300 bg-amber-500/20 px-3 py-1 rounded-lg border border-amber-500/40 text-xs tracking-wider">
                        {pRecord.checkInCode.replace(/^SG-/, '')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Match History List */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-sky-400" /> Tournament Match History
              </h4>

              {(() => {
                const tMatches = db.getAllMatches().filter(
                  (m) => m.tournamentId === selectedTournamentHistory.id && (m.playerAId === user.id || m.playerBId === user.id)
                );

                if (tMatches.length === 0) {
                  return (
                    <div className="p-4 bg-slate-850 rounded-2xl border border-slate-750 text-center text-xs text-slate-400 space-y-1">
                      <p className="font-bold text-slate-300">No matches generated yet.</p>
                      <p className="text-[10px] text-slate-500">
                        Once the organizer sets up rounds and stations, your fixture history will appear here.
                      </p>
                    </div>
                  );
                }

                return tMatches.map((m) => {
                  const isPlayerA = m.playerAId === user.id;
                  const opponent = isPlayerA ? m.playerB : m.playerA;
                  const isWinner = m.winnerId === user.id;
                  const isFinished = m.status === 'Finished' || !!m.winnerId;

                  return (
                    <div
                      key={m.id}
                      className="p-3 bg-slate-850 border border-slate-750 rounded-2xl text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-[10px] border-b border-slate-800 pb-1 font-mono">
                        <span className="text-sky-400 font-bold">{m.round}</span>
                        {isFinished ? (
                          isWinner ? (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold">
                              VICTORY 🏆
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full font-bold">
                              DEFEAT
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-bold">
                            SCHEDULED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={opponent?.profileImage || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150'}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover border border-slate-700"
                          />
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">VS Opponent</span>
                            <span className="font-bold text-white">
                              {opponent?.gamertag || opponent?.name || 'TBD'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold">Score</span>
                          <span className="font-mono font-black text-amber-300 text-sm">
                            {m.score || '0 - 0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST ORGANIZER ROLE */}
      {showOrgReqModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Request Organizer Privileges
              </h3>
              <button
                onClick={() => setShowOrgReqModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitOrgRequest} className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Provide an optional message for the administrator describing the esports tournaments or venue events you plan to host.
              </p>

              <div>
                <label className="block text-slate-300 font-bold text-xs mb-1">
                  Reason / Venue Details (Optional)
                </label>
                <textarea
                  rows={3}
                  value={orgReason}
                  onChange={(e) => setOrgReason(e.target.value)}
                  placeholder="e.g. Hosting weekly 1v1 eFootball tournaments at Cyber Cafe Hub..."
                  className="w-full bg-slate-950 border border-slate-750 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrgReqModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
