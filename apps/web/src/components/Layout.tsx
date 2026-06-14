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

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const isTrucker = user?.userType === 'trucker';
  const navItems = isTrucker ? TRUCKER_NAV : MERCHANT_NAV;
  const portalLabel = isTrucker ? 'Trucker Portal' : 'Merchant Portal';

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
