import path from 'path';
import fs from 'fs';
import type { Express, RequestHandler } from 'express';
import type { PendingAgentAction } from '../types/agent';
import type { ModelRouterDeps } from '../agent/modelRouter';

type AgentActionLog = Record<string, unknown>;
type KaderbotEvent = Record<string, unknown>;
type KaderbotNote = Record<string, unknown>;

export interface HttpRouteDependencies {
  callGeminiWithFallback: (...args: any[]) => Promise<{ text: string; model: string }>;
  callGroqWithFallback: (...args: any[]) => Promise<{ text: string; actualModel: string }>;
  callOpenRouterWithFallback: (...args: any[]) => Promise<{ text: string; actualModel: string }>;
  resolveGroqModel: (model: string) => string;
  resolveOpenRouterModel: (model: string) => string;
  defaultSystemPrompt: string;
  agentSystemPrompt: string;
  requireAdmin: RequestHandler;
  checkAgentRateLimit: (req: any) => boolean;
  classifyIntentWithRouter: (...args: any[]) => Promise<'CHAT' | 'AGENT'>;
  runAgentLoop: (...args: any[]) => Promise<any>;
  modelRouterDeps: ModelRouterDeps;
  memoryFile: string;
  notesFile: string;
  actionLogFile: string;
  eventsFile: string;
  projectRoot: string;
  readStorageFile: () => any;
  readJsonArray: <T>(file: string) => T[];
  appendActionLog: (...args: any[]) => void;
  pendingAgentActions: Map<string, PendingAgentAction>;
  toolImplementations: Record<string, (args: any) => Promise<string>>;
  validateToolArguments: (tool: string, args: Record<string, unknown>) => string | null;
}

export function registerHttpRoutes(app: Express, deps: HttpRouteDependencies): void {
  const {
    callGeminiWithFallback,
    callGroqWithFallback,
    callOpenRouterWithFallback,
    resolveGroqModel,
    resolveOpenRouterModel,
    defaultSystemPrompt,
    agentSystemPrompt,
    requireAdmin,
    checkAgentRateLimit,
    classifyIntentWithRouter,
    runAgentLoop,
    modelRouterDeps,
    memoryFile,
    notesFile,
    actionLogFile,
    eventsFile,
    projectRoot,
    readStorageFile,
    readJsonArray,
    appendActionLog,
    pendingAgentActions,
    toolImplementations,
    validateToolArguments,
  } = deps;

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
      systemPrompt = defaultSystemPrompt,
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
    if (fs.existsSync(memoryFile)) {
      const data = JSON.parse(fs.readFileSync(memoryFile, 'utf-8'));
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
      memoryFile,
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
  return res.json({ notes: readJsonArray<KaderbotNote>(notesFile) });
});

app.get('/api/agent/logs', requireAdmin, (_req, res) => {
  return res.json({ logs: readJsonArray<AgentActionLog>(actionLogFile).slice(-200).reverse() });
});

app.get('/api/calendar/events', requireAdmin, (_req, res) => {
  return res.json({ events: readJsonArray<KaderbotEvent>(eventsFile).slice(-500).reverse() });
});

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
            systemPrompt || agentSystemPrompt,
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
        const fullPrompt = `${systemPrompt || agentSystemPrompt}\n\nHistorique récent:\n${formattedHistory}\n\nUtilisateur: ${prompt}\nKADERBOT:`;
        const geminiRes = await callGeminiWithFallback(fullPrompt, systemPrompt || agentSystemPrompt);
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
    const agentResult = await runAgentLoop(prompt, history, modelRouterDeps, systemPrompt);
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
    const handler = toolImplementations[action.tool];
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
    const zipPath = path.resolve(projectRoot, '.aistudio/artifacts/brain/1e85614a-1a36-40c9-9d9d-04bf0651ef2e/kaderbot_projet_complet.zip');
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


}
