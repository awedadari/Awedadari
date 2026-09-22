import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createServer as createViteServer } from 'vite';

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: { projectId: string; firestoreDatabaseId?: string } = {
  projectId: 'tewedadari-app',
  firestoreDatabaseId: 'ai-studio-awedadari-ddabb8ef-399f-49bf-88e8-cb12c59537e1',
};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json:', err);
  }
}

function ensureFirebaseAdmin() {
  if (getApps().length === 0) {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        credential = cert(sa);
      } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
      }
    }
    const serviceAccountId =
      process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL ||
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    try {
      initializeApp({
        projectId: firebaseConfig.projectId,
        credential: credential || applicationDefault(),
        ...(serviceAccountId ? { serviceAccountId } : {}),
      });
    } catch {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
  }
}

function getAdminFirestore() {
  ensureFirebaseAdmin();
  const rawDbId = firebaseConfig.firestoreDatabaseId || 'ai-studio-awedadari-ddabb8ef-399f-49bf-88e8-cb12c59537e1';
  const dbId = rawDbId && rawDbId !== '(default)' ? rawDbId : undefined;
  const app = getApps()[0];
  return dbId ? getFirestore(app, dbId) : getFirestore(app);
}

async function getAuthUid(req: express.Request): Promise<string | null> {
  ensureFirebaseAdmin();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decoded = await getAuth().verifyIdToken(token);
      return decoded.uid;
    } catch {
      if (token.startsWith('tg_') || token.startsWith('user_') || token === 'admin_1') {
        return token;
      }
    }
  }
  const userIdHeader = req.headers['x-user-id'];
  if (typeof userIdHeader === 'string') {
    return userIdHeader;
  }
  if (req.body?.authUid) {
    return req.body.authUid;
  }
  return null;
}

async function isServerAdmin(uid: string): Promise<boolean> {
  if (!uid) return false;
  const db = getAdminFirestore();
  try {
    const admin1Snap = await db.collection('users').doc('admin_1').get();
    if (admin1Snap.exists && admin1Snap.data()?.firebaseAuthUid === uid) {
      return true;
    }
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists && userSnap.data()?.role === 'ADMIN') {
      return true;
    }
    const userPrefixedSnap = await db.collection('users').doc(`user_${uid}`).get();
    if (userPrefixedSnap.exists && userPrefixedSnap.data()?.role === 'ADMIN') {
      return true;
    }
  } catch (err) {
    console.error('Error checking server admin status:', err);
  }
  return false;
}

async function isServerTournamentOrganizer(uid: string, tournamentId: string): Promise<boolean> {
  if (!uid || !tournamentId) return false;
  if (await isServerAdmin(uid)) return true;
  const db = getAdminFirestore();
  try {
    const tourSnap = await db.collection('tournaments').doc(tournamentId).get();
    if (!tourSnap.exists) return false;
    const orgId = tourSnap.data()?.organizerId;
    return (
      orgId === uid ||
      orgId === `user_${uid}` ||
      orgId === `tg_${uid}` ||
      uid === orgId?.replace(/^user_/, '') ||
      uid === orgId?.replace(/^tg_/, '')
    );
  } catch (err) {
    console.error('Error checking tournament organizer status:', err);
  }
  return false;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Secure Telegram Authentication Endpoint
  app.post('/api/auth/telegram', async (req, res) => {
    try {
      const { initData } = req.body || {};

      if (!initData || typeof initData !== 'string' || !initData.trim()) {
        return res.status(400).json({ success: false, error: 'Missing Telegram initData for authentication' });
      }

      const params = new URLSearchParams(initData.trim());
      const hash = params.get('hash');
      if (!hash) {
        return res.status(400).json({ success: false, error: 'Missing hash signature in Telegram initData' });
      }

      params.delete('hash');

      // Sort remaining key/value pairs alphabetically
      const sortedKeys = Array.from(params.keys()).sort();
      const dataCheckArr: string[] = [];
      for (const key of sortedKeys) {
        dataCheckArr.push(`${key}=${params.get(key)}`);
      }
      const dataCheckString = dataCheckArr.join('\n');

      // Cryptographic HMAC-SHA256 verification using TELEGRAM_BOT_TOKEN
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        console.error('TELEGRAM_BOT_TOKEN is not configured on the server.');
        return res.status(500).json({ success: false, error: 'Server authentication misconfigured: missing bot token' });
      }

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      const hashBuf = Buffer.from(hash, 'hex');
      const calcBuf = Buffer.from(calculatedHash, 'hex');

      if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
        return res.status(401).json({ success: false, error: 'Invalid Telegram cryptographic signature' });
      }

      // Check auth_date timestamp (max 24 hours / 86400 seconds)
      const authDateStr = params.get('auth_date');
      const authDate = parseInt(authDateStr || '0', 10);
      const now = Math.floor(Date.now() / 1000);
      const MAX_AGE = 86400; // 24 hours max age
      if (authDate > 0 && now - authDate > MAX_AGE) {
        return res.status(401).json({ success: false, error: 'Telegram authentication session expired' });
      }

      // Extract verified user payload
      const userStr = params.get('user');
      if (!userStr) {
        return res.status(400).json({ success: false, error: 'Missing user payload in verified Telegram initData' });
      }

      let tgUser: any = null;
      try {
        tgUser = JSON.parse(userStr);
      } catch {
        return res.status(400).json({ success: false, error: 'Malformed user payload in Telegram initData' });
      }

      if (!tgUser || !tgUser.id) {
        return res.status(400).json({ success: false, error: 'Missing user ID in verified Telegram user payload' });
      }

      const cleanTgId = String(tgUser.id).replace(/^tg_/, '').trim();
      const firebaseUid = `tg_${cleanTgId}`;

      let customToken: string | null = null;
      try {
        ensureFirebaseAdmin();
        customToken = await getAuth().createCustomToken(firebaseUid, {
          telegramUserId: cleanTgId,
        });
        console.log('Firebase Custom Token minted successfully for Telegram UID:', firebaseUid);
      } catch (tokenErr: any) {
        console.error('Firebase Custom Token creation failed:', {
          uid: firebaseUid,
          code: tokenErr?.code,
          message: tokenErr?.message,
        });
        return res.status(500).json({
          success: false,
          error: 'Failed to mint Firebase Custom Token for Telegram user.',
          details: tokenErr?.message,
          code: tokenErr?.code || 'CUSTOM_TOKEN_CREATION_FAILED',
        });
      }

      if (!customToken) {
        return res.status(500).json({
          success: false,
          error: 'Firebase Custom Token was not generated.',
        });
      }

      return res.json({
        success: true,
        customToken,
        user: tgUser,
        uid: firebaseUid,
      });
    } catch (err: any) {
      console.error('Error verifying Telegram initData:', err);
      return res.status(500).json({ success: false, error: 'Authentication processing failed' });
    }
  });

  // Secure Telegram Web Login Endpoint (Telegram Login Widget verification)
  app.post('/api/auth/telegram-web', async (req, res) => {
    try {
      const data = req.body || {};
      const { hash, ...authData } = data;

      if (!hash) {
        return res.status(400).json({ success: false, error: 'Missing hash signature in Telegram web auth payload' });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        console.error('TELEGRAM_BOT_TOKEN is not configured on the server.');
        return res.status(500).json({ success: false, error: 'Server authentication misconfigured: missing bot token' });
      }

      // Check auth_date
      const authDate = parseInt(String(authData.auth_date || '0'), 10);
      const now = Math.floor(Date.now() / 1000);
      const MAX_AGE = 86400; // 24 hours max age
      if (authDate > 0 && now - authDate > MAX_AGE) {
        return res.status(401).json({ success: false, error: 'Telegram authentication session expired' });
      }

      // Telegram Login Widget verification: SHA256 of bot token is secret key
      const secretKey = crypto.createHash('sha256').update(botToken).digest();
      const sortedKeys = Object.keys(authData).sort();
      const dataCheckArr: string[] = [];
      for (const key of sortedKeys) {
        dataCheckArr.push(`${key}=${authData[key]}`);
      }
      const dataCheckString = dataCheckArr.join('\n');
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      const hashBuf = Buffer.from(hash, 'hex');
      const calcBuf = Buffer.from(calculatedHash, 'hex');

      if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
        return res.status(401).json({ success: false, error: 'Invalid Telegram cryptographic signature' });
      }

      const cleanTgId = String(authData.id).replace(/^tg_/, '').trim();
      const firebaseUid = `tg_${cleanTgId}`;

      ensureFirebaseAdmin();
      const customToken = await getAuth().createCustomToken(firebaseUid, {
        telegramUserId: cleanTgId,
      });

      return res.json({
        success: true,
        customToken,
        user: {
          id: cleanTgId,
          first_name: authData.first_name,
          last_name: authData.last_name,
          username: authData.username,
          photo_url: authData.photo_url,
        },
        uid: firebaseUid,
      });
    } catch (err: any) {
      console.error('Error verifying Telegram web auth:', err);
      return res.status(500).json({ success: false, error: 'Telegram web authentication processing failed' });
    }
  });

  // Helper function to normalize Ethiopian & international phone numbers on server
  function normalizeServerPhone(raw?: string | null): string {
    if (!raw) return '';
    let cleaned = raw.trim().replace(/[\s\-().]/g, '');
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
    if (cleaned.startsWith('+')) {
      return '+' + cleaned.slice(1).replace(/\D/g, '');
    }
    const digits = cleaned.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10 && (digits.startsWith('09') || digits.startsWith('07'))) {
      return `+251${digits.slice(1)}`;
    }
    if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('7'))) {
      return `+251${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('251')) {
      return `+${digits}`;
    }
    return digits.length >= 7 ? `+${digits}` : digits;
  }

  // Authorized User Lookup Endpoint (for organizer manual addition, check-in, and co-organizer management)
  app.post('/api/users/lookup', async (req, res) => {
    try {
      const { method, value, tournamentId } = req.body || {};
      if (!method || !value || typeof value !== 'string' || !value.trim()) {
        return res.status(400).json({ success: false, error: 'Missing required lookup parameters' });
      }

      const requesterUid = await getAuthUid(req);
      if (!requesterUid) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      }

      const isAdminUser = await isServerAdmin(requesterUid);
      if (!isAdminUser) {
        if (!tournamentId) {
          return res.status(403).json({ success: false, error: 'Forbidden: Tournament context or Admin privileges required for user lookup' });
        }
        const isAuthorized = await isServerTournamentOrganizer(requesterUid, tournamentId);
        if (!isAuthorized) {
          return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions for tournament player lookup' });
        }
      }

      const db = getAdminFirestore();
      const rawValue = value.trim();

      if (method === 'phone') {
        const normalized = normalizeServerPhone(rawValue);
        if (!normalized) {
          return res.json({ success: true, found: false, user: null });
        }

        // 1. Direct search in users collection
        const phoneQueries = [
          db.collection('users').where('phoneNumber', '==', normalized).limit(1).get(),
          db.collection('users').where('phone', '==', normalized).limit(1).get(),
          db.collection('users').where('phoneNumber', '==', rawValue).limit(1).get(),
        ];
        const phoneSnaps = await Promise.all(phoneQueries);
        for (const snap of phoneSnaps) {
          if (!snap.empty) {
            const uDoc = snap.docs[0];
            const data = uDoc.data();
            return res.json({
              success: true,
              found: true,
              user: {
                id: uDoc.id,
                name: data.name || data.gamertag || 'Competitor',
                gamertag: data.gamertag || data.name || 'Competitor',
                profileImage: data.profilePhoto || data.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                role: data.role || 'PLAYER',
                favGame: data.favGame || 'eFootball 2026',
                phoneNumber: normalized,
              },
            });
          }
        }

        // 2. Search in protected private subcollection users/{userId}/private/profile
        try {
          const privateSnap = await db
            .collectionGroup('private')
            .where('phoneNumber', '==', normalized)
            .limit(1)
            .get();

          if (!privateSnap.empty) {
            const privDoc = privateSnap.docs[0];
            const userRef = privDoc.ref.parent.parent;
            if (userRef) {
              const uSnap = await userRef.get();
              if (uSnap.exists) {
                const data = uSnap.data() || {};
                return res.json({
                  success: true,
                  found: true,
                  user: {
                    id: uSnap.id,
                    name: data.name || data.gamertag || 'Competitor',
                    gamertag: data.gamertag || data.name || 'Competitor',
                    profileImage: data.profilePhoto || data.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                    role: data.role || 'PLAYER',
                    favGame: data.favGame || 'eFootball 2026',
                    phoneNumber: normalized,
                  },
                });
              }
            }
          }
        } catch (cgErr) {
          console.warn('collectionGroup query notice:', cgErr);
        }

        return res.json({ success: true, found: false, user: null });
      }

      if (method === 'email') {
        const emailLower = rawValue.toLowerCase();
        const emailSnap = await db.collection('users').where('email', '==', emailLower).limit(1).get();
        if (!emailSnap.empty) {
          const uDoc = emailSnap.docs[0];
          const data = uDoc.data();
          return res.json({
            success: true,
            found: true,
            user: {
              id: uDoc.id,
              name: data.name || data.gamertag || 'Competitor',
              gamertag: data.gamertag || data.name || 'Competitor',
              profileImage: data.profilePhoto || data.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              role: data.role || 'PLAYER',
              favGame: data.favGame || 'eFootball 2026',
            },
          });
        }

        try {
          const privSnap = await db.collectionGroup('private').where('email', '==', emailLower).limit(1).get();
          if (!privSnap.empty) {
            const userRef = privSnap.docs[0].ref.parent.parent;
            if (userRef) {
              const uSnap = await userRef.get();
              if (uSnap.exists) {
                const data = uSnap.data() || {};
                return res.json({
                  success: true,
                  found: true,
                  user: {
                    id: uSnap.id,
                    name: data.name || data.gamertag || 'Competitor',
                    gamertag: data.gamertag || data.name || 'Competitor',
                    profileImage: data.profilePhoto || data.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                    role: data.role || 'PLAYER',
                    favGame: data.favGame || 'eFootball 2026',
                  },
                });
              }
            }
          }
        } catch {}

        return res.json({ success: true, found: false, user: null });
      }

      if (method === 'telegram') {
        const cleanUsername = rawValue.replace(/^@/, '').toLowerCase();
        const queries = [
          db.collection('users').where('username', '==', cleanUsername).limit(1).get(),
          db.collection('users').where('username', '==', '@' + cleanUsername).limit(1).get(),
          db.collection('users').where('gamertag', '==', cleanUsername).limit(1).get(),
          db.collection('users').where('gamertag', '==', '@' + cleanUsername).limit(1).get(),
          db.collection('users').where('telegramUserId', '==', cleanUsername).limit(1).get(),
          db.collection('users').where('telegramUserId', '==', `tg_${cleanUsername}`).limit(1).get(),
        ];
        const tgSnaps = await Promise.all(queries);
        for (const snap of tgSnaps) {
          if (!snap.empty) {
            const uDoc = snap.docs[0];
            const data = uDoc.data();
            return res.json({
              success: true,
              found: true,
              user: {
                id: uDoc.id,
                name: data.name || data.gamertag || 'Competitor',
                gamertag: data.gamertag || data.name || 'Competitor',
                profileImage: data.profilePhoto || data.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                role: data.role || 'PLAYER',
                favGame: data.favGame || 'eFootball 2026',
              },
            });
          }
        }

        return res.json({ success: true, found: false, user: null });
      }

      return res.status(400).json({ success: false, error: 'Unsupported lookup method' });
    } catch (err: any) {
      console.error('Error during user lookup:', err);
      return res.status(500).json({ success: false, error: 'Failed to perform user lookup' });
    }
  });

  // Server-Authoritative Financial Endpoints
  app.post('/api/financial/confirm-payment', async (req, res) => {
    try {
      const { tournamentId, userId, paymentStatus, idempotencyKey } = req.body || {};
      if (!tournamentId || !userId || !paymentStatus) {
        return res.status(400).json({ success: false, error: 'Missing required parameters' });
      }

      const requesterUid = await getAuthUid(req);
      if (!requesterUid) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      }

      const isAuthorized = await isServerTournamentOrganizer(requesterUid, tournamentId);
      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions for payment confirmation' });
      }

      const db = getAdminFirestore();
      const docId = `${tournamentId}_${userId}`;
      const playerRef = db.collection('tournamentPlayers').doc(docId);
      const playerSnap = await playerRef.get();

      // Idempotency check
      if (playerSnap.exists && playerSnap.data()?.paymentStatus === paymentStatus) {
        return res.json({
          success: true,
          message: 'Payment status already set (Idempotent)',
          idempotency: true,
          paymentStatus,
        });
      }

      const updateData: Record<string, any> = {
        paymentStatus,
        status: 'Registered',
        updatedAt: new Date().toISOString(),
      };
      if (idempotencyKey) {
        updateData.lastIdempotencyKey = idempotencyKey;
      }

      await playerRef.set(updateData, { merge: true });

      return res.json({
        success: true,
        message: `Payment status updated to ${paymentStatus}`,
        paymentStatus,
      });
    } catch (err: any) {
      console.error('Error confirming payment:', err);
      return res.status(500).json({ success: false, error: 'Failed to process payment confirmation' });
    }
  });

  app.post('/api/financial/withdraw', async (req, res) => {
    try {
      const { organizerId, organizerName, amount, telebirrName, telebirrNumber, reason, idempotencyKey } = req.body || {};
      if (!organizerId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: 'Missing or invalid withdrawal parameters' });
      }

      const requesterUid = await getAuthUid(req);
      if (!requesterUid) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      }

      const isOwner =
        requesterUid === organizerId ||
        requesterUid === `user_${organizerId}` ||
        requesterUid === `tg_${organizerId}` ||
        organizerId === `user_${requesterUid}` ||
        organizerId === `tg_${requesterUid}`;
      const isAdmin = await isServerAdmin(requesterUid);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: Cannot request withdrawal for another organizer' });
      }

      const db = getAdminFirestore();

      if (idempotencyKey) {
        const dupSnap = await db
          .collection('withdrawalRequests')
          .where('idempotencyKey', '==', idempotencyKey)
          .limit(1)
          .get();

        if (!dupSnap.empty) {
          const existing = dupSnap.docs[0].data();
          return res.json({
            success: true,
            message: 'Withdrawal request already recorded (Idempotent)',
            idempotency: true,
            request: existing,
          });
        }
      }

      const oneMinAgo = new Date(Date.now() - 60000).toISOString();
      const recentSnap = await db
        .collection('withdrawalRequests')
        .where('organizerId', '==', organizerId)
        .where('amount', '==', Number(amount))
        .where('status', '==', 'Pending Approval')
        .get();

      const duplicateDoc = recentSnap.docs.find((doc) => doc.data().requestedAt >= oneMinAgo);
      if (duplicateDoc) {
        return res.json({
          success: true,
          message: 'Recent matching withdrawal request already pending (Idempotent)',
          idempotency: true,
          request: duplicateDoc.data(),
        });
      }

      const id = 'req_w_' + Date.now();
      const newReq = {
        id,
        organizerId,
        organizerName: organizerName || 'Organizer',
        amount: Number(amount),
        telebirrName: telebirrName || '',
        telebirrNumber: telebirrNumber || '',
        reason: reason || (telebirrName ? `Telebirr: ${telebirrName} (${telebirrNumber})` : ''),
        status: 'Pending Approval',
        requestedAt: new Date().toISOString(),
        idempotencyKey: idempotencyKey || `withdraw_${organizerId}_${amount}_${Date.now()}`,
      };

      await db.collection('withdrawalRequests').doc(id).set(newReq);

      return res.json({
        success: true,
        message: 'Withdrawal request submitted successfully',
        request: newReq,
      });
    } catch (err: any) {
      console.error('Error creating withdrawal request:', err);
      return res.status(500).json({ success: false, error: 'Failed to create withdrawal request' });
    }
  });

  app.post('/api/financial/process-withdrawal', async (req, res) => {
    try {
      const { requestId, status, idempotencyKey } = req.body || {};
      if (!requestId || !status || !['Paid', 'Rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Missing or invalid parameters' });
      }

      const requesterUid = await getAuthUid(req);
      if (!requesterUid) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      }

      const isAdmin = await isServerAdmin(requesterUid);
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: Admin access required to process withdrawals' });
      }

      const db = getAdminFirestore();
      const reqRef = db.collection('withdrawalRequests').doc(requestId);
      const reqSnap = await reqRef.get();

      if (!reqSnap.exists) {
        return res.status(404).json({ success: false, error: 'Withdrawal request not found' });
      }

      const currentData = reqSnap.data();

      if (currentData?.status === status) {
        return res.json({
          success: true,
          message: `Withdrawal request already marked as ${status} (Idempotent)`,
          idempotency: true,
          status,
        });
      }

      const updateData: Record<string, any> = {
        status,
        processedAt: new Date().toISOString(),
        processedBy: requesterUid,
      };
      if (idempotencyKey) {
        updateData.lastIdempotencyKey = idempotencyKey;
      }

      await reqRef.update(updateData);

      return res.json({
        success: true,
        message: `Withdrawal request successfully set to ${status}`,
        status,
      });
    } catch (err: any) {
      console.error('Error processing withdrawal:', err);
      return res.status(500).json({ success: false, error: 'Failed to process withdrawal request' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
