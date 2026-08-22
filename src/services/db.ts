import { initializeApp, getApps } from 'firebase/app';
import { compressImage } from '../utils/imageCompressor';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  runTransaction,
  writeBatch,
  query,
  where,
  limit,
  orderBy,
  documentId,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  User,
  Tournament,
  TournamentPlayer,
  Match,
  PlayerStatus,
  MatchStatus,
  TournamentStatus,
  TelegramUser,
  UserRole,
  TournamentFormat,
  TournamentGroup,
  PlayerRoundScore,
  PaymentStatus,
  OrganizerRequest,
  AppNotification,
  GalleryPost,
  TournamentSession,
  SessionPlayerScore,
  FinalStanding,
  WithdrawalRequest,
  WithdrawalStatus,
  PlayerGameStats,
  RankedPlayerGameProfile,
  GameCategoryInfo,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_TOURNAMENTS,
  INITIAL_TOURNAMENT_PLAYERS,
  INITIAL_MATCHES,
} from '../data/initialData';

// Initialize Firebase App & Firestore with persistent local cache
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const rawDbId = (firebaseConfig as Record<string, string>).firestoreDatabaseId || 'ai-studio-awedadari-ddabb8ef-399f-49bf-88e8-cb12c59537e1';
const dbId = rawDbId && rawDbId !== '(default)' ? rawDbId : undefined;

function initFirestoreWithPersistentCache() {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      dbId
    );
  } catch (err) {
    console.warn('Persistent local cache initialization fallback to getFirestore:', err);
    return getFirestore(app, dbId);
  }
}

export const firestore = initFirestoreWithPersistentCache();
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const STORAGE_KEY_ACTIVE_USER = 'tc_active_user_id_v2';
const DEFAULT_APPROVED_ORGANIZER_IDS = ['88492019', '777000', '123456789', '99887766'];

export class DatabaseService {
  private users: User[] = this.loadUsersFromCache();
  private tournaments: Tournament[] = [];
  private tournamentPlayers: TournamentPlayer[] = [];
  private matches: Match[] = [];
  private tournamentGroups: TournamentGroup[] = [];
  private tournamentSessions: TournamentSession[] = [];
  private roundScores: PlayerRoundScore[] = [];
  private organizerRequests: OrganizerRequest[] = [];
  private withdrawalRequests: WithdrawalRequest[] = [];
  private approvedOrganizerIds: string[] = DEFAULT_APPROVED_ORGANIZER_IDS;
  private activeUserId: string | null = null;
  private loading: boolean = true;
  private listeners: Set<() => void> = new Set();
  private unsubscribes: (() => void)[] = [];

  // Scoped Subscriptions State
  private activeTournamentSubId: string | null = null;
  private tournamentUnsubscribers: (() => void)[] = [];
  private userRegUnsubscribe: (() => void) | null = null;
  private activeUserDocUnsubscribe: (() => void) | null = null;
  private organizerWithdrawalsUnsub: (() => void) | null = null;
  private adminListeners: (() => void)[] = [];
  private completedTournamentsLoaded: boolean = false;
  private fetchedUserIds: Set<string> = new Set();
  private inFlightUserIds: Set<string> = new Set();
  private pendingUserFetchIds: Set<string> = new Set();
  private userFetchTimeout: any = null;

  constructor() {
    try {
      localStorage.removeItem('tc_admin_creds_v2');
      localStorage.removeItem('tc_admin_passcode');
    } catch {}

    onAuthStateChanged(auth, () => {
      if (this.isFirebaseAdminAuthenticated()) {
        this.syncAdminListeners();
      } else {
        this.cleanupAdminListeners();
      }
      this.notify();
    });

    this.initRealtimeListeners();
  }

  private loadUsersFromCache(): User[] {
    return INITIAL_USERS.map((u) => {
      try {
        const saved = localStorage.getItem(`SG_USER_CACHE_${u.id}`);
        if (saved) {
          const cached = JSON.parse(saved);
          return {
            ...u,
            ...cached,
          };
        }
      } catch {}
      return u;
    });
  }

  private mapTournamentDoc(docSnap: any): Tournament {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      tournamentCode: data.tournamentCode || '',
      tournamentName: data.name || data.tournamentName || '1v1 Tournament',
      game: data.game || 'eFootball 2026',
      image:
        data.image ||
        'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
      date: data.date || '2026-08-01',
      time: data.time || '18:00',
      maxPlayers: typeof data.maxPlayers === 'number' ? data.maxPlayers : 16,
      status: (data.status as TournamentStatus) || 'Upcoming',
      organizerId: data.organizerId || '',
      venueName: data.venueName || 'Main Arena',
      venueLocation: data.venueLocation || data.location || 'Bole Medhanialem, Building 3, 2nd Floor',
      rules: data.rules || 'Standard competitive rules.',
      registrationDeadline: data.registrationDeadline,
      format: (data.format as TournamentFormat) || 'elimination',
      groupSize: typeof data.groupSize === 'number' ? data.groupSize : 4,
      currentStage: data.currentStage || 'registration',
      currentRound: typeof data.currentRound === 'number' ? data.currentRound : 1,
      maxRounds: typeof data.maxRounds === 'number' ? data.maxRounds : 3,
      isApproved: data.isApproved !== undefined ? Boolean(data.isApproved) : true,
      registrationFee: data.registrationFee || '50 ETB',
      prizePool: data.prizePool || '',
      award: data.award || data.prizePool || '',
      telebirrNumber: data.telebirrNumber || '',
      telebirrAccountName: data.telebirrAccountName || data.telebirrName || '',
      telebirrName: data.telebirrName || data.telebirrAccountName || '',
      performanceLabel: data.performanceLabel || 'Performance',
      sessionLabel: data.sessionLabel || 'Match',
      finalStandings: data.finalStandings || [],
    };
  }

  private mapUserDoc(docSnap: any): User {
    const data = docSnap.data();
    let cached: Partial<User> = {};
    try {
      const saved = localStorage.getItem(`SG_USER_CACHE_${docSnap.id}`);
      if (saved) cached = JSON.parse(saved);
    } catch {}

    return {
      id: docSnap.id,
      name: data.name ?? cached.name ?? 'Competitor',
      username: data.username ?? cached.username ?? 'user',
      profileImage:
        data.profilePhoto ??
        data.profileImage ??
        cached.profileImage ??
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      telegramUserId: data.telegramId ?? data.telegramUserId ?? cached.telegramUserId ?? `tg_${docSnap.id}`,
      role: (data.role as UserRole) ?? (cached.role as UserRole) ?? 'PLAYER',
      gamertag: data.gamertag ?? cached.gamertag ?? data.name ?? cached.name,
      favGame: data.favGame ?? cached.favGame ?? 'eFootball 2026',
      venueName: data.venueName ?? cached.venueName,
      phoneNumber: data.phoneNumber ?? data.phone ?? cached.phoneNumber ?? '',
      bio: data.bio ?? cached.bio ?? '',
      organizerRequestStatus: data.organizerRequestStatus || 'none',
      organizerRequestReason: data.organizerRequestReason || '',
      rating: data.rating || 5.0,
      ratingCount: data.ratingCount || 0,
    };
  }

  private mergeUsers(newUsers: User[]) {
    const userMap = new Map<string, User>();
    this.users.forEach((u) => userMap.set(u.id, u));
    newUsers.forEach((u) => userMap.set(u.id, u));
    this.users = Array.from(userMap.values());
  }

  private mergeTournaments(newTournaments: Tournament[]) {
    const tourMap = new Map<string, Tournament>();
    this.tournaments.forEach((t) => tourMap.set(t.id, t));
    newTournaments.forEach((t) => tourMap.set(t.id, t));
    this.tournaments = Array.from(tourMap.values());
  }

  private initRealtimeListeners() {
    let usersLoaded = false;
    let tournamentsLoaded = false;
    let organizersLoaded = false;

    const checkLoadingFinished = () => {
      if (usersLoaded && tournamentsLoaded && organizersLoaded) {
        const wasLoading = this.loading;
        this.loading = false;
        if (wasLoading) {
          this.notify();
        }
      }
    };

    // 1. Listen to APPROVED ORGANIZERS collection (Authoritative & Lean)
    const unsubOrganizers = onSnapshot(
      collection(firestore, 'approvedOrganizers'),
      (snapshot) => {
        if (!snapshot.empty) {
          this.approvedOrganizerIds = snapshot.docs.map((d) => d.id);
        } else {
          this.approvedOrganizerIds = DEFAULT_APPROVED_ORGANIZER_IDS;
        }
        organizersLoaded = true;
        checkLoadingFinished();
        this.notify();
      },
      (err) => {
        console.error('Error listening to approvedOrganizers:', err);
        organizersLoaded = true;
        checkLoadingFinished();
      }
    );

    // 2. Listen to Active/Upcoming TOURNAMENTS collection
    // Filters out historic completed tournaments from the hot real-time stream
    const activeTournamentsQuery = query(
      collection(firestore, 'tournaments'),
      where('status', 'in', ['Draft', 'Registration Open', 'Live', 'Upcoming', 'Ongoing'])
    );

    const unsubTournaments = onSnapshot(
      activeTournamentsQuery,
      (snapshot) => {
        const activeTours = snapshot.docs.map((docSnap) => this.mapTournamentDoc(docSnap));
        this.mergeTournaments(activeTours);
        tournamentsLoaded = true;
        checkLoadingFinished();
        this.notify();
      },
      (err) => {
        console.error('Error listening to active tournaments:', err);
        // Fallback: load all tournaments if the composite filter index is missing
        onSnapshot(
          collection(firestore, 'tournaments'),
          (snap) => {
            const allTours = snap.docs.map((d) => this.mapTournamentDoc(d));
            this.mergeTournaments(allTours);
            tournamentsLoaded = true;
            checkLoadingFinished();
            this.notify();
          },
          () => {
            tournamentsLoaded = true;
            checkLoadingFinished();
          }
        );
      }
    );

    // 3. Listen to Top USERS (Limited to 50 for leaderboard / profile cards)
    const usersQuery = query(collection(firestore, 'users'), limit(50));
    const unsubUsers = onSnapshot(
      usersQuery,
      async (snapshot) => {
        if (snapshot.empty && !usersLoaded) {
          if (this.isFirebaseAdminAuthenticated()) {
            await this.seedDemoData().catch((err) => console.error('Error seeding demo data:', err));
          } else {
            usersLoaded = true;
            checkLoadingFinished();
            this.notify();
          }
          return;
        }
        const userDocs = snapshot.docs.map((docSnap) => this.mapUserDoc(docSnap));
        this.mergeUsers(userDocs);
        usersLoaded = true;
        checkLoadingFinished();
        this.notify();
      },
      (err) => {
        console.error('Error listening to users:', err);
        usersLoaded = true;
        checkLoadingFinished();
      }
    );

    this.unsubscribes.push(unsubOrganizers, unsubTournaments, unsubUsers);

    // Safety timeout to ensure loading spinner never hangs indefinitely
    setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.notify();
      }
    }, 2500);
  }

  // =========================================================================
  // SCOPED TOURNAMENT SUBSCRIBER (Matches, Players, Groups, Sessions, Scores)
  // Only listens to details of the tournament currently viewed by the user/organizer
  // =========================================================================
  public subscribeToTournament(tournamentId: string) {
    if (!tournamentId) return;
    if (this.activeTournamentSubId === tournamentId) return;

    // Unsubscribe from previous tournament
    this.unsubscribeFromTournament();
    this.activeTournamentSubId = tournamentId;

    // 1. Scoped TOURNAMENT PLAYERS
    const playersQuery = query(
      collection(firestore, 'tournamentPlayers'),
      where('tournamentId', '==', tournamentId)
    );
    const unsubPlayers = onSnapshot(
      playersQuery,
      (snapshot) => {
        const newPlayers: TournamentPlayer[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            tournamentId: data.tournamentId,
            userId: data.userId,
            registrationDate: data.joinedAt || data.registrationDate || new Date().toISOString(),
            playerStatus: (data.status || data.playerStatus || 'Registered') as PlayerStatus,
            paymentStatus: (data.paymentStatus || (data.paymentProofUrl ? 'PENDING_APPROVAL' : 'CONFIRMED')) as PaymentStatus,
            paymentProofUrl: data.paymentProofUrl || '',
            paymentSubmittedAt: data.paymentSubmittedAt || data.joinedAt || '',
            seed: data.seed,
            checkInCode: data.checkInCode || `SG-${data.userId ? data.userId.slice(-4).toUpperCase() : '1001'}`,
          };
        });

        // Merge into tournamentPlayers state
        const otherPlayers = this.tournamentPlayers.filter((p) => p.tournamentId !== tournamentId);
        this.tournamentPlayers = [...otherPlayers, ...newPlayers];

        // Ensure user details for all registered players are available via batch lookup
        const missingUserIds = newPlayers
          .map((p) => p.userId)
          .filter((uid): uid is string => Boolean(uid && !this.users.some((u) => u.id === uid) && !uid.startsWith('demo_')));
        if (missingUserIds.length > 0) {
          this.fetchUsersByIds(missingUserIds);
        }

        this.notify();
      },
      (err) => console.error(`Error listening to tournamentPlayers for ${tournamentId}:`, err)
    );

    // 2. Scoped MATCHES
    const matchesQuery = query(
      collection(firestore, 'matches'),
      where('tournamentId', '==', tournamentId)
    );
    const unsubMatches = onSnapshot(
      matchesQuery,
      (snapshot) => {
        const newMatches: Match[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            tournamentId: data.tournamentId,
            round: data.round || 'Round 1',
            playerAId: data.playerA ?? data.playerAId ?? null,
            playerBId: data.playerB ?? data.playerBId ?? null,
            stationNumber: data.station || data.stationNumber || 'Station 01',
            winnerId: data.winner ?? data.winnerId ?? null,
            score: data.score || '0 - 0',
            status: (data.status as MatchStatus) || 'Waiting',
            groupId: data.groupId || '',
          };
        });
        const otherMatches = this.matches.filter((m) => m.tournamentId !== tournamentId);
        this.matches = [...otherMatches, ...newMatches];
        this.notify();
      },
      (err) => console.error(`Error listening to matches for ${tournamentId}:`, err)
    );

    // 3. Scoped TOURNAMENT GROUPS
    const groupsQuery = query(
      collection(firestore, 'tournamentGroups'),
      where('tournamentId', '==', tournamentId)
    );
    const unsubGroups = onSnapshot(
      groupsQuery,
      (snapshot) => {
        const newGroups: TournamentGroup[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            tournamentId: data.tournamentId,
            groupName: data.groupName || data.name || 'Group A',
            playerIds: data.playerIds || [],
            roundNumber: data.roundNumber || 1,
            manualRanks: data.manualRanks || {},
            playerStatuses: data.playerStatuses || {},
          };
        });
        const otherGroups = this.tournamentGroups.filter((g) => g.tournamentId !== tournamentId);
        this.tournamentGroups = [...otherGroups, ...newGroups];
        this.notify();
      },
      (err) => console.error(`Error listening to tournamentGroups for ${tournamentId}:`, err)
    );

    // 4. Scoped TOURNAMENT SESSIONS
    const sessionsQuery = query(
      collection(firestore, 'tournamentSessions'),
      where('tournamentId', '==', tournamentId)
    );
    const unsubSessions = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const newSessions: TournamentSession[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            tournamentId: data.tournamentId,
            roundNumber: data.roundNumber || 1,
            name: data.name || 'Match 1',
            scores: data.scores || [],
          };
        });
        const otherSessions = this.tournamentSessions.filter((s) => s.tournamentId !== tournamentId);
        this.tournamentSessions = [...otherSessions, ...newSessions];
        this.notify();
      },
      (err) => console.error(`Error listening to tournamentSessions for ${tournamentId}:`, err)
    );

    // 5. Scoped ROUND SCORES
    const scoresQuery = query(
      collection(firestore, 'roundScores'),
      where('tournamentId', '==', tournamentId)
    );
    const unsubScores = onSnapshot(
      scoresQuery,
      (snapshot) => {
        const newScores: PlayerRoundScore[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            tournamentId: data.tournamentId,
            userId: data.userId,
            roundNumber: data.roundNumber || 1,
            points: Number(data.points) || 0,
            groupId: data.groupId || '',
          };
        });
        const otherScores = this.roundScores.filter((s) => s.tournamentId !== tournamentId);
        this.roundScores = [...otherScores, ...newScores];
        this.notify();
      },
      (err) => console.error(`Error listening to roundScores for ${tournamentId}:`, err)
    );

    this.tournamentUnsubscribers.push(
      unsubPlayers,
      unsubMatches,
      unsubGroups,
      unsubSessions,
      unsubScores
    );
  }

  public unsubscribeFromTournament() {
    if (this.tournamentUnsubscribers.length > 0) {
      this.tournamentUnsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
      this.tournamentUnsubscribers = [];
    }
    this.activeTournamentSubId = null;
  }

  // =========================================================================
  // ON-DEMAND COMPLETED TOURNAMENTS LOADER
  // =========================================================================
  public async loadCompletedTournaments(): Promise<void> {
    if (this.completedTournamentsLoaded) return;
    try {
      const q = query(
        collection(firestore, 'tournaments'),
        where('status', 'in', ['Completed', 'Finished'])
      );
      const snapshot = await getDocs(q);
      const completed = snapshot.docs.map((d) => this.mapTournamentDoc(d));
      this.mergeTournaments(completed);
      this.completedTournamentsLoaded = true;
      this.notify();
    } catch (err) {
      console.warn('Error loading completed tournaments:', err);
    }
  }

  // =========================================================================
  // ON-DEMAND BATCHED USER FETCHER & CACHE
  // =========================================================================
  public async fetchUsersByIds(userIds: string[]): Promise<User[]> {
    if (!userIds || userIds.length === 0) return [];

    const uniqueIds = Array.from(
      new Set(userIds.filter((id) => id && typeof id === 'string' && !id.startsWith('demo_')))
    );

    const neededIds = uniqueIds.filter(
      (id) =>
        !this.users.some((u) => u.id === id) &&
        !this.fetchedUserIds.has(id) &&
        !this.inFlightUserIds.has(id)
    );

    if (neededIds.length === 0) {
      return this.users.filter((u) => uniqueIds.includes(u.id));
    }

    // Mark as in-flight immediately to prevent duplicate concurrent queries
    neededIds.forEach((id) => this.inFlightUserIds.add(id));

    // Firestore supports up to 30 elements in an 'in' query
    const BATCH_SIZE = 30;
    const fetchedUsers: User[] = [];

    for (let i = 0; i < neededIds.length; i += BATCH_SIZE) {
      const batchIds = neededIds.slice(i, i + BATCH_SIZE);
      try {
        const usersQuery = query(
          collection(firestore, 'users'),
          where(documentId(), 'in', batchIds)
        );
        const snapshot = await getDocs(usersQuery);
        if (!snapshot.empty) {
          const docsUsers = snapshot.docs.map((docSnap) => this.mapUserDoc(docSnap));
          fetchedUsers.push(...docsUsers);
        }
        // Mark these IDs as fetched (even if some docs did not exist in Firestore)
        batchIds.forEach((id) => {
          this.fetchedUserIds.add(id);
          this.inFlightUserIds.delete(id);
        });
      } catch (err) {
        console.warn(`Error fetching user batch of ${batchIds.length} users:`, err);
        // Release from in-flight on failure
        batchIds.forEach((id) => this.inFlightUserIds.delete(id));
      }
    }

    if (fetchedUsers.length > 0) {
      this.mergeUsers(fetchedUsers);
      this.notify();
    }

    return this.users.filter((u) => uniqueIds.includes(u.id));
  }

  public async fetchUserById(userId: string): Promise<User | null> {
    if (!userId || typeof userId !== 'string' || userId.startsWith('demo_')) return null;
    const existing = this.users.find((u) => u.id === userId);
    if (existing) return existing;

    const results = await this.fetchUsersByIds([userId]);
    return results.find((u) => u.id === userId) || this.users.find((u) => u.id === userId) || null;
  }

  public queueUserFetch(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.startsWith('demo_')) return;
    if (this.users.some((u) => u.id === userId)) return;
    if (this.fetchedUserIds.has(userId) || this.inFlightUserIds.has(userId)) return;

    this.pendingUserFetchIds.add(userId);
    if (!this.userFetchTimeout) {
      this.userFetchTimeout = setTimeout(() => {
        const idsToFetch = Array.from(this.pendingUserFetchIds);
        this.pendingUserFetchIds.clear();
        this.userFetchTimeout = null;
        if (idsToFetch.length > 0) {
          this.fetchUsersByIds(idsToFetch);
        }
      }, 15);
    }
  }

  // =========================================================================
  // ROLE-GATED USER & ORGANIZER LISTENERS
  // =========================================================================
  public syncRoleListeners(user: User) {
    if (!user || !user.id) return;

    // 1. Listen to active user's own document
    if (!this.activeUserDocUnsubscribe) {
      this.activeUserDocUnsubscribe = onSnapshot(
        doc(firestore, 'users', user.id),
        (snap) => {
          if (snap.exists()) {
            const updatedUser = this.mapUserDoc(snap);
            this.mergeUsers([updatedUser]);
            this.notify();
          }
        },
        (err) => console.warn('Error listening to active user doc:', err)
      );
    }

    // 2. Listen to active user's own tournament registrations
    if (!this.userRegUnsubscribe) {
      const userRegsQuery = query(
        collection(firestore, 'tournamentPlayers'),
        where('userId', '==', user.id)
      );
      this.userRegUnsubscribe = onSnapshot(
        userRegsQuery,
        (snapshot) => {
          const myRegs: TournamentPlayer[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              tournamentId: data.tournamentId,
              userId: data.userId,
              registrationDate: data.joinedAt || data.registrationDate || new Date().toISOString(),
              playerStatus: (data.status || data.playerStatus || 'Registered') as PlayerStatus,
              paymentStatus: (data.paymentStatus || (data.paymentProofUrl ? 'PENDING_APPROVAL' : 'CONFIRMED')) as PaymentStatus,
              paymentProofUrl: data.paymentProofUrl || '',
              paymentSubmittedAt: data.paymentSubmittedAt || data.joinedAt || '',
              seed: data.seed,
              checkInCode: data.checkInCode || `SG-${data.userId ? data.userId.slice(-4).toUpperCase() : '1001'}`,
            };
          });

          // Merge my registrations with any tournament-scoped registrations
          const other = this.tournamentPlayers.filter((p) => p.userId !== user.id);
          this.tournamentPlayers = [...other, ...myRegs];
          this.notify();
        },
        (err) => console.warn('Error listening to user registrations:', err)
      );
    }

    // 3. Organizer-specific listener for their own withdrawal requests
    if (user.role === 'ORGANIZER' && !this.organizerWithdrawalsUnsub) {
      const orgWithdrawalsQuery = query(
        collection(firestore, 'withdrawalRequests'),
        where('organizerId', '==', user.id)
      );
      this.organizerWithdrawalsUnsub = onSnapshot(
        orgWithdrawalsQuery,
        (snapshot) => {
          const myWithdrawals: WithdrawalRequest[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            let tName = data.telebirrName || '';
            let tNum = data.telebirrNumber || '';
            if (!tName && data.reason && data.reason.includes('Telebirr:')) {
              const match = data.reason.match(/Telebirr:\s*([^(]+)/);
              if (match && match[1]) tName = match[1].trim();
            }
            if (!tNum && data.reason && data.reason.includes('(')) {
              const match = data.reason.match(/\(([^)]+)\)/);
              if (match && match[1]) tNum = match[1].trim();
            }
            return {
              id: docSnap.id,
              organizerId: data.organizerId || '',
              organizerName: data.organizerName || 'Organizer',
              amount: Number(data.amount || 0),
              telebirrName: tName,
              telebirrNumber: tNum,
              reason: data.reason || '',
              status: (data.status as WithdrawalStatus) || 'Pending Approval',
              requestedAt: data.requestedAt || new Date().toISOString(),
              processedAt: data.processedAt,
            };
          });
          const otherWithdrawals = this.withdrawalRequests.filter((w) => w.organizerId !== user.id);
          this.withdrawalRequests = [...otherWithdrawals, ...myWithdrawals];
          this.notify();
        },
        (err) => console.warn('Error listening to organizer withdrawal requests:', err)
      );
    }
  }

  // =========================================================================
  // ADMIN-GATED LISTENERS (Organizer Requests, Withdrawals, Pending Payments)
  // Only active when an authenticated admin is active in the session
  // =========================================================================
  public syncAdminListeners() {
    if (this.adminListeners.length > 0) return;

    // 1. Admin ORGANIZER REQUESTS
    const unsubOrgReqs = onSnapshot(
      collection(firestore, 'organizerRequests'),
      (snapshot) => {
        this.organizerRequests = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId,
            userName: data.userName || 'User',
            username: data.username || '',
            telegramUserId: data.telegramUserId || '',
            reason: data.reason || '',
            status: data.status || 'pending',
            requestedAt: data.requestedAt || new Date().toISOString(),
          };
        });
        this.notify();
      },
      (err) => console.warn('Admin organizerRequests listener error:', err)
    );

    // 2. Admin WITHDRAWAL REQUESTS (All organizers)
    const unsubWithdrawals = onSnapshot(
      collection(firestore, 'withdrawalRequests'),
      (snapshot) => {
        this.withdrawalRequests = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          let tName = data.telebirrName || '';
          let tNum = data.telebirrNumber || '';
          if (!tName && data.reason && data.reason.includes('Telebirr:')) {
            const match = data.reason.match(/Telebirr:\s*([^(]+)/);
            if (match && match[1]) tName = match[1].trim();
          }
          if (!tNum && data.reason && data.reason.includes('(')) {
            const match = data.reason.match(/\(([^)]+)\)/);
            if (match && match[1]) tNum = match[1].trim();
          }
          return {
            id: docSnap.id,
            organizerId: data.organizerId || '',
            organizerName: data.organizerName || 'Organizer',
            amount: Number(data.amount || 0),
            telebirrName: tName,
            telebirrNumber: tNum,
            reason: data.reason || '',
            status: (data.status as WithdrawalStatus) || 'Pending Approval',
            requestedAt: data.requestedAt || new Date().toISOString(),
            processedAt: data.processedAt,
          };
        });
        this.notify();
      },
      (err) => console.warn('Admin withdrawalRequests listener error:', err)
    );

    // 3. Admin PENDING PAYMENTS
    const pendingPaymentsQuery = query(
      collection(firestore, 'tournamentPlayers'),
      where('paymentStatus', '==', 'PENDING_APPROVAL')
    );
    const unsubPendingPayments = onSnapshot(
      pendingPaymentsQuery,
      (snapshot) => {
        const pending: TournamentPlayer[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            tournamentId: data.tournamentId,
            userId: data.userId,
            registrationDate: data.joinedAt || data.registrationDate || new Date().toISOString(),
            playerStatus: (data.status || data.playerStatus || 'Registered') as PlayerStatus,
            paymentStatus: 'PENDING_APPROVAL',
            paymentProofUrl: data.paymentProofUrl || '',
            paymentSubmittedAt: data.paymentSubmittedAt || data.joinedAt || '',
            seed: data.seed,
            checkInCode: data.checkInCode || `SG-${data.userId ? data.userId.slice(-4).toUpperCase() : '1001'}`,
          };
        });

        // Merge pending payments with current tournamentPlayers
        const nonPending = this.tournamentPlayers.filter((p) => p.paymentStatus !== 'PENDING_APPROVAL');
        this.tournamentPlayers = [...nonPending, ...pending];
        this.notify();
      },
      (err) => console.warn('Admin pending payments listener error:', err)
    );

    this.adminListeners.push(unsubOrgReqs, unsubWithdrawals, unsubPendingPayments);
  }

  public cleanupAdminListeners() {
    if (this.adminListeners.length > 0) {
      this.adminListeners.forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
      this.adminListeners = [];
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public isLoading(): boolean {
    return this.loading;
  }

  // =========================================================================
  // SEED & RESET DEMO DATA IN FIRESTORE
  // =========================================================================
  public async seedDemoData(): Promise<void> {
    if (!auth.currentUser) {
      console.warn('Skipping seedDemoData: No active Firebase Auth user.');
      return;
    }
    const batch = writeBatch(firestore);

    // Seed Users
    for (const u of INITIAL_USERS) {
      if (u.id === 'admin_1') continue;
      const userRef = doc(firestore, 'users', u.id);
      batch.set(
        userRef,
        {
          telegramId: u.telegramUserId,
          name: u.name,
          username: u.username,
          profilePhoto: u.profileImage,
          role: u.role,
          createdAt: new Date().toISOString(),
          id: u.id,
          gamertag: u.gamertag || u.name,
          profileImage: u.profileImage,
          telegramUserId: u.telegramUserId,
          favGame: u.favGame || 'eFootball 2026',
          venueName: u.venueName || '',
        },
        { merge: true }
      );
    }

    // Seed Tournaments
    for (const t of INITIAL_TOURNAMENTS) {
      const tourRef = doc(firestore, 'tournaments', t.id);
      batch.set(
        tourRef,
        {
          name: t.tournamentName,
          game: t.game,
          image: t.image,
          date: t.date,
          time: t.time,
          maxPlayers: t.maxPlayers,
          status: t.status,
          organizerId: t.organizerId,
          createdAt: new Date().toISOString(),
          id: t.id,
          tournamentName: t.tournamentName,
          venueName: t.venueName || '',
          rules: t.rules || '',
          format: t.format || 'elimination',
          groupSize: t.groupSize || 4,
          currentStage: t.currentStage || 'registration',
          currentRound: t.currentRound || 1,
          maxRounds: t.maxRounds || 3,
        },
        { merge: true }
      );
    }

    // Seed Tournament Players
    for (const tp of INITIAL_TOURNAMENT_PLAYERS) {
      const playerDocId = `${tp.tournamentId}_${tp.userId}`;
      const playerRef = doc(firestore, 'tournamentPlayers', playerDocId);
      batch.set(
        playerRef,
        {
          tournamentId: tp.tournamentId,
          userId: tp.userId,
          status: tp.playerStatus,
          joinedAt: tp.registrationDate,
          registrationDate: tp.registrationDate,
          playerStatus: tp.playerStatus,
          seed: tp.seed || 1,
        },
        { merge: true }
      );
    }

    // Seed Demo Groups for tour_1 & tour_3
    const demoGroups = [
      { id: 'tour_1_group_A', tournamentId: 'tour_1', groupName: 'Group A', playerIds: ['user_tg_77201948', 'user_tg_66102938', 'user_tg_55019283', 'user_tg_44019284'], roundNumber: 1 },
      { id: 'tour_1_group_B', tournamentId: 'tour_1', groupName: 'Group B', playerIds: ['user_tg_33019285', 'user_tg_22019286'], roundNumber: 1 },
      { id: 'tour_3_group_A', tournamentId: 'tour_3', groupName: 'Group A', playerIds: ['user_tg_77201948', 'user_tg_66102938', 'user_tg_55019283', 'user_tg_44019284'], roundNumber: 1 },
      { id: 'tour_3_group_B', tournamentId: 'tour_3', groupName: 'Group B', playerIds: ['user_tg_33019285', 'user_tg_22019286'], roundNumber: 1 },
    ];
    for (const g of demoGroups) {
      batch.set(doc(firestore, 'tournamentGroups', g.id), g, { merge: true });
    }

    // Seed Demo Points Scores for tour_3 (PUBG format)
    const demoScores = [
      { id: 'tour_3_r1_user_player_1', tournamentId: 'tour_3', userId: 'user_tg_77201948', roundNumber: 1, points: 28, groupId: 'tour_3_group_A' },
      { id: 'tour_3_r1_user_player_2', tournamentId: 'tour_3', userId: 'user_tg_66102938', roundNumber: 1, points: 19, groupId: 'tour_3_group_A' },
      { id: 'tour_3_r1_user_player_3', tournamentId: 'tour_3', userId: 'user_tg_55019283', roundNumber: 1, points: 14, groupId: 'tour_3_group_A' },
      { id: 'tour_3_r1_user_player_4', tournamentId: 'tour_3', userId: 'user_tg_44019284', roundNumber: 1, points: 8, groupId: 'tour_3_group_A' },
      { id: 'tour_3_r1_user_player_5', tournamentId: 'tour_3', userId: 'user_tg_33019285', roundNumber: 1, points: 22, groupId: 'tour_3_group_B' },
      { id: 'tour_3_r1_user_player_6', tournamentId: 'tour_3', userId: 'user_tg_22019286', roundNumber: 1, points: 11, groupId: 'tour_3_group_B' },
    ];
    for (const sc of demoScores) {
      batch.set(doc(firestore, 'roundScores', sc.id), sc, { merge: true });
    }

    // Seed Matches
    for (const m of INITIAL_MATCHES) {
      const matchRef = doc(firestore, 'matches', m.id);
      batch.set(
        matchRef,
        {
          tournamentId: m.tournamentId,
          round: m.round,
          playerA: m.playerAId,
          playerB: m.playerBId,
          station: m.stationNumber,
          winner: m.winnerId,
          score: m.score,
          status: m.status,
          id: m.id,
          playerAId: m.playerAId,
          playerBId: m.playerBId,
          stationNumber: m.stationNumber,
          winnerId: m.winnerId,
        },
        { merge: true }
      );
    }

    await batch.commit();
  }

  public async resetToDefault(): Promise<void> {
    await this.seedDemoData();
  }

  // =========================================================================
  // TELEGRAM AUTHENTICATION & APPROVED ORGANIZERS
  // =========================================================================
  public getUsers(): User[] {
    return [...this.users];
  }

  public getApprovedOrganizerIds(): string[] {
    return [...this.approvedOrganizerIds];
  }

  public isApprovedOrganizer(identifier: string | number): boolean {
    if (!identifier) return false;
    // Normalize any identifier variation: 88492019, tg_88492019, user_tg_88492019, user_88492019
    const cleanId = String(identifier)
      .replace(/^user_tg_/, '')
      .replace(/^user_/, '')
      .replace(/^tg_/, '')
      .trim();
    if (!cleanId) return false;

    // Check direct in-memory approved list (real-time mirror of approvedOrganizers collection)
    const inApprovedList = this.approvedOrganizerIds.some((id) => {
      const normalizedDocId = id
        .replace(/^user_tg_/, '')
        .replace(/^user_/, '')
        .replace(/^tg_/, '')
        .trim();
      return normalizedDocId === cleanId;
    });

    if (inApprovedList) return true;

    // Also check if the user object with this identifier has organizerRequestStatus === 'approved'
    const matchedUser = this.users.find((u) => {
      const uCleanTg = (u.telegramUserId || '').replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();
      const uCleanId = (u.id || '').replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();
      return uCleanTg === cleanId || uCleanId === cleanId;
    });

    if (matchedUser && matchedUser.organizerRequestStatus === 'approved') {
      return true;
    }

    return false;
  }

  public async addApprovedOrganizerId(telegramUserId: string): Promise<boolean> {
    const cleanId = String(telegramUserId)
      .replace(/^user_tg_/, '')
      .replace(/^user_/, '')
      .replace(/^tg_/, '')
      .trim();
    if (!cleanId) return false;

    // Save authoritative record to Firestore
    await setDoc(doc(firestore, 'approvedOrganizers', cleanId), {
      approved: true,
      createdAt: new Date().toISOString(),
    });

    if (!this.approvedOrganizerIds.includes(cleanId)) {
      this.approvedOrganizerIds.push(cleanId);
    }

    // Check if user exists and upgrade role & status
    const existingUser = this.users.find((u) => {
      const uCleanTg = (u.telegramUserId || '').replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();
      const uCleanId = (u.id || '').replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();
      return uCleanTg === cleanId || uCleanId === cleanId;
    });

    if (existingUser) {
      existingUser.role = 'ORGANIZER';
      existingUser.organizerRequestStatus = 'approved';
      await updateDoc(doc(firestore, 'users', existingUser.id), {
        role: 'ORGANIZER',
        organizerRequestStatus: 'approved',
      }).catch((err) => console.warn('Could not update user document role:', err));
    }
    this.notify();
    return true;
  }

  public async removeApprovedOrganizerId(telegramUserId: string): Promise<boolean> {
    const cleanId = String(telegramUserId)
      .replace(/^user_tg_/, '')
      .replace(/^user_/, '')
      .replace(/^tg_/, '')
      .trim();
    if (!cleanId) return false;
    await deleteDoc(doc(firestore, 'approvedOrganizers', cleanId));

    this.approvedOrganizerIds = this.approvedOrganizerIds.filter((id) => {
      const normalized = id.replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();
      return normalized !== cleanId;
    });

    // Demote any user with this Telegram ID back to PLAYER role in Firestore
    const existingUser = this.users.find((u) => {
      const uCleanTg = (u.telegramUserId || '').replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();
      const uCleanId = (u.id || '').replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();
      return uCleanTg === cleanId || uCleanId === cleanId;
    });

    if (existingUser) {
      existingUser.role = 'PLAYER';
      existingUser.organizerRequestStatus = 'rejected';
      await updateDoc(doc(firestore, 'users', existingUser.id), {
        role: 'PLAYER',
        organizerRequestStatus: 'rejected',
      }).catch((err) => console.warn('Could not update user document role:', err));
    }
    this.notify();
    return true;
  }

  public processTelegramUser(tgUser: TelegramUser): { isNewUser: boolean; roleGiven: UserRole } {
    const rawIdStr = String(tgUser.id);
    const cleanTgId = rawIdStr.replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();
    const isApproved = this.isApprovedOrganizer(cleanTgId);

    const existingUser = this.users.find(
      (u) =>
        u.telegramUserId === cleanTgId ||
        u.telegramUserId === `tg_${cleanTgId}` ||
        u.id === `user_tg_${cleanTgId}` ||
        u.id === `user_${cleanTgId}`
    );

    if (existingUser) {
      // If user is already approved as an organizer, preserve their existing perspective (ORGANIZER or PLAYER)
      // If user is NOT approved as an organizer, force PLAYER (unless ADMIN)
      let role: UserRole = existingUser.role;
      if (!isApproved && role === 'ORGANIZER') {
        role = 'PLAYER';
      } else if (!role) {
        role = isApproved ? 'ORGANIZER' : 'PLAYER';
      }

      const updates: Record<string, any> = {};

      // Preserve existing custom user edits! Only populate if missing or generic placeholder.
      if (!existingUser.name || existingUser.name === 'Competitor' || existingUser.name.startsWith('TG Competitor #')) {
        const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
        if (fullName) {
          updates.name = fullName;
          existingUser.name = fullName;
        }
      }

      if (!existingUser.gamertag) {
        const defaultTag = tgUser.username ? `@${tgUser.username}` : existingUser.name;
        updates.gamertag = defaultTag;
        existingUser.gamertag = defaultTag;
      }

      if (tgUser.username && !existingUser.username) {
        updates.username = tgUser.username;
        existingUser.username = tgUser.username;
      }

      if (!existingUser.profileImage || existingUser.profileImage.includes('unsplash.com')) {
        if (tgUser.photo_url) {
          updates.profilePhoto = tgUser.photo_url;
          updates.profileImage = tgUser.photo_url;
          existingUser.profileImage = tgUser.photo_url;
        }
      }

      existingUser.role = role;

      // Strip protected fields from updates if user is not admin
      if (!this.isFirebaseAdminAuthenticated()) {
        delete updates.role;
        delete updates.isApproved;
        delete updates.walletBalance;
        delete updates.firebaseAuthUid;
        delete updates.telegramUserId;
        delete updates.organizerRequestStatus;
      }

      if (Object.keys(updates).length > 0) {
        setDoc(doc(firestore, 'users', existingUser.id), updates, { merge: true }).catch((err) =>
          console.error('Failed to sync Telegram user to Firestore:', err)
        );
      }

      this.setActiveUserId(existingUser.id);
      return { isNewUser: false, roleGiven: role };
    } else {
      // Every user is automatically given the role of "PLAYER" unless pre-approved as Organizer.
      const role: 'PLAYER' | 'ORGANIZER' = isApproved ? 'ORGANIZER' : 'PLAYER';
      const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || `TG Competitor #${cleanTgId}`;
      const username = tgUser.username || `tg_user_${cleanTgId}`;
      const profilePhoto =
        tgUser.photo_url ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

      const newUserId = `user_tg_${cleanTgId}`;
      const newUserDoc = {
        telegramId: `tg_${cleanTgId}`,
        name: fullName,
        username: username,
        profilePhoto: profilePhoto,
        role: role,
        createdAt: new Date().toISOString(),
        id: newUserId,
        gamertag: tgUser.username ? `@${tgUser.username}` : fullName,
        profileImage: profilePhoto,
        telegramUserId: `tg_${cleanTgId}`,
        favGame: 'eFootball 2026',
      };

      const newUser: User = {
        id: newUserId,
        name: fullName,
        username: username,
        profileImage: profilePhoto,
        telegramUserId: `tg_${cleanTgId}`,
        role: role,
        gamertag: tgUser.username ? `@${tgUser.username}` : fullName,
        favGame: 'eFootball 2026',
      };

      const existingIdx = this.users.findIndex((u) => u.id === newUserId);
      if (existingIdx >= 0) {
        this.users[existingIdx] = newUser;
      } else {
        this.users.push(newUser);
      }

      setDoc(doc(firestore, 'users', newUserId), newUserDoc).catch((err) =>
        console.error('Failed to create new Telegram user in Firestore:', err)
      );

      this.setActiveUserId(newUserId);
      return { isNewUser: true, roleGiven: role };
    }
  }

  // ACTIVE USER MANAGEMENT (Fail-closed, strictly verified)
  public getActiveUser(): User | null {
    if (!this.activeUserId) return null;
    const user = this.users.find((u) => u.id === this.activeUserId);
    return user || null;
  }

  public setActiveUserId(userId: string | null) {
    this.activeUserId = userId;
    if (userId) {
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_USER, userId);
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
      } catch {
        // ignore
      }
    }
    this.notify();
  }

  public logout() {
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('SG_USER_CACHE_')) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // ignore
    }
    this.activeUserId = null;
    this.notify();
  }

  public async toggleUserRole(userId: string): Promise<void> {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      const isCurrentlyApproved = this.isApprovedOrganizer(user.telegramUserId || user.id);

      // Users CANNOT self-grant ORGANIZER perspective without authoritative Admin approval
      if (user.role === 'PLAYER' && !isCurrentlyApproved) {
        throw new Error('ORGANIZER_APPROVAL_REQUIRED: Organizer access requires Admin approval.');
      }

      const newRole: UserRole = user.role === 'PLAYER' ? 'ORGANIZER' : 'PLAYER';
      
      // Update the client in-memory perspective state cleanly without violating Firestore security rules
      user.role = newRole;

      // Only attempt Firestore write if the caller is an authenticated Admin (since non-admins cannot mutate role)
      if (this.isFirebaseAdminAuthenticated()) {
        await updateDoc(doc(firestore, 'users', userId), { role: newRole }).catch(() => {});
      }

      this.notify();
    }
  }

  public async adminGrantOrganizer(userId: string): Promise<void> {
    const user = this.getUserById(userId);
    if (!user) return;
    const cleanTgId = (user.telegramUserId || user.id)
      .replace(/^user_tg_/, '')
      .replace(/^user_/, '')
      .replace(/^tg_/, '')
      .trim();

    await updateDoc(doc(firestore, 'users', userId), {
      role: 'ORGANIZER',
      organizerRequestStatus: 'approved',
    }).catch(() => {});

    await setDoc(doc(firestore, 'approvedOrganizers', cleanTgId), {
      approved: true,
      createdAt: new Date().toISOString(),
    });

    if (!this.approvedOrganizerIds.includes(cleanTgId)) {
      this.approvedOrganizerIds.push(cleanTgId);
    }
    user.role = 'ORGANIZER';
    user.organizerRequestStatus = 'approved';

    this.addNotification({
      userId,
      title: '🎉 Organizer Access Approved!',
      message: 'Your Organizer privileges have been officially granted by Admin. Access your Organizer Panel below.',
      type: 'system',
    });

    this.notify();
  }

  public async adminRevokeOrganizer(userId: string): Promise<void> {
    const user = this.getUserById(userId);
    if (!user) return;
    const cleanTgId = (user.telegramUserId || user.id)
      .replace(/^user_tg_/, '')
      .replace(/^user_/, '')
      .replace(/^tg_/, '')
      .trim();

    await updateDoc(doc(firestore, 'users', userId), {
      role: 'PLAYER',
      organizerRequestStatus: 'rejected',
    }).catch(() => {});

    await deleteDoc(doc(firestore, 'approvedOrganizers', cleanTgId)).catch(() => {});

    this.approvedOrganizerIds = this.approvedOrganizerIds.filter((id) => {
      const normalized = id.replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();
      return normalized !== cleanTgId;
    });
    user.role = 'PLAYER';
    user.organizerRequestStatus = 'rejected';

    this.addNotification({
      userId,
      title: 'Role Update',
      message: 'Your role has been set to Player by Admin.',
      type: 'system',
    });

    this.notify();
  }

  // ORGANIZER REQUESTS METHODS
  public getOrganizerRequests(): OrganizerRequest[] {
    return [...this.organizerRequests];
  }

  public async submitOrganizerRequest(userId: string, reason: string = ''): Promise<boolean> {
    const user = this.getUserById(userId);
    if (!user) return false;

    // Idempotency check 1: If user is already approved as an organizer, do NOT create another request
    if (this.isApprovedOrganizer(user.telegramUserId || user.id)) {
      return true;
    }

    const reqId = `req_${userId}`;
    const cleanTgId = (user.telegramUserId || '').replace(/^user_tg_/, '').replace(/^user_/, '').replace(/^tg_/, '').trim();

    // Idempotency check 2: If a request is already pending, do NOT duplicate
    const existingReq = this.organizerRequests.find((r) => r.id === reqId || r.userId === userId);
    if (existingReq && existingReq.status === 'pending') {
      return true;
    }

    const newReq: OrganizerRequest = {
      id: reqId,
      userId,
      userName: user.name,
      username: user.username,
      telegramUserId: cleanTgId,
      reason,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    const existingIdx = this.organizerRequests.findIndex((r) => r.id === reqId || r.userId === userId);
    if (existingIdx >= 0) {
      this.organizerRequests[existingIdx] = newReq;
    } else {
      this.organizerRequests.push(newReq);
    }
    this.notify();

    try {
      await setDoc(doc(firestore, 'organizerRequests', reqId), {
        userId,
        userName: user.name,
        username: user.username,
        telegramUserId: cleanTgId,
        reason,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });

      await updateDoc(doc(firestore, 'users', userId), {
        organizerRequestReason: reason,
      }).catch(() => {});
    } catch (err) {
      console.error('Error saving organizer request to Firestore:', err);
    }

    return true;
  }

  public async approveOrganizerRequest(requestId: string): Promise<void> {
    const req = this.organizerRequests.find((r) => r.id === requestId);
    if (!req) return;

    await updateDoc(doc(firestore, 'organizerRequests', requestId), { status: 'approved' });
    await this.adminGrantOrganizer(req.userId);
  }

  public async rejectOrganizerRequest(requestId: string): Promise<void> {
    const req = this.organizerRequests.find((r) => r.id === requestId);
    if (!req) return;

    await updateDoc(doc(firestore, 'organizerRequests', requestId), { status: 'rejected' });
    await this.adminRevokeOrganizer(req.userId);
  }

  public async updateUserProfilePhoto(userId: string, photoUrl: string): Promise<void> {
    let safePhoto = photoUrl;
    if (safePhoto && safePhoto.startsWith('data:image/')) {
      safePhoto = await compressImage(safePhoto, 400, 400, 0.7);
    }
    await this.updateUser({
      id: userId,
      profileImage: safePhoto,
    });
  }

  public async registerPlayerWithPaymentProof(
    tournamentId: string,
    userId: string,
    paymentProofUrl: string
  ): Promise<boolean> {
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament) return false;

    const currentPlayers = this.getTournamentPlayers(tournamentId);
    if (currentPlayers.length >= tournament.maxPlayers) return false;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const docId = `${tournamentId}_${userId}`;
    const playerRef = doc(firestore, 'tournamentPlayers', docId);

    let safeProof = paymentProofUrl;
    if (safeProof && safeProof.startsWith('data:image/')) {
      safeProof = await compressImage(safeProof, 600, 800, 0.6);
    }

    await setDoc(playerRef, {
      tournamentId,
      userId,
      status: 'Registered',
      joinedAt: formattedDate,
      registrationDate: formattedDate,
      playerStatus: 'Registered',
      paymentStatus: 'PENDING_APPROVAL',
      paymentProofUrl: safeProof,
      paymentSubmittedAt: formattedDate,
      seed: currentPlayers.length + 1,
    });

    return true;
  }

  public async updatePaymentStatus(
    tournamentId: string,
    userId: string,
    paymentStatus: PaymentStatus
  ): Promise<void> {
    const docId = `${tournamentId}_${userId}`;
    const playerRef = doc(firestore, 'tournamentPlayers', docId);

    const playerObj = this.tournamentPlayers.find(
      (p) => p.tournamentId === tournamentId && p.userId === userId
    );
    if (playerObj) {
      playerObj.paymentStatus = paymentStatus;
      this.notify();
    }

    if (paymentStatus === 'CONFIRMED') {
      this.addNotification({
        userId,
        title: '🎉 Payment Approved!',
        message: 'Your registration payment was verified by Admin. You are now officially registered!',
        type: 'tournament',
        tournamentId,
      });
    } else if (paymentStatus === 'REJECTED') {
      this.addNotification({
        userId,
        title: '❌ Payment Proof Rejected',
        message: 'Your payment proof was rejected. Please upload a valid payment screenshot.',
        type: 'tournament',
        tournamentId,
      });
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      const currentUid = auth.currentUser?.uid;
      const res = await fetch('/api/financial/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(currentUid ? { 'x-user-id': currentUid } : {}),
        },
        body: JSON.stringify({
          tournamentId,
          userId,
          paymentStatus,
          idempotencyKey: `confirm_${tournamentId}_${userId}_${paymentStatus}`,
        }),
      });
      if (res.ok) {
        return;
      }
    } catch (err) {
      console.warn('Server payment confirmation failed, using fallback:', err);
    }

    await setDoc(
      playerRef,
      {
        paymentStatus,
        status: 'Registered',
      },
      { merge: true }
    );
  }

  public getUserById(id: string): User | undefined {
    const found = this.users.find((u) => u.id === id);
    if (!found && id && !id.startsWith('demo_')) {
      this.queueUserFetch(id);
    }
    return found;
  }

  public async updateUser(updatedUser: Partial<User> & { id: string }): Promise<void> {
    const user = this.users.find((u) => u.id === updatedUser.id);
    let safeUser = { ...updatedUser };

    if (safeUser.profileImage && safeUser.profileImage.startsWith('data:image/')) {
      try {
        safeUser.profileImage = await compressImage(safeUser.profileImage, 400, 400, 0.7);
      } catch (err) {
        console.warn('Failed image compression in updateUser:', err);
      }
    }

    if (user) {
      Object.assign(user, safeUser);
      this.notify();
    }

    // Local Storage backup persistence
    try {
      const existingCache = localStorage.getItem(`SG_USER_CACHE_${updatedUser.id}`);
      const cacheObj = existingCache ? JSON.parse(existingCache) : {};
      const mergedCache = { ...cacheObj, ...(user || {}), ...safeUser };
      // Preserve existing authoritative role for non-admin updates
      if (!this.isFirebaseAdminAuthenticated() && user?.role) {
        mergedCache.role = user.role;
      }
      localStorage.setItem(`SG_USER_CACHE_${updatedUser.id}`, JSON.stringify(mergedCache));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    try {
      const ref = doc(firestore, 'users', updatedUser.id);
      const payload: Record<string, any> = { ...safeUser };
      if (safeUser.profileImage) {
        payload.profilePhoto = safeUser.profileImage;
        payload.profileImage = safeUser.profileImage;
      }
      if (safeUser.phoneNumber) {
        payload.phoneNumber = safeUser.phoneNumber;
        payload.phone = safeUser.phoneNumber;
      }

      // Strip protected fields from payload so non-admin user updates pass Firestore security rules
      if (!this.isFirebaseAdminAuthenticated()) {
        delete payload.role;
        delete payload.isApproved;
        delete payload.walletBalance;
        delete payload.firebaseAuthUid;
        delete payload.telegramUserId;
        delete payload.telegramId;
        delete payload.organizerRequestStatus;
      }

      if (Object.keys(payload).length > 0) {
        await setDoc(ref, payload, { merge: true });
      }
    } catch (err) {
      console.error('Error saving user to Firestore:', err);
    }
  }

  public async updatePlayerStatus(
    tournamentId: string,
    userId: string,
    status: PlayerStatus
  ): Promise<void> {
    const docId = `${tournamentId}_${userId}`;
    const playerRef = doc(firestore, 'tournamentPlayers', docId);

    const playerObj = this.tournamentPlayers.find(
      (p) => p.tournamentId === tournamentId && p.userId === userId
    );
    if (playerObj) {
      playerObj.playerStatus = status;
      this.notify();
    }

    await setDoc(
      playerRef,
      {
        playerStatus: status,
        status: status,
      },
      { merge: true }
    );
  }

  public async verifyCheckInCode(
    tournamentId: string,
    checkInCode: string
  ): Promise<{ success: boolean; message: string; userId?: string }> {
    const rawInput = checkInCode.trim().toUpperCase();
    const cleanCode = rawInput.replace(/^SG-/, '');
    const player = this.tournamentPlayers.find(
      (p) =>
        p.tournamentId === tournamentId &&
        (p.checkInCode?.toUpperCase() === rawInput ||
         p.checkInCode?.replace(/^SG-/, '').toUpperCase() === cleanCode ||
         p.userId.toUpperCase() === rawInput ||
         p.userId.toUpperCase().endsWith(cleanCode))
    );

    if (!player) {
      return { success: false, message: 'Invalid Check-In Code. No matching player found.' };
    }

    if (player.paymentStatus !== 'CONFIRMED') {
      return {
        success: false,
        message: 'Player registration must first be approved by the Admin before check-in.',
      };
    }

    await this.updatePlayerStatus(tournamentId, player.userId, 'Checked In');
    const user = this.getUserById(player.userId);

    this.addNotification({
      userId: player.userId,
      title: '✅ Check-In Verified!',
      message: `Your check-in code (${player.checkInCode ? player.checkInCode.replace(/^SG-/, '') : cleanCode}) has been verified by the organizer. You are now checked-in for match calls!`,
      type: 'tournament',
      tournamentId,
    });

    return {
      success: true,
      message: `Successfully checked in player ${user?.name || player.userId}!`,
      userId: player.userId,
    };
  }

  public async removePlayerFromTournament(tournamentId: string, userId: string): Promise<void> {
    const docId = `${tournamentId}_${userId}`;
    const playerRef = doc(firestore, 'tournamentPlayers', docId);

    this.tournamentPlayers = this.tournamentPlayers.filter(
      (p) => !(p.tournamentId === tournamentId && p.userId === userId)
    );
    this.notify();

    await deleteDoc(playerRef).catch(() => {});
  }

  public async addUser(user: {
    name: string;
    username: string;
    telegramUserId: string;
    role: UserRole;
    gamertag?: string;
    favGame?: string;
    profileImage?: string;
  }): Promise<string> {
    const cleanId = user.telegramUserId.trim().replace(/^tg_/, '') || Date.now().toString();
    const id = `user_${cleanId}`;
    const profileImage =
      user.profileImage || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    const newUserDoc = {
      id,
      name: user.name,
      username: user.username.replace(/^@/, ''),
      profilePhoto: profileImage,
      profileImage,
      telegramId: `tg_${cleanId}`,
      telegramUserId: `tg_${cleanId}`,
      role: user.role,
      gamertag: user.gamertag || user.name,
      favGame: user.favGame || 'eFootball 2026',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(firestore, 'users', id), newUserDoc);
    if (user.role === 'ORGANIZER') {
      await setDoc(doc(firestore, 'approvedOrganizers', cleanId), {
        approved: true,
        createdAt: new Date().toISOString(),
      });
    }
    return id;
  }

  public async deleteUser(userId: string): Promise<void> {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      const cleanTgId = user.telegramUserId.replace(/^tg_/, '');
      await deleteDoc(doc(firestore, 'approvedOrganizers', cleanTgId)).catch(() => {});
    }
    await deleteDoc(doc(firestore, 'users', userId));
  }

  public async deleteTournament(tournamentId: string): Promise<void> {
    await deleteDoc(doc(firestore, 'tournaments', tournamentId));
    const players = this.tournamentPlayers.filter((tp) => tp.tournamentId === tournamentId);
    for (const p of players) {
      await deleteDoc(doc(firestore, 'tournamentPlayers', `${tournamentId}_${p.userId}`)).catch(() => {});
    }
    const matches = this.matches.filter((m) => m.tournamentId === tournamentId);
    for (const m of matches) {
      await deleteDoc(doc(firestore, 'matches', m.id)).catch(() => {});
    }
  }

  private currentLoginAttemptId: number = 0;

  public async loginAdminWithFirebase(email: string, pass: string): Promise<boolean> {
    const attemptId = ++this.currentLoginAttemptId;
    try {
      console.log('[ADMIN LOGIN] Firebase signIn started, attempt =', attemptId);
      const signInPromise = signInWithEmailAndPassword(auth, email.trim(), pass);

      // Guard against late Firebase resolution after timeout or cancellation
      signInPromise
        .then(async () => {
          if (this.currentLoginAttemptId !== attemptId) {
            console.log('[ADMIN LOGIN] Late Firebase resolution detected for stale attempt, signing out');
            try {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('tc_admin_session_v2');
              }
              await signOut(auth).catch(() => {});
            } catch {}
            this.notify();
          }
        })
        .catch(() => {});

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sign in request timed out.')), 15000)
      );

      const userCredential = await Promise.race([signInPromise, timeoutPromise]);
      if (this.currentLoginAttemptId !== attemptId) {
        // Attempt was superseded or cancelled
        await signOut(auth).catch(() => {});
        return false;
      }

      const fbUser = userCredential.user;
      if (!fbUser) {
        console.log('[ADMIN LOGIN] Firebase signIn failed: user is null');
        return false;
      }
      console.log('[ADMIN LOGIN] Firebase signIn succeeded, UID =', fbUser.uid);

      // Immediately establish session metadata so validateAdminSession does not treat this as stale
      const now = Date.now();
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'tc_admin_session_v2',
            JSON.stringify({
              adminUid: fbUser.uid,
              sessionStartedAt: now,
              lastActivityAt: now,
            })
          );
        }
      } catch (err) {
        console.warn('[ADMIN LOGIN] Non-fatal localStorage error:', err);
      }

      console.log('[ADMIN LOGIN] login complete');
      this.notify();
      return true;
    } catch (err: any) {
      console.error('[ADMIN LOGIN] login failed =', err?.message || err);
      // Invalidate attempt ID so any late resolution is rejected
      if (this.currentLoginAttemptId === attemptId) {
        this.currentLoginAttemptId++;
      }
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('tc_admin_session_v2');
        }
        await signOut(auth).catch(() => {});
      } catch {}
      this.notify();
      return false;
    }
  }

  public async logoutAdminWithFirebase(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('tc_admin_session_v2');
          sessionStorage.removeItem('tc_admin_session_started_at');
          sessionStorage.removeItem('tc_admin_last_activity_at');
        } catch {}
      }
      await signOut(auth);
    } catch (err) {
      console.error('Firebase signOut error:', err);
    }
    this.notify();
  }

  public isFirebaseAdminAuthenticated(): boolean {
    const user = auth.currentUser;
    if (!user) return false;
    // Admin uses Email/Password authentication (has email or non-tg UID)
    return !!user.email || (!!user.uid && !user.uid.startsWith('tg_'));
  }

  public getAdminAuthUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  public getRecentGames(): string[] {
    return [
      'eFootball',
      'PUBG Mobile',
      'Asphalt Legends Unite',
      'Call of Duty: Mobile',
      'Ludo King',
      '8 Ball Pool',
      'Shadow Fight 4: Arena',
      'Chess.com',
    ];
  }

  // TABLE 2: TOURNAMENTS
  public getTournaments(): Tournament[] {
    return [...this.tournaments];
  }

  // Players & Public search see approved tournaments
  public getApprovedTournaments(): Tournament[] {
    return this.tournaments.filter((t) => t.isApproved !== false);
  }

  // Admin sees tournaments pending approval
  public getPendingTournamentsForAdmin(): Tournament[] {
    return this.tournaments.filter((t) => t.isApproved === false);
  }

  // Organizers only manage tournaments they created
  public getOrganizerTournaments(organizerId: string): Tournament[] {
    const cleanId = organizerId.replace(/^user_/, '').replace(/^tg_/, '');
    return this.tournaments.filter((t) => {
      if (t.organizerId === organizerId) return true;
      const tourOrgClean = (t.organizerId || '').replace(/^user_/, '').replace(/^tg_/, '');
      return Boolean(cleanId && tourOrgClean && (tourOrgClean === cleanId || tourOrgClean.includes(cleanId) || cleanId.includes(tourOrgClean)));
    });
  }

  public getTournamentById(id: string): Tournament | undefined {
    return this.tournaments.find((t) => t.id === id);
  }

  public getTournamentByStartParam(startParam: string): Tournament | undefined {
    if (!startParam || typeof startParam !== 'string') return undefined;
    const cleanParam = decodeURIComponent(startParam).trim();
    if (!cleanParam) return undefined;

    // Explicitly reject navigation tab keywords from tournament lookup
    const lowerParam = cleanParam.toLowerCase();
    if (
      lowerParam === 'home' ||
      lowerParam === 'tournaments' ||
      lowerParam === 'tournament' ||
      lowerParam === 'tournament_center' ||
      lowerParam === 'tours' ||
      lowerParam === 'players' ||
      lowerParam === 'profile' ||
      lowerParam === 'organizer_panel' ||
      lowerParam === 'manage'
    ) {
      return undefined;
    }

    // 1. Direct ID match
    let found = this.tournaments.find((t) => t.id === cleanParam);
    if (found) return found;

    // 2. Direct tournamentCode match (4-digit numeric search e.g. "0001", "0047")
    if (cleanParam.length <= 6) {
      const codeMatch = cleanParam.replace(/^#/, '').trim();
      if (codeMatch) {
        found = this.tournaments.find(
          (t) => t.tournamentCode && (t.tournamentCode === codeMatch || t.tournamentCode === codeMatch.padStart(4, '0'))
        );
        if (found) return found;
      }
    }

    // 3. Strip prefixes like "tournament_", "tour_tour_", "tour_"
    const stripped = cleanParam
      .replace(/^tournament_/, '')
      .replace(/^tour_tour_/, '')
      .replace(/^tour_/, '');
    if (stripped) {
      // Check if stripped matches tournamentCode (e.g. startapp=tournament_0047 -> stripped "0047")
      found = this.tournaments.find(
        (t) =>
          t.tournamentCode &&
          (t.tournamentCode === stripped ||
            t.tournamentCode === stripped.padStart(4, '0'))
      );
      if (found) return found;

      found = this.tournaments.find(
        (t) =>
          t.id === stripped ||
          t.id === `tour_${stripped}` ||
          t.id === `tour_tour_${stripped}`
      );
      if (found) return found;

      found = this.tournaments.find((t) => t.id.endsWith(stripped));
      if (found) return found;
    }

    // 4. Fallback search by ID or tournamentCode
    return this.tournaments.find(
      (t) =>
        cleanParam.includes(t.id) ||
        t.id.includes(cleanParam) ||
        (t.tournamentCode && (cleanParam.includes(t.tournamentCode) || t.tournamentCode.includes(cleanParam)))
    );
  }

  public async approveTournament(
    tournamentId: string,
    paymentDetails?: { telebirrName?: string; telebirrNumber?: string }
  ): Promise<void> {
    const updates: Partial<Tournament> = { isApproved: true };
    if (paymentDetails) {
      if (paymentDetails.telebirrNumber !== undefined) {
        updates.telebirrNumber = paymentDetails.telebirrNumber.trim();
      }
      if (paymentDetails.telebirrName !== undefined) {
        updates.telebirrAccountName = paymentDetails.telebirrName.trim();
        updates.telebirrName = paymentDetails.telebirrName.trim();
      }
    }
    await this.updateTournament(tournamentId, updates);
    const tour = this.getTournamentById(tournamentId);
    if (tour) {
      this.addNotification({
        userId: tour.organizerId,
        title: 'Tournament Approved! 🎉',
        message: `Your tournament "${tour.tournamentName}" has been approved by Admin and is now live for players to register!`,
        type: 'tournament_approval',
        tournamentId: tour.id,
      });
    }
  }

  public async rejectTournament(tournamentId: string): Promise<void> {
    const tour = this.getTournamentById(tournamentId);
    if (tour) {
      this.addNotification({
        userId: tour.organizerId,
        title: 'Tournament Creation Request',
        message: `Your tournament "${tour.tournamentName}" requires updates before approval. Please review details.`,
        type: 'tournament_approval',
        tournamentId: tour.id,
      });
    }
    await this.deleteTournament(tournamentId);
  }

  public getTournamentGroups(tournamentId: string): TournamentGroup[] {
    return this.tournamentGroups.filter((g) => g.tournamentId === tournamentId);
  }

  // =========================================================================
  // NEW WORKFLOW: SESSIONS, ACCUMULATED STANDINGS & FINAL RESULTS
  // =========================================================================

  public getTournamentSessions(tournamentId: string): TournamentSession[] {
    return this.tournamentSessions.filter((s) => s.tournamentId === tournamentId);
  }

  public getAccumulatedPlayerStats(
    tournamentId: string,
    userId: string,
    roundNumber?: number
  ): { points: number; performance: number } {
    let sessions = this.tournamentSessions.filter((s) => s.tournamentId === tournamentId);
    if (roundNumber !== undefined) {
      sessions = sessions.filter((s) => s.roundNumber === roundNumber);
    }
    let points = 0;
    let performance = 0;
    sessions.forEach((sess) => {
      const matchScore = sess.scores?.find((sc) => sc.userId === userId);
      if (matchScore) {
        points += Number(matchScore.points) || 0;
        performance += Number(matchScore.performance) || 0;
      }
    });
    return { points, performance };
  }

  public getGroupStandingsWithAccumulated(
    tournamentId: string,
    groupId: string
  ): {
    userId: string;
    user?: User;
    points: number;
    performance: number;
    status: 'Waiting' | 'Qualified' | 'Eliminated' | 'Champion';
    manualRank?: number;
    rank: number;
  }[] {
    const group = this.tournamentGroups.find((g) => g.id === groupId);
    if (!group) return [];

    const roundNum = group.roundNumber || 1;
    const playerIds = group.playerIds || [];

    const list = playerIds.map((uid) => {
      const stats = this.getAccumulatedPlayerStats(tournamentId, uid, roundNum);
      const status = group.playerStatuses?.[uid] || 'Waiting';
      const manualRank = group.manualRanks?.[uid];
      return {
        userId: uid,
        user: this.getUserById(uid),
        points: stats.points,
        performance: stats.performance,
        status,
        manualRank,
      };
    });

    // Sort primarily by Total Points descending.
    // In tie situations (equal points), manual rank override if set, else performance.
    list.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (a.manualRank !== undefined && b.manualRank !== undefined) {
        return a.manualRank - b.manualRank;
      }
      if (a.manualRank !== undefined) return -1;
      if (b.manualRank !== undefined) return 1;
      return b.performance - a.performance;
    });

    return list.map((item, idx) => ({
      ...item,
      rank: item.manualRank !== undefined ? item.manualRank : idx + 1,
    }));
  }

  public async createSession(tournamentId: string, roundNumber: number, name?: string): Promise<TournamentSession> {
    const roundSessions = this.tournamentSessions.filter(
      (s) => s.tournamentId === tournamentId && s.roundNumber === roundNumber
    );
    const tour = this.getTournamentById(tournamentId);
    const label = tour?.sessionLabel || 'Match';
    const sessionName = name || `${label} ${roundSessions.length + 1}`;
    const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newSession: TournamentSession = {
      id,
      tournamentId,
      roundNumber,
      name: sessionName,
      scores: [],
    };

    const existingIdx = this.tournamentSessions.findIndex((s) => s.id === id);
    if (existingIdx === -1) {
      this.tournamentSessions.push(newSession);
      this.notify();
    }

    await setDoc(doc(firestore, 'tournamentSessions', id), newSession);
    return newSession;
  }

  public async updateSessionName(sessionId: string, name: string): Promise<void> {
    const sess = this.tournamentSessions.find((s) => s.id === sessionId);
    if (sess) {
      sess.name = name;
      this.notify();
    }
    await updateDoc(doc(firestore, 'tournamentSessions', sessionId), { name }).catch(() => {});
  }

  public async deleteSession(sessionId: string): Promise<void> {
    this.tournamentSessions = this.tournamentSessions.filter((s) => s.id !== sessionId);
    this.notify();
    await deleteDoc(doc(firestore, 'tournamentSessions', sessionId)).catch(() => {});
  }

  public async saveSessionPlayerScore(
    sessionId: string,
    userId: string,
    points: number,
    performance: number
  ): Promise<void> {
    const sess = this.tournamentSessions.find((s) => s.id === sessionId);
    if (!sess) return;

    if (!sess.scores) sess.scores = [];
    const idx = sess.scores.findIndex((sc) => sc.userId === userId);
    if (idx >= 0) {
      sess.scores[idx] = { userId, points: Number(points) || 0, performance: Number(performance) || 0 };
    } else {
      sess.scores.push({ userId, points: Number(points) || 0, performance: Number(performance) || 0 });
    }

    this.notify();
    await setDoc(doc(firestore, 'tournamentSessions', sessionId), sess, { merge: true });
  }

  public async addPlayerToSession(sessionId: string, userId: string): Promise<void> {
    const sess = this.tournamentSessions.find((s) => s.id === sessionId);
    if (!sess) return;

    if (!sess.scores) sess.scores = [];
    if (!sess.scores.some((sc) => sc.userId === userId)) {
      sess.scores.push({ userId, points: 0, performance: 0 });
      this.notify();
      await setDoc(doc(firestore, 'tournamentSessions', sessionId), sess, { merge: true });
    }
  }

  public async removePlayerFromSession(sessionId: string, userId: string): Promise<void> {
    const sess = this.tournamentSessions.find((s) => s.id === sessionId);
    if (!sess) return;

    if (sess.scores) {
      sess.scores = sess.scores.filter((sc) => sc.userId !== userId);
    }
    this.notify();
    await setDoc(doc(firestore, 'tournamentSessions', sessionId), sess, { merge: true });
  }

  public async createGroup(tournamentId: string, groupName?: string, roundNumber: number = 1): Promise<TournamentGroup> {
    const roundGroups = this.tournamentGroups.filter(
      (g) => g.tournamentId === tournamentId && (g.roundNumber || 1) === roundNumber
    );
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const defaultName = groupName || `Group ${letters[roundGroups.length] || roundGroups.length + 1}`;
    const id = `${tournamentId}_grp_r${roundNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

    const newGroup: TournamentGroup = {
      id,
      tournamentId,
      groupName: defaultName,
      playerIds: [],
      roundNumber,
      manualRanks: {},
      playerStatuses: {},
    };

    const existingIdx = this.tournamentGroups.findIndex((g) => g.id === id);
    if (existingIdx === -1) {
      this.tournamentGroups.push(newGroup);
      this.notify();
    }

    await setDoc(doc(firestore, 'tournamentGroups', id), newGroup);
    return newGroup;
  }

  public async updateGroup(groupId: string, updates: Partial<TournamentGroup>): Promise<void> {
    const group = this.tournamentGroups.find((g) => g.id === groupId);
    if (group) {
      Object.assign(group, updates);
      this.notify();
    }
    await setDoc(doc(firestore, 'tournamentGroups', groupId), updates, { merge: true });
  }

  public async deleteGroup(groupId: string): Promise<void> {
    this.tournamentGroups = this.tournamentGroups.filter((g) => g.id !== groupId);
    this.notify();
    await deleteDoc(doc(firestore, 'tournamentGroups', groupId)).catch(() => {});
  }

  public async setFinalStandings(tournamentId: string, finalStandings: FinalStanding[]): Promise<void> {
    await this.updateTournament(tournamentId, { finalStandings });
  }

  public getRoundScores(tournamentId: string): PlayerRoundScore[] {
    return this.roundScores.filter((s) => s.tournamentId === tournamentId);
  }

  public async generateNextTournamentCode(): Promise<string> {
    const counterRef = doc(firestore, 'counters', 'tournaments');
    try {
      const nextCode = await runTransaction(firestore, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentSeq = 0;
        if (counterDoc.exists()) {
          const data = counterDoc.data();
          if (typeof data.lastCode === 'number') {
            currentSeq = data.lastCode;
          } else if (typeof data.lastCode === 'string') {
            currentSeq = parseInt(data.lastCode, 10) || 0;
          }
        }

        // If counter doc not initialized or lower than existing tournaments in memory, determine max
        if (currentSeq === 0) {
          const existingMax = this.tournaments.reduce((max, t) => {
            if (t.tournamentCode) {
              const num = parseInt(t.tournamentCode, 10);
              return !isNaN(num) && num > max ? num : max;
            }
            return max;
          }, 0);
          if (existingMax > currentSeq) {
            currentSeq = existingMax;
          }
        }

        const nextSeq = currentSeq + 1;
        if (nextSeq > 9999) {
          throw new Error('Tournament code range (0001-9999) exhausted.');
        }

        const formattedCode = nextSeq.toString().padStart(4, '0');
        transaction.set(counterRef, {
          lastCode: nextSeq,
          formattedCode,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        return formattedCode;
      });

      return nextCode;
    } catch (err) {
      console.warn('Transaction failed for tournamentCode counter, falling back to deterministic local allocation:', err);
      // Fallback: calculate strictly based on highest known tournamentCode
      const existingMax = this.tournaments.reduce((max, t) => {
        if (t.tournamentCode) {
          const num = parseInt(t.tournamentCode, 10);
          return !isNaN(num) && num > max ? num : max;
        }
        return max;
      }, 0);
      const nextSeq = existingMax + 1;
      if (nextSeq > 9999) {
        throw new Error('Tournament code range (0001-9999) exhausted.');
      }
      return nextSeq.toString().padStart(4, '0');
    }
  }

  public async createTournament(data: Omit<Tournament, 'id'>): Promise<Tournament> {
    const id = 'tour_' + Date.now();
    const format = data.format || 'elimination';
    const groupSize = data.groupSize || 4;
    const currentRound = data.currentRound || 1;
    const maxRounds = data.maxRounds || (format === 'points' ? 3 : 1);
    const currentStage = data.currentStage || 'registration';
    // Admin approval default: requires approval unless specified
    const isApproved = data.isApproved !== undefined ? data.isApproved : false;

    // Generate or use provided sequential 4-digit tournament code
    let tournamentCode = data.tournamentCode;
    if (!tournamentCode) {
      tournamentCode = await this.generateNextTournamentCode();
    }

    let safeImage = data.image;
    if (safeImage && safeImage.startsWith('data:image/')) {
      safeImage = await compressImage(safeImage, 800, 450, 0.7);
    }

    const newTournament: Tournament = {
      ...data,
      image: safeImage,
      id,
      tournamentCode,
      format,
      groupSize,
      currentRound,
      maxRounds,
      currentStage,
      isApproved,
      registrationFee: data.registrationFee || 'Free',
      telebirrNumber: data.telebirrNumber || '',
      telebirrAccountName: data.telebirrAccountName || data.telebirrName || '',
      telebirrName: data.telebirrName || data.telebirrAccountName || '',
      venueLocation: data.venueLocation || data.venueName || 'Addis Ababa',
    };

    const docRef = doc(firestore, 'tournaments', id);
    await setDoc(docRef, {
      name: data.tournamentName,
      game: data.game,
      image: safeImage,
      date: data.date,
      time: data.time,
      maxPlayers: data.maxPlayers,
      status: data.status,
      organizerId: data.organizerId,
      createdAt: new Date().toISOString(),
      id,
      tournamentCode,
      tournamentName: data.tournamentName,
      venueName: data.venueName || '',
      venueLocation: data.venueLocation || data.venueName || 'Addis Ababa',
      rules: data.rules || '',
      format,
      groupSize,
      currentRound,
      maxRounds,
      currentStage,
      isApproved,
      registrationFee: data.registrationFee || 'Free',
      award: data.award || data.prizePool || '',
      telebirrNumber: data.telebirrNumber || '',
      telebirrAccountName: data.telebirrAccountName || data.telebirrName || '',
      telebirrName: data.telebirrName || data.telebirrAccountName || '',
    });

    return newTournament;
  }

  public async updateTournament(id: string, updates: Partial<Tournament>): Promise<void> {
    const ref = doc(firestore, 'tournaments', id);
    const payload: Record<string, any> = { ...updates };
    if (updates.image && updates.image.startsWith('data:image/')) {
      payload.image = await compressImage(updates.image, 800, 450, 0.7);
    }
    if (updates.tournamentName) {
      payload.name = updates.tournamentName;
    }
    await updateDoc(ref, payload);
  }

  public async updateTournamentStatus(id: string, status: TournamentStatus): Promise<void> {
    await this.updateTournament(id, { status });
  }

  // =========================================================================
  // TOURNAMENT FORMAT ENGINE: GROUPS, ROUND-ROBIN, KNOCKOUT & POINTS
  // =========================================================================

  /**
   * Automatically forms groups of 4 players (or custom size) for a tournament.
   * For Elimination: Creates Round-Robin 1v1 matches for each group.
   * For Points: Sets up group stages for multi-round points tracking.
   */
  public async generateGroupsForTournament(
    tournamentId: string,
    groupSize: number = 4
  ): Promise<boolean> {
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament) return false;

    const registeredPlayers = this.getTournamentPlayers(tournamentId);
    if (registeredPlayers.length < 2) return false;

    // Shuffle players for fair seeding
    const playerIds = registeredPlayers.map((p) => p.userId);
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

    // Group allocation
    const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const groupsToSave: TournamentGroup[] = [];

    for (let i = 0; i < shuffled.length; i += groupSize) {
      const groupIdx = Math.floor(i / groupSize);
      const letter = groupLetters[groupIdx] || `G${groupIdx + 1}`;
      const groupPlayers = shuffled.slice(i, i + groupSize);
      const groupId = `${tournamentId}_group_${letter}`;

      groupsToSave.push({
        id: groupId,
        tournamentId,
        groupName: `Group ${letter}`,
        playerIds: groupPlayers,
        roundNumber: tournament.currentRound || 1,
      });
    }

    // Save groups in Firestore
    for (const grp of groupsToSave) {
      await setDoc(doc(firestore, 'tournamentGroups', grp.id), {
        tournamentId: grp.tournamentId,
        groupName: grp.groupName,
        playerIds: grp.playerIds,
        roundNumber: grp.roundNumber,
      });
    }

    // Update tournament stage
    await this.updateTournament(tournamentId, {
      status: 'Ongoing',
      currentStage: 'group',
      groupSize,
      currentRound: 1,
    });

    // TYPE 1: ELIMINATION ROUND-ROBIN MATCH GENERATION
    if (tournament.format === 'elimination' || !tournament.format) {
      for (const group of groupsToSave) {
        const pIds = group.playerIds;
        let stationIndex = 1;

        // Generate round robin 1v1 matches (every player plays every other player)
        for (let a = 0; a < pIds.length; a++) {
          for (let b = a + 1; b < pIds.length; b++) {
            await this.createMatch({
              tournamentId,
              round: `${group.groupName} Stage`,
              playerAId: pIds[a],
              playerBId: pIds[b],
              stationNumber: `Station 0${(stationIndex % 6) + 1}`,
              winnerId: null,
              score: '0 - 0',
              status: 'Waiting',
              groupId: group.id,
            });
            stationIndex++;
          }
        }
      }
    }

    return true;
  }

  /**
   * Computes group standings for a group in an Elimination tournament.
   * Standings table columns: Played (P), Wins (W), Draws (D), Losses (L), Goals For (GF), Goals Against (GA), Goal Difference (GD), Points (Pts).
   */
  public getGroupStandings(
    tournamentId: string,
    groupId: string
  ): {
    userId: string;
    user?: User;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    rank: number;
  }[] {
    const group = this.tournamentGroups.find((g) => g.id === groupId);
    if (!group) return [];

    const groupMatches = this.matches.filter(
      (m) => m.tournamentId === tournamentId && (m.groupId === groupId || m.round.includes(group.groupName))
    );

    const standingsMap: Record<
      string,
      {
        userId: string;
        user?: User;
        played: number;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
        goalDifference: number;
        points: number;
      }
    > = {};

    group.playerIds.forEach((pid) => {
      standingsMap[pid] = {
        userId: pid,
        user: this.getUserById(pid),
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
    });

    groupMatches.forEach((m) => {
      if (m.status === 'Finished' && m.playerAId && m.playerBId) {
        let scoreA = m.playerAScore ?? 0;
        let scoreB = m.playerBScore ?? 0;
        if (m.playerAScore === undefined || m.playerBScore === undefined) {
          const parts = (m.score || '').split('-').map((s) => parseInt(s.trim()));
          scoreA = isNaN(parts[0]) ? 0 : parts[0];
          scoreB = isNaN(parts[1]) ? 0 : parts[1];
        }

        const playerA = standingsMap[m.playerAId];
        const playerB = standingsMap[m.playerBId];

        const isDraw = m.isDraw || (m.winnerId === null && scoreA === scoreB);

        if (isDraw) {
          if (playerA) {
            playerA.played += 1;
            playerA.draws += 1;
            playerA.goalsFor += scoreA;
            playerA.goalsAgainst += scoreB;
            playerA.points += 1;
          }
          if (playerB) {
            playerB.played += 1;
            playerB.draws += 1;
            playerB.goalsFor += scoreB;
            playerB.goalsAgainst += scoreA;
            playerB.points += 1;
          }
        } else {
          const winnerId = m.winnerId || (scoreA > scoreB ? m.playerAId : m.playerBId);
          if (winnerId === m.playerAId) {
            if (playerA) {
              playerA.played += 1;
              playerA.wins += 1;
              playerA.goalsFor += scoreA;
              playerA.goalsAgainst += scoreB;
              playerA.points += 3;
            }
            if (playerB) {
              playerB.played += 1;
              playerB.losses += 1;
              playerB.goalsFor += scoreB;
              playerB.goalsAgainst += scoreA;
              playerB.points += 0;
            }
          } else if (winnerId === m.playerBId) {
            if (playerB) {
              playerB.played += 1;
              playerB.wins += 1;
              playerB.goalsFor += scoreB;
              playerB.goalsAgainst += scoreA;
              playerB.points += 3;
            }
            if (playerA) {
              playerA.played += 1;
              playerA.losses += 1;
              playerA.goalsFor += scoreA;
              playerA.goalsAgainst += scoreB;
              playerA.points += 0;
            }
          }
        }
      }
    });

    Object.values(standingsMap).forEach((st) => {
      st.goalDifference = st.goalsFor - st.goalsAgainst;
    });

    const sorted = Object.values(standingsMap).sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        b.wins - a.wins
    );
    return sorted.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }

  /**
   * Generates Knockout Stage bracket from organizer-selected qualified players.
   */
  public async generateKnockoutFromSelected(
    tournamentId: string,
    selectedPlayerIds: string[]
  ): Promise<boolean> {
    if (selectedPlayerIds.length < 2) return false;

    let roundName = 'Knockout Stage';
    if (selectedPlayerIds.length === 2) roundName = 'Finals';
    else if (selectedPlayerIds.length <= 4) roundName = 'Semifinals';
    else if (selectedPlayerIds.length <= 8) roundName = 'Quarterfinals';
    else roundName = 'Round of 16';

    let stationNum = 1;
    for (let i = 0; i < selectedPlayerIds.length; i += 2) {
      const playerA = selectedPlayerIds[i];
      const playerB = selectedPlayerIds[i + 1] || null;
      await this.createMatch({
        tournamentId,
        round: roundName,
        playerAId: playerA,
        playerBId: playerB,
        stationNumber: `Arena Station ${stationNum}`,
        winnerId: playerB === null ? playerA : null,
        score: playerB === null ? '1 - 0' : '0 - 0',
        status: playerB === null ? 'Finished' : 'Waiting',
      });
      stationNum++;
    }

    await this.updateTournament(tournamentId, {
      currentStage: 'knockout',
    });

    return true;
  }

  /**
   * Advances winner of a finished match to the next bracket position upon organizer confirmation.
   */
  public async advanceWinnerToNextRound(matchId: string): Promise<boolean> {
    const match = this.matches.find((m) => m.id === matchId);
    if (!match || !match.winnerId) return false;

    const currentRound = match.round || '';
    let nextRound = 'Finals';
    if (currentRound.includes('Round of 16')) nextRound = 'Quarterfinals';
    else if (currentRound.includes('Quarterfinals')) nextRound = 'Semifinals';
    else if (currentRound.includes('Semifinals')) nextRound = 'Finals';
    else if (currentRound.includes('Group')) nextRound = 'Knockout Stage';

    const existingMatches = this.matches.filter(
      (m) => m.tournamentId === match.tournamentId && m.round === nextRound
    );
    const availableMatch = existingMatches.find((m) => !m.playerAId || !m.playerBId);

    if (availableMatch) {
      if (!availableMatch.playerAId) {
        availableMatch.playerAId = match.winnerId;
      } else if (!availableMatch.playerBId && availableMatch.playerAId !== match.winnerId) {
        availableMatch.playerBId = match.winnerId;
      }
      this.notify();
      await updateDoc(doc(firestore, 'matches', availableMatch.id), {
        playerAId: availableMatch.playerAId,
        playerBId: availableMatch.playerBId,
      }).catch(() => {});
    } else {
      await this.createMatch({
        tournamentId: match.tournamentId,
        round: nextRound,
        playerAId: match.winnerId,
        playerBId: null,
        stationNumber: `Arena Station 01`,
        winnerId: null,
        score: '0 - 0',
        status: 'Waiting',
      });
    }

    return true;
  }

  /**
   * Generates Knockout Stage bracket for Elimination Tournaments (Top 2 from each group advance).
   */
  public async generateKnockoutStage(tournamentId: string): Promise<boolean> {
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament) return false;

    const groups = this.getTournamentGroups(tournamentId);
    if (groups.length === 0) return false;

    const qualifiedPlayerIds: string[] = [];
    groups.forEach((g) => {
      const standings = this.getGroupStandings(tournamentId, g.id);
      const top2 = standings.slice(0, 2).map((s) => s.userId);
      qualifiedPlayerIds.push(...top2);
    });

    return this.generateKnockoutFromSelected(tournamentId, qualifiedPlayerIds);
  }

  /**
   * For Points-Based Multi-Round Tournaments (PUBG, COD Mobile, Free Fire):
   * Records placement and kills for a player/team, computing Placement Points + (Kills * Kill Multiplier).
   */
  public async recordPlayerRoundStats(
    tournamentId: string,
    userId: string,
    roundNumber: number,
    placement: number,
    kills: number,
    lobbyName?: string
  ): Promise<void> {
    const tour = this.getTournamentById(tournamentId);
    const defaultConfig: Record<number, number> = { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 4, 7: 2, 8: 1 };
    const config = tour?.placementPointsConfig || defaultConfig;
    const placementPts = config[placement] ?? 0;
    const mult = tour?.killMultiplier ?? 1;
    const killPts = (kills || 0) * mult;
    const totalPts = placementPts + killPts;

    const docId = `${tournamentId}_r${roundNumber}_${userId}`;
    const scoreRef = doc(firestore, 'roundScores', docId);

    const data: PlayerRoundScore = {
      id: docId,
      tournamentId,
      userId,
      roundNumber,
      placement,
      kills,
      placementPoints: placementPts,
      killPoints: killPts,
      points: totalPts,
      lobbyName: lobbyName || `Lobby ${roundNumber}`,
    };

    const idx = this.roundScores.findIndex((s) => s.id === docId);
    if (idx >= 0) {
      this.roundScores[idx] = data;
    } else {
      this.roundScores.push(data);
    }
    this.notify();

    await setDoc(scoreRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * For Points-Based Multi-Round Tournaments:
   * Retrieves overall combined leaderboard ranked across all rounds.
   */
  public getOverallLeaderboard(tournamentId: string): {
    rank: number;
    userId: string;
    user?: User;
    totalKills: number;
    totalPlacementPoints: number;
    totalKillPoints: number;
    round1Points: number;
    round2Points: number;
    round3Points: number;
    totalPoints: number;
  }[] {
    const players = this.getTournamentPlayers(tournamentId);
    const scores = this.getRoundScores(tournamentId);

    const leaderboardMap: Record<
      string,
      {
        userId: string;
        user?: User;
        totalKills: number;
        totalPlacementPoints: number;
        totalKillPoints: number;
        round1Points: number;
        round2Points: number;
        round3Points: number;
        totalPoints: number;
      }
    > = {};

    players.forEach((p) => {
      leaderboardMap[p.userId] = {
        userId: p.userId,
        user: p.user || this.getUserById(p.userId),
        totalKills: 0,
        totalPlacementPoints: 0,
        totalKillPoints: 0,
        round1Points: 0,
        round2Points: 0,
        round3Points: 0,
        totalPoints: 0,
      };
    });

    scores.forEach((s) => {
      if (leaderboardMap[s.userId]) {
        leaderboardMap[s.userId].totalKills += s.kills || 0;
        leaderboardMap[s.userId].totalPlacementPoints += s.placementPoints || 0;
        leaderboardMap[s.userId].totalKillPoints += s.killPoints || 0;
        if (s.roundNumber === 1) leaderboardMap[s.userId].round1Points = s.points;
        if (s.roundNumber === 2) leaderboardMap[s.userId].round2Points = s.points;
        if (s.roundNumber === 3) leaderboardMap[s.userId].round3Points = s.points;
        leaderboardMap[s.userId].totalPoints += s.points;
      }
    });

    const sorted = Object.values(leaderboardMap).sort(
      (a, b) => b.totalPoints - a.totalPoints || b.totalKills - a.totalKills
    );
    return sorted.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }

  /**
   * Advances a Points-Based Tournament to the next round (Round 1 -> 2 -> 3 -> Champion).
   */
  public async advancePointsRound(tournamentId: string): Promise<void> {
    const tour = this.getTournamentById(tournamentId);
    if (!tour) return;

    const currentR = tour.currentRound || 1;
    const maxR = tour.maxRounds || 3;

    if (currentR < maxR) {
      await this.updateTournament(tournamentId, {
        currentRound: currentR + 1,
      });
    } else {
      // Completed all 3 rounds! Declare top overall score player as Champion!
      const leaderboard = this.getOverallLeaderboard(tournamentId);
      if (leaderboard.length > 0) {
        const winner = leaderboard[0];
        await this.updatePlayerStatus(tournamentId, winner.userId, 'Champion');
      }
      await this.updateTournament(tournamentId, {
        status: 'Completed',
        currentStage: 'completed',
      });
    }
  }

  // TABLE 3: TOURNAMENT PLAYERS
  public getTournamentPlayers(tournamentId: string): (TournamentPlayer & { user?: User })[] {
    return this.tournamentPlayers
      .filter((tp) => tp.tournamentId === tournamentId)
      .map((tp) => ({
        ...tp,
        user: this.getUserById(tp.userId),
      }));
  }

  public getConfirmedTournamentPlayers(tournamentId: string): (TournamentPlayer & { user?: User })[] {
    return this.getTournamentPlayers(tournamentId).filter(
      (tp) => tp.paymentStatus === 'CONFIRMED'
    );
  }

  public getPendingTournamentPlayers(tournamentId: string): (TournamentPlayer & { user?: User })[] {
    return this.getTournamentPlayers(tournamentId).filter(
      (tp) => tp.paymentStatus === 'PENDING_APPROVAL'
    );
  }

  public isPlayerRegistered(tournamentId: string, userId: string): boolean {
    return this.tournamentPlayers.some(
      (tp) => tp.tournamentId === tournamentId && tp.userId === userId
    );
  }

  public async registerPlayer(tournamentId: string, userId: string): Promise<boolean> {
    if (this.isPlayerRegistered(tournamentId, userId)) return false;

    const tournament = this.getTournamentById(tournamentId);
    if (!tournament) return false;

    const confirmedPlayers = this.getConfirmedTournamentPlayers(tournamentId);
    if (confirmedPlayers.length >= tournament.maxPlayers) {
      return false;
    }

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const docId = `${tournamentId}_${userId}`;
    const playerRef = doc(firestore, 'tournamentPlayers', docId);

    await setDoc(playerRef, {
      tournamentId,
      userId,
      status: 'Registered',
      joinedAt: formattedDate,
      registrationDate: formattedDate,
      playerStatus: 'Registered',
      paymentStatus: 'CONFIRMED',
      seed: this.getTournamentPlayers(tournamentId).length + 1,
    });

    return true;
  }

  public async startTournamentAuto(tournamentId: string): Promise<{ success: boolean; message: string }> {
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament) return { success: false, message: 'Tournament not found.' };

    const confirmedPlayers = this.getConfirmedTournamentPlayers(tournamentId);

    if (confirmedPlayers.length < 2) {
      return {
        success: false,
        message: `Cannot start tournament. Need at least 2 confirmed players (currently ${confirmedPlayers.length} confirmed).`,
      };
    }

    // Shuffle confirmed players for random seeding
    const playerIds = confirmedPlayers.map((p) => p.userId).sort(() => Math.random() - 0.5);

    // Clear old matches for this tournament
    const oldMatches = this.matches.filter((m) => m.tournamentId === tournamentId);
    for (const om of oldMatches) {
      await deleteDoc(doc(firestore, 'matches', om.id)).catch(() => {});
    }
    this.matches = this.matches.filter((m) => m.tournamentId !== tournamentId);

    let createdMatchesCount = 0;
    const groupsToSave: TournamentGroup[] = [];

    if (tournament.format === 'points') {
      // Form Groups of 4 or 2 automatically
      const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const groupSize = tournament.groupSize || 4;

      for (let i = 0; i < playerIds.length; i += groupSize) {
        const groupIdx = Math.floor(i / groupSize);
        const letter = groupLetters[groupIdx] || `G${groupIdx + 1}`;
        const groupPlayers = playerIds.slice(i, i + groupSize);
        const groupId = `${tournamentId}_group_${letter}`;

        groupsToSave.push({
          id: groupId,
          tournamentId,
          groupName: `Group ${letter}`,
          playerIds: groupPlayers,
          roundNumber: 1,
        });
      }

      for (const grp of groupsToSave) {
        await setDoc(doc(firestore, 'tournamentGroups', grp.id), {
          tournamentId: grp.tournamentId,
          groupName: grp.groupName,
          playerIds: grp.playerIds,
          roundNumber: grp.roundNumber,
        });

        // GENERATE MATCHES FOR EACH GROUP (Pair players inside the group)
        const pList = grp.playerIds;
        let matchNumInGroup = 1;
        for (let a = 0; a < pList.length; a++) {
          for (let b = a + 1; b < pList.length; b++) {
            await this.createMatch({
              tournamentId,
              round: `${grp.groupName} - Match ${matchNumInGroup}`,
              playerAId: pList[a],
              playerBId: pList[b],
              stationNumber: `Station ${String(createdMatchesCount + 1).padStart(2, '0')}`,
              winnerId: null,
              score: '0 - 0',
              status: createdMatchesCount === 0 ? 'Playing' : 'Waiting',
            });
            createdMatchesCount++;
            matchNumInGroup++;
          }
        }
      }

      await this.updateTournament(tournamentId, {
        status: 'Ongoing',
        currentStage: 'points_round_1',
        currentRound: 1,
      });

      // Send Push Notifications to confirmed players
      for (const p of confirmedPlayers) {
        this.addNotification({
          userId: p.userId,
          title: '🚀 Tournament LIVE!',
          message: `The ${tournament.tournamentName} tournament is now live! Check your group matches and station assignments.`,
          type: 'tournament',
        });
      }

      this.notify();
      return {
        success: true,
        message: `Tournament started! Formed ${groupsToSave.length} groups and created ${createdMatchesCount} group matches across stations.`,
      };
    }

    // Single Elimination / Knockout Format
    let roundName = 'Round 1';
    if (confirmedPlayers.length === 4) roundName = 'Semifinals';
    else if (confirmedPlayers.length === 8) roundName = 'Quarterfinals';
    else if (confirmedPlayers.length === 16) roundName = 'Round of 16';

    let matchIdx = 1;
    for (let i = 0; i < playerIds.length; i += 2) {
      const pA = playerIds[i];
      const pB = playerIds[i + 1];
      if (pA && pB) {
        await this.createMatch({
          tournamentId,
          round: roundName,
          playerAId: pA,
          playerBId: pB,
          stationNumber: `Station ${String(matchIdx).padStart(2, '0')}`,
          winnerId: null,
          score: '0 - 0',
          status: matchIdx === 1 ? 'Playing' : 'Waiting',
        });
        matchIdx++;
        createdMatchesCount++;
      }
    }

    await this.updateTournament(tournamentId, {
      status: 'Ongoing',
      currentStage: roundName,
      currentRound: 1,
    });

    // Send Notifications
    for (const p of confirmedPlayers) {
      this.addNotification({
        userId: p.userId,
        title: '⚔️ Tournament Bracket Live!',
        message: `The ${tournament.tournamentName} ${roundName} bracket is now LIVE! Check your assigned station.`,
        type: 'tournament',
      });
    }

    this.notify();
    return {
      success: true,
      message: `Tournament started! Created ${createdMatchesCount} ${roundName} bracket matches across stations.`,
    };
  }

  public async unregisterPlayer(tournamentId: string, userId: string): Promise<void> {
    const docId = `${tournamentId}_${userId}`;
    await deleteDoc(doc(firestore, 'tournamentPlayers', docId));
  }

  // TABLE 4: MATCHES
  public getAllMatches(): (Match & { playerA?: User; playerB?: User; winner?: User; tournament?: Tournament })[] {
    return this.matches.map((m) => ({
      ...m,
      playerA: m.playerAId ? this.getUserById(m.playerAId) : undefined,
      playerB: m.playerBId ? this.getUserById(m.playerBId) : undefined,
      winner: m.winnerId ? this.getUserById(m.winnerId) : undefined,
      tournament: this.getTournamentById(m.tournamentId),
    }));
  }

  public getMatches(
    tournamentId: string
  ): (Match & { playerA?: User; playerB?: User; winner?: User })[] {
    return this.matches
      .filter((m) => m.tournamentId === tournamentId)
      .map((m) => ({
        ...m,
        playerA: m.playerAId ? this.getUserById(m.playerAId) : undefined,
        playerB: m.playerBId ? this.getUserById(m.playerBId) : undefined,
        winner: m.winnerId ? this.getUserById(m.winnerId) : undefined,
      }));
  }

  public async deleteMatch(matchId: string): Promise<void> {
    this.matches = this.matches.filter((m) => m.id !== matchId);
    this.notify();
    await deleteDoc(doc(firestore, 'matches', matchId)).catch(() => {});
  }

  public async resetTournamentMatches(tournamentId: string): Promise<void> {
    const tourMatches = this.matches.filter((m) => m.tournamentId === tournamentId);
    this.matches = this.matches.filter((m) => m.tournamentId !== tournamentId);
    this.notify();
    for (const m of tourMatches) {
      await deleteDoc(doc(firestore, 'matches', m.id)).catch(() => {});
    }
    const groups = this.tournamentGroups.filter((g) => g.tournamentId === tournamentId);
    this.tournamentGroups = this.tournamentGroups.filter((g) => g.tournamentId !== tournamentId);
    for (const g of groups) {
      await deleteDoc(doc(firestore, 'tournamentGroups', g.id)).catch(() => {});
    }
  }

  public async createMatch(data: Omit<Match, 'id'>): Promise<Match> {
    const id = 'match_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newMatch: Match = {
      ...data,
      id,
    };

    const existingIdx = this.matches.findIndex((m) => m.id === id);
    if (existingIdx === -1) {
      this.matches.push(newMatch);
      this.notify();
    }

    const matchRef = doc(firestore, 'matches', id);
    await setDoc(matchRef, {
      tournamentId: data.tournamentId,
      round: data.round,
      playerA: data.playerAId,
      playerB: data.playerBId,
      station: data.stationNumber,
      winner: data.winnerId,
      score: data.score,
      status: data.status,
      id,
      playerAId: data.playerAId,
      playerBId: data.playerBId,
      stationNumber: data.stationNumber,
      winnerId: data.winnerId,
    });

    return newMatch;
  }

  public sendPushNotification(
    target: { tournamentId?: string; userId?: string; global?: boolean },
    title: string,
    message: string,
    type: 'announcement' | 'match_call' | 'tournament' | 'system' = 'announcement'
  ): number {
    let recipientUserIds: string[] = [];

    if (target.userId) {
      recipientUserIds = [target.userId];
    } else if (target.tournamentId) {
      const players = this.getTournamentPlayers(target.tournamentId);
      recipientUserIds = players.map((p) => p.userId);
    } else if (target.global) {
      recipientUserIds = this.users.map((u) => u.id);
    }

    if (recipientUserIds.length === 0) return 0;

    // Deduplicate recipient IDs
    const uniqueIds = Array.from(new Set(recipientUserIds));

    uniqueIds.forEach((uid) => {
      this.addNotification({
        userId: uid,
        title,
        message,
        type,
      });
    });

    return uniqueIds.length;
  }

  public async addManualPlayerToTournament(
    tournamentId: string,
    name: string,
    gamertag: string,
    teamName?: string,
    profileImage?: string
  ): Promise<boolean> {
    const newUserId = 'user_custom_' + Date.now();
    let safePhoto = profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    if (safePhoto && safePhoto.startsWith('data:image/')) {
      safePhoto = await compressImage(safePhoto, 300, 300, 0.7);
    }

    const newUser: User = {
      id: newUserId,
      name: name || 'Guest Competitor',
      username: (gamertag || name).toLowerCase().replace(/\s+/g, '_'),
      profileImage: safePhoto,
      telegramUserId: 'tg_guest_' + Date.now(),
      role: 'PLAYER',
      gamertag: gamertag || name,
      teamName: teamName || '',
    };

    await this.updateUser(newUser);
    return await this.registerPlayer(tournamentId, newUserId);
  }

  public async updateMatch(id: string, updates: Partial<Match>): Promise<void> {
    const ref = doc(firestore, 'matches', id);
    const payload: Record<string, any> = { ...updates };
    if (updates.playerAId !== undefined) payload.playerA = updates.playerAId;
    if (updates.playerBId !== undefined) payload.playerB = updates.playerBId;
    if (updates.stationNumber !== undefined) payload.station = updates.stationNumber;
    if (updates.winnerId !== undefined) payload.winner = updates.winnerId;

    await updateDoc(ref, payload);
  }

  public async enterMatchResult(
    id: string,
    winnerId: string | null,
    score: string,
    status: MatchStatus = 'Finished'
  ): Promise<void> {
    await this.updateMatch(id, {
      winnerId,
      score,
      status,
    });

    const match = this.matches.find((m) => m.id === id);
    if (!match || !winnerId || status !== 'Finished') return;

    const loserId = match.playerAId === winnerId ? match.playerBId : match.playerAId;
    if (loserId) {
      await this.updatePlayerStatus(match.tournamentId, loserId, 'Eliminated');
    }

    // Check if all matches in this round are finished
    const roundMatches = this.matches.filter(
      (m) => m.tournamentId === match.tournamentId && m.round === match.round
    );

    const allRoundFinished = roundMatches.every(
      (m) => (m.id === id ? status === 'Finished' : m.status === 'Finished')
    );

    if (allRoundFinished) {
      // Collect winners from this round in order
      const roundWinners: string[] = [];
      roundMatches.forEach((m) => {
        const w = m.id === id ? winnerId : m.winnerId;
        if (w && !roundWinners.includes(w)) {
          roundWinners.push(w);
        }
      });

      if (roundWinners.length === 1) {
        // Tournament Champion!
        await this.updatePlayerStatus(match.tournamentId, roundWinners[0], 'Champion');
        await this.updateTournamentStatus(match.tournamentId, 'Completed');
        await this.updateTournament(match.tournamentId, { currentStage: 'completed' });
      } else if (roundWinners.length >= 2) {
        // Determine next round name
        let nextRoundName = 'Next Round';
        if (roundWinners.length === 2) nextRoundName = 'Finals';
        else if (roundWinners.length <= 4) nextRoundName = 'Semifinals';
        else if (roundWinners.length <= 8) nextRoundName = 'Quarterfinals';
        else nextRoundName = `Round of ${roundWinners.length}`;

        // Create next round matches automatically
        let matchIdx = 1;
        for (let i = 0; i < roundWinners.length; i += 2) {
          const pA = roundWinners[i];
          const pB = roundWinners[i + 1];
          if (pA) {
            await this.createMatch({
              tournamentId: match.tournamentId,
              round: nextRoundName,
              playerAId: pA,
              playerBId: pB || null,
              stationNumber: `Station ${String(matchIdx).padStart(2, '0')}`,
              winnerId: pB ? null : pA,
              score: pB ? '0 - 0' : '1 - 0 (Bye)',
              status: pB ? (matchIdx === 1 ? 'Playing' : 'Waiting') : 'Finished',
            });
            matchIdx++;
          }
        }

        await this.updateTournament(match.tournamentId, {
          currentStage: nextRoundName,
        });
      }
    }
  }

  // =========================================================================
  // NOTIFICATIONS SYSTEM
  // =========================================================================
  private notifications: AppNotification[] = [
    {
      id: 'notif_1',
      userId: 'user_tg_77201948',
      title: 'Welcome to Awedadari!',
      message: 'Explore upcoming gaming tournaments, join brackets, and compete for top ranks.',
      type: 'system',
      createdAt: new Date().toISOString(),
      read: false,
    },
    {
      id: 'notif_2',
      userId: 'user_tg_88492019',
      title: 'Organizer Hub Ready',
      message: 'Create and publish your esports tournaments. Admin approval keeps events high quality.',
      type: 'system',
      createdAt: new Date().toISOString(),
      read: true,
    },
  ];

  public getNotifications(userId: string): AppNotification[] {
    return this.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getNotificationsForUser(userId: string): AppNotification[] {
    return this.getNotifications(userId);
  }

  public getUserTournaments(userId: string): Tournament[] {
    const userPlayers = this.tournamentPlayers.filter((tp) => tp.userId === userId);
    return userPlayers
      .map((tp) => this.getTournamentById(tp.tournamentId))
      .filter(Boolean) as Tournament[];
  }

  public getTournamentPlayersForUser(userId: string): TournamentPlayer[] {
    return this.tournamentPlayers.filter((tp) => tp.userId === userId);
  }

  public getUnreadNotificationCount(userId: string): number {
    return this.notifications.filter((n) => n.userId === userId && !n.read).length;
  }

  public addNotification(
    notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
  ): AppNotification {
    const newNotif: AppNotification = {
      ...notif,
      id: 'notif_' + Date.now() + Math.random().toString(36).substr(2, 4),
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.notifications.unshift(newNotif);
    this.notify();
    return newNotif;
  }

  public markNotificationRead(id: string): void {
    const n = this.notifications.find((item) => item.id === id);
    if (n) {
      n.read = true;
      this.notify();
    }
  }

  public markNotificationAsRead(id: string): void {
    this.markNotificationRead(id);
  }

  // =========================================================================
  // GALLERY POSTS (LAST EVENT HIGHLIGHTS)
  // =========================================================================
  private galleryPosts: GalleryPost[] = [
    {
      id: 'gal_1',
      tournamentId: 'tour_5',
      tournamentName: 'Weekend eFootball Sprint #12',
      imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
      caption: 'Grand Final match moment at Nexus Gaming Arena! Sofia Martinez taking home 1st place 🏆',
      likes: 42,
      postedAt: '2026-07-26',
      organizerName: 'Marcus Vane',
    },
    {
      id: 'gal_2',
      tournamentId: 'tour_4',
      tournamentName: 'Iron Fist Tekken 8 Showdown',
      imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
      caption: 'Hyped crowd during the Tekken 8 losers bracket comeback match! Unforgettable atmosphere.',
      likes: 29,
      postedAt: '2026-07-25',
      organizerName: 'Marcus Vane',
    },
    {
      id: 'gal_3',
      tournamentId: 'tour_3',
      tournamentName: 'PUBG Mobile Battle Royale Showdown',
      imageUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80',
      caption: 'Full house at Station 1-6 for the PUBG Squad finals setup. Big congrats to all participants!',
      likes: 35,
      postedAt: '2026-07-20',
      organizerName: 'Nexus Gaming Center',
    },
  ];

  public getGalleryPosts(): GalleryPost[] {
    return [...this.galleryPosts].sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    );
  }

  public addGalleryPost(post: Omit<GalleryPost, 'id' | 'likes' | 'postedAt'>): GalleryPost {
    const newPost: GalleryPost = {
      ...post,
      id: 'gal_' + Date.now(),
      likes: 0,
      postedAt: new Date().toISOString().split('T')[0],
    };
    this.galleryPosts.unshift(newPost);
    this.notify();
    return newPost;
  }

  public likeGalleryPost(id: string): void {
    const post = this.galleryPosts.find((p) => p.id === id);
    if (post) {
      post.likes += 1;
      this.notify();
    }
  }

  // =========================================================================
  // CHECK-IN CODE MANAGEMENT
  // =========================================================================
  public async checkInPlayerByCode(
    tournamentId: string,
    checkInCode: string
  ): Promise<{ success: boolean; message: string; player?: User }> {
    const cleanCode = checkInCode.trim().toUpperCase();
    const tpList = this.getTournamentPlayers(tournamentId);

    const matchedTp = tpList.find(
      (tp) => tp.checkInCode?.toUpperCase() === cleanCode || tp.userId.endsWith(cleanCode)
    );

    if (!matchedTp) {
      return {
        success: false,
        message: `No player found with check-in code "${cleanCode}" for this tournament.`,
      };
    }

    await this.updatePlayerStatus(tournamentId, matchedTp.userId, 'Checked In');
    const user = this.getUserById(matchedTp.userId);

    return {
      success: true,
      message: `${user ? user.name : 'Player'} successfully checked in!`,
      player: user,
    };
  }

  // =========================================================================
  // GAME-SPECIFIC COMPETITIVE PLAYER RATING & LEADERBOARD ENGINE
  // =========================================================================

  public static normalizeGameKey(gameName?: string): string {
    if (!gameName) return 'efootball';
    return gameName.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  public static getGameDisplayInfo(gameName?: string): { key: string; name: string; icon: string } {
    const key = DatabaseService.normalizeGameKey(gameName);
    const lower = key.toLowerCase();
    let icon = '🎮';
    if (
      lower.includes('efootball') ||
      lower.includes('pes') ||
      lower.includes('fifa') ||
      lower.includes('fc 2') ||
      lower.includes('ea sports') ||
      lower.includes('soccer')
    ) {
      icon = '⚽';
    } else if (
      lower.includes('pubg') ||
      lower.includes('cod') ||
      lower.includes('call of duty') ||
      lower.includes('free fire') ||
      lower.includes('battle royale')
    ) {
      icon = '🎯';
    } else if (
      lower.includes('tekken') ||
      lower.includes('mortal kombat') ||
      lower.includes('street fighter') ||
      lower.includes('smash') ||
      lower.includes('fighter')
    ) {
      icon = '🥊';
    } else if (lower.includes('chess') || lower.includes('checkers')) {
      icon = '♟️';
    } else if (
      lower.includes('asphalt') ||
      lower.includes('need for speed') ||
      lower.includes('racing') ||
      lower.includes('f1')
    ) {
      icon = '🏎️';
    } else if (lower.includes('nba') || lower.includes('basketball')) {
      icon = '🏀';
    }
    return { key, name: gameName?.trim() || 'Custom Game', icon };
  }

  public getBasePlacementPoints(rank: number): number {
    if (rank <= 0 || !Number.isFinite(rank)) return 0;
    const r = Math.round(rank);
    const baseMap: Record<number, number> = {
      1: 15,
      2: 10,
      3: 8,
      4: 6,
      5: 4,
      6: 2,
      7: 1,
      8: 1,
    };
    if (baseMap[r] !== undefined) return baseMap[r];
    // Controlled diminishing table for positions 9+
    if (r >= 9 && r <= 16) return 0.5;
    if (r >= 17 && r <= 32) return 0.25;
    return 0.1;
  }

  public calculateTournamentSizeMultiplier(participantCount: number): number {
    const count = Math.max(2, participantCount || 2);
    // Doubling-style scaling: 8 players -> 0.5, 16 players -> 1.0, 32 players -> 2.0, 64 players -> 4.0 (2x of 32)
    const raw = count / 16;
    return Math.max(0.25, Math.min(8.0, Number(raw.toFixed(4))));
  }

  public calculateTournamentStrengthMultiplier(preTournamentRatings: number[]): number {
    if (!preTournamentRatings || preTournamentRatings.length === 0) return 1.0;
    const validRatings = preTournamentRatings.map((r) => (Number.isFinite(r) && r > 0 ? r : 1000));
    const sum = validRatings.reduce((a, b) => a + b, 0);
    const avg = sum / validRatings.length;
    const raw = avg / 1000;
    // Clamped safely between 0.6 (weak/novice field) and 1.8 (elite/grandmaster field)
    return Math.max(0.6, Math.min(1.8, Number(raw.toFixed(4))));
  }

  public calculateRatingDelta(
    basePoints: number,
    sizeMultiplier: number,
    strengthMultiplier: number,
    previousRating: number
  ): number {
    const earnedReward = basePoints * sizeMultiplier * strengthMultiplier;
    // Soft-cap resistance for high ratings to prevent runaway inflation while allowing beginners to climb
    const prev = Number.isFinite(previousRating) && previousRating > 0 ? previousRating : 1000;
    const resistanceFactor = Math.max(0.25, 1 - Math.max(0, prev - 1000) / 4000);
    const delta = earnedReward * resistanceFactor;
    return Math.max(0, Number(delta.toFixed(2)));
  }

  public getAvailableGames(): GameCategoryInfo[] {
    const gameMap = new Map<
      string,
      {
        key: string;
        name: string;
        icon: string;
        completedTournamentsCount: number;
        totalTournamentsCount: number;
      }
    >();

    // Seed recognized common esports games so player can always filter even before completed events
    const defaults = [
      { name: 'eFootball', icon: '⚽' },
      { name: 'PUBG Mobile', icon: '🎯' },
      { name: 'EA SPORTS FC 26', icon: '⚽' },
      { name: 'Tekken 8', icon: '🥊' },
      { name: 'Free Fire', icon: '🎯' },
      { name: 'Call of Duty Mobile', icon: '🎯' },
      { name: 'Chess', icon: '♟️' },
      { name: 'Asphalt', icon: '🏎️' },
    ];

    for (const d of defaults) {
      const info = DatabaseService.getGameDisplayInfo(d.name);
      gameMap.set(info.key, {
        key: info.key,
        name: d.name,
        icon: d.icon,
        completedTournamentsCount: 0,
        totalTournamentsCount: 0,
      });
    }

    // Inspect all tournaments in the database
    for (const t of this.tournaments) {
      if (!t.game) continue;
      const info = DatabaseService.getGameDisplayInfo(t.game);
      const isCompleted =
        (t.status === 'Completed' || t.status === 'Finished') &&
        t.finalStandings &&
        t.finalStandings.length > 0;

      const existing = gameMap.get(info.key);
      if (existing) {
        existing.totalTournamentsCount += 1;
        if (isCompleted) existing.completedTournamentsCount += 1;
      } else {
        gameMap.set(info.key, {
          key: info.key,
          name: t.game.trim(),
          icon: info.icon,
          completedTournamentsCount: isCompleted ? 1 : 0,
          totalTournamentsCount: 1,
        });
      }
    }

    // Sort games: most completed tournaments first, then total tournaments, then alphabetical
    return Array.from(gameMap.values()).sort((a, b) => {
      if (b.completedTournamentsCount !== a.completedTournamentsCount) {
        return b.completedTournamentsCount - a.completedTournamentsCount;
      }
      if (b.totalTournamentsCount !== a.totalTournamentsCount) {
        return b.totalTournamentsCount - a.totalTournamentsCount;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Centralized Chronological Rating Replay Engine
   * Computes per-game ratings and career stats deterministically.
   */
  public calculateAllGameRankings(): Map<
    string,
    Map<
      string,
      {
        rating: number;
        stats: PlayerGameStats;
      }
    >
  > {
    const gameRankings = new Map<
      string,
      Map<
        string,
        {
          rating: number;
          stats: PlayerGameStats;
        }
      >
    >();

    // 1. Gather all official completed tournaments with valid finalStandings
    const completedTournaments = this.tournaments.filter(
      (t) =>
        (t.status === 'Completed' || t.status === 'Finished') &&
        t.finalStandings &&
        Array.isArray(t.finalStandings) &&
        t.finalStandings.length > 0 &&
        !!t.game
    );

    // 2. Sort chronologically using tournament date & time (with ID stable secondary fallback)
    completedTournaments.sort((a, b) => {
      const timeStrA = `${a.date || '2026-01-01'} ${a.time || '00:00'}`;
      const timeStrB = `${b.date || '2026-01-01'} ${b.time || '00:00'}`;
      const timeA = new Date(timeStrA).getTime() || 0;
      const timeB = new Date(timeStrB).getTime() || 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.id || '').localeCompare(b.id || '');
    });

    // 3. Process each tournament chronologically by game
    for (const t of completedTournaments) {
      const gameInfo = DatabaseService.getGameDisplayInfo(t.game);
      const gameKey = gameInfo.key;

      if (!gameRankings.has(gameKey)) {
        gameRankings.set(gameKey, new Map());
      }
      const playerMap = gameRankings.get(gameKey)!;

      // Identify all participating players in this tournament
      // PARTICIPATION CRITERIA:
      // 1. Appears in authoritative FINAL RESULTS
      // OR
      // 2. Explicitly checked-in / participated in the tournament (NOT merely registered)
      const finalStandingUserIds = (t.finalStandings || [])
        .map((s) => s.userId)
        .filter((id) => typeof id === 'string' && id.trim().length > 0);

      const checkedInUserIds = this.tournamentPlayers
        .filter((tp) => {
          if (tp.tournamentId !== t.id || !tp.userId) return false;
          const status = ((tp.playerStatus || (tp as any).status || '') + '').toLowerCase().trim();
          const isCheckedIn =
            (tp as any).isCheckedIn === true ||
            status === 'checked in' ||
            status === 'playing' ||
            status === 'eliminated' ||
            status === 'champion' ||
            status === 'runner-up' ||
            status === 'semi-finalist';
          return isCheckedIn;
        })
        .map((tp) => tp.userId);

      const activeMatchPlayerIds = this.matches
        .filter((m) => m.tournamentId === t.id)
        .flatMap((m) => [m.playerAId, m.playerBId])
        .filter((id): id is string => Boolean(id && typeof id === 'string' && id.trim().length > 0));

      const activeGroupPlayerIds = this.tournamentGroups
        .filter((g) => g.tournamentId === t.id)
        .flatMap((g) => g.playerIds || [])
        .filter((id): id is string => Boolean(id && typeof id === 'string' && id.trim().length > 0));

      const activeSessionPlayerIds = this.tournamentSessions
        .filter((s) => s.tournamentId === t.id)
        .flatMap((s) => (s.scores || []).map((sc) => sc.userId))
        .filter((id): id is string => Boolean(id && typeof id === 'string' && id.trim().length > 0));

      const activeScorePlayerIds = this.roundScores
        .filter((rs) => rs.tournamentId === t.id)
        .map((rs) => rs.userId)
        .filter((id): id is string => Boolean(id && typeof id === 'string' && id.trim().length > 0));

      const allParticipantIds = Array.from(
        new Set([
          ...finalStandingUserIds,
          ...checkedInUserIds,
          ...activeMatchPlayerIds,
          ...activeGroupPlayerIds,
          ...activeSessionPlayerIds,
          ...activeScorePlayerIds,
        ])
      );
      const participantCount = Math.max(allParticipantIds.length, finalStandingUserIds.length, 2);

      // Pre-tournament ratings for participant field
      const preRatings = allParticipantIds.map((uid) => {
        const record = playerMap.get(uid);
        return record ? record.rating : 1000;
      });

      const sizeMult = this.calculateTournamentSizeMultiplier(participantCount);
      const strengthMult = this.calculateTournamentStrengthMultiplier(preRatings);

      // Process official placement rewards from finalStandings
      for (let idx = 0; idx < t.finalStandings!.length; idx++) {
        const standing = t.finalStandings![idx];
        const userId = standing.userId;
        if (!userId || typeof userId !== 'string') continue;

        // Resolve explicit rank
        let rank = standing.rank;
        if (!rank || !Number.isFinite(rank) || rank <= 0) {
          const badgeUpper = (standing.badge || '').toUpperCase();
          if (badgeUpper.includes('CHAMPION') || badgeUpper.includes('1ST') || badgeUpper.includes('GOLD')) {
            rank = 1;
          } else if (badgeUpper.includes('RUNNER') || badgeUpper.includes('2ND') || badgeUpper.includes('SILVER')) {
            rank = 2;
          } else if (badgeUpper.includes('THIRD') || badgeUpper.includes('3RD') || badgeUpper.includes('BRONZE')) {
            rank = 3;
          } else {
            rank = idx + 1;
          }
        }
        rank = Math.round(rank);

        // Get or initialize player record in this game
        let playerRecord = playerMap.get(userId);
        if (!playerRecord) {
          playerRecord = {
            rating: 1000,
            stats: {
              gameKey,
              gameName: gameInfo.name,
              rating: 1000,
              tournamentsPlayed: 0,
              wins: 0,
              runnerUps: 0,
              thirdPlaces: 0,
              podiums: 0,
              top8: 0,
              bestFinishRank: null,
              bestFinishLabel: 'N/A',
              averageFinish: 'N/A',
              earnedPointsTotal: 0,
              ranksList: [],
            },
          };
          playerMap.set(userId, playerRecord);
        }

        const preRating = playerRecord.rating;
        const basePlacementPts = this.getBasePlacementPoints(rank);
        const ratingDelta = this.calculateRatingDelta(
          basePlacementPts,
          sizeMult,
          strengthMult,
          preRating
        );

        // Update competitive rating
        const newRating = Math.round(preRating + ratingDelta);
        playerRecord.rating = newRating;

        // Update game statistics
        const stats = playerRecord.stats;
        stats.rating = newRating;
        stats.tournamentsPlayed += 1;
        stats.earnedPointsTotal += Number((basePlacementPts * sizeMult * strengthMult).toFixed(2));
        stats.ranksList.push(rank);

        if (rank === 1) stats.wins += 1;
        if (rank === 2) stats.runnerUps += 1;
        if (rank === 3) stats.thirdPlaces += 1;
        if (rank <= 3) stats.podiums += 1;
        if (rank <= 8) stats.top8 += 1;

        if (stats.ranksList.length > 0) {
          stats.bestFinishRank = Math.min(...stats.ranksList);
          stats.bestFinishLabel = `#${stats.bestFinishRank}`;
          const avg = stats.ranksList.reduce((sum, v) => sum + v, 0) / stats.ranksList.length;
          stats.averageFinish = avg.toFixed(1);
        }
      }
    }

    return gameRankings;
  }

  public getRankedPlayersForGame(gameKey?: string): RankedPlayerGameProfile[] {
    const availableGames = this.getAvailableGames();
    let targetKey = gameKey ? DatabaseService.normalizeGameKey(gameKey) : '';

    if (!targetKey || targetKey === 'all') {
      // Default to the most active completed game or first available game
      const topActiveGame = availableGames.find((g) => g.completedTournamentsCount > 0);
      targetKey = topActiveGame ? topActiveGame.key : availableGames[0]?.key || 'efootball';
    }

    const targetGameInfo =
      availableGames.find((g) => g.key === targetKey) || DatabaseService.getGameDisplayInfo(targetKey);

    const allRankings = this.calculateAllGameRankings();
    const gamePlayerMap = allRankings.get(targetKey) || new Map();

    const playerUsers = this.users.filter((u) => u.role === 'PLAYER');

    const ranked: RankedPlayerGameProfile[] = playerUsers.map((user) => {
      const record = gamePlayerMap.get(user.id);
      const stats: PlayerGameStats = record
        ? { ...record.stats }
        : {
            gameKey: targetKey,
            gameName: targetGameInfo.name,
            rating: 1000,
            tournamentsPlayed: 0,
            wins: 0,
            runnerUps: 0,
            thirdPlaces: 0,
            podiums: 0,
            top8: 0,
            bestFinishRank: null,
            bestFinishLabel: 'N/A',
            averageFinish: 'N/A',
            earnedPointsTotal: 0,
            ranksList: [],
          };

      return {
        user,
        globalRank: 0,
        gameKey: targetKey,
        gameName: targetGameInfo.name,
        stats,
        rankPoints: stats.rating,
        eventsPlayed: stats.tournamentsPlayed,
        wins: stats.wins,
        top3: stats.podiums,
        bestFinishLabel: stats.bestFinishLabel,
      };
    });

    // Deterministic Tie-breaking Hierarchy:
    // 1. Higher Game Rating
    // 2. More Tournament Championships (Wins)
    // 3. More Podium Finishes (Top 3)
    // 4. More Top 8 Finishes
    // 5. More Tournaments Played
    // 6. Better Best Finish (lower rank number is better)
    // 7. Stable Alphabetical / ID Fallback
    ranked.sort((a, b) => {
      if (b.stats.rating !== a.stats.rating) return b.stats.rating - a.stats.rating;
      if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
      if (b.stats.podiums !== a.stats.podiums) return b.stats.podiums - a.stats.podiums;
      if (b.stats.top8 !== a.stats.top8) return b.stats.top8 - a.stats.top8;
      if (b.stats.tournamentsPlayed !== a.stats.tournamentsPlayed) {
        return b.stats.tournamentsPlayed - a.stats.tournamentsPlayed;
      }
      const bestA = a.stats.bestFinishRank ?? 9999;
      const bestB = b.stats.bestFinishRank ?? 9999;
      if (bestA !== bestB) return bestA - bestB;

      const nameCompare = (a.user.name || '').localeCompare(b.user.name || '');
      if (nameCompare !== 0) return nameCompare;
      return (a.user.id || '').localeCompare(b.user.id || '');
    });

    return ranked.map((item, idx) => ({
      ...item,
      globalRank: idx + 1,
    }));
  }

  public getPlayerGameStats(userId: string, gameKey: string): PlayerGameStats {
    const normKey = DatabaseService.normalizeGameKey(gameKey);
    const allRankings = this.calculateAllGameRankings();
    const gameMap = allRankings.get(normKey);
    const record = gameMap?.get(userId);
    if (record) return { ...record.stats };

    const gameInfo = DatabaseService.getGameDisplayInfo(gameKey);
    return {
      gameKey: normKey,
      gameName: gameInfo.name,
      rating: 1000,
      tournamentsPlayed: 0,
      wins: 0,
      runnerUps: 0,
      thirdPlaces: 0,
      podiums: 0,
      top8: 0,
      bestFinishRank: null,
      bestFinishLabel: 'N/A',
      averageFinish: 'N/A',
      earnedPointsTotal: 0,
      ranksList: [],
    };
  }

  public getPlayerAllGameStats(userId: string): PlayerGameStats[] {
    const availableGames = this.getAvailableGames();
    return availableGames.map((g) => this.getPlayerGameStats(userId, g.key));
  }

  public getRankedPlayers(): RankedPlayerGameProfile[] {
    return this.getRankedPlayersForGame();
  }

  public calculatePlayerRankPoints(userId: string) {
    const allGames = this.getAvailableGames();
    const primaryGame = allGames.find((g) => g.completedTournamentsCount > 0) || allGames[0];
    const stats = this.getPlayerGameStats(userId, primaryGame?.key || 'efootball');

    return {
      rankPoints: stats.rating,
      totalRankPoints: stats.earnedPointsTotal,
      participationPoints: stats.tournamentsPlayed,
      eventsPlayed: stats.tournamentsPlayed,
      tournamentsPlayed: stats.tournamentsPlayed,
      wins: stats.wins,
      championships: stats.wins,
      runnerUps: stats.runnerUps,
      thirdPlaces: stats.thirdPlaces,
      semiFinals: stats.thirdPlaces,
      top3: stats.podiums,
      bestFinishRank: stats.bestFinishRank,
      bestFinishLabel: stats.bestFinishLabel,
      averageFinish: stats.averageFinish,
      mvpCount: 0,
      badges: [
        ...(stats.wins > 0 ? [{ label: 'Champion', count: stats.wins, icon: '🏆' }] : []),
        ...(stats.runnerUps > 0 ? [{ label: 'Runner-up', count: stats.runnerUps, icon: '🥈' }] : []),
        ...(stats.thirdPlaces > 0 ? [{ label: 'Third Place', count: stats.thirdPlaces, icon: '🥉' }] : []),
      ],
      matchWins: 0,
      totalMatchesPlayed: 0,
      gamesPlayed: allGames.filter((g) => this.getPlayerGameStats(userId, g.key).tournamentsPlayed > 0).map((g) => g.name),
      breakdown: {
        participationPts: stats.tournamentsPlayed,
        championshipPts: stats.wins * 15,
        runnerUpPts: stats.runnerUps * 10,
        semiFinalPts: stats.thirdPlaces * 8,
        matchWinPts: 0,
        versatilityPts: 0,
        matchPlayedPts: 0,
      },
    };
  }

  public getOrganizerStats(organizerId: string): {
    totalTournaments: number;
    activeTournaments: number;
    completedTournaments: number;
    totalPlayersHosted: number;
    rating: number;
    ratingCount: number;
    rankPoints: number;
  } {
    const orgTournaments = this.tournaments.filter((t) => t.organizerId === organizerId);
    const totalTournaments = orgTournaments.length;
    const activeTournaments = orgTournaments.filter(
      (t) => t.status === 'Ongoing' || t.status === 'Live' || t.status === 'Upcoming'
    ).length;
    const completedTournaments = orgTournaments.filter(
      (t) => t.status === 'Completed' || t.status === 'Finished'
    ).length;

    let totalPlayersHosted = 0;
    orgTournaments.forEach((t) => {
      totalPlayersHosted += this.getTournamentPlayers(t.id).length;
    });

    const orgUser = this.getUserById(organizerId);
    const rating = orgUser?.rating || 4.9;
    const ratingCount = orgUser?.ratingCount || 18;

    // Organizer Host Rank Points System:
    // 50 per tournament + 100 per completed tournament + 5 per player hosted + rating bonus (rating * 30)
    const rankPoints =
      totalTournaments * 50 +
      completedTournaments * 100 +
      totalPlayersHosted * 5 +
      Math.round(rating * 30);

    return {
      totalTournaments,
      activeTournaments,
      completedTournaments,
      totalPlayersHosted,
      rating,
      ratingCount,
      rankPoints,
    };
  }

  // =========================================================================
  // WITHDRAWAL REQUESTS (ORGANIZER EARNINGS MODULE)
  // =========================================================================
  public getWithdrawalRequests(): WithdrawalRequest[] {
    return [...this.withdrawalRequests].sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  }

  public getOrganizerWithdrawalRequests(organizerId: string): WithdrawalRequest[] {
    return this.getWithdrawalRequests().filter((r) => r.organizerId === organizerId);
  }

  public async createWithdrawalRequest(data: {
    organizerId: string;
    organizerName: string;
    amount: number;
    telebirrName?: string;
    telebirrNumber?: string;
    reason?: string;
  }): Promise<WithdrawalRequest> {
    const id = 'req_w_' + Date.now();
    const newReq: WithdrawalRequest = {
      id,
      organizerId: data.organizerId,
      organizerName: data.organizerName,
      amount: data.amount,
      telebirrName: data.telebirrName || '',
      telebirrNumber: data.telebirrNumber || '',
      reason: data.reason || (data.telebirrName ? `Telebirr: ${data.telebirrName} (${data.telebirrNumber})` : ''),
      status: 'Pending Approval',
      requestedAt: new Date().toISOString(),
    };

    try {
      const token = await auth.currentUser?.getIdToken();
      const currentUid = auth.currentUser?.uid;
      const res = await fetch('/api/financial/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(currentUid ? { 'x-user-id': currentUid } : {}),
        },
        body: JSON.stringify({
          ...data,
          idempotencyKey: `withdraw_${data.organizerId}_${data.amount}_${Math.floor(Date.now() / 60000)}`,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.request) {
          const reqFromApi: WithdrawalRequest = {
            id: json.request.id,
            organizerId: json.request.organizerId,
            organizerName: json.request.organizerName,
            amount: json.request.amount,
            telebirrName: json.request.telebirrName || '',
            telebirrNumber: json.request.telebirrNumber || '',
            reason: json.request.reason || '',
            status: json.request.status || 'Pending Approval',
            requestedAt: json.request.requestedAt || new Date().toISOString(),
          };
          const idx = this.withdrawalRequests.findIndex((r) => r.id === reqFromApi.id);
          if (idx >= 0) {
            this.withdrawalRequests[idx] = reqFromApi;
          } else {
            this.withdrawalRequests.push(reqFromApi);
          }
          this.notify();
          return reqFromApi;
        }
      }
    } catch (err) {
      console.warn('Server withdrawal request creation failed, using fallback:', err);
    }

    const docRef = doc(firestore, 'withdrawalRequests', id);
    await setDoc(docRef, newReq);
    const idx = this.withdrawalRequests.findIndex((r) => r.id === id);
    if (idx >= 0) {
      this.withdrawalRequests[idx] = newReq;
    } else {
      this.withdrawalRequests.push(newReq);
    }
    this.notify();
    return newReq;
  }

  public async approveWithdrawalRequest(requestId: string): Promise<void> {
    const reqObj = this.withdrawalRequests.find((r) => r.id === requestId);
    if (reqObj) {
      reqObj.status = 'Paid';
      reqObj.processedAt = new Date().toISOString();
      this.notify();
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      const currentUid = auth.currentUser?.uid;
      const res = await fetch('/api/financial/process-withdrawal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(currentUid ? { 'x-user-id': currentUid } : {}),
        },
        body: JSON.stringify({
          requestId,
          status: 'Paid',
          idempotencyKey: `process_w_${requestId}_Paid`,
        }),
      });
      if (res.ok) {
        return;
      }
    } catch (err) {
      console.warn('Server withdrawal approval failed, using fallback:', err);
    }

    const docRef = doc(firestore, 'withdrawalRequests', requestId);
    await updateDoc(docRef, {
      status: 'Paid',
      processedAt: new Date().toISOString(),
    });
  }

  public async rejectWithdrawalRequest(requestId: string): Promise<void> {
    const reqObj = this.withdrawalRequests.find((r) => r.id === requestId);
    if (reqObj) {
      reqObj.status = 'Rejected';
      reqObj.processedAt = new Date().toISOString();
      this.notify();
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      const currentUid = auth.currentUser?.uid;
      const res = await fetch('/api/financial/process-withdrawal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(currentUid ? { 'x-user-id': currentUid } : {}),
        },
        body: JSON.stringify({
          requestId,
          status: 'Rejected',
          idempotencyKey: `process_w_${requestId}_Rejected`,
        }),
      });
      if (res.ok) {
        return;
      }
    } catch (err) {
      console.warn('Server withdrawal rejection failed, using fallback:', err);
    }

    const docRef = doc(firestore, 'withdrawalRequests', requestId);
    await updateDoc(docRef, {
      status: 'Rejected',
      processedAt: new Date().toISOString(),
    });
  }
}

export const db = new DatabaseService();
