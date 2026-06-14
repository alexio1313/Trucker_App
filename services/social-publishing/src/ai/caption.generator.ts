import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../logger';

interface CaptionRequest {
  topic: string;
  platform: string;
  tone: 'professional' | 'casual' | 'celebratory';
  context?: string;
}

const platformGuide: Record<string, string> = {
  twitter: 'Keep under 280 characters. Use 2-3 relevant hashtags.',
  linkedin: 'Professional tone, 150-300 words. Include industry insights.',
  instagram: '150 words max. Use emojis. Include 5-10 hashtags at the end.',
  facebook: '100-200 words. Conversational. Include a call to action.',
  whatsapp: 'Short, friendly, under 100 words. No hashtags.',
};

function buildPrompt(req: CaptionRequest): string {
  return `You are a social media manager for a logistics platform in India.
Topic: ${req.topic}
Platform: ${req.platform}
Tone: ${req.tone}
${req.context ? `Context: ${req.context}` : ''}

Guidelines: ${platformGuide[req.platform] ?? 'Keep it engaging and relevant.'}

Write ONLY the post caption, no explanations or formatting.`;
}

async function generateWithGroq(prompt: string): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error('Groq API key not configured');
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    },
  );
  return (response.data as { choices: { message: { content: string } }[] }).choices[0].message.content.trim();
}

async function generateWithClaude(prompt: string): Promise<string> {
  if (!env.CLAUDE_API_KEY) throw new Error('Claude API key not configured');
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type');
  return block.text.trim();
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  if (!env.OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    },
    {
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    },
  );
  return (response.data as { choices: { message: { content: string } }[] }).choices[0].message.content.trim();
}

async function generateWithGemini(prompt: string): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new Error('Gemini API key not configured');
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { timeout: 15000 },
  );
  const r = response.data as { candidates: { content: { parts: { text: string }[] } }[] };
  return r.candidates[0].content.parts[0].text.trim();
}

async function generateWithOllama(prompt: string): Promise<string> {
  const response = await axios.post(
    `${env.OLLAMA_BASE_URL}/api/generate`,
    { model: 'mistral:7b', prompt, stream: false },
    { timeout: 30000 },
  );
  return (response.data as { response: string }).response.trim();
}

// Rich template-based captions for logistics/trucking — always available, zero latency
function generateTemplateCaption(req: CaptionRequest): string {
  const topic = req.topic.trim();
  const tone  = req.tone || 'professional';
  const plat  = req.platform;

  const hashtags: Record<string, string> = {
    twitter:   '#Logistics #Trucking #India #FreightIndia',
    linkedin:  '#LogisticsIndia #SupplyChain #Trucking #FreightTech #MadeInIndia',
    instagram: '#TruckingLife #LogisticsIndia #FreightForwarder #Truckers #IndiaLogistics #SupplyChain #B2B #SmallBusiness',
    facebook:  '#Logistics #Trucking #India',
    whatsapp:  '',
  };

  const proTemplates = [
    `🚛 Proud to share: ${topic}\n\nAt TruckPlatform, we're transforming freight logistics across India — connecting verified truckers with trusted merchants for seamless, reliable deliveries.\n\n✅ Real-time tracking\n✅ Transparent pricing\n✅ Guaranteed payments\n\n${hashtags[plat] || hashtags.linkedin}`,
    `📦 ${topic}\n\nIndia's logistics sector is evolving rapidly. TruckPlatform is at the forefront — empowering over 10,000 truckers and merchants to do business smarter, faster, and more profitably.\n\nJoin us in shaping the future of freight. 🇮🇳\n\n${hashtags[plat] || hashtags.linkedin}`,
    `🏆 Exciting update: ${topic}\n\nWith TruckPlatform, every load is tracked, every payment is secured, and every trucker is verified. We're not just moving goods — we're building trust across India's supply chain.\n\n${hashtags[plat] || hashtags.linkedin}`,
  ];

  const casualTemplates = [
    `Hey everyone! 👋\n\n${topic} — and we couldn't be more excited!\n\nTruckPlatform is making it super easy to book trusted trucks across India. Got cargo? We've got wheels! 🚛💨\n\n${hashtags[plat] || '#Trucks #India'}`,
    `Big news! 🎉 ${topic}\n\nOur truckers work hard every single day to keep India moving. Today we're celebrating them — and all the merchants who trust us with their goods.\n\nThank you for being part of the TruckPlatform family! ❤️\n\n${hashtags[plat] || '#Trucking #India'}`,
    `Just in: ${topic} 🚀\n\nTrucking in India just got a whole lot easier. Book, track, and pay — all in one app. Download TruckPlatform today and see the difference!\n\n${hashtags[plat] || '#App #Logistics'}`,
  ];

  const celebTemplates = [
    `🎊🎉 CELEBRATING: ${topic} 🎉🎊\n\nThis is a huge milestone for our entire TruckPlatform family — our truckers, merchants, and the amazing team behind the scenes!\n\nThank you for believing in us. The best is yet to come! 🚀🇮🇳\n\n${hashtags[plat] || '#Milestone #Celebration'}`,
    `🥳 WE DID IT! ${topic}\n\nTo every trucker who drove through the night, every merchant who trusted us with their cargo — THIS IS FOR YOU! Together, we're making history in Indian logistics.\n\n#Grateful #TeamTruckPlatform 🚛❤️\n\n${hashtags[plat] || '#Celebration'}`,
  ];

  const templates = tone === 'celebratory' ? celebTemplates : tone === 'casual' ? casualTemplates : proTemplates;
  const idx = Math.abs(topic.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % templates.length;
  return templates[idx];
}

// Priority order: Groq → Claude → OpenAI → Gemini → template fallback (Ollama skipped — not running)
export async function generateCaption(req: CaptionRequest): Promise<string> {
  const prompt = buildPrompt(req);

  const providers: Array<{ name: string; fn: () => Promise<string>; available: boolean }> = [
    { name: 'Groq',   fn: () => generateWithGroq(prompt),   available: !!env.GROQ_API_KEY },
    { name: 'Claude', fn: () => generateWithClaude(prompt), available: !!env.CLAUDE_API_KEY },
    { name: 'OpenAI', fn: () => generateWithOpenAI(prompt), available: !!env.OPENAI_API_KEY },
    { name: 'Gemini', fn: () => generateWithGemini(prompt), available: !!env.GEMINI_API_KEY },
  ];

  for (const provider of providers) {
    if (!provider.available) continue;
    try {
      const result = await provider.fn();
      logger.info(`Caption generated via ${provider.name}`);
      return result;
    } catch (err) {
      logger.warn(`${provider.name} failed, trying next`, { error: (err as Error).message });
    }
  }

  // Rich template fallback — instant, professional, platform-aware
  logger.info('Caption generated via template fallback');
  return generateTemplateCaption(req);
}
