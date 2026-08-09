import React, { useState } from 'react';
import { Tournament } from '../../types';
import { Trophy, Share2, Copy, Check, Send, X, ExternalLink } from 'lucide-react';
import { generateTournamentMiniAppDeepLink } from '../../services/telegramService';

interface InviteModalProps {
  tournament: Tournament;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ tournament, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const miniAppInviteUrl = generateTournamentMiniAppDeepLink(tournament.id);
  
  const tourAward = tournament.award?.trim() || tournament.prizePool?.trim();
  const awardLine = tourAward ? `\n🏆 Tournament Award: ${tourAward}` : '';

  const inviteMessage = `Awedadari Tournament Invitation 🏆

${tournament.tournamentName} (${tournament.game})
📍 Venue: ${tournament.venueName || 'Nexus Gaming Lounge'} (${tournament.venueLocation || 'Bole Medhanialem'})
📅 Date & Time: ${tournament.date} @ ${tournament.time}
💰 Entry Fee: ${tournament.registrationFee || '50 ETB'}${awardLine}
👥 Max Slots: ${tournament.maxPlayers} Players

Tap to view tournament & register:
${miniAppInviteUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(miniAppInviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
  };

  const handleShareTelegram = () => {
    const encodedText = encodeURIComponent(inviteMessage);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(miniAppInviteUrl)}&text=${encodedText}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl relative text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm">Invite Players</h3>
              <p className="text-[10px] text-slate-400">Share tournament link via Telegram Bot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tournament Mini Preview Card */}
        <div className="flex items-center gap-3 p-3 bg-slate-850 rounded-2xl border border-slate-750">
          <img
            src={tournament.image}
            alt={tournament.tournamentName}
            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-700"
          />
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
              {tournament.game}
            </span>
            <h4 className="font-extrabold text-xs text-white truncate">{tournament.tournamentName}</h4>
            <p className="text-[10px] text-slate-400 truncate">
              📍 {tournament.venueName} • Fee: {tournament.registrationFee}
            </p>
          </div>
        </div>

        {/* Direct Bot Link Input & Button */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">Mini App Deep Link</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={miniAppInviteUrl}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-hidden"
            />
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-sky-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Formatted Invite Message Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">Formatted Telegram Invitation</label>
            <button
              onClick={handleCopyText}
              className="text-[10px] text-amber-400 hover:underline font-bold flex items-center gap-1"
            >
              {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedText ? 'Copied Message!' : 'Copy Text'}
            </button>
          </div>
          <pre className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] text-slate-300 font-sans whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
            {inviteMessage}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={handleShareTelegram}
            className="py-2.5 px-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
            Share on Telegram
          </button>
          <button
            onClick={handleCopyText}
            className="py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <Copy className="w-4 h-4" />
            {copiedText ? 'Copied!' : 'Copy Full Invite'}
          </button>
        </div>
      </div>
    </div>
  );
};
