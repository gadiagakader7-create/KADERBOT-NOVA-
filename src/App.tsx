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
  construirePhraseGeneralisation,
  apprendreDeLLM,
  rechercherFlou,
  naviguerLiens,
  trouverLiensCommuns,
  corriger,
  trouverQuestionReponse,
  estRequeteDefinition,
  nettoyerMemoirePolluee,
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
  // Admin detection via URL (?admin=true)
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === 'true';
  });

  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'rules' | 'tools' | 'sessions'>('chat');

  // Keep admin status synced on URL changes
  useEffect(() => {
    const checkAdmin = () => {
      const params = new URLSearchParams(window.location.search);
      setIsAdmin(params.get('admin') === 'true');
    };
    window.addEventListener('popstate', checkAdmin);
    return () => window.removeEventListener('popstate', checkAdmin);
  }, []);

  // When not in admin mode, restrict active tab to 'chat' or 'tools'
  useEffect(() => {
    if (!isAdmin && (activeTab === 'graph' || activeTab === 'rules' || activeTab === 'sessions')) {
      setActiveTab('chat');
    }
  }, [isAdmin, activeTab]);

  // Modals state
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Configuration
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('kaderbot_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.groqModel === 'llama-3.3-70b-versatile' || !parsed.groqModel) {
          parsed.groqModel = 'openai/gpt-oss-120b';
        }
        return parsed;
      } catch {}
    }
    return {
      provider: 'gemini',
      groqApiKey: '',
      groqModel: 'openai/gpt-oss-120b',
      geminiModel: 'gemini-3.8-flash',
      systemPrompt:
        'Tu es KADERBOT, un assistant sympa, concis et curieux. ' +
        'Tu réponds toujours en français, en 2 à 4 phrases maximum. ' +
        'Tu ne fais pas de listes à puces sauf si on te le demande. ' +
        'Tu es chaleureux mais pas excessif.',
      activeSession: 'defaut',
      soundEnabled: false,
      autoLearnFromLLM: true,
    };
  });

  // Sessions state
  const [sessions, setSessions] = useState<string[]>(() => {
    const saved = localStorage.getItem('kaderbot_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return ['defaut'];
  });

  // Knowledge base state for active session
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

  // Pronoun context history
  const [contexte, setContexte] = useState<string[]>([]);
  const [chatPrefill, setChatPrefill] = useState('');
  const [dernieresIdees, setDernieresIdees] = useState<string[]>([]);
  const [groqLog, setGroqLog] = useState<Array<{ q: string; r: string; time: string }>>([]);

  // Messages list
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const hour = new Date().getHours();
    let welcome = 'Bonjour, prêt pour une nouvelle session inspirante ?';
    if (hour >= 12 && hour < 18) {
      welcome = "Bon après-midi, je suis là pour t'aider.";
    } else if (hour >= 18 || hour < 6) {
      welcome = 'Bonsoir, envie de discuter ou d’apprendre ensemble ?';
    }

    return [
      {
        id: 'welcome',
        author: 'KB',
        text: `${welcome} Je suis KADERBOT NOVA V14. Pose-moi une question, enseigne-moi un fait avec "retiens: ...", ou explore les déductions logiques.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        meta: { source: 'systeme' },
      },
    ];
  });

  const [isThinking, setIsThinking] = useState(false);

  // Server Memory Synchronization (Requirement 4: Share data live between Admin and Public)
  const lastServerTimestamp = useRef<string>('');
  const isSyncingRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSharedMemory = async () => {
      if (isSyncingRef.current) return;
      try {
        const remote = await apiService.loadMemoryFromServer();
        if (remote && isMounted) {
          const remoteUpdated = (remote as any).updatedAt || '';
          if (remoteUpdated && remoteUpdated === lastServerTimestamp.current) {
            return;
          }
          if (remote.memoire && Object.keys(remote.memoire).length > 0) {
            setMemoire(remote.memoire);
          }
          if (remote.regles && Object.keys(remote.regles).length > 0) {
            setRegles(remote.regles);
          }
          if (remote.liens && Object.keys(remote.liens).length > 0) {
            setLiens(remote.liens);
          }
          if (remote.synonymes && Object.keys(remote.synonymes).length > 0) {
            setSynonymes(remote.synonymes);
          }
          if (remote.sessions && remote.sessions.length > 0) {
            setSessions(remote.sessions);
          }
          if (remoteUpdated) {
            lastServerTimestamp.current = remoteUpdated;
          }
        }
      } catch (err) {
        // Silently keep local state if offline
      }
    };

    fetchSharedMemory();
    const interval = setInterval(fetchSharedMemory, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync to localStorage & Server disk
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

    // Save to server backend so updates made in Admin mode are shared to all users
    isSyncingRef.current = true;
    apiService
      .saveMemoryToServer({
        memoire,
        regles,
        liens,
        synonymes,
        sessions,
      })
      .then(res => {
        if (res && res.savedAt) {
          lastServerTimestamp.current = res.savedAt;
        }
      })
      .catch(() => {})
      .finally(() => {
        isSyncingRef.current = false;
      });
  }, [memoire, regles, liens, synonymes, config.activeSession, sessions]);

  // Adjust hits on specific concept definition
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

  // Handle switching sessions
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

  const addBotMessage = (
    text: string,
    meta?: ChatMessage['meta'],
    confidence?: number
  ) => {
    const newMsg: ChatMessage = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      author: 'KB',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      confidence,
      meta,
    };
    setMessages(prev => [...prev, newMsg]);

    // Audio narration if enabled
    if (config.soundEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    }
  };

  // Adjust cognitive weight
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
        ? `Parfait ! J'ai renforcé ma certitude sur "${sujet}" (+${delta}).`
        : `Compris ! J'ai baissé mon indice de confiance sur "${sujet}" (${delta}).`
    );
  };

  // Add rule helper
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

  // CORE COGNITIVE NLP DISPATCHER
  // Faithfully executing every capability from the user's Python code
  const handleProcessUserMessage = async (rawMessage: string) => {
    const text = rawMessage.trim();
    if (!text) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      author: 'Toi',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);

    const msgLower = text.toLowerCase();
    const msgClean = sansAccent(msgLower);

    // 1. Context commands
    if (msgLower === 'reset contexte' || msgLower === 'vider contexte') {
      setContexte([]);
      addBotMessage('Contexte cognitif réinitialisé.', { source: 'systeme' });
      return;
    }

    if (msgLower === 'contexte') {
      if (contexte.length === 0) {
        addBotMessage('Aucun échange en contexte actuellement.', { source: 'systeme' });
      } else {
        addBotMessage(`Contexte actuel (${contexte.length} concepts récents) : ${contexte.join(' → ')}`, { source: 'systeme' });
      }
      return;
    }

    // 2. Groq toggle & status commands
    if (msgLower === 'groq on') {
      setConfig(prev => ({ ...prev, provider: 'groq' }));
      addBotMessage('Moteur Groq activé.', { source: 'systeme' });
      return;
    }

    if (msgLower === 'groq off') {
      setConfig(prev => ({ ...prev, provider: 'local_only' }));
      addBotMessage('Mode 100% local activé (Groq désactivé).', { source: 'systeme' });
      return;
    }

    if (msgLower === 'groq statut') {
      addBotMessage(
        `Statut IA :\nMoteur actif : ${config.provider}\nModèle : ${config.provider === 'groq' ? config.groqModel : config.geminiModel}\nApprentissage auto : ${config.autoLearnFromLLM ? 'Activé' : 'Désactivé'}`
      );
      return;
    }

    // 3. Direct Groq question
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
          groqApiKey: config.groqApiKey,
          groqModel: config.groqModel || 'openai/gpt-oss-120b',
          systemPrompt: config.systemPrompt,
        });
        addBotMessage(res.text, { source: res.provider === 'gemini' ? 'gemini' : 'groq' });
        setGroqLog(prev => [{ q, r: res.text, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 20)]);
        if (config.autoLearnFromLLM) {
          const learned = apprendreDeLLM(q, res.text, memoire, 'groq');
          if (learned) {
            setMemoire({ ...memoire });
            setContexte(prev => [...prev, learned.sujet]);
          }
        }
      } catch (err: any) {
        addBotMessage(`(Groq) Erreur : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 4. Session commands
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

    // 5. Taxonomy & Link commands: lie:, delie:, liens:, cousins:
    if (msgLower.startsWith('lie:') || msgLower.startsWith('lie ')) {
      const rest = text.includes(':') ? text.split(':')[1].trim() : text.slice(3).trim();
      if (rest.includes('->')) {
        const [source, target] = rest.split('->').map(s => s.trim().toLowerCase());
        handleAddLink(source, target);
        addBotMessage(`Lien cognitif établi : ${source} -> ${target}`, { source: 'local_memoire' });
        return;
      }
      addBotMessage('Format requis : lie: source -> cible (ex: lie: moineau -> oiseau)');
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

    // 6. Translation commands: "traduis en anglais: ...", "traduis en espagnol: ..."
    if (msgLower.startsWith('traduis en ') || msgLower.startsWith('traduis ')) {
      if (!text.includes(':')) {
        addBotMessage('Format : traduis en anglais: ton texte ici');
        return;
      }
      const [entete, ...corpsParts] = text.split(':');
      const corps = corpsParts.join(':').trim();
      if (!corps) {
        addBotMessage('Il manque le texte à traduire.');
        return;
      }
      const enteteClean = sansAccent(entete.toLowerCase()).replace(/^traduis(?:\s+en)?\s*/, '').trim();
      const languesMap: Record<string, string> = {
        anglais: 'English', english: 'English',
        arabe: 'Arabic', arabic: 'Arabic',
        espagnol: 'Spanish', spanish: 'Spanish',
        allemand: 'German', german: 'German',
        italien: 'Italian', italian: 'Italian',
        portugais: 'Portuguese', portuguese: 'Portuguese',
        russe: 'Russian', russian: 'Russian',
        chinois: 'Chinese', chinese: 'Chinese',
        japonais: 'Japanese', japanese: 'Japanese',
        coreen: 'Korean', korean: 'Korean',
        turc: 'Turkish', turkish: 'Turkish',
        neerlandais: 'Dutch', dutch: 'Dutch',
        peul: 'Fula', fula: 'Fula',
        bambara: 'Bambara', wolof: 'Wolof',
        swahili: 'Swahili',
        francais: 'French', french: 'French',
      };

      const cible = languesMap[enteteClean] || 'English';
      setIsThinking(true);
      try {
        const result = await apiService.traduire({
          text: corps,
          targetLang: cible,
          provider: config.provider,
          groqApiKey: config.groqApiKey,
        });
        addBotMessage(result, { source: 'systeme' });
      } catch (err: any) {
        addBotMessage(`Erreur traduction : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 7. Text Correction: "corrige: ..."
    if (msgLower.startsWith('corrige:') || msgLower.startsWith('corrige ')) {
      const corps = text.includes(':') ? text.split(':')[1].trim() : text.slice(7).trim();
      if (!corps) {
        addBotMessage('Format : corrige: ton texte');
        return;
      }
      setIsThinking(true);
      try {
        const result = await apiService.corriger({
          text: corps,
          provider: config.provider,
          groqApiKey: config.groqApiKey,
        });
        addBotMessage(result, { source: 'systeme' });
      } catch (err: any) {
        addBotMessage(`Erreur correction : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 8. Ideas Generator: "idees 5: theme" or "idees 3 drole: theme"
    if (msgLower.startsWith('idees ') || msgLower.startsWith('idées ') || msgLower.startsWith('idees:')) {
      if (!text.includes(':')) {
        addBotMessage('Format : idees 5: theme  ou  idees 3 drole: theme');
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

      setIsThinking(true);
      try {
        const result = await apiService.genererIdees({
          theme,
          count,
          style,
          provider: config.provider,
          groqApiKey: config.groqApiKey,
        });

        const lines = result
          .split('\n')
          .map(l => l.replace(/^\s*(\d+[\.\)\-:]\s*|[\-\*]\s*)/, '').trim())
          .filter(Boolean);

        setDernieresIdees(lines);
        const formatted = [`Idées sur : ${theme}`, ...lines.map((l, i) => `${i + 1}. ${l}`)].join('\n');
        addBotMessage(formatted, { source: 'systeme' });
      } catch (err: any) {
        addBotMessage(`Erreur idées : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 9. Single Idea Development: "idee 1:", "idee 2:"
    if (msgLower.startsWith('idee ') || msgLower.startsWith('idée ')) {
      const matchNb = msgLower.match(/\d+/);
      if (!matchNb) {
        addBotMessage('Précise le numéro : idee 3:');
        return;
      }
      const num = parseInt(matchNb[0], 10) - 1;
      if (num < 0 || num >= dernieresIdees.length) {
        addBotMessage(`Pas d'idée numéro ${num + 1} en mémoire récente. Génère d'abord une liste avec "idees 5: thème"`);
        return;
      }
      const chosenIdea = dernieresIdees[num];
      setIsThinking(true);
      try {
        const prompt = `Développe cette idée en 3 à 4 phrases claires, concrètes et inspirantes : "${chosenIdea}".`;
        const res = await apiService.chat({
          prompt,
          history: [],
          provider: config.provider,
          groqApiKey: config.groqApiKey,
        });

        addBotMessage(`Idée ${num + 1} développée :\n${res.text}`, { source: 'systeme' });

        // Auto-save to memory
        const sujetIdea = `idee_${num + 1}`;
        const fact = `${chosenIdea} -> ${res.text.slice(0, 180)}`;
        setMemoire(prev => ({
          ...prev,
          [sujetIdea]: [
            {
              def: fact,
              poids: 0.75,
              hits: 1,
              source: 'auto',
              last_used: new Date().toISOString(),
              created: new Date().toISOString(),
            },
          ],
        }));
      } catch (err: any) {
        addBotMessage(`Erreur développement idée : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 10. Summarize: "resume: texte" or "resume: concept"
    if (msgLower.startsWith('resume:')) {
      const corps = text.split(':')[1]?.trim();
      if (!corps) {
        addBotMessage('Format : resume: ton texte ou ton concept');
        return;
      }

      // If text is long (> 30 words), call LLM summarizer
      if (corps.split(/\s+/).length > 25 || corps.length > 150) {
        setIsThinking(true);
        try {
          const res = await apiService.resumer({
            text: corps,
            provider: config.provider,
            groqApiKey: config.groqApiKey,
          });
          addBotMessage(res, { source: 'systeme' });
        } catch (err: any) {
          addBotMessage(`Erreur résumé : ${err.message}`, { source: 'systeme' });
        } finally {
          setIsThinking(false);
        }
        return;
      }

      // Short concept summary from memory & rules
      const xCorr = corriger(corps, memoire, regles, synonymes) || corps;
      const defs = (memoire[xCorr] || []).map(d => d.def);
      const rList = (regles[xCorr] || []).map(r => `${r.quant} les ${xCorr}s ${r.prop}`);
      if (defs.length > 0 || rList.length > 0) {
        let rep = `${xCorr} : ${defs.join('; ') || 'pas de définition'}`;
        if (rList.length > 0) rep += `\nRègles associées : ${rList.join('; ')}`;
        addBotMessage(rep, { source: 'local_memoire', sujet: xCorr });
        return;
      }
      addBotMessage(`Aucune donnée enregistrée pour "${corps}".`);
      return;
    }

    // 11. Synonyms management: "synonymes: canon = syn1 | syn2" or "synonymes: mot"
    if (msgLower.startsWith('synonymes:')) {
      const rest = text.split(':')[1]?.trim();
      if (!rest) {
        addBotMessage('Format : synonymes: canon = syn1 | syn2');
        return;
      }
      if (rest.includes('=')) {
        const [canonPart, synPart] = rest.split('=').map(s => s.trim().toLowerCase());
        const synList = synPart.split('|').map(s => s.trim()).filter(Boolean);
        if (canonPart && synList.length > 0) {
          setSynonymes(prev => {
            const copy = { ...prev };
            const currentList = Array.isArray(copy[canonPart]) ? (copy[canonPart] as string[]) : [];
            const merged = Array.from(new Set([...currentList, ...synList]));
            copy[canonPart] = merged;
            for (const s of synList) {
              copy[s] = canonPart;
            }
            return copy;
          });
          addBotMessage(`Synonymes enregistrés pour "${canonPart}" : ${synList.join(', ')}`, { source: 'local_memoire' });
          return;
        }
      } else {
        const q = rest.toLowerCase();
        if (synonymes[q]) {
          const val = synonymes[q];
          const rep = Array.isArray(val) ? `${q} = ${val.join(' | ')}` : `${q} -> ${val}`;
          addBotMessage(rep, { source: 'local_memoire' });
          return;
        }
        addBotMessage(`Aucun synonyme trouvé pour "${q}".`);
        return;
      }
    }

    // 12. Fuzzy near search: "proche: mot"
    if (msgLower.startsWith('proche:') || msgLower.startsWith('proche ')) {
      const target = (text.includes(':') ? text.split(':')[1] : text.slice(7)).trim().toLowerCase();
      const keys = Array.from(new Set([...Object.keys(memoire), ...Object.keys(regles)]));
      const candidates = keys.map(k => {
        const kNorm = sansAccent(k);
        const tNorm = sansAccent(target);
        let score = kNorm === tNorm ? 1.0 : 0.0;
        if (!score) {
          const d = Math.max(kNorm.length, tNorm.length) - Math.abs(kNorm.length - tNorm.length);
          score = (kNorm.includes(tNorm) || tNorm.includes(kNorm)) ? 0.75 : 0.4;
        }
        return { key: k, score };
      });
      candidates.sort((a, b) => b.score - a.score);
      const top = candidates.filter(c => c.score >= 0.5).slice(0, 6);
      if (top.length > 0) {
        addBotMessage(`Sujets proches de "${target}" :\n${top.map(c => ` - ${c.key}`).join('\n')}`, { source: 'local_memoire' });
      } else {
        addBotMessage(`Aucun sujet proche de "${target}".`);
      }
      return;
    }

    // 13. Substring Search: "chercher: mot"
    if (msgLower.startsWith('chercher:')) {
      const q = text.split(':')[1]?.trim().toLowerCase();
      if (!q) {
        addBotMessage('Format : chercher: mot');
        return;
      }
      const results: string[] = [];
      for (const [k, list] of Object.entries(memoire)) {
        if (k.includes(q)) {
          results.push(`${k} = ${list.map(d => d.def).join(' | ')}`);
        }
      }
      for (const [s, list] of Object.entries(regles)) {
        if (s.includes(q)) {
          for (const r of list) results.push(`${r.quant} les ${s}s ${r.prop}`);
        }
      }
      addBotMessage(
        results.length > 0
          ? `Résultats pour "${q}" :\n${results.slice(0, 10).join('\n')}`
          : `Rien trouvé pour "${q}".`,
        { source: 'local_memoire' }
      );
      return;
    }

    // 14. Bulk forgetting: "oublier masse:" or single "oublier:"
    if (msgLower.startsWith('oublier masse:') || msgLower.startsWith('oublier en masse:')) {
      const rest = text.split(':')[1]?.trim() || '';
      const items = rest.split(/[,\n;.]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const removed: string[] = [];
      setMemoire(prev => {
        const copy = { ...prev };
        for (const item of items) {
          if (copy[item]) {
            delete copy[item];
            removed.push(item);
          }
        }
        return copy;
      });
      addBotMessage(
        removed.length > 0
          ? `Concepts oubliés en masse (${removed.length}) : ${removed.join(', ')}`
          : 'Aucun concept trouvé à supprimer.',
        { source: 'systeme' }
      );
      return;
    }

    if (msgLower.startsWith('oublier:')) {
      const rest = text.split(':')[1]?.trim().toLowerCase() || '';
      if (!rest) {
        addBotMessage('Format : oublier: sujet ou oublier: sujet = def');
        return;
      }
      if (rest.includes('=')) {
        const [sujet, defText] = rest.split('=').map(s => s.trim());
        setMemoire(prev => {
          const copy = { ...prev };
          if (copy[sujet]) {
            copy[sujet] = copy[sujet].filter(d => !d.def.toLowerCase().includes(defText.toLowerCase()));
            if (copy[sujet].length === 0) delete copy[sujet];
          }
          return copy;
        });
        addBotMessage(`Définition oubliée pour "${sujet}".`, { source: 'systeme' });
        return;
      } else {
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
    }

    // 15. Bulk Learning: "retiens masse: part1 . part2"
    if (msgLower.startsWith('retiens masse:')) {
      const rest = text.split(':')[1]?.trim() || '';
      const parts = rest.split(/[.\n;]+/).map(p => p.trim()).filter(Boolean);
      const ok: string[] = [];
      const nowIso = new Date().toISOString();

      setMemoire(prevMemo => {
        const memoCopy = { ...prevMemo };
        for (const part of parts) {
          const rq = extraireQuantificateur(part);
          if (rq) {
            handleAddRule(rq.quant, rq.sujet, rq.prop, 0.85);
            ok.push(`${rq.quant} ${rq.sujet} -> ${rq.prop}`);
            continue;
          }
          if (part.includes('=')) {
            const [sRaw, dRaw] = part.split('=').map(x => x.trim().toLowerCase());
            if (sRaw && dRaw) {
              const current = memoCopy[sRaw] ? [...memoCopy[sRaw]] : [];
              current.unshift({
                def: dRaw,
                poids: 0.85,
                hits: 1,
                source: 'manuel',
                last_used: nowIso,
                created: nowIso,
              });
              memoCopy[sRaw] = current;
              ok.push(sRaw);
            }
          }
        }
        return memoCopy;
      });

      addBotMessage(
        ok.length > 0
          ? `Notes enregistrées en masse (${ok.length}) :\n${ok.join(', ')}`
          : 'Aucune note valide trouvée. Sépare tes phrases par des points.',
        { source: 'local_memoire' }
      );
      return;
    }

    // 16. Single "retiens:"
    if (msgLower.startsWith('retiens:')) {
      const content = text.split(':')[1]?.trim();
      if (!content) {
        addBotMessage('Format : retiens: sujet = définition');
        return;
      }

      // Check quantifier rule
      const rq = extraireQuantificateur(content);
      if (rq) {
        handleAddRule(rq.quant, rq.sujet, rq.prop, 0.85);
        addBotMessage(`Règle enregistrée : ${rq.quant} les ${rq.sujet}s ${rq.prop} (certitude 85%)`, { source: 'regle' }, 0.85);
        return;
      }

      // Subject = Def1 | Def2
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
          setContexte(prev => [...prev, s]);
          addBotMessage(`Fait retenu pour "${s}" : ${defsList.join(' | ')} (poids 0.85)`, { source: 'local_memoire', sujet: s }, 0.85);
          return;
        }
      }
      addBotMessage('Format requis : retiens: sujet = définition (ou plusieurs avec: retiens: sujet = def1 | def2)');
      return;
    }

    // 17. Quantifiers direct input: "tous les oiseaux ont des plumes"
    const directRq = extraireQuantificateur(text);
    if (directRq && (msgClean.startsWith('tous') || msgClean.startsWith('aucun') || msgClean.startsWith('certains') || msgClean.startsWith('chaque'))) {
      handleAddRule(directRq.quant, directRq.sujet, directRq.prop, 0.85);
      addBotMessage(`Règle généralisée enregistrée : ${directRq.quant} les ${directRq.sujet}s ${directRq.prop}`, { source: 'regle' }, 0.85);
      return;
    }

    // 18. Listing commands
    if (msgLower.startsWith('lister:')) {
      const target = msgLower.split(':')[1]?.trim();
      if (target === 'memoire') {
        const keys = Object.keys(memoire).sort();
        addBotMessage(`Mémoire active (${keys.length} sujets) :\n${keys.slice(0, 35).join(', ')}${keys.length > 35 ? '...' : ''}`, { source: 'local_memoire' });
        return;
      }
      if (target === 'regles') {
        const lines: string[] = [];
        for (const [s, list] of Object.entries(regles)) {
          for (const r of list) {
            lines.push(`${r.quant} les ${s}s ${r.prop}`);
          }
        }
        addBotMessage(`Règles générales (${lines.length}) :\n${lines.join('\n') || 'Aucune règle'}`, { source: 'regle' });
        return;
      }
      if (target === 'poids') {
        const lines: string[] = [];
        for (const [k, list] of Object.entries(memoire)) {
          for (const m of list.slice(0, 2)) {
            lines.push(`${k} = ${m.def} [poids ${m.poids.toFixed(2)}, hits ${m.hits}]`);
          }
        }
        addBotMessage(`Coefficients de poids :\n${lines.slice(0, 15).join('\n')}`, { source: 'local_memoire' });
        return;
      }
      if (target === 'incertains') {
        const lines: string[] = [];
        for (const [k, list] of Object.entries(memoire)) {
          for (const m of list) {
            if (m.poids < 0.6) {
              lines.push(`${k} = ${m.def} [poids ${m.poids.toFixed(2)}]`);
            }
          }
        }
        addBotMessage(
          lines.length > 0 ? `Concepts incertains :\n${lines.join('\n')}` : 'Aucun concept incertain (tous >= 60%).',
          { source: 'local_memoire' }
        );
        return;
      }
      if (target === 'idees') {
        addBotMessage(
          dernieresIdees.length > 0
            ? `Dernières idées générées :\n${dernieresIdees.map((l, i) => `${i + 1}. ${l}`).join('\n')}`
            : 'Aucune idée archivée dans cette session.',
          { source: 'systeme' }
        );
        return;
      }
      if (target === 'groq') {
        addBotMessage(
          groqLog.length > 0
            ? `Derniers échanges LLM :\n${groqLog.slice(0, 5).map(l => `[${l.time}] Q: ${l.q}\nR: ${l.r.slice(0, 80)}...`).join('\n\n')}`
            : 'Aucun échange LLM enregistré.',
          { source: 'systeme' }
        );
        return;
      }
      if (target === 'stats') {
        addBotMessage(
          `Statistiques : ${Object.keys(memoire).length} concepts · ${Object.values(regles).reduce((a, b) => a + b.length, 0)} règles · ${Object.keys(liens).length} liaisons taxonomiques · Contexte: ${contexte.join(', ') || 'vide'}`
        );
        return;
      }
    }

    // 19. Greetings
    const salutation = estSalutation(text);
    if (salutation) {
      addBotMessage(repondreSalutation(salutation), { source: 'systeme' });
      return;
    }

    // 20. Emotions & states
    const etat = detecterEtat(text);
    if (etat) {
      addBotMessage(repondreEtat(etat), { source: 'systeme' });
      return;
    }

    // 21. Reinforcement confirmations ("oui", "c'est ça", "non ce n'est pas ça")
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

    // 22. Causal Questions: "pourquoi le moineau vole ?" or "pourquoi l'aigle respire ?"
    if (msgClean.includes('pourquoi')) {
      const whyAnswer = repondrePourquoi(text, memoire, regles, liens, synonymes);
      if (whyAnswer) {
        const s = extraireX(text, memoire, regles, synonymes, contexte);
        if (s) setContexte(prev => [...prev, s]);
        addBotMessage(whyAnswer, { source: 'deduction', sujet: s || undefined });
        return;
      }
    }

    // 23. Question-Réponse mémorisée (recherche précise par combinaison de mots-clés de la question)
    const qaMatch = trouverQuestionReponse(text, memoire);
    if (qaMatch) {
      qaMatch.entry.hits += 1;
      qaMatch.entry.last_used = new Date().toISOString();
      setMemoire({ ...memoire });
      setContexte(prev => [...prev, qaMatch.sujet]);
      addBotMessage(
        qaMatch.entry.def,
        { source: 'local_memoire', sujet: qaMatch.sujet },
        qaMatch.entry.poids
      );
      return;
    }

    // 24. Demande de Définition de Concept ("c'est quoi le moineau ?", "parle-moi de python", "moineau")
    const defCheck = estRequeteDefinition(text);
    if (defCheck.estDef && defCheck.concept) {
      const candX = corriger(defCheck.concept, memoire, regles, synonymes) || defCheck.concept;
      const localDef = phraseDef(candX, text, memoire, regles, liens, synonymes);
      if (localDef) {
        setContexte(prev => [...prev, candX]);
        const bestEntry = memoire[candX]?.[0];
        addBotMessage(localDef, { source: 'local_memoire', sujet: candX }, bestEntry?.poids || 0.85);
        return;
      }
    }

    // 25. Recherche Floue uniquement sur requêtes courtes (1 à 3 mots max)
    const wordsCount = text.trim().split(/\s+/).length;
    if (wordsCount <= 3) {
      const flouMatch = rechercherFlou(text, memoire, regles, 0.72);
      if (flouMatch) {
        const flouDef = phraseDef(flouMatch, text, memoire, regles, liens, synonymes);
        if (flouDef) {
          setContexte(prev => [...prev, flouMatch]);
          addBotMessage(`Tu voulais sans doute parler de "${flouMatch}" : ${flouDef}`, { source: 'local_memoire', sujet: flouMatch });
          return;
        }
      }
    }

    // 26. Fallback en mode local_only
    if (config.provider === 'local_only') {
      const candX = extraireX(text, memoire, regles, synonymes, contexte);
      addBotMessage(
        candX
          ? `Je n'ai pas encore d'information sur "${candX}" dans ma mémoire locale. Enseigne-le moi avec: retiens: ${candX} = ...`
          : "Je n'ai pas compris en mode local. Tu peux m'enseigner ce fait avec: retiens: sujet = définition",
        { source: 'systeme' }
      );
      return;
    }

    // Call LLM
    setIsThinking(true);
    try {
      const historyFormatted = messages.slice(-5).map(m => ({
        role: m.author === 'Toi' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const res = await apiService.chat({
        prompt: text,
        history: historyFormatted,
        provider: config.provider,
        groqApiKey: config.groqApiKey,
        groqModel: config.groqModel || 'openai/gpt-oss-120b',
        systemPrompt: config.systemPrompt,
      });

      const responseText = res.text;

      addBotMessage(
        responseText,
        { source: res.provider === 'groq' ? 'groq' : 'gemini' },
        0.8
      );

      setGroqLog(prev => [{ q: text, r: responseText, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 20)]);

      // Apprentissage automatique du couple Question + Réponse (Q&A)
      if (config.autoLearnFromLLM) {
        const learned = apprendreDeLLM(text, responseText, memoire, res.provider === 'groq' ? 'groq' : 'gemini');
        if (learned) {
          setMemoire({ ...memoire });
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
    <div className="min-h-screen flex flex-col bg-[#050508] text-gray-100 font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Header */}
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

      {/* Main View Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            isThinking={isThinking}
            onSendMessage={handleProcessUserMessage}
            onClearMessages={() => setMessages([])}
            onAdjustWeight={handleAdjustWeight}
            soundEnabled={config.soundEnabled}
            activeSession={config.activeSession}
            prefilledText={chatPrefill}
            onClearPrefill={() => setChatPrefill('')}
            onOpenActions={() => {
              if (isAdmin) setIsActionsModalOpen(true);
            }}
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
          />
        )}
      </main>

      {/* Bottom Navigation Tabs - Public shows only Discussion & Atelier Texte */}
      <nav className="h-14 sm:h-16 bg-[#090B10] border-t border-gray-800/80 px-2 sm:px-6 flex items-center justify-around z-30">
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

      {/* Action Command Menu Modal (Admin Only) */}
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

      {/* Settings Modal (Admin Only) */}
      {isAdmin && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          config={config}
          onSaveConfig={updates => setConfig(prev => ({ ...prev, ...updates }))}
        />
      )}
    </div>
  );
}
