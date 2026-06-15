import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@truck-platform/state';
import { useI18n } from '../i18n/useI18n';
import { LanguageSelector } from './LanguageSelector';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { t } = useI18n();

  const userType = user?.userType;

  const MERCHANT_NAV = [
    { path: '/dashboard',  label: t('dashboard'),   icon: '📊' },
    { path: '/loads',      label: t('myLoads'),      icon: '📦' },
    { path: '/post-load',  label: t('postLoad'),     icon: '➕' },
    { path: '/social',     label: t('socialMedia'),  icon: '📣' },
  ];
  const TRUCKER_NAV = [
    { path: '/trucker/dashboard', label: t('dashboard'), icon: '🏠' },
    { path: '/trucker/loads',     label: t('findLoads'), icon: '🔍' },
    { path: '/trucker/journey',   label: t('myJourney'), icon: '🚛' },
    { path: '/trucker/earnings',  label: t('earnings'),  icon: '💰' },
    { path: '/trucker/profile',   label: t('myProfile'), icon: '👤' },
  ];
  const LOADER_NAV = [
    { path: '/loader/dashboard',    label: t('dashboard'),   icon: '💪' },
    { path: '/loader/jobs',         label: t('jobs'),        icon: '📋' },
    { path: '/loader/workers',      label: t('workers'),     icon: '👷' },
    { path: '/loader/subscription', label: t('subscription'), icon: '⭐' },
  ];
  const HIGHWAY_NAV = [
    { path: '/highway/dashboard',    label: t('dashboard'),   icon: '⛽' },
    { path: '/highway/ads',          label: t('adCampaigns'), icon: '📢' },
    { path: '/highway/analytics',    label: t('analytics'),   icon: '📈' },
    { path: '/highway/profile',      label: t('myProfile'),   icon: '✏️' },
    { path: '/highway/subscription', label: t('subscription'), icon: '⭐' },
  ];

  const navItems =
    userType === 'trucker'          ? TRUCKER_NAV :
    userType === 'loader_company'   ? LOADER_NAV :
    userType === 'highway_business' ? HIGHWAY_NAV :
    MERCHANT_NAV;

  const portalLabel =
    userType === 'trucker'          ? t('truckerPortal') :
    userType === 'loader_company'   ? t('loaderPortal') :
    userType === 'highway_business' ? t('highwayPortal') :
    t('merchantPortal');

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

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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

        <div className="p-4 border-t border-slate-700 space-y-3">
          <div>
            <div className="text-sm text-slate-300">{user?.fullName}</div>
            <div className="text-xs text-slate-400">{user?.phoneNumber}</div>
          </div>
          <LanguageSelector />
          <button
            onClick={handleLogout}
            className="w-full text-sm text-slate-400 hover:text-white transition-colors text-left"
          >
            {t('signOut')} →
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
