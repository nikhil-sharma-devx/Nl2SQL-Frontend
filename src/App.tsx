import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import QueryPage from './pages/QueryPage';
import SchemaPage from './pages/SchemaPage';
import HistoryPage from './pages/HistoryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuthPage from './pages/AuthPage';
import SavedQueriesPage from './pages/SavedQueriesPage';
import SettingsPage from './pages/SettingsPage';
import TrainingPage from './pages/TrainingPage';

const GOOGLE_CLIENT_ID = '665451798271-5jp3vbsckv2bkv4mkd30k7rardaipuns.apps.googleusercontent.com';

/** Redirect unauthenticated users to /auth */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
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
        <Route path="training" element={<TrainingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      {/* Catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
