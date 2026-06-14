import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import { env } from '../config/env';
import { logger } from '../logger';
import { aiGenerate } from '../ai/ollama.client';

const pool = new Pool({ connectionString: env.DATABASE_URL });

interface FraudSignal {
  signal: string;
  severity: 'low' | 'medium' | 'high';
  score: number;
}

interface FraudAnalysis {
  userId: string;
  overallScore: number;       // 0–1
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  signals: FraudSignal[];
  action: 'none' | 'flag' | 'suspend' | 'review';
  aiExplanation: string;
}

async function detectSignals(userId: string): Promise<FraudSignal[]> {
  const signals: FraudSignal[] = [];

  const [userResult, loadResult, disputeResult] = await Promise.all([
    pool.query(
      `SELECT u.*, COUNT(l.load_id) AS loads_last_7d
       FROM users u
       LEFT JOIN loads l ON l.merchant_id = u.user_id AND l.created_at >= NOW() - INTERVAL '7 days'
       WHERE u.user_id = $1
       GROUP BY u.user_id`,
      [userId],
    ),
    pool.query(
      `SELECT COUNT(*) AS cancelled, COUNT(*) FILTER (WHERE status='cancelled') AS cancelled_count
       FROM loads WHERE (merchant_id = $1 OR trucker_id = $1)
       AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId],
    ),
    pool.query(
      `SELECT COUNT(*) AS disputes FROM disputes
       WHERE raised_by = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId],
    ),
  ]);

  const user = userResult.rows[0];
  if (!user) return signals;

  // Multiple accounts with same device/IP is detected via audit logs
  const ipResult = await pool.query(
    `SELECT ip_address, COUNT(*) AS cnt FROM audit_logs
     WHERE user_id = $1 GROUP BY ip_address ORDER BY cnt DESC LIMIT 1`,
    [userId],
  );
  const sharedIp = await pool.query(
    `SELECT COUNT(DISTINCT user_id) AS cnt FROM audit_logs
     WHERE ip_address = $1 AND user_id != $2`,
    [ipResult.rows[0]?.ip_address ?? '', userId],
  );

  if (parseInt(sharedIp.rows[0]?.cnt ?? '0', 10) > 3) {
    signals.push({ signal: 'Shared IP with 3+ other accounts', severity: 'high', score: 0.7 });
  }

  const cancelledCount = parseInt(loadResult.rows[0]?.cancelled_count ?? '0', 10);
  const totalLoads = parseInt(loadResult.rows[0]?.cancelled ?? '0', 10);
  if (totalLoads > 0 && cancelledCount / totalLoads > 0.5) {
    signals.push({ signal: 'Cancellation rate >50% in 30 days', severity: 'medium', score: 0.4 });
  }

  const disputeCount = parseInt(disputeResult.rows[0]?.disputes ?? '0', 10);
  if (disputeCount >= 3) {
    signals.push({ signal: `${disputeCount} disputes raised in 30 days`, severity: 'high', score: 0.6 });
  }

  if (!user.kyc_status || user.kyc_status !== 'verified') {
    signals.push({ signal: 'KYC not verified', severity: 'low', score: 0.2 });
  }

  const loadsLast7d = parseInt(user.loads_last_7d ?? '0', 10);
  if (loadsLast7d > 20) {
    signals.push({ signal: `Unusually high activity: ${loadsLast7d} loads in 7 days`, severity: 'medium', score: 0.35 });
  }

  return signals;
}

export async function analyzeFraud(userId: string): Promise<FraudAnalysis> {
  const signals = await detectSignals(userId);

  const overallScore = signals.length > 0
    ? Math.min(1, signals.reduce((sum, s) => sum + s.score, 0))
    : 0;

  const riskLevel: FraudAnalysis['riskLevel'] =
    overallScore >= 0.8 ? 'critical' :
    overallScore >= 0.6 ? 'high' :
    overallScore >= 0.3 ? 'medium' : 'low';

  const action: FraudAnalysis['action'] =
    overallScore >= 0.8 ? 'suspend' :
    overallScore >= 0.6 ? 'review' :
    overallScore >= 0.3 ? 'flag' : 'none';

  let aiExplanation = 'No significant fraud signals detected.';
  if (signals.length > 0) {
    try {
      const prompt = `Analyze these fraud signals for a logistics platform user:
${signals.map((s) => `- ${s.signal} (severity: ${s.severity})`).join('\n')}
Overall risk score: ${(overallScore * 100).toFixed(0)}%

In 2-3 sentences, explain the risk and recommended action. Be concise and professional.`;
      aiExplanation = await aiGenerate(prompt);
    } catch (err) {
      logger.warn('AI fraud explanation failed', { error: (err as Error).message });
      aiExplanation = `${signals.length} fraud signal(s) detected with overall risk score ${(overallScore * 100).toFixed(0)}%.`;
    }
  }

  const analysis: FraudAnalysis = { userId, overallScore, riskLevel, signals, action, aiExplanation };

  // Log to DB if score is high enough
  if (overallScore >= env.FRAUD_SCORE_THRESHOLD) {
    await pool.query(
      `INSERT INTO fraud_alerts (user_id, fraud_score, risk_level, signals, ai_explanation, action_taken)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
       fraud_score = $2, risk_level = $3, signals = $4, ai_explanation = $5,
       action_taken = $6, updated_at = NOW()`,
      [userId, overallScore, riskLevel, JSON.stringify(signals), aiExplanation, action],
    );
    logger.warn('Fraud alert raised', { userId, overallScore, riskLevel, action });
  }

  return analysis;
}
