import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConnectionProvider } from './context/ConnectionContext';
import { CommandPaletteProvider } from './context/CommandPaletteContext';
import Layout from './components/Layout';
import CommandPalette from './components/CommandPalette';
import { Toaster } from './components/ui/toast';
import { TooltipProvider } from './components/ui/tooltip';

// Route-level code splitting — each page loads only when first visited,
// keeping heavy dependencies (React Flow, recharts, syntax highlighter)
// out of the initial bundle.
const HomePage = lazy(() => import('./pages/HomePage'));
const QueryPage = lazy(() => import('./pages/QueryPage'));
const SchemaPage = lazy(() => import('./pages/SchemaPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const SavedQueriesPage = lazy(() => import('./pages/SavedQueriesPage'));
const DashboardsPage = lazy(() => import('./pages/DashboardsPage'));
const SchedulesPage = lazy(() => import('./pages/SchedulesPage'));
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const SharedQueryView = lazy(() => import('./pages/SharedQueryView'));

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// Google Sign-In is an optional integration — deployments without a client ID
// configured must not crash or silently offer a button that always fails.
const GOOGLE_CLIENT_ID_CONFIGURED = Boolean(GOOGLE_CLIENT_ID);

/** Full-page fallback shown while a lazy route chunk loads. */
function RouteFallback() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center" role="status" aria-label="Loading page">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-transparent motion-reduce:animate-none" />
    </div>
  );
}

/** Redirect unauthenticated users to /auth, preserving the destination so
 * deep links (e.g. an emailed /invite/:token) survive a login/register. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();
  // While the initial session restore/refresh is in flight, don't bounce a
  // still-valid (refreshable) session to the login page — show the loader.
  if (isBootstrapping) return <RouteFallback />;
  if (isAuthenticated) return <>{children}</>;
  const redirect = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/auth?redirect=${redirect}`} replace />;
}

function AppRoutes() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  if (isBootstrapping) return <RouteFallback />;
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public auth page */}
        <Route
          path="/auth"
          element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />}
        />
        {/* Public shared-query view (token-authed, no login required) */}
        <Route path="/shared/:token" element={<SharedQueryView />} />
        {/* Protected app routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="query" element={<QueryPage />} />
          <Route path="schema" element={<SchemaPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="saved" element={<SavedQueriesPage />} />
          <Route path="dashboards" element={<DashboardsPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="training" element={<TrainingPage />} />
          {/* Settings is a modal now; keep the path as a deep-link that opens it. */}
          <Route path="settings" element={<Navigate to="/" replace state={{ openSettings: true }} />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
        {/* Catch-all → home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const app = (
    <AuthProvider>
      <ConnectionProvider>
        <BrowserRouter>
          <CommandPaletteProvider>
            <TooltipProvider delayDuration={300} skipDelayDuration={200}>
              <AppRoutes />
              <CommandPalette />
              <Toaster />
            </TooltipProvider>
          </CommandPaletteProvider>
        </BrowserRouter>
      </ConnectionProvider>
    </AuthProvider>
  );

  // Only mount the Google provider when a client ID is actually configured —
  // passing an empty string would silently misconfigure the SDK.
  if (!GOOGLE_CLIENT_ID_CONFIGURED) return app;
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID as string}>{app}</GoogleOAuthProvider>;
}

export default App;
