import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@truck-platform/state';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/merchant/DashboardPage';
import PostLoadPage from './pages/merchant/PostLoadPage';
import MyLoadsPage from './pages/merchant/MyLoadsPage';
import LoadDetailPage from './pages/merchant/LoadDetailPage';
import SocialPage from './pages/merchant/SocialPage';
import TruckerDashboardPage from './pages/trucker/DashboardPage';
import TruckerLoadsPage from './pages/trucker/LoadsPage';
import TruckerEarningsPage from './pages/trucker/EarningsPage';
import TruckerProfilePage from './pages/trucker/ProfilePage';
import JourneyPage from './pages/trucker/JourneyPage';
import Layout from './components/Layout';
import { I18nProvider } from './i18n/I18nProvider';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'merchant' | 'trucker' }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.userType !== role) {
    return <Navigate to={user?.userType === 'trucker' ? '/trucker/dashboard' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user?.userType === 'trucker' ? '/trucker/dashboard' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <I18nProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Merchant routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute role="merchant">
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RootRedirect />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="loads" element={<MyLoadsPage />} />
          <Route path="loads/:loadId" element={<LoadDetailPage />} />
          <Route path="post-load" element={<PostLoadPage />} />
          <Route path="social" element={<SocialPage />} />
        </Route>

        {/* Trucker routes */}
        <Route
          path="/trucker"
          element={
            <ProtectedRoute role="trucker">
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/trucker/dashboard" replace />} />
          <Route path="dashboard" element={<TruckerDashboardPage />} />
          <Route path="loads" element={<TruckerLoadsPage />} />
          <Route path="earnings" element={<TruckerEarningsPage />} />
          <Route path="profile" element={<TruckerProfilePage />} />
          <Route path="journey" element={<JourneyPage />} />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </I18nProvider>
  );
}
