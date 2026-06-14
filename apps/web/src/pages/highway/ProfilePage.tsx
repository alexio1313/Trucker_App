import { useState, useEffect } from 'react';
import { useAuthStore } from '@truck-platform/state';

export default function HighwayProfilePage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ businessName: '', phone: '', address: '', highwayName: '', isOpen24hr: false, facilities: {} as Record<string, boolean> });

  useEffect(() => {
    fetch('/api/v1/highway/me', { headers: { 'x-user-id': user?.id || '' } })
      .then(r => r.json()).then(d => { if (d.success) { setProfile(d.data); setForm({ businessName: d.data.businessName, phone: d.data.phone, address: d.data.address, highwayName: d.data.highwayName, isOpen24hr: d.data.isOpen24hr, facilities: d.data.facilities || {} }); } });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const resp = await fetch('/api/v1/highway/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
      body: JSON.stringify(form),
    });
    const d = await resp.json();
    if (d.success) { setProfile(d.data); setEditing(false); }
  }

  const facilityOptions = ['parking', 'toilet', 'wifi', 'atm', 'truck_wash', 'ac', 'generator'];

  if (!profile) return <div className="p-6 text-gray-500">Loading profile…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Business Profile</h1>
        <button onClick={() => setEditing(!editing)} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600">
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        {!editing ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{profile.category === 'dhaba' ? '🍛' : profile.category === 'fuel_station' ? '⛽' : profile.category === 'tyre_shop' ? '🔧' : '🚛'}</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{profile.businessName}</h2>
                <p className="text-gray-500 capitalize">{profile.category?.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Phone:</span><p className="font-medium">{profile.phone}</p></div>
              <div><span className="text-gray-400">Highway:</span><p className="font-medium">{profile.highwayName || '—'}</p></div>
              <div className="col-span-2"><span className="text-gray-400">Address:</span><p className="font-medium">{profile.address}</p></div>
              <div><span className="text-gray-400">Open 24hr:</span><p className="font-medium">{profile.isOpen24hr ? 'Yes' : 'No'}</p></div>
              <div><span className="text-gray-400">Verified:</span><p className={`font-medium ${profile.isVerified ? 'text-green-600' : 'text-yellow-600'}`}>{profile.isVerified ? '✅ Verified' : '⏳ Pending'}</p></div>
            </div>
          </div>
        ) : (
          <form onSubmit={saveProfile} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label><input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Highway Name (e.g. NH-44)</label><input value={form.highwayName} onChange={e => setForm(f => ({ ...f, highwayName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" /></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Facilities</label>
              <div className="flex flex-wrap gap-2">
                {facilityOptions.map(f => (
                  <button key={f} type="button" onClick={() => setForm(frm => ({ ...frm, facilities: { ...frm.facilities, [f]: !frm.facilities[f] } }))}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${form.facilities[f] ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isOpen24hr} onChange={e => setForm(f => ({ ...f, isOpen24hr: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
              <span className="text-sm font-medium text-gray-700">Open 24 hours</span>
            </label>
            <button type="submit" className="w-full bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600">Save Profile</button>
          </form>
        )}
      </div>
    </div>
  );
}
