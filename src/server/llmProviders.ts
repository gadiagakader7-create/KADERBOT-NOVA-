import { GoogleGenAI } from '@google/genai';

export const DEFAULT_SYSTEM_PROMPT =
  'Tu es KADERBOT NOVA, un assistant IA expert et pédagogue. Tu réponds toujours en français.\n' +
  'RÈGLES DE FORMATAGE : Structure tes réponses avec du Markdown propre (sauts de ligne, listes à puces, gras). Si tu génères un tableau, utilise la syntaxe standard GitHub Markdown (| Col 1 | Col 2 | suivi de |---|---|) en laissant une ligne vide avant et après le tableau.\n' +
  'RÈGLE DE LONGUEUR ABSOLUE : Ta réponse ne doit jamais dépasser 120 mots. Sois direct et synthétique. Si un sujet est vaste (comme l\'histoire d\'une invention), donne uniquement les 2 ou 3 points les plus importants, et termine en proposant à l\'utilisateur de préciser sa question pour plus de détails. Ne fais JAMAIS de réponse de plus de 4 paragraphes.';

// Helper pour instancier GoogleGenAI avec clé explicite (évite les recherches ADC / Cloud GCP)
export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper pour normaliser et résoudre les identifiants de modèles Groq (Catalogue Octobre 2026)
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

// Appel Groq avec cascade de repli entre candidats (120b → 20b)
export async function callGroqWithFallback(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  requestedModel = 'openai/gpt-oss-120b',
  history: Array<{ role: string; content: string }> = []
): Promise<{ text: string; actualModel: string }> {
  const primaryModel = resolveGroqModel(requestedModel);

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
        const msg = data.choices?.[0]?.message;
        const content = (msg?.content || '').trim() || (msg?.reasoning || '').trim();
        if (content) {
          return { text: content, actualModel: modelToTry };
        }
        console.warn(`[GROQ] Modèle "${modelToTry}" a renvoyé un contenu vide, tentative avec le modèle suivant...`);
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

// Normalisation des modèles OpenRouter
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

// Appel OpenRouter avec cascade de modèles gratuits
export async function callOpenRouterWithFallback(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  requestedModel = 'meta-llama/llama-3.3-70b-instruct:free',
  history: Array<{ role: string; content: string }> = []
): Promise<{ text: string; actualModel: string }> {
  const primaryModel = resolveOpenRouterModel(requestedModel);

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

      if (response.status === 429 || response.status === 401) {
        throw new Error('OpenRouter: quota épuisé ou clé invalide');
      }

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

// Appel Gemini avec SDK officiel et fallback REST direct (clé d'API explicite)
export async function callGeminiWithFallback(
  fullPrompt: string,
  systemInstruction?: string
): Promise<{ text: string; model: string }> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    throw new Error('Variable GEMINI_API_KEY non configurée sur le serveur. Veuillez définir votre clé API Gemini.');
  }

  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  // 1. Essai avec le client GoogleGenAI
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

  // 2. Fallback REST direct
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
