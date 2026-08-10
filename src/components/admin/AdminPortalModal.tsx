import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { User, UserRole, WithdrawalRequest } from '../../types';
import {
  ShieldCheck,
  Lock,
  X,
  UserPlus,
  Trash2,
  CheckCircle2,
  Users,
  Trophy,
  KeyRound,
  Search,
  Shield,
  User as UserIcon,
  RefreshCw,
  Plus,
  DollarSign,
  FileText,
  Eye,
  Clock,
  AlertCircle,
  LogOut,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';

interface AdminPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPortalModal: React.FC<AdminPortalModalProps> = ({ isOpen, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAuthenticated(db.isFirebaseAdminAuthenticated());
    }
  }, [isOpen]);

  const [activeTab, setActiveTab] = useState<'users' | 'organizers' | 'tournaments' | 'withdrawals' | 'registration_requests'>(
    'users'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'PLAYER' | 'ORGANIZER' | 'REFEREE' | 'ADMIN'>('ALL');
  const [tournamentSearchTerm, setTournamentSearchTerm] = useState('');
  const [previewScreenshotUrl, setPreviewScreenshotUrl] = useState<string | null>(null);
  const [regFilter, setRegFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED'>('PENDING_APPROVAL');
  const [regSearchTerm, setRegSearchTerm] = useState('');

  // Add User Form State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newTgId, setNewTgId] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('PLAYER');
  const [newGamertag, setNewGamertag] = useState('');
  const [userActionMsg, setUserActionMsg] = useState('');

  // Add Approved Org TG ID
  const [newOrgTgId, setNewOrgTgId] = useState('');
  const [orgActionMsg, setOrgActionMsg] = useState('');

  // Selected User & Tournament & Withdrawal Detail Modal states
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<User | null>(null);
  const [selectedTourForDetail, setSelectedTourForDetail] = useState<any | null>(null);
  const [selectedWithdrawalRequestDetail, setSelectedWithdrawalRequestDetail] = useState<WithdrawalRequest | null>(null);

  // Payment destination editing during approval
  const [adminTeleName, setAdminTeleName] = useState('');
  const [adminTeleNumber, setAdminTeleNumber] = useState('');
  const [adminApprovalError, setAdminApprovalError] = useState('');

  useEffect(() => {
    if (selectedTourForDetail) {
      setAdminTeleName(selectedTourForDetail.telebirrAccountName || selectedTourForDetail.telebirrName || '');
      setAdminTeleNumber(selectedTourForDetail.telebirrNumber || '');
      setAdminApprovalError('');
    }
  }, [selectedTourForDetail]);

  const handleApproveTournamentWithValidation = async (t: any) => {
    // If reviewing in modal, use form inputs adminTeleName and adminTeleNumber
    const isDetailModal = selectedTourForDetail?.id === t.id;
    const teleName = (isDetailModal ? adminTeleName : (t.telebirrAccountName || t.telebirrName || '')).trim();
    const teleNum = (isDetailModal ? adminTeleNumber : (t.telebirrNumber || '')).trim();

    if (!teleName && !teleNum) {
      const errMsg = 'Cannot approve tournament: Both Telebirr Name and Telebirr Number are required.';
      setAdminApprovalError(errMsg);
      if (!isDetailModal) {
        setSelectedTourForDetail(t);
      }
      return false;
    }
    if (!teleName) {
      const errMsg = 'Cannot approve tournament: Telebirr Name is required.';
      setAdminApprovalError(errMsg);
      if (!isDetailModal) {
        setSelectedTourForDetail(t);
      }
      return false;
    }
    if (!teleNum) {
      const errMsg = 'Cannot approve tournament: Telebirr Number is required.';
      setAdminApprovalError(errMsg);
      if (!isDetailModal) {
        setSelectedTourForDetail(t);
      }
      return false;
    }

    await db.approveTournament(t.id, { telebirrName: teleName, telebirrNumber: teleNum });
    setUserActionMsg(`Approved tournament "${t.tournamentName}" with assigned payment destination!`);
    setTimeout(() => setUserActionMsg(''), 4000);
    setAdminApprovalError('');
    if (isDetailModal) {
      setSelectedTourForDetail(null);
    }
    return true;
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmailInput.trim() || !adminPasswordInput.trim()) {
      setLoginError('Invalid email or password.');
      return;
    }
    setIsSubmittingLogin(true);
    setLoginError('');
    try {
      const isValid = await db.loginAdminWithFirebase(adminEmailInput.trim(), adminPasswordInput);
      if (isValid) {
        setIsAuthenticated(true);
        setLoginError('');
        setAdminPasswordInput('');
      } else {
        setLoginError('Invalid email or password.');
      }
    } catch {
      setLoginError('Invalid email or password.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newTgId.trim()) return;

    await db.addUser({
      name: newName.trim(),
      username: newUsername.trim() || `user_${newTgId.trim()}`,
      telegramUserId: newTgId.trim(),
      role: newRole,
      gamertag: newGamertag.trim() || newName.trim(),
      favGame: 'eFootball 2026',
    });

    setUserActionMsg(`User "${newName}" successfully created as ${newRole}!`);
    setShowAddUserModal(false);
    setNewName('');
    setNewUsername('');
    setNewTgId('');
    setNewGamertag('');
    setTimeout(() => setUserActionMsg(''), 4000);
  };

  const handleDeleteUser = async (user: User) => {
    if (window.confirm(`Are you sure you want to permanently delete user "${user.name}"?`)) {
      await db.deleteUser(user.id);
      setUserActionMsg(`User "${user.name}" removed from database.`);
      setTimeout(() => setUserActionMsg(''), 4000);
    }
  };

  const handleToggleRole = async (user: User) => {
    await db.toggleUserRole(user.id);
    setUserActionMsg(`Updated role for ${user.name}`);
    setTimeout(() => setUserActionMsg(''), 3000);
  };

  const handleSetUserRole = async (user: User, targetRole: UserRole) => {
    await db.updateUser({ id: user.id, role: targetRole });
    if (targetRole === 'ORGANIZER') {
      await db.addApprovedOrganizerId(user.telegramUserId);
    }
    setUserActionMsg(`Role for ${user.name} changed to ${targetRole}.`);
    setTimeout(() => setUserActionMsg(''), 3000);
  };

  const handleAddOrgTgId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgTgId.trim()) return;

    const success = await db.addApprovedOrganizerId(newOrgTgId);
    if (success) {
      setOrgActionMsg(`Telegram ID "${newOrgTgId}" approved for Organizer access!`);
      setNewOrgTgId('');
    } else {
      setOrgActionMsg('Failed to add ID.');
    }
    setTimeout(() => setOrgActionMsg(''), 4000);
  };

  const handleRemoveOrgTgId = async (id: string) => {
    if (window.confirm(`Revoke Organizer approval for Telegram ID "${id}"?`)) {
      await db.removeApprovedOrganizerId(id);
      setOrgActionMsg(`Organizer privilege revoked for ID ${id}.`);
      setTimeout(() => setOrgActionMsg(''), 4000);
    }
  };

  const handleDeleteTournament = async (tId: string, name: string) => {
    if (window.confirm(`Delete tournament "${name}"? This action cannot be undone.`)) {
      await db.deleteTournament(tId);
      setUserActionMsg(`Tournament "${name}" deleted.`);
      setTimeout(() => setUserActionMsg(''), 4000);
    }
  };

  const allUsers = db.getUsers();
  const approvedOrgIds = db.getApprovedOrganizerIds();
  const tournaments = db.getTournaments();
  const organizerRequests = db.getOrganizerRequests();
  const pendingOrganizerRequests = organizerRequests.filter((r) => r.status === 'pending');

  const handleApproveOrgRequest = async (reqId: string, userName: string) => {
    await db.approveOrganizerRequest(reqId);
    setOrgActionMsg(`Approved ${userName}! Granted Organizer privileges.`);
    setTimeout(() => setOrgActionMsg(''), 4000);
  };

  const handleRejectOrgRequest = async (reqId: string, userName: string) => {
    await db.rejectOrganizerRequest(reqId);
    setOrgActionMsg(`Rejected organizer request for ${userName}.`);
    setTimeout(() => setOrgActionMsg(''), 4000);
  };

  const filteredUsers = allUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.telegramUserId.toLowerCase().includes(searchTerm.toLowerCase());

    if (roleFilter === 'ALL') return matchesSearch;
    return matchesSearch && u.role === roleFilter;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-center items-start p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl w-full max-w-3xl shadow-2xl relative my-auto">
        {/* Header Bar */}
        <div className="bg-slate-850 px-5 py-4 border-b border-slate-750 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Admin Control Portal
              </h2>
              <p className="text-[11px] text-slate-400">
                System Administration & User Role Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={async () => {
                  await db.logoutAdminWithFirebase();
                  setIsAuthenticated(false);
                  setAdminEmailInput('');
                  setAdminPasswordInput('');
                  setLoginError('');
                }}
                className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-xl hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AUTHENTICATION VIEW */}
        {!isAuthenticated ? (
          <div className="p-8 max-w-md mx-auto space-y-6 text-center">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <Lock className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-1">Admin Authentication</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in with your administrator email and password to access system management.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-slate-950 border border-slate-750 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Enter Admin Password"
                  className="w-full bg-slate-950 border border-slate-750 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 text-sm"
                />
              </div>

              {loginError && <p className="text-xs text-rose-400 font-bold mt-1 text-center">{loginError}</p>}

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold rounded-2xl text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                {isSubmittingLogin ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED ADMIN DASHBOARD */
          <div className="p-5 space-y-5">
            {/* Action Feedback Toast */}
            {userActionMsg && (
              <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-center justify-between font-medium">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  {userActionMsg}
                </span>
                <button onClick={() => setUserActionMsg('')} className="text-amber-400 font-bold">
                  ✕
                </button>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 overflow-x-auto gap-2 no-scrollbar">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'users'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Users ({allUsers.length})
                </button>

                <button
                  onClick={() => setActiveTab('registration_requests')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'registration_requests'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Requests ({
                    db.getTournaments().flatMap((t) => db.getTournamentPlayers(t.id)).filter((p) => p.paymentStatus === 'PENDING_APPROVAL').length
                  })
                </button>

                <button
                  onClick={() => setActiveTab('organizers')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'organizers'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Organizers ({approvedOrgIds.length})
                </button>

                <button
                  onClick={() => setActiveTab('tournaments')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'tournaments'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Tournaments ({tournaments.length})
                </button>

                <button
                  onClick={() => setActiveTab('withdrawals')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'withdrawals'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                      : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Finance ({db.getWithdrawalRequests().filter((r) => r.status === 'Pending Approval').length})
                </button>
              </div>
            </div>

            {/* TAB 1: USER MANAGEMENT */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Search & Action Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search users by name, @username, or TG ID..."
                        className="w-full bg-slate-850 border border-slate-750 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                      />
                    </div>

                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value as any)}
                      className="bg-slate-850 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="ALL">All Roles</option>
                      <option value="PLAYER">Players Only</option>
                      <option value="ORGANIZER">Organizers Only</option>
                      <option value="REFEREE">Referees Only</option>
                      <option value="ADMIN">Admins Only</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 shrink-0 transition-all active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    + Add New User
                  </button>
                </div>

                {/* Users List Grid */}
                <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                  {filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-850 rounded-2xl border border-slate-800">
                      No users found matching filter.
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className="p-3 bg-slate-850 border border-slate-750 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-650 transition-colors"
                      >
                        <div
                          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedUserForDetail(u)}
                        >
                          <img
                            src={u.profileImage}
                            alt={u.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white truncate hover:underline">{u.name}</span>
                              <span
                                className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase ${
                                  u.role === 'ORGANIZER'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : u.role === 'ADMIN'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : u.role === 'REFEREE'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                }`}
                              >
                                {u.role}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                              <span className="text-sky-400 font-mono font-bold">Username: @{u.username}</span>
                              <span className="font-mono text-slate-300">Telegram ID: {u.telegramUserId}</span>
                              <span className="text-slate-400">
                                Registration Date: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Jan 2026'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* User Action Controls & Role Granting */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <select
                            value={u.role}
                            onChange={(e) => handleSetUserRole(u, e.target.value as UserRole)}
                            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-bold focus:outline-hidden focus:border-amber-500"
                            title="Grant / Revoke Permissions"
                          >
                            <option value="PLAYER">Role: PLAYER</option>
                            <option value="ORGANIZER">Role: ORGANIZER</option>
                            <option value="REFEREE">Role: REFEREE</option>
                            <option value="ADMIN">Role: ADMIN</option>
                          </select>

                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                            title="Delete User (Requires Confirmation)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: APPROVED ORGANIZERS & REQUESTS */}
            {activeTab === 'organizers' && (
              <div className="space-y-4">
                {/* PENDING ORGANIZER REQUESTS FROM PLAYERS */}
                {pendingOrganizerRequests.length > 0 && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-amber-300 text-xs uppercase tracking-wider flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-amber-400 animate-bounce" />
                        Pending Organizer Requests ({pendingOrganizerRequests.length})
                      </h3>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                        Requires Admin Action
                      </span>
                    </div>

                    <div className="space-y-2">
                      {pendingOrganizerRequests.map((req) => (
                        <div
                          key={req.id}
                          className="bg-slate-900 border border-slate-750 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-white text-sm">{req.userName}</span>
                              <span className="text-[10px] text-sky-400 font-mono">@{req.username}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Telegram ID: <span className="font-mono text-amber-300">{req.telegramUserId}</span> • Requested: {req.requestedAt}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleApproveOrgRequest(req.id, req.userName)}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve Organizer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectOrgRequest(req.id, req.userName)}
                              className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center gap-1"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-slate-850 rounded-2xl border border-slate-750 space-y-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    Approve Telegram ID as Organizer
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Users opening the app with an approved Telegram User ID will automatically be granted Organizer permissions to create & manage tournaments.
                  </p>

                  {orgActionMsg && (
                    <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-medium">
                      {orgActionMsg}
                    </div>
                  )}

                  <form onSubmit={handleAddOrgTgId} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newOrgTgId}
                      onChange={(e) => setNewOrgTgId(e.target.value)}
                      placeholder="Telegram User ID (e.g. 88492019)"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-md transition-all flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Approved ID
                    </button>
                  </form>
                </div>

                {/* List of Approved IDs */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-slate-300">
                    Currently Approved Telegram IDs ({approvedOrgIds.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {approvedOrgIds.map((id) => {
                      const matchedUser = allUsers.find(
                        (u) => u.telegramUserId.replace(/^tg_/, '') === id
                      );

                      return (
                        <div
                          key={id}
                          className="p-3 bg-slate-850 border border-slate-750 rounded-2xl flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-amber-300 text-xs">
                                ID: {id}
                              </span>
                              {matchedUser && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-sky-300 rounded">
                                  {matchedUser.name}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              Granted Organizer privileges
                            </span>
                          </div>

                          <button
                            onClick={() => handleRemoveOrgTgId(id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors"
                            title="Revoke Permission"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TOURNAMENTS MANAGEMENT & APPROVAL */}
            {activeTab === 'tournaments' && (
              <div className="space-y-4">
                {/* Search & Filter Tournaments Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tournamentSearchTerm}
                    onChange={(e) => setTournamentSearchTerm(e.target.value)}
                    placeholder="Search tournaments by name, game, or status..."
                    className="w-full bg-slate-850 border border-slate-750 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                {/* Pending Approval Section */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-amber-300 text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      Pending Approval Requests ({db.getPendingTournamentsForAdmin().length})
                    </h3>
                  </div>

                  {db.getPendingTournamentsForAdmin().length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No tournaments pending approval right now.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto">
                      {db.getPendingTournamentsForAdmin()
                        .filter((t) =>
                          !tournamentSearchTerm ||
                          t.tournamentName.toLowerCase().includes(tournamentSearchTerm.toLowerCase()) ||
                          t.game.toLowerCase().includes(tournamentSearchTerm.toLowerCase())
                        )
                        .map((t) => {
                          const org = db.getUserById(t.organizerId);
                          return (
                            <div
                              key={t.id}
                              className="p-3 bg-slate-900 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                            >
                              <div
                                className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 hover:opacity-90 transition-opacity"
                                onClick={() => setSelectedTourForDetail(t)}
                              >
                                <img
                                  src={t.image}
                                  alt={t.tournamentName}
                                  className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-700"
                                />
                                <div className="min-w-0">
                                  <h4 className="font-bold text-white text-xs truncate hover:underline">{t.tournamentName}</h4>
                                  <p className="text-[11px] text-slate-300 truncate">
                                    🎮 Game: <span className="text-sky-300 font-semibold">{t.game}</span> • Max: {t.maxPlayers} players
                                  </p>
                                  <p className="text-[10px] text-amber-300 font-medium truncate">
                                    👤 Organizer: {org ? org.name : 'Unknown'} • Fee: {t.registrationFee || 'Free'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <button
                                  onClick={() => handleApproveTournamentWithValidation(t)}
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1 shadow-md transition-all active:scale-95"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Approve & Publish
                                </button>
                                <button
                                  onClick={async () => {
                                    if (window.confirm(`Reject tournament "${t.tournamentName}"?`)) {
                                      await db.rejectTournament(t.id);
                                      setUserActionMsg(`Rejected tournament "${t.tournamentName}".`);
                                      setTimeout(() => setUserActionMsg(''), 4000);
                                    }
                                  }}
                                  className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleDeleteTournament(t.id, t.tournamentName)}
                                  className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-colors shrink-0"
                                  title="Delete Tournament"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* All System Tournaments */}
                <div className="space-y-3">
                  <h3 className="font-bold text-white text-sm">
                    All System Tournaments ({
                      tournaments.filter((t) =>
                        !tournamentSearchTerm ||
                        t.tournamentName.toLowerCase().includes(tournamentSearchTerm.toLowerCase()) ||
                        t.game.toLowerCase().includes(tournamentSearchTerm.toLowerCase()) ||
                        t.status.toLowerCase().includes(tournamentSearchTerm.toLowerCase())
                      ).length
                    })
                  </h3>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {tournaments
                      .filter((t) =>
                        !tournamentSearchTerm ||
                        t.tournamentName.toLowerCase().includes(tournamentSearchTerm.toLowerCase()) ||
                        t.game.toLowerCase().includes(tournamentSearchTerm.toLowerCase()) ||
                        t.status.toLowerCase().includes(tournamentSearchTerm.toLowerCase())
                      )
                      .map((t) => {
                        const org = db.getUserById(t.organizerId);
                        return (
                          <div
                            key={t.id}
                            className="p-3 bg-slate-850 border border-slate-750 rounded-2xl flex items-center justify-between gap-3"
                          >
                            <div
                              className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 hover:opacity-90 transition-opacity"
                              onClick={() => setSelectedTourForDetail(t)}
                            >
                              <img
                                src={t.image}
                                alt={t.tournamentName}
                                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-700"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-white text-xs truncate hover:underline">{t.tournamentName}</h4>
                                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                                    {t.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-amber-300 font-medium truncate mt-0.5">
                                  Game: {t.game} • Organizer: {org ? org.name : 'System'} • Players: {db.getTournamentPlayers(t.id).length}/{t.maxPlayers}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteTournament(t.id, t.tournamentName)}
                              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-colors shrink-0"
                              title="Delete Tournament (Requires Confirmation)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: FINANCE PAGE (Requirement 4) */}
            {activeTab === 'withdrawals' && (
              <div className="space-y-4">
                {/* Read-Only Earnings Summary (Requirement 4B) */}
                {(() => {
                  const allT = db.getTournaments();
                  let totalCollected = 0;
                  allT.forEach((t) => {
                    const players = db.getTournamentPlayers(t.id);
                    const paidPlayers = players.filter((p) => p.paymentStatus === 'CONFIRMED');
                    const countedPlayers = paidPlayers.length > 0 ? paidPlayers.length : players.length;
                    const match = (t.registrationFee || '').match(/(\d+(?:\.\d+)?)/);
                    const fee = match ? parseFloat(match[1]) : 0;
                    totalCollected += fee * countedPlayers;
                  });
                  const adminShare = Math.round(totalCollected * 0.10);

                  return (
                    <div className="grid grid-cols-2 gap-3 bg-slate-850 p-4 rounded-2xl border border-slate-750">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Collected</span>
                        <p className="text-xl font-black text-white">{totalCollected.toLocaleString()} ETB</p>
                        <p className="text-[10px] text-slate-500 font-medium font-sans">Gross revenue across all tournaments</p>
                      </div>
                      <div className="space-y-1 border-l border-slate-750 pl-4">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Admin Share (10%)</span>
                        <p className="text-xl font-black text-emerald-400">{adminShare.toLocaleString()} ETB</p>
                        <p className="text-[10px] text-emerald-500/80 font-medium font-sans">System platform revenue</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between bg-slate-850 p-4 rounded-2xl border border-slate-750">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      Withdrawal Requests
                    </h4>
                    <p className="text-xs text-slate-400">
                      Click any organizer name for profile or click a request row for full withdrawal details.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 font-bold block">Pending Approval</span>
                    <p className="text-base font-black text-amber-400">
                      {db.getWithdrawalRequests().filter((r) => r.status === 'Pending Approval').length} Requests
                    </p>
                  </div>
                </div>

                {db.getWithdrawalRequests().length === 0 ? (
                  <div className="p-8 text-center bg-slate-850/50 rounded-2xl border border-slate-800">
                    <DollarSign className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">No withdrawal requests found.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {db.getWithdrawalRequests().map((req) => (
                      <div
                        key={req.id}
                        onClick={() => setSelectedWithdrawalRequestDetail(req)}
                        className="bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-emerald-500/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all shadow-md group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                const orgUser = db.getUserById(req.organizerId) || allUsers.find((u) => u.name === req.organizerName);
                                if (orgUser) setSelectedUserForDetail(orgUser);
                              }}
                              className="text-sm font-extrabold text-white hover:text-amber-300 underline underline-offset-2 decoration-amber-500/40 transition-colors"
                              title="Click to view Organizer Profile"
                            >
                              Organizer: {req.organizerName}
                            </span>
                          </div>
                          <p className="text-xs text-emerald-400 font-black">
                            Amount: {req.amount.toLocaleString()} ETB
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Requested At: {new Date(req.requestedAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              req.status === 'Paid'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : req.status === 'Rejected'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {req.status}
                          </span>

                          <span className="text-xs text-sky-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            Details →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tournament Revenue Breakdown Table (Requirement 3 - Moved to bottom) */}
                <div className="bg-slate-850 p-4 rounded-2xl border border-slate-750 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Tournament Revenue Breakdown
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-750">
                        <tr>
                          <th className="p-2.5">Tournament</th>
                          <th className="p-2.5 text-center">Entry Fee</th>
                          <th className="p-2.5 text-center">Registered Players</th>
                          <th className="p-2.5 text-right">Total Collected</th>
                          <th className="p-2.5 text-right">Admin Share (10%)</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {db.getTournaments().length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-500 italic">No tournaments found.</td>
                          </tr>
                        ) : (
                          db.getTournaments().map((t) => {
                            const players = db.getTournamentPlayers(t.id);
                            const paidPlayers = players.filter((p) => p.paymentStatus === 'CONFIRMED');
                            const countedPlayers = paidPlayers.length > 0 ? paidPlayers.length : players.length;
                            const match = (t.registrationFee || '').match(/(\d+(?:\.\d+)?)/);
                            const fee = match ? parseFloat(match[1]) : 0;
                            const tourTotalCollected = fee * countedPlayers;
                            const tourAdminShare = Math.round(tourTotalCollected * 0.10);

                            return (
                              <tr key={t.id} className="hover:bg-slate-800/40">
                                <td className="p-2.5 font-bold text-white flex items-center gap-2">
                                  <img src={t.image} alt="" className="w-6 h-6 rounded-md object-cover border border-slate-700" />
                                  <span>{t.tournamentName}</span>
                                </td>
                                <td className="p-2.5 text-center font-mono text-slate-300">{t.registrationFee || 'Free'}</td>
                                <td className="p-2.5 text-center font-bold text-amber-300">{players.length}</td>
                                <td className="p-2.5 text-right font-mono font-bold text-white">{tourTotalCollected.toLocaleString()} ETB</td>
                                <td className="p-2.5 text-right font-mono font-black text-emerald-400">{tourAdminShare.toLocaleString()} ETB</td>
                                <td className="p-2.5 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-750">
                                    {t.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: REGISTRATION REQUESTS */}
            {activeTab === 'registration_requests' && (
              <div className="space-y-4">
                <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search player, tournament, or organizer..."
                      value={regSearchTerm}
                      onChange={(e) => setRegSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-750 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-750">
                    {(['PENDING_APPROVAL', 'ALL', 'CONFIRMED', 'REJECTED'] as const).map((filterVal) => (
                      <button
                        key={filterVal}
                        onClick={() => setRegFilter(filterVal)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          regFilter === filterVal
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {filterVal === 'PENDING_APPROVAL'
                          ? 'Pending'
                          : filterVal === 'CONFIRMED'
                          ? 'Approved'
                          : filterVal === 'REJECTED'
                          ? 'Rejected'
                          : 'All'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-850 border border-slate-750 rounded-2xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-750 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          <th className="p-3">Player</th>
                          <th className="p-3">Tournament</th>
                          <th className="p-3">Organizer</th>
                          <th className="p-3">Submitted At</th>
                          <th className="p-3 text-center">Payment Screenshot</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {(() => {
                          const allTours = db.getTournaments();
                          const submissions = allTours.flatMap((t) => {
                            const players = db.getTournamentPlayers(t.id);
                            const org = db.getUserById(t.organizerId);
                            return players
                              .filter((p) => p.paymentProofUrl || p.paymentStatus)
                              .map((p) => ({
                                tournament: t,
                                playerRecord: p,
                                userObj: p.user || db.getUserById(p.userId),
                                organizerName: org?.name || 'Organizer',
                              }));
                          });

                          const filtered = submissions.filter((r) => {
                            if (regFilter !== 'ALL' && r.playerRecord.paymentStatus !== regFilter) {
                              return false;
                            }
                            if (regSearchTerm.trim()) {
                              const q = regSearchTerm.toLowerCase();
                              const pName = (r.userObj?.name || r.playerRecord.userId).toLowerCase();
                              const tName = r.tournament.tournamentName.toLowerCase();
                              const oName = r.organizerName.toLowerCase();
                              return pName.includes(q) || tName.includes(q) || oName.includes(q);
                            }
                            return true;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                                  No registration requests found.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((req) => (
                            <tr key={`${req.tournament.id}-${req.playerRecord.userId}`} className="hover:bg-slate-800/40">
                              <td className="p-3 font-bold text-white flex items-center gap-2">
                                <img
                                  src={req.userObj?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                  alt=""
                                  className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                                />
                                <div>
                                  <p className="font-bold text-white leading-tight">{req.userObj?.name || req.playerRecord.userId}</p>
                                  <p className="text-[10px] text-slate-400 font-normal">@{req.userObj?.username || 'player'}</p>
                                </div>
                              </td>
                              <td className="p-3">
                                <p className="font-bold text-slate-200">{req.tournament.tournamentName}</p>
                                <p className="text-[10px] text-amber-400 font-mono">{req.tournament.registrationFee || 'Free'}</p>
                              </td>
                              <td className="p-3 text-slate-300 font-medium">
                                {req.organizerName}
                              </td>
                              <td className="p-3 font-mono text-slate-400 text-[11px]">
                                {req.playerRecord.paymentSubmittedAt
                                  ? new Date(req.playerRecord.paymentSubmittedAt).toLocaleDateString()
                                  : req.playerRecord.registrationDate
                                  ? new Date(req.playerRecord.registrationDate).toLocaleDateString()
                                  : 'Today'}
                              </td>
                              <td className="p-3 text-center">
                                {req.playerRecord.paymentProofUrl ? (
                                  <button
                                    onClick={() => setPreviewScreenshotUrl(req.playerRecord.paymentProofUrl || null)}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold border border-slate-700 flex items-center gap-1 mx-auto transition-all active:scale-95"
                                  >
                                    <Eye className="w-3 h-3 text-amber-400" /> View Screenshot
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">No proof uploaded</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {req.playerRecord.paymentStatus === 'CONFIRMED' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Approved
                                  </span>
                                ) : req.playerRecord.paymentStatus === 'REJECTED' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    Rejected
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {req.playerRecord.paymentProofUrl && (
                                    <button
                                      onClick={() => setPreviewScreenshotUrl(req.playerRecord.paymentProofUrl || null)}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                                      title="View Screenshot"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-slate-300" />
                                    </button>
                                  )}
                                  <button
                                    onClick={async () => {
                                      await db.updatePaymentStatus(req.tournament.id, req.playerRecord.userId, 'CONFIRMED');
                                      setUserActionMsg(`Approved payment for ${req.userObj?.name || 'player'}`);
                                    }}
                                    disabled={req.playerRecord.paymentStatus === 'CONFIRMED'}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                                      req.playerRecord.paymentStatus === 'CONFIRMED'
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 active:scale-95'
                                    }`}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await db.updatePaymentStatus(req.tournament.id, req.playerRecord.userId, 'REJECTED');
                                      setUserActionMsg(`Rejected payment for ${req.userObj?.name || 'player'}`);
                                    }}
                                    disabled={req.playerRecord.paymentStatus === 'REJECTED'}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                                      req.playerRecord.paymentStatus === 'REJECTED'
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 active:scale-95'
                                    }`}
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL: ADD NEW USER */}
        {showAddUserModal && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-750 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-750 pb-3">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  Add New Competitor or Organizer
                </h3>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-bold text-xs mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Samuel Vance"
                    className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 font-bold text-xs mb-1">Username</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. samuel_vance"
                      className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold text-xs mb-1">
                      Telegram ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={newTgId}
                      onChange={(e) => setNewTgId(e.target.value)}
                      placeholder="e.g. 99482019"
                      className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold text-xs mb-1">User Role *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="PLAYER">Competitor (Player)</option>
                    <option value="ORGANIZER font-bold">Tournament Organizer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold text-xs mb-1">Gamertag</label>
                  <input
                    type="text"
                    value={newGamertag}
                    onChange={(e) => setNewGamertag(e.target.value)}
                    placeholder="e.g. @vance_esports"
                    className="w-full bg-slate-950 border border-slate-750 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-md"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: USER PROFILE DETAILS */}
        {selectedUserForDetail && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-750 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
              <button
                onClick={() => setSelectedUserForDetail(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <img
                  src={selectedUserForDetail.profileImage}
                  alt={selectedUserForDetail.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-amber-400"
                />
                <div>
                  <h3 className="text-lg font-black text-white">{selectedUserForDetail.name}</h3>
                  <span className="inline-block mt-0.5 px-2.5 py-0.5 text-[10px] font-black uppercase rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Role: {selectedUserForDetail.role}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Rating / ELO</span>
                  <span className="font-extrabold text-amber-300 text-sm">{selectedUserForDetail.rating || 1200} ELO</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Joined Date</span>
                  <span className="font-extrabold text-slate-200">
                    {selectedUserForDetail.createdAt ? new Date(selectedUserForDetail.createdAt).toLocaleDateString() : 'Jan 2026'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Telegram Info</span>
                  <span className="font-mono font-bold text-sky-300">
                    @{selectedUserForDetail.username || 'N/A'} (ID: {selectedUserForDetail.telegramUserId})
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Phone Number</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {selectedUserForDetail.phoneNumber ||
                     db.getOrganizerTournaments(selectedUserForDetail.id).find((t) => t.telebirrNumber)?.telebirrNumber ||
                     'N/A'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 col-span-2">
                  <span className="text-[10px] text-slate-400 block font-bold">Gamertag</span>
                  <span className="font-bold text-slate-200">{selectedUserForDetail.gamertag || 'N/A'}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 col-span-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tournaments Created:</span>
                    <span className="font-bold text-white">
                      {db.getOrganizerTournaments(selectedUserForDetail.id).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tournaments Joined:</span>
                    <span className="font-bold text-white">
                      {db.getTournaments().filter((t) =>
                        db.getTournamentPlayers(t.id).some((p) => p.userId === selectedUserForDetail.id)
                      ).length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForDetail(null)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl text-xs"
                >
                  Close Profile Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: WITHDRAWAL REQUEST DETAILS (Requirement 4D) */}
        {selectedWithdrawalRequestDetail && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-750 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
              <button
                onClick={() => setSelectedWithdrawalRequestDetail(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="border-b border-slate-800 pb-3">
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold rounded-full uppercase border border-emerald-500/30">
                  Withdrawal Request Details
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  Request #{selectedWithdrawalRequestDetail.id.slice(-6)}
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Organizer Name:</span>
                  <span
                    onClick={() => {
                      const orgUser = db.getUserById(selectedWithdrawalRequestDetail.organizerId) || allUsers.find((u) => u.name === selectedWithdrawalRequestDetail.organizerName);
                      if (orgUser) {
                        setSelectedWithdrawalRequestDetail(null);
                        setSelectedUserForDetail(orgUser);
                      }
                    }}
                    className="font-extrabold text-amber-300 underline cursor-pointer hover:text-amber-200"
                    title="Click to view Organizer Profile"
                  >
                    {selectedWithdrawalRequestDetail.organizerName}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Requested Amount:</span>
                  <span className="font-black text-emerald-400 text-sm">
                    {selectedWithdrawalRequestDetail.amount.toLocaleString()} ETB
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Submitted Payout Credentials</p>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Telebirr Name:</span>
                    <span className="font-bold text-white">
                      {selectedWithdrawalRequestDetail.telebirrName ||
                       (selectedWithdrawalRequestDetail.reason?.match(/Telebirr:\s*([^(]+)/)?.[1]?.trim()) ||
                       'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Telebirr Number:</span>
                    <span className="font-mono font-bold text-amber-300">
                      {selectedWithdrawalRequestDetail.telebirrNumber ||
                       (selectedWithdrawalRequestDetail.reason?.match(/\(([^)]+)\)/)?.[1]?.trim()) ||
                       'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Request Date:</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {new Date(selectedWithdrawalRequestDetail.requestedAt).toLocaleString()}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Current Status:</span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      selectedWithdrawalRequestDetail.status === 'Paid'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : selectedWithdrawalRequestDetail.status === 'Rejected'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {selectedWithdrawalRequestDetail.status}
                  </span>
                </div>
              </div>

              {selectedWithdrawalRequestDetail.status === 'Pending Approval' ? (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={async () => {
                      await db.approveWithdrawalRequest(selectedWithdrawalRequestDetail.id);
                      setUserActionMsg(
                        `Approved withdrawal request of ${selectedWithdrawalRequestDetail.amount} ETB for ${selectedWithdrawalRequestDetail.organizerName}!`
                      );
                      setSelectedWithdrawalRequestDetail(null);
                      setTimeout(() => setUserActionMsg(''), 4000);
                    }}
                    className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        window.confirm(
                          `Reject withdrawal request of ${selectedWithdrawalRequestDetail.amount} ETB for ${selectedWithdrawalRequestDetail.organizerName}?`
                        )
                      ) {
                        await db.rejectWithdrawalRequest(selectedWithdrawalRequestDetail.id);
                        setUserActionMsg(
                          `Rejected withdrawal request for ${selectedWithdrawalRequestDetail.organizerName}.`
                        );
                        setSelectedWithdrawalRequestDetail(null);
                        setTimeout(() => setUserActionMsg(''), 4000);
                      }
                    }}
                    className="py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/30"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedWithdrawalRequestDetail(null)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Close Details
                </button>
              )}
            </div>
          </div>
        )}

        {/* MODAL: TOURNAMENT DETAILS */}
        {selectedTourForDetail && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-750 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
              <button
                onClick={() => setSelectedTourForDetail(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <img
                  src={selectedTourForDetail.image}
                  alt={selectedTourForDetail.tournamentName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400"
                />
                <div>
                  <h3 className="text-base font-extrabold text-white">{selectedTourForDetail.tournamentName}</h3>
                  <span className="inline-block mt-0.5 px-2.5 py-0.5 text-[10px] font-black uppercase rounded-md bg-slate-800 text-amber-300 border border-slate-700">
                    Status: {selectedTourForDetail.status}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Organizer:</span>
                    <span className="font-extrabold text-white">
                      {db.getUserById(selectedTourForDetail.organizerId)?.name || 'System Organizer'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Organizer Phone:</span>
                    <span className="font-extrabold text-slate-200 font-mono">
                      {db.getUserById(selectedTourForDetail.organizerId)?.phoneNumber || selectedTourForDetail.telebirrNumber || 'Not Specified'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Game:</span>
                    <span className="font-extrabold text-sky-400">{selectedTourForDetail.game}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Venue:</span>
                    <span className="font-bold text-slate-200">
                      {selectedTourForDetail.venueName || 'Not Specified'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Location:</span>
                    <span className="font-bold text-slate-200">
                      {selectedTourForDetail.venueLocation || selectedTourForDetail.venueName || 'Not Specified'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Entry Fee:</span>
                    <span className="font-extrabold text-emerald-400">{selectedTourForDetail.registrationFee || 'Free'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Registered Players:</span>
                    <span className="font-bold text-amber-300">
                      {db.getTournamentPlayers(selectedTourForDetail.id).length} / {selectedTourForDetail.maxPlayers}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tournament Award:</span>
                    <span className="font-bold text-amber-300">
                      {selectedTourForDetail.award || selectedTourForDetail.prizePool || 'Not Specified'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-850">
                    <span className="text-slate-400">Tournament Banner:</span>
                    {selectedTourForDetail.image ? (
                      <img
                        src={selectedTourForDetail.image}
                        alt="Tournament Banner"
                        className="w-12 h-8 rounded object-cover border border-slate-700"
                      />
                    ) : (
                      <span className="font-bold text-slate-400">Not Specified</span>
                    )}
                  </div>
                </div>
              </div>

              {/* PAYMENT DESTINATION SECTION */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    Payment Destination
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {selectedTourForDetail.isApproved ? 'Assigned & Locked' : 'Required before Approval'}
                  </span>
                </div>

                {!selectedTourForDetail.isApproved ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Telebirr Account Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={adminTeleName}
                        onChange={(e) => {
                          setAdminTeleName(e.target.value);
                          if (adminApprovalError) setAdminApprovalError('');
                        }}
                        placeholder="e.g. Abebe Bikila"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-xl text-white focus:outline-none focus:border-amber-400 text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Telebirr Phone Number <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={adminTeleNumber}
                        onChange={(e) => {
                          setAdminTeleNumber(e.target.value);
                          if (adminApprovalError) setAdminApprovalError('');
                        }}
                        placeholder="e.g. 0911223344"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-xl text-white focus:outline-none focus:border-amber-400 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">Telebirr Name</span>
                      <span className="font-extrabold text-white">
                        {selectedTourForDetail.telebirrAccountName || selectedTourForDetail.telebirrName || 'Not Set'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">Telebirr Number</span>
                      <span className="font-extrabold text-amber-300 font-mono">
                        {selectedTourForDetail.telebirrNumber || 'Not Set'}
                      </span>
                    </div>
                  </div>
                )}

                {adminApprovalError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{adminApprovalError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                {!selectedTourForDetail.isApproved && (
                  <button
                    type="button"
                    onClick={() => handleApproveTournamentWithValidation(selectedTourForDetail)}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve & Publish
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedTourForDetail(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PREVIEW SCREENSHOT MODAL */}
        {previewScreenshotUrl && (
          <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-750 rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-2xl relative text-center">
              <button
                onClick={() => setPreviewScreenshotUrl(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-800 border border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-extrabold text-white text-left flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                Payment Proof Screenshot
              </h3>
              <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 max-h-[65vh] flex items-center justify-center p-2">
                <img
                  src={previewScreenshotUrl}
                  alt="Payment Proof"
                  className="max-h-[60vh] w-auto object-contain rounded-lg"
                />
              </div>
              <button
                onClick={() => setPreviewScreenshotUrl(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
