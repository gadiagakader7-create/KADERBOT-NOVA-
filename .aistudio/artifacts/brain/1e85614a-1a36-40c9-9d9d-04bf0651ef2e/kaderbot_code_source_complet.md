# Code Source Complet — KADERBOT NOVA

Ce document rassemble l'intégralité du code source de l'application **KADERBOT NOVA**, intégrant la boucle **ReAct (Reasoning + Acting)** étendue à **25 itérations**, la recherche sémantique hybride (`@xenova/transformers` + filtrage mots-clés), les outils de navigation web (Brave API + scraping avec empreinte réaliste anti-403) et l'interface utilisateur épurée dotée des fenêtres accordéons repliables **« Réflexion »**.

---

## Sommaire des Fichiers Inclus
- [`package.json`](#packagejson) — Configuration des dépendances et scripts du projet *(39 lignes)*
- [`vite.config.ts`](#viteconfigts) — Configuration du bundler Vite, aliases et shims *(26 lignes)*
- [`server.ts`](#serverts) — Serveur Express & Boucle Agentique ReAct (25 itérations, outils Brave/Web/Mémoire) *(2749 lignes)*
- [`src/types/kaderbot.ts`](#srctypeskaderbotts) — Typage TypeScript complet (ReAct, Mémoire, Messages, Graphe) *(117 lignes)*
- [`src/services/apiService.ts`](#srcservicesapiServicets) — Service API client avec appel agent ReAct et timeout 120s *(374 lignes)*
- [`src/shims/style-to-js.ts`](#srcshimsstyle-to-jsts) — Shim ESM natif pour compatibilité style-to-js / react-markdown *(61 lignes)*
- [`src/components/ChatTab.tsx`](#srccomponentsChatTabtsx) — Interface Chat avec accordéons Réflexion (live & ReAct breakdown) *(1326 lignes)*
- [`src/App.tsx`](#srcApptsx) — Composant racine, gestion de session et moteur hybride *(1553 lignes)*
- [`src/core/cognitiveEngine.ts`](#srccorecognitiveEnginets) — Moteur cognitif, recherche sémantique hybride et déduction logique *(1427 lignes)*
- [`src/components/Header.tsx`](#srccomponentsHeadertsx) — En-tête de navigation et statut des connexions *(271 lignes)*
- [`src/components/KnowledgeGraphTab.tsx`](#srccomponentsKnowledgeGraphTabtsx) — Visualisation et gestion du graphe de connaissances *(518 lignes)*
- [`src/components/RulesTab.tsx`](#srccomponentsRulesTabtsx) — Gestion des règles logiques et inférences *(307 lignes)*
- [`src/components/SessionsTab.tsx`](#srccomponentsSessionsTabtsx) — Gestion multi-sessions de la mémoire cognitive *(596 lignes)*
- [`src/components/ToolsTab.tsx`](#srccomponentsToolsTabtsx) — Console d'outils et tests des moteurs LLM *(543 lignes)*
- [`src/components/SettingsModal.tsx`](#srccomponentsSettingsModaltsx) — Modal des paramètres et configuration système *(771 lignes)*
- [`src/components/ActionMenuModal.tsx`](#srccomponentsActionMenuModaltsx) — Menu d'actions rapides et interactions *(242 lignes)*
- [`index.html`](#indexhtml) — Point d'entrée HTML et métadonnées PWA/SEO *(26 lignes)*

---

<a id="packagejson"></a>
## Fichier : `package.json`

> **Description** : Configuration des dépendances et scripts du projet

```json
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build",
    "start": "tsx server.ts",
    "preview": "vite preview",
    "clean": "rm -rf dist server.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "@xenova/transformers": "^2.17.2",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "react-markdown": "^10.1.0",
    "vite": "^8.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.28.2",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2",
    "@types/express": "^4.17.21"
  }
}
```

---

<a id="viteconfigts"></a>
## Fichier : `vite.config.ts`

> **Description** : Configuration du bundler Vite, aliases et shims

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
        'style-to-js': path.resolve(rootDir, 'src/shims/style-to-js.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
```

---

<a id="serverts"></a>
## Fichier : `server.ts`

> **Description** : Serveur Express & Boucle Agentique ReAct (25 itérations, outils Brave/Web/Mémoire)

```typescript
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID, timingSafeEqual } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { AGENT_TOOLS, TOOL_POLICIES } from './src/agent/toolRegistry';
import type { PendingAgentAction } from './src/types/agent';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : NaN;
const PORT = Number(process.env.PORT) || (!Number.isNaN(cliPort) && cliPort > 0 ? cliPort : 3000);

const hostArgIndex = process.argv.indexOf('--host');
const cliHost = hostArgIndex !== -1 && process.argv[hostArgIndex + 1] ? process.argv[hostArgIndex + 1] : undefined;
const HOST = process.env.HOST || cliHost || '0.0.0.0';

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

function validateToolArguments(tool: string, args: Record<string, unknown>): string | null {
  const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  const policy = TOOL_POLICIES[tool];
  if (!policy) return `Outil non autorisé : ${tool}`;

  if (tool === 'search_web' || tool === 'search_news' || tool === 'memo_lookup') {
    const key = tool === 'memo_lookup' ? 'sujet' : 'query';
    if (!isNonEmptyString(args[key]) || String(args[key]).length > 500) return `Paramètre ${key} invalide.`;
  }
  if (tool === 'search_notes' && (!isNonEmptyString(args.query) || String(args.query).length > 500)) return 'Paramètre query invalide.';
  if (tool === 'list_events') {
    if (!isNonEmptyString(args.start_iso) || !isNonEmptyString(args.end_iso)) return 'Période de recherche requise.';
    if (Number.isNaN(Date.parse(String(args.start_iso))) || Number.isNaN(Date.parse(String(args.end_iso)))) return 'Dates ISO invalides.';
  }
  if (tool === 'create_event') {
    if (!isNonEmptyString(args.title) || !isNonEmptyString(args.start_iso) || !isNonEmptyString(args.end_iso)) return 'Titre et dates requis pour l’événement.';
    const start = Date.parse(String(args.start_iso));
    const end = Date.parse(String(args.end_iso));
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 'Période de l’événement invalide.';
    if (String(args.title).length > 200) return 'Titre d’événement trop long.';
  }
  if (tool === 'open_url' && (!isNonEmptyString(args.url) || String(args.url).length > 2048)) return 'Paramètre url invalide.';
  if (tool === 'memo_store' && (!isNonEmptyString(args.sujet) || !isNonEmptyString(args.definition))) return 'Sujet et définition requis.';
  if (tool === 'link_concepts' && (!isNonEmptyString(args.source) || !isNonEmptyString(args.cible))) return 'Source et cible requises.';
  if (tool === 'ask_user' && (!isNonEmptyString(args.question) || String(args.question).length > 500)) return 'Question invalide.';

  if (tool === 'create_note') {
    if (!isNonEmptyString(args.title) || !isNonEmptyString(args.body)) return 'Titre et contenu requis pour la note.';
    if (String(args.title).length > 200 || String(args.body).length > 10000) return 'Note trop longue.';
    if (args.tags !== undefined && (!Array.isArray(args.tags) || args.tags.some(tag => !isNonEmptyString(tag)))) return 'Tags invalides.';
  }

  if (tool === 'send_message') {
    if (!['sms', 'telegram', 'whatsapp'].includes(String(args.channel))) return 'Canal de message non autorisé.';
    if (!isNonEmptyString(args.target) || !isNonEmptyString(args.text)) return 'Destinataire et texte requis.';
    if (String(args.text).length > 4000) return 'Message trop long.';
    if ((args.channel === 'sms' || args.channel === 'telegram') && args.confirm !== true) return 'Confirmation explicite requise pour ce canal.';
  }
  return null;
}

function summarizePendingAction(tool: string, args: Record<string, unknown>): string {
  if (tool === 'memo_store') return `Mémoriser « ${String(args.sujet)} » : ${String(args.definition).slice(0, 180)}`;
  if (tool === 'link_concepts') return `Créer le lien « ${String(args.source)} » → « ${String(args.cible)} »`;
  if (tool === 'create_note') return `Créer la note « ${String(args.title)} »`;
  if (tool === 'send_message') return `Envoyer un message ${String(args.channel)} à ${String(args.target)} : « ${String(args.text).slice(0, 180)} »`;
  if (tool === 'create_event') return `Créer l’événement « ${String(args.title || 'sans titre')} »`;
  return `Autoriser l’action ${tool}`;
}

function createPendingAction(tool: string, args: Record<string, unknown>): PendingAgentAction {
  const expiresAt = new Date(Date.now() + PENDING_ACTION_TTL_MS).toISOString();
  const action: PendingAgentAction = {
    id: randomUUID(),
    tool,
    args,
    summary: summarizePendingAction(tool, args),
    risk: TOOL_POLICIES[tool]?.risk === 'external' ? 'external' : 'write',
    expiresAt,
  };
  pendingAgentActions.set(action.id, action);
  return action;
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

// 0. Gemini Connection Tester Endpoint (Uses process.env.GEMINI_API_KEY explicitly)
app.post('/api/gemini/test', async (req, res) => {
  try {
    const keyToUse = process.env.GEMINI_API_KEY?.trim() || req.body?.apiKey?.trim();
    if (!keyToUse) {
      return res.status(400).json({
        ok: false,
        error: 'Aucune variable GEMINI_API_KEY configurée sur le serveur.',
      });
    }

    const start = Date.now();
    const result = await callGeminiWithFallback('Réponds en un seul mot: "Connecté".');
    const latencyMs = Date.now() - start;

    return res.json({
      ok: true,
      model: result.model,
      latencyMs,
      reply: result.text?.trim() || 'Connecté',
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 0.1 Groq Connection & Model Tester Endpoint (Uses process.env.GROQ_API_KEY exclusively)
app.post('/api/groq/test', async (req, res) => {
  try {
    const keyToUse = process.env.GROQ_API_KEY || req.body?.apiKey;
    const model = req.body?.model || 'openai/gpt-oss-120b';

    if (!keyToUse) {
      return res.status(400).json({
        ok: false,
        error: 'Aucune variable GROQ_API_KEY configurée sur le serveur.',
      });
    }

    const resolvedModel = resolveGroqModel(model);
    const start = Date.now();

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyToUse.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: 'user', content: 'Réponds en un seul mot: "Connecté".' }],
        max_tokens: 20,
      }),
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || 'Connecté';
      return res.json({
        ok: true,
        model: resolvedModel,
        latencyMs,
        reply,
      });
    }

    const errData = await response.json().catch(() => null);
    const errMsg = errData?.error?.message || `Erreur HTTP ${response.status}`;
    return res.status(response.status).json({
      ok: false,
      status: response.status,
      error: errMsg,
      model: resolvedModel,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 0.2 OpenRouter Connection & Model Tester Endpoint (Uses process.env.OPENROUTER_API_KEY exclusively)
app.post('/api/openrouter/test', async (req, res) => {
  try {
    const keyToUse = process.env.OPENROUTER_API_KEY || req.body?.apiKey;
    const model = req.body?.model || 'meta-llama/llama-3.3-70b-instruct:free';

    if (!keyToUse) {
      return res.status(400).json({
        ok: false,
        error: 'Aucune variable OPENROUTER_API_KEY configurée sur le serveur.',
      });
    }

    const resolvedModel = resolveOpenRouterModel(model);
    const start = Date.now();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyToUse.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kaderbot.app',
        'X-Title': 'KADERBOT NOVA',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: 'user', content: 'Réponds en un seul mot: "Connecté".' }],
        max_tokens: 20,
      }),
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || 'Connecté';
      return res.json({
        ok: true,
        model: resolvedModel,
        latencyMs,
        reply,
      });
    }

    const errData = await response.json().catch(() => null);
    const errMsg = errData?.error?.message || `Erreur HTTP ${response.status}`;
    return res.status(response.status).json({
      ok: false,
      status: response.status,
      error: errMsg,
      model: resolvedModel,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 1. Chat endpoint (Exclusively uses process.env.GEMINI_API_KEY, process.env.GROQ_API_KEY, process.env.OPENROUTER_API_KEY)
app.post('/api/chat', async (req, res) => {
  try {
    const {
      prompt,
      history = [],
      provider = 'gemini',
      groqModel = 'openai/gpt-oss-120b',
      openrouterModel = 'meta-llama/llama-3.3-70b-instruct:free',
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt requis' });
    }

    const formattedHistory = history
      .map((h: { role: string; content: string }) => `${h.role === 'user' ? 'Utilisateur' : 'KADERBOT'}: ${h.content}`)
      .join('\n');
    const fullPrompt = `${systemPrompt}\n\nHistorique récent:\n${formattedHistory}\n\nUtilisateur: ${prompt}\nKADERBOT:`;

    // A. OpenRouter Provider (Exclusively using process.env.OPENROUTER_API_KEY)
    if (provider === 'openrouter') {
      const serverOpenRouterKey = process.env.OPENROUTER_API_KEY;

      if (!serverOpenRouterKey) {
        console.warn('Pas de OPENROUTER_API_KEY sur le serveur, bascule transparente sur Gemini (GEMINI_API_KEY)');
        const geminiRes = await callGeminiWithFallback(fullPrompt);
        return res.json({
          text: geminiRes.text,
          provider: 'gemini',
          model: geminiRes.model,
          isFallback: true,
          fallbackReason: 'Aucune variable OPENROUTER_API_KEY configurée sur le serveur',
        });
      }

      try {
        const { text, actualModel } = await callOpenRouterWithFallback(
          prompt,
          systemPrompt,
          serverOpenRouterKey,
          openrouterModel,
          history
        );
        return res.json({ text, provider: 'openrouter', model: actualModel });
      } catch (openRouterErr: any) {
        console.warn(`OpenRouter indisponible (${openRouterErr.message}), bascule de secours sur Gemini...`);
        const geminiRes = await callGeminiWithFallback(fullPrompt);
        return res.json({
          text: geminiRes.text,
          provider: 'gemini',
          model: geminiRes.model,
          isFallback: true,
          fallbackReason: openRouterErr.message,
        });
      }
    }

    // B. Groq Provider (Exclusively using process.env.GROQ_API_KEY)
    if (provider === 'groq') {
      const serverGroqKey = process.env.GROQ_API_KEY;

      if (!serverGroqKey) {
        console.warn('Pas de GROQ_API_KEY sur le serveur, bascule transparente sur Gemini (GEMINI_API_KEY)');
        const geminiRes = await callGeminiWithFallback(fullPrompt);
        return res.json({
          text: geminiRes.text,
          provider: 'gemini',
          model: geminiRes.model,
          isFallback: true,
          fallbackReason: 'Aucune variable GROQ_API_KEY configurée sur le serveur',
        });
      }

      try {
        const { text, actualModel } = await callGroqWithFallback(prompt, systemPrompt, serverGroqKey, groqModel, history);
        return res.json({ text, provider: 'groq', model: actualModel });
      } catch (groqErr: any) {
        console.warn(`Groq indisponible (${groqErr.message}), bascule de secours sur Gemini...`);
        const geminiRes = await callGeminiWithFallback(fullPrompt);
        return res.json({
          text: geminiRes.text,
          provider: 'gemini',
          model: geminiRes.model,
          isFallback: true,
          fallbackReason: groqErr.message,
        });
      }
    }

    // C. Default: Gemini 3.8 Flash (Exclusively using process.env.GEMINI_API_KEY via ai client)
    const geminiRes = await callGeminiWithFallback(fullPrompt);
    return res.json({ text: geminiRes.text, provider: 'gemini', model: geminiRes.model });
  } catch (error: any) {
    console.error('Erreur /api/chat:', error);
    return res.status(500).json({ error: error.message || 'Erreur serveur KADERBOT' });
  }
});

// 2. Ideas Generator endpoint (Exclusively server env keys)
app.post('/api/idees', async (req, res) => {
  try {
    const {
      theme,
      count = 5,
      style = 'creatif',
      styleDesc = '',
      provider = 'gemini',
      groqModel = 'openai/gpt-oss-120b',
      openrouterModel = 'meta-llama/llama-3.3-70b-instruct:free',
    } = req.body;

    const prompt = `Génère exactement ${count} idées courtes sur le thème : "${theme}". Style demandé: ${styleDesc || style}. Format obligatoire : une idée par ligne, numérotée de 1 à ${count}. Pas d'introduction ni de conclusion.`;

    if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
      try {
        const { text } = await callOpenRouterWithFallback(
          prompt,
          "Tu es un générateur d'idées créatif et concis.",
          process.env.OPENROUTER_API_KEY,
          openrouterModel
        );
        return res.json({ text });
      } catch (err) {
        console.warn('OpenRouter idees failed, falling back to Gemini');
      }
    }

    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        const { text } = await callGroqWithFallback(prompt, "Tu es un générateur d'idées créatif et concis.", process.env.GROQ_API_KEY, groqModel);
        return res.json({ text });
      } catch (err) {
        console.warn('Groq idees failed, falling back to Gemini');
      }
    }

    const geminiRes = await callGeminiWithFallback(prompt, "Tu es un générateur d'idées créatif et percutant.");
    return res.json({ text: geminiRes.text });
  } catch (error: any) {
    console.error('Erreur /api/idees:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Translation endpoint (Exclusively server env keys)
app.post('/api/traduis', async (req, res) => {
  try {
    const {
      text,
      targetLang,
      provider = 'gemini',
      groqModel = 'openai/gpt-oss-120b',
      openrouterModel = 'meta-llama/llama-3.3-70b-instruct:free',
    } = req.body;
    const prompt = `Traduis le texte suivant en ${targetLang}. Réponds UNIQUEMENT par la traduction exacte, sans commentaire, guillemets ni introduction:\n\n${text}`;

    if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
      try {
        const { text: result } = await callOpenRouterWithFallback(
          prompt,
          'Tu es un traducteur professionnel expert.',
          process.env.OPENROUTER_API_KEY,
          openrouterModel
        );
        return res.json({ text: result });
      } catch (err) {
        console.warn('OpenRouter traduis failed, falling back to Gemini');
      }
    }

    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        const { text: result } = await callGroqWithFallback(prompt, 'Tu es un traducteur professionnel expert.', process.env.GROQ_API_KEY, groqModel);
        return res.json({ text: result });
      } catch (err) {
        console.warn('Groq traduis failed, falling back to Gemini');
      }
    }

    const geminiRes = await callGeminiWithFallback(prompt, 'Tu es un traducteur polyglotte de précision. Tu retournes exclusivement le texte traduit.');
    return res.json({ text: geminiRes.text });
  } catch (error: any) {
    console.error('Erreur /api/traduis:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 4. Corrector endpoint (Exclusively server env keys)
app.post('/api/corrige', async (req, res) => {
  try {
    const {
      text,
      provider = 'gemini',
      groqModel = 'openai/gpt-oss-120b',
      openrouterModel = 'meta-llama/llama-3.3-70b-instruct:free',
    } = req.body;
    const prompt = `Corrige les fautes d'orthographe, de grammaire et de ponctuation du texte suivant en gardant le sens et le ton. Réponds uniquement par le texte corrigé:\n\n${text}`;

    if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
      try {
        const { text: result } = await callOpenRouterWithFallback(
          prompt,
          'Tu es un correcteur professionnel.',
          process.env.OPENROUTER_API_KEY,
          openrouterModel
        );
        return res.json({ text: result });
      } catch (err) {
        console.warn('OpenRouter corrige failed, falling back to Gemini');
      }
    }

    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        const { text: result } = await callGroqWithFallback(prompt, 'Tu es un correcteur professionnel.', process.env.GROQ_API_KEY, groqModel);
        return res.json({ text: result });
      } catch (err) {
        console.warn('Groq corrige failed, falling back to Gemini');
      }
    }

    const geminiRes = await callGeminiWithFallback(prompt, 'Tu es un correcteur linguistique d’élite. Tu renvoies exclusivement le texte corrigé.');
    return res.json({ text: geminiRes.text });
  } catch (error: any) {
    console.error('Erreur /api/corrige:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 5. Summarizer endpoint (Exclusively server env keys)
app.post('/api/resume', async (req, res) => {
  try {
    const {
      text,
      provider = 'gemini',
      groqModel = 'openai/gpt-oss-120b',
      openrouterModel = 'meta-llama/llama-3.3-70b-instruct:free',
    } = req.body;
    const prompt = `Résume le texte suivant en 2 à 3 phrases claires, précises et directes. Réponds uniquement par le résumé:\n\n${text}`;

    if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
      try {
        const { text: result } = await callOpenRouterWithFallback(
          prompt,
          'Tu es un expert en synthèse documentaire.',
          process.env.OPENROUTER_API_KEY,
          openrouterModel
        );
        return res.json({ text: result });
      } catch (err) {
        console.warn('OpenRouter resume failed, falling back to Gemini');
      }
    }

    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        const { text: result } = await callGroqWithFallback(prompt, 'Tu es un expert en synthèse documentaire.', process.env.GROQ_API_KEY, groqModel);
        return res.json({ text: result });
      } catch (err) {
        console.warn('Groq resume failed, falling back to Gemini');
      }
    }

    const geminiRes = await callGeminiWithFallback(prompt, 'Tu es un synthétiseur d’informations. Rédige un résumé dense et limpide.');
    return res.json({ text: geminiRes.text });
  } catch (error: any) {
    console.error('Erreur /api/resume:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 6. Memory Persistence (Load & Save to JSON disk file)
app.get('/api/memory', requireAdmin, (req, res) => {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      return res.json(data);
    }
    return res.json({ memoire: {}, regles: {}, liens: {}, synonymes: {}, sessions: ['defaut'] });
  } catch (err: any) {
    console.error('Erreur lecture mémoire:', err);
    return res.status(500).json({ error: 'Erreur lecture stockage' });
  }
});

app.post('/api/memory/save', requireAdmin, (req, res) => {
  try {
    const { memoire, regles, liens, synonymes, sessions } = req.body;
    fs.writeFileSync(
      MEMORY_FILE,
      JSON.stringify({ memoire, regles, liens, synonymes, sessions, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    return res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Erreur sauvegarde mémoire:', err);
    return res.status(500).json({ error: 'Erreur écriture stockage' });
  }
});

// Vérification de session admin : l’URL ?admin=true seule ne donne aucun accès.
app.post('/api/admin/session', requireAdmin, (_req, res) => {
  return res.json({ ok: true });
});

// Endpoint de santé / ping de maintien d'activité (Render cron)
app.get('/api/health', (req, res) => {
  return res.json({ ok: true });
});

// Endpoint de rechargement à chaud de la mémoire depuis le disque
app.get('/api/memory/refresh', requireAdmin, (req, res) => {
  try {
    const data = readStorageFile();
    return res.json({
      ok: true,
      refreshedAt: new Date().toISOString(),
      data,
    });
  } catch (err: any) {
    console.error('Erreur /api/memory/refresh:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/notes', requireAdmin, (_req, res) => {
  return res.json({ notes: readJsonArray<KaderbotNote>(NOTES_FILE) });
});

app.get('/api/agent/logs', requireAdmin, (_req, res) => {
  return res.json({ logs: readJsonArray<AgentActionLog>(ACTION_LOG_FILE).slice(-200).reverse() });
});

app.get('/api/calendar/events', requireAdmin, (_req, res) => {
  return res.json({ events: readJsonArray<KaderbotEvent>(EVENTS_FILE).slice(-500).reverse() });
});

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

// === 4. IMPLÉMENTATION DES OUTILS ===
const TOOL_IMPLEMENTATIONS: Record<string, (args: any) => Promise<string>> = {
  search_web: async ({ query }: { query?: string }) => {
    if (!query?.trim()) return 'Requête de recherche vide.';
    return await executeBraveSearch(query.trim(), false);
  },

  search_news: async ({ query }: { query?: string }) => {
    if (!query?.trim()) return 'Requête d’actualité vide.';
    return await executeBraveSearch(query.trim(), true);
  },

  open_url: async ({ url }: { url?: string }) => {
    if (!url?.trim()) return 'URL manquante.';
    const cleanUrl = url.trim();
    const check = isUrlForbidden(cleanUrl);
    if (check.forbidden) {
      return `Accès refusé : ${check.reason || 'Domaine interdit'}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(cleanUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        if (resp.status === 403 || resp.status === 401) {
          return `Erreur HTTP ${resp.status} (Accès refusé / Anti-bot) : Le site bloque l'accès automatique. Ignore cette URL et poursuis avec les autres sources disponibles.`;
        }
        return `Erreur HTTP ${resp.status} (${resp.statusText}) lors de l'accès à la page. Ignore cette URL et passe aux autres sources.`;
      }

      let html = await resp.text();

      // Détection de protection Cloudflare / Captcha
      if (
        html.includes('cf-browser-verification') ||
        html.includes('Cloudflare Ray ID') ||
        html.includes('Attention Required! | Cloudflare') ||
        html.includes('Just a moment...')
      ) {
        return `Erreur HTTP 403 (Challenge Cloudflare / Anti-bot) : Cette page nécessite une vérification interactive de navigateur. Ignore cette source et passe à une autre.`;
      }

      // Retirer les balises script, style, nav, footer, header et leur contenu
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
      html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
      html = html.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ');
      html = html.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');
      html = html.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ');

      let text = html.replace(/<[^>]+>/g, ' ');
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      text = text.replace(/\s+/g, ' ').trim();

      if (!text || text.length < 50) {
        return 'La page web ne contient aucun contenu textuel exploitable. Passe à une autre source.';
      }
      return text.slice(0, 5000);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return "Délai d'attente dépassé (timeout 6s) pour ouvrir la page web. Ignore cette URL et passe aux autres.";
      }
      return `Erreur lors de la lecture de la page (${err.message}). Ignore cette source.`;
    }
  },

  memo_lookup: async ({ sujet }: { sujet?: string }) => {
    if (!sujet?.trim()) return 'Sujet manquant pour memo_lookup.';
    const storage = readStorageFile();
    const q = sujet.trim().toLowerCase();

    // 1. Chercher dans memoire
    let directMatches: any[] = [];
    if (storage.memoire[q]) {
      directMatches = storage.memoire[q];
    } else {
      const matchingKey = Object.keys(storage.memoire).find(
        k => k.toLowerCase() === q || k.toLowerCase().includes(q) || q.includes(k.toLowerCase())
      );
      if (matchingKey) {
        directMatches = storage.memoire[matchingKey];
      }
    }

    // 2. Chercher les liens
    const links = storage.liens[q] || [];

    // 3. Chercher les règles
    const rules = storage.regles[q] || [];

    if (directMatches.length === 0 && links.length === 0 && rules.length === 0) {
      return `Aucune information trouvée dans la mémoire locale pour le sujet "${sujet}".`;
    }

    let out = `Informations mémoire locale pour "${sujet}" :\n`;
    if (directMatches.length > 0) {
      out += directMatches.map((m: any, idx: number) => `- Définition/Fait [${idx + 1}] : ${m.def || m}`).join('\n') + '\n';
    }
    if (links.length > 0) {
      out += `- Héritage / Liens : ${links.join(', ')}\n`;
    }
    if (rules.length > 0) {
      out += `- Règles logiques : ${rules.map((r: any) => `${r.quant} sont ${r.prop}`).join('; ')}\n`;
    }
    return out.trim();
  },

  search_notes: async ({ query, limit = 10 }: { query?: string; limit?: number }) => {
    if (!query?.trim()) return 'Requête de notes vide.';
    const q = query.trim().toLowerCase();
    const notes = readJsonArray<KaderbotNote>(NOTES_FILE)
      .filter(note => `${note.title} ${note.body} ${note.tags.join(' ')}`.toLowerCase().includes(q))
      .slice(-(Math.min(Math.max(Number(limit) || 10, 1), 20)));
    if (notes.length === 0) return `Aucune note trouvée pour « ${query.trim()} ».`;
    return notes
      .map(note => `- ${note.title}${note.tags.length ? ` [${note.tags.join(', ')}]` : ''}\n  ${note.body.slice(0, 500)} (id: ${note.id})`)
      .join('\n');
  },

  list_events: async ({ start_iso, end_iso, limit = 20 }: { start_iso?: string; end_iso?: string; limit?: number }) => {
    const start = Date.parse(String(start_iso || ''));
    const end = Date.parse(String(end_iso || ''));
    if (Number.isNaN(start) || Number.isNaN(end)) return 'Dates ISO invalides.';
    const events = readJsonArray<KaderbotEvent>(EVENTS_FILE)
      .filter(event => Date.parse(event.startIso) < end && Date.parse(event.endIso) > start)
      .sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso))
      .slice(0, Math.min(Math.max(Number(limit) || 20, 1), 50));
    if (events.length === 0) return 'Aucun événement trouvé dans cette période.';
    return events
      .map(event => `- ${event.title} : ${event.startIso} → ${event.endIso}${event.location ? ` | ${event.location}` : ''}`)
      .join('\n');
  },

  create_event: async ({ title, start_iso, end_iso, location, description }: { title?: string; start_iso?: string; end_iso?: string; location?: string; description?: string }) => {
    if (!title?.trim() || !start_iso || !end_iso) return 'Titre et dates requis pour l’événement.';
    const event: KaderbotEvent = {
      id: randomUUID(),
      title: title.trim(),
      startIso: new Date(start_iso).toISOString(),
      endIso: new Date(end_iso).toISOString(),
      location: location?.trim() || undefined,
      description: description?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const events = readJsonArray<KaderbotEvent>(EVENTS_FILE);
    events.push(event);
    writeJsonArray(EVENTS_FILE, events.slice(-1000));

    const toCalendarDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const calendarUrl = new URL('https://calendar.google.com/calendar/render');
    calendarUrl.searchParams.set('action', 'TEMPLATE');
    calendarUrl.searchParams.set('text', event.title);
    calendarUrl.searchParams.set('dates', `${toCalendarDate(event.startIso)}/${toCalendarDate(event.endIso)}`);
    if (event.location) calendarUrl.searchParams.set('location', event.location);
    if (event.description) calendarUrl.searchParams.set('details', event.description);
    return `Événement « ${event.title} » créé. Ajoute-le à ton agenda Google ici : ${calendarUrl.toString()}`;
  },

  create_note: async ({ title, body, tags = [] }: { title?: string; body?: string; tags?: string[] }) => {
    if (!title?.trim() || !body?.trim()) return 'Titre et contenu requis pour créer une note.';
    const now = new Date().toISOString();
    const note: KaderbotNote = {
      id: randomUUID(),
      title: title.trim(),
      body: body.trim(),
      tags: Array.isArray(tags) ? tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 20) : [],
      createdAt: now,
      updatedAt: now,
    };
    const notes = readJsonArray<KaderbotNote>(NOTES_FILE);
    notes.push(note);
    writeJsonArray(NOTES_FILE, notes.slice(-1000));
    return `Note « ${note.title} » créée avec succès.`;
  },

  send_message: async ({ channel, target, text }: { channel?: string; target?: string; text?: string }) => {
    if (!channel || !target?.trim() || !text?.trim()) return 'Canal, destinataire et texte requis.';
    if (channel === 'whatsapp') {
      const shareUrl = `https://wa.me/?text=${encodeURIComponent(text.trim())}`;
      return `Message WhatsApp préparé pour ${target.trim()} (aucun envoi automatique). Ouvre ce lien puis appuie sur Envoyer : ${shareUrl}`;
    }
    if (channel === 'telegram') {
      if (!TELEGRAM_BOT_TOKEN) return 'TELEGRAM_BOT_TOKEN n’est pas configuré sur Render.';
      if (!TELEGRAM_ALLOWED_CHAT_IDS.has(target.trim())) return `Le chat Telegram ${target.trim()} n’est pas autorisé par l’allowlist.`;
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: target.trim(), text: text.trim() }),
      });
      const payload: any = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) return `Échec Telegram : ${payload?.description || `HTTP ${response.status}`}`;
      return `Message Telegram envoyé à ${target.trim()}.`;
    }
    return 'L’envoi SMS n’est pas disponible depuis la Web App. Utilise un lien sms: ou un compagnon Android.';
  },

  memo_store: async ({ sujet, definition }: { sujet?: string; definition?: string }) => {
    if (!sujet?.trim() || !definition?.trim()) {
      return 'Sujet ou définition manquant pour memo_store.';
    }
    const storage = readStorageFile();
    const key = sujet.trim().toLowerCase();
    if (!storage.memoire[key]) {
      storage.memoire[key] = [];
    }

    const now = new Date().toISOString();
    storage.memoire[key].push({
      def: definition.trim(),
      poids: 1.0,
      hits: 1,
      source: 'agent',
      type: 'concept',
      created: now,
      last_used: now,
    });

    writeStorageFile(storage);
    return `Le fait "${sujet}" a été mémorisé avec succès dans la mémoire cognitive locale.`;
  },

  link_concepts: async ({ source, cible }: { source?: string; cible?: string }) => {
    if (!source?.trim() || !cible?.trim()) {
      return 'Source ou cible manquante pour link_concepts.';
    }
    const storage = readStorageFile();
    const sKey = source.trim().toLowerCase();
    const cKey = cible.trim().toLowerCase();

    if (!storage.liens[sKey]) {
      storage.liens[sKey] = [];
    }

    if (!storage.liens[sKey].includes(cKey)) {
      storage.liens[sKey].push(cKey);
      writeStorageFile(storage);
      return `Lien d'héritage enregistré : "${source}" est un/une "${cible}".`;
    }
    return `Le lien d'héritage "${source}" -> "${cible}" existait déjà.`;
  },

  ask_user: async ({ question }: { question?: string }) => {
    return `Question posée à l'utilisateur : ${question || 'Pouvez-vous préciser votre demande ?'}`;
  },
};

// === 3. LA BOUCLE AGENTIQUE ===
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
async function runToolLoopWithModel(
  endpoint: string,
  apiKey: string,
  model: string,
  providerLabel: string,
  userPrompt: string,
  history: Array<{ role: string; content: string }> = [],
  systemPrompt?: string,
  extraHeaders: Record<string, string> = {}
): Promise<{
  text?: string;
  provider: string;
  model: string;
  toolTrace: Array<{ tool: string; args?: any; status?: 'success' | 'error'; errorMsg?: string; resultSnippet?: string }>;
  awaitingUser?: boolean;
  question?: string;
  pendingAction?: PendingAgentAction;
}> {
  const isContinuePrompt = ['continue', 'continuer', 'poursuis', 'vas-y', 'go on', 'suite'].includes(userPrompt.trim().toLowerCase());
  const effectiveUserPrompt = isContinuePrompt
    ? "Poursuis l'analyse ou la recherche précédente et produis la synthèse finale claire et structurée en français."
    : userPrompt;

  const messages: any[] = [
    { role: 'system', content: systemPrompt || AGENT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: effectiveUserPrompt },
  ];

  const toolTrace: Array<{ tool: string; args?: any; status?: 'success' | 'error'; errorMsg?: string; resultSnippet?: string }> = [];
  let lastText = '';
  const loopStartTime = Date.now();
  const MAX_LOOP_DURATION_MS = 25000; // 25s max pour éviter tout blocage réseau

  for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
    // Si le temps limite est presque atteint, forcer la synthèse directe sans nouvel appel d'outil
    const elapsed = Date.now() - loopStartTime;
    if (elapsed > MAX_LOOP_DURATION_MS) {
      console.warn(`[AGENT TIMEOUT PREVENT] Limite de temps atteinte (${elapsed}ms), synthèse immédiate...`);
      break;
    }

    const fetchController = new AbortController();
    const fetchTimeoutId = setTimeout(() => fetchController.abort(), 14000);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages,
          tools: AGENT_TOOLS,
          tool_choice: 'auto',
          temperature: 0.5,
        }),
        signal: fetchController.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(fetchTimeoutId);
      if (fetchErr.name === 'AbortError') {
        throw new Error(`[${model}] Délai d'attente API dépassé (14s)`);
      }
      throw fetchErr;
    }
    clearTimeout(fetchTimeoutId);

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
      throw new Error(`[${model}] ${errMsg}`);
    }

    const data: any = await response.json();
    const assistantMsg = data.choices?.[0]?.message;

    if (!assistantMsg) {
      throw new Error(`[${model}] Réponse vide reçue`);
    }

    // Si la réponse contient des appels d'outils (tool_calls)
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      messages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        const fnName = toolCall.function?.name;
        let parsedArgs: any = {};
        try {
          parsedArgs = JSON.parse(toolCall.function?.arguments || '{}');
        } catch (e: any) {
          console.warn(`Arguments d'outil invalides pour ${fnName}:`, toolCall.function?.arguments);
          parsedArgs = {};
        }

        const validationError = validateToolArguments(fnName, parsedArgs);
        if (validationError) {
          toolTrace.push({ tool: fnName, args: parsedArgs, status: 'error', errorMsg: validationError });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Erreur de validation : ${validationError}`,
          });
          continue;
        }

        // Cas ask_user : interruption de la boucle et retour direct
        if (fnName === 'ask_user') {
          toolTrace.push({ tool: fnName, args: parsedArgs, status: 'success' });
          return {
            awaitingUser: true,
            question: parsedArgs.question || 'Pouvez-vous préciser votre demande ?',
            provider: providerLabel,
            model,
            toolTrace,
          };
        }

        const policy = TOOL_POLICIES[fnName];
        const requiresConfirmation =
          policy?.confirmation === true ||
          (fnName === 'send_message' && parsedArgs.channel !== 'whatsapp');
        if (requiresConfirmation) {
          const pendingAction = createPendingAction(fnName, parsedArgs);
          toolTrace.push({
            tool: fnName,
            args: parsedArgs,
            status: 'success',
            resultSnippet: 'En attente de confirmation utilisateur',
          });
          return {
            awaitingUser: true,
            pendingAction,
            question: `Confirmation requise : ${pendingAction.summary}`,
            provider: providerLabel,
            model,
            toolTrace,
          };
        }

        let toolResultStr = '';
        let isError = false;
        let errorDetail = '';

        try {
          const handler = TOOL_IMPLEMENTATIONS[fnName];
          if (typeof handler === 'function') {
            toolResultStr = await handler(parsedArgs);
            if (
              toolResultStr.startsWith('Erreur') ||
              toolResultStr.startsWith('Impossible') ||
              toolResultStr.startsWith('Accès refusé') ||
              toolResultStr.includes('403') ||
              toolResultStr.includes("Délai d'attente dépassé")
            ) {
              isError = true;
              errorDetail = toolResultStr.slice(0, 160);
            }
          } else {
            toolResultStr = `Outil inconnu : ${fnName}`;
            isError = true;
            errorDetail = toolResultStr;
          }
        } catch (err: any) {
          toolResultStr = `Erreur lors de l'exécution de l'outil ${fnName} : ${err.message || 'Erreur inconnue'}`;
          isError = true;
          errorDetail = err.message || 'Erreur inconnue';
        }

        const snippet = toolResultStr.replace(/\s+/g, ' ').trim().slice(0, 120);

        toolTrace.push({
          tool: fnName,
          args: parsedArgs,
          status: isError ? 'error' : 'success',
          errorMsg: isError ? errorDetail : undefined,
          resultSnippet: snippet,
        });

        // Tronquer le résultat d'un outil pour l'injecter proprement dans la conversation
        let safeContent = (typeof toolResultStr === 'string' ? toolResultStr : JSON.stringify(toolResultStr)).slice(0, 5000);
        if (isError && fnName === 'open_url') {
          safeContent += ' [Note agent : Cette page est inaccessible ou protégée. Poursuis l’analyse avec une autre source ou résume avec les données déjà disponibles.]';
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: safeContent,
        });
      }

      continue;
    }

    // Réponse texte finale
    const content = assistantMsg.content?.trim() || '';
    lastText = content;
    return {
      text: content,
      provider: providerLabel,
      model,
      toolTrace,
    };
  }

  // Si la limite d'itérations ou de temps est atteinte, solliciter une dernière synthèse rapide
  if (!lastText && messages.length > 2) {
    try {
      const finalController = new AbortController();
      const finalTimeoutId = setTimeout(() => finalController.abort(), 9000);
      messages.push({
        role: 'user',
        content: 'Synthétise maintenant en 2 à 4 paragraphes clairs les informations recueillies jusqu’ici, sans appel d’outil supplémentaire.',
      });
      const synthResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 800,
        }),
        signal: finalController.signal,
      });
      clearTimeout(finalTimeoutId);
      if (synthResponse.ok) {
        const synthData: any = await synthResponse.json();
        const synthText = synthData.choices?.[0]?.message?.content?.trim();
        if (synthText) {
          return {
            text: synthText,
            provider: providerLabel,
            model,
            toolTrace,
          };
        }
      }
    } catch (e: any) {
      console.warn('Synthèse de secours non disponible:', e.message);
    }
  }

  return {
    text: lastText || 'Voici les informations réunies sur votre demande.',
    provider: providerLabel,
    model,
    toolTrace,
  };
}

// Cascade agentique complète : Groq 120B → Groq 20B → Gemini (sans tools) → OpenRouter Nemotron (avec tools)
async function runAgentLoop(
  userPrompt: string,
  history: Array<{ role: string; content: string }> = [],
  systemPrompt?: string
): Promise<{
  text?: string;
  provider: string;
  model?: string;
  toolTrace: Array<{ tool: string; args?: any }>;
  awaitingUser?: boolean;
  question?: string;
  isFallback?: boolean;
  fallbackReason?: string;
}> {
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();

  // === MAILLON 1 : Groq openai/gpt-oss-120b (avec tools) ===
  if (groqApiKey) {
    try {
      const res = await runToolLoopWithModel(
        'https://api.groq.com/openai/v1/chat/completions',
        groqApiKey,
        'openai/gpt-oss-120b',
        'groq-agent',
        userPrompt,
        history,
        systemPrompt
      );
      return res;
    } catch (err120: any) {
      console.warn(
        `[BASCULE AGENT] Maillon 1 (Groq openai/gpt-oss-120b) a échoué (cause: ${err120.message}). Bascule vers Maillon 2 (Groq openai/gpt-oss-20b)...`
      );
    }

    // === MAILLON 2 : Groq openai/gpt-oss-20b (avec tools) ===
    try {
      const res = await runToolLoopWithModel(
        'https://api.groq.com/openai/v1/chat/completions',
        groqApiKey,
        'openai/gpt-oss-20b',
        'groq-agent',
        userPrompt,
        history,
        systemPrompt
      );
      return {
        ...res,
        isFallback: true,
        fallbackReason: 'Groq openai/gpt-oss-120b a échoué, bascule sur openai/gpt-oss-20b',
      };
    } catch (err20: any) {
      console.warn(
        `[BASCULE AGENT] Maillon 2 (Groq openai/gpt-oss-20b) a échoué (cause: ${err20.message}). Bascule vers Maillon 3 (Gemini sans tools)...`
      );
    }
  } else {
    console.warn(
      '[BASCULE AGENT] Aucune variable GROQ_API_KEY configurée. Bascule vers Maillon 3 (Gemini sans tools)...'
    );
  }

  // === MAILLON 3 : Gemini (sans tools) ===
  try {
    const formattedHistory = history
      .map((h: { role: string; content: string }) => `${h.role === 'user' ? 'Utilisateur' : 'KADERBOT'}: ${h.content}`)
      .join('\n');
    const fullPrompt = `${systemPrompt || AGENT_SYSTEM_PROMPT}\n\nHistorique récent:\n${formattedHistory}\n\nUtilisateur: ${userPrompt}\nKADERBOT:`;

    const geminiRes = await callGeminiWithFallback(fullPrompt, systemPrompt || AGENT_SYSTEM_PROMPT);
    return {
      text: geminiRes.text,
      provider: 'gemini',
      model: geminiRes.model,
      toolTrace: [],
      isFallback: true,
      fallbackReason: 'Groq 120B et 20B indisponibles, bascule sur Gemini (sans tools)',
    };
  } catch (geminiErr: any) {
    if (openRouterApiKey) {
      console.warn(
        `[BASCULE AGENT] Maillon 3 (Gemini) a échoué (cause: ${geminiErr.message}). Bascule vers Maillon 4 (OpenRouter nvidia/nemotron-3.5-lightning:free)...`
      );
    } else {
      console.warn(
        `[BASCULE AGENT] Maillon 3 (Gemini) a échoué (cause: ${geminiErr.message}). Aucun maillon OpenRouter configuré.`
      );
    }
  }

  // === MAILLON 4 : OpenRouter 'nvidia/nemotron-3.5-lightning:free' (avec tools) ===
  if (openRouterApiKey) {
    try {
      const res = await runToolLoopWithModel(
        'https://openrouter.ai/api/v1/chat/completions',
        openRouterApiKey,
        'nvidia/nemotron-3.5-lightning:free',
        'openrouter-agent',
        userPrompt,
        history,
        systemPrompt,
        {
          'HTTP-Referer': 'https://kaderbot.app',
          'X-Title': 'KADERBOT NOVA',
        }
      );
      return {
        ...res,
        isFallback: true,
        fallbackReason: 'Groq et Gemini indisponibles, bascule sur OpenRouter nvidia/nemotron-3.5-lightning:free',
      };
    } catch (openRouterErr: any) {
      console.warn(
        `[BASCULE AGENT] Maillon 4 (OpenRouter nvidia/nemotron-3.5-lightning:free) a échoué (cause: ${openRouterErr.message}). Tous les maillons ont échoué.`
      );
    }
  }

  throw new Error('Tous les maillons de l’agent ont échoué (Groq gpt-oss-120b, Groq gpt-oss-20b, Gemini, OpenRouter Nemotron).');
}

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

// === 5. ENDPOINT /api/agent ===
app.post('/api/agent', async (req, res) => {
  if (!checkAgentRateLimit(req)) {
    return res.status(429).json({ error: 'Limite atteinte : maximum 10 requêtes agentiques par minute.' });
  }
  try {
    const { prompt, history = [], systemPrompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt requis' });
    }

    // 1. Classification d'intention (CHAT vs AGENT)
    const intent = await classifyIntentWithRouter(prompt, history);

    if (intent === 'CHAT') {
      const serverGroqKey = process.env.GROQ_API_KEY?.trim();
      if (serverGroqKey) {
        try {
          const chatRes = await callGroqWithFallback(
            prompt,
            systemPrompt || AGENT_SYSTEM_PROMPT,
            serverGroqKey,
            'openai/gpt-oss-120b',
            history
          );
          return res.json({
            text: chatRes.text,
            provider: 'groq-chat',
            model: chatRes.actualModel,
            routedTo: 'chat',
            toolTrace: [],
            isFallback: false,
          });
        } catch (chatErr: any) {
          console.warn(`[ROUTER AGENT] Groq chat direct a échoué (${chatErr.message}), bascule sur Gemini...`);
        }
      }

      // Fallback Gemini direct si Groq chat a échoué ou pas de clé
      try {
        const formattedHistory = history
          .map((h: { role: string; content: string }) => `${h.role === 'user' ? 'Utilisateur' : 'KADERBOT'}: ${h.content}`)
          .join('\n');
        const fullPrompt = `${systemPrompt || AGENT_SYSTEM_PROMPT}\n\nHistorique récent:\n${formattedHistory}\n\nUtilisateur: ${prompt}\nKADERBOT:`;
        const geminiRes = await callGeminiWithFallback(fullPrompt, systemPrompt || AGENT_SYSTEM_PROMPT);
        return res.json({
          text: geminiRes.text,
          provider: 'gemini',
          model: geminiRes.model,
          routedTo: 'chat',
          toolTrace: [],
          isFallback: true,
          fallbackReason: 'Groq indisponible pour le mode chat direct',
        });
      } catch (geminiErr: any) {
        console.warn(`[ROUTER AGENT] Gemini chat direct a échoué (${geminiErr.message}), exécution de la boucle agent complète...`);
      }
    }

    // 2. Si intention AGENT (ou échec de CHAT) : Exécute la cascade agentique complète
    const agentResult = await runAgentLoop(prompt, history, systemPrompt);
    return res.json({
      ...agentResult,
      routedTo: 'agent',
    });
  } catch (err: any) {
    console.error('Erreur critique /api/agent (tous les maillons ont échoué):', err);
    return res.status(500).json({ error: err.message || 'Erreur interne de l’agent' });
  }
});

// Décision explicite de l’utilisateur pour une action suspendue par la policy.
app.post('/api/agent/action', async (req, res) => {
  const { actionId, decision } = req.body || {};
  if (typeof actionId !== 'string' || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'actionId et décision valide requis.' });
  }

  const action = pendingAgentActions.get(actionId);
  pendingAgentActions.delete(actionId);
  if (!action) return res.status(404).json({ error: 'Action introuvable ou déjà traitée.' });
  if (Date.parse(action.expiresAt) <= Date.now()) {
    appendActionLog({ tool: action.tool, args: action.args, status: 'expired', message: 'Confirmation expirée.' });
    return res.status(410).json({ error: 'Cette demande de confirmation a expiré.' });
  }

  if (decision === 'reject') {
    appendActionLog({ tool: action.tool, args: action.args, status: 'rejected', message: 'Refusée par l’utilisateur.' });
    return res.json({
      ok: true,
      text: `Action refusée : ${action.summary}`,
      provider: 'policy',
      toolTrace: [{ tool: action.tool, args: action.args, status: 'error', errorMsg: 'Refusée par l’utilisateur.' }],
    });
  }

  try {
    const handler = TOOL_IMPLEMENTATIONS[action.tool];
    if (typeof handler !== 'function') {
      return res.status(409).json({ error: `L’outil ${action.tool} n’est pas encore disponible.` });
    }
    const validationError = validateToolArguments(action.tool, action.args);
    if (validationError) return res.status(400).json({ error: validationError });
    const result = await handler(action.args);
    appendActionLog({ tool: action.tool, args: action.args, status: 'success', message: result });
    return res.json({
      ok: true,
      text: result,
      provider: 'policy',
      toolTrace: [{ tool: action.tool, args: action.args, status: 'success', resultSnippet: result.replace(/\s+/g, ' ').slice(0, 120) }],
    });
  } catch (err: any) {
    appendActionLog({ tool: action.tool, args: action.args, status: 'error', message: err.message || 'Échec de l’exécution.' });
    return res.status(500).json({ error: err.message || 'Échec de l’exécution de l’action.' });
  }
});

// Route de téléchargement de l’archive ZIP complète du projet web
app.get('/api/export-project-zip', (req, res) => {
  try {
    const zipPath = path.resolve(__dirname, '.aistudio/artifacts/brain/1e85614a-1a36-40c9-9d9d-04bf0651ef2e/kaderbot_projet_complet.zip');
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="kaderbot-projet-web-complet.zip"');
      return res.sendFile(zipPath);
    } else {
      return res.status(404).json({ error: "L'archive ZIP n'est pas encore générée." });
    }
  } catch (err) {
    console.error('Erreur export zip:', err);
    return res.status(500).json({ error: 'Erreur lors du téléchargement du zip' });
  }
});

// 7. Python Pydroid 3 Export Script (Multi-mode: Console & Tkinter)
app.post('/api/export-pydroid', requireAdmin, (req, res) => {
  try {
    const {
      memoire = {},
      regles = {},
      liens = {},
      synonymes = {},
      groqApiKey = '',
      groqModel = 'openai/gpt-oss-120b',
      mode = 'auto', // 'auto' | 'console' | 'gui'
    } = req.body;
    const resolvedModel = resolveGroqModel(groqModel);

    // Encode memory and rules safely in Base64 so Python json.loads NEVER fails on null, true, false or quotes
    const b64Memoire = Buffer.from(JSON.stringify(memoire)).toString('base64');
    const b64Regles = Buffer.from(JSON.stringify(regles)).toString('base64');
    const b64Liens = Buffer.from(JSON.stringify(liens)).toString('base64');
    const b64Synonymes = Buffer.from(JSON.stringify(synonymes)).toString('base64');

    const defaultTargetMode = mode === 'console' ? 'CONSOLE' : mode === 'gui' ? 'GUI' : 'AUTO';

    const pythonScript = `# -*- coding: utf-8 -*-
"""
================================================================================
KADERBOT NOVA V14 - APPLICATION COMPLETE MULTI-MODE POUR PYDROID 3 (ANDROID)
================================================================================
Généré par KADERBOT NOVA Web Studio.
Ce script est conçu pour fonctionner SANS AUCUN CRASH sur Pydroid 3 (Android).

CARACTERISTIQUES :
- Mode hybride intelligent : Console interactive ultra-fluide ou Interface Tkinter
- Tolérance zéro crash : Si Tkinter n'est pas installé sur Android, bascule
  automatiquement sur la Console interactive
- Moteur cognitif complet : Déduction symbolique, causalité 'pourquoi',
  recherche floue (difflib), et association sémantique Question-Réponse
- Sauvegarde locale automatique dans 'kaderbot_memoire.json' sur votre téléphone
- Connectivité Groq Cloud ultra-rapide (${resolvedModel})
================================================================================
"""

import sys
import os
import json
import base64
import re
import difflib
import unicodedata
import threading
import urllib.request
import urllib.error
from datetime import datetime

# ==============================================================================
# CONFIGURATION & MODE D'EXECUTION
# ==============================================================================
# Modes possibles : 'CONSOLE' (recommandé Pydroid 3), 'GUI' (Tkinter), ou 'AUTO'
MODE_CIBLE = "${defaultTargetMode}"

API_KEY = "${groqApiKey}"
API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL_GROQ = "${resolvedModel}"
GROQ_ACTIF = bool(API_KEY.strip())

SYSTEM_PROMPT = (
    "Tu es KADERBOT, un assistant cognitif sympa, concis et curieux. "
    "Tu réponds toujours en français, en 2 à 4 phrases maximum."
)

DATA_FILE = "kaderbot_memoire.json"

# ==============================================================================
# CHARGEMENT DES BASES DE CONNAISSANCES (DECODAGE BASE64 ULTRA-STABLE)
# ==============================================================================
def _decoder_base64_json(payload_b64):
    try:
        raw_bytes = base64.b64decode(payload_b64.encode('utf-8'))
        return json.loads(raw_bytes.decode('utf-8'))
    except Exception as e:
        print("[!] Erreur décodage interne:", e)
        return {}

memoire = _decoder_base64_json("${b64Memoire}")
regles = _decoder_base64_json("${b64Regles}")
liens = _decoder_base64_json("${b64Liens}")
synonymes = _decoder_base64_json("${b64Synonymes}")

contexte = []
historique_chat = []

# ==============================================================================
# PERSISTANCE LOCALE ANDROID
# ==============================================================================
def sauvegarder_donnees():
    try:
        data = {
            "memoire": memoire,
            "regles": regles,
            "liens": liens,
            "synonymes": synonymes,
            "updated_at": datetime.now().isoformat()
        }
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print("[!] Erreur sauvegarde locale :", e)
        return False

def charger_donnees():
    global memoire, regles, liens, synonymes
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                if "memoire" in d: memoire.update(d["memoire"])
                if "regles" in d: regles.update(d["regles"])
                if "liens" in d: liens.update(d["liens"])
                if "synonymes" in d: synonymes.update(d["synonymes"])
        except Exception as e:
            print("[!] Erreur chargement sauvegarde :", e)

charger_donnees()

# ==============================================================================
# OUTILS LINGUISTIQUES & EXTRACTION SEMANTIQUE
# ==============================================================================
MOTS_INTERROGATIFS_ET_VIDES = {
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l',
    'ce', 'cet', 'cette', 'ces', 'mon', 'ton', 'son', 'ma', 'ta', 'sa',
    'qui', 'que', 'quoi', 'quel', 'quelle', 'quels', 'quelles',
    'comment', 'pourquoi', 'quand', 'est', 'sont', 'ete', 'etre',
    'avoir', 'fait', 'font', 'bonjour', 'salut', "s'il", 'te', 'plait'
}

def sans_accent(t):
    if not t: return ""
    return "".join(c for c in unicodedata.normalize("NFD", str(t)) if unicodedata.category(c) != "Mn").lower()

PONCT_SET = set(['?', '!', '.', ',', ';', ':', '"', chr(39), '(', ')', '[', ']', '{', '}', '-'])

def nettoyer_ponctuation(chaine):
    return "".join(" " if c in PONCT_SET else c for c in chaine)

def normaliser_question_cle(q):
    s = sans_accent(q)
    s = nettoyer_ponctuation(s)
    tokens = [w.strip() for w in s.split() if w.strip()]
    tokens_significatifs = [w for w in tokens if w not in MOTS_INTERROGATIFS_ET_VIDES and len(w) > 2]
    return " ".join(tokens_significatifs if tokens_significatifs else tokens)

def extraire_mots_cles(q):
    s = sans_accent(q)
    s = nettoyer_ponctuation(s)
    tokens = [w.strip() for w in s.split() if w.strip()]
    return set([w for w in tokens if w not in MOTS_INTERROGATIFS_ET_VIDES and len(w) > 2])

def rechercher_flou(texte, memoire_dict, regles_dict, seuil=0.72):
    t_clean = sans_accent(texte).strip()
    clefs = list(set(list(memoire_dict.keys()) + list(regles_dict.keys())))
    if not clefs: return None
    matches = difflib.get_close_matches(t_clean, [sans_accent(k) for k in clefs], n=1, cutoff=seuil)
    if matches:
        matched_norm = matches[0]
        for k in clefs:
            if sans_accent(k) == matched_norm:
                return k
    return None

def trouver_question_reponse(question, memoire_dict, seuil=0.70):
    if not question or not memoire_dict: return None
    q_norm = normaliser_question_cle(question)
    q_mots = extraire_mots_cles(question)
    if not q_norm and not q_mots: return None

    meilleur = None
    meilleur_score = 0.0

    for sujet, entries in memoire_dict.items():
        if not entries: continue
        entry = entries[0]
        is_qa = entry.get("type") == "question_reponse" or bool(entry.get("question_origine")) or " " in sujet
        if not is_qa: continue

        sujet_norm = normaliser_question_cle(entry.get("question_origine") or sujet)
        sujet_mots = set(entry.get("mots_cles") or list(extraire_mots_cles(sujet_norm)))

        if q_norm == sujet_norm:
            return {"sujet": sujet, "entry": entry, "score": 1.0}

        score = 0.0
        if q_mots and sujet_mots:
            intersection = q_mots.intersection(sujet_mots)
            union = q_mots.union(sujet_mots)
            score = len(intersection) / float(len(union)) if union else 0.0

        if score > meilleur_score:
            meilleur_score = score
            meilleur = {"sujet": sujet, "entry": entry, "score": score}

    if meilleur and meilleur_score >= seuil:
        return meilleur
    return None

def est_requete_definition(texte):
    t = sans_accent(texte).strip().rstrip("?.! ")
    prefixes = [
        "c'est quoi", "cest quoi", "qu'est ce que", "qu'est-ce que",
        "qu'est ce qu'", "qu'est-ce qu'", "qui est", "parle moi de",
        "parle-moi de", "definition de", "definir", "definis"
    ]
    for pref in prefixes:
        if t.startswith(pref):
            reste = t[len(pref):].strip()
            for art in ["le ", "la ", "les ", "un ", "une ", "des ", "l'", "d'"]:
                if reste.startswith(art):
                    reste = reste[len(art):].strip()
                    break
            mots = reste.split()
            if mots:
                return mots[0]
    mots_totaux = t.split()
    if len(mots_totaux) == 1:
        mot = mots_totaux[0]
        if len(mot) >= 3 and mot not in ["bonjour", "salut", "merci", "aide", "oui", "non"]:
            return mot
    elif len(mots_totaux) == 2 and mots_totaux[0] in ["le", "la", "les", "un", "une", "des", "ce", "cet", "cette"]:
        return mots_totaux[1]
    return None

def extraire_x(texte, memoire_dict, regles_dict, syn_dict, ctx_list):
    t = sans_accent(texte).strip().rstrip("?.! ")
    if "pourquoi" in t:
        idx = t.find("pourquoi")
        reste = t[idx + 8:].strip()
        for art in ["le ", "la ", "les ", "un ", "une ", "l'", "d'"]:
            if reste.startswith(art):
                reste = reste[len(art):].strip()
                break
        mots = reste.split()
        if mots:
            return mots[0]
    c_def = est_requete_definition(texte)
    if c_def:
        return c_def
    for p in ["il", "elle", "lui", "ceci", "cela"]:
        if p in t.split() and ctx_list:
            return ctx_list[-1]
    return None

def deduire_chaine(sujet, liens_dict, max_depth=6):
    chemin = [sujet]
    curr = sujet
    for _ in range(max_depth):
        parents = liens_dict.get(curr, [])
        if parents:
            curr = parents[0]
            chemin.append(curr)
        else:
            break
    return chemin

def repondre_pourquoi(texte, memoire_dict, regles_dict, liens_dict, syn_dict):
    sujet = extraire_x(texte, memoire_dict, regles_dict, syn_dict, contexte)
    if not sujet: return None
    chaine = deduire_chaine(sujet, liens_dict)
    for ancetre in chaine:
        if ancetre in regles_dict:
            for r in regles_dict[ancetre]:
                if r.get("quant") in ["tous", "chaque"]:
                    return f"Parce que {sujet} est un {ancetre}, et que tous les {ancetre}s {r.get('prop')}."
    return None

def apprendre_de_groq(question, reponse, memoire_dict):
    q_clean = sans_accent(question).strip()
    concept = est_requete_definition(question)
    if concept:
        sujet = concept
        prem_phrase = reponse.split(".")[0].strip()
        if len(prem_phrase) > 10:
            if sujet not in memoire_dict:
                memoire_dict[sujet] = []
            memoire_dict[sujet].insert(0, {
                "def": prem_phrase,
                "poids": 0.85,
                "hits": 1,
                "source": "groq",
                "type": "concept",
                "question_origine": question,
                "last_used": datetime.now().isoformat(),
                "created": datetime.now().isoformat()
            })
            sauvegarder_donnees()
            return sujet
    else:
        # Enregistrer Question + Réponse (Q&R)
        canonical_q = " ".join(nettoyer_ponctuation(q_clean).split())
        if len(canonical_q) > 4:
            mots_cles = list(extraire_mots_cles(question))
            if canonical_q not in memoire_dict:
                memoire_dict[canonical_q] = []
            memoire_dict[canonical_q].insert(0, {
                "def": reponse.strip(),
                "poids": 0.85,
                "hits": 1,
                "source": "groq",
                "type": "question_reponse",
                "mots_cles": mots_cles,
                "question_origine": question,
                "last_used": datetime.now().isoformat(),
                "created": datetime.now().isoformat()
            })
            sauvegarder_donnees()
            return canonical_q
    return None

# ==============================================================================
# INJECTION DE MEMOIRE CHIRURGICALE POUR LLM LOCAL (NOVA)
# ==============================================================================
def construire_prompt_contextuel_nova(question):
    """
    Construit le prompt chirurgical spécifiquement adapté pour le modèle local Nova.
    """
    qa_match = trouver_question_reponse(question, memoire)
    fait_connu = ""
    sujet_ref = ""

    if qa_match:
        fait_connu = qa_match["entry"].get("def", "")
        sujet_ref = qa_match["sujet"]
    else:
        x = extraire_x(question, memoire, regles, synonymes, contexte)
        if x and x in memoire:
            defs = [item["def"] for item in memoire[x]]
            fait_connu = " ; ".join(defs)
            sujet_ref = x

    if fait_connu:
        bloc_ctx = f"[FAIT VÉRIFIÉ EN MÉMOIRE LOCALE SUR '{sujet_ref.upper()}']\\n- {fait_connu}"
    else:
        bloc_ctx = "[MÉMOIRE LOCALE]\\nAucun fait spécifique stocké. Réponds avec fluidité et concision."

    return f"{SYSTEM_PROMPT}\\n\\n{bloc_ctx}\\n\\nUtilisateur: {question}\\nKADERBOT Nova:"

# ==============================================================================
# APPEL API GROQ
# ==============================================================================
def appeler_groq_sync(prompt, history_list):
    if not API_KEY.strip():
        return "Clé Groq non configurée. Ouvre les paramètres ou définis API_KEY."
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in history_list[-4:]:
        messages.append(h)
    messages.append({"role": "user", "content": prompt})

    payload = json.dumps({
        "model": MODEL_GROQ,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 600
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {API_KEY.strip()}",
            "Content-Type": "application/json",
            "User-Agent": "kaderbot-pydroid-v14"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        return f"Erreur Groq ({e.code}) : {err_msg}"
    except Exception as e:
        return f"Erreur connexion : {str(e)}"

# ==============================================================================
# DISPATCHER CENTRAL DE TRAITEMENT DES MESSAGES
# ==============================================================================
def traiter_message_texte(texte):
    """
    Traite un message et retourne un tuple : (type_source, message_reponse)
    type_source : 'LOCAL', 'DEDUCTION', 'GROQ', 'COMMANDE', 'SYSTEME'
    """
    txt = texte.strip()
    if not txt:
        return ("SYSTEME", "Message vide.")
    txt_lower = txt.lower()

    # 1. Commande retiens
    if txt_lower.startswith("retiens:"):
        corps = txt[8:].strip()
        if "=" in corps:
            s, d = [p.strip() for p in corps.split("=", 1)]
            s_clean = s.lower()
            if s_clean not in memoire: memoire[s_clean] = []
            memoire[s_clean].insert(0, {
                "def": d, "poids": 0.85, "hits": 1, "source": "manuel",
                "type": "concept",
                "last_used": datetime.now().isoformat(), "created": datetime.now().isoformat()
            })
            contexte.append(s_clean)
            sauvegarder_donnees()
            return ("COMMANDE", f"Fait retenu pour '{s_clean}' : {d}")
        return ("SYSTEME", "Format : retiens: sujet = définition")

    # 2. Commande lie
    if txt_lower.startswith("lie:"):
        corps = txt[4:].strip()
        if "->" in corps:
            src, dst = [p.strip().lower() for p in corps.split("->", 1)]
            if src not in liens: liens[src] = []
            if dst not in liens[src]: liens[src].append(dst)
            sauvegarder_donnees()
            return ("DEDUCTION", f"Lien d'héritage établi : {src} -> {dst}")
        return ("SYSTEME", "Format : lie: moineau -> oiseau")

    # 3. Commande lister
    if txt_lower.startswith("lister:"):
        cible = txt_lower[7:].strip()
        if cible == "memoire":
            keys = sorted(list(memoire.keys()))
            return ("SYSTEME", f"Mémoire ({len(keys)} sujets) :\\n" + ", ".join(keys[:35]))
        if cible == "regles":
            return ("SYSTEME", f"Règles ({len(regles)} catégories) :\\n" + ", ".join(regles.keys()))
        if cible == "liens":
            lignes = [f"{k} -> {', '.join(v)}" for k, v in liens.items()]
            return ("SYSTEME", "Liens d'héritage :\\n" + "\\n".join(lignes[:20]))

    # 4. Question causale 'pourquoi'
    if "pourquoi" in txt_lower:
        rep = repondre_pourquoi(txt, memoire, regles, liens, synonymes)
        if rep:
            return ("DEDUCTION", rep)

    # 5. Recherche Question-Réponse (Q&R enregistrée)
    qa_match = trouver_question_reponse(txt, memoire)
    if qa_match:
        entry = qa_match["entry"]
        rep = entry.get("def", "")
        return ("LOCAL", rep)

    # 6. Définition directe de concept
    x = extraire_x(txt, memoire, regles, synonymes, contexte)
    if x and x in memoire:
        contexte.append(x)
        defs = [item["def"] for item in memoire[x]]
        return ("LOCAL", f"{x.capitalize()} : " + " ; ".join(defs))

    # 7. Recherche floue Levenshtein (en cas de faute de frappe)
    flou = rechercher_flou(txt, memoire, regles)
    if flou and flou in memoire:
        contexte.append(flou)
        defs = [item["def"] for item in memoire[flou]]
        return ("LOCAL", f"(Tu voulais dire '{flou}' ?) : " + " ; ".join(defs))

    # 8. Fallback Groq Cloud
    if GROQ_ACTIF:
        rep = appeler_groq_sync(txt, historique_chat)
        historique_chat.append({"role": "user", "content": txt})
        historique_chat.append({"role": "assistant", "content": rep})
        apprendre_de_groq(txt, rep, memoire)
        return ("GROQ", rep)

    return ("LOCAL", f"Je ne connais pas encore ce sujet. Enseigne-le moi avec : retiens: {txt} = ...")

# ==============================================================================
# MODE 1 : INTERFACE CONSOLE / TERMINAL INTERACTIF (100% GARANTI SUR PYDROID 3)
# ==============================================================================
def lancer_mode_console():
    banner = f"""
================================================================================
          KADERBOT NOVA V14 - MOTEUR COGNITIF HYBRIDE (PYDROID 3)
================================================================================
[INFO] Mémoire locale chargée : {len(memoire)} entrées | {len(regles)} règles | {len(liens)} liens
[INFO] Modèle Groq actif : {"OUI (" + MODEL_GROQ + ")" if GROQ_ACTIF else "NON (Mode local seul)"}
--------------------------------------------------------------------------------
Commandes utiles :
  • Poser une question   : "c'est quoi le moineau ?", "pourquoi le faucon vole ?"
  • Apprendre un concept : "retiens: pigeon = oiseau urbain"
  • Créer un lien Is-A   : "lie: pigeon -> oiseau"
  • Inspecter la mémoire : "lister: memoire" ou "lister: regles"
  • Quitter              : "quitter" ou "exit"
================================================================================
"""
    print(banner)

    while True:
        try:
            user_input = input("\\n[Toi] > ").strip()
            if not user_input:
                continue

            if user_input.lower() in ["quitter", "exit", "quit", "q"]:
                print("\\n[KADERBOT] Au revoir et à bientôt ! Données sauvegardées.")
                sauvegarder_donnees()
                break

            source, reponse = traiter_message_texte(user_input)
            prefixe = f"[KADERBOT | {source}]"
            print(f"\\n{prefixe}\\n{reponse}")

        except (KeyboardInterrupt, EOFError):
            print("\\n\\n[KADERBOT] Interruption détectée. Données sauvegardées.")
            sauvegarder_donnees()
            break
        except Exception as err:
            print(f"[!] Erreur inattendue : {err}")

# ==============================================================================
# MODE 2 : INTERFACE GRAPHIQUE TKINTER (SI DISPONIBLE SUR ANDROID)
# ==============================================================================
def lancer_mode_tkinter():
    try:
        import tkinter as tk
        from tkinter import scrolledtext
    except Exception as e:
        print(f"[!] Tkinter n'est pas disponible dans ce Pydroid 3 ({e}).")
        print("[*] Bascule automatique sur la Console Interactive...")
        lancer_mode_console()
        return

    class KaderbotTkApp:
        def __init__(self, root):
            self.root = root
            self.root.title("KADERBOT NOVA V14 - Pydroid 3")
            self.root.geometry("480x760")
            self.root.configure(bg="#050508")

            # Bannière supérieure
            top_frame = tk.Frame(root, bg="#090B10", padx=10, pady=8)
            top_frame.pack(fill=tk.X)

            title_lbl = tk.Label(top_frame, text="KADERBOT NOVA V14", fg="#10A37F", bg="#090B10", font=("Arial", 13, "bold"))
            title_lbl.pack(side=tk.LEFT)

            self.stats_lbl = tk.Label(top_frame, text=f"{len(memoire)} faits", fg="#718096", bg="#090B10", font=("Arial", 9))
            self.stats_lbl.pack(side=tk.RIGHT)

            # Zone de discussion
            self.chat_area = scrolledtext.ScrolledText(root, bg="#0B0E17", fg="#E2E8F0", font=("Arial", 11), wrap=tk.WORD, bd=0, padx=10, pady=10)
            self.chat_area.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)
            self.chat_area.tag_config("user", foreground="#63B3ED", justify="right")
            self.chat_area.tag_config("bot", foreground="#48BB78")
            self.chat_area.tag_config("system", foreground="#A0AEC0", font=("Arial", 9, "italic"))

            # Raccourcis tactiles
            pills_frame = tk.Frame(root, bg="#050508")
            pills_frame.pack(fill=tk.X, padx=8, pady=2)
            pills = [("C'est quoi...", "c'est quoi "), ("Pourquoi...", "pourquoi "), ("Retiens", "retiens: "), ("Mémoire", "lister: memoire")]
            for label, cmd in pills:
                btn = tk.Button(pills_frame, text=label, bg="#161822", fg="#CBD5E0", font=("Arial", 8), bd=1, relief=tk.FLAT, padx=6, pady=2,
                                command=lambda c=cmd: self.prefill(c))
                btn.pack(side=tk.LEFT, padx=2)

            # Zone d'envoi
            bottom_frame = tk.Frame(root, bg="#090B10", padx=8, pady=6)
            bottom_frame.pack(fill=tk.X)
            self.entry = tk.Entry(bottom_frame, bg="#161822", fg="#FFFFFF", insertbackground="#10A37F", font=("Arial", 11), bd=1, relief=tk.FLAT)
            self.entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, padx=(0, 6))
            self.entry.bind("<Return>", lambda e: self.envoyer())

            send_btn = tk.Button(bottom_frame, text="Envoyer", bg="#10A37F", fg="#FFFFFF", font=("Arial", 10, "bold"), bd=0, padx=12, pady=6, command=self.envoyer)
            send_btn.pack(side=tk.RIGHT)

            self.ajouter_message("KADERBOT", "Bonjour ! Je suis KADERBOT NOVA V14. Pose-moi une question ou utilise 'retiens: sujet = définition'.", "bot")

        def prefill(self, text):
            self.entry.delete(0, tk.END)
            self.entry.insert(0, text)
            self.entry.focus()

        def ajouter_message(self, auteur, texte, tag):
            self.chat_area.config(state=tk.NORMAL)
            if auteur:
                self.chat_area.insert(tk.END, f"\\n[{auteur}]\\n", tag)
            self.chat_area.insert(tk.END, f"{texte}\\n", tag)
            self.chat_area.see(tk.END)
            self.chat_area.config(state=tk.DISABLED)

        def envoyer(self):
            txt = self.entry.get().strip()
            if not txt: return
            self.entry.delete(0, tk.END)
            self.ajouter_message("Toi", txt, "user")
            source, rep = traiter_message_texte(txt)
            self.stats_lbl.config(text=f"{len(memoire)} faits")
            self.ajouter_message(f"KADERBOT | {source}", rep, "bot")

    try:
        root = tk.Tk()
        app = KaderbotTkApp(root)
        root.mainloop()
    except Exception as e:
        print(f"[!] Erreur au lancement de l'interface graphique Tkinter ({e}).")
        print("[*] Bascule automatique sur la Console Interactive...")
        lancer_mode_console()

# ==============================================================================
# POINT D'ENTREE PRINCIPAL
# ==============================================================================
if __name__ == "__main__":
    if MODE_CIBLE == "GUI":
        lancer_mode_tkinter()
    elif MODE_CIBLE == "CONSOLE":
        lancer_mode_console()
    else: # AUTO
        try:
            import tkinter as tk
            lancer_mode_tkinter()
        except Exception:
            lancer_mode_console()
`;

    const filename =
      mode === 'console'
        ? 'kaderbot_v14_pydroid_terminal.py'
        : mode === 'gui'
        ? 'kaderbot_v14_pydroid_tkinter.py'
        : 'kaderbot_v14_pydroid.py';

    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pythonScript);
  } catch (err: any) {
    console.error('Erreur export pydroid:', err);
    return res.status(500).json({ error: err.message });
  }
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

  const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 Serveur KADERBOT NOVA opérationnel sur http://${HOST}:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('Erreur serveur HTTP:', err);
  });
}

process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

startServer().catch((err) => {
  console.error('Erreur démarrage serveur:', err);
});
```

---

<a id="srctypeskaderbotts"></a>
## Fichier : `src/types/kaderbot.ts`

> **Description** : Typage TypeScript complet (ReAct, Mémoire, Messages, Graphe)

```typescript
import type { PendingAgentAction, ToolExecutionTrace } from './agent';

export type { PendingAgentAction, ToolExecutionTrace } from './agent';

export interface MemoryEntry {
  def: string;
  poids: number; // 0.1 to 1.0
  hits: number;
  source: 'manuel' | 'groq' | 'gemini' | 'auto';
  last_used: string;
  created: string;
  question_origine?: string;
  type?: 'concept' | 'question_reponse';
  mots_cles?: string[];
  vecteur?: number[]; // Vecteur d'embedding sémantique (Transformers.js all-MiniLM-L6-v2)
}

export interface GeneralRule {
  quant: 'tous' | 'aucun' | 'certains';
  prop: string;
  poids: number;
  hits: number;
  last_used: string;
  created: string;
}

export type MemoryStore = Record<string, MemoryEntry[]>;
export type RulesStore = Record<string, GeneralRule[]>;
export type LinksStore = Record<string, string[]>;
export type SynonymsStore = Record<string, string | string[]>;

export interface ChatMessage {
  id: string;
  author: 'Toi' | 'KB';
  text: string;
  timestamp: string;
  confidence?: number;
  isNew?: boolean;
  meta?: {
    intent?: string;
    sujet?: string;
    chemin?: string[];
    source?:
      | 'local_memoire'
      | 'deduction'
      | 'regle'
      | 'groq'
      | 'gemini'
      | 'systeme'
      | 'semantique'
      | 'openrouter'
      | 'groq-agent'
      | 'openrouter-agent'
      | 'groq-chat';
    ruleApplied?: string;
    model?: string;
    toolTrace?: ToolExecutionTrace[];
    isFallback?: boolean;
    fallbackReason?: string;
    routedTo?: 'chat' | 'agent';
    pendingAction?: PendingAgentAction;
  };
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface IdeaItem {
  id: number;
  title: string;
  theme: string;
  style: string;
  timestamp: string;
  developedText?: string;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  category: string;
  weight: number;
  hits: number;
  definitionsCount: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type: 'is_a' | 'custom_link' | 'rule';
}

export type LLMProvider = 'gemini' | 'groq' | 'openrouter' | 'local_only';

export interface AppConfig {
  provider: LLMProvider;
  geminiApiKey?: string;
  groqApiKey?: string;
  openrouterApiKey?: string;
  groqModel: string;
  openrouterModel: string;
  geminiModel: string;
  adminToken?: string;
  systemPrompt: string;
  activeSession: string;
  soundEnabled: boolean;
  autoLearnFromLLM: boolean;
  contexteRecent?: string[];
}
```

---

<a id="srcservicesapiServicets"></a>
## Fichier : `src/services/apiService.ts`

> **Description** : Service API client avec appel agent ReAct et timeout 120s

```typescript
import { MemoryStore, RulesStore, LinksStore, SynonymsStore, ToolExecutionTrace, PendingAgentAction } from '../types/kaderbot';

function getAdminHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('kaderbot_config');
    const config = raw ? JSON.parse(raw) : null;
    return config?.adminToken?.trim()
      ? { 'X-Admin-Token': config.adminToken.trim() }
      : {};
  } catch {
    return {};
  }
}

export interface ChatApiParams {
  prompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  provider: 'gemini' | 'groq' | 'openrouter' | 'local_only';
  groqModel?: string;
  openrouterModel?: string;
  systemPrompt?: string;
}

export interface ChatApiResponse {
  text: string;
  provider: string;
  model?: string;
  isFallback?: boolean;
  fallbackReason?: string;
}

export const apiService = {
  async verifyAdminSession(): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async chat(params: ChatApiParams): Promise<ChatApiResponse> {
    // Strip any sensitive keys - Server exclusively uses process.env keys
    const { prompt, history, provider, groqModel, openrouterModel, systemPrompt } = params as any;
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        history,
        provider,
        groqModel,
        openrouterModel,
        systemPrompt,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
      throw new Error(err.error || `Erreur serveur (${res.status})`);
    }

    return await res.json();
  },

  async testOpenRouterConnection(
    apiKey?: string,
    model = 'meta-llama/llama-3.3-70b-instruct:free'
  ): Promise<{ ok: boolean; model?: string; latencyMs?: number; error?: string; reply?: string }> {
    const res = await fetch('/api/openrouter/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey?.trim() || undefined, model }),
    });

    return await res.json();
  },

  async testGroqConnection(
    apiKey?: string,
    model = 'openai/gpt-oss-120b'
  ): Promise<{ ok: boolean; model?: string; latencyMs?: number; error?: string; reply?: string }> {
    const res = await fetch('/api/groq/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey?.trim() || undefined, model }),
    });

    return await res.json();
  },

  async testGeminiConnection(
    apiKey?: string
  ): Promise<{ ok: boolean; model?: string; latencyMs?: number; error?: string; reply?: string }> {
    const res = await fetch('/api/gemini/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey?.trim() || undefined }),
    });

    return await res.json();
  },

  async genererIdees(params: {
    theme: string;
    count: number;
    style: string;
    styleDesc?: string;
    provider: string;
    groqModel?: string;
    openrouterModel?: string;
  }): Promise<string> {
    const { theme, count, style, styleDesc, provider, groqModel, openrouterModel } = params as any;
    const res = await fetch('/api/idees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme,
        count,
        style,
        styleDesc,
        provider,
        groqModel,
        openrouterModel,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur génération idées' }));
      throw new Error(err.error || 'Erreur génération');
    }

    const data = await res.json();
    return data.text || '';
  },

  async traduire(params: {
    text: string;
    targetLang: string;
    provider: string;
    groqModel?: string;
    openrouterModel?: string;
  }): Promise<string> {
    const { text, targetLang, provider, groqModel, openrouterModel } = params as any;
    const res = await fetch('/api/traduis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLang,
        provider,
        groqModel,
        openrouterModel,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur traduction' }));
      throw new Error(err.error || 'Erreur traduction');
    }

    const data = await res.json();
    return data.text || '';
  },

  async corriger(params: {
    text: string;
    provider: string;
    groqModel?: string;
    openrouterModel?: string;
  }): Promise<string> {
    const { text, provider, groqModel, openrouterModel } = params as any;
    const res = await fetch('/api/corrige', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        provider,
        groqModel,
        openrouterModel,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur correction' }));
      throw new Error(err.error || 'Erreur correction');
    }

    const data = await res.json();
    return data.text || '';
  },

  async resumer(params: {
    text: string;
    provider: string;
    groqModel?: string;
    openrouterModel?: string;
  }): Promise<string> {
    const { text, provider, groqModel, openrouterModel } = params as any;
    const res = await fetch('/api/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        provider,
        groqModel,
        openrouterModel,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur résumé' }));
      throw new Error(err.error || 'Erreur résumé');
    }

    const data = await res.json();
    return data.text || '';
  },

  async loadMemoryFromServer(): Promise<{
    memoire: MemoryStore;
    regles: RulesStore;
    liens: LinksStore;
    synonymes: SynonymsStore;
    sessions: string[];
  }> {
    const res = await fetch('/api/memory', { headers: getAdminHeaders() });
    if (!res.ok) throw new Error('Impossible de charger la mémoire distante');
    return await res.json();
  },

  async saveMemoryToServer(data: {
    memoire: MemoryStore;
    regles: RulesStore;
    liens: LinksStore;
    synonymes: SynonymsStore;
    sessions: string[];
  }): Promise<{ success: boolean; savedAt: string }> {
    const res = await fetch('/api/memory/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erreur sauvegarde sur serveur');
    return await res.json();
  },

  async downloadPydroidScript(data: {
    memoire: MemoryStore;
    regles: RulesStore;
    liens: LinksStore;
    groqApiKey?: string;
    groqModel?: string;
    mode?: 'auto' | 'console' | 'gui';
  }): Promise<Blob> {
    const res = await fetch('/api/export-pydroid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erreur téléchargement script Pydroid 3');
    return await res.blob();
  },

  async sendAgentMessage(
    prompt: string,
    history: Array<{ role: string; content: string }> = []
  ): Promise<AgentApiResponse> {
    return sendAgentMessage(prompt, history);
  },

  async callAgent(params: {
    prompt: string;
    history?: Array<{ role: string; content: string }>;
    systemPrompt?: string;
  }): Promise<AgentApiResponse> {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
      throw new Error(err.error || `Erreur serveur (${res.status})`);
    }
    return await res.json();
  },

  async refreshMemory(): Promise<{ ok: boolean; data: any; refreshedAt: string }> {
    const res = await fetch('/api/memory/refresh', { headers: getAdminHeaders() });
    if (!res.ok) throw new Error('Impossible de rafraîchir la mémoire');
    return await res.json();
  },

  async checkHealth(): Promise<{ ok: boolean }> {
    const res = await fetch('/api/health');
    if (!res.ok) return { ok: false };
    return await res.json();
  },
};

export interface AgentApiResponse {
  text?: string;
  provider: string;
  model?: string;
  toolTrace: ToolExecutionTrace[];
  awaitingUser?: boolean;
  question?: string;
  isFallback?: boolean;
  fallbackReason?: string;
  routedTo?: 'chat' | 'agent';
  pendingAction?: PendingAgentAction;
}

export interface AgentActionDecisionResponse {
  ok: boolean;
  text: string;
  provider: string;
  toolTrace: ToolExecutionTrace[];
}

export async function decideAgentAction(
  actionId: string,
  decision: 'approve' | 'reject'
): Promise<AgentActionDecisionResponse> {
  const res = await fetch('/api/agent/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actionId, decision }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
    throw new Error(err.error || `Erreur serveur (${res.status})`);
  }

  return await res.json();
}

export async function sendAgentMessage(
  prompt: string,
  history: Array<{ role: string; content: string }> = []
): Promise<AgentApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
      throw new Error(err.error || `Erreur serveur (${res.status})`);
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error("Délai d'attente de l'agent dépassé (120s). Veuillez réessayer avec une question plus ciblée.");
    }
    throw err;
  }
}
```

---

<a id="srcshimsstyle-to-jsts"></a>
## Fichier : `src/shims/style-to-js.ts`

> **Description** : Shim ESM natif pour compatibilité style-to-js / react-markdown

```typescript
import StyleToObject from 'style-to-object';

const CUSTOM_PROPERTY_REGEX = /^--[a-zA-Z0-9_-]+$/;
const HYPHEN_REGEX = /-([a-z])/g;
const NO_HYPHEN_REGEX = /^[^-]+$/;
const VENDOR_PREFIX_REGEX = /^-(webkit|moz|ms|o|khtml)-/;
const MS_VENDOR_PREFIX_REGEX = /^-(ms)-/;

const skipCamelCase = (property: string) =>
  !property ||
  NO_HYPHEN_REGEX.test(property) ||
  CUSTOM_PROPERTY_REGEX.test(property);

const capitalize = (_match: string, character: string) =>
  character.toUpperCase();

const trimHyphen = (_match: string, prefix: string) => `${prefix}-`;

export interface CamelCaseOptions {
  reactCompat?: boolean;
}

export const camelCase = (property: string, options: CamelCaseOptions = {}) => {
  if (skipCamelCase(property)) {
    return property;
  }

  property = property.toLowerCase();

  if (options.reactCompat) {
    property = property.replace(MS_VENDOR_PREFIX_REGEX, trimHyphen);
  } else {
    property = property.replace(VENDOR_PREFIX_REGEX, trimHyphen);
  }

  return property.replace(HYPHEN_REGEX, capitalize);
};

export type StyleObject = Record<string, string>;

export interface StyleToJSOptions extends CamelCaseOptions {}

export function StyleToJS(style: string, options?: StyleToJSOptions): StyleObject {
  const output: StyleObject = {};

  if (!style || typeof style !== 'string') {
    return output;
  }

  StyleToObject(style, (property, value) => {
    if (property && value) {
      output[camelCase(property, options)] = value;
    }
  });

  return output;
}

(StyleToJS as any).default = StyleToJS;

export default StyleToJS;
```

---

<a id="srccomponentsChatTabtsx"></a>
## Fichier : `src/components/ChatTab.tsx`

> **Description** : Interface Chat avec accordéons Réflexion (live & ReAct breakdown)

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Brain,
  ThumbsUp,
  ThumbsDown,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Share2,
  Copy,
  Check,
  History,
  Plus,
  X,
  MessageSquare,
  Clock,
  Pencil,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Compass,
  Layers,
  Eye,
  Workflow,
} from 'lucide-react';
import { ChatMessage, ChatThread, PendingAgentAction, ToolExecutionTrace } from '../types/kaderbot';

const markdownComponents = {
  p: ({ children }: any) => (
    <p className="mb-2.5 last:mb-0 leading-relaxed text-gray-100">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside space-y-1.5 my-2.5 text-gray-200 pl-1">
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside space-y-1.5 my-2.5 text-gray-200 pl-1">
      {children}
    </ol>
  ),
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: any) => (
    <strong className="font-semibold text-emerald-300">{children}</strong>
  ),
  em: ({ children }: any) => <em className="italic text-cyan-200">{children}</em>,
  code: ({ className, children }: any) => {
    const isMultiLine = typeof children === 'string' && children.includes('\n');
    if (className || isMultiLine) {
      return (
        <pre className="p-3 my-2.5 rounded-xl bg-[#080B11] border border-gray-800 font-mono text-[11px] sm:text-xs overflow-x-auto text-emerald-200 leading-normal">
          <code className={className}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="px-1.5 py-0.5 rounded bg-gray-800/90 text-emerald-300 font-mono text-[11px] sm:text-xs border border-gray-700/50">
        {children}
      </code>
    );
  },
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-emerald-500/60 pl-3 italic text-gray-300 my-2">
      {children}
    </blockquote>
  ),
  h1: ({ children }: any) => (
    <h1 className="text-base font-bold text-white mb-2">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-sm font-bold text-emerald-400 mb-1.5">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-xs font-bold text-cyan-300 mb-1">{children}</h3>
  ),
  hr: () => <hr className="my-3 border-gray-800" />,
};

interface BotTypewriterMessageProps {
  text: string;
  onComplete: () => void;
  onTick?: () => void;
}

/**
 * Composant de message KADERBOT NOVA avec effet machine à écrire (streaming)
 * Uniquement actif pour les nouveaux messages en temps réel (msg.isNew === true).
 */
const BotTypewriterMessage: React.FC<BotTypewriterMessageProps> = ({
  text,
  onComplete,
  onTick,
}) => {
  const [displayedLength, setDisplayedLength] = useState(1);
  const isTyping = displayedLength < text.length;

  useEffect(() => {
    if (displayedLength >= text.length) {
      onComplete();
      return;
    }

    // Vitesse fluide ~20ms par caractère
    const interval = setInterval(() => {
      setDisplayedLength(prev => {
        const step = text.length > 350 ? 2 : 1;
        const next = Math.min(text.length, prev + step);
        if (next >= text.length) {
          clearInterval(interval);
          onComplete();
        }
        return next;
      });
      onTick?.();
    }, 20);

    return () => clearInterval(interval);
  }, [text, onComplete, onTick, displayedLength]);

  const displayedContent = text.slice(0, displayedLength);

  return (
    <div className="relative">
      <div className="text-gray-100 text-xs sm:text-sm leading-relaxed">
        <ReactMarkdown components={markdownComponents}>
          {displayedContent}
        </ReactMarkdown>
      </div>
      {isTyping && (
        <span
          className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse ml-0.5 align-middle rounded-xs"
          title="Frappe en cours..."
        />
      )}
    </div>
  );
};

interface ThinkingAccordionProps {
  thinkingStatus?: string;
}

/**
 * Composant Accordéon repliable affiché pendant que KADERBOT réfléchit (live thinking).
 * Permet de cliquer sur "Réflexion" pour voir les détails en direct de l'étape de raisonnement.
 */
const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({ thinkingStatus }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col items-start space-y-1.5 animate-in fade-in max-w-full sm:max-w-xl">
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[11px] font-semibold text-emerald-400">KADERBOT NOVA</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <span className="text-[10px] text-gray-500 font-mono">Boucle ReAct active</span>
      </div>

      <div className="w-full bg-[#0E131F] border border-emerald-500/35 rounded-2xl p-2.5 sm:p-3 shadow-lg shadow-emerald-950/20">
        {/* En-tête de l'accordéon cliquable */}
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="w-full flex items-center justify-between gap-3 text-left group cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white tracking-wide">
                  Réflexion
                </span>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
              <p className="text-[11px] text-emerald-300/90 truncate font-medium mt-0.5">
                {thinkingStatus || 'Décomposition de la tâche et analyse des intentions...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-gray-400 group-hover:text-emerald-300 text-xs transition">
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              {isOpen ? 'Masquer' : 'Détails de l’étape'}
            </span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Détails déroulants du raisonnement ReAct pendant la réflexion */}
        {isOpen && (
          <div className="mt-3 pt-3 border-t border-gray-800/80 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Workflow className="w-3 h-3" />
                Cycle ReAct (Jusqu'à 25 itérations)
              </span>
              <span>Étape en cours</span>
            </div>

            {/* Barre de progression visuelle animée */}
            <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
              <div className="h-full bg-linear-to-r from-emerald-500 via-cyan-400 to-emerald-400 animate-pulse w-3/4 rounded-full" />
            </div>

            {/* Décomposition des étapes du raisonnement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-lg bg-[#080B12] border border-gray-800/80">
                <div className="flex items-center gap-1.5 text-emerald-300 font-medium mb-0.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>1. Pensée (Thought)</span>
                </div>
                <p className="text-gray-400 text-[10px] leading-tight">
                  Décomposition du problème et formulation d'objectifs ciblés.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-[#080B12] border border-gray-800/80">
                <div className="flex items-center gap-1.5 text-cyan-300 font-medium mb-0.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>2. Action (Outils)</span>
                </div>
                <p className="text-gray-400 text-[10px] leading-tight">
                  Appel des outils : Mémoire cognitive, Brave Search ou lecture d'URLs.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-[#080B12] border border-gray-800/80">
                <div className="flex items-center gap-1.5 text-emerald-300 font-medium mb-0.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. Observation</span>
                </div>
                <p className="text-gray-400 text-[10px] leading-tight">
                  Extraction et examen rigoureux des faits et détection d'incidents.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-[#080B12] border border-gray-800/80">
                <div className="flex items-center gap-1.5 text-purple-300 font-medium mb-0.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>4. Adaptation</span>
                </div>
                <p className="text-gray-400 text-[10px] leading-tight">
                  Ajustement de stratégie et pivot vers la synthèse finale.
                </p>
              </div>
            </div>

            <div className="text-[10px] text-gray-500 italic text-center pt-1">
              KADERBOT adapte sa stratégie à chaque retour d'outil jusqu'à résolution complète.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface AgentTraceAccordionProps {
  toolTrace: ToolExecutionTrace[];
}

/**
 * Composant Accordéon repliable "Réflexion" pour afficher la décomposition ReAct complète dans le message du bot.
 * Replié par défaut avec intitulé "Réflexion : X étapes de raisonnement (ReAct)".
 * Déplie au clic la pensée, l'action, l'observation et l'adaptation de stratégie pour chaque étape.
 */
const AgentTraceAccordion: React.FC<AgentTraceAccordionProps> = ({ toolTrace }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!toolTrace || toolTrace.length === 0) return null;

  const total = toolTrace.length;
  const failures = toolTrace.filter(t => t.status === 'error' || Boolean(t.errorMsg)).length;

  const getToolMeta = (toolName: string) => {
    switch (toolName) {
      case 'search_web':
        return { label: 'Recherche Web (Brave)', icon: '🌐' };
      case 'search_news':
        return { label: 'Actualités Récentes', icon: '📰' };
      case 'open_url':
        return { label: 'Consultation de Page', icon: '📄' };
      case 'memo_lookup':
        return { label: 'Mémoire Cognitive', icon: '🧠' };
      case 'memo_store':
        return { label: 'Mémorisation Faits', icon: '💾' };
      case 'link_concepts':
        return { label: 'Association d\'Idées', icon: '🔗' };
      case 'create_note':
        return { label: 'Création de note', icon: '📝' };
      case 'search_notes':
        return { label: 'Recherche de notes', icon: '📚' };
      case 'create_event':
        return { label: 'Ajout Événement Agenda', icon: '📅' };
      case 'list_events':
        return { label: 'Consultation Agenda', icon: '🗓️' };
      case 'send_message':
        return { label: 'Messagerie', icon: '✉️' };
      case 'ask_user':
        return { label: 'Demande de Précision', icon: '❓' };
      default:
        return { label: toolName, icon: '⚙️' };
    }
  };

  return (
    <div className="mt-3 pt-2 border-t border-gray-800/70">
      {/* Bouton de l'accordéon Réflexion replié par défaut */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#0B0F19]/90 hover:bg-[#111726] border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition group text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-white">
            Réflexion
          </span>
          <span className="text-[11px] text-gray-400 font-normal">
            • {total} étape{total > 1 ? 's' : ''} de raisonnement (ReAct)
          </span>
          {failures > 0 ? (
            <span className="text-amber-400 text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/50">
              {failures} incident{failures > 1 ? 's' : ''} adapté{failures > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-emerald-400 text-[10px] font-medium hidden sm:inline">
              ✓ Stratégie validée
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-gray-400 group-hover:text-emerald-400 text-xs">
          <span className="text-[10px] text-gray-400 hidden sm:inline">
            {isOpen ? 'Masquer' : 'Voir les détails'}
          </span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Contenu déroulant avec la décomposition ReAct pas à pas */}
      {isOpen && (
        <div className="mt-2 p-3 rounded-xl bg-[#070A11] border border-gray-800/80 space-y-3 animate-in fade-in duration-150">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 flex items-center justify-between pb-1 border-b border-gray-800/60">
            <span className="flex items-center gap-1 text-emerald-400">
              <Workflow className="w-3 h-3" />
              Détails du raisonnement ReAct
            </span>
            <span className="text-gray-400 font-mono">
              {total} / 25 itérations max
            </span>
          </div>

          <div className="space-y-3">
            {toolTrace.map((trace, idx) => {
              const meta = getToolMeta(trace.tool);
              const isError = trace.status === 'error' || Boolean(trace.errorMsg);
              const traceUrl = typeof trace.args?.url === 'string' ? trace.args.url : '';
              const isUrl = trace.tool === 'open_url' && traceUrl;
              let hostname = '';
              if (isUrl) {
                try {
                  hostname = new URL(traceUrl).hostname.replace(/^www\./, '');
                } catch {
                  hostname = traceUrl;
                }
              }

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs space-y-2 ${
                    isError
                      ? 'bg-rose-950/15 border-rose-900/40 text-rose-200'
                      : 'bg-[#0E131F] border-gray-800/90 text-gray-300'
                  }`}
                >
                  {/* En-tête de l'étape */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-gray-800 text-emerald-300 font-mono font-bold text-[10px]">
                        Étape #{trace.step || idx + 1}
                      </span>
                      <span>{meta.icon}</span>
                      <span className="font-semibold text-white">{meta.label}</span>
                      <span className="font-mono text-[10px] text-gray-500">({trace.tool})</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {trace.durationMs !== undefined && (
                        <span className="text-[10px] font-mono text-gray-500">
                          {trace.durationMs}ms
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isError
                            ? 'bg-rose-900/60 text-rose-200 border border-rose-700/60'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                        }`}
                      >
                        {isError ? (
                          <>
                            <XCircle className="w-2.5 h-2.5" />
                            <span>Incident adapté</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Succès</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 1. Pensée (Thought / Décomposition de la tâche) */}
                  {trace.thought && (
                    <div className="p-2 rounded-lg bg-black/40 border border-gray-800/70 text-[11px] text-gray-300 space-y-0.5">
                      <div className="flex items-center gap-1 text-amber-300/90 font-medium text-[10px]">
                        <Lightbulb className="w-3 h-3 text-amber-400" />
                        <span>Pensée & Décomposition</span>
                      </div>
                      <p className="text-gray-200 italic leading-relaxed">
                        {trace.thought}
                      </p>
                    </div>
                  )}

                  {/* 2. Action (Paramètres de l'outil) */}
                  {trace.args && (
                    <div className="text-[11px] text-gray-400 pl-2.5 border-l-2 border-emerald-500/50">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-0.5">
                        Action exécutée :
                      </span>
                      {trace.args.query && (
                        <div>
                          <span className="text-gray-500">Recherche : </span>
                          <span className="text-cyan-200 font-medium">« {trace.args.query} »</span>
                        </div>
                      )}
                      {isUrl && (
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          <span className="text-gray-500">Source : </span>
                          <a
                            href={trace.args.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline font-mono text-[11px] truncate max-w-[280px]"
                            title={trace.args.url}
                          >
                            <span>{hostname || trace.args.url}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      )}
                      {trace.args.subject && (
                        <div>
                          <span className="text-gray-500">Sujet : </span>
                          <span className="text-emerald-300">{trace.args.subject}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Observation (Résultats ou Incident) */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5 text-gray-400" />
                      Observation :
                    </span>
                    {isError && trace.errorMsg ? (
                      <div className="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300 font-sans flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <div>
                          <span className="font-semibold text-rose-200">Incident intercepté : </span>
                          <span>{trace.errorMsg}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-gray-400 bg-black/40 px-2 py-1 rounded border border-gray-800/60 truncate">
                        {trace.observation || trace.resultSnippet || 'Données collectées avec succès.'}
                      </div>
                    )}
                  </div>

                  {/* 4. Stratégie & Adaptation (Réflexion de suite) */}
                  {trace.strategy && (
                    <div className="p-1.5 rounded bg-[#131926]/60 border border-gray-800/60 text-[11px] text-purple-200 flex items-start gap-1.5">
                      <Compass className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-medium text-purple-300 text-[10px] block">
                          Adaptation de la stratégie :
                        </span>
                        <p className="text-gray-300 text-[10px] leading-tight mt-0.5">
                          {trace.strategy}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface AgentActionApprovalProps {
  action: PendingAgentAction;
  onDecision: (actionId: string, decision: 'approve' | 'reject') => Promise<void>;
}

const AgentActionApproval: React.FC<AgentActionApprovalProps> = ({ action, onDecision }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);

  const handleDecision = async (nextDecision: 'approve' | 'reject') => {
    if (isProcessing || decision) return;
    setIsProcessing(true);
    setDecision(nextDecision);
    try {
      await onDecision(action.id, nextDecision);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-amber-500/30">
      <div className="rounded-xl bg-amber-950/30 border border-amber-500/40 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-200">Confirmation nécessaire</p>
            <p className="text-[11px] text-amber-100/80 mt-1 break-words">{action.summary}</p>
            <p className="text-[10px] text-gray-500 mt-1">Cette demande expire dans quelques minutes.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            disabled={isProcessing || Boolean(decision)}
            onClick={() => void handleDecision('approve')}
            className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition"
          >
            {decision === 'approve' && isProcessing ? 'Approbation...' : 'Approuver'}
          </button>
          <button
            type="button"
            disabled={isProcessing || Boolean(decision)}
            onClick={() => void handleDecision('reject')}
            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-rose-900/70 border border-gray-700 disabled:opacity-50 text-gray-200 text-xs font-semibold transition"
          >
            {decision === 'reject' && isProcessing ? 'Refus...' : 'Refuser'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ChatTabProps {
  messages: ChatMessage[];
  isThinking: boolean;
  thinkingStatus?: string;
  onSendMessage: (text: string) => void;
  onClearMessages: () => void;
  onAdjustWeight: (sujet: string, delta: number) => void;
  soundEnabled: boolean;
  activeSession: string;
  prefilledText?: string;
  onClearPrefill?: () => void;
  onOpenActions?: () => void;
  isAdmin?: boolean;
  threads?: ChatThread[];
  activeThreadId?: string | null;
  onSelectThread?: (threadId: string) => void;
  onNewThread?: () => void;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  onMessageAnimationComplete?: (id: string) => void;
  onAgentActionDecision?: (actionId: string, decision: 'approve' | 'reject') => Promise<void>;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
  isThinking,
  thinkingStatus,
  onSendMessage,
  onClearMessages,
  onAdjustWeight,
  soundEnabled,
  activeSession,
  prefilledText,
  onClearPrefill,
  onOpenActions,
  isAdmin = false,
  threads = [],
  activeThreadId = null,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  onMessageAnimationComplete,
  onAgentActionDecision,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleTypingTick = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Sync prefilledText when passed from Action menu or chips
  useEffect(() => {
    if (prefilledText !== undefined && prefilledText !== '') {
      setInputText(prefilledText);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = prefilledText.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 50);
      onClearPrefill?.();
    }
  }, [prefilledText, onClearPrefill]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // La zone de message grandit avec le texte sans dépasser une hauteur confortable sur mobile.
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [inputText]);

  // Auto-focus rename field when editing a thread title
  useEffect(() => {
    if (editingThreadId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingThreadId]);

  const handleSaveRename = (threadId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameThread?.(threadId, trimmed);
    }
    setEditingThreadId(null);
  };

  // Voice Speech Recognition
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée sur ce navigateur.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  // Text-to-speech for a specific message
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const sendCurrentMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isThinking) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendCurrentMessage();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Entrée seule = retour à la ligne. Ctrl/Cmd + Entrée = envoi rapide.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendCurrentMessage();
    }
  };

  const handleScrollUnits = (direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      const amount = direction === 'up' ? -250 : 250;
      scrollContainerRef.current.scrollBy({ top: amount, behavior: 'smooth' });
    }
  };

  const quickPills = isAdmin
    ? [
        { label: 'C’est quoi...', text: "c'est quoi " },
        { label: 'Pourquoi...', text: 'pourquoi ' },
        { label: 'Retenir un fait', text: 'retiens: ' },
        { label: 'Règle tous les...', text: 'retiens: tous les ' },
        { label: 'Lier concepts', text: 'lie: ' },
        { label: 'Générer idées', text: 'idees 5: ' },
        { label: 'Traduire', text: 'traduis en anglais: ' },
        { label: 'Lister mémoire', text: 'lister: memoire' },
      ]
    : [
        { label: 'Poser une question', text: 'Je voudrais savoir ' },
        { label: 'Explique-moi quelque chose', text: 'Explique-moi ' },
        { label: 'Aide-moi à rédiger', text: 'Aide-moi à rédiger ' },
        { label: 'Recherche une information', text: 'Recherche une information sur ' },
      ];

  const activeThread = (threads || []).find(t => t.id === activeThreadId);

  const formatThreadDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return 'Hier';
      }
      return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  const filteredThreads = (threads || []).filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (t.title || '').toLowerCase().includes(q);
  });

  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 relative overflow-hidden bg-[#050508] ${isAdmin ? 'cyber-bg' : 'public-bg'}`}>
      {/* Top Thread & History Subheader Bar */}
      <div className="shrink-0 flex-shrink-0 px-3 sm:px-4 py-2 bg-[#090B10]/95 border-b border-gray-800/80 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 text-xs font-semibold text-gray-200 transition active:scale-95 shrink-0 shadow-xs"
            title="Ouvrir l'historique des discussions"
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAdmin ? 'Historique' : 'Mes discussions'}</span>
            {(threads?.length || 0) > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px] font-mono">
                {threads?.length}
              </span>
            )}
          </button>

          {/* Current discussion title indicator */}
          <div className="min-w-0 flex items-center gap-1.5 text-xs text-gray-400">
            <span className="hidden sm:inline text-gray-700">|</span>
            <span className="truncate font-medium text-gray-300 max-w-[130px] sm:max-w-[280px]">
              {activeThread ? activeThread.title : isAdmin ? 'Nouvelle discussion' : 'Nouvelle conversation'}
            </span>
          </div>
        </div>

        {/* Quick New Discussion button */}
        <button
          onClick={onNewThread}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition active:scale-95 shrink-0 shadow-xs"
          title="Démarrer une nouvelle discussion vierge"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{isAdmin ? 'Nouvelle discussion' : 'Nouvelle conversation'}</span>
        </button>
      </div>

      {/* Slide-over History Drawer (ChatGPT style side panel) */}
      {isHistoryOpen && (
        <div className="absolute inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            onClick={() => setIsHistoryOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer content panel */}
          <div className="relative w-full max-w-[300px] sm:max-w-xs bg-[#090B10] border-r border-gray-800 flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-3.5 border-b border-gray-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                <History className="w-4 h-4 text-emerald-400" />
                <span>Discussions ({threads?.length || 0})</span>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* "+ Nouvelle discussion" Button (ChatGPT style) */}
            <div className="p-3 border-b border-gray-800/80">
              <button
                onClick={() => {
                  onNewThread?.();
                  setIsHistoryOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Nouvelle discussion</span>
              </button>
            </div>

            {/* Search Input Bar (Feature 2) */}
            <div className="px-3 py-2 border-b border-gray-800/80 bg-[#07090F]/70">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une discussion..."
                  className="w-full bg-[#121622] border border-gray-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-gray-500 hover:text-white"
                    title="Effacer la recherche"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Threads List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 overscroll-contain">
              {(!threads || threads.length === 0) ? (
                <div className="py-12 text-center text-gray-500 text-xs px-4">
                  <MessageSquare className="w-8 h-8 text-gray-700 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-gray-400">Aucune discussion</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Posez votre première question pour sauvegarder automatiquement ce fil !
                  </p>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="py-10 text-center text-gray-500 text-xs px-4">
                  <Search className="w-7 h-7 text-gray-700 mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-gray-400">Aucun résultat trouvé</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Aucune discussion ne correspond à « {searchQuery} »
                  </p>
                </div>
              ) : (
                filteredThreads.map(thread => {
                  const isActive = thread.id === activeThreadId;
                  const isEditing = editingThreadId === thread.id;
                  const dateStr = formatThreadDate(thread.updatedAt || thread.createdAt);
                  return (
                    <div
                      key={thread.id}
                      onClick={() => {
                        if (isEditing) return;
                        onSelectThread?.(thread.id);
                        setIsHistoryOpen(false);
                      }}
                      className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl transition border text-left ${
                        isActive
                          ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200 shadow-sm'
                          : 'bg-gray-900/60 hover:bg-gray-800/90 border-gray-800/80 text-gray-300 hover:text-white'
                      }`}
                    >
                      {isEditing ? (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1.5 w-full"
                        >
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveRename(thread.id);
                              if (e.key === 'Escape') setEditingThreadId(null);
                            }}
                            className="flex-1 bg-[#161B26] border border-emerald-500/60 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                            placeholder="Nouveau titre..."
                          />
                          <button
                            onClick={() => handleSaveRename(thread.id)}
                            className="p-1.5 rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 transition"
                            title="Valider le renommage"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingThreadId(null)}
                            className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 transition"
                            title="Annuler"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1 cursor-pointer">
                            <div className="flex items-center gap-1.5">
                              <MessageSquare
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isActive ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'
                                }`}
                              />
                              <p className="text-xs font-semibold truncate leading-tight">
                                {thread.title}
                              </p>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-500">
                              <Clock className="w-2.5 h-2.5 text-gray-600" />
                              <span>{dateStr}</span>
                              <span>·</span>
                              <span>
                                {thread.messages.filter(m => m.author === 'Toi').length} msg
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            {confirmingDeleteId === thread.id ? (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 bg-rose-950/80 border border-rose-700/60 px-2 py-0.5 rounded-lg text-[11px] text-rose-200"
                              >
                                <span>Supprimer ?</span>
                                <button
                                  onClick={() => {
                                    onDeleteThread?.(thread.id);
                                    setConfirmingDeleteId(null);
                                  }}
                                  className="p-1 hover:bg-rose-600/50 rounded text-rose-100 font-bold transition"
                                  title="Confirmer la suppression"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmingDeleteId(null)}
                                  className="p-1 hover:bg-gray-800 rounded text-gray-400 transition"
                                  title="Annuler"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Rename button (Feature 1 - icône de crayon) */}
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingThreadId(thread.id);
                                    setEditingTitle(thread.title);
                                  }}
                                  className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-700/80 hover:text-cyan-300 text-gray-400 transition active:scale-90"
                                  title="Modifier le titre de la discussion"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                {/* Trash can delete button (Requirement 5) */}
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setConfirmingDeleteId(thread.id);
                                  }}
                                  className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-950/60 hover:text-rose-400 text-gray-500 transition active:scale-90"
                                  title="Supprimer la discussion"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages Scroll Area - Only this container scrolls */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 px-3 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-5 overscroll-contain"
      >
        {/* Session cognitive : indicateur simple conservé pour tous les utilisateurs */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900/80 border border-gray-800 text-[11px] text-gray-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Session cognitive : {activeSession === 'defaut' ? 'défaut' : activeSession}</span>
          </div>
        </div>

        {/* Message bubbles */}
        {messages.map(msg => {
          const isUser = msg.author === 'Toi';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group transition-all`}
            >
              {/* Author name & source badge */}
              <div
                className={`flex items-center gap-2 mb-1 px-1 text-[11px] font-semibold ${
                  isUser ? 'text-gray-400' : 'text-emerald-400'
                }`}
              >
                <span>{isUser ? 'TOI' : 'KADERBOT NOVA'}</span>
                {isAdmin && !isUser && msg.meta?.source && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700/60">
                    {msg.meta.source === 'groq-agent'
                      ? '🤖 Agent Groq'
                      : msg.meta.source === 'openrouter-agent'
                      ? '🤖 Agent OpenRouter'
                      : msg.meta.source === 'groq-chat'
                      ? '⚡ Groq Chat'
                      : msg.meta.source === 'deduction'
                      ? '⛓️ Déduction logique'
                      : msg.meta.source === 'local_memoire'
                      ? '🧠 Mémoire interne'
                      : msg.meta.source === 'regle'
                      ? '📐 Règle universelle'
                      : msg.meta.source === 'gemini'
                      ? '✨ Gemini 3.8'
                      : msg.meta.source === 'groq'
                      ? '⚡ Groq'
                      : msg.meta.source === 'openrouter'
                      ? '🦙 Llama (OpenRouter)'
                      : 'Système'}
                  </span>
                )}
                {isAdmin && !isUser && msg.meta?.isFallback && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/70 text-amber-300 border border-amber-500/40 cursor-help"
                    title={msg.meta.fallbackReason || 'Mode dégradé sans recherche'}
                  >
                    ⚠️ Mode dégradé (sans recherche)
                  </span>
                )}
                <span className="text-gray-600 text-[10px]">{msg.timestamp}</span>
              </div>

              {/* Message box */}
              <div
                className={`relative max-w-[92%] sm:max-w-[78%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm leading-relaxed shadow-lg ${
                  isUser
                    ? 'bg-[#1E2028] text-white border border-gray-700/60 rounded-tr-sm'
                    : 'bg-[#0E131F] text-gray-100 border border-emerald-500/25 rounded-tl-sm shadow-emerald-950/20'
                }`}
              >
                {/* Main text with Markdown & Typewriter streaming */}
                {isUser ? (
                  <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                ) : msg.isNew ? (
                  <BotTypewriterMessage
                    text={msg.text}
                    onComplete={() => {
                      onMessageAnimationComplete?.(msg.id);
                    }}
                    onTick={handleTypingTick}
                  />
                ) : (
                  <div className="text-gray-100 text-xs sm:text-sm leading-relaxed">
                    <ReactMarkdown components={markdownComponents}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}

                {!isUser && msg.meta?.pendingAction && onAgentActionDecision && (
                  <AgentActionApproval action={msg.meta.pendingAction} onDecision={onAgentActionDecision} />
                )}

                {/* Traces d'exécution de l'agent repliées par défaut sous forme d'accordéon propre */}
                {isAdmin && !isUser && msg.meta?.toolTrace && msg.meta.toolTrace.length > 0 && (
                  <AgentTraceAccordion toolTrace={msg.meta.toolTrace} />
                )}

                {/* Deductive chain visual crumb if applicable */}
                {isAdmin && !isUser && msg.meta?.chemin && msg.meta.chemin.length > 1 && (
                  <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex items-center gap-1.5 flex-wrap text-[11px] text-cyan-300 font-mono">
                    <span className="text-gray-500">Chaîne cognitive :</span>
                    {msg.meta.chemin.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className="bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/30">
                          {step}
                        </span>
                        {idx < msg.meta!.chemin!.length - 1 && <span className="text-gray-600">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {/* Interactive Cognitive Feedback buttons (Admin Only - Just like Python script!) */}
                {isAdmin && !isUser && msg.meta?.sujet && (
                  <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-gray-400">
                      Ce fait sur <span className="text-emerald-400 font-mono font-bold">{msg.meta.sujet}</span> est-il exact ?
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onAdjustWeight(msg.meta!.sujet!, 0.1)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium transition active:scale-95"
                        title="Renforcer le poids de confiance (+0.1)"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>Exact (+0.1)</span>
                      </button>
                      <button
                        onClick={() => onAdjustWeight(msg.meta!.sujet!, -0.15)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-300 text-[11px] font-medium transition active:scale-95"
                        title="Baisser le poids de confiance (-0.15)"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        <span>Inexact (-0.15)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Message action bar: Copy & Speech */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px]"
                    title="Copier le texte"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  {!isUser && (
                    <button
                      onClick={() => speakText(msg.text)}
                      className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px]"
                      title="Lire à haute voix"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Fenêtre Accordéon repliable "Réflexion" pendant le raisonnement */}
        {isThinking && <ThinkingAccordion thinkingStatus={isAdmin ? thinkingStatus : 'Je réfléchis à ta demande...'} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll Buttons (From Tkinter V13.8 on Android) */}
      <div className="absolute right-4 bottom-28 sm:bottom-32 z-20 flex flex-col gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
        <button
          onClick={() => handleScrollUnits('up')}
          className="w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-lg active:scale-95"
          title="Défiler vers le haut"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleScrollUnits('down')}
          className="w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-lg active:scale-95"
          title="Défiler vers le bas"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Pills - Fixed above input */}
      <div className="shrink-0 flex-shrink-0 px-3 sm:px-6 py-1.5 border-t border-gray-800/60 bg-[#090B10]/90 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
        {quickPills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => setInputText(pill.text)}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 text-[11px] font-medium text-gray-300 hover:text-emerald-300 transition"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Input Form Bar - Permanently fixed at bottom of chat */}
      <div className="shrink-0 flex-shrink-0 p-2.5 sm:p-4 bg-[#090B10] border-t border-gray-800/80 z-20">
        <form onSubmit={handleFormSubmit} className="max-w-7xl mx-auto flex items-center gap-2">
          {/* Voice input button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`p-2.5 rounded-xl border transition-all ${
              isRecording
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
            }`}
            title={isRecording ? 'Arrêter dictée' : 'Dicter vocalement en français'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text entry field */}
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={isAdmin ? "Pose une question, écris 'pourquoi...', ou 'retiens: sujet = définition'..." : 'Écris ton message...'}
              className="w-full max-h-32 min-h-[42px] resize-none overflow-y-auto bg-[#161822] border border-gray-800 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition shadow-inner"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/40 transition active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Envoyer</span>
          </button>

          {/* New Discussion Button */}
          <button
            type="button"
            onClick={onNewThread || onClearMessages}
            className="p-2.5 sm:p-3 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/40 transition active:scale-95"
            title="Démarrer une nouvelle discussion"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
```

---

<a id="srcApptsx"></a>
## Fichier : `src/App.tsx`

> **Description** : Composant racine, gestion de session et moteur hybride

```tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Brain,
  Scale,
  Wrench,
  FolderTree,
} from 'lucide-react';

import {
  AppConfig,
  ChatMessage,
  ChatThread,
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from './types/kaderbot';
import {
  SEED_MEMORY,
  SEED_RULES,
  SEED_LINKS,
  sansAccent,
  estSalutation,
  repondreSalutation,
  detecterEtat,
  repondreEtat,
  extraireX,
  extraireQuantificateur,
  phraseDef,
  repondrePourquoi,
  deduireChaine,
  deduireGeneralisation,
  apprendreDeLLM,
  rechercherFlou,
  naviguerLiens,
  trouverLiensCommuns,
  corriger,
  trouverQuestionReponse,
  estRequeteDefinition,
  nettoyerMemoirePolluee,
  trouverSensSimilaire,
  rechercheHybride,
  precalculerTousLesVecteurs,
  obtenirVecteur,
  obtenirVecteurCache,
  resoudrePronomsAvecHistorique,
  evaluerCalculMath,
  construirePromptContextuelNova,
} from './core/cognitiveEngine';
import { Header } from './components/Header';
import { ChatTab } from './components/ChatTab';
import { KnowledgeGraphTab } from './components/KnowledgeGraphTab';
import { RulesTab } from './components/RulesTab';
import { ToolsTab } from './components/ToolsTab';
import { SessionsTab } from './components/SessionsTab';
import { ActionMenuModal } from './components/ActionMenuModal';
import { SettingsModal } from './components/SettingsModal';
import { apiService, decideAgentAction, sendAgentMessage } from './services/apiService';

export default function App() {
  // Le paramètre ?admin=true ne suffit pas : le serveur doit valider ADMIN_TOKEN.
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'rules' | 'tools' | 'sessions'>('chat');

  // Configuration générale de KADERBOT NOVA
  const NOVA_DEFAULT_SYSTEM_PROMPT =
    'Tu es KADERBOT NOVA, un assistant IA expert et pédagogue. Tu réponds toujours en français.\n' +
    'RÈGLES DE FORMATAGE : Structure tes réponses avec du Markdown (sauts de ligne, listes à puces, gras).\n' +
    'RÈGLE DE LONGUEUR ABSOLUE : Ta réponse ne doit jamais dépasser 120 mots. Sois direct et synthétique. Si un sujet est vaste (comme l\'histoire d\'une invention), donne uniquement les 2 ou 3 points les plus importants, et termine en proposant à l\'utilisateur de préciser sa question pour plus de détails. Ne fais JAMAIS de réponse de plus de 4 paragraphes.';

  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('kaderbot_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.groqModel === 'llama-3.3-70b-versatile' || !parsed.groqModel) {
          parsed.groqModel = 'openai/gpt-oss-120b';
        }
        if (!parsed.openrouterModel) {
          parsed.openrouterModel = 'meta-llama/llama-3.3-70b-instruct:free';
        }
        if (!parsed.systemPrompt || !parsed.systemPrompt.includes('120 mots')) {
          parsed.systemPrompt = NOVA_DEFAULT_SYSTEM_PROMPT;
        }
        return parsed;
      } catch {}
    }
    return {
      provider: 'gemini',
      geminiApiKey: '',
      groqApiKey: '',
      openrouterApiKey: '',
      groqModel: 'openai/gpt-oss-120b',
      openrouterModel: 'meta-llama/llama-3.3-70b-instruct:free',
      geminiModel: 'gemini-3.8-flash',
      adminToken: '',
      systemPrompt: NOVA_DEFAULT_SYSTEM_PROMPT,
      activeSession: 'defaut',
      soundEnabled: false,
      autoLearnFromLLM: true,
    };
  });

  // Authentification serveur du mode admin sur l’URL et lors des changements de configuration.
  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      const params = new URLSearchParams(window.location.search);
      const hasAdminParam = params.get('admin') === 'true';
      const hasConfigToken = Boolean(config.adminToken?.trim());

      if (!hasAdminParam && !hasConfigToken) {
        if (!cancelled) setIsAdmin(false);
        return;
      }

      const authenticated = await apiService.verifyAdminSession();
      if (!cancelled) {
        setIsAdmin(authenticated);
        if (!authenticated && hasAdminParam) setActiveTab('chat');
      }
    };
    void checkAdmin();
    window.addEventListener('popstate', checkAdmin);
    return () => {
      cancelled = true;
      window.removeEventListener('popstate', checkAdmin);
    };
  }, [config.adminToken]);

  // En mode public, restreindre les onglets à 'chat' ou 'tools'
  useEffect(() => {
    if (!isAdmin && (activeTab === 'graph' || activeTab === 'rules' || activeTab === 'sessions')) {
      setActiveTab('chat');
    }
  }, [isAdmin, activeTab]);

  // État des modales
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Gestion des sessions
  const [sessions, setSessions] = useState<string[]>(() => {
    const saved = localStorage.getItem('kaderbot_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return ['defaut'];
  });

  // Base de connaissances cognitive (Mémoire, Règles, Liens, Synonymes)
  const [memoire, setMemoire] = useState<MemoryStore>(() => {
    const saved = localStorage.getItem(`kaderbot_memoire_${config.activeSession}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        nettoyerMemoirePolluee(parsed);
        return parsed;
      } catch {}
    }
    return { ...SEED_MEMORY };
  });

  const [regles, setRegles] = useState<RulesStore>(() => {
    const saved = localStorage.getItem(`kaderbot_regles_${config.activeSession}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return SEED_RULES;
  });

  const [liens, setLiens] = useState<LinksStore>(() => {
    const saved = localStorage.getItem(`kaderbot_liens_${config.activeSession}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return SEED_LINKS;
  });

  const [synonymes, setSynonymes] = useState<SynonymsStore>(() => {
    const saved = localStorage.getItem(`kaderbot_synonymes_${config.activeSession}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      ordi: 'ordinateur',
      bagnole: 'voiture',
      auto: 'voiture',
    };
  });

  // Historique conceptuel pour le fil de pensée
  const [contexte, setContexte] = useState<string[]>([]);
  const [chatPrefill, setChatPrefill] = useState('');
  const [dernieresIdees, setDernieresIdees] = useState<string[]>([]);
  const [groqLog, setGroqLog] = useState<Array<{ q: string; r: string; time: string }>>([]);

  // Message d'accueil propre et accueillant
  const getWelcomeMessage = (): ChatMessage => {
    const hour = new Date().getHours();
    let welcome = 'Bonjour, prêt pour une nouvelle discussion ?';
    if (hour >= 12 && hour < 18) {
      welcome = "Bon après-midi ! Que souhaites-tu explorer aujourd’hui ?";
    } else if (hour >= 18 || hour < 6) {
      welcome = 'Bonsoir ! Je suis à ton écoute.';
    }

    return {
      id: 'welcome',
      author: 'KB',
      text: `${welcome} Je suis KADERBOT, ton assistant personnel. Tu peux me poser une question, me demander une explication ou m’aider à rédiger un texte.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      meta: { source: 'systeme' },
    };
  };

  // Fils de discussion sauvegardés en localStorage (Style ChatGPT)
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    const saved = localStorage.getItem('kaderbot_chat_threads');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erreur lecture threads:', e);
      }
    }
    return [];
  });

  // ID du fil actif (null = nouvelle discussion)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);

  // Messages de la discussion courante
  const [messages, setMessages] = useState<ChatMessage[]>(() => [getWelcomeMessage()]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  // Persistance des threads
  useEffect(() => {
    localStorage.setItem('kaderbot_chat_threads', JSON.stringify(threads));
  }, [threads]);

  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string>('KADERBOT réfléchit...');
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<number | null>(null);

  // Tâche 1 : Pré-calcul des vecteurs (exécuté une seule fois avec le flag hasPrecalculated)
  useEffect(() => {
    const hasPrecalculated = localStorage.getItem('hasPrecalculated');
    if (hasPrecalculated === 'true') {
      return;
    }

    let isMounted = true;

    const lancerPrecalcul = async () => {
      try {
        setIndexingProgress(0);
        await precalculerTousLesVecteurs(memoire, pct => {
          if (isMounted) {
            setIndexingProgress(pct);
          }
        });

        if (isMounted) {
          setMemoire({ ...memoire });
          try {
            localStorage.setItem(`kaderbot_memoire_${config.activeSession}`, JSON.stringify(memoire));
          } catch (e) {
            console.warn('Quota localStorage atteint lors de la sauvegarde:', e);
          }
          localStorage.setItem('hasPrecalculated', 'true');
          setTimeout(() => {
            if (isMounted) setIndexingProgress(null);
          }, 1500);
        }
      } catch (err) {
        console.error('Erreur lors du pré-calcul des vecteurs:', err);
        if (isMounted) setIndexingProgress(null);
      }
    };

    // Petit délai de 200ms après montage initial pour fluidifier le premier rendu de la page
    const timer = setTimeout(() => {
      lancerPrecalcul();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // 1. Priorité au Local au démarrage : Si localStorage est vide, chargement initial serveur
  useEffect(() => {
    const localMemo = localStorage.getItem(`kaderbot_memoire_${config.activeSession}`);
    if (!localMemo) {
      apiService
        .loadMemoryFromServer()
        .then(remote => {
          if (remote) {
            if (remote.memoire && Object.keys(remote.memoire).length > 0) {
              setMemoire(remote.memoire);
              localStorage.setItem(`kaderbot_memoire_${config.activeSession}`, JSON.stringify(remote.memoire));
            }
            if (remote.regles && Object.keys(remote.regles).length > 0) {
              setRegles(remote.regles);
              localStorage.setItem(`kaderbot_regles_${config.activeSession}`, JSON.stringify(remote.regles));
            }
            if (remote.liens && Object.keys(remote.liens).length > 0) {
              setLiens(remote.liens);
              localStorage.setItem(`kaderbot_liens_${config.activeSession}`, JSON.stringify(remote.liens));
            }
            if (remote.synonymes && Object.keys(remote.synonymes).length > 0) {
              setSynonymes(remote.synonymes);
              localStorage.setItem(`kaderbot_synonymes_${config.activeSession}`, JSON.stringify(remote.synonymes));
            }
            if (remote.sessions && remote.sessions.length > 0) {
              setSessions(remote.sessions);
              localStorage.setItem('kaderbot_sessions', JSON.stringify(remote.sessions));
            }
          }
        })
        .catch(err => {
          console.warn('Initialisation serveur ou hors-ligne, données par défaut actives:', err);
        });
    }
  }, []);

  // 2. Sauvegarde Locale automatique dans localStorage sans appel automatique au serveur
  useEffect(() => {
    localStorage.setItem('kaderbot_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('kaderbot_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(`kaderbot_memoire_${config.activeSession}`, JSON.stringify(memoire));
    localStorage.setItem(`kaderbot_regles_${config.activeSession}`, JSON.stringify(regles));
    localStorage.setItem(`kaderbot_liens_${config.activeSession}`, JSON.stringify(liens));
    localStorage.setItem(`kaderbot_synonymes_${config.activeSession}`, JSON.stringify(synonymes));
  }, [memoire, regles, liens, synonymes, config.activeSession]);

  // Synchronisation manuelle réservée à l'administrateur
  const handlePushMemoryToServer = async (): Promise<{ success: boolean; message: string }> => {
    try {
      await apiService.saveMemoryToServer({
        memoire,
        regles,
        liens,
        synonymes,
        sessions,
      });
      return {
        success: true,
        message: `Mémoire locale transmise au serveur avec succès (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erreur d'envoi au serveur : ${err.message || 'Serveur indisponible'}`,
      };
    }
  };

  const handlePullMemoryFromServer = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const remote = await apiService.loadMemoryFromServer();
      if (!remote) throw new Error('Aucune donnée retournée par le serveur');

      if (remote.memoire) {
        setMemoire(remote.memoire);
        localStorage.setItem(`kaderbot_memoire_${config.activeSession}`, JSON.stringify(remote.memoire));
      }
      if (remote.regles) {
        setRegles(remote.regles);
        localStorage.setItem(`kaderbot_regles_${config.activeSession}`, JSON.stringify(remote.regles));
      }
      if (remote.liens) {
        setLiens(remote.liens);
        localStorage.setItem(`kaderbot_liens_${config.activeSession}`, JSON.stringify(remote.liens));
      }
      if (remote.synonymes) {
        setSynonymes(remote.synonymes);
        localStorage.setItem(`kaderbot_synonymes_${config.activeSession}`, JSON.stringify(remote.synonymes));
      }
      if (remote.sessions && remote.sessions.length > 0) {
        setSessions(remote.sessions);
        localStorage.setItem('kaderbot_sessions', JSON.stringify(remote.sessions));
      }

      addBotMessage('Mémoire du serveur récupérée et appliquée localement avec succès.');
      return {
        success: true,
        message: `Mémoire synchronisée depuis le serveur (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erreur de récupération : ${err.message || 'Serveur indisponible'}`,
      };
    }
  };

  const handleAdjustHits = (sujet: string, entryIdx: number, delta: number) => {
    setMemoire(prev => {
      const list = prev[sujet];
      if (!list || !list[entryIdx]) return prev;
      const updated = [...list];
      const newHits = Math.max(0, (updated[entryIdx].hits || 0) + delta);
      updated[entryIdx] = { ...updated[entryIdx], hits: newHits };
      return { ...prev, [sujet]: updated };
    });
  };

  const handleSelectSession = (newSession: string) => {
    if (newSession === config.activeSession) return;
    setConfig(prev => ({ ...prev, activeSession: newSession }));

    const savedMemo = localStorage.getItem(`kaderbot_memoire_${newSession}`);
    const savedRegles = localStorage.getItem(`kaderbot_regles_${newSession}`);
    const savedLiens = localStorage.getItem(`kaderbot_liens_${newSession}`);

    setMemoire(savedMemo ? JSON.parse(savedMemo) : SEED_MEMORY);
    setRegles(savedRegles ? JSON.parse(savedRegles) : SEED_RULES);
    setLiens(savedLiens ? JSON.parse(savedLiens) : SEED_LINKS);

    addBotMessage(`Session chargée : ${newSession}`);
  };

  const handleCreateSession = (name: string) => {
    if (sessions.includes(name)) return;
    const updated = [...sessions, name];
    setSessions(updated);
    handleSelectSession(name);
  };

  // Ajout d'un message bot sans AUCUN affichage de chiffres, scores ou vecteurs
  const addBotMessage = (text: string, meta?: ChatMessage['meta']) => {
    const newMsg: ChatMessage = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      author: 'KB',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      meta,
      isNew: true,
    };
    setMessages(prev => [...prev, newMsg]);

    const currentThreadId = activeThreadIdRef.current;
    if (currentThreadId) {
      setThreads(prev =>
        prev.map(t =>
          t.id === currentThreadId
            ? { ...t, updatedAt: new Date().toISOString(), messages: [...t.messages, { ...newMsg, isNew: false }] }
            : t
        )
      );
    }

    if (config.soundEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    }
  };

  const handleMessageAnimationComplete = (id: string) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, isNew: false } : m)));
  };

  const handleSelectThread = (threadId: string) => {
    const target = threads.find(t => t.id === threadId);
    if (!target) return;
    activeThreadIdRef.current = target.id;
    setActiveThreadId(target.id);
    setMessages(
      target.messages && target.messages.length > 0
        ? target.messages.map(m => ({ ...m, isNew: false }))
        : [getWelcomeMessage()]
    );
  };

  const handleNewThread = () => {
    activeThreadIdRef.current = null;
    setActiveThreadId(null);
    setMessages([getWelcomeMessage()]);
  };

  const handleDeleteThread = (threadId: string) => {
    setThreads(prev => prev.filter(t => t.id !== threadId));
    if (activeThreadIdRef.current === threadId) {
      handleNewThread();
    }
  };

  const handleRenameThread = (threadId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setThreads(prev =>
      prev.map(t =>
        t.id === threadId ? { ...t, title: trimmed, updatedAt: new Date().toISOString() } : t
      )
    );
  };

  const handleAdjustWeight = (sujet: string, delta: number) => {
    setMemoire(prev => {
      const copy = { ...prev };
      if (!copy[sujet] || copy[sujet].length === 0) return prev;
      const list = copy[sujet].map((entry, idx) => {
        if (idx === 0) {
          const newWeight = Math.max(0.1, Math.min(1.0, entry.poids + delta));
          return {
            ...entry,
            poids: Number(newWeight.toFixed(2)),
            hits: entry.hits + 1,
            last_used: new Date().toISOString(),
          };
        }
        return entry;
      });
      copy[sujet] = list;
      return copy;
    });

    const isPositive = delta > 0;
    addBotMessage(
      isPositive
        ? `Parfait ! J'ai renforcé cette notion sur "${sujet}".`
        : `Compris ! J'ai corrigé ma certitude concernant "${sujet}".`
    );
  };

  const handleAddRule = (
    quant: 'tous' | 'aucun' | 'certains',
    sujet: string,
    prop: string,
    poids = 0.85
  ) => {
    const s = sujet.toLowerCase().trim();
    const p = prop.toLowerCase().trim();
    setRegles(prev => {
      const copy = { ...prev };
      const current = copy[s] ? [...copy[s]] : [];
      const existing = current.find(r => r.quant === quant && r.prop === p);
      if (existing) {
        existing.poids = Math.min(1.0, existing.poids + 0.1);
        existing.hits += 1;
        existing.last_used = new Date().toISOString();
      } else {
        current.push({
          quant,
          prop: p,
          poids,
          hits: 1,
          last_used: new Date().toISOString(),
          created: new Date().toISOString(),
        });
      }
      copy[s] = current;
      return copy;
    });
  };

  const handleDeleteRule = (sujet: string, prop: string) => {
    setRegles(prev => {
      const copy = { ...prev };
      if (!copy[sujet]) return prev;
      copy[sujet] = copy[sujet].filter(r => r.prop !== prop);
      if (copy[sujet].length === 0) delete copy[sujet];
      return copy;
    });
  };

  const handleAddLink = (source: string, target: string) => {
    const s = source.toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (!s || !t || s === t) return;
    setLiens(prev => {
      const copy = { ...prev };
      const current = copy[s] ? [...copy[s]] : [];
      if (!current.includes(t)) {
        current.push(t);
        copy[s] = current;
      }
      return copy;
    });
  };

  const handleDeleteLink = (source: string, target: string) => {
    setLiens(prev => {
      const copy = { ...prev };
      if (!copy[source]) return prev;
      copy[source] = copy[source].filter(item => item !== target);
      if (copy[source].length === 0) delete copy[source];
      return copy;
    });
  };

  /**
   * MOTEUR COGNITIF HYBRIDE CONVERSATIONNEL
   * Architecture en plusieurs étapes :
   * 1. Contexte conversationnel des 5 derniers messages & résolution des pronoms
   * 2. Étape 1 : Local Sémantique (Embeddings côté client avec @xenova/transformers)
   * 3. Étape 2 : Outils / Calculs arithmétiques directs
   * 4. Étape 3 : Cloud Fallback (Gemini/Groq avec historique complet des 5 derniers messages)
   * 5. Apprentissage automatique avec calcul du vecteur sémantique pour la prochaine fois
   */
  const handleAgentActionDecision = async (actionId: string, decision: 'approve' | 'reject') => {
    try {
      const result = await decideAgentAction(actionId, decision);
      addBotMessage(result.text, {
        source: 'systeme',
        toolTrace: result.toolTrace,
      });
    } catch (err: any) {
      addBotMessage(`Impossible de traiter cette action : ${err.message}`, { source: 'systeme' });
    }
  };

  const handleProcessUserMessage = async (rawMessage: string) => {
    const text = rawMessage.trim();
    if (!text) return;

    // Ajout du message utilisateur
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      author: 'Toi',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let currentThreadId = activeThreadIdRef.current;
    if (!currentThreadId) {
      const newId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      activeThreadIdRef.current = newId;
      setActiveThreadId(newId);

      const title = text.length > 38 ? text.slice(0, 38).trim() + '...' : text;
      const newThread: ChatThread = {
        id: newId,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [...messages, userMsg],
      };

      setThreads(prev => [newThread, ...prev]);
    } else {
      setThreads(prev =>
        prev.map(t =>
          t.id === currentThreadId
            ? { ...t, updatedAt: new Date().toISOString(), messages: [...t.messages, userMsg] }
            : t
        )
      );
    }

    setMessages(prev => [...prev, userMsg]);

    const msgLower = text.toLowerCase();
    const msgClean = sansAccent(msgLower);

    // 1. Commandes de contexte explicites
    if (msgLower === 'reset contexte' || msgLower === 'vider contexte') {
      setContexte([]);
      addBotMessage('Contexte conversationnel réinitialisé.', { source: 'systeme' });
      return;
    }

    if (msgLower === 'contexte') {
      if (contexte.length === 0) {
        addBotMessage('Aucun échange en contexte actuellement.', { source: 'systeme' });
      } else {
        addBotMessage(`Fil conducteur actuel (${contexte.length} concepts récents) : ${contexte.join(' → ')}`, { source: 'systeme' });
      }
      return;
    }

    // 2. Commandes de configuration LLM
    if (msgLower === 'groq on') {
      setConfig(prev => ({ ...prev, provider: 'groq' }));
      addBotMessage('Moteur Groq activé.', { source: 'systeme' });
      return;
    }

    if (msgLower === 'groq off') {
      setConfig(prev => ({ ...prev, provider: 'local_only' }));
      addBotMessage('Mode 100% local activé.', { source: 'systeme' });
      return;
    }

    if (msgLower === 'groq statut') {
      addBotMessage(
        `Statut IA :\nMoteur actif : ${config.provider}\nModèle : ${config.provider === 'groq' ? config.groqModel : config.geminiModel}\nApprentissage auto : ${config.autoLearnFromLLM ? 'Activé' : 'Désactivé'}`
      );
      return;
    }

    // 3. Question explicite vers Groq
    if (msgLower.startsWith('groq:')) {
      const q = text.slice(5).trim();
      if (!q) {
        addBotMessage('Format : groq: ta question');
        return;
      }
      setIsThinking(true);
      try {
        const res = await apiService.chat({
          prompt: q,
          history: messages.slice(-5).map(m => ({
            role: m.author === 'Toi' ? ('user' as const) : ('assistant' as const),
            content: m.text,
          })),
          provider: 'groq',
          groqModel: config.groqModel || 'openai/gpt-oss-120b',
          systemPrompt: config.systemPrompt,
        });
        addBotMessage(res.text, { source: res.provider === 'gemini' ? 'gemini' : 'groq' });
        setGroqLog(prev => [{ q, r: res.text, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 20)]);
        if (config.autoLearnFromLLM) {
          const learned = apprendreDeLLM(q, res.text, memoire, 'groq');
          if (learned) {
            // Calcule et stocke le vecteur du sujet dans l'entrée avant de sauvegarder
            const vec = await obtenirVecteur(learned.sujet);
            if (vec && vec.length > 0 && memoire[learned.sujet]?.[0]) {
              memoire[learned.sujet][0].vecteur = vec;
            }
            const updatedMemoire = { ...memoire };
            setMemoire(updatedMemoire);
            try {
              localStorage.setItem(`kaderbot_memoire_${config.activeSession}`, JSON.stringify(updatedMemoire));
            } catch {}
            setContexte(prev => [...prev, learned.sujet]);
          }
        }
      } catch (err: any) {
        addBotMessage(`Erreur Groq : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 4. Commandes de sessions
    if (msgLower === 'session' || msgLower === 'session active') {
      addBotMessage(
        `Session active : ${config.activeSession}\nSujets en mémoire : ${Object.keys(memoire).length}\nRègles actives : ${Object.values(regles).reduce((acc, l) => acc + l.length, 0)}`
      );
      return;
    }

    if (msgLower === 'sessions' || msgLower === 'lister: sessions') {
      addBotMessage(`Sessions disponibles :\n${sessions.map(s => ` - ${s}${s === config.activeSession ? ' (active)' : ''}`).join('\n')}\n\nPour changer : écris "session <nom>"`);
      return;
    }

    if (msgLower.startsWith('session ')) {
      const newName = text.split(' ')[1]?.trim().toLowerCase();
      if (newName) {
        handleCreateSession(newName);
        return;
      }
    }

    // 5. Commandes de liens taxonomiques
    if (msgLower.startsWith('lie:') || msgLower.startsWith('lie ')) {
      const rest = text.includes(':') ? text.split(':')[1].trim() : text.slice(3).trim();
      if (rest.includes('->')) {
        const [source, target] = rest.split('->').map(s => s.trim().toLowerCase());
        handleAddLink(source, target);
        addBotMessage(`Lien cognitif établi : ${source} -> ${target}`, { source: 'local_memoire' });
        return;
      }
      addBotMessage('Format : lie: source -> cible (ex: lie: moineau -> oiseau)');
      return;
    }

    if (msgLower.startsWith('delie:') || msgLower.startsWith('delie ')) {
      const rest = text.includes(':') ? text.split(':')[1].trim() : text.slice(5).trim();
      if (rest.includes('->')) {
        const [source, target] = rest.split('->').map(s => s.trim().toLowerCase());
        handleDeleteLink(source, target);
        addBotMessage(`Lien supprimé : ${source} -> ${target}`, { source: 'local_memoire' });
        return;
      }
      addBotMessage('Format requis : delie: source -> cible');
      return;
    }

    if (msgLower.startsWith('liens:') || msgLower.startsWith('liens ')) {
      const target = text.includes(':') ? text.split(':')[1].trim().toLowerCase() : text.slice(5).trim().toLowerCase();
      const parents = liens[target] || [];
      const children = Object.keys(liens).filter(k => (liens[k] || []).includes(target));
      const chain = naviguerLiens(target, liens, 8);
      let rep = `Liens pour "${target}" :\nParents : ${parents.join(', ') || 'aucun'}\nEnfants : ${children.join(', ') || 'aucun'}`;
      if (chain.length > 1) {
        rep += `\nChaîne complète : ${chain.join(' → ')}`;
      }
      addBotMessage(rep, { source: 'local_memoire' });
      return;
    }

    if (msgLower.startsWith('cousins:') || msgLower.startsWith('cousins ')) {
      const rest = text.includes(':') ? text.split(':')[1].trim() : text.slice(7).trim();
      const [s1, s2] = rest.split(',').map(s => s.trim().toLowerCase());
      if (s1 && s2) {
        const communs = trouverLiensCommuns(s1, s2, liens);
        addBotMessage(
          communs.length > 0
            ? `Ancêtres conceptuels communs entre ${s1} et ${s2} : ${communs.join(', ')}`
            : `Aucun ancêtre commun trouvé entre ${s1} et ${s2}.`
        );
        return;
      }
      addBotMessage('Format : cousins: sujet1, sujet2');
      return;
    }

    // 6. Commandes d'apprentissage explicites
    if (msgLower.startsWith('retiens:')) {
      const content = text.split(':')[1]?.trim();
      if (!content) {
        addBotMessage('Format : retiens: sujet = définition');
        return;
      }

      const rq = extraireQuantificateur(content);
      if (rq) {
        handleAddRule(rq.quant, rq.sujet, rq.prop, 0.85);
        addBotMessage(`Règle enregistrée : ${rq.quant} les ${rq.sujet}s ${rq.prop}`, { source: 'regle' });
        return;
      }

      if (content.includes('=')) {
        const [sujetRaw, defsRaw] = content.split('=').map(s => s.trim());
        const s = sujetRaw.toLowerCase();
        const defsList = defsRaw.split('|').map(d => d.trim()).filter(Boolean);
        if (s && defsList.length > 0) {
          const nowIso = new Date().toISOString();
          setMemoire(prev => {
            const copy = { ...prev };
            const current = copy[s] ? [...copy[s]] : [];
            for (const d of defsList) {
              current.unshift({
                def: d,
                poids: 0.85,
                hits: 1,
                source: 'manuel',
                last_used: nowIso,
                created: nowIso,
              });
            }
            copy[s] = current;
            return copy;
          });

          // Calculer l'embedding en arrière-plan
          obtenirVecteurCache(`${s} : ${defsList[0]}`).then(vec => {
            if (vec.length > 0 && memoire[s]?.[0]) {
              memoire[s][0].vecteur = vec;
            }
          }).catch(() => {});

          setContexte(prev => [...prev, s]);
          addBotMessage(`Fait retenu pour "${s}" : ${defsList.join(' | ')}`, { source: 'local_memoire', sujet: s });
          return;
        }
      }
      addBotMessage('Format : retiens: sujet = définition');
      return;
    }

    if (msgLower.startsWith('oublier:')) {
      const rest = text.split(':')[1]?.trim().toLowerCase() || '';
      if (!rest) {
        addBotMessage('Format : oublier: sujet');
        return;
      }
      let found = false;
      if (memoire[rest]) {
        setMemoire(prev => {
          const copy = { ...prev };
          delete copy[rest];
          return copy;
        });
        found = true;
      }
      if (regles[rest]) {
        setRegles(prev => {
          const copy = { ...prev };
          delete copy[rest];
          return copy;
        });
        found = true;
      }
      addBotMessage(
        found ? `J'ai complètement oublié "${rest}".` : `Je ne connaissais pas "${rest}".`,
        { source: 'systeme' }
      );
      return;
    }

    // 7. Salutations & formules de politesse courantes
    const salutation = estSalutation(text);
    if (salutation) {
      addBotMessage(repondreSalutation(salutation), { source: 'systeme' });
      return;
    }

    const etat = detecterEtat(text);
    if (etat) {
      addBotMessage(repondreEtat(etat), { source: 'systeme' });
      return;
    }

    // Renforcements positifs ou négatifs ("oui", "c'est ça", "non pas ça")
    if (['oui', "c'est ca", 'exact', 'parfait', 'merci'].includes(msgClean)) {
      if (contexte.length > 0) {
        const last = contexte[contexte.length - 1];
        handleAdjustWeight(last, 0.1);
        return;
      }
    }
    if (['non', 'pas ca', 'faux', 'erreur'].includes(msgClean)) {
      if (contexte.length > 0) {
        const last = contexte[contexte.length - 1];
        handleAdjustWeight(last, -0.15);
        return;
      }
    }

    // =========================================================================
    // ÉTAPE 1 : LOCAL SÉMANTIQUE (Embeddings Transformers.js côté navigateur)
    // =========================================================================
    const isContinueCommand = /^(continue|continuer|suite|poursuis|poursuivre|vas-y|go)\b/i.test(text.trim());
    setThinkingStatus(
      isContinueCommand
        ? 'Poursuite de la recherche et synthèse en cours...'
        : 'Recherche et réflexion en cours...'
    );
    setIsThinking(true);
    try {
      // 1. Résolution des pronoms ("il", "elle", "ça") avec les 5 derniers messages
      const questionResolue = resoudrePronomsAvecHistorique(text, messages.slice(-5));

      // 2. Recherche Hybride (Filtrage rapide par mots-clés + Comparaison vectorielle cosinus > 0.82)
      const matchHybride = await rechercheHybride(questionResolue, memoire);
      if (matchHybride) {
        matchHybride.entry.hits += 1;
        matchHybride.entry.last_used = new Date().toISOString();
        setMemoire({ ...memoire });
        setContexte(prev => [...prev, matchHybride.sujet]);

        const rep = matchHybride.entry.def;
        // Formatage fluide et naturel de la réponse sans aucun chiffre technique
        const reponseFluide = matchHybride.entry.type === 'concept' && !rep.includes('\n') && !rep.toLowerCase().startsWith('est ') && !rep.toLowerCase().startsWith('un ') && !rep.toLowerCase().startsWith('une ')
          ? `${matchHybride.sujet.charAt(0).toUpperCase() + matchHybride.sujet.slice(1)} est ${rep}.`
          : rep;

        addBotMessage(reponseFluide, { source: 'local_memoire', sujet: matchHybride.sujet });
        setIsThinking(false);
        return;
      }

      // Déduction causale logique ("pourquoi ...")
      if (msgClean.includes('pourquoi')) {
        const whyAnswer = repondrePourquoi(text, memoire, regles, liens, synonymes);
        if (whyAnswer) {
          const s = extraireX(text, memoire, regles, synonymes, contexte);
          if (s) setContexte(prev => [...prev, s]);
          addBotMessage(whyAnswer, { source: 'deduction', sujet: s || undefined });
          setIsThinking(false);
          return;
        }
      }

      // Correspondance exacte ou par mots-clés Q&A mémorisée
      const qaMatch = trouverQuestionReponse(text, memoire);
      if (qaMatch) {
        qaMatch.entry.hits += 1;
        qaMatch.entry.last_used = new Date().toISOString();
        setMemoire({ ...memoire });
        setContexte(prev => [...prev, qaMatch.sujet]);
        addBotMessage(qaMatch.entry.def, { source: 'local_memoire', sujet: qaMatch.sujet });
        setIsThinking(false);
        return;
      }

      // Demande de définition de concept ("c'est quoi ...", "définition de ...")
      const defCheck = estRequeteDefinition(text);
      if (defCheck.estDef && defCheck.concept) {
        const candX = corriger(defCheck.concept, memoire, regles, synonymes) || defCheck.concept;
        const localDef = phraseDef(candX, text, memoire, regles, liens, synonymes);
        if (localDef) {
          setContexte(prev => [...prev, candX]);
          addBotMessage(localDef, { source: 'local_memoire', sujet: candX });
          setIsThinking(false);
          return;
        }
      }

      // Recherche floue sur requêtes très courtes (1 à 2 mots)
      const wordsCount = text.trim().split(/\s+/).length;
      if (wordsCount <= 2) {
        const flouMatch = rechercherFlou(text, memoire, regles, 0.72);
        if (flouMatch) {
          const flouDef = phraseDef(flouMatch, text, memoire, regles, liens, synonymes);
          if (flouDef) {
            setContexte(prev => [...prev, flouMatch]);
            addBotMessage(`Tu voulais sans doute parler de "${flouMatch}" : ${flouDef}`, { source: 'local_memoire', sujet: flouMatch });
            setIsThinking(false);
            return;
          }
        }
      }

      // =========================================================================
      // ÉTAPE 2 : OUTILS ET CALCULS ARITHMÉTIQUES DIRECTS
      // =========================================================================
      const resultatCalcul = evaluerCalculMath(text);
      if (resultatCalcul) {
        addBotMessage(resultatCalcul, { source: 'systeme' });
        setIsThinking(false);
        return;
      }

      // Traduction automatique via les outils
      if (msgLower.startsWith('traduis en ') || msgLower.startsWith('traduis ')) {
        if (!text.includes(':')) {
          addBotMessage('Format : traduis en anglais: ton texte ici');
          setIsThinking(false);
          return;
        }
        const [entete, ...corpsParts] = text.split(':');
        const corps = corpsParts.join(':').trim();
        const enteteClean = sansAccent(entete.toLowerCase()).replace(/^traduis(?:\s+en)?\s*/, '').trim();
        const languesMap: Record<string, string> = {
          anglais: 'English', english: 'English',
          arabe: 'Arabic', arabic: 'Arabic',
          espagnol: 'Spanish', spanish: 'Spanish',
          allemand: 'German', german: 'German',
          italien: 'Italian', italian: 'Italian',
          portugais: 'Portuguese',
          russe: 'Russian',
          chinois: 'Chinese',
          japonais: 'Japanese',
          francais: 'French',
        };
        const cible = languesMap[enteteClean] || 'English';
        const result = await apiService.traduire({
          text: corps,
          targetLang: cible,
          provider: config.provider,
          groqModel: config.groqModel,
          openrouterModel: config.openrouterModel,
        });
        addBotMessage(result, { source: 'systeme' });
        setIsThinking(false);
        return;
      }

      // Générateur d'idées
      if (msgLower.startsWith('idees ') || msgLower.startsWith('idées ') || msgLower.startsWith('idees:')) {
        if (!text.includes(':')) {
          addBotMessage('Format : idees 5: theme  ou  idees 3 drole: theme');
          setIsThinking(false);
          return;
        }
        const [entete, ...corpsParts] = text.split(':');
        const theme = corpsParts.join(':').trim();
        const matchNb = entete.match(/\d+/);
        const count = matchNb ? Math.max(1, Math.min(15, parseInt(matchNb[0], 10))) : 5;
        let style = 'creatif';
        for (const st of ['serieux', 'drole', 'poetique', 'absurde', 'creatif', 'scientifique', 'philosophique']) {
          if (entete.toLowerCase().includes(st)) {
            style = st;
            break;
          }
        }
        const result = await apiService.genererIdees({
          theme,
          count,
          style,
          provider: config.provider,
          groqModel: config.groqModel,
          openrouterModel: config.openrouterModel,
        });
        const lines = result
          .split('\n')
          .map(l => l.replace(/^\s*(\d+[\.\)\-:]\s*|[\-\*]\s*)/, '').trim())
          .filter(Boolean);
        setDernieresIdees(lines);
        const formatted = [`Idées sur : ${theme}`, ...lines.map((l, i) => `${i + 1}. ${l}`)].join('\n');
        addBotMessage(formatted, { source: 'systeme' });
        setIsThinking(false);
        return;
      }

      // Résumé de texte
      if (msgLower.startsWith('resume:')) {
        const corps = text.split(':')[1]?.trim();
        if (corps && corps.length > 80) {
          const res = await apiService.resumer({
            text: corps,
            provider: config.provider,
            groqModel: config.groqModel,
            openrouterModel: config.openrouterModel,
          });
          addBotMessage(res, { source: 'systeme' });
          setIsThinking(false);
          return;
        }
      }

      // Correction de texte
      if (msgLower.startsWith('corrige:') || msgLower.startsWith('corrige ')) {
        const corps = text.includes(':') ? text.split(':')[1].trim() : text.slice(7).trim();
        if (corps) {
          const result = await apiService.corriger({
            text: corps,
            provider: config.provider,
            groqModel: config.groqModel,
            openrouterModel: config.openrouterModel,
          });
          addBotMessage(result, { source: 'systeme' });
          setIsThinking(false);
          return;
        }
      }

      // Mode 100% local actif / Moteur Nova (SmolLM2-1.7B) sans fallback cloud
      if (config.provider === 'local_only') {
        const { faitTrouve } = construirePromptContextuelNova(
          text,
          memoire,
          regles,
          liens,
          synonymes,
          contexte,
          config.systemPrompt
        );
        if (faitTrouve) {
          addBotMessage(faitTrouve, { source: 'local_memoire' });
        } else {
          const candX = extraireX(text, memoire, regles, synonymes, contexte);
          addBotMessage(
            candX
              ? `Je n'ai pas encore d'information sur "${candX}" dans ma mémoire locale. Tu peux me l'enseigner avec : retiens: ${candX} = ...`
              : "Je n'ai pas cette notion en mémoire locale. Tu peux me l'enseigner avec : retiens: sujet = définition",
            { source: 'systeme' }
          );
        }
        setIsThinking(false);
        return;
      }

      // =========================================================================
      // ÉTAPE 3 : AGENT AVEC OUTILS & ROUTEUR COGNITIF (AVEC FALLBACK /api/chat)
      // =========================================================================
      const historyFormatted = messages.slice(-10).map(m => ({
        role: m.author === 'Toi' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      let responseText = '';
      let botSource: NonNullable<ChatMessage['meta']>['source'] = 'groq';
      let metaPayload: ChatMessage['meta'] = {};

      try {
        // 1. Appel prioritaire de l'Agent intelligent ReAct (/api/agent avec les 10 derniers messages)
        setThinkingStatus(
          isContinueCommand
            ? 'Boucle ReAct : finalisation et synthèse finale...'
            : 'Boucle ReAct : Pensée → Action → Observation (jusqu’à 25 itérations)...'
        );
        const agentRes = await sendAgentMessage(text, historyFormatted);
        responseText = agentRes.text || agentRes.question || '';

        botSource =
          agentRes.provider === 'groq-agent'
            ? 'groq-agent'
            : agentRes.provider === 'openrouter-agent'
            ? 'openrouter-agent'
            : agentRes.provider === 'groq-chat'
            ? 'groq-chat'
            : agentRes.provider === 'openrouter'
            ? 'openrouter'
            : agentRes.provider === 'gemini'
            ? 'gemini'
            : 'groq';

        metaPayload = {
          source: botSource,
          model: agentRes.model,
          toolTrace: agentRes.toolTrace,
          isFallback: agentRes.isFallback,
          fallbackReason: agentRes.fallbackReason,
          routedTo: agentRes.routedTo,
          pendingAction: agentRes.pendingAction,
        };

        if (
          agentRes.provider === 'groq-agent' ||
          agentRes.provider === 'openrouter-agent' ||
          agentRes.routedTo === 'agent'
        ) {
          setIsAgentActive(true);
        }
      } catch (agentErr: any) {
        console.warn('Endpoint /api/agent indisponible ou erreur, bascule vers /api/chat:', agentErr.message);
        // Fallback transparent vers /api/chat si /api/agent renvoie 404, 500 ou échoue
        const chatRes = await apiService.chat({
          prompt: text,
          history: historyFormatted,
          provider: config.provider,
          groqModel: config.groqModel || 'openai/gpt-oss-120b',
          openrouterModel: config.openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free',
          systemPrompt: config.systemPrompt,
        });

        responseText = chatRes.text;
        botSource =
          chatRes.provider === 'openrouter'
            ? 'openrouter'
            : chatRes.provider === 'groq'
            ? 'groq'
            : 'gemini';

        metaPayload = {
          source: botSource,
          model: chatRes.model,
          isFallback: true,
          fallbackReason: `Mode dégradé /api/chat (${agentErr.message})`,
        };
      }

      addBotMessage(responseText, metaPayload);
      setGroqLog(prev => [{ q: text, r: responseText, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 20)]);

      // =========================================================================
      // ÉTAPE 4 : APPRENTISSAGE AUTOMATIQUE & CALCUL D'EMBEDDING LOCAL
      // =========================================================================
      if (config.autoLearnFromLLM && !metaPayload.pendingAction) {
        const learned = apprendreDeLLM(text, responseText, memoire, botSource === 'groq' || botSource === 'groq-chat' ? 'groq' : 'gemini');
        if (learned) {
          // Calcule et stocke son vecteur dans l'entrée avant de sauvegarder
          const vec = await obtenirVecteur(learned.sujet);
          if (vec && vec.length > 0 && memoire[learned.sujet]?.[0]) {
            memoire[learned.sujet][0].vecteur = vec;
          }

          const updatedMemoire = { ...memoire };
          setMemoire(updatedMemoire);
          try {
            localStorage.setItem(`kaderbot_memoire_${config.activeSession}`, JSON.stringify(updatedMemoire));
          } catch {}
          setContexte(prev => [...prev, learned.sujet]);
        }
      }
    } catch (err: any) {
      addBotMessage(`Erreur de connexion : ${err.message}`, { source: 'systeme' });
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="fixed inset-0 h-full w-full max-h-[100dvh] flex flex-col bg-[#050508] text-gray-100 font-sans selection:bg-emerald-500/20 selection:text-emerald-300 overflow-hidden">
      {/* En-tête principal */}
      <Header
        config={config}
        onUpdateConfig={updates => setConfig(prev => ({ ...prev, ...updates }))}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onOpenSettings={() => {
          if (isAdmin) setIsSettingsModalOpen(true);
        }}
        onOpenActionsMenu={() => {
          if (isAdmin) setIsActionsModalOpen(true);
        }}
        conceptsCount={Object.keys(memoire).length}
        rulesCount={Object.values(regles).reduce((acc, l) => acc + l.length, 0)}
        isAdmin={isAdmin}
        isAgentActive={isAgentActive}
      />

      {/* Notification de progression de l'indexation sémantique (Tâche 1) */}
      {indexingProgress !== null && (
        <div className="fixed top-16 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gray-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-medium shadow-2xl backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>
            {indexingProgress >= 100
              ? 'Indexation de la mémoire : 100% (Terminé)'
              : `Indexation de la mémoire : ${indexingProgress}%`}
          </span>
          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden ml-1">
            <div
              className="h-full bg-emerald-400 transition-all duration-150"
              style={{ width: `${indexingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Espace de travail principal */}
      <main className="flex-1 flex flex-col min-h-0 w-full overflow-hidden relative">
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            isThinking={isThinking}
            thinkingStatus={thinkingStatus}
            onSendMessage={handleProcessUserMessage}
            onClearMessages={handleNewThread}
            onAdjustWeight={handleAdjustWeight}
            soundEnabled={config.soundEnabled}
            activeSession={config.activeSession}
            prefilledText={chatPrefill}
            onClearPrefill={() => setChatPrefill('')}
            onOpenActions={() => {
              if (isAdmin) setIsActionsModalOpen(true);
            }}
            isAdmin={isAdmin}
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            onRenameThread={handleRenameThread}
            onMessageAnimationComplete={handleMessageAnimationComplete}
            onAgentActionDecision={handleAgentActionDecision}
          />
        )}

        {activeTab === 'graph' && isAdmin && (
          <KnowledgeGraphTab
            memoire={memoire}
            regles={regles}
            liens={liens}
            synonymes={synonymes}
            onAddDefinition={(s, d) => {
              const nowIso = new Date().toISOString();
              setMemoire(prev => {
                const copy = { ...prev };
                const current = copy[s] ? [...copy[s]] : [];
                current.unshift({
                  def: d,
                  poids: 0.85,
                  hits: 1,
                  source: 'manuel',
                  last_used: nowIso,
                  created: nowIso,
                });
                copy[s] = current;
                return copy;
              });
            }}
            onDeleteConcept={s => {
              setMemoire(prev => {
                const copy = { ...prev };
                delete copy[s];
                return copy;
              });
            }}
            onAdjustWeight={handleAdjustWeight}
            onAdjustHits={handleAdjustHits}
            onAddLink={handleAddLink}
            onDeleteLink={handleDeleteLink}
            onAskQuestionAbout={s => {
              setActiveTab('chat');
              handleProcessUserMessage(`c'est quoi ${s} ?`);
            }}
          />
        )}

        {activeTab === 'rules' && isAdmin && (
          <RulesTab
            memoire={memoire}
            regles={regles}
            liens={liens}
            synonymes={synonymes}
            onAddRule={handleAddRule}
            onDeleteRule={handleDeleteRule}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsTab
            config={config}
            onSaveToMemory={(sujet, def) => {
              const nowIso = new Date().toISOString();
              setMemoire(prev => ({
                ...prev,
                [sujet]: [
                  {
                    def,
                    poids: 0.85,
                    hits: 1,
                    source: 'auto',
                    last_used: nowIso,
                    created: nowIso,
                  },
                ],
              }));
            }}
          />
        )}

        {activeTab === 'sessions' && isAdmin && (
          <SessionsTab
            sessions={sessions}
            activeSession={config.activeSession}
            onSelectSession={handleSelectSession}
            onCreateSession={handleCreateSession}
            memoire={memoire}
            regles={regles}
            liens={liens}
            synonymes={synonymes}
            onUpdateMemory={(newM, newR) => {
              setMemoire(newM);
              setRegles(newR);
            }}
            onImportFullBackup={data => {
              setMemoire(data.memoire);
              setRegles(data.regles);
              setLiens(data.liens);
            }}
            groqApiKey={config.groqApiKey}
            groqModel={config.groqModel}
            onPushMemoryToServer={handlePushMemoryToServer}
            onPullMemoryFromServer={handlePullMemoryFromServer}
          />
        )}
      </main>

      {/* Barre de navigation inférieure */}
      <nav className="h-14 sm:h-16 shrink-0 flex-shrink-0 bg-[#090B10] border-t border-gray-800/80 px-2 sm:px-6 flex items-center justify-around z-30">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
            activeTab === 'chat'
              ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] sm:text-xs font-semibold">Discussion</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('graph')}
            className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
              activeTab === 'graph'
                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-semibold">Cerveau & Graphe</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
              activeTab === 'rules'
                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-semibold">Règles & Inférence</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('tools')}
          className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
            activeTab === 'tools'
              ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] sm:text-xs font-semibold">Atelier Texte</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
              activeTab === 'sessions'
                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FolderTree className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-semibold">Sessions & Pydroid</span>
          </button>
        )}
      </nav>

      {/* Menu d'actions (Admin uniquement) */}
      {isAdmin && (
        <ActionMenuModal
          isOpen={isActionsModalOpen}
          onClose={() => setIsActionsModalOpen(false)}
          onSelectAction={(cmd, immediate) => {
            if (immediate) {
              handleProcessUserMessage(cmd);
            } else {
              setActiveTab('chat');
              setChatPrefill(cmd);
            }
          }}
        />
      )}

      {/* Paramètres (Admin uniquement) */}
      {isAdmin && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          config={config}
          onSaveConfig={updates => setConfig(prev => ({ ...prev, ...updates }))}
          onPushMemoryToServer={handlePushMemoryToServer}
          onPullMemoryFromServer={handlePullMemoryFromServer}
        />
      )}
    </div>
  );
}
```

---

<a id="srccorecognitiveEnginets"></a>
## Fichier : `src/core/cognitiveEngine.ts`

> **Description** : Moteur cognitif, recherche sémantique hybride et déduction logique

```typescript
import { pipeline, env } from '@xenova/transformers';
import {
  ChatMessage,
  GeneralRule,
  LinksStore,
  MemoryEntry,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';

// Configuration de transformers.js pour l'environnement navigateur
// Permet de télécharger le modèle léger depuis le hub HuggingFace et de le mettre en cache local
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton d'extraction d'embeddings côté client
let extracteurEmbeddingsPromise: Promise<any> | null = null;

/**
 * Initialise de manière paresseuse le pipeline d'embeddings Xenova/all-MiniLM-L6-v2.
 * Ce modèle produit des vecteurs de dimension 384 rapides et optimisés pour la recherche sémantique.
 */
export async function obtenirExtracteurEmbeddings() {
  if (!extracteurEmbeddingsPromise) {
    extracteurEmbeddingsPromise = pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true }
    );
  }
  return extracteurEmbeddingsPromise;
}

/**
 * Calcule le vecteur d'embedding pour une chaîne de texte donnée.
 * La normalisation L2 et le pooling moyen sont appliqués pour une comparaison directe par produit scalaire.
 */
export async function calculerVecteur(texte: string): Promise<number[]> {
  if (!texte || !texte.trim()) return [];
  try {
    const extractor = await obtenirExtracteurEmbeddings();
    const output = await extractor(texte.trim(), { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  } catch (error) {
    console.warn('Erreur lors du calcul de vecteur d’embedding:', error);
    return [];
  }
}

// Cache mémoire en arrière-plan pour éviter de recalculer les vecteurs déjà générés
const cacheEmbeddings = new Map<string, number[]>();

/**
 * Récupère un vecteur déjà en cache ou le calcule si nécessaire.
 */
export async function obtenirVecteurCache(texte: string): Promise<number[]> {
  const cle = texte.trim().toLowerCase();
  if (cacheEmbeddings.has(cle)) {
    return cacheEmbeddings.get(cle)!;
  }
  const vec = await calculerVecteur(texte);
  if (vec.length > 0) {
    cacheEmbeddings.set(cle, vec);
  }
  return vec;
}

/**
 * Calcule ou récupère en cache le vecteur d'un texte ou d'un sujet (384 dimensions).
 */
export async function obtenirVecteur(texte: string): Promise<number[]> {
  return obtenirVecteurCache(texte);
}

/**
 * Calcule la similarité cosinus entre deux vecteurs numériques.
 * Résultat compris entre -1.0 et 1.0 (ou 0.0 et 1.0 pour des vecteurs normalisés).
 */
export function similariteCosinus(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let produit = 0;
  let normeA = 0;
  let normeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    produit += vecA[i] * vecB[i];
    normeA += vecA[i] * vecA[i];
    normeB += vecB[i] * vecB[i];
  }
  if (normeA === 0 || normeB === 0) return 0;
  return produit / (Math.sqrt(normeA) * Math.sqrt(normeB));
}

/**
 * Tâche 2 : Recherche Hybride optimisée pour les grandes bases de mémoire (12 000+ entrées).
 * 1. Filtrage rapide (Mots-clés) : Extrait les mots-clés de la question (sans accents, sans mots vides).
 *    Ne garde que les entrées de la mémoire dont la clé contient au moins un de ces mots (recherche includes).
 *    Si le sous-ensemble filtré est vide, retourne null.
 * 2. Comparaison vectorielle : Calcule le vecteur de la question.
 *    Pour chaque entrée filtrée (qui a déjà son vecteur pré-calculé), calcule la similarité cosinus.
 * 3. Retourne l'entrée avec le meilleur score si score > 0.82.
 */
export async function rechercheHybride(
  question: string,
  memoire: MemoryStore
): Promise<{ sujet: string; entry: MemoryEntry; score: number } | null> {
  if (!question || !memoire || Object.keys(memoire).length === 0) return null;

  // 1. Filtrage rapide (Mots-clés)
  const qClean = sansAccent(question.toLowerCase());
  let motsCles = extraireMotsCles(qClean);

  if (motsCles.length === 0) {
    // Si la question est très courte (1 à 2 mots), extraire les tokens signifiants sans accents
    const tokens = qClean
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !MOTS_INTERROGATIFS_ET_VIDES.has(w) && !PRONOMS_CONTEXTE.has(w));
    if (tokens.length > 0) {
      motsCles = tokens;
    } else {
      return null;
    }
  }

  // Ne garde que les entrées de la mémoire dont la clé contient au moins un de ces mots
  const candidats: Array<{ sujet: string; entry: MemoryEntry }> = [];
  const motsClesSansAccents = motsCles.map(m => sansAccent(m.toLowerCase()));

  for (const [sujet, entries] of Object.entries(memoire)) {
    const sNorm = sansAccent(sujet.toLowerCase());
    const match = motsClesSansAccents.some(mot => sNorm.includes(mot));
    if (match) {
      for (const entry of entries) {
        candidats.push({ sujet, entry });
      }
    }
  }

  // Si le résultat filtré est vide, retourne null
  if (candidats.length === 0) {
    return null;
  }

  // 2. Comparaison vectorielle (sur le sous-ensemble filtré)
  const questionVec = await obtenirVecteur(question);
  if (!questionVec || questionVec.length === 0) {
    return null;
  }

  let meilleurResultat: { sujet: string; entry: MemoryEntry; score: number } | null = null;
  let maxScore = -1;

  for (const item of candidats) {
    let entryVec = item.entry.vecteur;
    if (!entryVec || entryVec.length === 0) {
      // Secours si le vecteur n'était pas encore pré-calculé
      entryVec = await obtenirVecteur(item.sujet);
      item.entry.vecteur = entryVec;
    }

    if (entryVec && entryVec.length > 0) {
      const score = similariteCosinus(questionVec, entryVec);
      if (score > maxScore) {
        maxScore = score;
        meilleurResultat = {
          sujet: item.sujet,
          entry: item.entry,
          score,
        };
      }
    }
  }

  // 3. Retourne l'entrée avec le meilleur score si score > 0.82
  if (meilleurResultat && maxScore > 0.82) {
    return meilleurResultat;
  }

  return null;
}

/**
 * Tâche 1 : Pré-calcul des vecteurs pour toute la mémoire (jusqu'à 12 000+ entrées).
 * Parcourt toutes les entrées de mémoire, calcule le vecteur de la clé (le sujet) via obtenirVecteur(sujet),
 * le stocke dans entry.vecteur, et traite par lots de 50 avec pause asynchrone (10ms).
 */
export async function precalculerTousLesVecteurs(
  memoire: MemoryStore,
  onProgress?: (pourcentage: number) => void
): Promise<MemoryStore> {
  if (!memoire) return memoire;
  const sujets = Object.keys(memoire);
  const total = sujets.length;
  if (total === 0) {
    onProgress?.(100);
    return memoire;
  }

  const BATCH_SIZE = 50;

  for (let i = 0; i < total; i++) {
    const sujet = sujets[i];
    const entries = memoire[sujet] || [];

    // Vérifie si au moins une entrée nécessite le calcul de son vecteur
    const needVec = entries.some(e => !e.vecteur || e.vecteur.length === 0);
    if (needVec) {
      const vec = await obtenirVecteur(sujet);
      if (vec && vec.length > 0) {
        for (const entry of entries) {
          if (!entry.vecteur || entry.vecteur.length === 0) {
            entry.vecteur = vec;
          }
        }
      }
    }

    // Traite par lots de 50 avec pause pour libérer le thread principal
    if ((i + 1) % BATCH_SIZE === 0 || i === total - 1) {
      const pct = Math.round(((i + 1) / total) * 100);
      onProgress?.(pct);
      await new Promise(r => setTimeout(r, 10));
    }
  }

  return memoire;
}

/**
 * Compare sémantiquement la question de l'utilisateur avec toutes les connaissances stockées.
 * Seuil par défaut : 0.80 pour garantir une forte pertinence sans faux positifs.
 */
export async function trouverSensSimilaire(
  question: string,
  memoire: MemoryStore,
  seuilSimilarite = 0.80
): Promise<{ sujet: string; entry: MemoryEntry; score: number } | null> {
  if (!question || !memoire || Object.keys(memoire).length === 0) return null;

  try {
    const questionVec = await obtenirVecteurCache(question);
    if (!questionVec || questionVec.length === 0) return null;

    let meilleurMatch: { sujet: string; entry: MemoryEntry; score: number } | null = null;
    let maxScore = -1;

    for (const [sujet, entries] of Object.entries(memoire)) {
      for (const entry of entries) {
        let entryVec = entry.vecteur;
        if (!entryVec || entryVec.length === 0) {
          // Si l'entrée n'a pas encore son vecteur, le calculer à partir du contenu ou de la question d'origine
          const texteRef = entry.question_origine
            ? `${entry.question_origine} (${sujet})`
            : `${sujet} : ${entry.def}`;
          entryVec = await obtenirVecteurCache(texteRef);
          entry.vecteur = entryVec;
        }

        const score = similariteCosinus(questionVec, entryVec);
        if (score > maxScore) {
          maxScore = score;
          meilleurMatch = { sujet, entry, score };
        }
      }
    }

    if (meilleurMatch && maxScore >= seuilSimilarite) {
      return meilleurMatch;
    }
    return null;
  } catch (err) {
    console.warn('Erreur lors de la recherche sémantique:', err);
    return null;
  }
}

/**
 * Résout les pronoms anaphoriques ("il", "elle", "ça", "sa taille") à l'aide des 5 derniers messages
 * pour enrichir la question et préserver la continuité du dialogue.
 */
export function resoudrePronomsAvecHistorique(
  question: string,
  historiqueMessages: ChatMessage[]
): string {
  if (!question) return '';
  const qClean = sansAccent(question.toLowerCase().trim());
  const mots = qClean.match(/\w+/g) || [];

  const aPronom = mots.some(w => PRONOMS_CONTEXTE.has(w));
  if (!aPronom || !historiqueMessages || historiqueMessages.length === 0) {
    return question;
  }

  // Explore les 5 derniers messages en partant du plus récent
  const recents = historiqueMessages.slice(-5).reverse();
  for (const msg of recents) {
    if (msg.meta?.sujet) {
      return `${question} (${msg.meta.sujet})`;
    }
    const motsCles = extraireMotsCles(msg.text);
    if (motsCles.length > 0) {
      return `${question} (${motsCles[0]})`;
    }
  }

  return question;
}

/**
 * Évalue localement une expression arithmétique ou mathématique si la question le demande.
 * Ex: "combien fait 15 * 8", "calcule 120 / 4", "25 + 75"
 */
export function evaluerCalculMath(texte: string): string | null {
  if (!texte) return null;
  const tClean = sansAccent(texte.toLowerCase().trim())
    .replace(/^combien\s+(?:fait|font|mesure|vaut)\s*/, '')
    .replace(/^calcule(?:\s+moi)?\s*/, '')
    .replace(/^quel\s+est\s+le\s+resultat\s+de\s*/, '')
    .replace(/[?=]/g, '')
    .trim();

  // Test si c'est une expression arithmétique licite avec chiffres et opérateurs
  const sanitized = tClean.replace(/\s+/g, '').replace(/x/g, '*').replace(/÷/g, '/');
  if (/^[0-9+\-*/().^%]+$/.test(sanitized) && /[0-9]/.test(sanitized) && /[+\-*/^%]/.test(sanitized)) {
    try {
      const fn = new Function(`return (${sanitized.replace(/\^/g, '**')});`);
      const res = fn();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return `Le résultat de ce calcul est ${res}.`;
      }
    } catch {}
  }
  return null;
}

export const DEFAULT_POIDS = 0.8;

export const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des',
  'de', 'du', 'd', 'dans', 'sur', 'sous',
  'et', 'ou', 'mais', 'donc', 'car',
  'est', 'sont', 'etre', 'a', 'au', 'aux',
  'pour', 'par', 'avec', 'sans',
  'qui', 'que', 'quoi', 'qu', 'comment',
  'pourquoi', 'quand', 'ou',
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa',
  'ce', 'cet', 'cette', 'ces',
  'en', 'y',
]);

export const PRONOMS_CONTEXTE = new Set([
  'il', 'elle', 'ils', 'elles', 'l', 'le', 'la', 'les', 'lui',
  'leur', 'ca', 'cela', 'ce', 'cet', 'cette', 'son', 'sa', 'ses',
  'leur', 'leurs', 'celui', 'celle', "l'", "qu'il", "qu'elle",
]);

export const SALUTATIONS = [
  'bonjour', 'salut', 'coucou', 'hey', 'yo', 'bonsoir', 'wesh',
  'hello', 'bjr', 'slt', 'au revoir', 'a bientot', 'a plus',
  'merci', 'de rien',
];

export const RS: Record<string, string[]> = {
  bonjour: ['Bonjour !', 'Salut !', 'Coucou !', 'Hey, content de te voir !', 'Bonjour, comment ça va aujourd’hui ?'],
  salut: ['Salut !', 'Bonjour !', 'Hey !', 'Salut, quoi de neuf ?'],
  coucou: ['Coucou !', 'Salut !', 'Bonjour !', 'Coucou, tu vas bien ?'],
  hey: ['Hey !', 'Salut !', 'Bonjour !'],
  yo: ['Yo !', 'Salut !', 'Bonjour !'],
  bonsoir: ['Bonsoir !', 'Salut !', 'Bonsoir, comment s’est passée ta journée ?'],
  wesh: ['Wesh !', 'Salut !', 'Wesh bien ou quoi ?'],
  hello: ['Hello !', 'Bonjour !', 'Salut !'],
  bjr: ['Bonjour !', 'Salut !'],
  slt: ['Salut !', 'Bonjour !'],
  'au revoir': ['Au revoir !', 'À bientôt !', 'Salut !', 'À plus tard !'],
  'a bientot': ['À bientôt !', 'Au revoir !', 'On se revoit vite !'],
  'a plus': ['À plus !', 'À bientôt !', 'Salut !'],
  merci: ['De rien !', 'Avec plaisir !', 'Je t’en prie !', 'Pas de souci, c’est normal !'],
  'de rien': ['Il n’y a pas de quoi !', 'C’est normal !', 'Avec plaisir !'],
};

export const SUITES = [
  ' Tu vas bien ?',
  ' Comment ça va ?',
  ' Ça va ?',
  ' Quoi de neuf ?',
  ' Content de te voir !',
];

export const PE: Record<string, { reponses: string[]; synonymes: string[] }> = {
  'je suis content': { reponses: ['Super ! Content pour toi !', 'Génial ! Qu’est-ce qui te rend content ?', 'Tant mieux ! Profite bien !'], synonymes: ['je suis joyeux'] },
  'je suis triste': { reponses: ['Oh, je suis désolé... Qu’est-ce qui ne va pas ?', 'Tu veux en parler ? Je suis là.'], synonymes: ['j’ai du chagrin'] },
  'je suis en colere': { reponses: ['Calme-toi, respire profondément.', 'Qu’est-ce qui t’énerve ?'], synonymes: ['je ne suis pas content'] },
  "j'ai peur": { reponses: ['N’aie pas peur, je suis là.', 'Qu’est-ce qui te fait peur ?'], synonymes: ['je suis inquiet'] },
  'je suis surpris': { reponses: ['Surprenant, non ?', 'Je ne m’y attendais pas non plus !'], synonymes: ["c'est etonnant"] },
  "je t'aime": { reponses: ['Moi aussi, je t’apprécie !', 'C’est gentil !', 'Ça me touche vraiment.'], synonymes: ['tu es important'] },
  'je suis decu': { reponses: ['C’est dommage...', 'Je comprends, ce n’est pas ce que tu espérais.'], synonymes: ["pas ce que j'esperais"] },
  'je suis fatigue': { reponses: ['Repose-toi bien.', 'Tu devrais faire une petite pause.'], synonymes: ['besoin de repos'] },
  'je suis calme': { reponses: ['C’est parfait, reste comme ça.', 'Cool, zen attitude !'], synonymes: ['paisible'] },
  'je suis stresse': { reponses: ['Respire profondément...', 'Prends une pause, ça ira mieux.'], synonymes: ['pression'] },
  'ca me fait plaisir': { reponses: ['Tant mieux !', 'Ça fait plaisir à entendre !'], synonymes: ['content de ca'] },
  "ca m'enerve": { reponses: ['Calme-toi, ça va passer.', 'Je comprends, c’est énervant.'], synonymes: ['en colere'] },
};

export const STYLES_IDEES: Record<string, string> = {
  serieux: 'Sois concret, pragmatique et professionnel.',
  drole: 'Sois humoristique, décalé et amusant.',
  poetique: 'Sois poétique, imagé et sensible.',
  absurde: 'Sois totalement absurde, inattendu et loufoque.',
  creatif: 'Sois original, surprenant et imaginatif.',
  scientifique: 'Sois rigoureux, factuel et précis.',
  philosophique: 'Sois profond, réflexif et nuancé.',
};

export const INTENTIONS_KEYWORDS: Record<string, string[]> = {
  salutation: ['bonjour', 'salut', 'coucou', 'hey', 'yo', 'bjr', 'slt', 'bonsoir', 'hello', 'wesh'],
  definition: ["c'est quoi", 'c quoi', "qu'est ce que", 'quest ce que', 'qui est', 'definition', "c'est quoi un", "c'est quoi une", 'parle moi de', 'parle-moi de', 'dis moi ce que', "c'est qui"],
  usage: ['a quoi sert', 'sert a quoi', 'a quoi ca sert', 'pour quoi faire', 'utilite', 'comment utiliser', 'sert a'],
  pourquoi: ['pourquoi', 'raison', 'cause', 'explique pourquoi', 'pourquoi est ce que'],
  emotion: ['je suis', "j'ai peur", "je t'aime", 'je suis triste', 'je suis content', 'fatigue', 'colere', 'stresse', 'peur'],
  memoire_ajout: ['retiens', 'apprends', 'souviens', 'enregistre', 'note que'],
  memoire_suppression: ['oublier', 'supprime', 'efface'],
  recherche: ['chercher', 'lister', 'resume', 'cherche', 'liste'],
  synonyme: ['synonymes', 'synonyme', 'equivaut', 'pareil que', 'veut dire'],
};

export function sansAccent(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a.length < b.length) return levenshtein(b, a);
  if (b.length === 0) return a.length;
  let lignePrec = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const ligne = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cout = a[i] === b[j] ? 0 : 1;
      ligne.push(Math.min(ligne[j] + 1, lignePrec[j + 1] + 1, lignePrec[j] + cout));
    }
    lignePrec = ligne;
  }
  return lignePrec[b.length];
}

export function similarite(a: string, b: string): number {
  if (!a || !b) return 0.0;
  if (a === b) return 1.0;
  const d = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1.0 - d / maxLen : 0.0;
}

export function corriger(
  mot: string,
  memoire: MemoryStore,
  regles: RulesStore,
  synonymes: SynonymsStore
): string | null {
  const m = mot.toLowerCase().trim();
  if (synonymes[m]) {
    const v = synonymes[m];
    if (typeof v === 'string') return v;
  }
  for (const [canon, lst] of Object.entries(synonymes)) {
    if (Array.isArray(lst) && lst.includes(m)) {
      return canon;
    }
  }
  if (memoire[m] || regles[m]) return m;
  const sa = sansAccent(m);
  for (const key of [...Object.keys(memoire), ...Object.keys(regles)]) {
    if (sansAccent(key.toLowerCase()) === sa) return key;
  }
  return rechercherFlou(m, memoire, regles, 0.72);
}

export function singulariser(
  mot: string,
  memoire: MemoryStore,
  regles: RulesStore,
  synonymes: SynonymsStore
): string {
  const m = mot.toLowerCase().trim();
  if (m.endsWith('aux')) {
    const base = m.slice(0, -3) + 'al';
    if (corriger(base, memoire, regles, synonymes)) return base;
    return m.slice(0, -1);
  }
  if (m.endsWith('eaux')) {
    return m.slice(0, -1);
  }
  if (m.endsWith('s') && m.length > 3) {
    const sing = m.slice(0, -1);
    if (corriger(sing, memoire, regles, synonymes) || memoire[sing] || regles[sing]) {
      return sing;
    }
    return sing;
  }
  return m;
}

export function rechercherFlou(
  mot: string,
  memoire: MemoryStore,
  regles: RulesStore,
  seuil = 0.7
): string | null {
  const motNorm = sansAccent(mot.toLowerCase().trim());
  if (!motNorm) return null;
  const keys = Array.from(new Set([...Object.keys(memoire), ...Object.keys(regles)]));
  let meilleur: string | null = null;
  let meilleurScore = 0.0;
  for (const cle of keys) {
    const normalise = sansAccent(cle.toLowerCase());
    let score = similarite(motNorm, normalise);
    if (motNorm.includes(normalise) || normalise.includes(motNorm)) {
      score += 0.15;
    }
    if (motNorm.length >= 3 && normalise.startsWith(motNorm.slice(0, 3))) {
      score += 0.1;
    }
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = cle;
    }
  }
  return meilleurScore >= seuil ? meilleur : null;
}

export function extraireQuantificateur(phrase: string): {
  quant: 'tous' | 'aucun' | 'certains';
  sujet: string;
  prop: string;
} | null {
  const q = sansAccent(phrase.toLowerCase().trim());
  const patterns = [
    /^(tous|toutes)\s+(?:les\s+)?([a-z]+)\s+(?:ne\s+)?([a-z\s]+)/,
    /^(aucun|aucune)\s+(?:les\s+)?([a-z]+)\s+(?:ne\s+)?([a-z\s]+)/,
    /^(certains|certaines)\s+(?:les\s+)?([a-z]+)\s+(?:ne\s+)?([a-z\s]+)/,
    /^(chaque)\s+([a-z]+)\s+([a-z\s]+)/,
  ];

  for (const pat of patterns) {
    const m = q.match(pat);
    if (m) {
      const quantRaw = m[1];
      const sujetRaw = m[2];
      const propRaw = m[3];
      let quant: 'tous' | 'aucun' | 'certains' = 'tous';
      if (['tous', 'toutes', 'chaque'].includes(quantRaw)) quant = 'tous';
      else if (['aucun', 'aucune'].includes(quantRaw)) quant = 'aucun';
      else quant = 'certains';
      return {
        quant,
        sujet: sujetRaw.trim(),
        prop: propRaw.trim(),
      };
    }
  }
  return null;
}

export function classifierIntention(question: string): string {
  try {
    const q = sansAccent(question.toLowerCase());
    const scores: Record<string, number> = {};
    for (const [intent, motscles] of Object.entries(INTENTIONS_KEYWORDS)) {
      let sc = 0;
      for (const mc of motscles) {
        const mcNorm = sansAccent(mc.toLowerCase());
        if (q.includes(mcNorm)) {
          sc += q.startsWith(mcNorm) ? 2 : 1;
        }
      }
      scores[intent] = sc;
    }
    let best = 'incompris';
    let maxSc = 0;
    for (const [k, v] of Object.entries(scores)) {
      if (v > maxSc) {
        maxSc = v;
        best = k;
      }
    }
    return maxSc === 0 ? 'incompris' : best;
  } catch {
    return 'incompris';
  }
}

export function detecterEtat(msg: string): string | null {
  const mn = sansAccent(msg.toLowerCase().trim());
  for (const [p, d] of Object.entries(PE)) {
    if (mn.includes(sansAccent(p))) return p;
    for (const s of d.synonymes) {
      if (mn.includes(sansAccent(s))) return p;
    }
  }
  return null;
}

export function repondreEtat(etat: string): string {
  const choices = PE[etat]?.reponses || ['Je comprends.'];
  return choices[Math.floor(Math.random() * choices.length)];
}

export function estSalutationPure(m: string): boolean {
  return SALUTATIONS.includes(sansAccent(m.toLowerCase().trim()));
}

export function estSalutation(q: string): string | null {
  const qq = sansAccent(q.toLowerCase().trim().replace(/[!?.]/g, ''));
  for (const mi of ["c'est quoi", 'quoi sert', 'chercher', 'retiens', 'lire', 'oublier', 'resume', 'definir', 'synonymes', 'pourquoi', 'parle moi']) {
    if (qq.includes(mi)) return null;
  }
  for (const s of SALUTATIONS) {
    if (qq === s || qq.startsWith(s + ' ') || qq.endsWith(' ' + s)) return s;
  }
  return null;
}

export function repondreSalutation(c: string): string {
  const list = RS[c] || ['Salut !'];
  const base = list[Math.floor(Math.random() * list.length)];
  if (['bonjour', 'salut', 'coucou', 'hey', 'yo', 'hello'].includes(c)) {
    const suite = SUITES[Math.floor(Math.random() * SUITES.length)];
    return base + suite;
  }
  return base;
}

export function resoudreContexte(question: string, contexte: string[]): string | null {
  const q = sansAccent(question.toLowerCase());
  const mots = q.match(/\w+/g) || [];
  if (mots.length <= 6 && contexte.length > 0) {
    for (const p of PRONOMS_CONTEXTE) {
      if (q.includes(` ${p} `) || q.startsWith(`${p} `) || q.includes(`${p}'`)) {
        return contexte[contexte.length - 1];
      }
    }
  }
  return null;
}

export function extraireIsA(definition: string): string | null {
  const d = sansAccent(definition.toLowerCase());
  const m = d.match(/((?:est\s+)?un(?:e)?\s+[a-z]+)/);
  if (m) {
    return m[1].replace(/^est\s+/, '').trim();
  }
  const m2 = d.match(/(?:est\s+)?un(?:e)?\s+([a-z]+)/);
  if (m2) {
    return m2[1].trim();
  }
  return null;
}

export const MOTS_INTERROGATIFS_ET_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l',
  'ce', 'cet', 'cette', 'ces',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
  'notre', 'votre', 'leur', 'nos', 'vos', 'leurs',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'me', 'te', 'se', 'moi', 'toi', 'lui', 'eux',
  'est', 'sont', 'etre', 'ete', 'etes', 'sommes', 'suis', 'es',
  'a', 'ai', 'as', 'ont', 'avons', 'avez', 'avoir', 'eu',
  'dans', 'en', 'sur', 'sous', 'par', 'pour', 'avec', 'sans', 'vers', 'chez',
  'et', 'ou', 'mais', 'donc', 'car', 'ni',
  'qui', 'que', 'quoi', 'qu', 'dont', 'ou',
  'comment', 'pourquoi', 'quand', 'combien', 'quel', 'quelle', 'quels', 'quelles',
  'peux', 'peut', 'peuvent', 'pouvez', 'pourrais', 'pourrait',
  'sais', 'sait', 'savez', 'savent',
  'veux', 'veut', 'voulez', 'veulent',
  'dis', 'dit', 'dites', 'dire',
  'explique', 'expliquer', 'donne', 'donner', 'raconte', 'raconter',
  'fait', 'faire', 'font', 'fais',
  'voici', 'voila', 'bonjour', 'salut', 'merci',
]);

export function extraireMotsCles(texte: string): string[] {
  if (!texte) return [];
  const tNorm = sansAccent(texte.toLowerCase()).replace(/[^a-z0-9\s]/g, ' ');
  const words = tNorm
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !MOTS_INTERROGATIFS_ET_VIDES.has(w) && !PRONOMS_CONTEXTE.has(w));
  return Array.from(new Set(words));
}

export function normaliserQuestionCle(question: string): string {
  if (!question) return '';
  let q = sansAccent(question.toLowerCase().trim());
  q = q.replace(/[?!.,;:()"\']+/g, ' ').replace(/\s+/g, ' ').trim();
  return q;
}

export function estRequeteDefinition(texte: string): { estDef: boolean; concept?: string } {
  if (!texte) return { estDef: false };
  const tClean = sansAccent(texte.toLowerCase().trim()).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Concept direct seul (1 ou 2 mots max, avec ou sans article, ex: "moineau", "le moineau", "trou noir")
  const mConceptSeul = tClean.match(/^(?:le |la |les |un |une |des |l |d )?([a-z0-9_-]+(?:\s+[a-z0-9_-]+)?)$/i);
  if (mConceptSeul && mConceptSeul[1]) {
    const cand = mConceptSeul[1].trim();
    if (!MOTS_INTERROGATIFS_ET_VIDES.has(cand) && cand.length >= 3) {
      return { estDef: true, concept: cand };
    }
  }

  // 2. Formulations explicites de demande de définition
  const defPrefixes = [
    "c'est quoi ", 'c quoi ', "qu'est ce que ", 'qu est ce que ', "qu'est-ce que ",
    'qui est ', 'qui sont ', "c'est qui ", 'definition de ', 'definition du ', 'definition d ',
    'parle moi de ', 'parle-moi de ', 'dis moi ce que ', 'dis-moi ce que ',
    'que sais tu sur ', 'que sais-tu sur ', 'tu sais quoi sur ',
    'explique moi ce que ', 'explique-moi ce que ', 'definir ', 'definis '
  ];

  for (const pref of defPrefixes) {
    const prefNorm = sansAccent(pref);
    if (tClean.startsWith(prefNorm)) {
      let rest = tClean.slice(prefNorm.length).trim();
      rest = rest.replace(/^(?:le |la |les |un |une |des |l |d )/i, '').trim();
      if (rest.length >= 2 && !MOTS_INTERROGATIFS_ET_VIDES.has(rest)) {
        return { estDef: true, concept: rest };
      }
    }
  }

  return { estDef: false };
}

export function extraireX(
  qs: string,
  memoire: MemoryStore,
  regles: RulesStore,
  synonymes: SynonymsStore,
  contexte: string[]
): string | null {
  const ql = sansAccent(qs.toLowerCase().trim());
  if (estSalutationPure(ql)) return null;

  // 1. Déduction causale "pourquoi [le|la|un...] [sujet]"
  const mPourquoi = ql.match(/pourquoi\s+(?:le|la|les|un|une)?\s*([a-z]+)/);
  if (mPourquoi) {
    const cand = corriger(mPourquoi[1].trim(), memoire, regles, synonymes) || mPourquoi[1].trim();
    if (!MOTS_VIDES.has(cand) && !PRONOMS_CONTEXTE.has(cand)) return cand;
  }

  // 2. Définitions explicites : c'est quoi, qu'est-ce que, qui est, parle-moi de...
  const defCheck = estRequeteDefinition(qs);
  if (defCheck.estDef && defCheck.concept) {
    const cand = corriger(defCheck.concept, memoire, regles, synonymes) || defCheck.concept;
    if (!MOTS_VIDES.has(cand)) return cand;
  }

  // 3. Pronoms anaphoriques résolus avec le contexte actif
  const ctx = resoudreContexte(qs, contexte);
  if (ctx) return ctx;

  // 4. Message court spécifiant un concept direct
  const qClean = ql.replace(/[^a-z0-9 ]/g, ' ');
  const mots = qClean.split(/\s+/).filter(w => w.length >= 2 && !MOTS_VIDES.has(w) && !PRONOMS_CONTEXTE.has(w));
  
  if (mots.length === 1 || mots.length === 2) {
    const multiCand = mots.join(' ');
    if (memoire[multiCand] || regles[multiCand]) return multiCand;

    for (let i = mots.length - 1; i >= 0; i--) {
      const w = mots[i];
      const c = corriger(w, memoire, regles, synonymes);
      if (c && !estSalutationPure(c)) return c;
      const flou = rechercherFlou(w, memoire, regles, 0.72);
      if (flou && !estSalutationPure(flou)) return flou;
    }
  }

  return null;
}

export function naviguerLiens(sujet: string, liens: LinksStore, maxDepth = 10): string[] {
  const s = sujet.toLowerCase().trim();
  const chemin = [s];
  const visites = new Set([s]);
  let courant = s;
  for (let i = 0; i < maxDepth; i++) {
    const suivants = (liens[courant] || []).filter(item => !visites.has(item));
    if (suivants.length === 0) break;
    courant = suivants[0];
    visites.add(courant);
    chemin.push(courant);
  }
  return chemin;
}

export function trouverLiensCommuns(sujet1: string, sujet2: string, liens: LinksStore): string[] {
  const ancetres1 = new Set(naviguerLiens(sujet1, liens, 10));
  const ancetres2 = new Set(naviguerLiens(sujet2, liens, 10));
  return Array.from(ancetres1).filter(x => ancetres2.has(x) && x !== sujet1 && x !== sujet2);
}

export function deduireChaine(
  sujet: string,
  prop = '',
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore,
  maxDepth = 20
): {
  chemin: string[];
  propriete_source?: string;
  propriete_def?: string;
  confiance: number;
} | null {
  const s = (corriger(sujet, memoire, regles, synonymes) || sujet).toLowerCase().trim();
  const pNorm = sansAccent(prop.toLowerCase().trim());

  const chaineLiens = naviguerLiens(s, liens, maxDepth);
  if (!pNorm && chaineLiens.length > 1) {
    return { chemin: chaineLiens, confiance: 0.95 };
  }
  if (pNorm && chaineLiens.length > 1) {
    for (const ancetre of chaineLiens) {
      if (regles[ancetre]) {
        for (const regle of regles[ancetre]) {
          if (sansAccent(regle.prop.toLowerCase()).includes(pNorm)) {
            const idx = chaineLiens.indexOf(ancetre);
            return {
              chemin: chaineLiens.slice(0, idx + 1),
              propriete_source: ancetre,
              propriete_def: regle.prop,
              confiance: regle.poids * 0.95,
            };
          }
        }
      }
    }
  }

  const chemin = [s];
  const visited = new Set<string>();
  let cur = s;
  let confiance = 1.0;

  for (let step = 0; step < maxDepth; step++) {
    if (visited.has(cur)) break;
    visited.add(cur);
    const defs = memoire[cur] || [];
    if (defs.length === 0) break;

    const bestEntry = defs.reduce((max, curItem) => (curItem.poids > max.poids ? curItem : max), defs[0]);
    confiance *= bestEntry.poids;

    if (pNorm) {
      for (const d of defs) {
        if (sansAccent(d.def.toLowerCase()).includes(pNorm)) {
          if (chemin.length > 1 || cur !== s) {
            return {
              chemin,
              propriete_source: cur,
              propriete_def: d.def,
              confiance,
            };
          }
        }
      }
    }

    let nextNode: string | null = null;
    let nextNodeWithArt: string | null = null;

    for (const d of defs) {
      const isa = extraireIsA(d.def);
      if (isa) {
        const words = isa.split(/\s+/);
        const isaNom = words[words.length - 1];
        const isaCorr = corriger(isaNom, memoire, regles, synonymes) || isaNom;
        if (!visited.has(isaCorr)) {
          nextNode = isaCorr;
          nextNodeWithArt = isa;
          break;
        }
      }
    }

    if (nextNode) {
      chemin.push(nextNodeWithArt || nextNode);
      cur = nextNode;
    } else {
      break;
    }
  }

  if (pNorm) {
    if (regles[cur]) {
      for (const r of regles[cur]) {
        if (sansAccent(r.prop.toLowerCase()).includes(pNorm)) {
          return {
            chemin,
            propriete_source: cur,
            propriete_def: r.prop,
            confiance: confiance * r.poids,
          };
        }
      }
    }
    return null;
  }

  return chemin.length > 1 ? { chemin, confiance } : null;
}

export function deduireGeneralisation(
  sujet: string,
  prop: string,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore,
  maxDepth = 20
): {
  categorie: string;
  quant: 'tous' | 'aucun' | 'certains';
  prop: string;
  confiance: number;
  chemin: string[];
} | null {
  const s = (corriger(sujet, memoire, regles, synonymes) || sujet).toLowerCase().trim();
  const p = sansAccent(prop.toLowerCase().trim());
  if (!p) return null;

  const chaineInfo = deduireChaine(s, '', memoire, regles, liens, synonymes, maxDepth);
  const categoriesSujet: string[] = [];
  if (chaineInfo && chaineInfo.chemin) {
    for (const elem of chaineInfo.chemin) {
      const parts = elem.split(/\s+/);
      const nom = singulariser(parts[parts.length - 1], memoire, regles, synonymes);
      categoriesSujet.push(nom);
      categoriesSujet.push(elem.toLowerCase());
    }
  }
  categoriesSujet.push(s);

  const seen = new Set<string>();
  const cats: string[] = [];
  for (const c of categoriesSujet) {
    const sing = singulariser(c, memoire, regles, synonymes);
    if (!seen.has(sing)) {
      seen.add(sing);
      cats.push(sing);
    }
  }

  for (const cat of cats) {
    const catCorr = corriger(cat, memoire, regles, synonymes) || cat;
    for (const key of [cat, catCorr, singulariser(cat, memoire, regles, synonymes)]) {
      if (regles[key]) {
        for (const regle of regles[key]) {
          const rProp = sansAccent(regle.prop.toLowerCase());
          if (p.includes(rProp) || rProp.includes(p)) {
            const confChaine = chaineInfo ? chaineInfo.confiance : 1.0;
            return {
              categorie: key,
              quant: regle.quant,
              prop: regle.prop,
              confiance: regle.poids * confChaine,
              chemin: chaineInfo ? chaineInfo.chemin : [s],
            };
          }
        }
      }
    }
  }
  return null;
}

export function construirePhraseFluideDefinition(chemin: string[], _confiance = 1.0): string | null {
  if (!chemin || chemin.length < 2) return null;
  const first = chemin[0].charAt(0).toUpperCase() + chemin[0].slice(1);
  const second = chemin[1];
  let phrase = `${first} est ${second}`;
  const connecteurs = ['qui est', 'lui-même', 'qui est à son tour', 'et qui est'];
  for (let i = 1; i < chemin.length - 1; i++) {
    const nxt = chemin[i + 1];
    const conn = connecteurs[Math.floor(Math.random() * connecteurs.length)];
    phrase += `, ${conn} ${nxt}`;
  }
  return phrase + '.';
}

export function construirePhraseFluidePourquoi(
  chemin: string[],
  prop: string,
  propDef: string,
  propSource: string,
  _confiance = 1.0
): string {
  const chaineFluide = (construirePhraseFluideDefinition(chemin, 1.0) || '').replace(/\.$/, '');
  const suiteProp = `Or ${propSource} ${propDef}`;
  const conclusions = [
    `Donc ${chemin[0]} ${prop}.`,
    `Ainsi, ${chemin[0]} ${prop} également.`,
    `Ce qui explique pourquoi ${chemin[0]} ${prop}.`,
  ];
  const conclusion = conclusions[Math.floor(Math.random() * conclusions.length)];
  return `${chaineFluide}. ${suiteProp}, ${conclusion.toLowerCase()}`;
}

export function construirePhraseGeneralisation(
  sujet: string,
  cat: string,
  quant: 'tous' | 'aucun' | 'certains',
  prop: string,
  _confiance: number,
  chemin: string[]
): string {
  const cheminTxt = chemin.length > 1 ? (construirePhraseFluideDefinition(chemin, 1.0) || '') + ' ' : '';
  if (quant === 'tous') {
    return `${cheminTxt}Or tous les ${cat}s ${prop}, donc ${sujet} ${prop}.`;
  } else if (quant === 'aucun') {
    return `${cheminTxt}Or aucun ${cat} ne ${prop}, donc ${sujet} ne ${prop} pas.`;
  } else {
    return `${cheminTxt}Certains ${cat}s ${prop}. ${sujet} étant un ${cat}, il est probable que ${sujet} ${prop}.`;
  }
}

export function repondrePourquoi(
  question: string,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore
): string | null {
  const q = sansAccent(question.toLowerCase());
  const m = q.match(/pourquoi\s+(?:le|la|les|un|une)?\s*([a-z]+)\s+([a-z\s]+)/);
  if (!m) return null;
  const sujet = m[1].trim();
  const prop = m[2].trim();
  const sujetCorr = corriger(sujet, memoire, regles, synonymes) || sujet;

  const deduc = deduireChaine(sujetCorr, prop, memoire, regles, liens, synonymes);
  if (deduc && deduc.chemin && deduc.propriete_source && deduc.propriete_def) {
    return construirePhraseFluidePourquoi(
      deduc.chemin,
      prop,
      deduc.propriete_def,
      deduc.propriete_source,
      deduc.confiance
    );
  }

  const gen = deduireGeneralisation(sujetCorr, prop, memoire, regles, liens, synonymes);
  if (gen) {
    return construirePhraseGeneralisation(sujetCorr, gen.categorie, gen.quant, gen.prop, gen.confiance, gen.chemin);
  }

  if (memoire[sujetCorr]) {
    for (const d of memoire[sujetCorr]) {
      if (sansAccent(d.def.toLowerCase()).includes(prop)) {
        return `${sujetCorr.charAt(0).toUpperCase() + sujetCorr.slice(1)} ${d.def}.`;
      }
    }
  }

  return null;
}

export function phraseDef(
  X: string,
  question: string | null,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore
): string | null {
  const xCorr = corriger(X, memoire, regles, synonymes) || X;
  const defs = memoire[xCorr] || [];

  if (question && question.toLowerCase().includes('pourquoi')) {
    const rPourquoi = repondrePourquoi(question, memoire, regles, liens, synonymes);
    if (rPourquoi) return rPourquoi;
  }

  const chaine = deduireChaine(xCorr, '', memoire, regles, liens, synonymes);
  if (chaine && chaine.chemin.length > 1) {
    const fluide = construirePhraseFluideDefinition(chaine.chemin, chaine.confiance);
    if (fluide) return fluide;
  }

  if (defs.length > 0) {
    const best = defs.reduce((max, cur) => (cur.poids > max.poids ? cur : max), defs[0]);
    const d = best.def.trim();
    if (best.type === 'question_reponse' || best.question_origine || d.length > 120 || d.includes('\n')) {
      return d;
    }
    const cap = xCorr.charAt(0).toUpperCase() + xCorr.slice(1);
    if (d.length > 60 || d.startsWith('est ') || d.startsWith('un ') || d.startsWith('une ')) {
      return d.startsWith('est ') ? `${cap} ${d}.` : `${cap} est ${d}.`;
    }
    return `${cap} est ${d}.`;
  }

  if (regles[xCorr]) {
    const rList = regles[xCorr].map(r => `${r.quant} les ${xCorr}s ${r.prop}`);
    return `${xCorr.charAt(0).toUpperCase() + xCorr.slice(1)}: ${rList.join(', ')}.`;
  }

  return null;
}

export function decayMemoire(
  memoire: MemoryStore,
  _regles: RulesStore,
  joursSeuil = 7,
  taux = 0.98
): { modifs: number; supprimes: number } {
  const now = new Date();
  let modifs = 0;
  let supprimes = 0;

  for (const [sujet, entries] of Object.entries(memoire)) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const last = new Date(entry.last_used || entry.created || now.toISOString());
      const deltaDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 3600 * 24));
      if (deltaDays >= joursSeuil) {
        const joursOublie = deltaDays - joursSeuil + 1;
        const ancienPoids = entry.poids;
        let nouveauPoids = Math.max(0.1, ancienPoids * Math.pow(taux, joursOublie));
        if (nouveauPoids < ancienPoids - 0.02) {
          entry.poids = Number(nouveauPoids.toFixed(2));
          modifs++;
        }
        if (deltaDays > 30 && nouveauPoids < 0.25 && entry.hits < 3 && entries.length > 1) {
          entries.splice(i, 1);
          supprimes++;
        }
      }
    }
    if (entries.length === 0) {
      delete memoire[sujet];
    }
  }

  return { modifs, supprimes };
}

export function trouverQuestionReponse(
  question: string,
  memoire: MemoryStore,
  seuilSimilarite = 0.72
): { sujet: string; entry: MemoryEntry; score: number } | null {
  if (!question || !memoire) return null;
  const qNorm = normaliserQuestionCle(question);
  const qKeywords = extraireMotsCles(question);

  if (qKeywords.length === 0) return null;

  let bestMatch: { sujet: string; entry: MemoryEntry; score: number } | null = null;
  let maxScore = 0;

  for (const [sujet, entries] of Object.entries(memoire)) {
    for (const entry of entries) {
      const origQ = entry.question_origine || (entry.type === 'question_reponse' ? sujet : null);
      if (!origQ && !sujet.includes(' ')) continue;

      const qSource = origQ || sujet;
      const storedQNorm = normaliserQuestionCle(qSource);
      const storedKeywords = entry.mots_cles && entry.mots_cles.length > 0
        ? entry.mots_cles
        : extraireMotsCles(qSource);

      if (storedKeywords.length === 0) continue;

      if (qNorm === storedQNorm) {
        return { sujet, entry, score: 1.0 };
      }

      const simText = similarite(qNorm, storedQNorm);
      const intersection = storedKeywords.filter(k => qKeywords.includes(k));

      if (storedKeywords.length >= 2) {
        const recallStored = intersection.length / storedKeywords.length;
        const precisionQ = intersection.length / qKeywords.length;

        if (intersection.length >= 2 && recallStored >= 0.70 && precisionQ >= 0.40) {
          const score = (recallStored * 0.6) + (precisionQ * 0.2) + (simText * 0.2);
          if (score > maxScore && score >= seuilSimilarite) {
            maxScore = score;
            bestMatch = { sujet, entry, score };
          }
        }
      } else if (storedKeywords.length === 1 && qKeywords.length === 1) {
        if (storedKeywords[0] === qKeywords[0] && simText >= 0.85) {
          if (simText > maxScore && simText >= seuilSimilarite) {
            maxScore = simText;
            bestMatch = { sujet, entry, score: simText };
          }
        }
      }
    }
  }

  return bestMatch;
}

export function nettoyerMemoirePolluee(memoire: MemoryStore): number {
  if (!memoire) return 0;
  let nettoyes = 0;
  const nowIso = new Date().toISOString();

  for (const [sujet, entries] of Object.entries(memoire)) {
    if (!sujet.includes(' ') && entries.length > 0) {
      const entry = entries[0];
      if (entry.question_origine && entry.question_origine.trim().includes(' ')) {
        const qTrim = entry.question_origine.trim();
        const mots = extraireMotsCles(qTrim);

        const defCheck = estRequeteDefinition(qTrim);
        if (mots.length >= 2 && (!defCheck.estDef || defCheck.concept !== sujet)) {
          const newKey = normaliserQuestionCle(qTrim);
          if (!memoire[newKey]) {
            memoire[newKey] = [];
          }
          memoire[newKey].unshift({
            ...entry,
            type: 'question_reponse',
            mots_cles: mots,
            last_used: nowIso,
          });

          delete memoire[sujet];
          nettoyes++;
        }
      }
    }
  }

  return nettoyes;
}

export function apprendreDeLLM(
  question: string,
  reponseLLM: string,
  memoire: MemoryStore,
  provider: 'gemini' | 'groq' | 'auto' = 'gemini'
): { sujet: string; def: string; type: 'concept' | 'question_reponse' } | null {
  try {
    if (!question || !reponseLLM) return null;
    const qTrim = question.trim();
    let repTrim = reponseLLM.trim();
    if (qTrim.length < 3 || repTrim.length < 5) return null;

    const qClean = sansAccent(qTrim.toLowerCase());
    if (estSalutationPure(qClean) || qClean.startsWith('retiens:') || qClean.startsWith('regle:') || qClean.startsWith('lien:')) {
      return null;
    }

    for (const intro of ['Voici ', 'Bien sûr', 'Bien sur', "D'accord", 'Daccord', 'Avec plaisir', 'Absolument']) {
      if (repTrim.startsWith(intro)) {
        const parts = repTrim.split('. ');
        if (parts.length > 1) {
          repTrim = parts.slice(1).join('. ');
        }
        break;
      }
    }

    const nowIso = new Date().toISOString();

    const defCheck = estRequeteDefinition(qTrim);
    if (defCheck.estDef && defCheck.concept) {
      const concept = defCheck.concept;
      if (!memoire[concept]) {
        memoire[concept] = [];
      }

      const exists = memoire[concept].find(it => it.def.toLowerCase() === repTrim.toLowerCase());
      if (exists) {
        exists.poids = Math.min(1.0, exists.poids + 0.05);
        exists.hits += 1;
        exists.last_used = nowIso;
      } else {
        memoire[concept].unshift({
          def: repTrim,
          poids: 0.85,
          hits: 1,
          source: provider === 'groq' ? 'groq' : 'gemini',
          question_origine: qTrim,
          type: 'concept',
          last_used: nowIso,
          created: nowIso,
        });
      }
      return { sujet: concept, def: repTrim, type: 'concept' };
    }

    const motsCles = extraireMotsCles(qTrim);
    if (motsCles.length === 0) return null;

    const canonicalKey = normaliserQuestionCle(qTrim);
    if (!memoire[canonicalKey]) {
      memoire[canonicalKey] = [];
    }

    const exists = memoire[canonicalKey].find(it => it.def.toLowerCase() === repTrim.toLowerCase());
    if (exists) {
      exists.poids = Math.min(1.0, exists.poids + 0.05);
      exists.hits += 1;
      exists.last_used = nowIso;
    } else {
      memoire[canonicalKey].unshift({
        def: repTrim,
        poids: 0.85,
        hits: 1,
        source: provider === 'groq' ? 'groq' : 'gemini',
        question_origine: qTrim,
        mots_cles: motsCles,
        type: 'question_reponse',
        last_used: nowIso,
        created: nowIso,
      });
    }

    return { sujet: canonicalKey, def: repTrim, type: 'question_reponse' };
  } catch {
    return null;
  }
}

export const SEED_MEMORY: MemoryStore = {
  moineau: [
    { def: 'un petit oiseau migrateur ou sédentaire', poids: 0.9, hits: 3, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  oiseau: [
    { def: 'un animal à plumes doté d’ailes', poids: 0.95, hits: 5, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  animal: [
    { def: 'un être vivant doué de sensibilité et de mouvement', poids: 0.98, hits: 8, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  python: [
    { def: 'un langage de programmation interprété polyvalent et puissant', poids: 0.92, hits: 4, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  ia: [
    { def: 'intelligence artificielle capable d’apprendre et de raisonner', poids: 0.95, hits: 6, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  groq: [
    { def: 'un fournisseur ultra-rapide d’inférence LLM pour modèles open source', poids: 0.9, hits: 3, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
};

export const SEED_RULES: RulesStore = {
  oiseau: [
    { quant: 'tous', prop: 'a des ailes et pond des œufs', poids: 0.95, hits: 4, last_used: new Date().toISOString(), created: new Date().toISOString() },
    { quant: 'certains', prop: 'volent très haut', poids: 0.85, hits: 2, last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  animal: [
    { quant: 'tous', prop: 'respire et a besoin de nourriture', poids: 0.98, hits: 5, last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
};

export const SEED_LINKS: LinksStore = {
  moineau: ['oiseau'],
  oiseau: ['animal'],
};

/**
 * Construit un prompt chirurgical spécifiquement adapté pour le futur modèle local Nova (SmolLM2-1.7B).
 * Utilisé UNIQUEMENT pour le moteur local / Nova hors-ligne, jamais injecté dans les requêtes Cloud standard.
 */
export function construirePromptContextuelNova(
  question: string,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore,
  contexte: string[],
  systemPromptDefaut?: string
): { promptComplet: string; faitTrouve: string | null; source: string } {
  // Recherche chirurgicale du fait le plus pertinent dans la mémoire locale JSON
  const qaMatch = trouverQuestionReponse(question, memoire);
  let faitTrouve: string | null = null;
  let source = 'systeme';
  let sujetDeclencheur = '';

  if (qaMatch) {
    faitTrouve = qaMatch.entry.def;
    source = 'local_memoire';
    sujetDeclencheur = qaMatch.sujet;
  } else {
    const defCheck = estRequeteDefinition(question);
    const candX = defCheck.estDef && defCheck.concept
      ? defCheck.concept
      : extraireX(question, memoire, regles, synonymes, contexte);

    if (candX) {
      const defLocal = phraseDef(candX, question, memoire, regles, liens, synonymes);
      if (defLocal) {
        faitTrouve = defLocal;
        source = 'local_memoire';
        sujetDeclencheur = candX;
      }
    }
  }

  // Formatage du bloc de mémoire chirurgicale pour Nova
  const blocMemoire = faitTrouve
    ? `[FAIT VÉRIFIÉ EN MÉMOIRE LOCALE SUR "${sujetDeclencheur.toUpperCase()}"]\n- ${faitTrouve}`
    : `[MÉMOIRE LOCALE]\nAucun fait spécifique pré-enregistré sur ce sujet exact. Réponds avec fluidité, politesse et précision.`;

  const instructionsSysteme =
    systemPromptDefaut ||
    "Tu es KADERBOT Nova, une assistante virtuelle bilingue (FR/EN), polie, chaleureuse et concise. " +
    "Tu réponds toujours en français, en 2 à 4 phrases maximum. " +
    "Ne parle jamais à la place de l'utilisateur et n'invente pas d'informations fausses.";

  const promptComplet = `${instructionsSysteme}\n\n${blocMemoire}\n\nUtilisateur: ${question}\nKADERBOT Nova:`;

  return { promptComplet, faitTrouve, source };
}

```

---

<a id="srccomponentsHeadertsx"></a>
## Fichier : `src/components/Header.tsx`

> **Description** : En-tête de navigation et statut des connexions

```tsx
import React from 'react';
import {
  Brain,
  Sparkles,
  Download,
  Settings,
  Volume2,
  VolumeX,
  Layers,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { AppConfig } from '../types/kaderbot';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HeaderProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: Partial<AppConfig>) => void;
  sessions: string[];
  onSelectSession: (session: string) => void;
  onOpenSettings: () => void;
  onOpenActionsMenu: () => void;
  conceptsCount: number;
  rulesCount: number;
  isAdmin?: boolean;
  isAgentActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onUpdateConfig,
  sessions,
  onSelectSession,
  onOpenSettings,
  onOpenActionsMenu,
  conceptsCount,
  rulesCount,
  isAdmin = false,
  isAgentActive = false,
}) => {
  const { isInstallable, install } = usePWAInstall();

  // Short label helper for current model
  const getGroqShortName = () => {
    const m = (config.groqModel || '').toLowerCase();
    if (m.includes('20b')) return 'GPT-20B';
    return 'GPT-120B';
  };

  const getOpenRouterShortName = () => {
    const m = (config.openrouterModel || '').toLowerCase();
    if (m.includes('llama') || m.includes('70b')) return 'Llama 70B';
    if (m.includes('qwen')) return 'Qwen Coder';
    if (m.includes('deepseek') || m.includes('r1')) return 'DeepSeek R1';
    return 'Llama 70B';
  };

  if (!isAdmin) {
    return (
      <header className="sticky top-0 z-40 w-full shrink-0 bg-[#090B10]/95 backdrop-blur-md border-b border-gray-800/80 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#10A37F] to-[#06B6D4] p-0.5 shadow-md shadow-emerald-500/20">
                <div className="w-full h-full bg-[#0E131F] rounded-[14px] flex items-center justify-center">
                  <Brain className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#090B10] rounded-full" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">KADERBOT</h1>
              <p className="text-[11px] sm:text-xs text-gray-400 truncate">Ton assistant personnel</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${
                config.soundEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'
              }`}
              title={config.soundEnabled ? 'Désactiver la lecture vocale' : 'Activer la lecture vocale'}
              aria-label={config.soundEnabled ? 'Désactiver la lecture vocale' : 'Activer la lecture vocale'}
            >
              {config.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {isInstallable && (
              <button
                onClick={install}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/25 text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Installer</span>
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 flex-shrink-0 bg-[#090B10]/95 backdrop-blur-md border-b border-gray-800/80 px-3 py-2 sm:px-6 sm:py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 md:gap-4">
        {/* Tier 1: Brand & Action Controls */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          {/* Brand identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#10A37F] to-[#06B6D4] p-0.5 shadow-md shadow-emerald-500/20">
                <div className="w-full h-full bg-[#0E131F] rounded-[10px] flex items-center justify-center">
                  <Brain className="w-5 h-5 text-[#10A37F] animate-pulse" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#090B10] rounded-full" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                  KADERBOT
                </h1>
                <span className="text-[#10A37F] font-mono text-[10px] sm:text-xs px-1.5 py-0.2 rounded bg-[#10A37F]/15 border border-[#10A37F]/30 font-semibold shrink-0">
                  NOVA V14
                </span>
                {isAgentActive && (
                  <span className="text-emerald-300 font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 font-bold shrink-0 flex items-center gap-1.5 shadow-sm animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Agent actif</span>
                  </span>
                )}
                {isAdmin ? (
                  <span className="text-amber-300 font-mono text-[10px] px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 font-bold shrink-0 flex items-center gap-1 shadow-sm">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    <span>Mode Admin</span>
                  </span>
                ) : (
                  <span className="text-emerald-400 font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 font-medium shrink-0">
                    Public
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 truncate flex items-center gap-1.5">
                <span>Hybride</span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span className="text-emerald-400 font-mono text-[10px] sm:text-[11px]">
                  {conceptsCount} faits · {rulesCount} règles
                </span>
              </p>
            </div>
          </div>

          {/* Quick tool icons on mobile (Actions, Sound, Settings) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Actions Menu button (Admin Only) */}
            {isAdmin && (
              <button
                onClick={onOpenActionsMenu}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-sm shadow-emerald-900/30 transition-all active:scale-95"
                title="Menu des commandes rapides (Tkinter Actions)"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span className="inline text-[11px] sm:text-xs">Actions</span>
              </button>
            )}

            {/* Sound toggle button */}
            <button
              onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
              className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border transition-colors flex-shrink-0 ${
                config.soundEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'
              }`}
              title={config.soundEnabled ? 'Synthèse vocale active' : 'Synthèse vocale désactivée'}
            >
              {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* PWA Install Button if available */}
            {isInstallable && (
              <button
                onClick={install}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 text-xs font-medium transition-all"
                title="Installer l'application sur Android / PC"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PWA</span>
              </button>
            )}

            {/* Settings button (Admin Only) */}
            {isAdmin && (
              <button
                onClick={onOpenSettings}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-colors flex-shrink-0"
                title="Paramètres de l'IA et clés API"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Selectors (Session & AI Model) - Cleanly displayed side-by-side without any overlap */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Session Switcher Pill (Admin Only) */}
          {isAdmin && (
            <div className="flex-1 md:flex-initial flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900/90 border border-gray-800 text-xs text-gray-300 font-medium min-w-0">
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden sm:inline text-gray-400 shrink-0">Session:</span>
              <select
                value={config.activeSession}
                onChange={e => onSelectSession(e.target.value)}
                className="bg-transparent text-white font-semibold cursor-pointer outline-none text-xs w-full min-w-0 truncate"
              >
                {sessions.map(s => (
                  <option key={s} value={s} className="bg-gray-900 text-white">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* AI Provider Direct Selector */}
          <div className={`flex-1 md:flex-initial flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors bg-gray-900/90 min-w-0 ${
            config.provider === 'gemini'
              ? 'border-emerald-500/40 text-emerald-300'
              : config.provider === 'groq'
              ? 'border-amber-500/40 text-amber-300'
              : config.provider === 'openrouter'
              ? 'border-purple-500/40 text-purple-300'
              : 'border-blue-500/40 text-blue-300'
          }`}>
            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${
              config.provider === 'gemini'
                ? 'text-emerald-400'
                : config.provider === 'groq'
                ? 'text-amber-400'
                : config.provider === 'openrouter'
                ? 'text-purple-400'
                : 'text-blue-400'
            }`} />
            <select
              value={config.provider}
              onChange={e => onUpdateConfig({ provider: e.target.value as any })}
              className="bg-transparent font-semibold cursor-pointer outline-none text-xs text-white w-full min-w-0 truncate"
              title="Sélectionner le moteur IA"
            >
              <option value="gemini" className="bg-gray-900 text-emerald-300">
                ✨ Gemini 3.8 Flash
              </option>
              <option value="groq" className="bg-gray-900 text-amber-300">
                ⚡ Groq ({getGroqShortName()})
              </option>
              <option value="openrouter" className="bg-gray-900 text-purple-300">
                🦙 OpenRouter ({getOpenRouterShortName()})
              </option>
              <option value="local_only" className="bg-gray-900 text-blue-300">
                🧠 100% Local (Hors-ligne)
              </option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
```

---

<a id="srccomponentsKnowledgeGraphTabtsx"></a>
## Fichier : `src/components/KnowledgeGraphTab.tsx`

> **Description** : Visualisation et gestion du graphe de connaissances

```tsx
import React, { useState, useMemo } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  TrendingUp,
  Clock,
  ExternalLink,
  ChevronRight,
  GitBranch,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';
import { deduireChaine, sansAccent } from '../core/cognitiveEngine';

interface KnowledgeGraphTabProps {
  memoire: MemoryStore;
  regles: RulesStore;
  liens: LinksStore;
  synonymes: SynonymsStore;
  onAddDefinition: (sujet: string, defText: string) => void;
  onDeleteConcept: (sujet: string) => void;
  onAdjustWeight: (sujet: string, delta: number) => void;
  onAdjustHits?: (sujet: string, entryIdx: number, delta: number) => void;
  onAddLink: (source: string, target: string) => void;
  onDeleteLink: (source: string, target: string) => void;
  onAskQuestionAbout: (sujet: string) => void;
}

export const KnowledgeGraphTab: React.FC<KnowledgeGraphTabProps> = ({
  memoire,
  regles,
  liens,
  synonymes,
  onAddDefinition,
  onDeleteConcept,
  onAdjustWeight,
  onAdjustHits,
  onAddLink,
  onDeleteLink,
  onAskQuestionAbout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [newDefInput, setNewDefInput] = useState('');
  const [newLinkTarget, setNewLinkTarget] = useState('');

  // Extract all concept nodes
  const conceptsList = useMemo(() => {
    const list = Object.keys(memoire).map(sujet => {
      const defs = memoire[sujet] || [];
      const best = defs.reduce((max, c) => (c.poids > max.poids ? c : max), defs[0] || { poids: 0.8, hits: 1 });
      const parents = liens[sujet] || [];
      const children = Object.keys(liens).filter(k => (liens[k] || []).includes(sujet));
      const isQA = best?.type === 'question_reponse' || Boolean(best?.question_origine && best.question_origine.includes(' ')) || sujet.includes(' ');
      return {
        sujet,
        bestDef: best?.def || '',
        poids: best?.poids || 0.8,
        hits: best?.hits || 1,
        source: best?.source || 'manuel',
        isQA,
        question_origine: best?.question_origine,
        mots_cles: best?.mots_cles || [],
        defsCount: defs.length,
        parents,
        children,
      };
    });

    list.sort((a, b) => b.poids - a.poids);
    return list;
  }, [memoire, liens]);

  // Filtered concepts
  const filteredConcepts = useMemo(() => {
    if (!searchQuery.trim()) return conceptsList;
    const qNorm = sansAccent(searchQuery.toLowerCase());
    return conceptsList.filter(
      c =>
        sansAccent(c.sujet).includes(qNorm) ||
        sansAccent(c.bestDef).includes(qNorm)
    );
  }, [conceptsList, searchQuery]);

  // Current active concept detail
  const currentConceptData = selectedConcept ? memoire[selectedConcept] : null;
  const currentChain = selectedConcept
    ? deduireChaine(selectedConcept, '', memoire, regles, liens, synonymes)
    : null;

  const handleAddDefSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcept || !newDefInput.trim()) return;
    onAddDefinition(selectedConcept, newDefInput.trim());
    setNewDefInput('');
  };

  const handleAddLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcept || !newLinkTarget.trim()) return;
    onAddLink(selectedConcept, newLinkTarget.trim());
    setNewLinkTarget('');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-112px)] sm:h-[calc(100vh-120px)] overflow-hidden bg-[#050508] text-gray-200">
      {/* Left panel: List & Search */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-gray-800/80 flex flex-col bg-[#090B10]/95 flex-shrink-0">
        {/* Search header */}
        <div className="p-3 sm:p-4 border-b border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs sm:text-sm font-bold text-white">Mémoire Cognitive</h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
              {conceptsList.length} concepts
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un mot (ex: oiseau, python...)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* List of Concepts */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5">
          {filteredConcepts.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-500">
              Aucun concept trouvé. Pose une question au bot pour lui apprendre !
            </div>
          ) : (
            filteredConcepts.map(item => {
              const isSelected = selectedConcept === item.sujet;
              return (
                <div
                  key={item.sujet}
                  onClick={() => setSelectedConcept(item.sujet)}
                  className={`p-2.5 sm:p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-950/30'
                      : 'bg-gray-900/50 hover:bg-gray-800/70 border-gray-800/80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-white truncate capitalize">
                        {item.sujet}
                      </span>
                      {item.isQA ? (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950/70 text-purple-300 border border-purple-800/50">
                          Q&R
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/50">
                          Concept
                        </span>
                      )}
                      {item.parents.length > 0 && (
                        <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-0.5">
                          <GitBranch className="w-2.5 h-2.5" />
                          <span>{item.parents[0]}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.bestDef}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        item.poids >= 0.75
                          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40'
                          : 'bg-amber-900/50 text-amber-300 border border-amber-700/40'
                      }`}
                    >
                      {Math.round(item.poids * 100)}%
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">{item.hits} hits</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel: Detail, Chains & Graph Connections */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#050508]">
        {selectedConcept ? (
          <div className="space-y-5 max-w-4xl mx-auto">
            {/* Header card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl sm:text-2xl font-black text-white capitalize tracking-wide">
                    {selectedConcept}
                  </h3>
                  {currentConceptData?.[0]?.type === 'question_reponse' || currentConceptData?.[0]?.question_origine ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono">
                      Question-Réponse (Q&R)
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono">
                      Concept actif
                    </span>
                  )}
                </div>
                {currentConceptData?.[0]?.question_origine && (
                  <p className="text-xs text-purple-300/90 mt-1 italic font-medium">
                    Question originale : &ldquo;{currentConceptData[0].question_origine}&rdquo;
                  </p>
                )}
                {currentConceptData?.[0]?.mots_cles && currentConceptData[0].mots_cles.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-500 font-mono">Mots-clés déclencheurs :</span>
                    {currentConceptData[0].mots_cles.map(mc => (
                      <span key={mc} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                        {mc}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Enregistré dans la mémoire cognitive locale de KADERBOT
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onAskQuestionAbout(selectedConcept)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Demander au bot</span>
                </button>
                <button
                  onClick={() => {
                    onDeleteConcept(selectedConcept);
                    setSelectedConcept(null);
                  }}
                  className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-500 hover:text-rose-400 hover:border-rose-900/40 transition"
                  title="Supprimer ce concept de la mémoire"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Logical Deduction Chain Visualization */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-cyan-500/20 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Chaîne d’Inférence Logique (Arbre Conceptuel)
                  </h4>
                </div>
                {currentChain && (
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    Confiance : {Math.round(currentChain.confiance * 100)}%
                  </span>
                )}
              </div>

              {currentChain && currentChain.chemin.length > 1 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-mono">
                    {currentChain.chemin.map((node, index) => (
                      <React.Fragment key={index}>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span className="font-bold capitalize">{node}</span>
                        </div>
                        {index < currentChain.chemin.length - 1 && (
                          <span className="text-gray-500 font-bold">est un →</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <p className="text-xs text-gray-400 bg-gray-900/60 p-3 rounded-xl border border-gray-800/80">
                    💡 Grâce à cette chaîne, tout ce qui est vrai pour{' '}
                    <strong className="text-cyan-300">
                      {currentChain.chemin[currentChain.chemin.length - 1]}
                    </strong>{' '}
                    est automatiquement hérité par{' '}
                    <strong className="text-emerald-300">{selectedConcept}</strong> !
                  </p>
                </div>
              ) : (
                <div className="text-xs text-gray-500 bg-gray-900/40 p-3 rounded-xl">
                  Ce concept n'est pas encore relié à un parent (ex: oiseau, animal, langage). Tu
                  peux créer un lien ci-dessous ou dire au bot : « {selectedConcept} est un ... »
                </div>
              )}
            </div>

            {/* Definitions & Weighted Facts */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-3">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                <span>Définitions & Poids de certitude</span>
              </h4>

              <div className="space-y-2">
                {currentConceptData?.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-gray-900/70 border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-gray-200">{entry.def}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 flex-wrap">
                        <span>Source: {entry.source}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          <span>Hits: <strong className="text-emerald-300 font-mono text-xs">{entry.hits}</strong></span>
                          {onAdjustHits && (
                            <span className="inline-flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAdjustHits(selectedConcept, idx, 1);
                                }}
                                className="px-1.5 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-mono text-[10px] border border-emerald-800/50"
                                title="Augmenter les hits (+1)"
                              >
                                +1 hit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAdjustHits(selectedConcept, idx, -1);
                                }}
                                className="px-1.5 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-mono text-[10px] border border-rose-800/50"
                                title="Diminuer les hits (-1)"
                              >
                                -1 hit
                              </button>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {(entry.poids * 100).toFixed(0)}%
                        </span>
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${entry.poids * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onAdjustWeight(selectedConcept, 0.1)}
                          className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[11px] font-mono border border-emerald-800/40"
                          title="Augmenter la confiance"
                        >
                          +0.1
                        </button>
                        <button
                          onClick={() => onAdjustWeight(selectedConcept, -0.1)}
                          className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[11px] font-mono border border-rose-800/40"
                          title="Diminuer la confiance"
                        >
                          -0.1
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add definition form */}
              <form onSubmit={handleAddDefSubmit} className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Ajouter une propriété à "${selectedConcept}"...`}
                  value={newDefInput}
                  onChange={e => setNewDefInput(e.target.value)}
                  className="flex-1 bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="submit"
                  disabled={!newDefInput.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </form>
            </div>

            {/* Hierarchical Links Management (lie: A -> B) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-3">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Liens Parent / Enfant (Taxonomie)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Parents */}
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[11px] text-gray-400 block mb-1.5 font-semibold">
                    Concepts Parents (dont il hérite) :
                  </span>
                  {(liens[selectedConcept] || []).length === 0 ? (
                    <span className="text-gray-500 italic">Aucun parent défini</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {liens[selectedConcept].map(parent => (
                        <span
                          key={parent}
                          className="px-2 py-1 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/40 flex items-center gap-1"
                        >
                          {parent}
                          <button
                            onClick={() => onDeleteLink(selectedConcept, parent)}
                            className="text-gray-500 hover:text-rose-400 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Children */}
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[11px] text-gray-400 block mb-1.5 font-semibold">
                    Concepts Enfants (qui héritent de lui) :
                  </span>
                  {Object.keys(liens).filter(k => (liens[k] || []).includes(selectedConcept)).length === 0 ? (
                    <span className="text-gray-500 italic">Aucun enfant</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(liens)
                        .filter(k => (liens[k] || []).includes(selectedConcept))
                        .map(child => (
                          <span
                            key={child}
                            className="px-2 py-1 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 flex items-center gap-1"
                          >
                            {child}
                            <button
                              onClick={() => onDeleteLink(child, selectedConcept)}
                              className="text-gray-500 hover:text-rose-400 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Link form */}
              <form onSubmit={handleAddLinkSubmit} className="pt-1 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Lier "${selectedConcept}" comme enfant de (ex: oiseau, mammifère)...`}
                  value={newLinkTarget}
                  onChange={e => setNewLinkTarget(e.target.value)}
                  className="flex-1 bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  type="submit"
                  disabled={!newLinkTarget.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Lier</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
              <Brain className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Graphe Cognitif de KADERBOT</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Sélectionne un concept dans la colonne de gauche pour inspecter sa chaîne de déduction, ses
              liens taxonomiques et ses poids de mémoire.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

<a id="srccomponentsRulesTabtsx"></a>
## Fichier : `src/components/RulesTab.tsx`

> **Description** : Gestion des règles logiques et inférences

```tsx
import React, { useState } from 'react';
import {
  Scale,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  ArrowRight,
} from 'lucide-react';
import {
  GeneralRule,
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';
import {
  deduireChaine,
  deduireGeneralisation,
  construirePhraseGeneralisation,
} from '../core/cognitiveEngine';

interface RulesTabProps {
  memoire: MemoryStore;
  regles: RulesStore;
  liens: LinksStore;
  synonymes: SynonymsStore;
  onAddRule: (
    quant: 'tous' | 'aucun' | 'certains',
    sujet: string,
    prop: string,
    poids?: number
  ) => void;
  onDeleteRule: (sujet: string, prop: string) => void;
}

export const RulesTab: React.FC<RulesTabProps> = ({
  memoire,
  regles,
  liens,
  synonymes,
  onAddRule,
  onDeleteRule,
}) => {
  // Simulator state
  const [testSujet, setTestSujet] = useState('moineau');
  const [testProp, setTestProp] = useState('respire');
  const [simulationResult, setSimulationResult] = useState<string | null>(null);

  // Form state
  const [newQuant, setNewQuant] = useState<'tous' | 'aucun' | 'certains'>('tous');
  const [newSujet, setNewSujet] = useState('');
  const [newProp, setNewProp] = useState('');

  const handleSimulate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testSujet.trim() || !testProp.trim()) return;

    const s = testSujet.trim().toLowerCase();
    const p = testProp.trim().toLowerCase();

    // 1. Try generalization syllogism
    const gen = deduireGeneralisation(s, p, memoire, regles, liens, synonymes);
    if (gen) {
      const phrase = construirePhraseGeneralisation(
        s,
        gen.categorie,
        gen.quant,
        gen.prop,
        gen.confiance,
        gen.chemin
      );
      setSimulationResult(phrase);
      return;
    }

    // 2. Try direct property deduction through links
    const chaine = deduireChaine(s, p, memoire, regles, liens, synonymes);
    if (chaine && chaine.propriete_def && chaine.propriete_source) {
      setSimulationResult(
        `${s.charAt(0).toUpperCase() + s.slice(1)} hérite de "${chaine.propriete_source}" qui ${chaine.propriete_def}. Donc ${s} ${p} (confiance ${Math.round(chaine.confiance * 100)}%).`
      );
      return;
    }

    setSimulationResult(
      `Impossible de déduire que "${s}" a pour propriété "${p}". Aucune règle générale ni chaîne conceptuelle trouvée.`
    );
  };

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSujet.trim() || !newProp.trim()) return;
    onAddRule(newQuant, newSujet.trim(), newProp.trim());
    setNewSujet('');
    setNewProp('');
  };

  const allRulesList: Array<{
    sujet: string;
    quant: 'tous' | 'aucun' | 'certains';
    prop: string;
    poids: number;
    hits: number;
  }> = [];

  for (const [sujet, rList] of Object.entries(regles)) {
    for (const r of rList) {
      allRulesList.push({
        sujet,
        quant: r.quant,
        prop: r.prop,
        poids: r.poids,
        hits: r.hits,
      });
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#050508] space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            <span>Moteur d'Inférence & Syllogismes</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Règles logiques universelles et déductions causales inspirées des quantificateurs aristotéliciens.
          </p>
        </div>
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
          {allRulesList.length} règles actives
        </span>
      </div>

      {/* Syllogism Simulator Widget */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0E131F] to-[#0A0D15] border border-emerald-500/30 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Simulateur de Déduction Logique (Test de Syllogisme)
          </h3>
        </div>

        <form onSubmit={handleSimulate} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-[11px] text-gray-400 mb-1">Concept Sujet :</label>
            <input
              type="text"
              placeholder="Ex: moineau, aigle, python..."
              value={testSujet}
              onChange={e => setTestSujet(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="sm:col-span-5">
            <label className="block text-[11px] text-gray-400 mb-1">Propriété à vérifier :</label>
            <input
              type="text"
              placeholder="Ex: respire, vole, a des ailes..."
              value={testProp}
              onChange={e => setTestProp(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Tester</span>
            </button>
          </div>
        </form>

        {simulationResult && (
          <div className="p-3.5 rounded-xl bg-gray-900/90 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 leading-relaxed font-sans shadow-inner">
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono font-bold mb-1">
              Résultat de l’inférence :
            </div>
            {simulationResult}
          </div>
        )}
      </div>

      {/* Add new rule form */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-3">
        <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Enseigner une Règle Générale à KADERBOT</span>
        </h3>

        <form onSubmit={handleAddRuleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-3">
            <label className="block text-[11px] text-gray-400 mb-1">Quantificateur :</label>
            <select
              value={newQuant}
              onChange={e => setNewQuant(e.target.value as any)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
            >
              <option value="tous">Tous les (Universel +)</option>
              <option value="aucun">Aucun (Universel -)</option>
              <option value="certains">Certains (Particulier)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[11px] text-gray-400 mb-1">Catégorie / Sujet :</label>
            <input
              type="text"
              placeholder="Ex: oiseau, poisson..."
              value={newSujet}
              onChange={e => setNewSujet(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[11px] text-gray-400 mb-1">Propriété :</label>
            <input
              type="text"
              placeholder="Ex: a des ailes, vit dans l'eau..."
              value={newProp}
              onChange={e => setNewProp(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!newSujet.trim() || !newProp.trim()}
              className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </form>
      </div>

      {/* Rules Grid */}
      <div className="space-y-3">
        <h3 className="text-xs sm:text-sm font-bold text-white">Règles Enregistrées en Mémoire</h3>

        {allRulesList.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500 bg-[#0E131F] rounded-2xl border border-gray-800">
            Aucune règle générale enregistrée pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allRulesList.map((r, idx) => {
              const isTous = r.quant === 'tous';
              const isAucun = r.quant === 'aucun';
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#0E131F] border border-gray-800/80 hover:border-gray-700 transition flex items-center justify-between gap-3 shadow-md"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                          isTous
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                            : isAucun
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                        }`}
                      >
                        {r.quant}
                      </span>
                      <span className="text-xs font-bold text-white capitalize">{r.sujet}s</span>
                    </div>

                    <p className="text-xs text-gray-300">
                      {isAucun ? `ne ${r.prop} pas` : r.prop}
                    </p>

                    <span className="text-[10px] text-gray-500 font-mono mt-1 inline-block">
                      Confiance : {Math.round(r.poids * 100)}% · Hits: {r.hits}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteRule(r.sujet, r.prop)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-gray-800 transition"
                    title="Supprimer cette règle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
```

---

<a id="srccomponentsSessionsTabtsx"></a>
## Fichier : `src/components/SessionsTab.tsx`

> **Description** : Gestion multi-sessions de la mémoire cognitive

```tsx
import React, { useState } from 'react';
import {
  FolderTree,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Plus,
  Check,
  FileCode,
  Smartphone,
  Brain,
  Sparkles,
  CloudUpload,
  CloudDownload,
  AlertCircle,
  Server,
} from 'lucide-react';
import {
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';
import { decayMemoire } from '../core/cognitiveEngine';
import { apiService } from '../services/apiService';

interface SessionsTabProps {
  sessions: string[];
  activeSession: string;
  onSelectSession: (s: string) => void;
  onCreateSession: (name: string) => void;
  memoire: MemoryStore;
  regles: RulesStore;
  liens: LinksStore;
  synonymes: SynonymsStore;
  onUpdateMemory: (newMemo: MemoryStore, newRegles: RulesStore) => void;
  onImportFullBackup: (data: {
    memoire: MemoryStore;
    regles: RulesStore;
    liens: LinksStore;
  }) => void;
  groqApiKey?: string;
  groqModel?: string;
  onPushMemoryToServer?: () => Promise<{ success: boolean; message: string }>;
  onPullMemoryFromServer?: () => Promise<{ success: boolean; message: string }>;
}

export const SessionsTab: React.FC<SessionsTabProps> = ({
  sessions,
  activeSession,
  onSelectSession,
  onCreateSession,
  memoire,
  regles,
  liens,
  synonymes,
  onUpdateMemory,
  onImportFullBackup,
  groqApiKey,
  groqModel,
  onPushMemoryToServer,
  onPullMemoryFromServer,
}) => {
  const [newSessionName, setNewSessionName] = useState('');
  const [decayReport, setDecayReport] = useState<{ modifs: number; supprimes: number } | null>(null);
  const [isExportingPydroid, setIsExportingPydroid] = useState(false);

  // Synchronisation Mémoire Hybride (Admin)
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [showPullConfirm, setShowPullConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handlePushToServer = async () => {
    setIsPushing(true);
    setSyncStatus(null);
    setShowPullConfirm(false);
    try {
      if (onPushMemoryToServer) {
        const res = await onPushMemoryToServer();
        setSyncStatus(res);
      } else {
        await apiService.saveMemoryToServer({
          memoire,
          regles,
          liens,
          synonymes,
          sessions,
        });
        setSyncStatus({
          success: true,
          message: `Mémoire locale envoyée au serveur avec succès (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}).`,
        });
      }
    } catch (err: any) {
      setSyncStatus({
        success: false,
        message: `Erreur d'envoi : ${err.message || 'Serveur indisponible'}`,
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullFromServer = async () => {
    setShowPullConfirm(false);
    setIsPulling(true);
    setSyncStatus(null);
    try {
      if (onPullMemoryFromServer) {
        const res = await onPullMemoryFromServer();
        setSyncStatus(res);
      } else {
        const remote = await apiService.loadMemoryFromServer();
        if (remote) {
          onUpdateMemory(remote.memoire || {}, remote.regles || {});
          setSyncStatus({
            success: true,
            message: `Mémoire du serveur récupérée et appliquée en local (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}).`,
          });
        }
      }
    } catch (err: any) {
      setSyncStatus({
        success: false,
        message: `Erreur de récupération : ${err.message || 'Serveur indisponible'}`,
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleCreateSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSessionName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || sessions.includes(clean)) return;
    onCreateSession(clean);
    setNewSessionName('');
  };

  const handleRunDecay = () => {
    const res = decayMemoire(memoire, regles, 7, 0.98);
    onUpdateMemory({ ...memoire }, { ...regles });
    setDecayReport(res);
  };

  const handleDownloadPydroid = async (mode: 'console' | 'gui' | 'auto' = 'console') => {
    setIsExportingPydroid(true);
    try {
      const blob = await apiService.downloadPydroidScript({
        memoire,
        regles,
        liens,
        groqApiKey,
        groqModel,
        mode,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = mode === 'console' ? 'terminal' : mode === 'gui' ? 'tkinter' : 'auto';
      a.download = `kaderbot_v14_pydroid_${suffix}_${activeSession}.py`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Erreur export script : ${err.message}`);
    } finally {
      setIsExportingPydroid(false);
    }
  };

  const handleExportJSON = () => {
    const data = {
      version: '14.0',
      activeSession,
      exportedAt: new Date().toISOString(),
      memoire,
      regles,
      liens,
      synonymes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kaderbot_backup_${activeSession}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (json.memoire || json.regles) {
          onImportFullBackup({
            memoire: json.memoire || {},
            regles: json.regles || {},
            liens: json.liens || {},
          });
          alert('Sauvegarde importée avec succès dans la session active !');
        } else {
          alert('Fichier JSON invalide pour KADERBOT.');
        }
      } catch (err) {
        alert('Erreur lors du décodage du fichier JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#050508] max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-teal-400" />
            <span>Gestion des Sessions & Exportation Pydroid 3</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Bascule entre différentes mémoires isolées, lance l'oubli intelligent et exporte ton code pour Android.
          </p>
        </div>
      </div>

      {/* Synchronisation Mémoire Hybride (Admin Uniquement) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0B1528] to-[#080D18] border border-blue-500/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Synchronisation Mémoire Hybride (Locale + Serveur)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 border border-blue-800/40 text-blue-300">
                  Mode Admin
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                Priorité au stockage local (<code>localStorage</code>) pour une rapidité absolue et zéro dépendance réseau. Utilisez les commandes ci-dessous pour synchroniser manuellement avec le serveur.
              </p>
            </div>
          </div>
        </div>

        {/* Sync Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Bouton 1: Envoyer ma mémoire au serveur */}
          <div className="p-3.5 rounded-xl bg-[#080E1C] border border-blue-500/20 flex flex-col justify-between space-y-3">
            <div>
              <p className="text-xs font-semibold text-blue-200 flex items-center gap-1.5">
                <CloudUpload className="w-4 h-4 text-blue-400" />
                <span>Sauvegarde sur le Serveur</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Transmet l'état actuel de votre mémoire locale (faits, règles, liens, sessions) au serveur pour le stocker de façon pérenne.
              </p>
            </div>
            <button
              onClick={handlePushToServer}
              disabled={isPushing || isPulling}
              className="w-full py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-blue-950/40 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{isPushing ? 'Envoi en cours...' : 'Envoyer ma mémoire au serveur'}</span>
            </button>
          </div>

          {/* Bouton 2: Récupérer la mémoire du serveur */}
          <div className="p-3.5 rounded-xl bg-[#080E1C] border border-teal-500/20 flex flex-col justify-between space-y-3">
            <div>
              <p className="text-xs font-semibold text-teal-200 flex items-center gap-1.5">
                <CloudDownload className="w-4 h-4 text-teal-400" />
                <span>Restauration depuis le Serveur</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Charge la mémoire centrale du serveur distant et <strong>écrase</strong> votre mémoire locale actuelle.
              </p>
            </div>

            {showPullConfirm ? (
              <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-600/50 text-xs space-y-2">
                <p className="text-amber-200 font-semibold text-[11px]">
                  ⚠️ Confirmer l'écrasement de la mémoire locale ?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePullFromServer}
                    disabled={isPulling}
                    className="flex-1 py-1.5 px-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition"
                  >
                    Oui, écraser
                  </button>
                  <button
                    onClick={() => setShowPullConfirm(false)}
                    className="py-1.5 px-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] transition"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowPullConfirm(true)}
                disabled={isPushing || isPulling}
                className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-teal-950/40 flex items-center justify-center gap-2 transition active:scale-95"
              >
                <CloudDownload className="w-4 h-4" />
                <span>{isPulling ? 'Récupération en cours...' : 'Récupérer la mémoire du serveur'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback de synchronisation */}
        {syncStatus && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition animate-in fade-in duration-200 ${
              syncStatus.success
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}
          >
            {syncStatus.success ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span className="leading-snug">{syncStatus.message}</span>
          </div>
        )}
      </div>

      {/* 1. Android Pydroid 3 Sync Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0E131F] to-[#0A121A] border border-cyan-500/30 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Exporter vers Pydroid 3 (Android)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800/40 text-emerald-300">
                  Version V14 Corrigée Anti-Crash
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Deux formats d'exécution prêts à l'emploi selon la configuration de votre application Pydroid 3 sur mobile.
              </p>
            </div>
          </div>
        </div>

        {/* Action cards: Mode Console vs Mode Tkinter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Card 1: Console / Terminal (Recommandé Pydroid 3) */}
          <div className="p-4 rounded-xl bg-[#090D18] border border-emerald-500/30 hover:border-emerald-500/60 transition flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Mode Console / Terminal (Recommandé)</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                  100% Garanti
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Tourne <strong>nativement</strong> dans la fenêtre noire de Pydroid 3. Zéro plugin requis, dialogue fluide, saisie <code>[Toi] &gt;</code>, déduction causale, apprentissage et appel Groq.
              </p>
            </div>
            <button
              onClick={() => handleDownloadPydroid('console')}
              disabled={isExportingPydroid}
              className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <FileCode className="w-4 h-4" />
              <span>{isExportingPydroid ? 'Génération...' : 'Télécharger Mode Terminal (Recommandé)'}</span>
            </button>
          </div>

          {/* Card 2: Tkinter GUI */}
          <div className="p-4 rounded-xl bg-[#090D18] border border-cyan-500/30 hover:border-cyan-500/60 transition flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>Mode Graphique Tkinter</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                  Fenêtre Graphique
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Tente d'ouvrir la fenêtre Tkinter. <strong>Sécurité anti-crash</strong> : si Pydroid 3 n'a pas le plugin Tkinter installé, il bascule automatiquement sur le terminal !
              </p>
            </div>
            <button
              onClick={() => handleDownloadPydroid('gui')}
              disabled={isExportingPydroid}
              className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-cyan-950/40 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <FileCode className="w-4 h-4" />
              <span>{isExportingPydroid ? 'Génération...' : 'Télécharger Mode Graphique Tkinter'}</span>
            </button>
          </div>
        </div>

        {/* Diagnostics & Explications */}
        <div className="bg-[#07090F] p-3.5 rounded-xl border border-gray-800 text-xs text-gray-300 space-y-2">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold text-xs">
            <Smartphone className="w-4 h-4" />
            <span>Pourquoi Tkinter ne s'ouvrait pas et comment le résoudre :</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-400">
            <li>
              <strong>Pydroid 3 n'inclut pas Tkinter par défaut</strong> : Sur Android, Tkinter dépend d'un serveur X11. Sans le plugin <em>&ldquo;Pydroid repository plugin&rdquo;</em> (disponible sur le Play Store), Python plante dès <code>import tkinter</code>.
            </li>
            <li>
              <strong>Le Mode Terminal (Console) est la solution idéale</strong> : Il s'exécute directement dans la console native de Pydroid 3, sans aucun plugin externe, avec toutes les capacités cognitives de KaderBot.
            </li>
            <li>
              <strong>Sécurité Base64</strong> : Les données étaient précédemment sujettes à des erreurs de parsing JSON (<code>null</code> au lieu de <code>None</code>). C'est désormais 100% corrigé.
            </li>
          </ul>
        </div>
      </div>

      {/* 2. Package Web Complet pour Transformation en Application Mobile (APK) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#120F24] to-[#0A0D18] border border-purple-500/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Code Source Web Complet (ZIP) pour App Mobile</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-800/40 text-purple-300">
                  Prêt pour Outil Dédié (APK / iOS)
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Téléchargez l'intégralité du projet web (Vite, React, Moteur Cognitif, UI et bundle compilé <code>dist/</code>) en un seul clic.
              </p>
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-[#090714] rounded-xl border border-purple-500/20 text-xs text-gray-300 space-y-2">
          <div className="font-semibold text-purple-300 flex items-center gap-2">
            <span>Comment le transformer en application mobile avec votre outil dédié :</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-400">
            <li><strong>Avec WebIntoApp / Website 2 APK :</strong> Importez le dossier <code>dist/</code> inclus dans l'archive ZIP pour générer directement un fichier APK installable sur n'importe quel smartphone Android.</li>
            <li><strong>Avec Capacitor / Cordova :</strong> Décompressez l'archive, lancez <code>npm install && npx cap add android</code> pour obtenir un projet natif Android Studio.</li>
            <li><strong>Installation PWA directe :</strong> Vous pouvez aussi installer l'application immédiatement depuis le navigateur Chrome via le menu ou l'icône d'installation dans la barre d'adresse.</li>
          </ul>
        </div>

        <a
          href="/api/export-project-zip"
          download="kaderbot-projet-web-complet.zip"
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2.5 transition active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Télécharger le Projet Web Complet (.ZIP)</span>
        </a>
      </div>

      {/* 2. Sessions Management */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-emerald-400" />
          <span>Profils & Sessions de Mémoire</span>
        </h3>

        {/* Sessions list */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {sessions.map(s => {
            const isActive = activeSession === s;
            return (
              <div
                key={s}
                onClick={() => onSelectSession(s)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  isActive
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-md'
                    : 'bg-gray-900/60 border-gray-800 text-gray-300 hover:bg-gray-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-emerald-400' : 'bg-gray-600'
                    }`}
                  />
                  <span className="text-xs font-bold capitalize">{s}</span>
                </div>
                {isActive && (
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/40">
                    Active
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Create new session form */}
        <form onSubmit={handleCreateSessionSubmit} className="pt-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="Nom d'une nouvelle session (ex: physique, histoire, perso)..."
            value={newSessionName}
            onChange={e => setNewSessionName(e.target.value)}
            className="flex-1 bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            type="submit"
            disabled={!newSessionName.trim()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Créer session</span>
          </button>
        </form>
      </div>

      {/* 3. Intelligent Decay (Oubli intelligent de la V13) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Mécanisme d'Oubli Intelligent (Decay)</h3>
          </div>
          <button
            onClick={handleRunDecay}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition"
          >
            Lancer l'oubli maintenant
          </button>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          Comme dans le cerveau humain, les faits peu utilisés ou mémorisés il y a plus de 7 jours voient leur coefficient de certitude diminuer progressivement. Les connaissances erronées ou obsolètes finissent par disparaître naturellement.
        </p>

        {decayReport && (
          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-200">
            Résultat de l’oubli : <strong>{decayReport.modifs}</strong> faits recalculés à la baisse,{' '}
            <strong>{decayReport.supprimes}</strong> faits obsolètes purgés.
          </div>
        )}
      </div>

      {/* 4. Backup & Restore JSON */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Sauvegarde & Restauration JSON</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Exportez l’intégralité de la base de données cognitive pour la conserver ou la transférer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter JSON</span>
          </button>

          <label className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5" />
            <span>Importer JSON</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
```

---

<a id="srccomponentsToolsTabtsx"></a>
## Fichier : `src/components/ToolsTab.tsx`

> **Description** : Console d'outils et tests des moteurs LLM

```tsx
import React, { useState } from 'react';
import {
  Lightbulb,
  Languages,
  CheckCheck,
  FileText,
  Sparkles,
  Copy,
  Check,
  Download,
  Volume2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { STYLES_IDEES } from '../core/cognitiveEngine';
import { apiService } from '../services/apiService';
import { AppConfig, IdeaItem } from '../types/kaderbot';

interface ToolsTabProps {
  config: AppConfig;
  onSaveToMemory: (sujet: string, def: string) => void;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({ config, onSaveToMemory }) => {
  const [activeTool, setActiveTool] = useState<'idees' | 'traduction' | 'correction' | 'resume'>('idees');

  // Ideas Generator state
  const [themeInput, setThemeInput] = useState('');
  const [ideasCount, setIdeasCount] = useState(5);
  const [selectedStyle, setSelectedStyle] = useState('creatif');
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [ideasResult, setIdeasResult] = useState<IdeaItem[]>([]);
  const [developingId, setDevelopingId] = useState<number | null>(null);

  // Translation state
  const [transInput, setTransInput] = useState('');
  const [transLang, setTransLang] = useState('English');
  const [transResult, setTransResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // Correction state
  const [corrigeInput, setCorrigeInput] = useState('');
  const [corrigeResult, setCorrigeResult] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  // Summary state
  const [resumeInput, setResumeInput] = useState('');
  const [resumeResult, setResumeResult] = useState('');
  const [isResuming, setIsResuming] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleGenerateIdeas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeInput.trim() || isGeneratingIdeas) return;
    setIsGeneratingIdeas(true);
    try {
      const styleDesc = STYLES_IDEES[selectedStyle] || STYLES_IDEES.creatif;
      const text = await apiService.genererIdees({
        theme: themeInput.trim(),
        count: ideasCount,
        style: selectedStyle,
        styleDesc,
        provider: config.provider,
        groqModel: config.groqModel,
      });

      const lines = text
        .split('\n')
        .map(l => l.replace(/^\s*(\d+[\.\)\-:]\s*|[\-\*]\s*)/, '').trim())
        .filter(Boolean);

      const items: IdeaItem[] = lines.map((title, idx) => ({
        id: idx + 1,
        title,
        theme: themeInput.trim(),
        style: selectedStyle,
        timestamp: new Date().toLocaleTimeString(),
      }));

      setIdeasResult(items);
    } catch (err: any) {
      alert(`Erreur génération idées : ${err.message}`);
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleDevelopIdea = async (idea: IdeaItem) => {
    setDevelopingId(idea.id);
    try {
      const prompt = `Développe cette idée en 3 à 4 phrases concrètes, claires et inspirantes : "${idea.title}".`;
      const res = await apiService.chat({
        prompt,
        history: [],
        provider: config.provider,
        groqModel: config.groqModel,
      });

      setIdeasResult(prev =>
        prev.map(it => (it.id === idea.id ? { ...it, developedText: res.text } : it))
      );

      // Save to memory
      onSaveToMemory(`idee_${idea.id}_${idea.theme.slice(0, 15)}`, `${idea.title} -> ${res.text.slice(0, 180)}`);
    } catch (err: any) {
      alert(`Erreur développement idée : ${err.message}`);
    } finally {
      setDevelopingId(null);
    }
  };

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transInput.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      const result = await apiService.traduire({
        text: transInput.trim(),
        targetLang: transLang,
        provider: config.provider,
        groqModel: config.groqModel,
      });
      setTransResult(result);
    } catch (err: any) {
      alert(`Erreur traduction : ${err.message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCorrige = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corrigeInput.trim() || isCorrecting) return;
    setIsCorrecting(true);
    try {
      const result = await apiService.corriger({
        text: corrigeInput.trim(),
        provider: config.provider,
        groqModel: config.groqModel,
      });
      setCorrigeResult(result);
    } catch (err: any) {
      alert(`Erreur correction : ${err.message}`);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeInput.trim() || isResuming) return;
    setIsResuming(true);
    try {
      const result = await apiService.resumer({
        text: resumeInput.trim(),
        provider: config.provider,
        groqModel: config.groqModel,
      });
      setResumeResult(result);
    } catch (err: any) {
      alert(`Erreur résumé : ${err.message}`);
    } finally {
      setIsResuming(false);
    }
  };

  const languagesList = [
    { label: 'Anglais', val: 'English' },
    { label: 'Arabe', val: 'Arabic' },
    { label: 'Espagnol', val: 'Spanish' },
    { label: 'Allemand', val: 'German' },
    { label: 'Italien', val: 'Italian' },
    { label: 'Portugais', val: 'Portuguese' },
    { label: 'Russe', val: 'Russian' },
    { label: 'Chinois', val: 'Chinese' },
    { label: 'Japonais', val: 'Japanese' },
    { label: 'Coréen', val: 'Korean' },
    { label: 'Peul (Fula)', val: 'Fula' },
    { label: 'Bambara', val: 'Bambara' },
    { label: 'Wolof', val: 'Wolof' },
    { label: 'Swahili', val: 'Swahili' },
    { label: 'Turc', val: 'Turkish' },
    { label: 'Néerlandais', val: 'Dutch' },
    { label: 'Français', val: 'French' },
  ];

  return (
    <div className="flex-1 min-w-0 w-full overflow-x-hidden overflow-y-auto p-3 sm:p-6 bg-[#050508] max-w-5xl mx-auto space-y-6 box-border">
      {/* Sub-nav tabs */}
      <div className="min-w-0 w-full flex items-center gap-2 p-1.5 rounded-2xl bg-[#090B10] border border-gray-800 overflow-x-auto">
        <button
          onClick={() => setActiveTool('idees')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'idees'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          <span>Générateur d'Idées</span>
        </button>

        <button
          onClick={() => setActiveTool('traduction')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'traduction'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Languages className="w-4 h-4" />
          <span>Traducteur Universel</span>
        </button>

        <button
          onClick={() => setActiveTool('correction')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'correction'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <CheckCheck className="w-4 h-4" />
          <span>Correcteur Express</span>
        </button>

        <button
          onClick={() => setActiveTool('resume')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'resume'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Résumeur Automatique</span>
        </button>
      </div>

      {/* 1. IDEAS TOOL */}
      {activeTool === 'idees' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-emerald-400" />
              <span>Brainstorming & Générateur d'Idées Multi-Styles</span>
            </h3>

            <form onSubmit={handleGenerateIdeas} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Thème ou sujet :</label>
                <input
                  type="text"
                  placeholder="Ex: Application mobile d'IA, Projet écologique, Histoire de science-fiction..."
                  value={themeInput}
                  onChange={e => setThemeInput(e.target.value)}
                  className="w-full bg-[#161822] border border-gray-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Style selector */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Style d'idéation :</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(STYLES_IDEES).map(styleKey => (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => setSelectedStyle(styleKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize border transition ${
                        selectedStyle === styleKey
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {styleKey}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Nombre d'idées :</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={ideasCount}
                    onChange={e => setIdeasCount(Number(e.target.value))}
                    className="accent-emerald-500"
                  />
                  <span className="font-mono text-xs font-bold text-emerald-400 w-4">{ideasCount}</span>
                </div>

                <button
                  type="submit"
                  disabled={!themeInput.trim() || isGeneratingIdeas}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isGeneratingIdeas ? 'Génération en cours...' : 'Générer les idées'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Results list */}
          {ideasResult.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">Idées générées pour "{themeInput}" :</h4>
                <button
                  onClick={() =>
                    handleCopy('all_ideas', ideasResult.map(i => `${i.id}. ${i.title}`).join('\n'))
                  }
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Tout copier</span>
                </button>
              </div>

              <div className="space-y-3">
                {ideasResult.map(idea => (
                  <div
                    key={idea.id}
                    className="p-4 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-2.5 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-emerald-950 border border-emerald-800/40 text-emerald-400 font-mono text-xs flex items-center justify-center flex-shrink-0 font-bold">
                          {idea.id}
                        </span>
                        <p className="text-xs sm:text-sm font-medium text-gray-100">{idea.title}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleCopy(`idea_${idea.id}`, idea.title)}
                          className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                          title="Copier l'idée"
                        >
                          {copiedKey === `idea_${idea.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDevelopIdea(idea)}
                          disabled={developingId === idea.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition"
                        >
                          {developingId === idea.id ? 'Développement...' : 'Développer →'}
                        </button>
                      </div>
                    </div>

                    {idea.developedText && (
                      <div className="p-3 rounded-xl bg-gray-900/80 border border-emerald-500/25 text-xs text-gray-300 leading-relaxed font-sans">
                        <div className="text-[10px] text-emerald-400 font-mono font-bold mb-1">
                          Approfondissement mémorisé dans le graphe :
                        </div>
                        {idea.developedText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. TRANSLATOR TOOL */}
      {activeTool === 'traduction' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-cyan-400" />
              <span>Traducteur Polyglotte (18+ langues)</span>
            </h3>

            <form onSubmit={handleTranslate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Texte à traduire :</label>
                <textarea
                  rows={4}
                  placeholder="Écris ou colle ton texte ici..."
                  value={transInput}
                  onChange={e => setTransInput(e.target.value)}
                  className="w-full bg-[#161822] border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Langue cible :</span>
                  <select
                    value={transLang}
                    onChange={e => setTransLang(e.target.value)}
                    className="bg-[#161822] border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                  >
                    {languagesList.map(lang => (
                      <option key={lang.val} value={lang.val}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!transInput.trim() || isTranslating}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-cyan-950/40"
                >
                  {isTranslating ? 'Traduction en cours...' : 'Traduire'}
                </button>
              </div>
            </form>
          </div>

          {transResult && (
            <div className="p-4 rounded-2xl bg-[#0E131F] border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">Traduction ({transLang}) :</span>
                <button
                  onClick={() => handleCopy('trad', transResult)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  {copiedKey === 'trad' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-sm text-gray-100 whitespace-pre-wrap">{transResult}</p>
            </div>
          )}
        </div>
      )}

      {/* 3. CORRECTEUR TOOL */}
      {activeTool === 'correction' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="min-w-0 w-full p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4 box-border">
            <h3 className="min-w-0 text-sm font-bold text-white flex items-start gap-2">
              <CheckCheck className="w-4 h-4 text-purple-400" />
              <span className="min-w-0 break-words">Correcteur Orthographique & Grammatical</span>
            </h3>

            <form onSubmit={handleCorrige} className="space-y-3">
              <textarea
                rows={4}
                placeholder="Colle ton texte contenant des fautes à corriger..."
                value={corrigeInput}
                onChange={e => setCorrigeInput(e.target.value)}
                className="block w-full max-w-full min-w-0 box-border bg-[#161822] border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!corrigeInput.trim() || isCorrecting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-purple-950/40"
                >
                  {isCorrecting ? 'Correction en cours...' : 'Corriger le texte'}
                </button>
              </div>
            </form>
          </div>

          {corrigeResult && (
            <div className="min-w-0 w-full p-4 rounded-2xl bg-[#0E131F] border border-purple-500/30 space-y-2 box-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400">Texte corrigé :</span>
                <button
                  onClick={() => handleCopy('corrige', corrigeResult)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  {copiedKey === 'corrige' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="min-w-0 max-w-full break-words text-sm text-gray-100 whitespace-pre-wrap">{corrigeResult}</p>
            </div>
          )}
        </div>
      )}

      {/* 4. RESUMEUR TOOL */}
      {activeTool === 'resume' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Résumeur Automatique de Textes Longs</span>
            </h3>

            <form onSubmit={handleResume} className="space-y-3">
              <textarea
                rows={5}
                placeholder="Colle un article, une leçon ou un long paragraphe à résumer..."
                value={resumeInput}
                onChange={e => setResumeInput(e.target.value)}
                className="w-full bg-[#161822] border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!resumeInput.trim() || isResuming}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-amber-950/40"
                >
                  {isResuming ? 'Synthèse en cours...' : 'Générer le résumé'}
                </button>
              </div>
            </form>
          </div>

          {resumeResult && (
            <div className="p-4 rounded-2xl bg-[#0E131F] border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">Résumé concis :</span>
                <button
                  onClick={() => handleCopy('resume', resumeResult)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  {copiedKey === 'resume' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">{resumeResult}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

---

<a id="srccomponentsSettingsModaltsx"></a>
## Fichier : `src/components/SettingsModal.tsx`

> **Description** : Modal des paramètres et configuration système

```tsx
import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Key,
  Check,
  Sliders,
  Volume2,
  BookOpen,
  Activity,
  AlertTriangle,
  ExternalLink,
  CloudUpload,
  CloudDownload,
  Server,
} from 'lucide-react';
import { AppConfig, LLMProvider } from '../types/kaderbot';
import { apiService } from '../services/apiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: Partial<AppConfig>) => void;
  onPushMemoryToServer?: () => Promise<{ success: boolean; message: string }>;
  onPullMemoryFromServer?: () => Promise<{ success: boolean; message: string }>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onPushMemoryToServer,
  onPullMemoryFromServer,
}) => {
  const [provider, setProvider] = useState<LLMProvider>(config.provider);
  const [geminiKey, setGeminiKey] = useState(config.geminiApiKey || '');
  const [groqKey, setGroqKey] = useState(config.groqApiKey || '');
  const [groqModel, setGroqModel] = useState(
    config.groqModel === 'llama-3.3-70b-versatile'
      ? 'openai/gpt-oss-120b'
      : config.groqModel || 'openai/gpt-oss-120b'
  );
  const [openrouterKey, setOpenrouterKey] = useState(config.openrouterApiKey || '');
  const [openrouterModel, setOpenrouterModel] = useState(
    config.openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free'
  );
  const [adminToken, setAdminToken] = useState(config.adminToken || '');
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [soundEnabled, setSoundEnabled] = useState(config.soundEnabled);
  const [autoLearn, setAutoLearn] = useState(config.autoLearnFromLLM);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Connection tester states
  const [isTestingGroq, setIsTestingGroq] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    model?: string;
    latencyMs?: number;
  } | null>(null);

  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{
    ok: boolean;
    message: string;
    model?: string;
    latencyMs?: number;
  } | null>(null);

  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState(false);
  const [openrouterTestResult, setOpenrouterTestResult] = useState<{
    ok: boolean;
    message: string;
    model?: string;
    latencyMs?: number;
  } | null>(null);

  // Synchronisation Mémoire Hybride
  const [isModalPushing, setIsModalPushing] = useState(false);
  const [isModalPulling, setIsModalPulling] = useState(false);
  const [showModalPullConfirm, setShowModalPullConfirm] = useState(false);
  const [modalSyncStatus, setModalSyncStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Sync state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setModalSyncStatus(null);
      setShowModalPullConfirm(false);
      setProvider(config.provider);
      setGeminiKey(config.geminiApiKey || '');
      setGroqKey(config.groqApiKey || '');
      setGroqModel(
        config.groqModel === 'llama-3.3-70b-versatile'
          ? 'openai/gpt-oss-120b'
          : config.groqModel || 'openai/gpt-oss-120b'
      );
      setOpenrouterKey(config.openrouterApiKey || '');
      setOpenrouterModel(
        config.openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free'
      );
      setAdminToken(config.adminToken || '');
      setSystemPrompt(config.systemPrompt);
      setSoundEnabled(config.soundEnabled);
      setAutoLearn(config.autoLearnFromLLM);
      setTestResult(null);
      setGeminiTestResult(null);
      setOpenrouterTestResult(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult(null);

    try {
      const res = await apiService.testGeminiConnection(geminiKey.trim());
      if (res.ok) {
        setGeminiTestResult({
          ok: true,
          message: `Connecté à Gemini (${res.model}) avec succès ! Latence : ${res.latencyMs}ms.`,
          model: res.model,
          latencyMs: res.latencyMs,
        });
      } else {
        setGeminiTestResult({
          ok: false,
          message: res.error || 'Erreur de connexion Gemini',
        });
      }
    } catch (e: any) {
      setGeminiTestResult({
        ok: false,
        message: e.message || 'Impossible de joindre le serveur de test',
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleTestGroq = async () => {
    setIsTestingGroq(true);
    setTestResult(null);

    try {
      const res = await apiService.testGroqConnection(groqKey.trim() || undefined, groqModel);
      if (res.ok) {
        setTestResult({
          ok: true,
          message: `Connecté à Groq avec succès ! Latence : ${res.latencyMs}ms.`,
          model: res.model,
          latencyMs: res.latencyMs,
        });
      } else {
        setTestResult({
          ok: false,
          message: res.error || 'Erreur de connexion Groq',
        });
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        message: e.message || 'Impossible de joindre le serveur de test',
      });
    } finally {
      setIsTestingGroq(false);
    }
  };

  const handleTestOpenRouter = async () => {
    setIsTestingOpenRouter(true);
    setOpenrouterTestResult(null);

    try {
      const res = await apiService.testOpenRouterConnection(openrouterKey.trim(), openrouterModel);
      if (res.ok) {
        setOpenrouterTestResult({
          ok: true,
          message: `Connecté à OpenRouter (${res.model}) avec succès ! Latence : ${res.latencyMs}ms.`,
          model: res.model,
          latencyMs: res.latencyMs,
        });
      } else {
        setOpenrouterTestResult({
          ok: false,
          message: `Échec OpenRouter : ${res.error || 'Erreur de connexion'}`,
          model: res.model,
        });
      }
    } catch (e: any) {
      setOpenrouterTestResult({
        ok: false,
        message: `Erreur OpenRouter : ${e.message || 'Impossible de joindre le serveur'}`,
      });
    } finally {
      setIsTestingOpenRouter(false);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      provider,
      geminiApiKey: geminiKey.trim(),
      groqApiKey: groqKey.trim(),
      openrouterApiKey: openrouterKey.trim(),
      groqModel,
      openrouterModel,
      adminToken: adminToken.trim(),
      systemPrompt,
      soundEnabled,
      autoLearnFromLLM: autoLearn,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0E131F] border border-gray-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800/80 bg-[#090B10]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Paramètres KADERBOT NOVA</h2>
              <p className="text-[11px] text-gray-400">Configuration du cerveau hybride & des moteurs IA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs text-gray-300">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-semibold text-white mb-2">
              Moteur d'Intelligence Artificielle Actif
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'gemini'
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm shadow-emerald-500/10'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-emerald-400 text-xs">Gemini 3.8 Flash</span>
                  {provider === 'gemini' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-gray-400">
                  Prêt à l'emploi. Aucun réglage de clé requis, ultra-rapide et gratuit.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProvider('groq')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'groq'
                    ? 'bg-amber-950/40 border-amber-500/60 text-white shadow-sm shadow-amber-500/10'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-amber-400 text-xs">Groq API</span>
                  {provider === 'groq' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <p className="text-[10px] text-gray-400">
                  Supporte GPT-OSS 120B & Llama. Requiert une clé API Groq gratuite.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProvider('openrouter')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'openrouter'
                    ? 'bg-purple-950/40 border-purple-500/60 text-white shadow-sm shadow-purple-500/10'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-purple-400 text-xs">OpenRouter</span>
                  {provider === 'openrouter' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <p className="text-[10px] text-gray-400">
                  Llama 3.3 70B & modèles gratuits (:free) multi-fournisseurs.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProvider('local_only')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'local_only'
                    ? 'bg-blue-950/40 border-blue-500/60 text-white shadow-sm shadow-blue-500/10'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-blue-400 text-xs">100% Local</span>
                  {provider === 'local_only' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <p className="text-[10px] text-gray-400">
                  Graphe de mémoire, règles et déductions logiques sans aucun appel réseau.
                </p>
              </button>
            </div>
          </div>

          {/* Server administration security */}
          <div className="p-3.5 rounded-xl bg-sky-950/20 border border-sky-500/30 space-y-3">
            <div className="flex items-center gap-2 text-sky-300 font-semibold text-xs">
              <Server className="w-4 h-4" />
              <span>Sécurité du serveur</span>
            </div>
            <div>
              <label className="block text-[11px] text-gray-300 mb-1">Jeton administrateur :</label>
              <input
                type="password"
                autoComplete="off"
                placeholder="ADMIN_TOKEN défini dans Render"
                value={adminToken}
                onChange={e => setAdminToken(e.target.value)}
                className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-sky-500 font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Nécessaire pour synchroniser la mémoire et exporter Pydroid. Il doit correspondre à la variable <code className="text-sky-400 font-mono">ADMIN_TOKEN</code> de Render.
              </p>
            </div>
          </div>

          {/* Gemini Configuration Section */}
          {provider === 'gemini' && (
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                  <Key className="w-4 h-4" />
                  <span>Configuration Gemini (Google AI Studio)</span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-emerald-400/80 hover:text-emerald-300 underline flex items-center gap-1"
                >
                  <span>Obtenir une clé gratuite</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Clé API Gemini (Optionnelle) :</label>
                <input
                  type="password"
                  placeholder="AIzaSy... (laisser vide pour utiliser la clé serveur)"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Si non renseignée, le serveur utilise automatiquement sa propre variable d'environnement <code className="text-emerald-400 font-mono">GEMINI_API_KEY</code>.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={isTestingGemini}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{isTestingGemini ? 'Test en cours...' : 'Tester la connexion Gemini'}</span>
                </button>
              </div>

              {geminiTestResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                    geminiTestResult.ok
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                  }`}
                >
                  {geminiTestResult.ok ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{geminiTestResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Groq Configuration Section */}
          {provider === 'groq' && (
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                  <Key className="w-4 h-4" />
                  <span>Configuration Groq Cloud</span>
                </div>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-amber-400/80 hover:text-amber-300 underline flex items-center gap-1"
                >
                  <span>Obtenir une clé gratuite</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Clé API Groq :</label>
                <input
                  type="password"
                  placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={groqKey}
                  onChange={e => setGroqKey(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Modèle d'IA Groq :</label>
                <select
                  value={groqModel}
                  onChange={e => setGroqModel(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="openai/gpt-oss-120b">
                    openai/gpt-oss-120b (OpenAI GPT-OSS 120B - Très puissant & Grand modèle)
                  </option>
                  <option value="openai/gpt-oss-20b">
                    openai/gpt-oss-20b (OpenAI GPT-OSS 20B - Équilibré & Rapide)
                  </option>
                </select>
              </div>

              {/* Test Groq Connection Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestGroq}
                  disabled={isTestingGroq}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTestingGroq ? 'animate-spin' : ''}`} />
                  <span>{isTestingGroq ? 'Test en cours...' : 'Tester la connexion & le modèle'}</span>
                </button>

                {/* Test feedback */}
                {testResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-2 ${
                      testResult.ok
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {testResult.ok ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{testResult.ok ? 'Succès' : 'Échec du test'}</p>
                      <p className="opacity-90">{testResult.message}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OpenRouter Configuration Section */}
          {provider === 'openrouter' && (
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs">
                  <Key className="w-4 h-4" />
                  <span>Configuration OpenRouter</span>
                </div>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-purple-400/80 hover:text-purple-300 underline flex items-center gap-1"
                >
                  <span>Obtenir une clé</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Clé API OpenRouter (Optionnelle) :</label>
                <input
                  type="password"
                  placeholder="sk-or-v1-... (laisser vide pour utiliser la clé serveur)"
                  value={openrouterKey}
                  onChange={e => setOpenrouterKey(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Si non renseignée, le serveur utilise automatiquement sa variable d'environnement <code className="text-purple-400 font-mono">OPENROUTER_API_KEY</code>.
                </p>
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Modèle OpenRouter (:free obligatoire) :</label>
                <select
                  value={openrouterModel}
                  onChange={e => setOpenrouterModel(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                >
                  <option value="meta-llama/llama-3.3-70b-instruct:free">
                    meta-llama/llama-3.3-70b-instruct:free (Recommandé - Llama 3.3 70B Instruct)
                  </option>
                  <option value="qwen/qwen3-coder:free">
                    qwen/qwen3-coder:free (Qwen 3 Coder - Code & Raisonnement)
                  </option>
                  <option value="deepseek/deepseek-r1:free">
                    deepseek/deepseek-r1:free (DeepSeek R1 - Raisonnement avancé)
                  </option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Note : le modèle GPT-OSS 120B est réservé au provider Groq et n'est pas disponible ici.
                </p>
              </div>

              {/* Test OpenRouter Connection Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestOpenRouter}
                  disabled={isTestingOpenRouter}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTestingOpenRouter ? 'animate-spin' : ''}`} />
                  <span>{isTestingOpenRouter ? 'Test en cours...' : 'Tester la connexion OpenRouter'}</span>
                </button>

                {/* Test feedback */}
                {openrouterTestResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-2 ${
                      openrouterTestResult.ok
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {openrouterTestResult.ok ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{openrouterTestResult.ok ? 'Succès' : 'Échec du test'}</p>
                      <p className="opacity-90">{openrouterTestResult.message}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auto-learning toggle */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Apprentissage Automatique</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Lorsque l’IA répond, KADERBOT extrait automatiquement le sujet principal et enrichit son graphe de mémoire local avec un score de confiance adaptatif.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoLearn}
              onChange={e => setAutoLearn(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
            />
          </div>

          {/* Voice Speech toggle */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>Synthèse Vocale (Voix française)</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Lit à voix haute les réponses et déductions logiques de KADERBOT.
              </p>
            </div>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={e => setSoundEnabled(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
          </div>

          {/* System Prompt Customization */}
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              Instruction Système (Personnalité de KADERBOT)
            </label>
            <textarea
              rows={3}
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              className="w-full bg-[#090B10] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Définit le ton concis, chaleureux et curieux du bot tel qu'il a été programmé dans Pydroid 3.
            </p>
          </div>

          {/* Synchronisation Mémoire Hybride (Locale + Serveur) */}
          {(onPushMemoryToServer || onPullMemoryFromServer) && (
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#0B1528] to-[#080D18] border border-blue-500/30 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Server className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold">Mémoire Hybride (Serveur & Local)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800/40 text-blue-300 ml-auto">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                L'application utilise votre mémoire locale en priorité. Utilisez ces commandes pour synchroniser manuellement avec la base centrale du serveur.
              </p>

              {modalSyncStatus && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    modalSyncStatus.success
                      ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/50 border border-red-500/40 text-red-300'
                  }`}
                >
                  <span>{modalSyncStatus.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!onPushMemoryToServer) return;
                    setIsModalPushing(true);
                    setModalSyncStatus(null);
                    setShowModalPullConfirm(false);
                    try {
                      const res = await onPushMemoryToServer();
                      setModalSyncStatus(res);
                    } catch (e: any) {
                      setModalSyncStatus({ success: false, message: e.message || 'Erreur inconnue' });
                    } finally {
                      setIsModalPushing(false);
                    }
                  }}
                  disabled={isModalPushing || isModalPulling}
                  className="py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-blue-950/40"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{isModalPushing ? 'Envoi...' : 'Envoyer ma mémoire au serveur'}</span>
                </button>

                {showModalPullConfirm ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        setShowModalPullConfirm(false);
                        if (!onPullMemoryFromServer) return;
                        setIsModalPulling(true);
                        setModalSyncStatus(null);
                        try {
                          const res = await onPullMemoryFromServer();
                          setModalSyncStatus(res);
                        } catch (e: any) {
                          setModalSyncStatus({ success: false, message: e.message || 'Erreur inconnue' });
                        } finally {
                          setIsModalPulling(false);
                        }
                      }}
                      disabled={isModalPulling}
                      className="flex-1 py-2 px-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition"
                    >
                      Confirmer écrasement
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModalPullConfirm(false)}
                      className="py-2 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] transition"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowModalPullConfirm(true)}
                    disabled={isModalPushing || isModalPulling}
                    className="py-2.5 px-3 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/40 disabled:opacity-40 text-teal-200 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <CloudDownload className="w-3.5 h-3.5 text-teal-400" />
                    <span>{isModalPulling ? 'Chargement...' : 'Récupérer la mémoire du serveur'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800/80 bg-[#090B10] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium"
          >
            Fermer
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 ${
              savedSuccess
                ? 'bg-emerald-600'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-900/30'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Enregistré !</span>
              </>
            ) : (
              <span>Sauvegarder</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

<a id="srccomponentsActionMenuModaltsx"></a>
## Fichier : `src/components/ActionMenuModal.tsx`

> **Description** : Menu d'actions rapides et interactions

```tsx
import React, { useState } from 'react';
import {
  X,
  Database,
  GitBranch,
  Sparkles,
  Lightbulb,
  Languages,
  HelpCircle,
  FolderTree,
  Trash2,
  List,
  Search,
} from 'lucide-react';

interface ActionMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (cmd: string, executeImmediately?: boolean) => void;
}

export const ActionMenuModal: React.FC<ActionMenuModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('memoire');
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const categories = [
    { id: 'memoire', label: 'Mémoire', icon: Database, color: 'text-emerald-400' },
    { id: 'liens', label: 'Liens & Arbre', icon: GitBranch, color: 'text-cyan-400' },
    { id: 'groq', label: 'IA & LLM', icon: Sparkles, color: 'text-amber-400' },
    { id: 'idees', label: 'Idées', icon: Lightbulb, color: 'text-yellow-400' },
    { id: 'texte', label: 'Traduction & Texte', icon: Languages, color: 'text-purple-400' },
    { id: 'questions', label: 'Questions & Déduction', icon: HelpCircle, color: 'text-blue-400' },
    { id: 'sessions', label: 'Sessions', icon: FolderTree, color: 'text-teal-400' },
    { id: 'oubli', label: 'Oubli Intelligent', icon: Trash2, color: 'text-rose-400' },
    { id: 'divers', label: 'Divers & Stats', icon: List, color: 'text-gray-400' },
  ];

  const actionsMap: Record<
    string,
    Array<{ cmd: string; label: string; desc: string; immediate?: boolean }>
  > = {
    memoire: [
      { cmd: 'retiens: ', label: 'Retenir un fait', desc: 'Syntaxe: retiens: chat = un animal felin' },
      { cmd: 'retiens: tous les ', label: 'Règle universelle', desc: 'Syntaxe: retiens: tous les oiseaux volent' },
      { cmd: 'retiens: aucun ', label: 'Règle négative', desc: 'Syntaxe: retiens: aucun poisson ne respire dans lair' },
      { cmd: 'retiens: certains ', label: 'Règle particulière', desc: 'Syntaxe: retiens: certains chiens chassent' },
      { cmd: 'retiens masse: ', label: 'Retenir en masse', desc: 'Plusieurs faits séparés par des points' },
      { cmd: 'lister: memoire', label: 'Lister la mémoire', desc: 'Affiche tous les sujets mémorisés', immediate: true },
      { cmd: 'lister: poids', label: 'Lister les poids', desc: 'Affiche les coefficients de confiance', immediate: true },
      { cmd: 'lister: incertains', label: 'Concepts incertains', desc: 'Concepts avec confiance < 50%', immediate: true },
      { cmd: 'lister: regles', label: 'Lister les règles', desc: 'Affiche toutes les règles logiques', immediate: true },
    ],
    liens: [
      { cmd: 'lie: ', label: 'Lier deux concepts', desc: 'Syntaxe: lie: moineau -> oiseau' },
      { cmd: 'delie: ', label: 'Supprimer un lien', desc: 'Syntaxe: delie: moineau -> oiseau' },
      { cmd: 'liens: ', label: 'Inspecter les liens', desc: 'Affiche parents, enfants et chaîne' },
      { cmd: 'cousins: ', label: 'Ancêtres communs', desc: 'Syntaxe: cousins: moineau, aigle' },
    ],
    groq: [
      { cmd: 'groq: ', label: 'Interroger LLM direct', desc: 'Pose une question directe au modèle' },
      { cmd: 'groq on', label: 'Activer LLM Cloud', desc: 'Autorise les réponses étendues', immediate: true },
      { cmd: 'groq off', label: 'Désactiver LLM', desc: 'Mode cognitif 100% local', immediate: true },
      { cmd: 'groq statut', label: 'Statut du LLM', desc: 'Vérifie l’état de connexion', immediate: true },
      { cmd: 'contexte', label: 'Afficher contexte', desc: 'Affiche l’historique glissant', immediate: true },
      { cmd: 'reset contexte', label: 'Vider le contexte', desc: 'Réinitialise le fil de mémoire', immediate: true },
      { cmd: 'lister: groq', label: 'Logs des échanges', desc: 'Derniers apprentissages du LLM', immediate: true },
    ],
    idees: [
      { cmd: 'idees 5: ', label: '5 Idées créatives', desc: 'Génère 5 idées percutantes' },
      { cmd: 'idees 5 drole: ', label: '5 Idées drôles', desc: 'Idées humoristiques et décalées' },
      { cmd: 'idees 5 poetique: ', label: '5 Idées poétiques', desc: 'Idées imagées et sensibles' },
      { cmd: 'idees 5 absurde: ', label: '5 Idées absurdes', desc: 'Idées inattendues et loufoques' },
      { cmd: 'idee 1: ', label: 'Développer une idée', desc: 'Développe l’idée n°1 en détail' },
      { cmd: 'lister: idees', label: 'Historique des idées', desc: 'Affiche le fichier des idées générées', immediate: true },
    ],
    texte: [
      { cmd: 'traduis en anglais: ', label: 'Traduire en anglais', desc: 'Traduction automatique' },
      { cmd: 'traduis en arabe: ', label: 'Traduire en arabe', desc: 'Traduction automatique' },
      { cmd: 'traduis en espagnol: ', label: 'Traduire en espagnol', desc: 'Traduction automatique' },
      { cmd: 'corrige: ', label: 'Corriger un texte', desc: 'Orthographe, grammaire et ponctuation' },
      { cmd: 'resume: ', label: 'Résumer un texte', desc: 'Synthèse en 2-3 phrases' },
    ],
    questions: [
      { cmd: "c'est quoi ", label: "Qu'est-ce que c'est ?", desc: 'Définition exacte ou déduite' },
      { cmd: 'pourquoi ', label: 'Pourquoi ? (Déduction)', desc: 'Recherche la chaîne causale logique' },
      { cmd: 'parle-moi de ', label: 'Explication complète', desc: 'Tout ce que le bot sait du sujet' },
      { cmd: 'proche: ', label: 'Recherche floue', desc: 'Trouve les mots proches phonétiquement' },
      { cmd: 'chercher: ', label: 'Chercher dans la mémoire', desc: 'Recherche par mot-clé' },
    ],
    sessions: [
      { cmd: 'session active', label: 'Session courante', desc: 'Affiche la session active', immediate: true },
      { cmd: 'sessions', label: 'Toutes les sessions', desc: 'Liste les profils disponibles', immediate: true },
      { cmd: 'session defaut', label: 'Session défaut', desc: 'Recharge la base principale', immediate: true },
      { cmd: 'session ', label: 'Créer / Charger', desc: 'Syntaxe: session science' },
    ],
    oubli: [
      { cmd: 'oublier: ', label: 'Oublier un fait/sujet', desc: 'Syntaxe: oublier: sujet ou oublier: sujet = def' },
      { cmd: 'oublier en masse: ', label: 'Oublier plusieurs', desc: 'Séparer par des virgules ou points' },
    ],
    divers: [
      { cmd: 'lister: stats', label: 'Statistiques globales', desc: 'Mots, règles, graphe, mémoire', immediate: true },
      { cmd: 'synonymes: ', label: 'Gérer les synonymes', desc: 'Syntaxe: synonymes: auto = voiture | bagnole' },
      { cmd: 'lire: conversations', label: 'Lire les logs lisibles', desc: 'Derniers échanges de la conversation', immediate: true },
      { cmd: 'effacer conversations', label: 'Purger les logs', desc: 'Réinitialise le fichier lisible', immediate: true },
    ],
  };

  const handleActionClick = (cmd: string, immediate?: boolean) => {
    onSelectAction(cmd, immediate);
    onClose();
  };

  const currentActions = actionsMap[activeCategory] || [];
  const filteredActions = searchFilter
    ? Object.values(actionsMap)
        .flat()
        .filter(
          a =>
            a.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
            a.cmd.toLowerCase().includes(searchFilter.toLowerCase()) ||
            a.desc.toLowerCase().includes(searchFilter.toLowerCase())
        )
    : currentActions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0E131F] border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800/80 bg-[#090B10]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Menu des Commandes KADERBOT</h2>
              <p className="text-[11px] text-gray-400">Toutes les actions du script Python d’origine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-3 border-b border-gray-800/60 bg-gray-900/50">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrer une commande ou une action (ex: retiens, liens, groq...)"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full bg-[#090B10] border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Content body with sidebar categories */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar categories (hidden if searching) */}
          {!searchFilter && (
            <div className="w-44 sm:w-48 border-r border-gray-800/60 overflow-y-auto p-2 space-y-1 bg-[#090B10]/60 flex-shrink-0">
              {categories.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                      isActive
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${cat.color}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons list */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2">
            {filteredActions.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">
                Aucune commande ne correspond à votre recherche.
              </div>
            ) : (
              filteredActions.map((action, idx) => (
                <div
                  key={idx}
                  onClick={() => handleActionClick(action.cmd, action.immediate)}
                  className="group p-3 rounded-xl bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/80 hover:border-emerald-500/40 cursor-pointer transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        {action.cmd}
                      </code>
                      <span className="text-xs font-semibold text-white truncate">{action.label}</span>
                      {action.immediate && (
                        <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.5 rounded font-mono">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 truncate">{action.desc}</p>
                  </div>
                  <span className="text-xs font-medium text-emerald-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    Insérer →
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-gray-800/80 bg-[#090B10] flex items-center justify-between text-[11px] text-gray-400">
          <span>Clique sur une action pour l’insérer instantanément dans la barre de saisie.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

<a id="indexhtml"></a>
## Fichier : `index.html`

> **Description** : Point d'entrée HTML et métadonnées PWA/SEO

```html
<!doctype html>
<html lang="fr" class="dark h-full w-full overflow-hidden">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>KADERBOT NOVA - Système Cognitif & IA</title>
    <meta name="description" content="Assistant cognitif hybride KADERBOT avec moteur d'apprentissage autonome, graphe de connaissances, déduction logique et intégration IA." />
    <meta property="og:title" content="KADERBOT NOVA - Système Cognitif & IA" />
    <meta property="og:description" content="Assistant cognitif hybride KADERBOT avec moteur d'apprentissage autonome, graphe de connaissances, déduction logique et intégration IA." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#0a0a0f" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="KADERBOT" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  </head>
  <body class="bg-[#050508] text-gray-100 antialiased selection:bg-[#10A37F]/30 selection:text-emerald-300 fixed inset-0 w-full h-full overflow-hidden">
    <div id="root" class="w-full h-full overflow-hidden"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

