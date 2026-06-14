import { useAuthStore } from '@truck-platform/state';

export default function LogisticsDashboardPage() {
  const { user } = useAuthStore();
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🚚</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logistics Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome, {user?.fullName || 'Fleet Owner'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active Loads', value: '—', icon: '📦', color: 'blue' },
          { label: 'Fleet Available', value: '—', icon: '🚛', color: 'green' },
          { label: 'Monthly Revenue', value: '₹ —', icon: '💰', color: 'orange' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <span className="text-3xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Subscription: Starter (₹1,999/month)</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>✅ Post loads and find truckers</p>
          <p>✅ Fleet tracking</p>
          <p>⬜ Growth plan: ₹4,999/month — analytics + priority listing</p>
          <p>⬜ Enterprise: ₹9,999/month — dedicated account manager</p>
        </div>
        <button className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors">
          Upgrade Plan
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">KYC Status</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><span className="text-green-500">✅</span><span>Phone verified</span></div>
          <div className="flex items-center gap-2"><span className="text-yellow-500">⏳</span><span>Aadhaar eKYC — pending</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-400">○</span><span>GST verification — pending</span></div>
        </div>
        <button className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors">
          Complete KYC
        </button>
      </div>
    </div>
  );
}
