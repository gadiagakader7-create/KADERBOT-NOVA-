import { MemoryStore, RulesStore, LinksStore, SynonymsStore, ToolExecutionTrace, PendingAgentAction } from '../types/kaderbot';

let activeAdminSessionId: string | null = null;

type AdminSessionInvalidatedListener = () => void;
const sessionInvalidatedListeners = new Set<AdminSessionInvalidatedListener>();

export class AdminSessionError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AdminSessionError';
    this.status = status;
    this.code = code;
  }
}

function getStoredAdminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem('kaderbot_config');
    const config = raw ? JSON.parse(raw) : null;
    return typeof config?.adminToken === 'string' ? config.adminToken.trim() : '';
  } catch {
    return '';
  }
}

export function getAdminHeaders(tokenOverride?: string, sessionOverride?: string | null): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const headers: Record<string, string> = {};
  const token = tokenOverride !== undefined ? tokenOverride.trim() : getStoredAdminToken();
  const sessionId = sessionOverride !== undefined ? sessionOverride : activeAdminSessionId;
  if (token) {
    headers['X-Admin-Token'] = token;
  }
  if (sessionId) {
    headers['X-Admin-Session'] = sessionId;
  }
  return headers;
}

export function activateAdminSession(sessionId: string): void {
  activeAdminSessionId = sessionId.trim() || null;
}

export function clearAdminSession(): void {
  activeAdminSessionId = null;
}

export function hasAdminSession(): boolean {
  return Boolean(activeAdminSessionId);
}

export function onAdminSessionInvalidated(listener: AdminSessionInvalidatedListener): () => void {
  sessionInvalidatedListeners.add(listener);
  return () => {
    sessionInvalidatedListeners.delete(listener);
  };
}

function notifySessionInvalidated(): void {
  activeAdminSessionId = null;
  for (const listener of sessionInvalidatedListeners) {
    try {
      listener();
    } catch {}
  }
}

async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const mergedHeaders: Record<string, string> = {
    ...(init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Array.isArray(init.headers)
      ? Object.fromEntries(init.headers)
      : (init.headers as Record<string, string> | undefined)),
    ...getAdminHeaders(),
  };

  const res = await fetch(input, {
    ...init,
    headers: mergedHeaders,
  });

  if (res.status === 401 || res.status === 403 || res.status === 503) {
    const errBody = await res.clone().json().catch(() => ({}));
    notifySessionInvalidated();
    throw new AdminSessionError(
      errBody?.error || 'Session administrateur invalide ou expirée.',
      res.status,
      typeof errBody?.code === 'string' ? errBody.code : undefined
    );
  }

  return res;
}

export interface AdminLoginResult {
  ok: boolean;
  status: number;
  sessionId?: string;
  code?: string;
  error?: string;
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
  async loginAdminSession(params: { keyword: string; token?: string }): Promise<AdminLoginResult> {
    const effectiveToken = (params.token !== undefined ? params.token : getStoredAdminToken()).trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (effectiveToken) {
      headers['X-Admin-Token'] = effectiveToken;
    }

    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ keyword: params.keyword }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && typeof data?.sessionId === 'string' && data.sessionId.trim()) {
        return {
          ok: true,
          status: res.status,
          sessionId: data.sessionId.trim(),
        };
      }

      return {
        ok: false,
        status: res.status,
        code: typeof data?.code === 'string' ? data.code : undefined,
        error: typeof data?.error === 'string' ? data.error : `Erreur HTTP ${res.status}`,
      };
    } catch {
      return {
        ok: false,
        status: 0,
        code: 'NETWORK_ERROR',
        error: 'Connexion au serveur impossible.',
      };
    }
  },

  async logoutAdminSession(sessionIdOverride?: string | null, tokenOverride?: string): Promise<void> {
    const sid = sessionIdOverride !== undefined ? sessionIdOverride : activeAdminSessionId;
    activeAdminSessionId = null;
    if (!sid) return;

    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders(tokenOverride, sid),
        },
        body: JSON.stringify({ sessionId: sid }),
      });
    } catch {}
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
    const res = await adminFetch('/api/memory');
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
    const res = await adminFetch('/api/memory/save', {
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
    const res = await adminFetch('/api/export-pydroid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erreur téléchargement script Pydroid 3');
    return await res.blob();
  },

  async downloadProjectZip(): Promise<Blob> {
    const res = await adminFetch('/api/export-project-zip', {
      method: 'GET',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
      throw new Error(err.error || 'Erreur lors du téléchargement du projet ZIP');
    }
    const blob = await res.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Archive ZIP vide reçue du serveur.');
    }
    return blob;
  },

  async sendAgentMessage(
    prompt: string,
    history: Array<{ role: string; content: string }> = [],
    isAdmin = false
  ): Promise<AgentApiResponse> {
    return sendAgentMessage(prompt, history, isAdmin);
  },

  async callAgent(params: {
    prompt: string;
    history?: Array<{ role: string; content: string }>;
    systemPrompt?: string;
    isAdmin?: boolean;
  }): Promise<AgentApiResponse> {
    const useAdmin = Boolean(params.isAdmin);
    const res = useAdmin
      ? await adminFetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, isAdmin: true }),
        })
      : await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, isAdmin: false }),
        });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
      throw new Error(err.error || `Erreur serveur (${res.status})`);
    }
    return await res.json();
  },

  async refreshMemory(): Promise<{ ok: boolean; data: any; refreshedAt: string }> {
    const res = await adminFetch('/api/memory/refresh');
    if (!res.ok) throw new Error('Impossible de rafraîchir la mémoire');
    return await res.json();
  },

  async getAdminWorkspace(): Promise<{
    generated: Array<{ path: string; content: string; size: number; updatedAt: string }>;
    patches: any[];
    tests: any[];
  }> {
    const res = await adminFetch('/api/admin/workspace');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }
    return await res.json();
  },

  async saveAdminWorkspaceFile(filePath: string, content: string): Promise<{ ok: boolean; file: { path: string } }> {
    const res = await adminFetch('/api/admin/workspace/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur enregistrement script.');
    return data;
  },

  async deleteAdminWorkspaceFile(filePath: string): Promise<void> {
    const res = await adminFetch('/api/admin/workspace/file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur suppression.');
    }
  },

  async logAdminWorkspaceTest(payload: Record<string, unknown>): Promise<void> {
    const res = await adminFetch('/api/admin/workspace/test-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur enregistrement du test.');
    }
  },

  async executeAdminCode(payload: {
    language: 'python' | 'javascript';
    code: string;
    isTest?: boolean;
    label?: string;
  }): Promise<{ success: boolean; durationMs: number; stdout?: string; stderr?: string; error?: string }> {
    const res = await adminFetch('/api/admin/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Erreur exécution sandbox.');
    return result;
  },

  async getAdminSourceFile(targetPath: string): Promise<{ path: string; content: string }> {
    const res = await adminFetch(`/api/admin/source-file?path=${encodeURIComponent(targetPath)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lecture impossible.');
    return data;
  },

  async proposeAdminPatch(targetPath: string, newContent: string): Promise<{ patchId: string; status: string }> {
    const res = await adminFetch('/api/admin/self-modify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath, newContent }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Échec création patch.');
    return data;
  },

  async validateAdminPatch(patchId: string): Promise<{ ok: boolean; message?: string }> {
    const res = await adminFetch('/api/admin/validate-patch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible de valider le patch.');
    return data;
  },

  async rejectAdminPatch(patchId: string): Promise<{ ok: boolean }> {
    const res = await adminFetch('/api/admin/reject-patch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patchId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible de rejeter le patch.');
    return data;
  },

  async checkHealth(): Promise<{ ok: boolean }> {
    const res = await fetch('/api/health');
    if (!res.ok) return { ok: false };
    return await res.json();
  },

  async extractFileText(file: File): Promise<{
    name: string;
    type: string;
    size: number;
    text: string;
  }> {
    const buffer = await file.arrayBuffer();
    const res = await fetch('/api/files/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: buffer,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
      throw new Error(err.error || `Erreur extraction (${res.status})`);
    }

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
  history: Array<{ role: string; content: string }> = [],
  isAdmin = false
): Promise<AgentApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const res = isAdmin
      ? await adminFetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, history, isAdmin: true }),
          signal: controller.signal,
        })
      : await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, history, isAdmin: false }),
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
    if (err instanceof AdminSessionError) {
      throw err;
    }
    if (err?.name === 'AbortError') {
      throw new Error("Délai d'attente de l'agent dépassé (120s). Veuillez réessayer avec une question plus ciblée.");
    }
    throw err;
  }
}
