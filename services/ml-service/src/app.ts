import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { env } from './config/env';
import { logger } from './logger';
import { computeLoadMatchScores } from './ml/load-matching.service';
import { predictETA } from './ml/eta-prediction.service';
import { analyzeFraud } from './ml/fraud-detection.service';
import { aiGenerate } from './ai/ollama.client';
import { phase1Generate, PHASE1_TASK_TYPES } from './ai/phase1-router';

const app = express();
const register = new Registry();
collectDefaultMetrics({ register });

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ml-service', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Load-trucker matching scores
app.get('/api/v1/ml/match/:loadId', async (req, res) => {
  try {
    const scores = await computeLoadMatchScores(req.params.loadId);
    res.json({ success: true, data: scores });
  } catch (err) {
    logger.error('Match scoring failed', { error: (err as Error).message });
    res.status(500).json({ success: false, error: { code: 'MATCH_FAILED', message: 'Matching unavailable' } });
  }
});

// ETA prediction
app.get('/api/v1/ml/eta/:loadId', async (req, res) => {
  try {
    const eta = await predictETA(req.params.loadId);
    res.json({ success: true, data: eta });
  } catch (err) {
    logger.error('ETA prediction failed', { error: (err as Error).message });
    res.status(500).json({ success: false, error: { code: 'ETA_FAILED', message: 'ETA prediction unavailable' } });
  }
});

// Fraud detection
app.get('/api/v1/ml/fraud/:userId', async (req, res) => {
  try {
    const analysis = await analyzeFraud(req.params.userId);
    res.json({ success: true, data: analysis });
  } catch (err) {
    logger.error('Fraud analysis failed', { error: (err as Error).message });
    res.status(500).json({ success: false, error: { code: 'FRAUD_FAILED', message: 'Fraud analysis unavailable' } });
  }
});

// AI negotiation assistant — trucker asks "should I accept this load?"
app.post('/api/v1/ml/negotiate', async (req, res) => {
  const { loadDetails, truckerContext } = req.body as {
    loadDetails: Record<string, unknown>;
    truckerContext: Record<string, unknown>;
  };

  const prompt = `You are a logistics AI advisor helping a trucker decide whether to accept a freight load.

Load: Origin=${loadDetails['originCity']}, Dest=${loadDetails['destCity']}, Distance=${loadDetails['distanceKm']}km, Price=₹${loadDetails['price']}, Cargo=${loadDetails['cargoType']}
Trucker: Rating=${truckerContext['rating']}, Past loads=${truckerContext['totalLoads']}, Current location=${truckerContext['currentCity']}

In 3-4 sentences: Is this load worth accepting? Consider profitability, distance, cargo type, and the trucker's position. Give a clear recommendation.`;

  try {
    const advice = await aiGenerate(prompt);
    res.json({ success: true, data: { advice } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'AI_UNAVAILABLE', message: 'AI assistant temporarily unavailable' } });
  }
});

// Route optimization
app.post('/api/v1/ml/route-optimize', async (req, res) => {
  const { origin, destination, waypoints, avoidTolls } = req.body as {
    origin: string; destination: string; waypoints?: string[]; avoidTolls?: boolean;
  };

  const prompt = `You are a route optimization AI for Indian freight logistics.

Route: ${origin} → ${destination}
${waypoints?.length ? `Via: ${waypoints.join(', ')}` : ''}
Preference: ${avoidTolls ? 'Avoid tolls (lower cost route)' : 'Fastest route (tolls ok)'}

Suggest the optimal route with:
1. Main highway/road names
2. Key cities to pass through
3. Estimated toll cost (approximate ₹)
4. Fuel stops recommendation
5. Any known bottlenecks or alternative

Be specific to Indian roads. Keep response under 150 words.`;

  try {
    const optimization = await aiGenerate(prompt);
    res.json({ success: true, data: { optimization } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'AI_UNAVAILABLE', message: 'Route optimization unavailable' } });
  }
});

// Phase 1 LLM Router — POST /api/ai/generate
// Routes: FAST → Ollama mistral:7b, QUALITY → Ollama llama3.1:8b, COMPLEX → Claude Haiku
app.post('/api/ai/generate', async (req, res) => {
  const { taskType, context, phase: requestedPhase } = req.body as {
    taskType: string;
    context: Record<string, unknown>;
    phase?: number;
  };

  if (!taskType || !context) {
    res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'taskType and context are required' } });
    return;
  }

  if (!PHASE1_TASK_TYPES.includes(taskType)) {
    res.status(400).json({
      success: false,
      error: { code: 'UNKNOWN_TASK', message: `Unknown taskType: ${taskType}. Valid types: ${PHASE1_TASK_TYPES.join(', ')}` },
    });
    return;
  }

  try {
    const output = await phase1Generate(taskType, context);
    res.json({ success: true, data: output });
  } catch (err) {
    logger.error('[AI Generate] Phase 1 error', { error: (err as Error).message, taskType });
    res.status(500).json({ success: false, error: { code: 'AI_FAILED', message: 'AI generation failed' } });
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

const server = app.listen(env.PORT, () => {
  logger.info(`ML Service listening on port ${env.PORT}`);
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});

export { app };
