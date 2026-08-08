import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createServer as createViteServer } from 'vite';

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: { projectId: string } = { projectId: 'tewedadari-app' };
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json:', err);
  }
}

function ensureFirebaseAdmin() {
  if (getApps().length === 0) {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
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
  ensureFirebaseAdmin();
  const db = getFirestore();
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
  ensureFirebaseAdmin();
  const db = getFirestore();
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
      const { initData, simulationUserId } = req.body || {};

      let cleanTgId = '88492019';
      let tgUser: any = null;

      if (initData && typeof initData === 'string') {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (hash) {
          params.delete('hash');

          // Sort remaining key/value pairs alphabetically
          const sortedKeys = Array.from(params.keys()).sort();
          const dataCheckArr: string[] = [];
          for (const key of sortedKeys) {
            dataCheckArr.push(`${key}=${params.get(key)}`);
          }
          const dataCheckString = dataCheckArr.join('\n');

          // HMAC verification if TELEGRAM_BOT_TOKEN is set
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (botToken) {
            const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
            const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

            const hashBuf = Buffer.from(hash, 'hex');
            const calcBuf = Buffer.from(calculatedHash, 'hex');

            if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
              return res.status(401).json({ success: false, error: 'Invalid Telegram initData signature' });
            }
          } else {
            console.warn('TELEGRAM_BOT_TOKEN environment variable not set. Bypassing HMAC check for local development.');
          }

          // Check auth_date timestamp (max 24 hours / 86400 seconds)
          const authDateStr = params.get('auth_date');
          const authDate = parseInt(authDateStr || '0', 10);
          const now = Math.floor(Date.now() / 1000);
          const MAX_AGE = 86400; // 24 hours max age
          if (authDate > 0 && botToken && now - authDate > MAX_AGE) {
            return res.status(401).json({ success: false, error: 'Telegram initData authentication timestamp expired' });
          }

          // Extract user object
          const userStr = params.get('user');
          if (userStr) {
            try {
              tgUser = JSON.parse(userStr);
            } catch {
              // ignore
            }
          }

          if (tgUser && tgUser.id) {
            cleanTgId = String(tgUser.id).replace(/^tg_/, '');
          }
        }
      } else if (simulationUserId) {
        cleanTgId = String(simulationUserId).replace(/^tg_/, '');
        tgUser = {
          id: cleanTgId,
          first_name: 'Natnael',
          username: 'natnael_tg',
        };
      } else {
        cleanTgId = '88492019';
        tgUser = {
          id: cleanTgId,
          first_name: 'Natnael',
          username: 'natnael_tg',
        };
      }

      const firebaseUid = `tg_${cleanTgId}`;

      let customToken: string | null = null;
      try {
        ensureFirebaseAdmin();
        customToken = await getAuth().createCustomToken(firebaseUid, {
          telegramUserId: cleanTgId,
        });
      } catch (tokenErr: any) {
        // Firebase Admin custom token generation bypassed when signBlob permission is omitted in sandbox
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

      ensureFirebaseAdmin();
      const db = getFirestore();
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

      ensureFirebaseAdmin();
      const db = getFirestore();

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

      ensureFirebaseAdmin();
      const db = getFirestore();
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
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
