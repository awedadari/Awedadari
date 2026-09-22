import React, { useState, useEffect, useRef } from 'react';
import { RecaptchaVerifier, linkWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth, db } from '../../services/db';
import { normalizePhoneNumber } from '../../utils/phoneUtils';
import { User } from '../../types';
import { Phone, ShieldCheck, AlertCircle, Loader2, Sparkles, CheckCircle2, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';

interface WebPhoneVerificationGateProps {
  user: User;
  onSuccess: (phone: string) => void;
}

export const WebPhoneVerificationGate: React.FC<WebPhoneVerificationGateProps> = ({ user, onSuccess }) => {
  const [step, setStep] = useState<'PHONE_INPUT' | 'CODE_INPUT'>('PHONE_INPUT');
  const [rawPhone, setRawPhone] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);

  // Clean up recaptcha on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          // ignore cleanup errors
        }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const getOrCreateRecaptchaVerifier = () => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }
    const verifier = new RecaptchaVerifier(auth, 'web-recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        setErrorMessage('reCAPTCHA expired. Please try sending the code again.');
      },
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const clean = rawPhone.trim() ? normalizePhoneNumber(rawPhone.trim()) : '';
    if (!clean || clean.length < 9) {
      setErrorMessage('Please enter a valid phone number (e.g. +251 91 234 5678 or 0911223344).');
      return;
    }

    if (!auth.currentUser) {
      setErrorMessage('User session not found. Please refresh and log in again.');
      return;
    }

    setIsSendingCode(true);
    setNormalizedPhone(clean);

    try {
      const verifier = getOrCreateRecaptchaVerifier();
      
      // Critical: linkWithPhoneNumber attaches phone credential to the EXISTING auth.currentUser!
      // This guarantees no secondary Firebase user or duplicate profile is created.
      const confirmationResult = await linkWithPhoneNumber(auth.currentUser, clean, verifier);
      confirmationResultRef.current = confirmationResult;
      setStep('CODE_INPUT');
    } catch (err: any) {
      console.error('Error sending phone verification code:', err);
      if (err.code === 'auth/provider-already-linked') {
        // If phone provider is already linked to this auth user, update profile directly
        await db.updateUser({
          id: user.id,
          phoneNumber: clean,
        });
        setIsSuccess(true);
        setTimeout(() => onSuccess(clean), 700);
        return;
      } else if (err.code === 'auth/credential-already-in-use') {
        setErrorMessage('This phone number is already linked to another account. Please use your own phone number.');
      } else if (err.code === 'auth/invalid-phone-number') {
        setErrorMessage('The phone number format is invalid. Please check the digits and country code.');
      } else if (err.code === 'auth/quota-exceeded') {
        setErrorMessage('SMS verification quota exceeded. Please contact support or try again later.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMessage('Too many SMS requests sent. Please wait a few minutes before trying again.');
      } else if (err.code === 'auth/captcha-check-failed') {
        setErrorMessage('Security verification failed. Please refresh the page and try again.');
      } else {
        setErrorMessage(err?.message || 'Failed to send SMS verification code. Please try again.');
      }

      // Reset recaptcha if failed so user can retry
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {}
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const code = verificationCode.trim();
    if (!code || code.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code sent to your phone.');
      return;
    }

    if (!confirmationResultRef.current) {
      setErrorMessage('Verification session expired. Please request a new code.');
      setStep('PHONE_INPUT');
      return;
    }

    setIsVerifyingCode(true);

    try {
      // Confirm the 6-digit SMS code with Firebase
      await confirmationResultRef.current.confirm(code);

      // Save verified canonical phone permanently to user profile
      await db.updateUser({
        id: user.id,
        phoneNumber: normalizedPhone,
      });

      setIsSuccess(true);

      setTimeout(() => {
        onSuccess(normalizedPhone);
      }, 700);
    } catch (err: any) {
      console.error('Error confirming phone verification code:', err);
      if (err.code === 'auth/invalid-verification-code') {
        setErrorMessage('Invalid verification code. Please check the code and try again.');
      } else if (err.code === 'auth/code-expired') {
        setErrorMessage('This verification code has expired. Please request a new code.');
      } else {
        setErrorMessage(err?.message || 'Verification failed. Please check the code and try again.');
      }
    } finally {
      setIsVerifyingCode(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex items-center justify-center p-4 selection:bg-sky-500 selection:text-white">
      {/* Invisible ReCAPTCHA Container */}
      <div id="web-recaptcha-container" />

      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-sky-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="space-y-3 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-sky-600/30 to-blue-500/20 text-sky-400 rounded-2xl flex items-center justify-center mx-auto border border-sky-500/30 shadow-lg shadow-sky-500/10">
            {isSuccess ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-in zoom-in-75 duration-200" />
            ) : step === 'PHONE_INPUT' ? (
              <Phone className="w-8 h-8" />
            ) : (
              <KeyRound className="w-8 h-8 text-sky-400" />
            )}
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] font-bold text-sky-400 uppercase tracking-widest">
              <Sparkles className="w-3 h-3" /> One-Time Setup
            </div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">
              {isSuccess
                ? 'Phone Verified!'
                : step === 'PHONE_INPUT'
                ? 'Verify Your Phone'
                : 'Enter Verification Code'}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed px-2">
              {isSuccess
                ? 'Your phone identity has been verified. Opening tournament lobby...'
                : step === 'PHONE_INPUT'
                ? 'A verified phone number is required for 1v1 match calls, station allocations, and tournament prizes.'
                : `We sent a 6-digit SMS verification code to ${normalizedPhone}. Enter it below.`}
            </p>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-left text-rose-300 text-xs animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Phone Input Form */}
        {step === 'PHONE_INPUT' && (
          <form onSubmit={handleSendCode} className="space-y-4 relative z-10 text-left">
            <div>
              <label className="block text-slate-300 font-bold text-xs mb-1.5 flex items-center justify-between">
                <span>Phone Number</span>
                <span className="text-sky-400 text-[10px] font-medium">Ethiopia (+251) or Intl</span>
              </label>
              <input
                id="input_web_phone"
                type="tel"
                required
                disabled={isSendingCode || isSuccess}
                value={rawPhone}
                onChange={(e) => setRawPhone(e.target.value)}
                placeholder="e.g. 0911223344 or +251 91 234 5678"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-3 text-white font-mono text-sm placeholder:text-slate-600 focus:outline-hidden focus:border-sky-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Formats supported: 09..., 07..., +251..., or international.
              </p>
            </div>

            <button
              id="btn_web_send_code"
              type="submit"
              disabled={isSendingCode || isSuccess || !rawPhone.trim()}
              className="w-full py-3.5 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold rounded-2xl transition-all shadow-lg shadow-sky-500/20 text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60 disabled:pointer-events-none"
            >
              {isSendingCode ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Sending SMS Code...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: SMS Code Input Form */}
        {step === 'CODE_INPUT' && (
          <form onSubmit={handleVerifyCode} className="space-y-4 relative z-10 text-left">
            <div>
              <label className="block text-slate-300 font-bold text-xs mb-1.5 flex items-center justify-between">
                <span>6-Digit Verification Code</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep('PHONE_INPUT');
                    setErrorMessage(null);
                    setVerificationCode('');
                  }}
                  className="text-sky-400 hover:underline text-[10px] font-semibold"
                >
                  Change number
                </button>
              </label>
              <input
                id="input_web_sms_code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                disabled={isVerifyingCode || isSuccess}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-3 text-center text-white font-mono tracking-widest text-lg placeholder:text-slate-700 focus:outline-hidden focus:border-sky-500 transition-colors"
              />
            </div>

            <button
              id="btn_web_verify_code"
              type="submit"
              disabled={isVerifyingCode || isSuccess || verificationCode.length !== 6}
              className={`w-full py-3.5 px-4 font-extrabold rounded-2xl transition-all shadow-lg text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60 disabled:pointer-events-none ${
                isSuccess
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20'
              }`}
            >
              {isVerifyingCode ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Verifying Code...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Verified! Opening Lobby...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify & Enter Tournament Lobby</span>
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                disabled={isSendingCode || isVerifyingCode}
                onClick={handleSendCode}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Didn't receive code? Resend SMS</span>
              </button>
            </div>
          </form>
        )}

        {/* Security Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Private • Never displayed on public leaderboards</span>
        </div>
      </div>
    </div>
  );
};
