import React, { useState } from 'react';
import { db } from '../../services/db';
import { telegramService } from '../../services/telegramService';
import { normalizePhoneNumber } from '../../utils/phoneUtils';
import { User } from '../../types';
import { Send, Trophy, ShieldCheck, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface TelegramPhoneGateProps {
  user: User;
  onSuccess: (phone: string) => void;
}

export const TelegramPhoneGate: React.FC<TelegramPhoneGateProps> = ({ user, onSuccess }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSharePhone = async () => {
    setIsRequesting(true);
    setErrorFeedback(null);

    try {
      telegramService.triggerHaptic('medium');
      const contactPhone = await telegramService.requestContact();

      if (!contactPhone) {
        setErrorFeedback(
          'Phone sharing was cancelled or unavailable. A verified phone number is required to participate in Awedadari tournaments.'
        );
        telegramService.triggerHaptic('warning');
        return;
      }

      const normalized = normalizePhoneNumber(contactPhone);
      if (!normalized) {
        setErrorFeedback('Could not normalize the received phone number. Please try again.');
        telegramService.triggerHaptic('warning');
        return;
      }

      // Save phone permanently to user profile in Firestore and local storage
      await db.updateUser({
        id: user.id,
        phoneNumber: normalized,
      });

      setIsSuccess(true);
      telegramService.triggerHaptic('success');

      // Brief delay to display positive confirmation before entering the app
      setTimeout(() => {
        onSuccess(normalized);
      }, 700);
    } catch (err: any) {
      console.error('Error in TelegramPhoneGate:', err);
      setErrorFeedback(
        err?.message || 'Failed to retrieve phone number from Telegram. Please tap below to try again.'
      );
      telegramService.triggerHaptic('warning');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex items-center justify-center p-4 selection:bg-sky-500 selection:text-white">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-sky-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Icon & Title */}
        <div className="space-y-3 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-sky-600/30 to-blue-500/20 text-sky-400 rounded-2xl flex items-center justify-center mx-auto border border-sky-500/30 shadow-lg shadow-sky-500/10">
            {isSuccess ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-in zoom-in-75 duration-200" />
            ) : (
              <Trophy className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] font-bold text-sky-400 uppercase tracking-widest">
              <Sparkles className="w-3 h-3" /> Competitor Verification
            </div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">
              {isSuccess ? 'Identity Verified!' : 'Share Phone Number'}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed px-2">
              {isSuccess
                ? 'Your contact is linked. Entering Awedadari tournament lobby...'
                : `Welcome, ${user.name || 'Player'}! Organizers use your phone number to coordinate 1v1 match calls, station allocations, and prize payouts.`}
            </p>
          </div>
        </div>

        {/* Error Feedback Banner */}
        {errorFeedback && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-left text-rose-300 text-xs animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-snug">{errorFeedback}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="space-y-3 relative z-10 pt-2">
          <button
            type="button"
            id="btn_telegram_share_phone"
            disabled={isRequesting || isSuccess}
            onClick={handleSharePhone}
            className={`w-full py-3.5 px-4 font-extrabold rounded-2xl transition-all shadow-lg text-sm flex items-center justify-center gap-2.5 cursor-pointer active:scale-98 disabled:opacity-70 disabled:pointer-events-none ${
              isSuccess
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20'
            }`}
          >
            {isRequesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Waiting for Telegram...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Verified! Opening Lobby...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Share Phone Number from Telegram</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-500 leading-snug px-3">
            Telegram will prompt you to securely confirm sharing your contact details with Awedadari.
          </p>
        </div>

        {/* Security Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Private • Never displayed on public leaderboards</span>
        </div>
      </div>
    </div>
  );
};
