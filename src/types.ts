export type UserRole = 'PLAYER' | 'ORGANIZER' | 'REFEREE' | 'ADMIN';

export type PlayerStatus = 'Registered' | 'Checked In' | 'Playing' | 'Eliminated' | 'Champion' | 'Runner-up' | 'Semi-Finalist';

export type MatchStatus = 'Waiting' | 'Playing' | 'Finished';

export type TournamentStatus = 'Draft' | 'Registration Open' | 'Live' | 'Finished' | 'Upcoming' | 'Ongoing' | 'Completed';

export type TournamentFormat = 'elimination' | 'points'; // 'elimination' = World Cup Style, 'points' = PUBG Multi-Round Style

export type PaymentStatus = 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED';

export interface User {
  id: string;
  name: string;
  username: string;
  profileImage: string;
  telegramUserId: string;
  role: UserRole;
  gamertag?: string;
  favGame?: string;
  venueName?: string;
  phoneNumber?: string;
  teamName?: string;
  organizerRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  organizerRequestReason?: string;
  rating?: number; // Organizer rating e.g. 4.9
  ratingCount?: number;
  bio?: string;
  createdAt?: string;
}

export interface OrganizerRequest {
  id: string;
  userId: string;
  userName: string;
  username: string;
  telegramUserId: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
}

export interface FinalStanding {
  userId: string;
  rank: number;
  points: number;
  performance: number;
  badge?: string; // "Champion", "Runner-up", "Third Place", "MVP", or custom text
}

export interface SessionPlayerScore {
  userId: string;
  points: number;
  performance: number;
}

export interface TournamentSession {
  id: string;
  tournamentId: string;
  roundNumber: number; // 1, 2, 3...
  name: string; // e.g. "Match 1", "Lobby A", "Heat 1"
  scores: SessionPlayerScore[];
}

export interface Tournament {
  id: string;
  tournamentName: string;
  game: string; // Custom free text!
  image: string;
  date: string;
  time: string;
  maxPlayers: number;
  registrationDeadline?: string;
  status: TournamentStatus;
  organizerId: string;
  venueName?: string;
  venueLocation?: string; // Customizable venue location details
  rules?: string;
  format?: TournamentFormat; // 'elimination' | 'points'
  groupSize?: number; // default 4
  currentStage?: 'registration' | 'group' | 'knockout' | 'completed' | string;
  currentRound?: number; // 1, 2, 3 for multi-round points format
  maxRounds?: number; // default 3
  isApproved?: boolean; // Admin approval required before posted to players
  registrationFee?: string; // e.g. "50 ETB" or "Free"
  prizePool?: string; // e.g. "1000 ETB"
  award?: string; // e.g. "1000 ETB", "500 ETB + Trophy", "Champion Trophy", "Gaming Keyboard"
  telebirrNumber?: string; // e.g. "0912345678"
  telebirrAccountName?: string; // e.g. "Nexus Gaming Lounge"
  telebirrName?: string;
  performanceLabel?: string; // e.g. "Goals", "Kills", "Frames", "Time", "Points"
  sessionLabel?: string; // e.g. "Match", "Lobby", "Heat", "Race", "Session"
  finalStandings?: FinalStanding[];
  placementPointsConfig?: Record<number, number>; // e.g. {1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 4, 7: 2, 8: 1}
  killMultiplier?: number; // default 1
  createdAt?: string;
}

export interface TournamentGroup {
  id: string;
  tournamentId: string;
  groupName: string; // "Group A", "Group B"
  playerIds: string[];
  roundNumber?: number;
  manualRanks?: Record<string, number>; // userId -> rank override for tie situations
  playerStatuses?: Record<string, 'Waiting' | 'Qualified' | 'Eliminated' | 'Champion'>;
}

export interface PlayerRoundScore {
  id: string;
  tournamentId: string;
  userId: string;
  roundNumber: number; // 1, 2, 3
  placement?: number; // 1st, 2nd, etc.
  kills?: number;
  placementPoints?: number;
  killPoints?: number;
  points: number;
  groupId?: string;
  lobbyName?: string;
}

export interface TournamentPlayer {
  tournamentId: string;
  userId: string;
  registrationDate: string;
  playerStatus: PlayerStatus;
  paymentStatus?: PaymentStatus;
  paymentProofUrl?: string;
  paymentSubmittedAt?: string;
  seed?: number;
  checkInCode?: string; // e.g. "SG-8921" for QR/Code check-in
}

export interface Match {
  id: string;
  tournamentId: string;
  round: string; // "Group A", "Quarterfinals", "Semifinals", "Finals"
  playerAId: string | null;
  playerBId: string | null;
  playerAScore?: number;
  playerBScore?: number;
  isDraw?: boolean;
  stationNumber: string; // e.g., "Station 01", "PS5 #3"
  winnerId: string | null;
  score: string; // e.g. "3 - 1"
  status: MatchStatus;
  groupId?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'tournament_approval' | 'payment' | 'invite' | 'match' | 'system' | 'tournament' | 'announcement' | 'match_call';
  createdAt: string;
  read: boolean;
  tournamentId?: string;
}

export interface GalleryPost {
  id: string;
  tournamentId?: string;
  tournamentName: string;
  imageUrl: string;
  caption: string;
  likes: number;
  postedAt: string;
  organizerName: string;
}

export type PlayerNavTab = 'home' | 'tournaments' | 'players' | 'profile';
export type OrganizerNavTab = 'home' | 'tournaments' | 'organizer_panel' | 'players' | 'profile';
export type NavTab = PlayerNavTab | OrganizerNavTab;

export interface TelegramUser {
  id: number | string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramBotConfig {
  botUsername: string;
  botToken?: string;
  approvedOrganizerIds: string[];
}

export interface TournamentRoundScore {
  id: string;
  tournamentId: string;
  userId: string;
  roundNumber: number;
  placement: number;
  kills: number;
  placementPoints: number;
  killPoints: number;
  points: number;
  lobbyName?: string;
  recordedAt?: string;
}

export type WithdrawalStatus = 'Pending Approval' | 'Paid' | 'Rejected';

export interface WithdrawalRequest {
  id: string;
  organizerId: string;
  organizerName: string;
  amount: number;
  telebirrName?: string;
  telebirrNumber?: string;
  reason?: string;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt?: string;
}

