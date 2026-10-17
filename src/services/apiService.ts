import { MemoryStore, RulesStore, LinksStore, SynonymsStore } from '../types/kaderbot';

export interface ChatApiParams {
  prompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  provider: 'gemini' | 'groq' | 'local_only';
  groqApiKey?: string;
  groqModel?: string;
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
    const res = await fetch('/api/chat', {
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

  async testGroqConnection(
    apiKey: string,
    model = 'openai/gpt-oss-120b'
  ): Promise<{ ok: boolean; model?: string; latencyMs?: number; error?: string; reply?: string }> {
    const res = await fetch('/api/groq/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model }),
    });

    return await res.json();
  },

  async genererIdees(params: {
    theme: string;
    count: number;
    style: string;
    styleDesc?: string;
    provider: string;
    groqApiKey?: string;
    groqModel?: string;
  }): Promise<string> {
    const res = await fetch('/api/idees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
    groqApiKey?: string;
    groqModel?: string;
  }): Promise<string> {
    const res = await fetch('/api/traduis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
    groqApiKey?: string;
    groqModel?: string;
  }): Promise<string> {
    const res = await fetch('/api/corrige', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
    groqApiKey?: string;
    groqModel?: string;
  }): Promise<string> {
    const res = await fetch('/api/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
};
