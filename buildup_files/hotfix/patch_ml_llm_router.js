// Patch: add POST /api/ai/generate (Phase 1 LLM router) to running ML service
// Tiers: FAST→mistral:7b, QUALITY→llama3.1:8b, COMPLEX→Claude Haiku
'use strict';
const fs = require('fs');

const PHASE1_ROUTER = `
"use strict";
const axios = require('axios');

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

const PHASE1_MODELS = {
  FAST:    'mistral:7b-instruct-v0.2',
  QUALITY: 'llama3.1:8b',
  COMPLEX: 'claude-haiku-4-5-20251001',
};

const TASK_TIER_MAP = {
  'social.hashtags':           'FAST',
  'social.short_caption':      'FAST',
  'chat.suggestion':           'FAST',
  'load.title_summary':        'FAST',
  'notification.preview':      'FAST',
  'trucker.earnings_oneliner': 'FAST',
  'trucker.quick_tip':         'FAST',
  'social.full_description':   'QUALITY',
  'load.detail_summary':       'QUALITY',
  'eta.plain_language':        'QUALITY',
  'blockade.alert_summary':    'QUALITY',
  'sla.overrun_explanation':   'QUALITY',
  'route.fuel_tips':           'QUALITY',
  'toll.summary':              'QUALITY',
  'admin.dispute_suggestion':  'COMPLEX',
  'admin.fraud_narrative':     'COMPLEX',
  'admin.revenue_anomaly':     'COMPLEX',
  'sla.legal_review':          'COMPLEX',
  'route.multi_load_planning': 'COMPLEX',
};

const PROMPTS = {
  'social.hashtags': (ctx) => \`Generate 10 hashtags for truck load: \${ctx.origin} to \${ctx.destination}, cargo: \${ctx.cargoType}. Return only hashtags.\`,
  'social.short_caption': (ctx) => \`Instagram caption under 120 chars for truck delivery \${ctx.origin} to \${ctx.destination}. Price ₹\${ctx.price}. Professional.\`,
  'social.full_description': (ctx) => \`300-char social post for truck delivery \${ctx.origin} to \${ctx.destination}. Cargo: \${ctx.cargoType}. Highlight reliability.\`,
  'chat.suggestion': (ctx) => \`Short reply (under 20 words) for trucker to merchant: "\${ctx.merchantMessage}". Load: \${ctx.origin} to \${ctx.destination}.\`,
  'load.title_summary': (ctx) => \`1-line load title (under 60 chars): \${ctx.cargoType} from \${ctx.origin} to \${ctx.destination}, \${ctx.weightKg}kg.\`,
  'load.detail_summary': (ctx) => \`3-bullet summary for merchant: \${ctx.origin}→\${ctx.destination}, \${ctx.cargoType}, \${ctx.weightKg}kg, ₹\${ctx.price}, \${ctx.distanceKm}km.\`,
  'notification.preview': (ctx) => \`2-line push notification: \${ctx.event}. Context: \${ctx.details}. Concise and actionable.\`,
  'trucker.earnings_oneliner': (ctx) => \`One encouraging sentence: \${ctx.loads} loads this month, earned ₹\${ctx.revenue}. Motivational.\`,
  'trucker.quick_tip': (ctx) => \`One tip for trucker: \${ctx.cargoType} in \${ctx.weather} weather, \${ctx.distanceKm}km. Under 30 words.\`,
  'eta.plain_language': (ctx) => \`One sentence: truck \${ctx.delayMinutes} min late on \${ctx.origin}-\${ctx.destination}. Reason: \${ctx.reason}. Non-technical.\`,
  'blockade.alert_summary': (ctx) => \`2-sentence alert: \${ctx.severity} blockade at \${ctx.location} on \${ctx.highway}. Delay: \${ctx.delayMinutes} min. Suggest alternate.\`,
  'sla.overrun_explanation': (ctx) => \`Polite explanation to merchant: loading took \${ctx.actualMinutes} min (agreed: \${ctx.agreedMinutes}). Charge ₹\${ctx.charge}. Under 3 sentences.\`,
  'route.fuel_tips': (ctx) => \`3 fuel tips for \${ctx.truckType} truck, \${ctx.distanceKm}km from \${ctx.origin} to \${ctx.destination}. Each under 20 words.\`,
  'toll.summary': (ctx) => \`Toll summary: \${ctx.origin} to \${ctx.destination} (\${ctx.distanceKm}km). Est. total toll and 2 major toll points. Under 50 words.\`,
  'admin.dispute_suggestion': (ctx) => \`Logistics mediator: \${ctx.raisedBy} claims "\${ctx.reason}". Load: \${ctx.origin} to \${ctx.destination}, ₹\${ctx.price}. Fair resolution with reasoning. Under 150 words.\`,
  'admin.fraud_narrative': (ctx) => \`Fraud risk narrative: user \${ctx.userId}, \${ctx.transactionCount} transactions in \${ctx.timeWindow}, \${ctx.pattern}. Under 100 words.\`,
  'admin.revenue_anomaly': (ctx) => \`Root cause analysis: revenue dropped \${ctx.dropPercent}% in \${ctx.period}. Factors: \${ctx.factors}. Bullet points, under 80 words.\`,
  'sla.legal_review': (ctx) => \`Review SLA clause: "\${ctx.clause}". Risks, ambiguous terms, clearer language. Under 120 words.\`,
  'route.multi_load_planning': (ctx) => \`Multi-load plan from \${ctx.startCity}, \${ctx.availableLoads} loads, \${ctx.truckCapacity}kg, prefer \${ctx.preferredRegions}. Best sequence for max revenue. Under 120 words.\`,
};

async function callOllama(model, prompt) {
  const start = Date.now();
  const res = await axios.post(OLLAMA_BASE + '/api/generate', { model, prompt, stream: false, options: { temperature: 0.7, num_predict: 256 } }, { timeout: 30000 });
  console.log('[LLM Phase1] Ollama', model, (Date.now() - start) + 'ms');
  return res.data.response.trim();
}

async function callClaude(prompt) {
  if (!CLAUDE_API_KEY) return callOllama(PHASE1_MODELS.QUALITY, prompt);
  const Anthropic = require('@anthropic-ai/sdk').default;
  const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
  const start = Date.now();
  const msg = await client.messages.create({ model: PHASE1_MODELS.COMPLEX, max_tokens: 512, messages: [{ role: 'user', content: prompt }] });
  console.log('[LLM Phase1] Claude', (Date.now() - start) + 'ms');
  return msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
}

async function phase1Generate(taskType, context) {
  const tier = TASK_TIER_MAP[taskType];
  if (!tier) throw new Error('Unknown task type: ' + taskType);
  const promptFn = PROMPTS[taskType];
  if (!promptFn) throw new Error('No prompt for: ' + taskType);
  const prompt = promptFn(context);
  if (tier === 'FAST')    return { result: await callOllama(PHASE1_MODELS.FAST, prompt), tier, model: PHASE1_MODELS.FAST, phase: 1 };
  if (tier === 'QUALITY') return { result: await callOllama(PHASE1_MODELS.QUALITY, prompt), tier, model: PHASE1_MODELS.QUALITY, phase: 1 };
  if (tier === 'COMPLEX') return { result: await callClaude(prompt), tier, model: PHASE1_MODELS.COMPLEX, phase: 1 };
}

module.exports = { phase1Generate, TASK_TYPES: Object.keys(TASK_TIER_MAP) };
`;

const ROUTE_INJECTION = `
// Phase 1 LLM Router — injected by patch_ml_llm_router.js
const llmPhase1 = require('./phase1-router.js');
app.post('/api/ai/generate', async (req, res) => {
  const { taskType, context } = req.body || {};
  if (!taskType || !context) return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'taskType and context required' } });
  if (!llmPhase1.TASK_TYPES.includes(taskType)) return res.status(400).json({ success: false, error: { code: 'UNKNOWN_TASK', message: 'Unknown taskType: ' + taskType + '. Valid: ' + llmPhase1.TASK_TYPES.join(', ') } });
  try {
    const output = await llmPhase1.phase1Generate(taskType, context);
    res.json({ success: true, data: output });
  } catch (err) {
    console.error('[LLM Phase1] Error:', err.message, { taskType });
    res.status(500).json({ success: false, error: { code: 'AI_FAILED', message: 'AI generation failed: ' + err.message } });
  }
});
`;

// Write the phase1-router.js module
fs.writeFileSync('/app/dist/phase1-router.js', PHASE1_ROUTER, 'utf8');
console.log('Written /app/dist/phase1-router.js');

// Inject route into app.js before the 404 handler
const appPath = '/app/dist/app.js';
let src = fs.readFileSync(appPath, 'utf8');

const INJECT_BEFORE = "app.use((_req, res) => {";
if (src.includes('api/ai/generate')) {
  console.log('LLM router already injected in app.js — skipping');
  process.exit(0);
}
if (!src.includes(INJECT_BEFORE)) {
  console.error('Injection point not found in app.js');
  process.exit(1);
}

const patched = src.replace(INJECT_BEFORE, ROUTE_INJECTION + '\n' + INJECT_BEFORE);
fs.writeFileSync(appPath, patched, 'utf8');
console.log('Patched /app/dist/app.js — added POST /api/ai/generate (Phase 1 LLM router)');
