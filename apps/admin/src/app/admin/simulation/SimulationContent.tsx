'use client';
import { useState, useEffect, useCallback } from 'react';

const SIM_BASE = 'http://192.168.8.101:3002/api/v1/simulation';

const SIM_TRUCKERS = [
  { id: 'f1000000-0000-0000-0000-000000000001', name: 'Ravi Kumar (Sim-BLR)', city: 'Bangalore', phone: '+919860001001' },
  { id: 'f1000000-0000-0000-0000-000000000002', name: 'Harpreet Singh (Sim-DEL)', city: 'Delhi', phone: '+919860001002' },
  { id: 'f1000000-0000-0000-0000-000000000003', name: 'Mahesh Patil (Sim-MUM)', city: 'Mumbai', phone: '+919860001003' },
];

const CITIES = ['bangalore', 'delhi', 'mumbai', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad'];
const CITY_LABEL: Record<string, string> = {
  bangalore: 'Bangalore, Karnataka',
  delhi: 'Delhi, Delhi',
  mumbai: 'Mumbai, Maharashtra',
  hyderabad: 'Hyderabad, Telangana',
  chennai: 'Chennai, Tamil Nadu',
  kolkata: 'Kolkata, West Bengal',
  pune: 'Pune, Maharashtra',
  ahmedabad: 'Ahmedabad, Gujarat',
};

const SEED_CITIES = ['bangalore', 'delhi', 'mumbai'];

interface StatusData {
  truckers: Array<{ user_id: string; full_name: string; phone_number: string; kyc_status: string; current_lat: number; current_lng: number; truck_status: string }>;
  loadCounts: Array<{ merchant_id: string; cnt: string; status: string }>;
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    verified: 'bg-green-100 text-green-700',
    available: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    on_load: 'bg-blue-100 text-blue-700',
    inactive: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[value] ?? 'bg-gray-100 text-gray-600'}`}>
      {value}
    </span>
  );
}

export default function SimulationContent() {
  const [simEnabled, setSimEnabled] = useState<boolean | null>(null);
  const [modeLoading, setModeLoading] = useState(false);

  const [seedStatus, setSeedStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [seedMsg, setSeedMsg] = useState('');
  const [seedCredentials, setSeedCredentials] = useState<null | typeof SIM_TRUCKERS>(null);

  const [loadsCity, setLoadsCity] = useState('bangalore');
  const [loadsStatus, setLoadsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [loadsMsg, setLoadsMsg] = useState('');

  const [locTrucker, setLocTrucker] = useState(SIM_TRUCKERS[0].id);
  const [locCity, setLocCity] = useState('bangalore');
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [locMsg, setLocMsg] = useState('');

  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [endpointReachable, setEndpointReachable] = useState<boolean | null>(null);

  const fetchMode = useCallback(async () => {
    try {
      const r = await fetch(`${SIM_BASE}/mode`);
      const json = await r.json();
      if (json.success) setSimEnabled(json.data.enabled);
    } catch { /* ignore */ }
  }, []);

  const toggleMode = useCallback(async () => {
    setModeLoading(true);
    try {
      const r = await fetch(`${SIM_BASE}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !simEnabled }),
      });
      const json = await r.json();
      if (json.success) setSimEnabled(json.data.enabled);
    } catch { /* ignore */ } finally {
      setModeLoading(false);
    }
  }, [simEnabled]);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const r = await fetch(`${SIM_BASE}/status`);
      if (!r.ok) throw new Error('Not ok');
      const json = await r.json();
      setStatusData(json.data);
      setEndpointReachable(true);
    } catch {
      setEndpointReachable(false);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { fetchMode(); fetchStatus(); }, [fetchMode, fetchStatus]);

  async function seedTruckers() {
    setSeedStatus('loading');
    setSeedMsg('');
    setSeedCredentials(null);
    try {
      const r = await fetch(`${SIM_BASE}/seed-truckers`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? 'Failed');
      setSeedStatus('done');
      setSeedMsg(json.data.message);
      setSeedCredentials(json.data.credentials?.truckers ?? null);
      fetchStatus();
    } catch (e: any) {
      setSeedStatus('error');
      setSeedMsg(e.message);
    }
  }

  async function seedLoads() {
    setLoadsStatus('loading');
    setLoadsMsg('');
    try {
      const r = await fetch(`${SIM_BASE}/seed-loads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: loadsCity }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? 'Failed');
      setLoadsStatus('done');
      setLoadsMsg(json.data.message);
      fetchStatus();
    } catch (e: any) {
      setLoadsStatus('error');
      setLoadsMsg(e.message);
    }
  }

  async function setLocation() {
    setLocStatus('loading');
    setLocMsg('');
    try {
      const r = await fetch(`${SIM_BASE}/trucker-location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckerId: locTrucker, city: locCity }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? 'Failed');
      setLocStatus('done');
      setLocMsg(`Location updated → ${CITY_LABEL[locCity]}`);
      fetchStatus();
    } catch (e: any) {
      setLocStatus('error');
      setLocMsg(e.message);
    }
  }

  const statusIcon = (s: string) => ({ done: '✅', error: '❌', loading: '⏳', idle: '' }[s] ?? '');

  const merchantCityMap: Record<string, string> = {
    'f2000000-0000-0000-0000-000000000001': 'Bangalore',
    'f2000000-0000-0000-0000-000000000002': 'Delhi',
    'f2000000-0000-0000-0000-000000000003': 'Mumbai',
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🎮 Simulation Control</h2>
          <p className="text-gray-500 mt-1">Seed test data for real-world demo — truckers, merchants, and loads across Indian cities</p>
        </div>
        <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-gray-700">Simulation Mode</p>
            <p className="text-xs text-gray-400">{simEnabled ? 'Sim truckers visible on platform' : 'Sim truckers hidden from search'}</p>
          </div>
          <button
            onClick={toggleMode}
            disabled={modeLoading || simEnabled === null}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none ${simEnabled ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}
            aria-label="Toggle simulation mode"
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${simEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm font-bold ${simEnabled ? 'text-green-600' : 'text-gray-400'}`}>
            {simEnabled === null ? '…' : simEnabled ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Endpoint status banner */}
      {endpointReachable === false && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-semibold text-amber-800">⚠️ Simulation endpoint not deployed yet</p>
          <p className="text-sm text-amber-700 mt-1">
            Deploy <code className="bg-amber-100 px-1 rounded">simulation_routes_patch.js</code> to the trucker service and register it in <code className="bg-amber-100 px-1 rounded">app.js</code>.
            See instructions in the project root.
          </p>
          <pre className="mt-2 text-xs bg-amber-100 rounded p-2 text-amber-900 overflow-auto">
{`# On the server:
docker cp simulation_routes_patch.js truck_trucker_service:/app/dist/simulation.routes.js
# Then patch dist/app.js to add:
# app.use('/api/v1/simulation', require('./simulation.routes'));
# Then restart: docker restart truck_trucker_service`}
          </pre>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">

        {/* Panel 1: Seed Truckers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">👥</span>
            <div>
              <h3 className="font-bold text-gray-900">Seed Test Truckers</h3>
              <p className="text-xs text-gray-400 mt-0.5">Creates 3 truckers + 3 merchants with verified KYC</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {SIM_TRUCKERS.map((t) => (
              <div key={t.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-semibold text-gray-900">{t.name}</p>
                <p className="text-gray-500">{t.phone} · {t.city} · KYC: verified</p>
              </div>
            ))}
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
              <p className="font-semibold">+ 3 merchant accounts (one per city)</p>
              <p className="text-blue-600 mt-0.5">Password for all: <code className="font-bold">Admin@123</code></p>
            </div>
          </div>

          <button
            onClick={seedTruckers}
            disabled={seedStatus === 'loading'}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {seedStatus === 'loading' ? '⏳ Seeding…' : '🌱 Seed 3 Truckers + Merchants'}
          </button>

          {seedMsg && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${seedStatus === 'done' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {statusIcon(seedStatus)} {seedMsg}
            </div>
          )}

          {seedCredentials && (
            <div className="mt-3 bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Login Credentials (password: Admin@123)</p>
              {seedCredentials.map((c: any) => (
                <p key={c.phone} className="text-xs text-gray-700">{c.city}: {c.phone}</p>
              ))}
            </div>
          )}
        </div>

        {/* Panel 2: Seed Loads */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="font-bold text-gray-900">Seed Loads by City</h3>
              <p className="text-xs text-gray-400 mt-0.5">Creates 6 realistic loads from the selected city</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
            <select
              value={loadsCity}
              onChange={(e) => setLoadsCity(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              {SEED_CITIES.map((c) => (
                <option key={c} value={c}>{CITY_LABEL[c]}</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700 mb-1">Routes to be seeded:</p>
            {loadsCity === 'bangalore' && <>
              <p>🚛 Bangalore → Mumbai (980 km · ₹58,800)</p>
              <p>🚛 Bangalore → Delhi (2150 km · ₹1,07,500)</p>
              <p>🚛 Bangalore → Chennai (350 km · ₹21,000)</p>
              <p>🚛 Bangalore → Hyderabad (570 km · ₹34,200)</p>
              <p>🚛 Bangalore → Pune (840 km · ₹50,400)</p>
              <p>🚛 Bangalore → Ahmedabad (1280 km · ₹64,000)</p>
            </>}
            {loadsCity === 'delhi' && <>
              <p>🚛 Delhi → Mumbai (1400 km · ₹84,000)</p>
              <p>🚛 Delhi → Bangalore (2150 km · ₹1,07,500)</p>
              <p>🚛 Delhi → Kolkata (1500 km · ₹75,000)</p>
              <p>🚛 Delhi → Jaipur (280 km · ₹16,800)</p>
              <p>🚛 Delhi → Ahmedabad (950 km · ₹47,500)</p>
              <p>🚛 Delhi → Hyderabad (1600 km · ₹80,000)</p>
            </>}
            {loadsCity === 'mumbai' && <>
              <p>🚛 Mumbai → Pune (150 km · ₹13,500)</p>
              <p>🚛 Mumbai → Bangalore (980 km · ₹58,800)</p>
              <p>🚛 Mumbai → Ahmedabad (530 km · ₹31,800)</p>
              <p>🚛 Mumbai → Nagpur (830 km · ₹49,800)</p>
              <p>🚛 Mumbai → Delhi (1400 km · ₹84,000)</p>
              <p>🚛 Mumbai → Goa (590 km · ₹35,400)</p>
            </>}
            <p className="text-blue-600 font-medium pt-1">Old 'posted' loads for this city's merchant will be replaced.</p>
          </div>

          <button
            onClick={seedLoads}
            disabled={loadsStatus === 'loading'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loadsStatus === 'loading' ? '⏳ Seeding…' : `📦 Seed ${loadsCity.charAt(0).toUpperCase() + loadsCity.slice(1)} Loads`}
          </button>

          {loadsMsg && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${loadsStatus === 'done' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {statusIcon(loadsStatus)} {loadsMsg}
            </div>
          )}
        </div>

        {/* Panel 3: Set Trucker Location */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📍</span>
            <div>
              <h3 className="font-bold text-gray-900">Set Trucker Location</h3>
              <p className="text-xs text-gray-400 mt-0.5">Move a sim trucker's GPS to any city</p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trucker</label>
              <select
                value={locTrucker}
                onChange={(e) => setLocTrucker(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                {SIM_TRUCKERS.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Move to City</label>
              <select
                value={locCity}
                onChange={(e) => setLocCity(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>{CITY_LABEL[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={setLocation}
            disabled={locStatus === 'loading'}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {locStatus === 'loading' ? '⏳ Updating…' : '📍 Update GPS Location'}
          </button>

          {locMsg && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${locStatus === 'done' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {statusIcon(locStatus)} {locMsg}
            </div>
          )}
        </div>

        {/* Panel 4: Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="font-bold text-gray-900">Simulation Status</h3>
                <p className="text-xs text-gray-400 mt-0.5">Current state of seeded data</p>
              </div>
            </div>
            <button
              onClick={fetchStatus}
              disabled={statusLoading}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1 rounded-lg transition-colors"
            >
              {statusLoading ? '⏳' : '🔄 Refresh'}
            </button>
          </div>

          {statusData ? (
            <div className="space-y-4">
              {/* Truckers */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sim Truckers</p>
                <div className="space-y-2">
                  {SIM_TRUCKERS.map((simT) => {
                    const row = statusData.truckers.find((t) => t.user_id === simT.id);
                    return (
                      <div key={simT.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{simT.name}</p>
                          <p className="text-xs text-gray-400">
                            {row ? `📍 ${parseFloat(String(row.current_lat)).toFixed(2)}, ${parseFloat(String(row.current_lng)).toFixed(2)}` : 'Not created'}
                          </p>
                        </div>
                        {row ? (
                          <div className="flex gap-1.5">
                            <StatusBadge value={row.kyc_status} />
                            <StatusBadge value={row.truck_status ?? 'inactive'} />
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">–</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Load counts */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Seeded Loads</p>
                {statusData.loadCounts.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No loads seeded yet</p>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(
                      statusData.loadCounts.reduce((acc: Record<string, Record<string, number>>, row) => {
                        const city = merchantCityMap[row.merchant_id] ?? row.merchant_id;
                        if (!acc[city]) acc[city] = {};
                        acc[city][row.status] = parseInt(row.cnt);
                        return acc;
                      }, {})
                    ).map(([city, counts]) => (
                      <div key={city} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">📦 {city}</span>
                        <div className="flex gap-2">
                          {Object.entries(counts).map(([status, cnt]) => (
                            <span key={status} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                              {status}: {cnt}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              {statusLoading ? (
                <p>Loading status…</p>
              ) : endpointReachable === false ? (
                <p className="text-sm">Simulation endpoint not reachable</p>
              ) : (
                <p className="text-sm">No data yet — seed truckers first</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Test Guide */}
      <div className="mt-6 bg-slate-800 rounded-xl p-6 text-white">
        <h3 className="font-bold text-lg mb-3">🧪 Quick Demo Flow</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="bg-slate-700 rounded-lg p-4">
            <p className="text-orange-400 font-bold mb-1">Step 1</p>
            <p>Click <strong>"Seed Truckers"</strong> to create 3 drivers with verified KYC</p>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <p className="text-orange-400 font-bold mb-1">Step 2</p>
            <p>Select a city and click <strong>"Seed Loads"</strong> to populate available loads</p>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <p className="text-orange-400 font-bold mb-1">Step 3</p>
            <p>Log in on the mobile app as the city's trucker — loads appear on the Loads screen</p>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <p className="text-orange-400 font-bold mb-1">Credentials</p>
            <p className="text-gray-300 text-xs mt-1">BLR: +919860001001<br/>DEL: +919860001002<br/>MUM: +919860001003<br/>Pass: Admin@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
