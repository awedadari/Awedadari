import React, { useState } from 'react';
import { db } from '../services/db';
import { telegramService } from '../services/telegramService';
import { User, TelegramUser } from '../types';
import {
  Send,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Zap,
  X,
  Plus,
  Trash2,
  Smartphone,
  Sparkles,
  Info,
} from 'lucide-react';

interface TelegramBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: User;
}

export const TelegramBotModal: React.FC<TelegramBotModalProps> = ({
  isOpen,
  onClose,
  activeUser,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBotCmd, setCopiedBotCmd] = useState(false);
  const [botUsername, setBotUsername] = useState('Awedadari_bot');
  const [newOrganizerId, setNewOrganizerId] = useState('');
  const [organizerActionMsg, setOrganizerActionMsg] = useState('');

  // Custom Telegram Auth Simulation State
  const [simTgId, setSimTgId] = useState('88492019');
  const [simFirstName, setSimFirstName] = useState('Marcus');
  const [simLastName, setSimLastName] = useState('Vane');
  const [simUsername, setSimUsername] = useState('marcus_esports');
  const [simPhotoUrl, setSimPhotoUrl] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  );
  const [simSuccessMsg, setSimSuccessMsg] = useState('');

  if (!isOpen) return null;

  const currentAppUrl = typeof window !== 'undefined' ? window.location.href : 'https://ai.studio/build';
  const approvedIds = db.getApprovedOrganizerIds();
  const isCurrentApproved = db.isApprovedOrganizer(activeUser.telegramUserId);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopiedLink(true);
    telegramService.triggerHaptic('success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyBotCmd = () => {
    const cmd = `/setmenubutton\nSelect your bot: @${botUsername}\nMenu Button text: Tournament Center\nURL: ${currentAppUrl}`;
    navigator.clipboard.writeText(cmd);
    setCopiedBotCmd(true);
    telegramService.triggerHaptic('success');
    setTimeout(() => setCopiedBotCmd(false), 2500);
  };

  const handleAddOrganizerId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrganizerId.trim()) return;
    const success = db.addApprovedOrganizerId(newOrganizerId.trim());
    if (success) {
      setOrganizerActionMsg(`Telegram ID ${newOrganizerId.trim()} added to Approved Organizers!`);
      setNewOrganizerId('');
      telegramService.triggerHaptic('success');
    } else {
      setOrganizerActionMsg(`Telegram ID ${newOrganizerId.trim()} is already in approved list.`);
    }
    setTimeout(() => setOrganizerActionMsg(''), 3000);
  };

  const handleRemoveOrganizerId = (id: string) => {
    db.removeApprovedOrganizerId(id);
    setOrganizerActionMsg(`Removed Telegram ID ${id} from Approved Organizers.`);
    telegramService.triggerHaptic('medium');
    setTimeout(() => setOrganizerActionMsg(''), 3000);
  };

  // Preset Telegram Auth Simulations
  const handleSimulateAuth = (tgUser: TelegramUser) => {
    const res = db.processTelegramUser(tgUser);
    telegramService.triggerHaptic('success');
    setSimSuccessMsg(
      res.isNewUser
        ? `Created new profile for Telegram User @${tgUser.username || tgUser.id} with role [${res.roleGiven}]!`
        : `Authenticated Telegram User @${tgUser.username || tgUser.id} (Role: ${res.roleGiven}).`
    );
    setTimeout(() => setSimSuccessMsg(''), 4000);
  };

  const handleRunCustomSim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simTgId.trim()) return;

    handleSimulateAuth({
      id: simTgId.trim(),
      first_name: simFirstName.trim() || 'Telegram',
      last_name: simLastName.trim() || 'User',
      username: simUsername.trim() || `user_${simTgId.trim()}`,
      photo_url: simPhotoUrl.trim() || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 flex flex-col">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center border border-sky-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                Telegram Bot & Auth Center
                <span className="text-[10px] bg-sky-500/20 text-sky-300 font-mono px-2 py-0.5 rounded-full border border-sky-500/30">
                  MINI APP
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Telegram Authentication & Bot Setup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 text-xs">
          {/* Active User Telegram Auth Banner */}
          <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                Active Telegram Profile
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                  activeUser.role === 'ORGANIZER'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                }`}
              >
                ROLE: {activeUser.role}
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <img
                src={activeUser.profileImage}
                alt=""
                className="w-11 h-11 rounded-full object-cover border-2 border-sky-500/30 shadow-md"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-white text-sm truncate">{activeUser.name}</h3>
                <p className="text-sky-300 font-mono text-[11px] truncate">
                  @{activeUser.username} • ID: <strong className="text-white">{activeUser.telegramUserId}</strong>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {isCurrentApproved ? (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" /> Approved Organizer ID
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Standard Player Account</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {simSuccessMsg && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-300 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {simSuccessMsg}
            </div>
          )}

          {/* TELEGRAM BOT CONNECTION INSTRUCTIONS */}
          <div className="bg-slate-850 border border-slate-750 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-sky-400" />
                Connect Telegram Bot Menu Button
              </h3>
              <span className="text-[10px] text-sky-300 font-mono">botfather guide</span>
            </div>

            <div className="space-y-2 text-[11px] text-slate-300 leading-normal">
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-white block">Step 1: Open Telegram & @BotFather</span>
                <p className="text-slate-400">Search for <strong>@BotFather</strong> on Telegram and tap Start.</p>
              </div>

              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-white block">Step 2: Set Bot Menu Button WebApp URL</span>
                <p className="text-slate-400">
                  Send command <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded font-mono">/setmenubutton</code> to BotFather, pick your bot username, then paste this WebApp URL:
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={currentAppUrl}
                    className="flex-1 bg-slate-950 border border-slate-750 rounded-lg px-2.5 py-1.5 font-mono text-[10px] text-sky-300 truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-white block">Step 3: Launch Mini App in Telegram</span>
                <p className="text-slate-400">
                  Open your bot chat in Telegram and tap the <strong>Menu Button</strong> on the bottom left corner. The Mini App opens instantly with automatic Telegram identity retrieval!
                </p>
              </div>
            </div>
          </div>

          {/* APPROVED ORGANIZER TELEGRAM IDs WHITELIST */}
          <div className="bg-slate-850 border border-slate-750 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Approved Organizer Telegram IDs
              </h3>
              <span className="text-[10px] text-slate-400">Role Whitelist</span>
            </div>

            <p className="text-[11px] text-slate-300">
              Users logging in with a Telegram User ID from this list are automatically assigned <strong>ORGANIZER</strong> permissions.
            </p>

            {organizerActionMsg && (
              <div className="p-2 bg-emerald-500/20 text-emerald-300 text-[11px] rounded-lg border border-emerald-500/30">
                {organizerActionMsg}
              </div>
            )}

            <form onSubmit={handleAddOrganizerId} className="flex gap-2">
              <input
                type="text"
                value={newOrganizerId}
                onChange={(e) => setNewOrganizerId(e.target.value)}
                placeholder="Enter Telegram User ID (e.g. 55443322)"
                className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Add ID
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {approvedIds.map((id) => (
                <div
                  key={id}
                  className="px-2.5 py-1 bg-slate-900 border border-amber-500/30 rounded-xl text-[11px] font-mono text-amber-300 flex items-center gap-1.5"
                >
                  <span>TG ID: {id}</span>
                  <button
                    onClick={() => handleRemoveOrganizerId(id)}
                    className="text-slate-500 hover:text-rose-400 ml-1"
                    title="Remove from approved organizers"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between sticky bottom-0">
          <span className="text-[10px] text-slate-400 font-mono">Telegram Mini App v2.0</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
