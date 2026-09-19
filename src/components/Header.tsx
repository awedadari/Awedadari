import React from 'react';
import { User } from '../types';
import { ShieldCheck, LogOut } from 'lucide-react';
import { auth, db } from '../services/db';

interface HeaderProps {
  activeUser: User;
  loading?: boolean;
  onOpenAdminPortal?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeUser,
  loading,
  onOpenAdminPortal,
  onLogout,
}) => {
  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.warn('Firebase signout warning:', err);
    }
    db.logout();
    if (onLogout) {
      onLogout();
    }
  };
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md">
      {/* Main Header User Profile Bar */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        {/* Active User Info Display */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src={activeUser.profileImage}
              alt={activeUser.name}
              className="w-9 h-9 rounded-full object-cover border-2 border-sky-500/40 shadow-sm"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                activeUser.role === 'ORGANIZER' ? 'bg-amber-400' : 'bg-sky-400'
              }`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm text-slate-100 leading-tight truncate">
                {activeUser.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-sky-400 font-mono truncate">@{activeUser.username}</span>
              <span
                className={`text-[8px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider shrink-0 ${
                  activeUser.role === 'ORGANIZER'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                }`}
              >
                {activeUser.role}
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: Admin Portal & Web Sign Out */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenAdminPortal && (
            <button
              onClick={onOpenAdminPortal}
              className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-amber-300 border border-slate-700 rounded-xl transition-all shadow-xs active:scale-95 flex items-center gap-1 text-[11px] font-bold"
              title="Open Admin Control Portal"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-400 border border-slate-700 rounded-xl transition-all shadow-xs active:scale-95 flex items-center gap-1 text-[11px] font-bold"
            title="Sign Out of AwedAdari"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};


