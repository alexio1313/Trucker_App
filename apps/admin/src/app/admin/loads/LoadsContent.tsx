'use client';
import { useState, useEffect, useCallback } from 'react';

const LOAD_SERVICE = 'http://192.168.8.101:3001/api/v1/loads';
const ADMIN_SERVICE = 'http://192.168.8.101:3004/api/v1/admin';
const TRUCKER_SERVICE = 'http://192.168.8.101:3002/api/v1/truckers';

const STATUS_COLORS: Record<string, string> = {
  posted:     'bg-yellow-100 text-yellow-700',
  accepted:   'bg-blue-100 text-blue-700',
  loading:    'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-orange-100 text-orange-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-gray-100 text-gray-600',
  disputed:   'bg-red-100 text-red-700',
};

const STATUS_FILTERS = ['', 'posted', 'accepted', 'in_transit', 'delivered', 'disputed', 'cancelled'];

// Normalize API response — handles both old snake_case and new camelCase nested format
function normalizeLoad(l: Record<string, unknown>): NLoad {
  const origin = (l.origin as Record<string, unknown>) ?? {};
  const dest   = (l.destination as Record<string, unknown>) ?? {};
  const cargo  = (l.cargo as Record<string, unknown>) ?? {};
  const pricing= (l.pricing as Record<string, unknown>) ?? {};
  const tw     = (l.timeWindow as Record<string, unknown>) ?? {};
  return {
    load_id:          (l.loadId || l.load_id || '') as string,
    origin_city:      (origin.city  || l.origin_city  || '') as string,
    dest_city:        (dest.city    || l.dest_city    || '') as string,
    origin_state:     (origin.state || l.origin_state || '') as string,
    dest_state:       (dest.state   || l.dest_state   || '') as string,
    origin_address:   (origin.address || '') as string,
    dest_address:     (dest.address   || '') as string,
    cargo_type:       (cargo.cargoType    || l.cargo_type    || '') as string,
    cargo_weight_kg:  Number(cargo.weightKg     || l.cargo_weight_kg  || 0),
    agreed_price:     Number(pricing.agreedPrice || l.agreed_price     || 0),
    distance_km:      Number(cargo.distanceKm   || l.distance_km      || 0),
    status:           (l.status || '') as string,
    created_at:       (l.createdAt || l.created_at || '') as string,
    merchant_id:      (l.merchantId || l.merchant_id || '') as string,
    trucker_id:       (l.truckerId  || l.trucker_id  || '') as string,
    merchant_name:    (l.merchant_name || '') as string,
    trucker_name:     (l.trucker_name  || '') as string,
    pickup_start:     (tw.pickupStart  || '') as string,
    delivery_expected:(tw.deliveryExpected || '') as string,
  };
}

interface NLoad {
  load_id: string;
  origin_city: string;
  dest_city: string;
  origin_state: string;
  dest_state: string;
  origin_address: string;
  dest_address: string;
  cargo_type: string;
  cargo_weight_kg: number;
  agreed_price: number;
  distance_km: number;
  status: string;
  created_at: string;
  merchant_id: string;
  trucker_id: string;
  merchant_name: string;
  trucker_name: string;
  pickup_start: string;
  delivery_expected: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function LoadsContent() {
  const [status, setStatus]           = useState('');
  const [page, setPage]               = useState(1);
  const [loads, setLoads]             = useState<NLoad[]>([]);
  const [pagination, setPagination]   = useState<Pagination | null>(null);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<NLoad | null>(null);
  const [disputeLoading, setDisputeLoading]   = useState(false);
  const [disputeNote, setDisputeNote]         = useState('');
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeType, setDisputeType] = useState('other');
  const [searchTerm, setSearchTerm]   = useState('');

  const fetchLoads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50', page: String(page) });
      if (status) params.set('status', status);
      const res  = await fetch(`${LOAD_SERVICE}/search?${params}`);
      const json = await res.json();
      if (json.success) {
        const raw   = json.data.items ?? [];
        const normed = raw.map(normalizeLoad);
        setLoads(normed);
        setPagination(json.data.pagination ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { fetchLoads(); }, [fetchLoads]);

  const handleRaiseDispute = async () => {
    if (!selected || !disputeNote.trim()) return;
    setDisputeLoading(true);
    try {
      await fetch(`${ADMIN_SERVICE}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadId: selected.load_id,
          raisedByRole: 'admin',
          description: disputeNote,
          disputeType,
        }),
      });
      setShowDisputeModal(false);
      setDisputeNote('');
      setDisputeType('other');
      setSelected(null);
      fetchLoads();
    } catch { /* ignore */ }
    finally { setDisputeLoading(false); }
  };

  const fmt = (price: number) =>
    price > 0 ? `₹${price.toLocaleString('en-IN')}` : '—';

  const fmtDate = (d: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const filtered = loads.filter(l => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      l.load_id.toLowerCase().includes(q) ||
      l.origin_city.toLowerCase().includes(q) ||
      l.dest_city.toLowerCase().includes(q) ||
      l.cargo_type.toLowerCase().includes(q) ||
      l.merchant_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">All Loads</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {pagination ? `${pagination.total.toLocaleString('en-IN')} total loads` : 'Loading…'}
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by city, cargo, ID…"
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 w-56"
          />
          <button onClick={fetchLoads} className="px-4 py-2 text-sm font-medium bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center mt-12">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Load ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Route</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cargo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Merchant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((l) => (
                <tr key={l.load_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(l)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {l.load_id ? l.load_id.slice(0, 12) + (l.load_id.length > 12 ? '…' : '') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {l.origin_city || '?'} → {l.dest_city || '?'}
                    </p>
                    {l.distance_km > 0 && (
                      <p className="text-xs text-gray-400">{parseFloat(String(l.distance_km)).toFixed(0)} km</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <p className="text-xs capitalize">{l.cargo_type || '—'}</p>
                    <p className="text-xs text-gray-400">{l.cargo_weight_kg > 0 ? `${l.cargo_weight_kg.toLocaleString('en-IN')} kg` : '—'}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {fmt(l.agreed_price)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {l.merchant_name || (l.merchant_id ? l.merchant_id.slice(0, 8) + '…' : '—')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[l.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {l.status?.replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(l.created_at)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {['in_transit', 'delivered', 'accepted', 'loading'].includes(l.status) && (
                      <button
                        onClick={() => { setSelected(l); setShowDisputeModal(true); }}
                        className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Dispute
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">📦</div>
              <p>No loads found{status ? ` with status "${status}"` : ''}.</p>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 text-sm border rounded bg-white disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <span className="text-sm text-gray-500">Page {page} of {pagination.totalPages} · {pagination.total} loads</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm border rounded bg-white disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          )}
        </div>
      )}

      {/* Load Detail Drawer */}
      {selected && !showDisputeModal && (
        <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={() => setSelected(null)}>
          <div className="w-[420px] bg-white h-full shadow-xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Load Detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4 text-sm">
              {/* Route */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1 uppercase font-semibold">Route</p>
                <p className="font-bold text-gray-900 text-base">{selected.origin_city} → {selected.dest_city}</p>
                <p className="text-gray-500 text-xs">{selected.origin_state} → {selected.dest_state}</p>
                {selected.origin_address && <p className="text-xs text-gray-400 mt-1">{selected.origin_address}</p>}
                {selected.distance_km > 0 && <p className="text-gray-400 text-xs mt-1">{parseFloat(String(selected.distance_km)).toFixed(0)} km</p>}
              </div>

              {/* Price / Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs text-orange-500 font-semibold uppercase">Price</p>
                  <p className="font-bold text-orange-700 text-lg">{fmt(selected.agreed_price)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-500 font-semibold uppercase">Status</p>
                  <p className={`text-xs px-2 py-0.5 rounded-full font-medium inline-block mt-1 ${STATUS_COLORS[selected.status] ?? ''}`}>
                    {selected.status?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              {/* Cargo */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Cargo</p>
                <p className="capitalize font-medium">{selected.cargo_type || '—'}</p>
                <p className="text-gray-500">{selected.cargo_weight_kg > 0 ? `${selected.cargo_weight_kg.toLocaleString('en-IN')} kg` : '—'}</p>
              </div>

              {/* Merchant */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Posted By</p>
                <p className="font-medium">{selected.merchant_name || 'Merchant'}</p>
                <p className="font-mono text-xs text-gray-400">{selected.merchant_id || '—'}</p>
              </div>

              {/* Trucker */}
              {selected.trucker_id && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Assigned Trucker</p>
                  <p className="font-medium">{selected.trucker_name || 'Trucker'}</p>
                  <p className="font-mono text-xs text-gray-400">{selected.trucker_id}</p>
                </div>
              )}

              {/* Schedule */}
              {selected.pickup_start && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Schedule</p>
                  <p className="text-xs">Pickup: {fmtDate(selected.pickup_start)}</p>
                  {selected.delivery_expected && <p className="text-xs">Delivery by: {fmtDate(selected.delivery_expected)}</p>}
                </div>
              )}

              {/* Load ID */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Load ID</p>
                <p className="font-mono text-xs text-gray-600 break-all">{selected.load_id}</p>
              </div>
              <p className="text-xs text-gray-400">Created: {fmtDate(selected.created_at)}</p>

              {['in_transit', 'delivered', 'accepted', 'loading'].includes(selected.status) && (
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="w-full mt-4 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  Raise Dispute on This Load
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="font-bold text-lg mb-1">Raise Dispute</h3>
            <p className="text-sm text-gray-500 mb-4">
              Load: {selected.origin_city} → {selected.dest_city}
            </p>
            <select
              value={disputeType}
              onChange={(e) => setDisputeType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="waiting_charge">Waiting Charge</option>
              <option value="payment_issue">Payment Issue</option>
              <option value="damage">Cargo Damage</option>
              <option value="late_delivery">Late Delivery</option>
              <option value="no_show">No Show</option>
              <option value="cargo_mismatch">Cargo Mismatch</option>
              <option value="communication">Communication</option>
              <option value="other">Other</option>
            </select>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Describe the issue in detail…"
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowDisputeModal(false); setDisputeNote(''); }}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRaiseDispute}
                disabled={disputeLoading || !disputeNote.trim()}
                className="flex-1 py-2 text-sm bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {disputeLoading ? 'Raising…' : 'Raise Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
