'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/merchants', label: 'Merchant Approvals', icon: '🏪' },
  { href: '/admin/kyc', label: 'KYC Queue', icon: '🪪' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/loads', label: 'Loads', icon: '📦' },
  { href: '/admin/social', label: 'Social Posts', icon: '📣' },
  { href: '/admin/disputes', label: 'Disputes', icon: '⚖️' },
  { href: '/admin/payments', label: 'Payments', icon: '💳' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
  { href: '/admin/surge', label: 'Surge Pricing', icon: '⚡' },
  { href: '/admin/fraud', label: 'Fraud Alerts', icon: '🚨' },
  { href: '/admin/live-map', label: 'Live Fleet Map', icon: '🗺️' },
  { href: '/admin/documents', label: 'Doc Expiry Alerts', icon: '📄' },
  { href: '/admin/api-status', label: 'API Status', icon: '🔌' },
  { href: '/admin/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/admin/feature-flags', label: 'Feature Flags', icon: '🚩' },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: '📋' },
  { href: '/admin/simulation', label: 'Simulation', icon: '🎮' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-slate-900 text-white flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-orange-400">TruckPlatform</h1>
          <p className="text-xs text-slate-400 mt-1">Admin Console</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
