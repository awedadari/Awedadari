import React from 'react';
import { NavTab, UserRole } from '../types';
import { Home, Trophy, Users, Settings, User } from 'lucide-react';
import { telegramService } from '../services/telegramService';

interface BottomNavProps {
  role: UserRole;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ role, activeTab, onTabChange }) => {
  const handleNavClick = (tab: NavTab) => {
    onTabChange(tab);
    telegramService.triggerHaptic('light');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-3 py-1.5 max-w-md mx-auto sm:max-w-xl pb-safe">
      <div className="flex items-center justify-around">
        {/* Home */}
        <button
          onClick={() => handleNavClick('home')}
          className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] px-3 py-1.5 rounded-2xl transition-all active:scale-95 ${
            activeTab === 'home'
              ? 'text-sky-400 font-bold bg-sky-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {activeTab === 'home' && (
            <span className="absolute -top-1.5 w-6 h-1 bg-sky-400 rounded-full shadow-xs shadow-sky-400/50" />
          )}
          <Home className="w-5 h-5" />
          <span className="text-[11px] font-semibold">Home</span>
        </button>

        {/* Tournament Center (ONLY for PLAYER role) */}
        {role !== 'ORGANIZER' && (
          <button
            onClick={() => handleNavClick('tournaments')}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] px-3 py-1.5 rounded-2xl transition-all active:scale-95 ${
              activeTab === 'tournaments'
                ? 'text-sky-400 font-bold bg-sky-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeTab === 'tournaments' && (
              <span className="absolute -top-1.5 w-6 h-1 bg-sky-400 rounded-full shadow-xs shadow-sky-400/50" />
            )}
            <Trophy className="w-5 h-5" />
            <span className="text-[11px] font-semibold">Tournaments</span>
          </button>
        )}

        {/* Players Leaderboard Tab */}
        <button
          onClick={() => handleNavClick('players')}
          className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] px-3 py-1.5 rounded-2xl transition-all active:scale-95 ${
            activeTab === 'players'
              ? 'text-emerald-400 font-bold bg-emerald-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {activeTab === 'players' && (
            <span className="absolute -top-1.5 w-6 h-1 bg-emerald-400 rounded-full shadow-xs shadow-emerald-400/50" />
          )}
          <Users className="w-5 h-5" />
          <span className="text-[11px] font-semibold">Players</span>
        </button>

        {/* Organizer Panel (ONLY for ORGANIZER role) */}
        {role === 'ORGANIZER' && (
          <button
            onClick={() => handleNavClick('organizer_panel')}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] px-3 py-1.5 rounded-2xl transition-all active:scale-95 ${
              activeTab === 'organizer_panel'
                ? 'text-amber-400 font-bold bg-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeTab === 'organizer_panel' && (
              <span className="absolute -top-1.5 w-6 h-1 bg-amber-400 rounded-full shadow-xs shadow-amber-400/50" />
            )}
            <Settings className="w-5 h-5" />
            <span className="text-[11px] font-semibold">Manage</span>
          </button>
        )}

        {/* Profile */}
        <button
          onClick={() => handleNavClick('profile')}
          className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] px-3 py-1.5 rounded-2xl transition-all active:scale-95 ${
            activeTab === 'profile'
              ? 'text-sky-400 font-bold bg-sky-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {activeTab === 'profile' && (
            <span className="absolute -top-1.5 w-6 h-1 bg-sky-400 rounded-full shadow-xs shadow-sky-400/50" />
          )}
          <User className="w-5 h-5" />
          <span className="text-[11px] font-semibold">Profile</span>
        </button>
      </div>
    </nav>
  );
};

