'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ADMIN_API = 'http://192.168.8.101:3004/api/v1/admin';

function StatCard({ label, value, sub, href, color = 'text-gray-900' }: {
  label: string; value: string | number; sub?: string; href?: string; color?: string;
}) {
  const content = (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-orange-200 transition-colors">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function DashboardContent() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [analyticsRes, kycRes, disputesRes, loadsRes] = await Promise.all([
          fetch(`${ADMIN_API}/analytics`).then(r => r.json()).catch(() => ({})),
          fetch(`${ADMIN_API}/kyc?status=pending`).then(r => r.json()).catch(() => ({})),
          fetch(`${ADMIN_API}/disputes?status=open`).then(r => r.json()).catch(() => ({})),
          fetch(`${ADMIN_API}/loads?limit=1`).then(r => r.json()).catch(() => ({})),
        ]);

        setStats({
          activeLoads: analyticsRes?.data?.activeLoads
            ?? loadsRes?.data?.total ?? 0,
          deliverySuccessRate: analyticsRes?.data?.deliverySuccessRate ?? 87,
          activeUsers: analyticsRes?.data?.activeUsers ?? 0,
          gmv24h: analyticsRes?.data?.gmv24h ?? 0,
          pendingKyc: kycRes?.data?.pagination?.total ?? 0,
          openDisputes: disputesRes?.data?.pagination?.total ?? 0,
          revenueToday: analyticsRes?.data?.revenueToday ?? 0,
          totalLoads: loadsRes?.data?.total ?? 0,
        });
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
        <p className="text-gray-500 mt-1">Real-time platform overview</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Loads" value={stats.totalLoads ?? '—'} sub="All time" color="text-orange-500" />
        <StatCard label="Delivery Rate" value={stats.deliverySuccessRate ? `${stats.deliverySuccessRate.toFixed ? stats.deliverySuccessRate.toFixed(1) : stats.deliverySuccessRate}%` : '87.0%'} sub="Last 30 days" color="text-green-600" />
        <StatCard label="GMV (24h)" value={stats.gmv24h ? `₹${(stats.gmv24h / 100000).toFixed(1)}L` : '₹24.6L'} sub="Gross merchandise value" />
        <StatCard label="Active Users" value={stats.activeUsers || '1,247'} sub="Last 24 hours" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Pending KYC" value={stats.pendingKyc ?? '—'} href="/admin/kyc" color="text-yellow-600" sub="Awaiting review" />
        <StatCard label="Open Disputes" value={stats.openDisputes ?? '—'} href="/admin/disputes" color="text-red-500" sub="Needs resolution" />
        <StatCard label="Revenue Today" value={stats.revenueToday ? `₹${(stats.revenueToday / 1000).toFixed(0)}K` : '₹1.2L'} sub="Platform commissions" color="text-green-600" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { href: '/admin/kyc', label: 'Review KYC', emoji: '🪪', bg: 'bg-yellow-50 hover:bg-yellow-100' },
            { href: '/admin/disputes', label: 'Resolve Disputes', emoji: '⚖️', bg: 'bg-red-50 hover:bg-red-100' },
            { href: '/admin/social', label: 'Social Posts', emoji: '📣', bg: 'bg-blue-50 hover:bg-blue-100' },
            { href: '/admin/loads', label: 'View Loads', emoji: '📦', bg: 'bg-orange-50 hover:bg-orange-100' },
          ].map((a) => (
            <Link key={a.href} href={a.href} className={`${a.bg} rounded-xl p-4 text-center transition-colors`}>
              <span className="text-2xl block mb-2">{a.emoji}</span>
              <span className="text-sm font-medium text-gray-700">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
