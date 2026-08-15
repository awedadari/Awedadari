import React, { useState, useEffect } from 'react';
import { Send, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useDbStore } from './hooks/useDbStore';
import { NavTab, Tournament } from './types';
import { db } from './services/db';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { TelegramBotModal } from './components/TelegramBotModal';
import { AdminPortalModal } from './components/admin/AdminPortalModal';
import { telegramService, TELEGRAM_BOT_DEFAULT } from './services/telegramService';

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
  const { activeUser, loading, tournaments } = useDbStore();
  const [authStatus, setAuthStatus] = useState<'AUTHENTICATING' | 'AUTHENTICATED' | 'AUTH_ERROR'>('AUTHENTICATING');
  const [authErrorMessage, setAuthErrorMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [organizerPanelSubTab, setOrganizerPanelSubTab] = useState<
    'tournaments' | 'create_tour' | 'players' | 'matches' | 'results' | 'progress'
  >('tournaments');
  const [isTelegramBotModalOpen, setIsTelegramBotModalOpen] = useState(false);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [selectedTournamentForOverview, setSelectedTournamentForOverview] = useState<Tournament | null>(null);
  const [handledDeepLink, setHandledDeepLink] = useState(false);

  const isInsideTelegram = telegramService.isInsideTelegram();

  const handleSelectTournament = (t: Tournament) => {
    setSelectedTournamentForOverview(t);
    handleTabChange('tournaments');
  };

  // Cryptographically authenticate when opened inside Telegram WebApp
  useEffect(() => {
    if (!isInsideTelegram) {
      setAuthStatus('AUTH_ERROR');
      return;
    }

    let isMounted = true;
    setAuthStatus('AUTHENTICATING');

    telegramService
      .autoAuthenticateWithTelegram()
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setAuthStatus('AUTHENTICATED');
        } else {
          setAuthStatus('AUTH_ERROR');
          setAuthErrorMessage(res.error || 'Could not verify your Telegram account.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setAuthStatus('AUTH_ERROR');
        setAuthErrorMessage(err?.message || 'Authentication failed.');
      });

    return () => {
      isMounted = false;
    };
  }, [isInsideTelegram]);

  const handleRetryAuth = () => {
    setAuthStatus('AUTHENTICATING');
    setAuthErrorMessage('');
    telegramService
      .autoAuthenticateWithTelegram()
      .then((res) => {
        if (res.success) {
          setAuthStatus('AUTHENTICATED');
        } else {
          setAuthStatus('AUTH_ERROR');
          setAuthErrorMessage(res.error || 'Could not verify your Telegram account.');
        }
      })
      .catch((err) => {
        setAuthStatus('AUTH_ERROR');
        setAuthErrorMessage(err?.message || 'Authentication failed.');
      });
  };

  // Handle Telegram Direct Mini App startapp deep links (e.g. startapp=tour_1786298912734)
  useEffect(() => {
    if (handledDeepLink) return;

    const startParam = telegramService.getStartParam();
    if (!startParam) {
      setHandledDeepLink(true);
      return;
    }

    const foundTour = db.getTournamentByStartParam(startParam);
    if (foundTour) {
      setSelectedTournamentForOverview(foundTour);
      setActiveTab('tournaments');
      setHandledDeepLink(true);
    } else if (!loading && (tournaments.length > 0 || db.getTournaments().length > 0)) {
      // Data finished loading and tournament list is populated, but requested tournament was not found - fallback gracefully
      setHandledDeepLink(true);
    }
  }, [loading, tournaments, handledDeepLink]);

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

  // 1. Outside Telegram Guard
  if (!isInsideTelegram) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-sky-500 selection:text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center mx-auto border border-sky-500/30">
            <Send className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-100">Telegram Mini App</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              This app is designed to be used inside Telegram.
              <br />
              Please open it through the Awedadari Telegram Mini App.
            </p>
          </div>
          <a
            href={`https://t.me/${TELEGRAM_BOT_DEFAULT.botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold rounded-2xl transition-all shadow-lg text-sm"
          >
            <span>Open in Telegram</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  // 2. Cryptographic Authentication In-Progress State (Neutral, no mock identity)
  if (authStatus === 'AUTHENTICATING' || (!activeUser && authStatus !== 'AUTH_ERROR')) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-sky-500 selection:text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-widest text-sky-400">AUTHENTICATING</div>
            <h2 className="text-base font-bold text-slate-100">Verifying Telegram account...</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Securing cryptographic session with Telegram.
            </p>
          </div>
          <div className="flex justify-center pt-2">
            <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // 3. Authentication Failed State
  if (authStatus === 'AUTH_ERROR' && !activeUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-sky-500 selection:text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-red-500/20 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-100">Verification Required</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {authErrorMessage || 'Could not verify your Telegram signature. Please reopen the Mini App from Telegram or try again.'}
            </p>
          </div>
          <button
            onClick={handleRetryAuth}
            className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold rounded-2xl transition-all shadow-lg text-sm active:scale-95"
          >
            Retry Verification
          </button>
        </div>
      </div>
    );
  }

  // Absolute safety check: Never render user-scoped UI if activeUser is null
  if (!activeUser) {
    return null;
  }

  // If role is switched from Organizer to Player while on 'organizer_panel', fallback to 'home'
  if (activeUser.role === 'PLAYER' && activeTab === 'organizer_panel') {
    setActiveTab('home');
  }

  // If role is ORGANIZER and activeTab is 'tournaments', redirect to 'organizer_panel' unless viewing a specific tournament overview
  if (activeUser.role === 'ORGANIZER' && activeTab === 'tournaments' && !selectedTournamentForOverview) {
    setActiveTab('organizer_panel');
  }

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
                selectedTournamentForOverview ? (
                  <PlayerTournamentCenter
                    user={activeUser}
                    initialTournament={selectedTournamentForOverview}
                  />
                ) : (
                  <OrganizerTournamentCenter
                    user={activeUser}
                    onOpenPanelWithTab={handleOpenPanelWithTab}
                  />
                )
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
