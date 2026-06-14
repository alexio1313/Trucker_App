import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../logger';

export async function ollamaGenerate(prompt: string, systemPrompt?: string): Promise<string> {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const response = await axios.post<{ response: string }>(
    `${env.OLLAMA_BASE_URL}/api/generate`,
    { model: env.OLLAMA_MODEL, prompt: fullPrompt, stream: false },
    { timeout: 60000 },
  );
  return response.data.response.trim();
}

export async function ollamaHealthCheck(): Promise<boolean> {
  try {
    await axios.get(`${env.OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    return true;
  } catch {
    logger.warn('Ollama not available');
    return false;
  }
}

export async function claudeGenerate(prompt: string, systemPrompt?: string): Promise<string> {
  if (!env.CLAUDE_API_KEY) throw new Error('Claude API key not configured');
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt ?? 'You are an AI assistant for a logistics platform.',
    messages: [{ role: 'user', content: prompt }],
  });
  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response type');
  return block.text.trim();
}

export async function aiGenerate(prompt: string, systemPrompt?: string): Promise<string> {
  // Try Claude first, fall back to Ollama
  if (env.CLAUDE_API_KEY) {
    try {
      return await claudeGenerate(prompt, systemPrompt);
    } catch (err) {
      logger.warn('Claude failed, falling back to Ollama', { error: (err as Error).message });
    }
  }
  return ollamaGenerate(prompt, systemPrompt);
}
