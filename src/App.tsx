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
} from './core/cognitiveEngine';
import { Header } from './components/Header';
import { ChatTab } from './components/ChatTab';
import { KnowledgeGraphTab } from './components/KnowledgeGraphTab';
import { RulesTab } from './components/RulesTab';
import { ToolsTab } from './components/ToolsTab';
import { SessionsTab } from './components/SessionsTab';
import { ActionMenuModal } from './components/ActionMenuModal';
import { SettingsModal } from './components/SettingsModal';
import { apiService } from './services/apiService';

export default function App() {
  // Détection du mode administrateur via l'URL (?admin=true)
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === 'true';
  });

  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'rules' | 'tools' | 'sessions'>('chat');

  // Synchronisation dynamique du statut admin sur navigation
  useEffect(() => {
    const checkAdmin = () => {
      const params = new URLSearchParams(window.location.search);
      setIsAdmin(params.get('admin') === 'true');
    };
    window.addEventListener('popstate', checkAdmin);
    return () => window.removeEventListener('popstate', checkAdmin);
  }, []);

  // En mode public, restreindre les onglets à 'chat' ou 'tools'
  useEffect(() => {
    if (!isAdmin && (activeTab === 'graph' || activeTab === 'rules' || activeTab === 'sessions')) {
      setActiveTab('chat');
    }
  }, [isAdmin, activeTab]);

  // État des modales
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

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
      groqModel: 'openai/gpt-oss-120b',
      geminiModel: 'gemini-3.8-flash',
      systemPrompt: NOVA_DEFAULT_SYSTEM_PROMPT,
      activeSession: 'defaut',
      soundEnabled: false,
      autoLearnFromLLM: true,
    };
  });

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
      text: `${welcome} Je suis KADERBOT NOVA. Je comprends le sens de tes phrases et me souviens de nos échanges. Pose-moi une question ou discute simplement avec moi !`,
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
          const res = await apiService.resumer({ text: corps, provider: config.provider });
          addBotMessage(res, { source: 'systeme' });
          setIsThinking(false);
          return;
        }
      }

      // Correction de texte
      if (msgLower.startsWith('corrige:') || msgLower.startsWith('corrige ')) {
        const corps = text.includes(':') ? text.split(':')[1].trim() : text.slice(7).trim();
        if (corps) {
          const result = await apiService.corriger({ text: corps, provider: config.provider });
          addBotMessage(result, { source: 'systeme' });
          setIsThinking(false);
          return;
        }
      }

      // Mode 100% local actif sans fallback cloud
      if (config.provider === 'local_only') {
        const candX = extraireX(text, memoire, regles, synonymes, contexte);
        addBotMessage(
          candX
            ? `Je n'ai pas encore d'information sur "${candX}" dans ma mémoire locale. Tu peux me l'enseigner avec : retiens: ${candX} = ...`
            : "Je n'ai pas cette notion en mémoire locale. Tu peux me l'enseigner avec : retiens: sujet = définition",
          { source: 'systeme' }
        );
        setIsThinking(false);
        return;
      }

      // =========================================================================
      // ÉTAPE 3 : CLOUD FALLBACK (Gemini / Groq avec mémoire de contexte sur 5 messages)
      // =========================================================================
      const historyFormatted = messages.slice(-5).map(m => ({
        role: m.author === 'Toi' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const res = await apiService.chat({
        prompt: text,
        history: historyFormatted,
        provider: config.provider,
        groqModel: config.groqModel || 'openai/gpt-oss-120b',
        systemPrompt: config.systemPrompt,
      });

      const responseText = res.text;
      addBotMessage(responseText, { source: res.provider === 'groq' ? 'groq' : 'gemini' });
      setGroqLog(prev => [{ q: text, r: responseText, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 20)]);

      // =========================================================================
      // ÉTAPE 4 : APPRENTISSAGE AUTOMATIQUE & CALCUL D'EMBEDDING LOCAL
      // =========================================================================
      if (config.autoLearnFromLLM) {
        const learned = apprendreDeLLM(text, responseText, memoire, res.provider === 'groq' ? 'groq' : 'gemini');
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
