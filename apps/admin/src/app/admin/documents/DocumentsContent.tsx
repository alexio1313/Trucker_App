'use client';
import { useEffect, useState, useCallback } from 'react';

const API_BASE = 'http://192.168.8.101:3002/api/v1/truckers';

interface Alert {
  user_id: string;
  full_name: string;
  phone_number: string;
  kyc_status: string;
  truck_id: string;
  registration_no: string;
  make: string;
  model: string;
  insurance_expiry: string | null;
  permit_expiry: string | null;
  fitness_expiry: string | null;
  insurance_days_left: number | null;
  permit_days_left: number | null;
  fitness_days_left: number | null;
  insurance_alert: 'ok' | 'warning' | 'critical' | 'expired';
  permit_alert: 'ok' | 'warning' | 'critical' | 'expired';
  fitness_alert: 'ok' | 'warning' | 'critical' | 'expired';
}

interface Summary {
  expired: number;
  critical: number;
  warning: number;
}

const ALERT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  expired:  { bg: 'bg-red-100',    text: 'text-red-700',    label: 'EXPIRED' },
  critical: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Critical' },
  warning:  { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Warning' },
  ok:       { bg: 'bg-green-100',  text: 'text-green-700',  label: 'OK' },
};

function DocBadge({ alert, daysLeft, expiry }: { alert: string; daysLeft: number | null; expiry: string | null }) {
  const s = ALERT_STYLE[alert] || ALERT_STYLE.ok;
  if (alert === 'ok' || !expiry) return <span className="text-xs text-gray-400">OK</span>;

  const label = daysLeft !== null && daysLeft < 0
    ? `Expired ${Math.abs(daysLeft)}d ago`
    : daysLeft !== null
    ? `${daysLeft}d left`
    : s.label;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.bg} ${s.text}`}>
      {label}
    </span>
  );
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DocumentsContent() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<Summary>({ expired: 0, critical: 0, warning: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'expired' | 'critical' | 'warning'>('all');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/document-alerts`);
      const json = await res.json();
      if (json.success) {
        setAlerts(json.data.alerts);
        setSummary(json.data.summary);
        setError(null);
      } else {
        setError('Failed to load document alerts');
      }
    } catch {
      setError('Unable to reach trucker service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const filtered = alerts.filter((a) => {
    if (filter === 'all') return true;
    return (
      a.insurance_alert === filter ||
      a.permit_alert === filter ||
      a.fitness_alert === filter
    );
  });

  const worst = (a: Alert) => {
    const order = ['expired', 'critical', 'warning', 'ok'];
    return [a.insurance_alert, a.permit_alert, a.fitness_alert]
      .sort((x, y) => order.indexOf(x) - order.indexOf(y))[0];
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Document Expiry Alerts</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Trucks with insurance, permit, or fitness certificates expiring within 60 days
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Expired', count: summary.expired, color: 'text-red-600', bg: 'bg-red-50 border-red-200', key: 'expired' },
          { label: 'Critical (≤7 days)', count: summary.critical, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', key: 'critical' },
          { label: 'Warning (≤30 days)', count: summary.warning, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', key: 'warning' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(filter === s.key as typeof filter ? 'all' : s.key as typeof filter)}
            className={`rounded-xl border p-5 text-left transition-all ${s.bg} ${filter === s.key ? 'ring-2 ring-offset-1 ring-orange-400' : ''}`}
          >
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-sm text-gray-600 mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4">
        {(['all', 'expired', 'critical', 'warning'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? `All (${alerts.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Trucker / Vehicle</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Severity</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Insurance</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Permit</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fitness</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">Loading alerts…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">
                  {filter === 'all' ? 'No document alerts — all trucks are in order!' : `No ${filter} alerts.`}
                </td>
              </tr>
            )}
            {filtered.map((a) => {
              const w = worst(a);
              const ws = ALERT_STYLE[w];
              return (
                <tr key={a.truck_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-sm text-gray-900">{a.full_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.registration_no} · {a.make} {a.model}</p>
                    <p className="text-xs text-gray-400">{a.phone_number}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ws.bg} ${ws.text}`}>
                      {ws.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <DocBadge alert={a.insurance_alert} daysLeft={a.insurance_days_left} expiry={a.insurance_expiry} />
                    <p className="text-xs text-gray-400 mt-1">{formatDate(a.insurance_expiry)}</p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <DocBadge alert={a.permit_alert} daysLeft={a.permit_days_left} expiry={a.permit_expiry} />
                    <p className="text-xs text-gray-400 mt-1">{formatDate(a.permit_expiry)}</p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <DocBadge alert={a.fitness_alert} daysLeft={a.fitness_days_left} expiry={a.fitness_expiry} />
                    <p className="text-xs text-gray-400 mt-1">{formatDate(a.fitness_expiry)}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        Insurance = 3rd party + comprehensive · Permit = national/state permit · Fitness = fitness certificate (RC) ·
        <strong className="text-gray-500"> CMVR 2019</strong> requires all three to be valid for commercial operation
      </p>
    </div>
  );
}
