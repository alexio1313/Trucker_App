import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../logger';

// Phase 1: Cloud-only LLM router
// Tier 1-A → Ollama mistral:7b-instruct (fast)
// Tier 1-B → Ollama llama3.1:8b (quality)
// Tier 1-C → Claude API claude-haiku-4-5 (complex admin only)

const PHASE1_MODELS = {
  FAST:    'mistral:7b-instruct-v0.2',
  QUALITY: 'llama3.1:8b',
  COMPLEX: 'claude-haiku-4-5-20251001',
} as const;

const TASK_TIER_MAP: Record<string, 'FAST' | 'QUALITY' | 'COMPLEX'> = {
  // Tier 1-A: Fast — Ollama mistral
  'social.hashtags':          'FAST',
  'social.short_caption':     'FAST',
  'chat.suggestion':          'FAST',
  'load.title_summary':       'FAST',
  'notification.preview':     'FAST',
  'trucker.earnings_oneliner':'FAST',
  'trucker.quick_tip':        'FAST',

  // Tier 1-B: Quality — Ollama llama3.1:8b
  'social.full_description':  'QUALITY',
  'load.detail_summary':      'QUALITY',
  'eta.plain_language':       'QUALITY',
  'blockade.alert_summary':   'QUALITY',
  'sla.overrun_explanation':  'QUALITY',
  'route.fuel_tips':          'QUALITY',
  'toll.summary':             'QUALITY',

  // Tier 1-C: Complex — Claude API (admin panel only)
  'admin.dispute_suggestion': 'COMPLEX',
  'admin.fraud_narrative':    'COMPLEX',
  'admin.revenue_anomaly':    'COMPLEX',
  'sla.legal_review':         'COMPLEX',
  'route.multi_load_planning':'COMPLEX',
};

const PROMPT_TEMPLATES: Record<string, (ctx: Record<string, unknown>) => string> = {
  'social.hashtags': (ctx) =>
    `Generate 10 hashtags for a truck load: from ${ctx['origin']} to ${ctx['destination']}, cargo: ${ctx['cargoType']}. Return only hashtags like #tag1 #tag2`,

  'social.short_caption': (ctx) =>
    `Write an Instagram caption under 120 characters for a truck logistics load from ${ctx['origin']} to ${ctx['destination']}. Price: ₹${ctx['price']}. Professional and engaging.`,

  'social.full_description': (ctx) =>
    `Write a 300-character social media post for a successful truck delivery from ${ctx['origin']} to ${ctx['destination']}. Cargo: ${ctx['cargoType']}, Distance: ${ctx['distanceKm']}km. Highlight reliability and professionalism.`,

  'chat.suggestion': (ctx) =>
    `Suggest a short, professional reply (under 20 words) for a trucker to send to a merchant who said: "${ctx['merchantMessage']}". Context: load from ${ctx['origin']} to ${ctx['destination']}.`,

  'load.title_summary': (ctx) =>
    `Write a 1-line load title (under 60 chars): ${ctx['cargoType']} from ${ctx['origin']} to ${ctx['destination']}, ${ctx['weightKg']}kg. Make it clear and searchable.`,

  'load.detail_summary': (ctx) =>
    `Summarize this load for a merchant dashboard (3 bullet points max): ${ctx['origin']} → ${ctx['destination']}, ${ctx['cargoType']}, ${ctx['weightKg']}kg, ₹${ctx['price']}, distance ${ctx['distanceKm']}km. Include key business facts.`,

  'notification.preview': (ctx) =>
    `Write a 2-line push notification for: ${ctx['event']}. Context: ${ctx['details']}. Be concise and actionable.`,

  'trucker.earnings_oneliner': (ctx) =>
    `Write one encouraging sentence about a trucker's earnings: completed ${ctx['loads']} loads this month, earned ₹${ctx['revenue']}. Keep it motivational.`,

  'trucker.quick_tip': (ctx) =>
    `One practical tip for a trucker delivering ${ctx['cargoType']} in ${ctx['weather']} weather on a ${ctx['distanceKm']}km trip. Under 30 words.`,

  'eta.plain_language': (ctx) =>
    `Explain in one sentence why this truck will be ${ctx['delayMinutes']} minutes late. Route: ${ctx['origin']} to ${ctx['destination']}. Reason: ${ctx['reason']}. Write for a non-technical person.`,

  'blockade.alert_summary': (ctx) =>
    `Write a 2-sentence alert for a trucker: there is a ${ctx['severity']} road blockade at ${ctx['location']} on ${ctx['highway']}. Estimated delay: ${ctx['delayMinutes']} minutes. Suggest they consider the alternate route.`,

  'sla.overrun_explanation': (ctx) =>
    `Explain to a merchant why they owe a waiting charge. Loading took ${ctx['actualMinutes']} minutes but the agreed time was ${ctx['agreedMinutes']} minutes. Charge: ₹${ctx['charge']}. Be polite and factual. Under 3 sentences.`,

  'route.fuel_tips': (ctx) =>
    `Give 3 specific fuel-saving tips for a ${ctx['truckType']} truck doing a ${ctx['distanceKm']}km trip from ${ctx['origin']} to ${ctx['destination']} on Indian roads. Each tip under 20 words.`,

  'toll.summary': (ctx) =>
    `Summarize toll gates for route from ${ctx['origin']} to ${ctx['destination']} (${ctx['distanceKm']}km). Estimated total toll cost and 2 major toll points. Under 50 words.`,

  'admin.dispute_suggestion': (ctx) =>
    `You are a logistics dispute mediator. A ${ctx['raisedBy']} claims: "${ctx['reason']}". Load: ${ctx['origin']} to ${ctx['destination']}, price ₹${ctx['price']}. GPS shows: ${ctx['gpsEvidence'] ?? 'data available'}. Suggest a fair resolution with reasoning. Be concise and neutral. Under 150 words.`,

  'admin.fraud_narrative': (ctx) =>
    `Analyze this suspicious transaction for a logistics platform admin: User ${ctx['userId']}, ${ctx['transactionCount']} transactions in ${ctx['timeWindow']}, ${ctx['pattern']}. Write a clear fraud risk narrative (under 100 words) explaining why this is suspicious and what to investigate.`,

  'admin.revenue_anomaly': (ctx) =>
    `Explain to a logistics platform admin why revenue dropped ${ctx['dropPercent']}% in ${ctx['period']}. Known factors: ${ctx['factors']}. Write a clear root cause analysis in bullet points (under 80 words).`,

  'sla.legal_review': (ctx) =>
    `Review this SLA clause for a logistics contract: "${ctx['clause']}". Identify any risks for the platform operator, flag ambiguous terms, and suggest clearer language. Under 120 words.`,

  'route.multi_load_planning': (ctx) =>
    `Plan an optimal multi-load trip for a trucker starting from ${ctx['startCity']} with ${ctx['availableLoads']} loads available. Truck capacity: ${ctx['truckCapacity']}kg. Preferred regions: ${ctx['preferredRegions']}. Suggest the best sequence to maximize revenue. Under 120 words.`,
};

async function callOllama(model: string, prompt: string): Promise<string> {
  const start = Date.now();
  const res = await axios.post<{ response: string }>(
    `${env.OLLAMA_BASE_URL}/api/generate`,
    { model, prompt, stream: false, options: { temperature: 0.7, num_predict: 256 } },
    { timeout: 30_000 },
  );
  const latencyMs = Date.now() - start;
  logger.info('[LLM Phase1]', { model, latencyMs });
  return res.data.response.trim();
}

async function callClaude(prompt: string): Promise<string> {
  if (!env.CLAUDE_API_KEY) {
    logger.warn('[LLM Phase1] No Claude API key — falling back to Ollama quality model');
    return callOllama(PHASE1_MODELS.QUALITY, prompt);
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
  const start = Date.now();
  const msg = await client.messages.create({
    model: PHASE1_MODELS.COMPLEX,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });
  const latencyMs = Date.now() - start;
  logger.info('[LLM Phase1]', { model: PHASE1_MODELS.COMPLEX, latencyMs });
  const block = msg.content[0];
  return block.type === 'text' ? block.text.trim() : '';
}

export async function phase1Generate(
  taskType: string,
  context: Record<string, unknown>,
): Promise<{ result: string; tier: string; model: string; phase: 1 }> {
  const tier = TASK_TIER_MAP[taskType];
  if (!tier) throw new Error(`Unknown task type for Phase 1: ${taskType}`);

  const templateFn = PROMPT_TEMPLATES[taskType];
  if (!templateFn) throw new Error(`No prompt template for Phase 1 task: ${taskType}`);

  const prompt = templateFn(context);

  let result: string;
  let model: string;

  switch (tier) {
    case 'FAST':
      model = PHASE1_MODELS.FAST;
      result = await callOllama(model, prompt);
      break;
    case 'QUALITY':
      model = PHASE1_MODELS.QUALITY;
      result = await callOllama(model, prompt);
      break;
    case 'COMPLEX':
      model = PHASE1_MODELS.COMPLEX;
      result = await callClaude(prompt);
      break;
    default:
      throw new Error(`Unknown tier: ${tier}`);
  }

  return { result, tier, model, phase: 1 };
}

export const PHASE1_TASK_TYPES = Object.keys(TASK_TIER_MAP);
