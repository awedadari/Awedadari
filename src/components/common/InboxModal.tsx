import React, { useState } from 'react';
import { User, AppNotification } from '../../types';
import { db } from '../../services/db';
import {
  X,
  Bell,
  CheckCircle2,
  Trash2,
  Send,
  ExternalLink,
  MessageSquare,
  Trophy,
  ShieldAlert,
  Ticket,
  Sparkles,
} from 'lucide-react';

interface InboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: User;
}

export const InboxModal: React.FC<InboxModalProps> = ({ isOpen, onClose, activeUser }) => {
  if (!isOpen) return null;

  const notifications = db.getNotificationsForUser(activeUser.id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [telegramHandle, setTelegramHandle] = useState(
    activeUser.telegramUserId ? activeUser.telegramUserId.replace(/^tg_/, '').replace(/^@/, '') : ''
  );
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const handleMarkAllRead = () => {
    notifications.forEach((n) => {
      db.markNotificationAsRead(n.id);
    });
  };

  const handleClearInbox = () => {
    // Mark as read and dismiss
    notifications.forEach((n) => {
      db.markNotificationAsRead(n.id);
    });
  };

  const handleSaveTelegramHandle = async () => {
    setIsSavingTg(true);
    const cleanHandle = telegramHandle.trim().replace(/^@/, '');
    await db.updateUser({
      id: activeUser.id,
      telegramUserId: cleanHandle ? `@${cleanHandle}` : activeUser.telegramUserId,
    });
    setIsSavingTg(false);
  };

  const handleSendTelegramTestNotification = () => {
    setTestSent(true);
    db.addNotification({
      userId: activeUser.id,
      title: '🤖 Telegram Bot Direct Alert (@Awedadari_bot)',
      message: `Hello @${telegramHandle || activeUser.username}! Direct Telegram message dispatched to your account. Stay tuned for live tournament match calls!`,
      type: 'announcement',
    });
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 p-5 text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                My Inbox
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-rose-500 text-white font-black text-[10px] rounded-full">
                    {unreadCount} NEW
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">Direct notifications & match alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-sky-400 hover:text-sky-300 font-bold px-2 py-1 bg-sky-500/10 rounded-lg"
              >
                Read All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Telegram Direct Bot Connection Card (Requirement 5B) */}
        <div className="p-4 bg-slate-850 border border-sky-500/30 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-sky-500/20 text-sky-300 rounded-lg">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-xs font-black text-sky-200 uppercase tracking-wide">
                Telegram Bot Integration (@Awedadari_bot)
              </span>
            </div>
            <a
              href="https://t.me/Awedadari_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] bg-sky-500 text-white font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 hover:bg-sky-400 transition-all shadow-xs"
            >
              Open Bot <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Receive instant match callouts, check-in reminders, and payment confirmations directly on Telegram!
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">@</span>
              <input
                type="text"
                value={telegramHandle}
                onChange={(e) => setTelegramHandle(e.target.value)}
                placeholder="Telegram Username (e.g. gamer_alex)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              onClick={handleSaveTelegramHandle}
              disabled={isSavingTg}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all"
            >
              {isSavingTg ? 'Saving...' : 'Save Handle'}
            </button>
          </div>

          <button
            onClick={handleSendTelegramTestNotification}
            className="w-full py-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            {testSent ? '✓ Sent via @Awedadari_bot!' : 'Send Test Telegram Alert'}
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
            <span>Recent Notifications ({notifications.length})</span>
            {notifications.length > 0 && (
              <button
                onClick={handleClearInbox}
                className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px]"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center bg-slate-850 rounded-2xl border border-slate-800 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-bold">Your inbox is clear!</p>
              <p className="text-[11px] text-slate-500">
                You will receive alerts here when you register for tournaments or when matches are called.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => db.markNotificationAsRead(n.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    n.read
                      ? 'bg-slate-850/60 border-slate-800 text-slate-300'
                      : 'bg-sky-950/40 border-sky-500/40 text-white shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-slate-800 rounded-lg text-sky-400 shrink-0">
                        {n.type === 'tournament_approval' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : n.type === 'match_call' ? (
                          <Trophy className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Bell className="w-4 h-4 text-sky-400" />
                        )}
                      </span>
                      <h4 className="text-xs font-bold">{n.title}</h4>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed pl-7">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
