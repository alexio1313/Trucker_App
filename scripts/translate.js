#!/usr/bin/env node
/**
 * AI Translation Script — Trucker Platform
 *
 * Translation chain (in order):
 *   1. Ollama (local LLM, free, private) — primary
 *   2. Groq  (cloud, free tier, fast)   — fallback
 *
 * Usage:
 *   node scripts/translate.js              # translate all missing keys in all languages
 *   node scripts/translate.js --lang hi    # translate only Hindi
 *   node scripts/translate.js --force      # re-translate everything even if file exists
 *
 * Env vars:
 *   OLLAMA_URL    defaults to http://localhost:11434
 *   GROQ_API_KEY  required for Groq fallback (get free key at console.groq.com)
 *   OLLAMA_MODEL  defaults to llama3.2:3b
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL   = 'llama-3.1-8b-instant';  // free, fast, good quality

const LOCALES_DIR = path.join(__dirname, '..', 'apps', 'web', 'src', 'locales');
const EN_FILE     = path.join(LOCALES_DIR, 'en.json');

const LANGUAGES = {
  hi: 'Hindi',
  pa: 'Punjabi',
  gu: 'Gujarati',
  mr: 'Marathi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  bn: 'Bengali',
  ml: 'Malayalam',
  or: 'Odia',
  ur: 'Urdu',
};

// Parse CLI args
const args     = process.argv.slice(2);
const forceAll = args.includes('--force');
const langArg  = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
const targetLangs = langArg
  ? { [langArg]: LANGUAGES[langArg] }
  : LANGUAGES;

// ── Domain system prompt ──────────────────────────────────────────────────────

function buildPrompt(langName, englishJson) {
  return `You are a professional translator for an Indian trucking logistics mobile app.
Translate the following JSON from English to ${langName}.

Context: This is a trucker/freight logistics app used by truck drivers on Indian highways.
Terms like "load", "trucker", "pickup", "deliver", "toll", "fuel stop" are logistics terms.

Rules:
- Return ONLY a valid JSON object — no explanation, no markdown, no code fences
- Keep every key exactly as-is, only translate the values
- Keep translations SHORT and simple (under 8 words)
- Use words a truck driver would naturally say
- Preserve any special characters like →, ₹, …, !
- Do NOT translate keys, only values

English JSON to translate:
${JSON.stringify(englishJson, null, 2)}

${langName} JSON:`;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpPost(urlStr, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const url    = new URL(urlStr);
    const lib    = url.protocol === 'https:' ? https : http;
    const body   = JSON.stringify(payload);
    const opts   = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
      timeout:  120000,
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { reject(new Error(`JSON parse failed: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

// ── Provider: Ollama ─────────────────────────────────────────────────────────

async function ollamaAvailable() {
  try {
    const r = await httpPost(`${OLLAMA_URL}/api/tags`, {}).catch(() => null);
    if (!r || r.status !== 200) return false;
    const models = r.body.models || [];
    return models.some(m => m.name.startsWith(OLLAMA_MODEL.split(':')[0]));
  } catch { return false; }
}

async function translateWithOllama(prompt) {
  const res = await httpPost(`${OLLAMA_URL}/api/generate`, {
    model:  OLLAMA_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.1, num_predict: 4096 },
  });
  if (res.status !== 200) throw new Error(`Ollama HTTP ${res.status}`);
  const text = res.body.response || '';
  return extractJson(text);
}

// ── Provider: Groq ────────────────────────────────────────────────────────────

async function translateWithGroq(prompt) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const res = await httpPost(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model:       GROQ_MODEL,
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens:  4096,
    },
    { Authorization: `Bearer ${GROQ_API_KEY}` }
  );
  if (res.status !== 200) {
    const err = res.body.error?.message || JSON.stringify(res.body);
    throw new Error(`Groq HTTP ${res.status}: ${err}`);
  }
  const text = res.body.choices?.[0]?.message?.content || '';
  return extractJson(text);
}

// ── JSON extraction ───────────────────────────────────────────────────────────

function extractJson(text) {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  // Find first { ... } block
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON object found in: ${cleaned.slice(0, 200)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ── Merge: keep existing, only add missing ────────────────────────────────────

function mergeTranslations(existing, translated, source) {
  const result = { ...existing };
  let added = 0;
  for (const [key, val] of Object.entries(translated)) {
    if (key in source && !(key in existing)) {
      result[key] = val;
      added++;
    }
  }
  return { result, added };
}

// ── Validate output ───────────────────────────────────────────────────────────

function validate(source, translated) {
  const missing  = Object.keys(source).filter(k => !(k in translated));
  const extra    = Object.keys(translated).filter(k => !(k in source));
  const tooLong  = Object.entries(translated).filter(([, v]) => v.split(' ').length > 12).map(([k]) => k);
  return { missing, extra, tooLong };
}

// ── Main per-language translation ─────────────────────────────────────────────

async function translateLanguage(langCode, langName, sourceStrings, useOllama) {
  const outFile = path.join(LOCALES_DIR, `${langCode}.json`);

  // Load existing translations (if any)
  let existing = {};
  if (!forceAll && fs.existsSync(outFile)) {
    existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  }

  // Check which keys are missing
  const missingKeys = Object.keys(sourceStrings).filter(k => !(k in existing));
  if (missingKeys.length === 0) {
    console.log(`  ✓ ${langCode} (${langName}) — already complete, skipping`);
    return true;
  }

  const toTranslate = Object.fromEntries(missingKeys.map(k => [k, sourceStrings[k]]));
  console.log(`  → ${langCode} (${langName}) — translating ${missingKeys.length} keys…`);

  const prompt = buildPrompt(langName, toTranslate);
  let translated = null;
  let provider   = '';

  // Try Ollama first
  if (useOllama) {
    try {
      translated = await translateWithOllama(prompt);
      provider   = 'ollama';
    } catch (e) {
      console.log(`     Ollama failed (${e.message.slice(0, 60)}), trying Groq…`);
    }
  }

  // Fallback to Groq
  if (!translated) {
    try {
      translated = await translateWithGroq(prompt);
      provider   = 'groq';
    } catch (e) {
      console.error(`     ✗ Groq also failed: ${e.message}`);
      console.error(`     → Set GROQ_API_KEY env var: export GROQ_API_KEY=gsk_...`);
      return false;
    }
  }

  // Merge with existing
  const { result, added } = mergeTranslations(existing, translated, sourceStrings);

  // Validate
  const { missing, tooLong } = validate(sourceStrings, result);
  if (missing.length > 0) {
    console.log(`     ⚠ Still missing ${missing.length} keys: ${missing.slice(0,5).join(', ')}…`);
  }
  if (tooLong.length > 0) {
    console.log(`     ⚠ ${tooLong.length} values may be too long: ${tooLong.slice(0,3).join(', ')}`);
  }

  // Write
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`     ✓ ${added} keys added via ${provider} → ${langCode}.json`);
  return true;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌐 TruckPlatform i18n Translation Script');
  console.log('─'.repeat(48));

  if (!fs.existsSync(EN_FILE)) {
    console.error('✗ English locale not found:', EN_FILE);
    process.exit(1);
  }
  fs.mkdirSync(LOCALES_DIR, { recursive: true });

  const sourceStrings = JSON.parse(fs.readFileSync(EN_FILE, 'utf8'));
  console.log(`Source: ${Object.keys(sourceStrings).length} keys from en.json`);

  // Check Ollama
  const useOllama = await ollamaAvailable();
  if (useOllama) {
    console.log(`Ollama: ✓ available (${OLLAMA_MODEL})`);
  } else {
    console.log(`Ollama: ✗ not available — using Groq only`);
    if (!GROQ_API_KEY) {
      console.error('✗ Neither Ollama nor GROQ_API_KEY available.');
      console.error('  Set GROQ_API_KEY=gsk_... (free at console.groq.com)');
      process.exit(1);
    }
  }
  if (GROQ_API_KEY) console.log(`Groq:   ✓ key set (fallback ready)`);
  else              console.log(`Groq:   ✗ no key (Ollama only, no fallback)`);
  console.log('');

  let ok = 0, fail = 0;
  for (const [code, name] of Object.entries(targetLangs)) {
    const success = await translateLanguage(code, name, sourceStrings, useOllama);
    success ? ok++ : fail++;
    // Small delay between languages to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n─`.repeat(48));
  console.log(`Done: ${ok} languages translated, ${fail} failed`);
  if (ok > 0) {
    console.log(`\nRun "npm run build" in apps/web to pick up new translations.`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
