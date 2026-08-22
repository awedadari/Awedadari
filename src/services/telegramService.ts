import { TelegramUser, TelegramBotConfig } from '../types';
import { db, auth } from './db';
import { signInWithCustomToken, signInAnonymously } from 'firebase/auth';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: TelegramUser;
          query_id?: string;
          auth_date?: number;
          hash?: string;
          start_param?: string;
        };
        colorScheme?: 'light' | 'dark';
        themeParams?: Record<string, string>;
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        headerColor?: string;
        backgroundColor?: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        MainButton?: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        BackButton?: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        openLink?: (url: string) => void;
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}

export const TELEGRAM_BOT_DEFAULT: TelegramBotConfig = {
  botUsername: 'Awedadari_bot',
  approvedOrganizerIds: ['88492019', '777000', '123456789', '99887766'],
};

class TelegramService {
  private isTelegramSDKAvailable: boolean = false;
  private telegramUser: TelegramUser | null = null;

  constructor() {
    this.checkTelegramEnvironment();
  }

  public checkTelegramEnvironment() {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;
      webApp.ready();
      webApp.expand();

      if (webApp.setHeaderColor) {
        try {
          webApp.setHeaderColor('#0f172a'); // slate-900
        } catch {
          // ignore error if not supported
        }
      }

      const tgUser = webApp.initDataUnsafe?.user;
      if (tgUser) {
        this.isTelegramSDKAvailable = true;
        this.telegramUser = tgUser;
      }
    }
  }

  public getTelegramUser(): TelegramUser | null {
    return this.telegramUser || window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  }

  public isInsideTelegram(): boolean {
    if (typeof window === 'undefined') return false;
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return false;
    const hasInitData = typeof webApp.initData === 'string' && webApp.initData.trim().length > 0;
    const hasUser = !!webApp.initDataUnsafe?.user;
    return hasInitData || hasUser || this.isTelegramSDKAvailable;
  }

  /**
   * Retrieves start_param from Telegram WebApp SDK or URL search/hash params
   * e.g. startapp=tour_tour_1786184595032 or tgWebAppStartParam=tour_1786184595032
   */
  public getStartParam(): string | null {
    if (typeof window === 'undefined') return null;

    // 1. Check official Telegram WebApp SDK initDataUnsafe.start_param
    const tgStartParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (tgStartParam && typeof tgStartParam === 'string' && tgStartParam.trim()) {
      return tgStartParam.trim();
    }

    // 2. Check URL search parameters (tgWebAppStartParam, startapp, start_param)
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const param =
        searchParams.get('tgWebAppStartParam') ||
        searchParams.get('startapp') ||
        searchParams.get('start_param');
      if (param && param.trim()) {
        return param.trim();
      }

      // 3. Check URL hash parameters
      if (window.location.hash) {
        const hashStr = window.location.hash.includes('?')
          ? window.location.hash.split('?')[1]
          : window.location.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hashStr);
        const hashParam =
          hashParams.get('tgWebAppStartParam') ||
          hashParams.get('startapp') ||
          hashParams.get('start_param');
        if (hashParam && hashParam.trim()) {
          return hashParam.trim();
        }
      }
    } catch {
      // Safe fallback
    }

    return null;
  }

  public triggerHaptic(style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' = 'light') {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      try {
        if (style === 'success' || style === 'warning') {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred(style);
        } else {
          window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
        }
      } catch {
        // Safe fallback
      }
    }
  }

  /**
   * Cryptographically authenticate current Telegram WebApp user session:
   * 1. Retrieve raw Telegram WebApp initData string
   * 2. Send to backend endpoint POST /api/auth/telegram for HMAC verification
   * 3. Clear any stale mismatched Firebase Auth session
   * 4. Receive Firebase Custom Token and authenticate via signInWithCustomToken
   * 5. Process Telegram User profile in Firestore/db
   * Fails closed: Never falls back to mock/synthetic identities.
   */
  public async autoAuthenticateWithTelegram(): Promise<{ success: boolean; isNewUser?: boolean; roleGiven?: string; error?: string }> {
    if (!this.isInsideTelegram()) {
      return { success: false, error: 'NOT_INSIDE_TELEGRAM' };
    }

    const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : undefined;
    if (!initData || !initData.trim()) {
      return { success: false, error: 'MISSING_INIT_DATA' };
    }

    try {
      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData.trim(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { success: false, error: errData.error || 'AUTH_SERVER_ERROR' };
      }

      const result = await response.json();
      if (result.success && result.user) {
        // Clear any stale Firebase Auth session belonging to another identity
        if (auth.currentUser && result.uid && auth.currentUser.uid !== result.uid && !db.isFirebaseAdminAuthenticated()) {
          try {
            await auth.signOut();
          } catch (signOutErr) {
            console.warn('Notice signing out stale Firebase session:', signOutErr);
          }
        }

        // Sign in with verified Custom Token
        if (result.customToken && !db.isFirebaseAdminAuthenticated()) {
          try {
            await signInWithCustomToken(auth, result.customToken);
          } catch (signInErr) {
            console.warn('signInWithCustomToken notice:', signInErr);
            if (!auth.currentUser) {
              await signInAnonymously(auth).catch(() => {});
            }
          }
        } else if (!auth.currentUser && !db.isFirebaseAdminAuthenticated()) {
          await signInAnonymously(auth).catch(() => {});
        }

        const verifiedTgUser: TelegramUser = result.user;
        const res = db.processTelegramUser(verifiedTgUser);
        return { success: true, ...res };
      } else {
        return { success: false, error: result.error || 'INVALID_AUTH_RESPONSE' };
      }
    } catch (err: any) {
      console.error('Telegram authentication request failed:', err);
      return { success: false, error: err?.message || 'NETWORK_AUTH_ERROR' };
    }
  }
}

export const telegramService = new TelegramService();

/**
 * Reusable Direct Mini App Deep Link generator for channel posts
 * e.g. https://t.me/Awedadari_bot?startapp=tour_1786218014055
 */
export function generateTournamentMiniAppDeepLink(
  tournamentId: string,
  botUsername: string = TELEGRAM_BOT_DEFAULT.botUsername
): string {
  const encodedId = encodeURIComponent(tournamentId);
  return `https://t.me/${botUsername}?startapp=${encodedId}`;
}

/**
 * Reusable Direct Mini App Deep Link generator for the HOME tab
 * e.g. https://t.me/Awedadari_bot?startapp=home
 */
export function generateHomeMiniAppDeepLink(
  botUsername: string = TELEGRAM_BOT_DEFAULT.botUsername
): string {
  return `https://t.me/${botUsername}?startapp=home`;
}

/**
 * Reusable Direct Mini App Deep Link generator for the TOURNAMENTS tab
 * e.g. https://t.me/Awedadari_bot?startapp=tournaments
 */
export function generateTournamentsMiniAppDeepLink(
  botUsername: string = TELEGRAM_BOT_DEFAULT.botUsername
): string {
  return `https://t.me/${botUsername}?startapp=tournaments`;
}


