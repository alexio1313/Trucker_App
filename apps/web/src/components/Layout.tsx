import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@truck-platform/state';
import { LanguageSelector } from './LanguageSelector';

const MERCHANT_NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/loads', label: 'My Loads', icon: '📦' },
  { path: '/post-load', label: 'Post Load', icon: '➕' },
  { path: '/social', label: 'Social Media', icon: '📣' },
];

const TRUCKER_NAV = [
  { path: '/trucker/dashboard', label: 'Dashboard', icon: '🏠' },
  { path: '/trucker/loads', label: 'Find Loads', icon: '🔍' },
  { path: '/trucker/journey', label: 'My Journey', icon: '🚛' },
  { path: '/trucker/earnings', label: 'Earnings', icon: '💰' },
  { path: '/trucker/profile', label: 'My Profile', icon: '👤' },
];

const LOADER_NAV = [
  { path: '/loader/dashboard', label: 'Dashboard', icon: '💪' },
  { path: '/loader/jobs', label: 'Jobs', icon: '📋' },
  { path: '/loader/workers', label: 'Workers', icon: '👷' },
  { path: '/loader/subscription', label: 'Subscription', icon: '⭐' },
];

const HIGHWAY_NAV = [
  { path: '/highway/dashboard', label: 'Dashboard', icon: '⛽' },
  { path: '/highway/ads', label: 'Ad Campaigns', icon: '📢' },
  { path: '/highway/analytics', label: 'Analytics', icon: '📈' },
  { path: '/highway/profile', label: 'My Profile', icon: '✏️' },
  { path: '/highway/subscription', label: 'Subscription', icon: '⭐' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const userType = user?.userType;
  const navItems =
    userType === 'trucker' ? TRUCKER_NAV :
    userType === 'loader_company' ? LOADER_NAV :
    userType === 'highway_business' ? HIGHWAY_NAV :
    MERCHANT_NAV;
  const portalLabel =
    userType === 'trucker' ? 'Trucker Portal' :
    userType === 'loader_company' ? 'Loader Portal' :
    userType === 'highway_business' ? 'Highway Portal' :
    'Merchant Portal';
  const isTrucker = userType === 'trucker';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-orange-400">TruckPlatform</h1>
          <p className="text-sm text-slate-400 mt-1">{portalLabel}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-sm text-slate-300 mb-1">{user?.fullName}</div>
          <div className="text-xs text-slate-400 mb-2">{user?.phoneNumber}</div>
          {isTrucker && (
            <div className="mb-3">
              <LanguageSelector />
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-sm text-slate-400 hover:text-white transition-colors text-left"
          >
            Sign out →
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
