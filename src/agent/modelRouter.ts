import { runToolLoopWithModel } from './reactLoop';
import type { ReactLoopDeps } from './reactLoop';

export interface ModelRouterDeps {
  groqApiKey?: string;
  openRouterApiKey?: string;
  defaultSystemPrompt: string;
  reactLoopDeps: ReactLoopDeps;
  callGeminiWithFallback: (prompt: string, systemPrompt?: string) => Promise<{ text: string; model: string }>;
}

/** Cascade des modèles utilisée par l’agent : Groq → Gemini → OpenRouter. */
export async function runAgentLoop(
  userPrompt: string,
  history: Array<{ role: string; content: string }> = [],
  deps: ModelRouterDeps,
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
  const groqApiKey = deps.groqApiKey?.trim();
  const openRouterApiKey = deps.openRouterApiKey?.trim();

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
        deps.reactLoopDeps,
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
        deps.reactLoopDeps,
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
    const fullPrompt = `${systemPrompt || deps.defaultSystemPrompt}\n\nHistorique récent:\n${formattedHistory}\n\nUtilisateur: ${userPrompt}\nKADERBOT:`;

    const geminiRes = await deps.callGeminiWithFallback(fullPrompt, systemPrompt || deps.defaultSystemPrompt);
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
        deps.reactLoopDeps,
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
