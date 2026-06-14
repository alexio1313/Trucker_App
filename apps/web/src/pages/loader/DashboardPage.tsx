import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@truck-platform/state';

export default function LoaderDashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ jobsThisMonth: 0, totalEarnings: 0, avgRating: 0, workersActive: 0 });

  useEffect(() => {
    fetch('/api/v1/loader-cos/analytics', { headers: { 'x-user-id': user?.userId || '' } })
      .then(r => r.json()).then(d => { if (d.success) setStats(d.data); });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">💪</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loader Company Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome, {user?.fullName || 'Loading Company'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Jobs This Month', value: stats.jobsThisMonth, icon: '📦' },
          { label: 'Total Earnings', value: `₹${(stats.totalEarnings || 0).toLocaleString()}`, icon: '💰' },
          { label: 'Avg Rating', value: (stats.avgRating || 0).toFixed(1) + ' ⭐', icon: '⭐' },
          { label: 'Active Workers', value: stats.workersActive, icon: '👷' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{String(s.value)}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Links</h2>
          <div className="space-y-2">
            <Link to="/loader/workers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50">
              <span className="text-xl">👷</span><span className="font-medium text-gray-700">Manage Workers</span>
            </Link>
            <Link to="/loader/jobs" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50">
              <span className="text-xl">📋</span><span className="font-medium text-gray-700">Available Jobs</span>
            </Link>
            <Link to="/loader/subscription" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50">
              <span className="text-xl">⭐</span><span className="font-medium text-gray-700">Subscription</span>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Rate Card</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Per bag (general)</span><span className="font-medium">₹12</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Per tonne (general)</span><span className="font-medium">₹350</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Per tonne (machinery)</span><span className="font-medium">₹600</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Detention/hour</span><span className="font-medium">₹75</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Night surcharge</span><span className="font-medium">+25%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
