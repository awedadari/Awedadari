import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '../../services/db';
import { TELEGRAM_BOT_DEFAULT } from '../../services/telegramService';
import { Send, ExternalLink, AlertTriangle, Trophy, ShieldCheck } from 'lucide-react';

interface WebAuthScreenProps {
  onAuthSuccess?: () => void;
}

export const WebAuthScreen: React.FC<WebAuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true);
    setErrorMessage(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      const fbUser = userCredential.user;

      if (!fbUser) {
        throw new Error('Google authentication did not return a user.');
      }

      await db.processGoogleUser(fbUser);
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setErrorMessage('Sign-in popup was closed before completing.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setErrorMessage('This web domain is not yet authorized in Firebase Authentication Console. Please add this domain to Authorized Domains.');
      } else {
        setErrorMessage(err?.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-sky-500 selection:text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Brand Icon Header */}
        <div className="space-y-3 relative z-10">
          <div className="w-16 h-16 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center mx-auto border border-sky-500/30 shadow-lg shadow-sky-500/10">
            <Trophy className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-sky-400">
              Tournament Center
            </div>
            <h1 className="text-xl font-black text-slate-100 uppercase tracking-tight">
              AWEDADARI
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed px-2">
              Sign in to view brackets, submit match results, and track competitive rankings.
            </p>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2.5 text-left text-red-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Actions Container */}
        <div className="space-y-3 relative z-10">
          {/* Primary Action: Continue with Google */}
          <button
            id="btn_continue_with_google"
            onClick={handleGoogleSignIn}
            disabled={isLoadingGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl transition-all shadow-lg text-sm active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
          >
            {isLoadingGoogle ? (
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isLoadingGoogle ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          {/* Secondary Action: Open in Telegram Mini App */}
          <a
            id="link_continue_with_telegram"
            href={`https://t.me/${TELEGRAM_BOT_DEFAULT.botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold rounded-2xl border border-sky-500/20 transition-all text-sm active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Continue with Telegram</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
        </div>

        {/* Security Badge Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Unified Firestore & Auth Security</span>
        </div>
      </div>
    </div>
  );
};
