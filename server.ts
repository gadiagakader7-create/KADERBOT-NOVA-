import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AGENT_TOOLS, TOOL_POLICIES } from './src/agent/toolRegistry';
import { createToolImplementations } from './src/agent/toolImplementations';
import { createPendingAction, validateToolArguments } from './src/agent/toolSecurity';
import { runAgentLoop } from './src/agent/modelRouter';
import { classifyIntentWithRouter } from './src/agent/intentClassifier';
import { registerHttpRoutes } from './src/server/httpRoutes';
import {
  callGeminiWithFallback,
  callGroqWithFallback,
  callOpenRouterWithFallback,
  resolveGroqModel,
  resolveOpenRouterModel,
  DEFAULT_SYSTEM_PROMPT,
} from './src/server/llmProviders';
import {
  MEMORY_FILE,
  NOTES_FILE,
  ACTION_LOG_FILE,
  EVENTS_FILE,
  PROJECT_ROOT,
  readStorageFile,
  writeStorageFile,
  readJsonArray,
  writeJsonArray,
  appendActionLog,
} from './src/server/storage';
import { executeBraveSearch, isUrlForbidden } from './src/server/webSearch';
import { createAgentRateLimiter, createRequireAdmin } from './src/server/middleware';
import type { PendingAgentAction } from './src/types/agent';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// === 1. CONFIGURATION & SÉCURITÉ ===
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
const TELEGRAM_ALLOWED_CHAT_IDS = new Set(
  (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);
const MAX_AGENT_ITERATIONS = 25;
const PENDING_ACTION_TTL_MS = 5 * 60 * 1000;

const pendingAgentActions = new Map<string, PendingAgentAction>();
const checkAgentRateLimit = createAgentRateLimiter(60 * 1000, 10);
const requireAdmin = createRequireAdmin(() => process.env.ADMIN_TOKEN?.trim() || '');

function requestPendingAction(tool: string, args: Record<string, unknown>): PendingAgentAction {
  return createPendingAction(tool, args, { ttlMs: PENDING_ACTION_TTL_MS, store: pendingAgentActions });
}

// === 2. IMPLÉMENTATION DES OUTILS AGENTIQUES ===
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

// === 3. BOUCLE AGENTIQUE & CASCSADE ===
const AGENT_SYSTEM_PROMPT =
  'Tu es KADERBOT NOVA, un agent cognitif d’élite doté d’outils de mémoire, de recherche et d’analyse.\n' +
  'RÈGLES CRUCIALES DE COMPORTEMENT :\n' +
  '(1) Vérifie TOUJOURS memo_lookup avant search_web si la question porte sur une information personnelle, un fait appris, une préférence (ex: "Quels fruits j’aime ?") ou une notion locale.\n' +
  '(2) Recherche sur le web via search_news ou search_web pour tout événement récent ou question factuelle externe.\n' +
  '(3) Si open_url renvoie une erreur (403, accès protégé, anti-bot ou timeout), ignore immédiatement cette source et passe aux autres sources ou résumés sans bloquer.\n' +
  '(4) FORMULATION DE LA RÉPONSE FINALE : Après tout appel d’outil (ex: memo_lookup, memo_store, search_web), formule TOUJOURS une vraie réponse textuelle rédigée, naturelle et soignée à l’attention de l’utilisateur :\n' +
  '    - Si memo_lookup trouve des éléments, énonce-les clairement et chaleureusement (ex: "D’après mes informations en mémoire, tu aimes...").\n' +
  '    - Si tu as exécuté une tâche (ex: memo_store, create_note), confirme-le avec enthousiasme et précision (ex: "C’est noté ! J’ai bien enregistré que...").\n' +
  '    - Ne termine JAMAIS un tour par un message vide ou silencieux.\n' +
  '(5) GESTION ÉLÉGANTE DES CONFIRMATIONS (STYLE CONVERSATIONNEL) :\n' +
  '    - N’affiche JAMAIS de formulaires ou de boutons rigides. Si tu souhaites proposer une mémorisation, une note ou un envoi, demande-le avec courtoisie et élégance directement dans ton message (ex: "Veux-tu que j’enregistre cela dans ma mémoire ?" ou "Si tu le souhaites, je peux créer une note pour toi."). \n' +
  '    - Dès que l’utilisateur donne son accord ("oui", "retiens", "enregistre", "fais-le"), exécute l’outil immédiatement sans redemander.\n' +
  '(6) Pour créer une note, utilise create_note ; pour chercher une note, utilise search_notes.\n' +
  '(7) Si l’utilisateur demande "Continue" ou "continuer", synthétise directement les informations déjà réunies pour produire la réponse finale.\n' +
  '(8) Réponds toujours en français structuré avec du Markdown propre (gras, listes à puces, sauts de ligne clairs).';

const reactLoopDeps = {
  agentTools: AGENT_TOOLS,
  toolPolicies: TOOL_POLICIES,
  toolImplementations: TOOL_IMPLEMENTATIONS,
  validateToolArguments,
  requestPendingAction,
  defaultSystemPrompt: AGENT_SYSTEM_PROMPT,
  maxAgentIterations: MAX_AGENT_ITERATIONS,
  maxLoopDurationMs: 90000,
};

const modelRouterDeps = {
  groqApiKey: process.env.GROQ_API_KEY,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  defaultSystemPrompt: AGENT_SYSTEM_PROMPT,
  reactLoopDeps,
  callGeminiWithFallback,
};

// === 4. ENREGISTREMENT DES ROUTES HTTP API ===
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
  projectRoot: PROJECT_ROOT,
  readStorageFile,
  readJsonArray,
  appendActionLog,
  pendingAgentActions,
  toolImplementations: TOOL_IMPLEMENTATIONS,
  validateToolArguments,
});

// === 5. SERVEUR DEV VITE / PRODUCTION ===
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
