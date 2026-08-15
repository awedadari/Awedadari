import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { User as FirebaseUser } from 'firebase/auth';

export type AdminSessionState = 'ACTIVE' | 'WARNING' | 'EXPIRED' | 'LOGGED_OUT';
export type AdminLogoutReason = 'INACTIVITY' | 'MAX_DURATION' | 'MANUAL' | null;

// Security Timeout Configurations
export const ADMIN_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const ADMIN_WARNING_THRESHOLD_MS = 25 * 60 * 1000;  // 25 minutes (5 min warning)
export const ADMIN_ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12 hours max lifetime
const ACTIVITY_THROTTLE_MS = 2000; // 2 seconds throttle for activity events
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000; // 1 minute max future clock tolerance
const MINIMUM_VALID_EPOCH_MS = 1700000000000; // Sanity epoch check (Nov 2023)

export const ADMIN_SESSION_STORAGE_KEY = 'tc_admin_session_v2';
const CHANNEL_NAME = 'tc_admin_session_channel';

export interface AdminSessionMetadata {
  adminUid: string;
  sessionStartedAt: number; // Exact epoch timestamp when explicit admin login occurred
  lastActivityAt: number;   // Exact epoch timestamp of last verified activity
}

/**
 * Safely retrieves and sanitizes stored admin session metadata from durable storage.
 * Enforces strict type, range, sanity, and anti-tampering bounds.
 *
 * NOTE: This metadata is ONLY session timing metadata for an already-authenticated
 * Firebase Admin. It is NEVER an authentication authority on its own.
 */
export function getAdminSessionMetadata(): AdminSessionMetadata | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.adminUid === 'string' &&
      parsed.adminUid.trim().length > 0 &&
      typeof parsed.sessionStartedAt === 'number' &&
      typeof parsed.lastActivityAt === 'number' &&
      Number.isSafeInteger(parsed.sessionStartedAt) &&
      Number.isSafeInteger(parsed.lastActivityAt) &&
      parsed.sessionStartedAt >= MINIMUM_VALID_EPOCH_MS &&
      parsed.lastActivityAt >= MINIMUM_VALID_EPOCH_MS
    ) {
      const now = Date.now();

      // Reject future timestamps exceeding clock skew tolerance
      if (
        parsed.sessionStartedAt > now + CLOCK_SKEW_TOLERANCE_MS ||
        parsed.lastActivityAt > now + CLOCK_SKEW_TOLERANCE_MS
      ) {
        return null;
      }

      // Reject impossible time ordering (sessionStartedAt cannot be after lastActivityAt + tolerance)
      if (parsed.sessionStartedAt > parsed.lastActivityAt + CLOCK_SKEW_TOLERANCE_MS) {
        return null;
      }

      return {
        adminUid: parsed.adminUid.trim(),
        sessionStartedAt: parsed.sessionStartedAt,
        lastActivityAt: parsed.lastActivityAt,
      };
    }
  } catch {
    // Return null on JSON or storage error (fail-closed)
  }
  return null;
}

/**
 * Saves or updates admin session metadata in durable storage.
 */
export function saveAdminSessionMetadata(metadata: AdminSessionMetadata): void {
  try {
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(metadata));
  } catch {
    // Fail-safe storage handling
  }
}

/**
 * Clears admin session metadata from durable storage.
 */
export function clearAdminSessionMetadata(): void {
  try {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // Fail-safe storage handling
  }
}

/**
 * Pure validation function that determines whether the currently active Firebase Auth user
 * has a valid, non-expired Admin Portal session.
 *
 * FAIL-CLOSED INVARIANTS:
 * 1. Requires valid Firebase Admin Authentication (`db.isFirebaseAdminAuthenticated()`).
 * 2. Requires durable metadata matching the active Firebase UID (`metadata.adminUid === fbUser.uid`).
 * 3. Requires metadata timestamps to be mathematically within 12-hour max lifetime.
 * 4. Requires metadata timestamps to be mathematically within 30-minute inactivity limit.
 * 5. Rejects any future, negative, NaN, non-finite, or malformed timestamps.
 */
export function validateAdminSession(fbUser: FirebaseUser | null): {
  isValid: boolean;
  reason: AdminLogoutReason;
  metadata: AdminSessionMetadata | null;
} {
  if (!fbUser || !db.isFirebaseAdminAuthenticated()) {
    return { isValid: false, reason: null, metadata: null };
  }

  const metadata = getAdminSessionMetadata();
  if (!metadata) {
    // Stale Firebase authentication restored without an active Admin Portal session.
    // Must fail closed and require explicit credential re-authentication.
    return { isValid: false, reason: 'INACTIVITY', metadata: null };
  }

  if (metadata.adminUid !== fbUser.uid) {
    // Identity mismatch between stored session and current Firebase user
    return { isValid: false, reason: 'INACTIVITY', metadata: null };
  }

  const now = Date.now();

  // Check 12-hour absolute session maximum lifetime (cannot be bypassed or extended)
  if (now - metadata.sessionStartedAt >= ADMIN_ABSOLUTE_LIFETIME_MS) {
    return { isValid: false, reason: 'MAX_DURATION', metadata };
  }

  // Check 30-minute inactivity timeout
  if (now - metadata.lastActivityAt >= ADMIN_INACTIVITY_TIMEOUT_MS) {
    return { isValid: false, reason: 'INACTIVITY', metadata };
  }

  return { isValid: true, reason: null, metadata };
}

interface UseAdminSessionReturn {
  sessionState: AdminSessionState;
  logoutReason: AdminLogoutReason;
  remainingWarningSeconds: number;
  isWarningVisible: boolean;
  isSessionValid: boolean;
  staySignedIn: () => void;
  logout: (reason?: AdminLogoutReason) => Promise<void>;
  initSession: (adminUid: string) => void;
  clearLogoutReason: () => void;
  checkSessionValidity: () => boolean;
}

export function useAdminSession(
  isModalOpen: boolean,
  onSessionInvalidated?: (reason: AdminLogoutReason) => void,
  isAuthenticating: boolean = false
): UseAdminSessionReturn {
  const [sessionState, setSessionState] = useState<AdminSessionState>('ACTIVE');
  const [logoutReason, setLogoutReason] = useState<AdminLogoutReason>(null);
  const [remainingWarningSeconds, setRemainingWarningSeconds] = useState<number>(300);

  const lastEventThrottleRef = useRef<number>(0);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Helper to initialize session on explicit, successful admin credential login
  const initSession = useCallback((adminUid: string) => {
    const now = Date.now();
    const metadata: AdminSessionMetadata = {
      adminUid,
      sessionStartedAt: now,
      lastActivityAt: now,
    };
    saveAdminSessionMetadata(metadata);
    lastEventThrottleRef.current = now;
    setSessionState('ACTIVE');
    setLogoutReason(null);
    setRemainingWarningSeconds(300);

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: 'ADMIN_SESSION_INIT', metadata });
      } catch {
        // Ignore broadcast errors
      }
    }
  }, []);

  const clearLogoutReason = useCallback(() => {
    setLogoutReason(null);
  }, []);

  // Centralized, authoritative logout
  const logout = useCallback(
    async (reason: AdminLogoutReason = 'MANUAL') => {
      setSessionState(reason === 'MANUAL' ? 'LOGGED_OUT' : 'EXPIRED');
      setLogoutReason(reason);

      clearAdminSessionMetadata();

      // Broadcast logout to all open Admin tabs
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: 'ADMIN_LOGOUT', reason });
        } catch {
          // Ignore broadcast errors
        }
      }

      // Authoritative Firebase Sign Out
      await db.logoutAdminWithFirebase();

      if (onSessionInvalidated) {
        onSessionInvalidated(reason);
      }
    },
    [onSessionInvalidated]
  );

  // Stay signed in action (extends inactivity timer only, NOT 12-hour absolute lifetime)
  const staySignedIn = useCallback(() => {
    const fbUser = db.getAdminAuthUser();
    const validation = validateAdminSession(fbUser);

    if (!validation.isValid) {
      logout(validation.reason || 'MANUAL');
      return;
    }

    const now = Date.now();
    const metadata = validation.metadata!;

    // Cannot extend if 12-hour absolute lifetime reached
    if (now - metadata.sessionStartedAt >= ADMIN_ABSOLUTE_LIFETIME_MS) {
      logout('MAX_DURATION');
      return;
    }

    // Update only lastActivityAt
    metadata.lastActivityAt = now;
    saveAdminSessionMetadata(metadata);
    lastEventThrottleRef.current = now;
    setSessionState('ACTIVE');
    setRemainingWarningSeconds(300);

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'ADMIN_ACTIVITY_UPDATE',
          lastActivityAt: now,
        });
      } catch {
        // Ignore broadcast errors
      }
    }
  }, [logout]);

  // Throttled user activity handler with validation guard
  const recordActivity = useCallback(() => {
    if (isAuthenticating) return;
    const now = Date.now();
    if (now - lastEventThrottleRef.current < ACTIVITY_THROTTLE_MS) {
      return;
    }
    lastEventThrottleRef.current = now;

    // Only record activity if the current session is ACTIVE
    setSessionState((currentState) => {
      if (currentState === 'ACTIVE') {
        const fbUser = db.getAdminAuthUser();
        const validation = validateAdminSession(fbUser);
        if (validation.isValid && validation.metadata) {
          const metadata = validation.metadata;
          metadata.lastActivityAt = now;
          saveAdminSessionMetadata(metadata);
          if (broadcastChannelRef.current) {
            try {
              broadcastChannelRef.current.postMessage({
                type: 'ADMIN_ACTIVITY_UPDATE',
                lastActivityAt: now,
              });
            } catch {
              // Ignore broadcast errors
            }
          }
        }
      }
      return currentState;
    });
  }, [isAuthenticating]);

  // Main Session Verification Logic
  const checkSessionValidity = useCallback((): boolean => {
    if (isAuthenticating) {
      return true;
    }

    const fbUser = db.getAdminAuthUser();
    const validation = validateAdminSession(fbUser);

    if (!validation.isValid) {
      if (validation.reason) {
        logout(validation.reason);
      } else if (fbUser && db.isFirebaseAdminAuthenticated()) {
        logout('MANUAL');
      }
      return false;
    }

    const metadata = validation.metadata!;
    const now = Date.now();
    const elapsedInactivity = now - metadata.lastActivityAt;

    // 25-minute inactivity warning (5-minute countdown window)
    if (elapsedInactivity >= ADMIN_WARNING_THRESHOLD_MS) {
      const remainingMs = ADMIN_INACTIVITY_TIMEOUT_MS - elapsedInactivity;
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setRemainingWarningSeconds(remainingSec);
      setSessionState('WARNING');
    } else {
      setSessionState('ACTIVE');
    }

    return true;
  }, [isAuthenticating, logout]);

  // BroadcastChannel & Cross-tab Storage Synchronization
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          if (event.data?.type === 'ADMIN_LOGOUT') {
            setSessionState('EXPIRED');
            setLogoutReason(event.data.reason || 'INACTIVITY');
            db.logoutAdminWithFirebase();
            if (onSessionInvalidated) {
              onSessionInvalidated(event.data.reason || 'INACTIVITY');
            }
          } else if (event.data?.type === 'ADMIN_SESSION_INIT') {
            checkSessionValidity();
          } else if (event.data?.type === 'ADMIN_ACTIVITY_UPDATE') {
            checkSessionValidity();
          }
        };

        return () => {
          channel.close();
          broadcastChannelRef.current = null;
        };
      } catch {
        // Fallback gracefully
      }
    }
  }, [checkSessionValidity, onSessionInvalidated]);

  // Window Storage Event Listener (synchronizes tab closing/logout across tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ADMIN_SESSION_STORAGE_KEY) {
        if (!e.newValue) {
          // Metadata was removed in another tab
          setSessionState('EXPIRED');
          db.logoutAdminWithFirebase();
          if (onSessionInvalidated) {
            onSessionInvalidated('MANUAL');
          }
        } else {
          checkSessionValidity();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkSessionValidity, onSessionInvalidated]);

  // Active Session Lifecycle: Timer, User Event Listeners, Page Visibility & Focus
  useEffect(() => {
    if (!isModalOpen || sessionState === 'EXPIRED' || sessionState === 'LOGGED_OUT' || isAuthenticating) {
      return;
    }

    // Initial check on modal open or session activation
    const isValid = checkSessionValidity();
    if (!isValid) {
      return;
    }

    // 1. High-precision ticker (1-second interval)
    const intervalId = window.setInterval(checkSessionValidity, 1000);

    // 2. Meaningful user activity listeners
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
    ];

    const handleUserActivity = () => {
      recordActivity();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    // 3. Tab Visibility & Focus Listeners (immediate recalculation upon tab switch or background return)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionValidity();
      }
    };

    const handleWindowFocus = () => {
      checkSessionValidity();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isModalOpen, sessionState, isAuthenticating, checkSessionValidity, recordActivity]);

  const isSessionValid = (sessionState === 'ACTIVE' || sessionState === 'WARNING') && db.isFirebaseAdminAuthenticated();

  return {
    sessionState,
    logoutReason,
    remainingWarningSeconds,
    isWarningVisible: sessionState === 'WARNING' && isSessionValid,
    isSessionValid,
    staySignedIn,
    logout,
    initSession,
    clearLogoutReason,
    checkSessionValidity,
  };
}
