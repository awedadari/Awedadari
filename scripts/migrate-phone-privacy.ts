import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

function normalizeServerPhone(raw?: string | null): string {
  if (!raw) return '';
  let cleaned = String(raw).trim().replace(/[\s\-().]/g, '');
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

async function runMigration() {
  console.log('--- STARTING PHONE PRIVACY & PERSISTENCE MIGRATION ---');
  const db = getAdminFirestore();

  // 1. Migrate users collection
  console.log('Step 1: Inspecting users collection...');
  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} total user documents.`);

  let usersUpdated = 0;
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const rawPhone = data.phoneNumber || data.phone;
    if (rawPhone) {
      const canonical = normalizeServerPhone(rawPhone);
      console.log(`User [${userDoc.id}] has legacy root phone: "${rawPhone}" -> canonical "${canonical}"`);

      // Ensure canonical phone exists in users/{userId}/private/profile
      const privRef = userDoc.ref.collection('private').doc('profile');
      const privSnap = await privRef.get();
      if (!privSnap.exists || !privSnap.data()?.phoneNumber) {
        await privRef.set(
          {
            phoneNumber: canonical,
            updatedAt: new Date().toISOString(),
            migratedFromRoot: true,
          },
          { merge: true }
        );
        console.log(`  -> Saved canonical phone to users/${userDoc.id}/private/profile`);
      }

      // Remove root fields
      await userDoc.ref.update({
        phone: FieldValue.delete(),
        phoneNumber: FieldValue.delete(),
      });
      console.log(`  -> Removed root phone/phoneNumber from users/${userDoc.id}`);
      usersUpdated++;
    }
  }
  console.log(`Users migration complete. Updated ${usersUpdated} user document(s).`);

  // 2. Migrate tournamentPlayers collection
  console.log('Step 2: Inspecting tournamentPlayers collection...');
  const tpSnap = await db.collection('tournamentPlayers').get();
  console.log(`Found ${tpSnap.size} tournamentPlayers documents.`);

  let tpUpdated = 0;
  for (const tpDoc of tpSnap.docs) {
    const data = tpDoc.data();
    if (data.phoneNumber || data.phone) {
      const rawPhone = data.phoneNumber || data.phone;
      const canonical = normalizeServerPhone(rawPhone);
      const tourId = data.tournamentId;
      console.log(`tournamentPlayers [${tpDoc.id}] has phone: "${rawPhone}" -> canonical "${canonical}"`);

      if (tourId && canonical) {
        // Save to tournaments/{tournamentId}/privatePlayers/{tpDoc.id}
        const privPlayerRef = db
          .collection('tournaments')
          .doc(tourId)
          .collection('privatePlayers')
          .doc(tpDoc.id);
        await privPlayerRef.set(
          {
            tournamentId: tourId,
            playerId: tpDoc.id,
            phoneNumber: canonical,
            name: data.name || '',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        console.log(`  -> Moved private contact to tournaments/${tourId}/privatePlayers/${tpDoc.id}`);
      }

      // Remove from tournamentPlayers document
      await tpDoc.ref.update({
        phoneNumber: FieldValue.delete(),
        phone: FieldValue.delete(),
      });
      console.log(`  -> Removed phone from tournamentPlayers/${tpDoc.id}`);
      tpUpdated++;
    }
  }
  console.log(`tournamentPlayers migration complete. Updated ${tpUpdated} document(s).`);

  // 3. Record migration status
  await db.collection('_system_migrations').doc('phone_privacy_v2').set({
    completed: true,
    usersMigratedCount: usersUpdated,
    tournamentPlayersMigratedCount: tpUpdated,
    executedAt: new Date().toISOString(),
  });

  console.log('--- PHONE PRIVACY MIGRATION FINISHED SUCCESSFULLY ---');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
