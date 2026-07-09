import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Toaster } from './components/ui/toast';

// Route-level code splitting — each page loads only when first visited,
// keeping heavy dependencies (React Flow, recharts, syntax highlighter)
// out of the initial bundle.
const QueryPage = lazy(() => import('./pages/QueryPage'));
const SchemaPage = lazy(() => import('./pages/SchemaPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const SavedQueriesPage = lazy(() => import('./pages/SavedQueriesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

/** Full-page fallback shown while a lazy route chunk loads. */
function RouteFallback() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center" role="status" aria-label="Loading page">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-transparent motion-reduce:animate-none" />
    </div>
  );
}

/** Redirect unauthenticated users to /auth */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public auth page */}
        <Route
          path="/auth"
          element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />}
        />
        {/* Protected app routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<QueryPage />} />
          <Route path="schema" element={<SchemaPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="saved" element={<SavedQueriesPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="training" element={<TrainingPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
        {/* Catch-all → home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
