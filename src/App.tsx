import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Brain,
  Scale,
  Wrench,
  FolderTree,
  Code2,
  Settings,
  Terminal,
  Lock,
} from 'lucide-react';

import {
  AppConfig,
  ChatMessage,
  ChatThread,
  LibraryDoc,
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
  ToolExecutionTrace,
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
  rechercheHybride,
  obtenirVecteur,
  obtenirVecteurCache,
  resoudrePronomsAvecHistorique,
  evaluerCalculMath,
  construirePromptContextuelNova,
} from './core/cognitiveEngine';
import { ChatTab, AdminMenuItem } from './components/ChatTab';
import { KnowledgeGraphTab } from './components/KnowledgeGraphTab';
import { RulesTab } from './components/RulesTab';
import { ToolsTab } from './components/ToolsTab';
import { SessionsTab } from './components/SessionsTab';
import { CodeWorkspaceTab } from './components/CodeWorkspaceTab';
import { LibraryTab } from './components/LibraryTab';
import { AttachSheet } from './components/AttachSheet';
import { ActionMenuModal } from './components/ActionMenuModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminAuthScreen } from './components/AdminAuthScreen';
import {
  activateAdminSession,
  AdminSessionError,
  apiService,
  decideAgentAction,
  onAdminSessionInvalidated,
  sendAgentMessage,
} from './services/apiService';
import { getDoc } from './services/libraryService';
import {
  addNote,
  buildPersonalContext,
  deleteNote,
  listNotes,
} from './services/personalMemory';

export default function App() {
  // Le paramètre ?admin=true ne suffit pas : le serveur doit valider ADMIN_TOKEN.
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'rules' | 'tools' | 'sessions' | 'workspace' | 'library'>('chat');

  // Configuration générale de KADERBOT NOVA
  const NOVA_DEFAULT_SYSTEM_PROMPT =
    'Tu es KADERBOT NOVA, un assistant IA expert et pédagogue. Tu réponds toujours en français.\n' +
    'RÈGLES DE FORMATAGE : Structure tes réponses avec du Markdown propre (sauts de ligne, listes à puces, gras). Si tu génères un tableau, utilise la syntaxe standard GitHub Markdown (| Col 1 | Col 2 | suivi de |---|---|) en laissant une ligne vide avant et après le tableau.\n' +
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

  // Le paramètre ?admin=true ouvre l'écran d'authentification à chaque visite/rechargement.
  // Le serveur exige ADMIN_TOKEN + ADMIN_AUTH_KEYWORD pour délivrer une session en mémoire.
  const readAdminUrlParam = () => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('admin') === 'true';
  };

  const [hasAdminUrlParam, setHasAdminUrlParam] = useState<boolean>(() => readAdminUrlParam());

  const lockAdmin = useCallback(() => {
    void apiService.logoutAdminSession();
    setIsAdmin(false);
    setIsAdminDrawerOpen(false);
    setIsSettingsModalOpen(false);
    setIsActionsModalOpen(false);
    setIsAttachSheetOpen(false);
    setActiveTab('chat');
    activeThreadIdRef.current = null;
    setActiveThreadId(null);
    setActiveDocIds([]);
    setMessages([]);
  }, []);

  const exitToPublic = useCallback(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, '', nextUrl || '/');
    }
    setHasAdminUrlParam(false);
    lockAdmin();
  }, [lockAdmin]);

  const handleAdminAuthenticated = useCallback((sessionId: string, tokenToSave: string) => {
    activateAdminSession(sessionId);
    const trimmedToken = tokenToSave.trim();
    if (trimmedToken) {
      setConfig(prev => {
        if ((prev.adminToken || '').trim() === trimmedToken) return prev;
        const next = { ...prev, adminToken: trimmedToken };
        try {
          localStorage.setItem('kaderbot_config', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
    setIsAdmin(true);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextHasParam = readAdminUrlParam();
      setHasAdminUrlParam(nextHasParam);
      if (!nextHasParam) {
        lockAdmin();
      }
    };

    const unsubscribe = onAdminSessionInvalidated(() => {
      lockAdmin();
    });

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      unsubscribe();
    };
  }, [lockAdmin]);

  // Verrouillage automatique côté client après 30 min sans interaction utilisateur.
  useEffect(() => {
    if (!isAdmin) return;
    const IDLE_LOCK_MS = 30 * 60 * 1000;
    let idleTimerId = window.setTimeout(() => {
      lockAdmin();
    }, IDLE_LOCK_MS);

    const resetIdleTimer = () => {
      window.clearTimeout(idleTimerId);
      idleTimerId = window.setTimeout(() => {
        lockAdmin();
      }, IDLE_LOCK_MS);
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    for (const evt of events) {
      window.addEventListener(evt, resetIdleTimer, { passive: true });
    }

    return () => {
      window.clearTimeout(idleTimerId);
      for (const evt of events) {
        window.removeEventListener(evt, resetIdleTimer);
      }
    };
  }, [isAdmin, lockAdmin]);

  // En mode public, restreindre les onglets à 'chat' ou 'tools'
  useEffect(() => {
    if (!isAdmin && (activeTab === 'graph' || activeTab === 'rules' || activeTab === 'sessions' || activeTab === 'workspace')) {
      setActiveTab('chat');
    }
  }, [isAdmin, activeTab]);

  // État des modales et du tiroir Espace admin
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState(false);
  const [isAttachSheetOpen, setIsAttachSheetOpen] = useState(false);
  const [activeDocIds, setActiveDocIds] = useState<string[]>([]);

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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
  // 1. Priorité au Local : Si localStorage est vide après connexion admin, chargement initial serveur
  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin, config.activeSession]);

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
    const cleanText = (text || '').trim() || 'Je suis à votre écoute.';

    const newMsg: ChatMessage = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      author: 'KB',
      text: cleanText,
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
      const u = new SpeechSynthesisUtterance(cleanText);
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    }
  };

  const handleMessageAnimationComplete = (id: string) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, isNew: false } : m)));
  };

  const syncActiveDocsToThread = (nextIds: string[]) => {
    const currentThreadId = activeThreadIdRef.current;
    if (!currentThreadId) return;
    setThreads(prev =>
      prev.map(t => (t.id === currentThreadId ? { ...t, docIds: nextIds } : t))
    );
  };

  const handleToggleDoc = (id: string): { ok: boolean; error?: string } => {
    if (activeDocIds.includes(id)) {
      const next = activeDocIds.filter(docId => docId !== id);
      setActiveDocIds(next);
      syncActiveDocsToThread(next);
      return { ok: true };
    }
    if (activeDocIds.length >= 3) {
      return { ok: false, error: "Maximum 3 documents activés. Désactive-en un d'abord." };
    }
    const next = [...activeDocIds, id];
    setActiveDocIds(next);
    syncActiveDocsToThread(next);
    return { ok: true };
  };

  const handleDocDeleted = (id: string) => {
    if (activeDocIds.includes(id)) {
      const next = activeDocIds.filter(docId => docId !== id);
      setActiveDocIds(next);
    }
    setThreads(prev =>
      prev.map(t =>
        t.docIds && t.docIds.includes(id)
          ? { ...t, docIds: t.docIds.filter(docId => docId !== id) }
          : t
      )
    );
  };

  const handleAttachFileAdded = (doc: LibraryDoc): { ok: boolean; error?: string } => {
    if (activeDocIds.includes(doc.id)) {
      return { ok: true };
    }
    if (activeDocIds.length >= 3) {
      return { ok: false, error: "Maximum 3 documents activés. Désactive-en un d'abord." };
    }
    const next = [...activeDocIds, doc.id];
    setActiveDocIds(next);
    syncActiveDocsToThread(next);
    addBotMessage(`📄 ${doc.name} ajouté et activé.`, { source: 'systeme' });
    return { ok: true };
  };

  const handleSelectThread = (threadId: string) => {
    const target = threads.find(t => t.id === threadId);
    if (!target) return;
    activeThreadIdRef.current = target.id;
    setActiveThreadId(target.id);
    setActiveDocIds(target.docIds ? [...target.docIds] : []);
    setMessages(
      target.messages && target.messages.length > 0
        ? target.messages.map(m => ({ ...m, isNew: false }))
        : []
    );
  };

  const handleNewThread = () => {
    activeThreadIdRef.current = null;
    setActiveThreadId(null);
    setActiveDocIds([]);
    setMessages([]);
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
  const capturePersonalNotesFromTrace = async (toolTrace?: ToolExecutionTrace[]) => {
    if (!Array.isArray(toolTrace) || toolTrace.length === 0) return;
    for (const trace of toolTrace) {
      if (trace.status !== 'success') continue;
      if (trace.resultSnippet === 'En attente de confirmation utilisateur') continue;
      if (trace.tool === 'create_note') {
        const title = typeof trace.args?.title === 'string' ? trace.args.title.trim() : '';
        const body = typeof trace.args?.body === 'string' ? trace.args.body.trim() : '';
        if (title && body) {
          await addNote({ title, body, source: 'note' }).catch(() => {});
        }
      } else if (trace.tool === 'memo_store') {
        const title = typeof trace.args?.sujet === 'string' ? trace.args.sujet.trim() : '';
        const body = typeof trace.args?.definition === 'string' ? trace.args.definition.trim() : '';
        if (title && body) {
          await addNote({ title, body, source: 'fait' }).catch(() => {});
        }
      }
    }
  };

  const handleAgentActionDecision = async (actionId: string, decision: 'approve' | 'reject') => {
    try {
      const result = await decideAgentAction(actionId, decision);
      if (decision === 'approve') {
        await capturePersonalNotesFromTrace(result.toolTrace);
      }
      let text = (result.text || '').trim();
      if (!text) {
        const toolNames =
          result.toolTrace && result.toolTrace.length > 0
            ? Array.from(new Set(result.toolTrace.map(t => t.tool))).join(', ')
            : 'action';
        text = `✅ Action validée et exécutée : ${toolNames}`;
      }
      addBotMessage(text, {
        source: 'systeme',
        toolTrace: result.toolTrace,
      });
    } catch (err: any) {
      addBotMessage(`Impossible de traiter cette action : ${err.message}`, { source: 'systeme' });
    }
  };

  const handleProcessUserMessage = async (
    rawMessage: string,
    options: { regenerate?: boolean } = {}
  ) => {
    const text = rawMessage.trim();
    if (!text) return;

    const isRegeneration = options.regenerate === true;
    const lastUserIndex = isRegeneration
      ? messages.map(message => message.author).lastIndexOf('Toi')
      : -1;
    const conversationMessages = lastUserIndex >= 0
      ? messages.slice(0, lastUserIndex + 1)
      : messages;

    // Ajout du message utilisateur
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      author: 'Toi',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let currentThreadId = activeThreadIdRef.current;
    if (isRegeneration) {
      setMessages(conversationMessages);
      if (currentThreadId) {
        setThreads(prev => prev.map(thread =>
          thread.id === currentThreadId
            ? { ...thread, updatedAt: new Date().toISOString(), messages: thread.messages.slice(0, thread.messages.map(message => message.author).lastIndexOf('Toi') + 1) }
            : thread
        ));
      }
    } else if (!currentThreadId) {
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
        docIds: activeDocIds.length > 0 ? [...activeDocIds] : undefined,
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

    if (!isRegeneration) {
      setMessages(prev => [...prev, userMsg]);
    }

    const msgLower = text.toLowerCase();
    const msgClean = sansAccent(msgLower);
    const setPublicThinkingStatus = (status: string) => {
      if (!isAdmin) setThinkingStatus(status);
    };

    // Commandes locales de gestion des notes personnelles (sans appel serveur)
    if (msgClean === 'mes notes') {
      try {
        const notes = await listNotes();
        if (notes.length === 0) {
          addBotMessage('Aucune note personnelle enregistrée pour le moment.', { source: 'systeme' });
        } else {
          const lines = notes.map((n, idx) => `${idx + 1}. **${n.title}** : ${n.body}`);
          addBotMessage(
            `Notes personnelles enregistrées (${notes.length}) :\n${lines.join('\n')}`,
            { source: 'systeme' }
          );
        }
      } catch {
        addBotMessage('Impossible de lire les notes personnelles locales.', { source: 'systeme' });
      }
      return;
    }

    const forgetNoteMatch = msgClean.match(/^(?:oublie|oublier)\s+(?:la\s+)?note\s+(\d+)$/);
    if (forgetNoteMatch) {
      const noteIndex = Number.parseInt(forgetNoteMatch[1], 10);
      try {
        const notes = await listNotes();
        if (notes.length === 0) {
          addBotMessage('Aucune note personnelle enregistrée à supprimer.', { source: 'systeme' });
        } else if (noteIndex < 1 || noteIndex > notes.length) {
          addBotMessage(
            `Numéro invalide. Tu as ${notes.length} note${notes.length > 1 ? 's' : ''} enregistrée${notes.length > 1 ? 's' : ''}.`,
            { source: 'systeme' }
          );
        } else {
          const target = notes[noteIndex - 1];
          await deleteNote(target.id);
          addBotMessage(`Note ${noteIndex} supprimée : « ${target.title} ».`, { source: 'systeme' });
        }
      } catch {
        addBotMessage('Impossible de supprimer cette note personnelle.', { source: 'systeme' });
      }
      return;
    }

    // Contexte personnel persistant (IndexedDB)
    let personalContextBlock = '';
    try {
      const rawPersonalContext = await buildPersonalContext(3000);
      if (rawPersonalContext) {
        personalContextBlock = `[CONTEXTE PERSONNEL]\n${rawPersonalContext}\n[FIN CONTEXTE]`;
      }
    } catch {
      personalContextBlock = '';
    }

    // Vérification des documents activés pour cette discussion
    const MAX_DOC_CHARS = 12000;
    let activeDocsForPrompt: LibraryDoc[] = [];
    if (activeDocIds.length > 0) {
      try {
        const loaded = await Promise.all(activeDocIds.map(id => getDoc(id)));
        activeDocsForPrompt = loaded.filter((d): d is LibraryDoc => Boolean(d));
      } catch {
        activeDocsForPrompt = [];
      }
    }

    const hasActiveDocs = activeDocsForPrompt.length > 0;
    let promptToSend = text;
    let wasDocsTruncated = false;

    if (hasActiveDocs) {
      const totalDocChars = activeDocsForPrompt.reduce((sum, d) => sum + d.text.length, 0);
      wasDocsTruncated = totalDocChars > MAX_DOC_CHARS;

      let remainingBudget = MAX_DOC_CHARS;
      const sortedByLen = [...activeDocsForPrompt].sort((a, b) => a.text.length - b.text.length);
      const allocationMap = new Map<string, number>();
      sortedByLen.forEach((doc, idx) => {
        const docsLeft = sortedByLen.length - idx;
        const fairShare = Math.floor(remainingBudget / docsLeft);
        const used = Math.min(doc.text.length, fairShare);
        allocationMap.set(doc.id, used);
        remainingBudget -= used;
      });

      const docsBlock = activeDocsForPrompt
        .map(doc => {
          const limit = allocationMap.get(doc.id) ?? doc.text.length;
          const snippet = doc.text.length > limit ? doc.text.slice(0, limit) : doc.text;
          return `[${doc.name}]\n${snippet}`;
        })
        .join('\n\n');

      promptToSend = `DOCUMENT(S) FOURNI(S) PAR L'UTILISATEUR :\n${docsBlock}\n\nQUESTION :\n${text}`;
    }

    if (!hasActiveDocs) {

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
      setPublicThinkingStatus('Exécute le moteur Groq...');
      try {
        const groqBaseHistory = conversationMessages.slice(-5).map(m => ({
          role: m.author === 'Toi' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        }));
        const groqHistory = personalContextBlock
          ? [{ role: 'user' as const, content: personalContextBlock }, ...groqBaseHistory]
          : groqBaseHistory;
        const res = await apiService.chat({
          prompt: q,
          history: groqHistory,
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
    } // Fin de if (!hasActiveDocs) pour commandes et salutations

    // =========================================================================
    // ÉTAPE 1 : LOCAL SÉMANTIQUE (Embeddings Transformers.js côté navigateur)
    // =========================================================================
    const isContinueCommand = /^(continue|continuer|suite|poursuis|poursuivre|vas-y|go)\b/i.test(text.trim());
    setThinkingStatus(
      hasActiveDocs
        ? (isAdmin ? 'Analyse des documents activés...' : 'Analyse du document...')
        : isAdmin
        ? (isContinueCommand
          ? 'Poursuite de la recherche et synthèse en cours...'
          : 'Recherche et réflexion en cours...')
        : 'Réfléchis'
    );
    setIsThinking(true);
    try {
      if (!hasActiveDocs) {
      // 1. Résolution des pronoms ("il", "elle", "ça") avec les 5 derniers messages
      setPublicThinkingStatus('Analyse ta demande...');
      const questionResolue = resoudrePronomsAvecHistorique(text, conversationMessages.slice(-5));

      // 2. Recherche Hybride (Filtrage rapide par mots-clés + Comparaison vectorielle cosinus > 0.82)
      setPublicThinkingStatus('Recherche dans ma mémoire...');
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
      setPublicThinkingStatus('Exécute un outil...');
      const resultatCalcul = evaluerCalculMath(text);
      if (resultatCalcul) {
        addBotMessage(resultatCalcul, { source: 'systeme' });
        setIsThinking(false);
        return;
      }

      // Traduction automatique via les outils
      if (msgLower.startsWith('traduis en ') || msgLower.startsWith('traduis ')) {
        setPublicThinkingStatus('Exécute l’outil de traduction...');
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
        setPublicThinkingStatus('Génère des idées...');
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
        setPublicThinkingStatus('Résume le texte...');
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
        setPublicThinkingStatus('Corrige le texte...');
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
    } // Fin de if (!hasActiveDocs) : si un document est activé, on passe directement à l'agent/chat

      // =========================================================================
      // ÉTAPE 3 : AGENT AVEC OUTILS & ROUTEUR COGNITIF (AVEC FALLBACK /api/chat)
      // =========================================================================
      const baseHistory = conversationMessages.slice(-10).map(m => ({
        role: m.author === 'Toi' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));
      const historyFormatted = personalContextBlock
        ? [{ role: 'user' as const, content: personalContextBlock }, ...baseHistory]
        : baseHistory;

      let responseText = '';
      let botSource: NonNullable<ChatMessage['meta']>['source'] = 'groq';
      let metaPayload: ChatMessage['meta'] = {};

      try {
        // 1. Appel prioritaire de l'Agent intelligent ReAct (/api/agent avec les 10 derniers messages)
        if (!hasActiveDocs) {
          setThinkingStatus(
            isAdmin
              ? (isContinueCommand
                ? 'Boucle ReAct : finalisation et synthèse finale...'
                : 'Boucle ReAct : Pensée → Action → Observation (jusqu’à 25 itérations)...')
              : 'Exécute un outil...'
          );
        }
        const agentRes = await sendAgentMessage(promptToSend, historyFormatted, isAdmin);
        if (!agentRes.pendingAction) {
          await capturePersonalNotesFromTrace(agentRes.toolTrace);
        }
        responseText = (agentRes.text || agentRes.question || '').trim();

        botSource =
          agentRes.provider === 'groq-agent'
            ? 'groq-agent'
            : agentRes.provider === 'openrouter-agent'
            ? 'openrouter-agent'
            : agentRes.provider === 'groq-chat'
            ? 'groq-chat'
            : agentRes.provider === 'openrouter'
            ? 'openrouter'
            : agentRes.provider === 'gemini' || agentRes.provider === 'gemini-agent'
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

        // Si l'agent n'a renvoyé aucun texte malgré la boucle, inviter cordialement à reformuler
        if (!responseText) {
          responseText = "Désolé, je n'ai pas pu formuler de réponse complète. Peux-tu reformuler ta question ?";
        }

        if (
          agentRes.provider === 'groq-agent' ||
          agentRes.provider === 'openrouter-agent' ||
          agentRes.routedTo === 'agent'
        ) {
          setIsAgentActive(true);
        }
      } catch (agentErr: any) {
        if (isAdmin && agentErr instanceof AdminSessionError) {
          setIsThinking(false);
          return;
        }
        console.warn('Endpoint /api/agent indisponible ou erreur, bascule vers /api/chat:', agentErr.message);
        // Fallback transparent vers /api/chat si /api/agent renvoie 404, 500 ou échoue
        setPublicThinkingStatus('Synthétise la réponse...');
        const chatRes = await apiService.chat({
          prompt: promptToSend,
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

      if (wasDocsTruncated) {
        responseText = `⚠️ Document tronqué aux 12 000 premiers caractères.\n\n${responseText}`;
      }

      // L'indicateur "Réflexion" disparaît dès que le bot s'apprête à afficher sa réponse finale
      setIsThinking(false);
      addBotMessage(responseText, metaPayload);
      setGroqLog(prev => [{ q: text, r: responseText, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 20)]);

      // =========================================================================
      // ÉTAPE 4 : APPRENTISSAGE AUTOMATIQUE & CALCUL D'EMBEDDING LOCAL
      // =========================================================================
      const hasPersonalTrace = Boolean(
        metaPayload.toolTrace?.some(
          t => t.status === 'success' && (t.tool === 'create_note' || t.tool === 'memo_store')
        )
      );
      const isPersonalQuery =
        /\b(?:de moi|sur moi|me concerne|me connais|sais[- ]tu de moi)\b/i.test(msgClean);
      if (
        !hasActiveDocs &&
        !hasPersonalTrace &&
        !(personalContextBlock && isPersonalQuery) &&
        config.autoLearnFromLLM &&
        !metaPayload.pendingAction
      ) {
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

  const handleRegenerateMessage = (text: string) => {
    void handleProcessUserMessage(text, { regenerate: true });
  };

  const adminMenuItems: AdminMenuItem[] = isAdmin
    ? [
        {
          id: 'graph',
          label: 'Cerveau & Graphe',
          icon: <Brain className="w-4 h-4" />,
          onClick: () => {
            setIsAdminDrawerOpen(false);
            setActiveTab('graph');
          },
        },
        {
          id: 'rules',
          label: 'Règles & Inférence',
          icon: <Scale className="w-4 h-4" />,
          onClick: () => {
            setIsAdminDrawerOpen(false);
            setActiveTab('rules');
          },
        },
        {
          id: 'tools',
          label: 'Atelier Texte',
          icon: <Wrench className="w-4 h-4" />,
          onClick: () => {
            setIsAdminDrawerOpen(false);
            setActiveTab('tools');
          },
        },
        {
          id: 'sessions',
          label: 'Sessions & Pydroid',
          icon: <FolderTree className="w-4 h-4" />,
          onClick: () => {
            setIsAdminDrawerOpen(false);
            setActiveTab('sessions');
          },
        },
        {
          id: 'workspace',
          label: 'Atelier Code',
          icon: <Code2 className="w-4 h-4" />,
          onClick: () => {
            setIsAdminDrawerOpen(false);
            setActiveTab('workspace');
          },
        },
        {
          id: 'settings',
          label: 'Paramètres',
          icon: <Settings className="w-4 h-4" />,
          onClick: () => {
            setIsAdminDrawerOpen(false);
            setIsSettingsModalOpen(true);
          },
        },
        {
          id: 'actions',
          label: 'Actions',
          icon: <Terminal className="w-4 h-4" />,
          onClick: () => {
            setIsAdminDrawerOpen(false);
            setIsActionsModalOpen(true);
          },
        },
        {
          id: 'lock',
          label: 'Verrouiller',
          icon: <Lock className="w-4 h-4" />,
          onClick: () => {
            setIsAdminDrawerOpen(false);
            lockAdmin();
          },
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 h-full w-full max-h-[100dvh] flex flex-col bg-[#050508] text-gray-100 font-sans selection:bg-emerald-500/20 selection:text-emerald-300 overflow-hidden">
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
            onRegenerateMessage={isAdmin ? undefined : handleRegenerateMessage}
            onOpenTools={() => setActiveTab('tools')}
            onOpenLibrary={() => setActiveTab('library')}
            onOpenAttach={() => setIsAttachSheetOpen(true)}
            onOpenAdminDrawer={isAdmin ? () => setIsAdminDrawerOpen(true) : undefined}
            isAdminDrawerOpen={isAdmin ? isAdminDrawerOpen : false}
            onCloseAdminDrawer={() => setIsAdminDrawerOpen(false)}
            adminMenuItems={adminMenuItems}
          />
        )}

        {activeTab === 'library' && (
          <LibraryTab
            activeDocIds={activeDocIds}
            onToggleDoc={handleToggleDoc}
            onBack={() => setActiveTab('chat')}
            onDocDeleted={handleDocDeleted}
          />
        )}

        {activeTab === 'graph' && isAdmin && (
          <KnowledgeGraphTab
            memoire={memoire}
            regles={regles}
            liens={liens}
            synonymes={synonymes}
            onBack={() => setActiveTab('chat')}
            conceptsCount={Object.keys(memoire).length}
            rulesCount={Object.values(regles).reduce((acc, l) => acc + l.length, 0)}
            isAgentActive={isAgentActive}
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
            onBack={() => setActiveTab('chat')}
            onAddRule={handleAddRule}
            onDeleteRule={handleDeleteRule}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsTab
            config={config}
            onBack={() => setActiveTab('chat')}
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
            onBack={() => setActiveTab('chat')}
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

        {activeTab === 'workspace' && isAdmin && (
          <CodeWorkspaceTab isAdmin={isAdmin} onBack={() => setActiveTab('chat')} />
        )}
      </main>

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
          onSaveConfig={updates => {
            const tokenChanged =
              updates.adminToken !== undefined &&
              updates.adminToken.trim() !== (config.adminToken || '').trim();
            setConfig(prev => {
              const next = { ...prev, ...updates };
              try {
                localStorage.setItem('kaderbot_config', JSON.stringify(next));
              } catch {}
              return next;
            });
            if (isAdmin && tokenChanged) {
              lockAdmin();
            }
          }}
          onPushMemoryToServer={handlePushMemoryToServer}
          onPullMemoryFromServer={handlePullMemoryFromServer}
        />
      )}
      {/* Panneau inférieur de pièce jointe (Public et Admin) */}
      <AttachSheet
        isOpen={isAttachSheetOpen}
        onClose={() => setIsAttachSheetOpen(false)}
        onOpenLibrary={() => setActiveTab('library')}
        onFileAdded={handleAttachFileAdded}
      />

      {/* Écran d'authentification administrateur (?admin=true tant que non authentifié) */}
      {hasAdminUrlParam && !isAdmin && (
        <AdminAuthScreen
          savedToken={config.adminToken || ''}
          onAuthenticated={handleAdminAuthenticated}
          onExitToPublic={exitToPublic}
        />
      )}
    </div>
  );
}
