import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSettings } from '../hooks/useSettings';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Database,
  Upload,
  Clock,
  BarChart3,
  SquarePen,
  LogOut,
  Menu,
  X,
  TerminalSquare,
  MessagesSquare,
  UserCircle,
  ChevronUp,
  Settings,
  Bookmark,
  Search,
  BrainCircuit,
  ChevronsUp,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  FileCode2,
  LayoutDashboard,
  Clock3,
  BadgeCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import ModelSwitcher from './ModelSwitcher';
import ThemeSwitcher from './ThemeSwitcher';
import ProfileModal from './ProfileModal';
import UsageModal from './UsageModal';
import SettingsModal from './SettingsModal';
import ShortcutOverlay from './ShortcutOverlay';
import OnboardingChecklist from './OnboardingChecklist';
import { getSessions, checkHealth, getNotificationPrefs, type SessionListResponse } from '../api/client';
import { setInAppNotificationsEnabled } from './ui/toast';

/** A single session row as returned by the sessions list endpoint. */
type SessionSummary = SessionListResponse['sessions'][number];
import { useAuth } from '../context/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', end: true, icon: Database, label: 'Query' },
  { to: '/schema', end: false, icon: Upload, label: 'Schema' },
  { to: '/history', end: false, icon: Clock, label: 'History' },
  { to: '/analytics', end: false, icon: BarChart3, label: 'Analytics' },
  { to: '/saved', end: false, icon: Bookmark, label: 'Saved' },
  { to: '/dashboards', end: false, icon: LayoutDashboard, label: 'Dashboards' },
  { to: '/schedules', end: false, icon: Clock3, label: 'Schedules' },
  { to: '/metrics', end: false, icon: BadgeCheck, label: 'Metrics' },
  { to: '/templates', end: false, icon: FileCode2, label: 'Templates' },
  { to: '/training', end: false, icon: BrainCircuit, label: 'Training' },
];

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Query Studio', subtitle: 'Ask your database in plain English' },
  '/schema': { title: 'Schema', subtitle: 'Connections, ingestion & live sync' },
  '/history': { title: 'History', subtitle: 'Past sessions & conversations' },
  '/analytics': { title: 'Analytics', subtitle: 'Usage, accuracy & performance' },
  '/saved': { title: 'Saved Queries', subtitle: 'Your bookmarked SQL queries' },
  '/dashboards': { title: 'Dashboards', subtitle: 'Auto-charted views of your data' },
  '/schedules': { title: 'Scheduled Queries', subtitle: 'Recurring questions with email alerts' },
  '/metrics': { title: 'Metrics Catalog', subtitle: 'Governed business metrics for this connection' },
  '/templates': { title: 'Query Templates', subtitle: 'Parameterized SQL patterns' },
  '/training': { title: 'Model Training', subtitle: 'Fine-tune on your query history' },
  '/help': { title: 'Help', subtitle: 'Documentation, shortcuts & FAQ' },
};

interface SessionGroup {
  label: string;
  sessions: SessionSummary[];
}

function groupByDate(sessions: SessionSummary[]): SessionGroup[] {
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayMs = todayMs - 86_400_000;
  const weekMs = todayMs - 7 * 86_400_000;
  const monthMs = todayMs - 30 * 86_400_000;

  const buckets: Record<string, typeof sessions> = {
    'Today': [],
    'Yesterday': [],
    'Previous 7 days': [],
    'Previous 30 days': [],
    'Older': [],
  };

  for (const s of sessions) {
    const d = new Date(s.updated_at || s.created_at);
    const dayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (dayMs >= todayMs) buckets['Today'].push(s);
    else if (dayMs >= yesterdayMs) buckets['Yesterday'].push(s);
    else if (d.getTime() >= weekMs) buckets['Previous 7 days'].push(s);
    else if (d.getTime() >= monthMs) buckets['Previous 30 days'].push(s);
    else buckets['Older'].push(s);
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, sessions]) => ({ label, sessions }));
}

const COLLAPSED_W = 64;
const DEFAULT_W = 260;
const MIN_W = 200;
const MAX_W = 420;

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { settings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-font-size', settings.font_size);
    root.setAttribute('data-density', settings.ui_density);
  }, [settings.font_size, settings.ui_density]);

  // Desktop: collapsed to icon strip
  const [collapsed, setCollapsed] = useState(false);
  // Desktop: resizable width
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_W);
  const [isResizing, setIsResizing] = useState(false);
  // Mobile: overlay open
  const [mobileOpen, setMobileOpen] = useState(false);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const sessionsScrollRef = useRef<HTMLDivElement>(null);
  const isQueryPage = location.pathname === '/';

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cursor override while resizing
  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Deep-link support: /settings redirects home with state so the popup opens
  // (settings is a modal now, not a page). Clear the flag so Back doesn't reopen.
  useEffect(() => {
    const st = location.state as { openSettings?: boolean } | null;
    if (st?.openSettings) {
      setSettingsOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Global "Alt+N" → new chat (documented in Help). Ignored while typing.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
        e.preventDefault();
        navigate('/', { state: { newChat: true } });
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = sidebarWidth;
      setIsResizing(true);

      const onMove = (ev: MouseEvent) => {
        setSidebarWidth(Math.min(MAX_W, Math.max(MIN_W, startW + (ev.clientX - startX))));
      };
      const onUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [sidebarWidth],
  );

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions', 'recent'],
    queryFn: () => getSessions(50, 0),
    refetchInterval: 30_000,
    enabled: !!user,
    retry: false,
  });

  const { data: isHealthy = true } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 30_000,
    retry: false,
    staleTime: 20_000,
  });

  // Keep the toast layer in sync with the user's In-App Notifications preference.
  // Shares the ['notification-prefs'] cache key with the Settings panel, so
  // toggling it there updates this immediately.
  const { data: notifPrefs } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: getNotificationPrefs,
    enabled: !!user,
    retry: false,
    staleTime: 60_000,
  });
  useEffect(() => {
    setInAppNotificationsEnabled(notifPrefs?.in_app_enabled ?? true);
  }, [notifPrefs?.in_app_enabled]);

  const allSessions = sessionsData?.sessions ?? [];

  const filteredSessions = useMemo(
    () =>
      chatSearch.trim()
        ? allSessions.filter((s) => (s.title ?? '').toLowerCase().includes(chatSearch.toLowerCase()))
        : allSessions,
    [allSessions, chatSearch],
  );

  const sessionGroups = useMemo(() => groupByDate(filteredSessions), [filteredSessions]);

  const handleSessionClick = (session: { id: string }) => {
    navigate('/', { state: { loadSessionId: session.id } });
    setMobileOpen(false);
  };

  const scrollSessionsToTop = () => {
    sessionsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const meta = pageMeta[location.pathname] ?? { title: 'NL-to-SQL', subtitle: 'Query in plain English' };

  // Width: mobile open forces 288, collapsed forces 64, else variable
  const computedWidth = mobileOpen ? 288 : collapsed ? COLLAPSED_W : sidebarWidth;
  // Whether to render icon-only (collapsed) content — never on mobile overlay
  const isIconMode = collapsed && !mobileOpen;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      <aside
        style={{ width: computedWidth, minWidth: computedWidth }}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-border/80 bg-card/88 backdrop-blur-2xl shadow-[4px_0_24px_-4px_rgba(0,0,0,0.4)]',
          'md:static',
          // Mobile: slide in/out
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          // Transition (skip during drag-resize to avoid lag)
          !isResizing ? 'transition-[transform,width] duration-300 ease-in-out' : 'transition-none',
        )}
      >
        {/* ── TOP (fixed) ─────────────────────────────────────── */}
        <div className="shrink-0">
          {/* Logo row — hidden when collapsed on desktop (expand lives in main header) */}
          {!isIconMode && (
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-[0_0_24px_rgba(16,185,129,0.55),0_0_8px_rgba(16,185,129,0.3)] glow-primary-sm">
                  <TerminalSquare className="h-[18px] w-[18px]" strokeWidth={2.4} />
                </div>
                <div className="leading-tight">
                  <p className="font-display text-[14px] font-bold tracking-tight text-foreground">NL-to-SQL</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary/70">SQL Copilot</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Mobile close */}
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground md:hidden"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
                {/* Desktop collapse */}
                <button
                  onClick={() => setCollapsed(true)}
                  title="Collapse sidebar"
                  className="hidden rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors md:flex"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* New Chat */}
          <div className={cn('px-2', isIconMode ? 'flex justify-center pt-3' : 'pt-2')}>
            {isIconMode ? (
              <button
                onClick={() => navigate('/', { state: { newChat: true } })}
                title="New chat"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
              >
                <SquarePen className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => { navigate('/', { state: { newChat: true } }); setMobileOpen(false); }}
                className="flex w-full items-center justify-between rounded-xl border border-primary/30 bg-gradient-to-r from-primary/18 to-primary/10 px-3.5 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-primary/50 hover:from-primary/28 hover:to-primary/18 hover:shadow-[0_0_16px_rgba(16,185,129,0.15)]"
              >
                <span className="flex items-center gap-2.5">
                  <SquarePen className="h-4 w-4 text-primary" />
                  New chat
                </span>
                <kbd className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">New</kbd>
              </button>
            )}
          </div>

          {/* Search */}
          <div className={cn('px-2 pt-1.5 pb-2', isIconMode ? 'flex justify-center' : '')}>
            {isIconMode ? (
              <button
                title="Search chats"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <Search className="h-4 w-4" />
              </button>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  type="text"
                  placeholder="Search chats…"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background/50 py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── MIDDLE (scrollable) ──────────────────────────────── */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Scroll-to-top pill (floats above the scroll area) */}
          {showScrollTop && !isIconMode && (
            <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pt-1.5 pb-1 bg-gradient-to-b from-card/90 to-transparent pointer-events-none">
              <button
                onClick={scrollSessionsToTop}
                className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <ChevronsUp className="h-3 w-3" />
                Scroll to top
              </button>
            </div>
          )}

          <div
            ref={sessionsScrollRef}
            onScroll={() => setShowScrollTop((sessionsScrollRef.current?.scrollTop ?? 0) > 80)}
            className="min-h-0 flex-1 overflow-y-auto custom-scrollbar"
          >
            {/* Nav items */}
            <nav className="px-2 py-2">
              {!isIconMode && (
                <p className="px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/55">
                  Workspace
                </p>
              )}
              <div className={cn('space-y-0.5', isIconMode && 'flex flex-col items-center gap-0.5')}>
                {navItems.map(({ to, end, icon: Icon, label }) => (
                  <NavLink
                    key={label}
                    to={to}
                    end={end}
                    onClick={() => setMobileOpen(false)}
                    title={isIconMode ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                        isIconMode ? 'h-10 w-10 justify-center' : 'w-full px-3 py-2.5',
                        isActive
                          ? 'bg-foreground/[0.07] text-foreground'
                          : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active indicator — bar on left (expanded) or dot on bottom (collapsed) */}
                        {isActive && !isIconMode && (
                          <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.8),0_0_5px_rgba(16,185,129,0.5)]" />
                        )}
                        {isActive && isIconMode && (
                          <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                        )}
                        <Icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0',
                            isActive ? 'text-primary' : 'text-muted-foreground/75 group-hover:text-foreground/80',
                          )}
                        />
                        {!isIconMode && <span>{label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </nav>

            {/* Recent chats (hidden in icon mode) */}
            {!isIconMode && (
              <div className="px-2 pb-4">
                <div className="mt-1 h-px bg-border/50 mb-3 mx-1" />
                {sessionGroups.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground/50">
                    {chatSearch.trim() ? `No chats matching "${chatSearch}"` : 'No recent chats'}
                  </p>
                ) : (
                  sessionGroups.map((group) => (
                    <div key={group.label} className="mb-4">
                      <p className="px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.sessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => handleSessionClick(session)}
                            className="group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                          >
                            <MessagesSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35 transition-colors group-hover:text-muted-foreground/60" />
                            <span className="truncate leading-snug">{session.title ?? 'New Chat'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM (fixed) ──────────────────────────────────── */}
        <div className="shrink-0 border-t border-border/60">
          {/* Onboarding checklist (expanded only) */}
          {!isIconMode && <OnboardingChecklist />}

          {/* Theme switcher (expanded only) */}
          {!isIconMode && (
            <div className="px-3 py-2">
              <ThemeSwitcher />
            </div>
          )}

          {/* Profile / user menu */}
          <div ref={userMenuRef} className="relative p-2">
            {/* Popover menu */}
            {userMenuOpen && (
              <div className={cn(
                'absolute overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_8px_40px_-8px_rgba(0,0,0,0.55)] animate-slide-up z-50',
                isIconMode
                  ? 'left-full bottom-0 ml-2 w-52'
                  : 'bottom-full left-2 right-2 mb-2',
              )}>
                <button
                  onClick={() => { setUserMenuOpen(false); setProfileOpen(true); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground/90 transition-colors hover:bg-foreground/[0.06]"
                >
                  <UserCircle size={15} className="text-primary" />
                  Profile &amp; API Keys
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); setSettingsOpen(true); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground/90 transition-colors hover:bg-foreground/[0.06]"
                >
                  <Settings size={15} className="text-primary" />
                  Settings
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); setUsageOpen(true); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground/90 transition-colors hover:bg-foreground/[0.06]"
                >
                  <BarChart3 size={15} className="text-primary" />
                  Usage
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/help'); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground/90 transition-colors hover:bg-foreground/[0.06]"
                >
                  <HelpCircle size={15} className="text-primary" />
                  Help &amp; Docs
                </button>
                <div className="mx-3 h-px bg-border" />
                <button
                  id="btn-logout"
                  onClick={() => { setUserMenuOpen(false); logout().then(() => navigate('/auth')); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-rose-400 transition-colors hover:bg-rose-500/10"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}

            {/* Profile button */}
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className={cn(
                'flex items-center rounded-xl border border-border bg-foreground/[0.02] transition-colors hover:bg-foreground/[0.05]',
                isIconMode ? 'h-10 w-10 justify-center p-0' : 'w-full gap-2.5 px-2.5 py-2',
              )}
              title={isIconMode ? (user?.full_name ?? user?.email ?? 'Profile') : undefined}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-400 text-xs font-bold text-primary-foreground shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                {(user?.full_name ?? user?.email ?? 'U')[0].toUpperCase()}
              </div>
              {!isIconMode && (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-semibold leading-tight text-foreground">
                      {user?.full_name ?? 'User'}
                    </p>
                    {user?.email && (
                      <p className="truncate text-[10px] leading-tight text-muted-foreground/60">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <ChevronUp
                    size={13}
                    className={cn(
                      'shrink-0 text-muted-foreground/55 transition-transform duration-200',
                      userMenuOpen ? 'rotate-0' : 'rotate-180',
                    )}
                  />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Resize handle (desktop expanded only) */}
        {!collapsed && (
          <div
            onMouseDown={startResize}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group hidden md:block"
          >
            <div className="absolute inset-y-0 right-0 w-px bg-border transition-colors group-hover:bg-primary/50 group-active:bg-primary/70" />
          </div>
        )}
      </aside>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <UsageModal open={usageOpen} onClose={() => setUsageOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ShortcutOverlay />

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-card/65 px-4 py-3.5 backdrop-blur-xl shadow-[0_4px_20px_-8px_rgba(0,0,0,0.4)] md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground md:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Desktop expand button (only when collapsed) */}
            {collapsed && (
              <button
                onClick={() => setCollapsed(false)}
                title="Expand sidebar"
                className="hidden rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors md:flex"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            )}
            <span className="h-7 w-1.5 rounded-full bg-gradient-to-b from-primary to-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.7),0_0_6px_rgba(16,185,129,0.45)]" />
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold tracking-tight text-foreground md:text-lg">
                {meta.title}
              </h2>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              title={isHealthy ? 'Backend connected' : 'Backend unreachable'}
              className="flex items-center gap-1.5"
            >
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  isHealthy
                    ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                    : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                }`}
              />
              <span className="hidden font-mono text-[10px] text-muted-foreground/60 sm:block">
                {isHealthy ? 'Connected' : 'Offline'}
              </span>
            </div>
            <ModelSwitcher />
          </div>
        </header>

        <main
          className={cn(
            'relative z-0 flex min-h-0 flex-1 flex-col p-4 md:p-6',
            isQueryPage ? 'overflow-hidden pb-0 md:pb-0' : 'overflow-auto custom-scrollbar',
          )}
        >
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading page">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-transparent motion-reduce:animate-none" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default Layout;
