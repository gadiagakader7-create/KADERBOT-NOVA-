import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID, timingSafeEqual } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { AGENT_TOOLS, TOOL_POLICIES } from './src/agent/toolRegistry';
import { createToolImplementations } from './src/agent/toolImplementations';
import { createPendingAction, validateToolArguments } from './src/agent/toolSecurity';
import { runAgentLoop } from './src/agent/modelRouter';
import { registerHttpRoutes } from './src/server/httpRoutes';
import type { PendingAgentAction } from './src/types/agent';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const MEMORY_FILE = path.join(DATA_DIR, 'kaderbot_storage.json');
const BRAVE_USAGE_FILE = path.join(DATA_DIR, 'brave_usage.json');
const NOTES_FILE = path.join(DATA_DIR, 'kaderbot_notes.json');
const ACTION_LOG_FILE = path.join(DATA_DIR, 'kaderbot_action_logs.json');
const EVENTS_FILE = path.join(DATA_DIR, 'kaderbot_events.json');

// === 1. CONSTANTES ET SÉCURITÉ DE L'AGENT ===
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY?.trim() || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN?.trim() || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
const TELEGRAM_ALLOWED_CHAT_IDS = new Set(
  (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);
const MAX_AGENT_ITERATIONS = 4;
const MAX_BRAVE_CALLS_PER_DAY = 100;
const PENDING_ACTION_TTL_MS = 5 * 60 * 1000;
const AGENT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const AGENT_RATE_LIMIT_MAX = 10;


const pendingAgentActions = new Map<string, PendingAgentAction>();
const agentRateLimits = new Map<string, { startedAt: number; count: number }>();

function checkAgentRateLimit(req: express.Request): boolean {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = agentRateLimits.get(key);
  if (!current || now - current.startedAt >= AGENT_RATE_LIMIT_WINDOW_MS) {
    agentRateLimits.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= AGENT_RATE_LIMIT_MAX) return false;
  current.count += 1;
  return true;
}

function requestPendingAction(tool: string, args: Record<string, unknown>): PendingAgentAction {
  return createPendingAction(tool, args, { ttlMs: PENDING_ACTION_TTL_MS, store: pendingAgentActions });
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: 'Fonction d’administration indisponible : ADMIN_TOKEN n’est pas configuré.' });
    return;
  }

  const authorization = req.header('authorization') || '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const providedToken = req.header('x-admin-token')?.trim() || bearerToken;
  const expected = Buffer.from(ADMIN_TOKEN);
  const provided = Buffer.from(providedToken);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: 'Jeton administrateur invalide ou manquant.' });
    return;
  }

  next();
}

// Compteur d'appels Brave en mémoire (Map avec date du jour), persisté dans data/brave_usage.json
const braveDailyUsage = new Map<string, number>();

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadBraveUsage(): void {
  const today = getTodayString();
  try {
    if (fs.existsSync(BRAVE_USAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(BRAVE_USAGE_FILE, 'utf-8'));
      if (data && data.date === today && typeof data.count === 'number') {
        braveDailyUsage.set(today, data.count);
        return;
      }
    }
  } catch (err) {
    console.warn('Erreur lecture brave_usage.json:', err);
  }
  braveDailyUsage.set(today, 0);
}

function checkAndIncrementBraveQuota(): boolean {
  const today = getTodayString();
  if (!braveDailyUsage.has(today)) {
    loadBraveUsage();
  }
  const currentCount = braveDailyUsage.get(today) || 0;
  if (currentCount >= MAX_BRAVE_CALLS_PER_DAY) {
    return false; // Quota de recherche atteint pour aujourd'hui
  }
  const newCount = currentCount + 1;
  braveDailyUsage.set(today, newCount);
  try {
    fs.writeFileSync(
      BRAVE_USAGE_FILE,
      JSON.stringify({ date: today, count: newCount, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn('Erreur persistance brave_usage.json:', err);
  }
  return true;
}

// Initialisation au chargement
loadBraveUsage();

// Sécurité open_url : Liste blanche de domaines interdits (localhost, 127.0.0.1, adresses IP nues, *.internal, *.render.com)
function isUrlForbidden(urlStr: string): { forbidden: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    // Protocole http ou https obligatoire
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { forbidden: true, reason: 'Protocole non autorisé (seuls http et https sont acceptés).' };
    }

    // Localhost
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return { forbidden: true, reason: 'Accès refusé : domaine localhost interdit.' };
    }

    // 127.0.0.1 ou boucle locale
    if (hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return { forbidden: true, reason: 'Accès refusé : adresse de bouclage locale interdite.' };
    }

    // Adresses IP nues (IPv4 standard ou IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(hostname)) {
      return { forbidden: true, reason: 'Accès refusé : adresses IP directes non autorisées.' };
    }
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      return { forbidden: true, reason: 'Accès refusé : adresses IPv6 directes non autorisées.' };
    }

    // *.internal
    if (hostname === 'internal' || hostname.endsWith('.internal')) {
      return { forbidden: true, reason: 'Accès refusé : réseaux internes (*.internal) non autorisés.' };
    }

    // *.render.com
    if (hostname === 'render.com' || hostname.endsWith('.render.com')) {
      return { forbidden: true, reason: 'Accès refusé : domaine de plateforme d’hébergement (*.render.com) interdit.' };
    }

    return { forbidden: false };
  } catch (err: any) {
    return { forbidden: true, reason: `URL invalide : ${err.message}` };
  }
}

// Helpers de stockage mémoire cognitive locale
function readStorageFile(): {
  memoire: Record<string, any[]>;
  regles: Record<string, any[]>;
  liens: Record<string, string[]>;
  synonymes: Record<string, any>;
  sessions: string[];
} {
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      return {
        memoire: parsed.memoire || {},
        regles: parsed.regles || {},
        liens: parsed.liens || {},
        synonymes: parsed.synonymes || {},
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : ['defaut'],
      };
    } catch (e) {
      console.warn('Erreur lecture kaderbot_storage.json:', e);
    }
  }
  return { memoire: {}, regles: {}, liens: {}, synonymes: {}, sessions: ['defaut'] };
}

function writeStorageFile(data: any): void {
  try {
    fs.writeFileSync(
      MEMORY_FILE,
      JSON.stringify(
        {
          memoire: data.memoire || {},
          regles: data.regles || {},
          liens: data.liens || {},
          synonymes: data.synonymes || {},
          sessions: Array.isArray(data.sessions) ? data.sessions : ['defaut'],
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (err) {
    console.error('Erreur écriture kaderbot_storage.json:', err);
  }
}

type KaderbotNote = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type AgentActionLog = {
  id: string;
  tool: string;
  args?: Record<string, unknown>;
  status: 'success' | 'error' | 'rejected' | 'expired';
  message?: string;
  createdAt: string;
};

type KaderbotEvent = {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  location?: string;
  description?: string;
  createdAt: string;
};

function readJsonArray<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Erreur lecture ${filePath}:`, err);
    return [];
  }
}

function writeJsonArray<T>(filePath: string, data: T[]): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function appendActionLog(entry: Omit<AgentActionLog, 'id' | 'createdAt'>): void {
  try {
    const logs = readJsonArray<AgentActionLog>(ACTION_LOG_FILE);
    logs.push({ ...entry, id: randomUUID(), createdAt: new Date().toISOString() });
    writeJsonArray(ACTION_LOG_FILE, logs.slice(-500));
  } catch (err) {
    console.warn('Erreur écriture journal agentique:', err);
  }
}

// Helper to get GoogleGenAI client with explicit API Key (prevents Application Default Credentials lookup)
function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const DEFAULT_SYSTEM_PROMPT =
  'Tu es KADERBOT NOVA, un assistant IA expert et pédagogue. Tu réponds toujours en français.\n' +
  'RÈGLES DE FORMATAGE : Structure tes réponses avec du Markdown (sauts de ligne, listes à puces, gras).\n' +
  'RÈGLE DE LONGUEUR ABSOLUE : Ta réponse ne doit jamais dépasser 120 mots. Sois direct et synthétique. Si un sujet est vaste (comme l\'histoire d\'une invention), donne uniquement les 2 ou 3 points les plus importants, et termine en proposant à l\'utilisateur de préciser sa question pour plus de détails. Ne fais JAMAIS de réponse de plus de 4 paragraphes.';

// Helper to normalize and resolve Groq model IDs accurately (Catalogue Octobre 2026)
export function resolveGroqModel(requestedModel?: string): string {
  if (!requestedModel) return 'openai/gpt-oss-120b';
  const clean = requestedModel.trim().toLowerCase();

  // Si demande de 120b
  if (
    clean === 'openai/gpt-oss-120b' ||
    clean.includes('gpt-oss-120b') ||
    clean.includes('120b')
  ) {
    return 'openai/gpt-oss-120b';
  }

  // Si demande de 20b
  if (
    clean === 'openai/gpt-oss-20b' ||
    clean.includes('gpt-oss-20b') ||
    clean.includes('20b')
  ) {
    return 'openai/gpt-oss-20b';
  }

  // Toute demande de modèle inconnu ou déprécié → 'openai/gpt-oss-20b'
  return 'openai/gpt-oss-20b';
}

// Helper to call Groq with candidate fallback and clean error management
async function callGroqWithFallback(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  requestedModel = 'openai/gpt-oss-120b',
  history: Array<{ role: string; content: string }> = []
): Promise<{ text: string; actualModel: string }> {
  const primaryModel = resolveGroqModel(requestedModel);

  // Candidate models sur Groq : ces deux-là uniquement (Catalogue Octobre 2026)
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ])
  );

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt },
  ];

  let lastError = '';

  for (let idx = 0; idx < candidateModels.length; idx++) {
    const modelToTry = candidateModels[idx];
    const nextModel = candidateModels[idx + 1];

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToTry,
          messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        return { text: content, actualModel: modelToTry };
      }

      const errData = await response.json().catch(() => null);
      const errMsg = errData?.error?.message || `HTTP ${response.status}`;
      lastError = errMsg;

      if (nextModel) {
        console.warn(`[BASCULE GROQ] Modèle "${modelToTry}" a échoué (cause: ${errMsg}). Bascule vers "${nextModel}"...`);
      } else {
        console.warn(`[BASCULE GROQ] Modèle "${modelToTry}" a échoué (cause: ${errMsg}). Aucun autre modèle Groq disponible.`);
      }

      // Si HTTP 401 (clé API invalide), inutile de réessayer les autres modèles avec la même clé
      if (response.status === 401) {
        break;
      }
    } catch (e: any) {
      lastError = e.message;
      if (nextModel) {
        console.warn(`[BASCULE GROQ] Exception sur "${modelToTry}" (cause: ${e.message}). Bascule vers "${nextModel}"...`);
      }
    }
  }

  throw new Error(`Groq: ${lastError}`);
}

// Helper to normalize and resolve OpenRouter model IDs accurately
export function resolveOpenRouterModel(requestedModel?: string): string {
  const defaultModel = 'meta-llama/llama-3.3-70b-instruct:free';
  if (!requestedModel) return defaultModel;
  let clean = requestedModel.trim();
  const lower = clean.toLowerCase();

  // Ne JAMAIS utiliser openai/gpt-oss-120b sur OpenRouter (réservé à Groq)
  if (lower.includes('gpt-oss') || lower.includes('gpt') || lower.includes('oss')) {
    return defaultModel;
  }

  // Normalisation des modèles
  if (lower.includes('llama-3.3-70b') || lower.includes('llama') || lower.includes('70b')) {
    return defaultModel;
  }
  if (lower.includes('qwen')) {
    return 'qwen/qwen3-coder:free';
  }
  if (lower.includes('deepseek') || lower.includes('r1')) {
    return 'deepseek/deepseek-r1:free';
  }

  // Le suffixe :free est obligatoire pour utiliser le quota gratuit
  if (!clean.endsWith(':free')) {
    clean = `${clean}:free`;
  }

  return clean;
}

// Helper to call OpenRouter with candidate fallback and clean quota management
async function callOpenRouterWithFallback(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  requestedModel = 'meta-llama/llama-3.3-70b-instruct:free',
  history: Array<{ role: string; content: string }> = []
): Promise<{ text: string; actualModel: string }> {
  const primaryModel = resolveOpenRouterModel(requestedModel);

  // Modèles candidats dans l'ordre strict demandé (sans jamais gpt-oss-120b)
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen3-coder:free',
      'deepseek/deepseek-r1:free',
    ])
  );

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt },
  ];

  let lastError = '';

  for (const modelToTry of candidateModels) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kaderbot.app',
          'X-Title': 'KADERBOT NOVA',
        },
        body: JSON.stringify({
          model: modelToTry,
          messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        return { text: content, actualModel: modelToTry };
      }

      const errData = await response.json().catch(() => null);
      const errMsg = errData?.error?.message || `HTTP ${response.status}`;
      lastError = errMsg;

      // Si HTTP 429 (quota épuisé) ou 401 (clé invalide), NE PAS retenter avec un autre modèle :
      // lancer immédiatement l'erreur pour déclencher le fallback vers Gemini/Groq
      if (response.status === 429 || response.status === 401) {
        throw new Error('OpenRouter: quota épuisé ou clé invalide');
      }

      // Si HTTP 404 (modèle introuvable), passer au modèle suivant
      if (response.status === 404) {
        console.warn(`Modèle OpenRouter "${modelToTry}" non accessible (404), tentative avec modèle suivant...`);
        continue;
      }

      console.warn(`Erreur OpenRouter sur "${modelToTry}" (${response.status}: ${errMsg}), tentative avec modèle suivant...`);
    } catch (e: any) {
      if (e.message === 'OpenRouter: quota épuisé ou clé invalide') {
        throw e;
      }
      lastError = e.message;
    }
  }

  throw new Error(`OpenRouter: ${lastError || 'indisponible'}`);
}

// Helper to call Gemini with explicit API Key and direct REST fallback (Never uses Application Default Credentials)
async function callGeminiWithFallback(
  fullPrompt: string,
  systemInstruction?: string
): Promise<{ text: string; model: string }> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    throw new Error('Variable GEMINI_API_KEY non configurée sur le serveur. Veuillez définir votre clé API Gemini.');
  }

  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  // 1. Try with explicit GoogleGenAI client (with explicit apiKey)
  try {
    const aiClient = createGeminiClient(geminiKey);
    for (let i = 0; i < modelsToTry.length; i++) {
      const m = modelsToTry[i];
      const nextM = modelsToTry[i + 1];
      try {
        const response = await aiClient.models.generateContent({
          model: m,
          contents: fullPrompt,
          config: systemInstruction ? { systemInstruction } : undefined,
        });
        const text = response.text?.trim();
        if (text) {
          return { text, model: m };
        }
      } catch (err: any) {
        if (nextM) {
          console.warn(`[BASCULE GEMINI SDK] Modèle "${m}" a échoué (cause: ${err.message}). Bascule vers "${nextM}"...`);
        } else {
          console.warn(`[BASCULE GEMINI SDK] Modèle "${m}" a échoué (cause: ${err.message}). Bascule sur REST direct...`);
        }
        lastError = err;
      }
    }
  } catch (sdkInitErr: any) {
    console.warn('Erreur initialisation SDK Gemini, bascule sur REST direct:', sdkInitErr.message);
    lastError = sdkInitErr;
  }

  // 2. Direct REST Fallback (Simple API Key only, zero Google Cloud ADC or metadata)
  for (let i = 0; i < modelsToTry.length; i++) {
    const m = modelsToTry[i];
    const nextM = modelsToTry[i + 1];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return { text, model: m };
        }
      } else {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
        lastError = new Error(errMsg);
        if (nextM) {
          console.warn(`[BASCULE GEMINI REST] Modèle "${m}" a échoué (cause: ${errMsg}). Bascule vers "${nextM}"...`);
        } else {
          console.warn(`[BASCULE GEMINI REST] Modèle "${m}" a échoué (cause: ${errMsg}).`);
        }
      }
    } catch (restErr: any) {
      lastError = restErr;
      if (nextM) {
        console.warn(`[BASCULE GEMINI REST] Exception sur "${m}" (cause: ${restErr.message}). Bascule vers "${nextM}"...`);
      }
    }
  }

  throw lastError || new Error('Les modèles Gemini sont temporairement indisponibles.');
}

// === 2. REGISTRE CENTRAL DES OUTILS ===
// Helper pour exécuter une recherche sur l'API Brave (Search ou News)
async function executeBraveSearch(query: string, isNews: boolean): Promise<string> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim() || BRAVE_API_KEY;
  if (!apiKey) {
    return "Clé BRAVE_SEARCH_API_KEY non configurée sur le serveur. Impossible d'effectuer la recherche web.";
  }

  if (!checkAndIncrementBraveQuota()) {
    return "Quota de recherche atteint pour aujourd'hui.";
  }

  const endpoint = isNews
    ? 'https://api.search.brave.com/res/v1/news/search'
    : 'https://api.search.brave.com/res/v1/web/search';

  const url = `${endpoint}?q=${encodeURIComponent(query)}&count=5&country=fr&search_lang=fr`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      if (resp.status === 429) {
        return "Quota de recherche atteint pour aujourd'hui.";
      }
      return `Erreur Brave Search (HTTP ${resp.status} : ${resp.statusText}).`;
    }

    const data: any = await resp.json();
    const results = isNews ? (data.results || []) : (data.web?.results || []);

    if (!Array.isArray(results) || results.length === 0) {
      return `Aucun résultat ${isNews ? 'd’actualité' : 'web'} trouvé pour la requête : "${query}".`;
    }

    return results
      .slice(0, 5)
      .map((item: any, idx: number) => {
        const title = item.title || 'Sans titre';
        const itemUrl = item.url || '';
        const snippet = item.description || item.snippet || 'Pas de description';
        return `[${idx + 1}] ${title}\nURL: ${itemUrl}\nRésumé: ${snippet}`;
      })
      .join('\n\n');
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return "Erreur Délai d'attente dépassé (timeout 6s) pour la recherche Brave.";
    }
    return `Erreur réseau lors de la recherche Brave : ${err.message}`;
  }
}

// === 4. IMPLÉMENTATIONS DES OUTILS ===
const TOOL_IMPLEMENTATIONS = createToolImplementations({
  executeBraveSearch,
  isUrlForbidden,
  readStorageFile,
  writeStorageFile,
  readJsonArray,
  writeJsonArray,
  notesFile: NOTES_FILE,
  eventsFile: EVENTS_FILE,
  telegramBotToken: TELEGRAM_BOT_TOKEN,
  telegramAllowedChatIds: TELEGRAM_ALLOWED_CHAT_IDS,
});

// === 5. LA BOUCLE AGENTIQUE ===
const AGENT_SYSTEM_PROMPT =
  'Tu es KADERBOT, un agent cognitif d’élite doté d’outils de recherche et d’analyse.\n' +
  'RÈGLES CRUCIALES :\n' +
  '(1) Vérifie toujours memo_lookup avant search_web si le sujet peut déjà être connu localement.\n' +
  '(2) Recherche sur le web via search_news ou search_web pour tout fait récent ou d’actualité.\n' +
  '(3) Si open_url renvoie une erreur (403, accès protégé, anti-bot ou timeout), ignore immédiatement cette source et passe aux autres URLs trouvées ou utilise les résumés de recherche.\n' +
  '(4) Si l’utilisateur demande "Continue" ou "continuer", utilise directement les informations déjà réunies pour produire la synthèse finale sans relancer de boucle superflue.\n' +
  '(5) Pour créer une note, utilise create_note ; pour chercher une note, utilise search_notes.\n' +
  '(6) Pour Telegram, utilise send_message avec channel=telegram et confirm=true ; une confirmation utilisateur sera demandée avant l’envoi.\n' +
  '(7) Pour WhatsApp, utilise send_message avec channel=whatsapp : cela prépare seulement un lien, sans envoi automatique.\n' +
  '(8) Pour l’agenda, utilise create_event ou list_events. Demande toujours des dates ISO 8601 avec fuseau horaire si elles sont ambiguës.\n' +
  '(9) Réponds toujours dans la langue de l’utilisateur, de façon concise et sans inventer.';

// Helper exécutant la boucle d'outils agentique pour un endpoint/modèle donné (Groq ou OpenRouter)
const reactLoopDeps = {
  agentTools: AGENT_TOOLS,
  toolPolicies: TOOL_POLICIES,
  toolImplementations: TOOL_IMPLEMENTATIONS,
  validateToolArguments,
  requestPendingAction,
  defaultSystemPrompt: AGENT_SYSTEM_PROMPT,
  maxAgentIterations: MAX_AGENT_ITERATIONS,
  maxLoopDurationMs: 25000,
};

// Cascade agentique complète : Groq 120B → Groq 20B → Gemini (sans tools) → OpenRouter Nemotron (avec tools)
const modelRouterDeps = {
  groqApiKey: process.env.GROQ_API_KEY,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  defaultSystemPrompt: AGENT_SYSTEM_PROMPT,
  reactLoopDeps,
  callGeminiWithFallback,
};

// === ROUTER INTENTION (CHAT vs AGENT) ===
async function classifyIntentWithRouter(
  userPrompt: string,
  _history: Array<{ role: string; content: string }> = []
): Promise<'CHAT' | 'AGENT'> {
  const clean = userPrompt.trim().toLowerCase();
  // Si l'utilisateur demande de continuer ou poursuivre, c'est immédiatement une tâche AGENT
  if (['continue', 'continuer', 'poursuis', 'vas-y', 'go on', 'suite'].includes(clean)) {
    return 'AGENT';
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) {
    // Si pas de clé Groq, basculer par défaut sur AGENT pour préserver la cascade
    return 'AGENT';
  }

  try {
    const classificationPrompt = `Réponds uniquement CHAT ou AGENT. AGENT si le message demande une recherche web, une info actuelle ou factuelle hors mémoire, ou apprendre/mémoriser un fait. CHAT sinon (salutations, conversation, opinions, création).

Message: "${userPrompt.replace(/"/g, '\\"')}"
Classification:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: classificationPrompt }],
        max_tokens: 150,
        temperature: 0,
        reasoning_format: 'parsed',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[ROUTER AGENT] Classification HTTP ${response.status}, défaut = AGENT`);
      return 'AGENT';
    }

    const data: any = await response.json();
    const msgObj = data.choices?.[0]?.message;
    const content = (msgObj?.content || '').trim().toUpperCase();
    const reasoning = (msgObj?.reasoning || '').trim().toUpperCase();

    if (content.includes('CHAT') || (!content && reasoning.slice(-80).includes('CHAT'))) {
      return 'CHAT';
    }
    return 'AGENT';
  } catch (err: any) {
    console.warn(`[ROUTER AGENT] Erreur classification (${err.message}), défaut = AGENT`);
    return 'AGENT';
  }
}

registerHttpRoutes(app, {
  callGeminiWithFallback,
  callGroqWithFallback,
  callOpenRouterWithFallback,
  resolveGroqModel,
  resolveOpenRouterModel,
  defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
  agentSystemPrompt: AGENT_SYSTEM_PROMPT,
  requireAdmin,
  checkAgentRateLimit,
  classifyIntentWithRouter,
  runAgentLoop,
  modelRouterDeps,
  memoryFile: MEMORY_FILE,
  notesFile: NOTES_FILE,
  actionLogFile: ACTION_LOG_FILE,
  eventsFile: EVENTS_FILE,
  projectRoot: __dirname,
  readStorageFile,
  readJsonArray,
  appendActionLog,
  pendingAgentActions,
  toolImplementations: TOOL_IMPLEMENTATIONS,
  validateToolArguments,
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur KADERBOT NOVA opérationnel sur http://localhost:${PORT}`);
  });
}

startServer();
