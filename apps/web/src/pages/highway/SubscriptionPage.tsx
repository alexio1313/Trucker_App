import { useState } from 'react';
import { useAuthStore } from '@truck-platform/state';

const TIERS = [
  { id: 'free', name: 'Free', price: '₹0', color: 'gray', features: ['Basic map listing', '12px dot on map', 'Emergency services shown to all'] },
  { id: 'basic', name: 'Basic', price: '₹499/mo', color: 'blue', features: ['All Free features', '16px dot + category icon', 'Contact button on pin'] },
  { id: 'standard', name: 'Standard', price: '₹1,499/mo', color: 'orange', features: ['All Basic features', '20px dot + name label', 'Ad campaigns (₹1,000 credits/mo)', 'Analytics dashboard'] },
  { id: 'premium', name: 'Premium', price: '₹3,499/mo', color: 'purple', features: ['All Standard features', '24px pulsing dot + name + rating', 'Priority placement in ads', 'Featured badge', '₹3,000 credits/mo'] },
];

const CREDIT_PACKS = [
  { amount: 500, label: '₹500' },
  { amount: 1000, label: '₹1,000' },
  { amount: 2500, label: '₹2,500' },
  { amount: 5000, label: '₹5,000' },
];

export default function HighwaySubscriptionPage() {
  const { user } = useAuthStore();
  const [selectedTier, setSelectedTier] = useState('free');
  const [creditsAmount, setCreditsAmount] = useState(1000);

  async function upgradeTier() {
    await fetch('/api/v1/highway/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
      body: JSON.stringify({ tier: selectedTier }),
    });
    alert(`Subscription updated to ${selectedTier}. Payment integration via Razorpay coming soon.`);
  }

  async function addCredits() {
    await fetch('/api/v1/highway/credits/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
      body: JSON.stringify({ amount: creditsAmount }),
    });
    alert(`₹${creditsAmount} credits added. Payment integration via Razorpay coming soon.`);
  }

  const colorMap: Record<string, string> = {
    gray: 'border-gray-200 bg-gray-50',
    blue: 'border-blue-200 bg-blue-50',
    orange: 'border-orange-200 bg-orange-50',
    purple: 'border-purple-200 bg-purple-50',
  };
  const selectedMap: Record<string, string> = {
    gray: 'border-gray-500 ring-2 ring-gray-300',
    blue: 'border-blue-500 ring-2 ring-blue-300',
    orange: 'border-orange-500 ring-2 ring-orange-300',
    purple: 'border-purple-500 ring-2 ring-purple-300',
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Subscription & Credits</h1>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Choose Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map(tier => (
            <button key={tier.id} onClick={() => setSelectedTier(tier.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${colorMap[tier.color]} ${selectedTier === tier.id ? selectedMap[tier.color] : ''}`}>
              <div className="font-bold text-gray-900 mb-1">{tier.name}</div>
              <div className="text-lg font-bold text-gray-700 mb-3">{tier.price}</div>
              <ul className="space-y-1">
                {tier.features.map(f => <li key={f} className="text-xs text-gray-600 flex gap-1"><span>✓</span>{f}</li>)}
              </ul>
            </button>
          ))}
        </div>
        <button onClick={upgradeTier} className="mt-4 bg-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors">
          Upgrade to {TIERS.find(t => t.id === selectedTier)?.name}
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add Ad Credits</h2>
        <p className="text-sm text-gray-500 mb-4">Credits are used for ad impressions (₹0.50 each) and clicks (₹3.00 each)</p>
        <div className="flex gap-3 flex-wrap mb-4">
          {CREDIT_PACKS.map(p => (
            <button key={p.amount} onClick={() => setCreditsAmount(p.amount)}
              className={`px-6 py-3 rounded-xl font-semibold transition-colors ${creditsAmount === p.amount ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={addCredits} className="bg-green-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors">
          Add ₹{creditsAmount.toLocaleString()} Credits
        </button>
      </div>
    </div>
  );
}
