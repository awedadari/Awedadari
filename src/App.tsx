import React, { useState, useEffect } from 'react';
import { useDbStore } from './hooks/useDbStore';
import { NavTab, Tournament } from './types';
import { db } from './services/db';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { TelegramBotModal } from './components/TelegramBotModal';
import { AdminPortalModal } from './components/admin/AdminPortalModal';
import { telegramService } from './services/telegramService';

// Player Views
import { PlayerHome } from './components/player/PlayerHome';
import { PlayerTournamentCenter } from './components/player/PlayerTournamentCenter';
import { PlayerProfile } from './components/player/PlayerProfile';
import { PlayersLeaderboardView } from './components/player/PlayersLeaderboardView';

// Organizer Views
import { OrganizerHome } from './components/organizer/OrganizerHome';
import { OrganizerTournamentCenter } from './components/organizer/OrganizerTournamentCenter';
import { OrganizerPanel } from './components/organizer/OrganizerPanel';
import { OrganizerProfile } from './components/organizer/OrganizerProfile';

export default function App() {
  const { activeUser, loading } = useDbStore();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [organizerPanelSubTab, setOrganizerPanelSubTab] = useState<
    'tournaments' | 'create_tour' | 'players' | 'matches' | 'results' | 'progress'
  >('tournaments');
  const [isTelegramBotModalOpen, setIsTelegramBotModalOpen] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [selectedTournamentForOverview, setSelectedTournamentForOverview] = useState<Tournament | null>(null);

  const handleSelectTournament = (t: Tournament) => {
    setSelectedTournamentForOverview(t);
    handleTabChange('tournaments');
  };

  // Auto-authenticate when opened inside Telegram WebApp
  useEffect(() => {
    telegramService.autoAuthenticateWithTelegram().catch((err) => {
      console.warn('Telegram auto-authentication notice:', err);
    });
  }, []);

  // If role is switched from Organizer to Player while on 'organizer_panel', fallback to 'home'
  if (activeUser.role === 'PLAYER' && activeTab === 'organizer_panel') {
    setActiveTab('home');
  }

  // If role is ORGANIZER and activeTab is 'tournaments', redirect to 'organizer_panel'
  if (activeUser.role === 'ORGANIZER' && activeTab === 'tournaments') {
    setActiveTab('organizer_panel');
  }

  const handleOpenPanelWithTab = (
    subTab: 'create_tour' | 'players' | 'matches' | 'results' | 'progress'
  ) => {
    setOrganizerPanelSubTab(subTab);
    setActiveTab('organizer_panel');
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    telegramService.triggerHaptic('light');
  };

  const handleLogout = () => {
    db.logout();
    setActiveTab('home');
    telegramService.triggerHaptic('warning');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-sky-500 selection:text-white flex justify-center">
      {/* Mobile-First Shell (telegram mini app layout) */}
      <div className="w-full max-w-md sm:max-w-xl min-h-screen bg-slate-900 flex flex-col border-x border-slate-800 shadow-2xl relative">
        {/* Telegram Header */}
        <Header
          activeUser={activeUser}
          loading={loading}
          onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
        />

        {/* Viewport Content Area */}
        <main className="flex-1 px-4 pt-4 overflow-y-auto">
          {activeUser.role === 'PLAYER' ? (
            <>
              {activeTab === 'home' && (
                <PlayerHome
                  user={activeUser}
                  onNavigateToTournaments={() => handleTabChange('tournaments')}
                  onNavigateToProfile={() => handleTabChange('profile')}
                  onNavigateToPlayers={() => handleTabChange('players')}
                  onSelectTournament={handleSelectTournament}
                />
              )}
              {activeTab === 'tournaments' && (
                <PlayerTournamentCenter
                  user={activeUser}
                  initialTournament={selectedTournamentForOverview}
                />
              )}
              {activeTab === 'players' && (
                <PlayersLeaderboardView currentUser={activeUser} />
              )}
              {activeTab === 'profile' && <PlayerProfile user={activeUser} />}
            </>
          ) : (
            <>
              {activeTab === 'home' && (
                <OrganizerHome
                  user={activeUser}
                  onNavigateToPanel={handleOpenPanelWithTab}
                  onNavigateToTournaments={() => handleTabChange('tournaments')}
                />
              )}
              {activeTab === 'tournaments' && (
                <OrganizerTournamentCenter
                  user={activeUser}
                  onOpenPanelWithTab={handleOpenPanelWithTab}
                />
              )}
              {activeTab === 'players' && (
                <PlayersLeaderboardView currentUser={activeUser} />
              )}
              {activeTab === 'organizer_panel' && (
                <OrganizerPanel
                  user={activeUser}
                  initialSubTab={organizerPanelSubTab}
                />
              )}
              {activeTab === 'profile' && <OrganizerProfile user={activeUser} />}
            </>
          )}
        </main>

        {/* Telegram Bottom Navigation */}
        <BottomNav
          role={activeUser.role}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* Admin Portal Modal */}
        <AdminPortalModal
          isOpen={isAdminPortalOpen}
          onClose={() => setIsAdminPortalOpen(false)}
        />

        {/* Telegram Bot & Auth Setup Center Modal */}
        <TelegramBotModal
          isOpen={isTelegramBotModalOpen}
          onClose={() => setIsTelegramBotModalOpen(false)}
          activeUser={activeUser}
        />
      </div>
    </div>
  );
}
