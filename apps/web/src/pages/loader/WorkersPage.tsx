import { useState, useEffect } from 'react';
import { useAuthStore } from '@truck-platform/state';

interface Worker {
  id: string;
  name: string;
  phone: string;
  skillTags: string[];
  status: string;
  aadhaarVerified: boolean;
  totalAssignments: number;
}

const SKILL_OPTS = ['general', 'heavy_machinery', 'hazmat', 'refrigerated', 'fragile'];

export default function LoaderWorkersPage() {
  const { user } = useAuthStore();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', aadhaarNumber: '', skillTags: ['general'] });

  const headers = { 'Content-Type': 'application/json', 'x-user-id': user?.userId || '' };

  useEffect(() => {
    fetch('/api/v1/loader-cos/workers', { headers }).then(r => r.json()).then(d => { if (d.success) setWorkers(d.data); });
  }, []);

  async function addWorker(e: React.FormEvent) {
    e.preventDefault();
    const resp = await fetch('/api/v1/loader-cos/workers', { method: 'POST', headers, body: JSON.stringify(form) });
    const d = await resp.json();
    if (d.success) { setWorkers(prev => [...prev, d.data]); setShowForm(false); setForm({ name: '', phone: '', aadhaarNumber: '', skillTags: ['general'] }); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Workers ({workers.length})</h1>
        <button onClick={() => setShowForm(true)} className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600">+ Add Worker</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Worker</h2>
            <form onSubmit={addWorker} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Number <span className="text-gray-400 text-xs">(stored as hash only)</span></label>
                <input type="password" value={form.aadhaarNumber} onChange={e => setForm(f => ({ ...f, aadhaarNumber: e.target.value }))} maxLength={12} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="12-digit Aadhaar" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTS.map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, skillTags: f.skillTags.includes(s) ? f.skillTags.filter(t => t !== s) : [...f.skillTags, s] }))}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${form.skillTags.includes(s) ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600">Add Worker</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {workers.map(w => (
          <div key={w.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-xl font-bold text-orange-600">
              {w.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{w.name}</p>
                {w.aadhaarVerified && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ Aadhaar</span>}
              </div>
              <p className="text-sm text-gray-500">{w.phone}</p>
              <div className="flex gap-1 mt-1 flex-wrap">
                {w.skillTags?.map(s => <span key={s} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{s.replace(/_/g, ' ')}</span>)}
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900">{w.totalAssignments} jobs</p>
              <p className={`text-xs font-medium ${w.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>{w.status}</p>
            </div>
          </div>
        ))}
        {workers.length === 0 && <div className="text-center text-gray-400 py-12">No workers added yet</div>}
      </div>
    </div>
  );
}
