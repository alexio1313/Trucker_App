import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@truck-platform/state';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/merchant/DashboardPage';
import PostLoadPage from './pages/merchant/PostLoadPage';
import MyLoadsPage from './pages/merchant/MyLoadsPage';
import LoadDetailPage from './pages/merchant/LoadDetailPage';
import SocialPage from './pages/merchant/SocialPage';
import ShipmentTrackingPage from './pages/merchant/ShipmentTrackingPage';
import TruckerDashboardPage from './pages/trucker/DashboardPage';
import TruckerLoadsPage from './pages/trucker/LoadsPage';
import TruckerEarningsPage from './pages/trucker/EarningsPage';
import TruckerProfilePage from './pages/trucker/ProfilePage';
import JourneyPage from './pages/trucker/JourneyPage';
import LogisticsDashboardPage from './pages/logistics/DashboardPage';
import HighwayDashboardPage from './pages/highway/DashboardPage';
import HighwayAdsPage from './pages/highway/AdsPage';
import HighwayAnalyticsPage from './pages/highway/AnalyticsPage';
import HighwayProfilePage from './pages/highway/ProfilePage';
import HighwaySubscriptionPage from './pages/highway/SubscriptionPage';
import LoaderDashboardPage from './pages/loader/DashboardPage';
import LoaderWorkersPage from './pages/loader/WorkersPage';
import LoaderJobsPage from './pages/loader/JobsPage';
import LoaderSubscriptionPage from './pages/loader/SubscriptionPage';
import Layout from './components/Layout';
import { I18nProvider } from './i18n/I18nProvider';

type UserType = 'merchant' | 'trucker' | 'admin' | 'logistics' | 'loader_company' | 'highway_business';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: UserType[] }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user?.userType && !roles.includes(user.userType as UserType)) {
    return <Navigate to={getRootForUserType(user.userType)} replace />;
  }
  return <>{children}</>;
}

function getRootForUserType(userType: string): string {
  switch (userType) {
    case 'trucker': return '/trucker/dashboard';
    case 'logistics': return '/logistics/dashboard';
    case 'loader_company': return '/loader/dashboard';
    case 'highway_business': return '/highway/dashboard';
    case 'admin': return 'http://192.168.8.101:3011/admin';
    default: return '/dashboard';
  }
}

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const dest = getRootForUserType(user?.userType || 'merchant');
  if (dest.startsWith('http')) { window.location.href = dest; return null; }
  return <Navigate to={dest} replace />;
}

export default function App() {
  return (
    <I18nProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Merchant routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute roles={['merchant']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RootRedirect />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="loads" element={<MyLoadsPage />} />
          <Route path="loads/:loadId" element={<LoadDetailPage />} />
          <Route path="loads/:loadId/tracking" element={<ShipmentTrackingPage />} />
          <Route path="post-load" element={<PostLoadPage />} />
          <Route path="social" element={<SocialPage />} />
        </Route>

        {/* Trucker routes */}
        <Route
          path="/trucker"
          element={
            <ProtectedRoute roles={['trucker']}>
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

        {/* Logistics routes */}
        <Route
          path="/logistics"
          element={
            <ProtectedRoute roles={['logistics']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/logistics/dashboard" replace />} />
          <Route path="dashboard" element={<LogisticsDashboardPage />} />
        </Route>

        {/* Highway Business routes */}
        <Route
          path="/highway"
          element={
            <ProtectedRoute roles={['highway_business']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/highway/dashboard" replace />} />
          <Route path="dashboard" element={<HighwayDashboardPage />} />
          <Route path="profile" element={<HighwayProfilePage />} />
          <Route path="ads" element={<HighwayAdsPage />} />
          <Route path="analytics" element={<HighwayAnalyticsPage />} />
          <Route path="subscription" element={<HighwaySubscriptionPage />} />
        </Route>

        {/* Loader Company routes */}
        <Route
          path="/loader"
          element={
            <ProtectedRoute roles={['loader_company']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/loader/dashboard" replace />} />
          <Route path="dashboard" element={<LoaderDashboardPage />} />
          <Route path="workers" element={<LoaderWorkersPage />} />
          <Route path="jobs" element={<LoaderJobsPage />} />
          <Route path="subscription" element={<LoaderSubscriptionPage />} />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </I18nProvider>
  );
}
