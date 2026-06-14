'use client';
import { useState, useEffect, useCallback } from 'react';

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  version?: string;
  uptime?: string;
  checkedAt: string;
}

const SERVICES = [
  { name: 'API Gateway', url: '/api/health-proxy?service=api_gateway&port=3000' },
  { name: 'Load Service', url: '/api/health-proxy?service=load_service&port=3001' },
  { name: 'Trucker Service', url: '/api/health-proxy?service=trucker_service&port=3002' },
  { name: 'Pricing Service', url: '/api/health-proxy?service=pricing_service&port=3003' },
  { name: 'Admin Service', url: '/api/health-proxy?service=admin_service&port=3004' },
  { name: 'Notification Service', url: '/api/health-proxy?service=notification_service&port=3005' },
  { name: 'Payment Service', url: '/api/health-proxy?service=payment_service&port=3006' },
  { name: 'Social Service', url: '/api/health-proxy?service=social_service&port=3007' },
  { name: 'ML Service', url: '/api/health-proxy?service=ml_service&port=3008' },
];

const SERVER_IP = '192.168.8.101';

const INTEGRATIONS = [
  { name: 'Google Maps API', type: 'Maps', status: 'active', description: 'Route distance, geocoding and directions — key configured' },
  { name: 'Groq API (LLaMA 3)', type: 'AI/LLM', status: 'active', description: 'Fast AI inference for pricing suggestions and caption generation — key configured' },
  { name: 'Ollama (Mistral 7B)', type: 'AI/LLM', status: 'active', description: 'Local fallback LLM — running on server, ENABLE_OLLAMA_FALLBACK=true' },
  { name: 'Anthropic Claude API', type: 'AI/LLM', status: 'not_configured', description: 'CLAUDE_API_KEY not set in .env — using Groq as primary AI' },
  { name: 'Razorpay', type: 'Payments', status: 'not_configured', description: 'RAZORPAY_KEY_ID not set — payment flows disabled until configured' },
  { name: 'Firebase FCM', type: 'Push', status: 'not_configured', description: 'FCM_SERVER_KEY not set — push notifications not active' },
  { name: 'Twilio', type: 'SMS', status: 'not_configured', description: 'TWILIO_ACCOUNT_SID not set — OTP via SMS disabled' },
  { name: 'AWS S3', type: 'Storage', status: 'not_configured', description: 'AWS_ACCESS_KEY_ID not set — KYC docs stored locally as fallback' },
  { name: 'Twitter/X API', type: 'Social', status: 'not_configured', description: 'TWITTER_API_KEY not set — social publishing disabled' },
  { name: 'LinkedIn API', type: 'Social', status: 'not_configured', description: 'LINKEDIN_ACCESS_TOKEN not set — social publishing disabled' },
  { name: 'Instagram Graph API', type: 'Social', status: 'not_configured', description: 'INSTAGRAM_ACCESS_TOKEN not set — social publishing disabled' },
];

const STATUS_COLORS = {
  healthy: { bg: 'bg-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
  degraded: { bg: 'bg-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  down: { bg: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
  checking: { bg: 'bg-gray-300', text: 'text-gray-500', badge: 'bg-gray-100 text-gray-500' },
};

const INTEGRATION_STATUS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  configured: 'bg-blue-100 text-blue-800',
  not_configured: 'bg-gray-100 text-gray-500',
  oauth_required: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
};

const INTEGRATION_LABEL: Record<string, string> = {
  active: 'Active',
  configured: 'Configured',
  not_configured: 'Not Configured',
  oauth_required: 'OAuth Required',
  error: 'Error',
};

export default function ApiStatusContent() {
  const [healthData, setHealthData] = useState<Record<string, ServiceHealth>>({});
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    const results: Record<string, ServiceHealth> = {};

    await Promise.all(
      SERVICES.map(async (svc) => {
        const start = Date.now();
        const url = `http://${SERVER_IP}:${svc.url.match(/port=(\d+)/)?.[1]}/health`;
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
          const latencyMs = Date.now() - start;
          let body: Record<string, unknown> = {};
          try { body = await resp.json(); } catch { /* ignore */ }
          results[svc.name] = {
            service: svc.name,
            status: resp.ok ? 'healthy' : 'degraded',
            latencyMs,
            version: body['version'] as string | undefined,
            uptime: typeof body['uptime'] === 'number' ? `${Math.floor((body['uptime'] as number) / 3600)}h ${Math.floor(((body['uptime'] as number) % 3600) / 60)}m` : undefined,
            checkedAt: new Date().toISOString(),
          };
        } catch {
          results[svc.name] = {
            service: svc.name,
            status: 'down',
            latencyMs: Date.now() - start,
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );

    setHealthData(results);
    setLastChecked(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const healthy = Object.values(healthData).filter((s) => s.status === 'healthy').length;
  const degraded = Object.values(healthData).filter((s) => s.status === 'degraded').length;
  const down = Object.values(healthData).filter((s) => s.status === 'down').length;
  const avgLatency = Object.values(healthData).length
    ? Math.round(Object.values(healthData).reduce((sum, s) => sum + s.latencyMs, 0) / Object.values(healthData).length)
    : 0;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">API Status & Integrations</h2>
          <p className="text-gray-500 mt-1">
            Live health monitoring for all platform services
            {lastChecked && (
              <span className="ml-2 text-xs">— last checked {lastChecked.toLocaleTimeString('en-IN')}</span>
            )}
          </p>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Checking…' : '↻ Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Healthy', value: healthy, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          { label: 'Degraded', value: degraded, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
          { label: 'Down', value: down, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Avg Latency', value: loading ? '…' : `${avgLatency}ms`, color: 'text-gray-900', bg: 'bg-white border-gray-100' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-5 ${s.bg}`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Service health table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Microservices</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {SERVICES.map((svc) => {
            const h = healthData[svc.name];
            const colors = h ? STATUS_COLORS[h.status] : STATUS_COLORS.checking;
            return (
              <div key={svc.name} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${colors.bg} ${loading ? 'animate-pulse' : ''}`} />
                  <span className="font-medium text-sm text-gray-900">{svc.name}</span>
                  {h?.version && <span className="text-xs text-gray-400">v{h.version}</span>}
                </div>
                <div className="flex items-center gap-6">
                  {h?.uptime && (
                    <span className="text-xs text-gray-400">Up {h.uptime}</span>
                  )}
                  {h && (
                    <span className="text-sm font-mono text-gray-600 w-16 text-right">{h.latencyMs}ms</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${h ? colors.badge : STATUS_COLORS.checking.badge}`}>
                    {h ? h.status : 'checking…'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Integrations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">External Integrations</h3>
          <p className="text-sm text-gray-400 mt-0.5">Third-party services and API connections</p>
        </div>
        <div className="divide-y divide-gray-50">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.name} className="px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{integration.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">{integration.type}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{integration.description}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${INTEGRATION_STATUS[integration.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {INTEGRATION_LABEL[integration.status] ?? integration.status}
              </span>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-xl">
          <p className="text-xs text-slate-600">
            <strong>Active:</strong> Google Maps API (routing), Groq AI (LLaMA 3), Ollama (local LLM).
            &nbsp;·&nbsp;
            <strong>Not Configured:</strong> Add the missing keys to the server <code className="bg-slate-100 px-1 rounded">.env</code> file and rebuild containers to activate — Razorpay, FCM, Twilio, AWS S3, social APIs.
          </p>
        </div>
      </div>
    </div>
  );
}
