import { useState } from 'react';
import { useAuthStore } from '@truck-platform/state';

const TIERS = [
  { id: 'starter', name: 'Starter', price: '₹1,499/mo', features: ['Up to 5 concurrent jobs', 'Basic job referrals', 'Worker roster (up to 10)'] },
  { id: 'growth', name: 'Growth', price: '₹3,999/mo', features: ['Up to 20 concurrent jobs', 'Priority job referrals', 'Worker roster (up to 50)', 'Analytics dashboard'] },
  { id: 'enterprise', name: 'Enterprise', price: '₹7,999/mo', features: ['Unlimited concurrent jobs', 'Highest priority listing', 'Unlimited workers', 'Dedicated support', 'Custom rate card'] },
];

export default function LoaderSubscriptionPage() {
  const { user } = useAuthStore();
  const [selected, setSelected] = useState('starter');

  async function subscribe() {
    await fetch('/api/v1/loader-cos/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user?.userId || '' },
      body: JSON.stringify({ tier: selected }),
    });
    alert(`Subscribed to ${selected}. Payment via Razorpay coming soon.`);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Loader Company Subscription</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map(t => (
          <button key={t.id} onClick={() => setSelected(t.id)}
            className={`text-left p-5 rounded-xl border-2 transition-all ${selected === t.id ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
            <div className="font-bold text-gray-900 text-lg mb-1">{t.name}</div>
            <div className="text-xl font-bold text-orange-500 mb-3">{t.price}</div>
            <ul className="space-y-1">
              {t.features.map(f => <li key={f} className="text-sm text-gray-600 flex gap-1"><span className="text-green-500">✓</span>{f}</li>)}
            </ul>
          </button>
        ))}
      </div>
      <button onClick={subscribe} className="bg-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600">
        Subscribe to {TIERS.find(t => t.id === selected)?.name}
      </button>
    </div>
  );
}
