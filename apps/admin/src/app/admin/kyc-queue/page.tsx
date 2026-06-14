'use client';
import { useState, useEffect } from 'react';

interface KYCItem {
  id: string;
  fullName: string;
  userType: string;
  phone: string;
  verificationStage: number;
  aadhaarVerified: boolean;
  gstVerified: boolean;
  dlVerified: boolean;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.8.101:3000';

export default function KYCQueuePage() {
  const [items, setItems] = useState<KYCItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/admin/kyc-queue`, { headers: { 'x-user-id': 'admin' } })
      .then(r => r.json()).then(d => { if (d.success) setItems(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function approveKYC(userId: string) {
    await fetch(`${API}/api/v1/admin/users/${userId}/kyc-approve`, {
      method: 'POST',
      headers: { 'x-user-id': 'admin', 'Content-Type': 'application/json' },
    });
    setItems(prev => prev.filter(i => i.id !== userId));
  }

  const stageColors = ['', 'bg-yellow-100 text-yellow-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800'];
  const stageLabels = ['', 'Phone verified', 'Identity verified', 'Business verified'];

  if (loading) return <div className="p-8 text-gray-500">Loading KYC queue…</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">KYC Queue ({items.length} pending)</h1>
      {items.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No pending KYC reviews</div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{item.fullName}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{item.userType?.replace('_', ' ')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${stageColors[item.verificationStage] || 'bg-gray-100 text-gray-600'}`}>
                      Stage {item.verificationStage}: {stageLabels[item.verificationStage] || 'Unknown'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{item.phone}</p>
                  <div className="flex gap-3 mt-2">
                    <span className={`text-xs font-medium ${item.aadhaarVerified ? 'text-green-600' : 'text-gray-400'}`}>
                      {item.aadhaarVerified ? '✅' : '○'} Aadhaar
                    </span>
                    <span className={`text-xs font-medium ${item.gstVerified ? 'text-green-600' : 'text-gray-400'}`}>
                      {item.gstVerified ? '✅' : '○'} GST
                    </span>
                    {item.userType === 'trucker' && (
                      <span className={`text-xs font-medium ${item.dlVerified ? 'text-green-600' : 'text-gray-400'}`}>
                        {item.dlVerified ? '✅' : '○'} DL
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveKYC(item.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600">
                    Approve KYC
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
