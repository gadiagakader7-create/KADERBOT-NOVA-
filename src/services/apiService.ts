import { MemoryStore, RulesStore, LinksStore, SynonymsStore } from '../types/kaderbot';

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
    const res = await fetch('/api/memory');
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch('/api/memory/refresh');
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
  toolTrace: Array<{ tool: string; args?: any }>;
  awaitingUser?: boolean;
  question?: string;
  isFallback?: boolean;
  fallbackReason?: string;
  routedTo?: 'chat' | 'agent';
}

export async function sendAgentMessage(
  prompt: string,
  history: Array<{ role: string; content: string }> = []
): Promise<AgentApiResponse> {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, history }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
    throw new Error(err.error || `Erreur serveur (${res.status})`);
  }

  return await res.json();
}

