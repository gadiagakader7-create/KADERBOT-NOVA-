import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Brain,
  ThumbsUp,
  ThumbsDown,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Share2,
  Copy,
  Check,
  History,
  Plus,
  X,
  MessageSquare,
  Clock,
  Pencil,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ChatMessage, ChatThread, ToolExecutionTrace } from '../types/kaderbot';

const markdownComponents = {
  p: ({ children }: any) => (
    <p className="mb-2.5 last:mb-0 leading-relaxed text-gray-100">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside space-y-1.5 my-2.5 text-gray-200 pl-1">
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside space-y-1.5 my-2.5 text-gray-200 pl-1">
      {children}
    </ol>
  ),
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: any) => (
    <strong className="font-semibold text-emerald-300">{children}</strong>
  ),
  em: ({ children }: any) => <em className="italic text-cyan-200">{children}</em>,
  code: ({ className, children }: any) => {
    const isMultiLine = typeof children === 'string' && children.includes('\n');
    if (className || isMultiLine) {
      return (
        <pre className="p-3 my-2.5 rounded-xl bg-[#080B11] border border-gray-800 font-mono text-[11px] sm:text-xs overflow-x-auto text-emerald-200 leading-normal">
          <code className={className}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="px-1.5 py-0.5 rounded bg-gray-800/90 text-emerald-300 font-mono text-[11px] sm:text-xs border border-gray-700/50">
        {children}
      </code>
    );
  },
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-emerald-500/60 pl-3 italic text-gray-300 my-2">
      {children}
    </blockquote>
  ),
  h1: ({ children }: any) => (
    <h1 className="text-base font-bold text-white mb-2">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-sm font-bold text-emerald-400 mb-1.5">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-xs font-bold text-cyan-300 mb-1">{children}</h3>
  ),
  hr: () => <hr className="my-3 border-gray-800" />,
};

interface BotTypewriterMessageProps {
  text: string;
  onComplete: () => void;
  onTick?: () => void;
}

/**
 * Composant de message KADERBOT NOVA avec effet machine à écrire (streaming)
 * Uniquement actif pour les nouveaux messages en temps réel (msg.isNew === true).
 */
const BotTypewriterMessage: React.FC<BotTypewriterMessageProps> = ({
  text,
  onComplete,
  onTick,
}) => {
  const [displayedLength, setDisplayedLength] = useState(1);
  const isTyping = displayedLength < text.length;

  useEffect(() => {
    if (displayedLength >= text.length) {
      onComplete();
      return;
    }

    // Vitesse fluide ~20ms par caractère
    const interval = setInterval(() => {
      setDisplayedLength(prev => {
        const step = text.length > 350 ? 2 : 1;
        const next = Math.min(text.length, prev + step);
        if (next >= text.length) {
          clearInterval(interval);
          onComplete();
        }
        return next;
      });
      onTick?.();
    }, 20);

    return () => clearInterval(interval);
  }, [text, onComplete, onTick, displayedLength]);

  const displayedContent = text.slice(0, displayedLength);

  return (
    <div className="relative">
      <div className="text-gray-100 text-xs sm:text-sm leading-relaxed">
        <ReactMarkdown components={markdownComponents}>
          {displayedContent}
        </ReactMarkdown>
      </div>
      {isTyping && (
        <span
          className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse ml-0.5 align-middle rounded-xs"
          title="Frappe en cours..."
        />
      )}
    </div>
  );
};

interface AgentTraceAccordionProps {
  toolTrace: ToolExecutionTrace[];
}

/**
 * Composant Accordéon repliable pour masquer les logs et traces techniques de l'agent par défaut.
 * N'affiche au départ qu'une ligne sobre résumant le nombre d'actions et d'échecs (ex: 403 Forbidden).
 * Le clic permet d'ouvrir la timeline détaillée des outils.
 */
const AgentTraceAccordion: React.FC<AgentTraceAccordionProps> = ({ toolTrace }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!toolTrace || toolTrace.length === 0) return null;

  const total = toolTrace.length;
  const failures = toolTrace.filter(t => t.status === 'error' || Boolean(t.errorMsg)).length;

  const getToolMeta = (toolName: string) => {
    switch (toolName) {
      case 'search_web':
        return { label: 'Recherche Web (Brave)', icon: '🌐' };
      case 'search_news':
        return { label: 'Actualités Récentes', icon: '📰' };
      case 'open_url':
        return { label: 'Consultation de Page', icon: '📄' };
      case 'memo_lookup':
        return { label: 'Mémoire Cognitive', icon: '🧠' };
      case 'memo_store':
        return { label: 'Mémorisation Faits', icon: '💾' };
      case 'link_concepts':
        return { label: 'Association d\'Idées', icon: '🔗' };
      case 'ask_user':
        return { label: 'Demande de Précision', icon: '❓' };
      default:
        return { label: toolName, icon: '⚙️' };
    }
  };

  return (
    <div className="mt-3 pt-2 border-t border-gray-800/70">
      {/* Bouton de l'accordéon replié par défaut */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#0B0F19]/90 hover:bg-[#111726] border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition group text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">⚙️</span>
          <span className="text-xs font-medium text-gray-200">
            {total} action{total > 1 ? 's' : ''} exécutée{total > 1 ? 's' : ''}
            {failures > 0 && (
              <span className="text-rose-400 font-semibold ml-1">
                ({failures} échec{failures > 1 ? 's' : ''})
              </span>
            )}
          </span>
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            — {isOpen ? 'Masquer les détails' : 'Voir les détails'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-gray-400 group-hover:text-emerald-400 text-xs">
          <span className="text-[10px] sm:hidden text-gray-500">{isOpen ? 'Masquer' : 'Détails'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Contenu déroulant avec la timeline des actions */}
      {isOpen && (
        <div className="mt-2 p-3 rounded-xl bg-[#070A11] border border-gray-800/80 space-y-2.5 animate-in fade-in duration-150">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1 flex items-center justify-between">
            <span>Détail des opérations de l'agent</span>
            <span>{total} étape{total > 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-2">
            {toolTrace.map((trace, idx) => {
              const meta = getToolMeta(trace.tool);
              const isError = trace.status === 'error' || Boolean(trace.errorMsg);
              const isUrl = trace.tool === 'open_url' && trace.args?.url;
              let hostname = '';
              if (isUrl) {
                try {
                  hostname = new URL(trace.args.url).hostname.replace(/^www\./, '');
                } catch {
                  hostname = trace.args.url;
                }
              }

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs ${
                    isError
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                      : 'bg-[#0E131F] border-gray-800/90 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-mono text-[10px]">#{idx + 1}</span>
                      <span>{meta.icon}</span>
                      <span className="font-semibold text-white">{meta.label}</span>
                      <span className="font-mono text-[10px] text-gray-500">({trace.tool})</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {trace.durationMs !== undefined && (
                        <span className="text-[10px] font-mono text-gray-500">
                          {trace.durationMs}ms
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isError
                            ? 'bg-rose-900/60 text-rose-200 border border-rose-700/60'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                        }`}
                      >
                        {isError ? (
                          <>
                            <XCircle className="w-2.5 h-2.5" />
                            <span>Échec</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Succès</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Paramètres de l'action */}
                  {trace.args && (
                    <div className="mt-1.5 text-[11px] text-gray-400 pl-3 border-l-2 border-gray-800">
                      {trace.args.query && (
                        <div>
                          <span className="text-gray-500">Recherche : </span>
                          <span className="text-cyan-200 font-medium">« {trace.args.query} »</span>
                        </div>
                      )}
                      {isUrl && (
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          <span className="text-gray-500">Lien : </span>
                          <a
                            href={trace.args.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline font-mono text-[11px] truncate max-w-[280px]"
                            title={trace.args.url}
                          >
                            <span>{hostname || trace.args.url}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      )}
                      {trace.args.subject && (
                        <div>
                          <span className="text-gray-500">Sujet : </span>
                          <span className="text-emerald-300">{trace.args.subject}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message d'erreur clair si échec (ex: 403 Forbidden intercepté sans crash) */}
                  {isError && trace.errorMsg && (
                    <div className="mt-2 p-2 rounded bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300 font-sans flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-semibold text-rose-200">Incident intercepté :</span>
                        <p className="text-rose-300/90 leading-tight">{trace.errorMsg}</p>
                      </div>
                    </div>
                  )}

                  {/* Aperçu du résultat (extrait synthétique) */}
                  {!isError && trace.resultSnippet && (
                    <div className="mt-1.5 text-[10px] font-mono text-gray-400 bg-black/40 px-2 py-1 rounded border border-gray-800/60 truncate">
                      <span className="text-gray-500">Extrait : </span>
                      <span>{trace.resultSnippet}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface ChatTabProps {
  messages: ChatMessage[];
  isThinking: boolean;
  thinkingStatus?: string;
  onSendMessage: (text: string) => void;
  onClearMessages: () => void;
  onAdjustWeight: (sujet: string, delta: number) => void;
  soundEnabled: boolean;
  activeSession: string;
  prefilledText?: string;
  onClearPrefill?: () => void;
  onOpenActions?: () => void;
  isAdmin?: boolean;
  threads?: ChatThread[];
  activeThreadId?: string | null;
  onSelectThread?: (threadId: string) => void;
  onNewThread?: () => void;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  onMessageAnimationComplete?: (id: string) => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
  isThinking,
  thinkingStatus,
  onSendMessage,
  onClearMessages,
  onAdjustWeight,
  soundEnabled,
  activeSession,
  prefilledText,
  onClearPrefill,
  onOpenActions,
  isAdmin = false,
  threads = [],
  activeThreadId = null,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  onMessageAnimationComplete,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTypingTick = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Sync prefilledText when passed from Action menu or chips
  useEffect(() => {
    if (prefilledText !== undefined && prefilledText !== '') {
      setInputText(prefilledText);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = prefilledText.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 50);
      onClearPrefill?.();
    }
  }, [prefilledText, onClearPrefill]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Auto-focus rename field when editing a thread title
  useEffect(() => {
    if (editingThreadId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingThreadId]);

  const handleSaveRename = (threadId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameThread?.(threadId, trimmed);
    }
    setEditingThreadId(null);
  };

  // Voice Speech Recognition
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée sur ce navigateur.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  // Text-to-speech for a specific message
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isThinking) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleScrollUnits = (direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      const amount = direction === 'up' ? -250 : 250;
      scrollContainerRef.current.scrollBy({ top: amount, behavior: 'smooth' });
    }
  };

  const quickPills = [
    { label: 'C’est quoi...', text: "c'est quoi " },
    { label: 'Pourquoi...', text: 'pourquoi ' },
    { label: 'Retenir un fait', text: 'retiens: ' },
    { label: 'Règle tous les...', text: 'retiens: tous les ' },
    { label: 'Lier concepts', text: 'lie: ' },
    { label: 'Générer idées', text: 'idees 5: ' },
    { label: 'Traduire', text: 'traduis en anglais: ' },
    { label: 'Lister mémoire', text: 'lister: memoire' },
  ];

  const activeThread = (threads || []).find(t => t.id === activeThreadId);

  const formatThreadDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return 'Hier';
      }
      return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  const filteredThreads = (threads || []).filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (t.title || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden bg-[#050508] cyber-bg">
      {/* Top Thread & History Subheader Bar */}
      <div className="shrink-0 flex-shrink-0 px-3 sm:px-4 py-2 bg-[#090B10]/95 border-b border-gray-800/80 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 text-xs font-semibold text-gray-200 transition active:scale-95 shrink-0 shadow-xs"
            title="Ouvrir l'historique des discussions"
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Historique</span>
            {(threads?.length || 0) > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40 text-[10px] font-mono">
                {threads?.length}
              </span>
            )}
          </button>

          {/* Current discussion title indicator */}
          <div className="min-w-0 flex items-center gap-1.5 text-xs text-gray-400">
            <span className="hidden sm:inline text-gray-700">|</span>
            <span className="truncate font-medium text-gray-300 max-w-[130px] sm:max-w-[280px]">
              {activeThread ? activeThread.title : 'Nouvelle discussion'}
            </span>
          </div>
        </div>

        {/* Quick New Discussion button */}
        <button
          onClick={onNewThread}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition active:scale-95 shrink-0 shadow-xs"
          title="Démarrer une nouvelle discussion vierge"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Nouvelle discussion</span>
        </button>
      </div>

      {/* Slide-over History Drawer (ChatGPT style side panel) */}
      {isHistoryOpen && (
        <div className="absolute inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            onClick={() => setIsHistoryOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer content panel */}
          <div className="relative w-full max-w-[300px] sm:max-w-xs bg-[#090B10] border-r border-gray-800 flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-3.5 border-b border-gray-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
                <History className="w-4 h-4 text-emerald-400" />
                <span>Discussions ({threads?.length || 0})</span>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* "+ Nouvelle discussion" Button (ChatGPT style) */}
            <div className="p-3 border-b border-gray-800/80">
              <button
                onClick={() => {
                  onNewThread?.();
                  setIsHistoryOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Nouvelle discussion</span>
              </button>
            </div>

            {/* Search Input Bar (Feature 2) */}
            <div className="px-3 py-2 border-b border-gray-800/80 bg-[#07090F]/70">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une discussion..."
                  className="w-full bg-[#121622] border border-gray-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-gray-500 hover:text-white"
                    title="Effacer la recherche"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Threads List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 overscroll-contain">
              {(!threads || threads.length === 0) ? (
                <div className="py-12 text-center text-gray-500 text-xs px-4">
                  <MessageSquare className="w-8 h-8 text-gray-700 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-gray-400">Aucune discussion</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Posez votre première question pour sauvegarder automatiquement ce fil !
                  </p>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="py-10 text-center text-gray-500 text-xs px-4">
                  <Search className="w-7 h-7 text-gray-700 mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-gray-400">Aucun résultat trouvé</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Aucune discussion ne correspond à « {searchQuery} »
                  </p>
                </div>
              ) : (
                filteredThreads.map(thread => {
                  const isActive = thread.id === activeThreadId;
                  const isEditing = editingThreadId === thread.id;
                  const dateStr = formatThreadDate(thread.updatedAt || thread.createdAt);
                  return (
                    <div
                      key={thread.id}
                      onClick={() => {
                        if (isEditing) return;
                        onSelectThread?.(thread.id);
                        setIsHistoryOpen(false);
                      }}
                      className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl transition border text-left ${
                        isActive
                          ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200 shadow-sm'
                          : 'bg-gray-900/60 hover:bg-gray-800/90 border-gray-800/80 text-gray-300 hover:text-white'
                      }`}
                    >
                      {isEditing ? (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1.5 w-full"
                        >
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveRename(thread.id);
                              if (e.key === 'Escape') setEditingThreadId(null);
                            }}
                            className="flex-1 bg-[#161B26] border border-emerald-500/60 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                            placeholder="Nouveau titre..."
                          />
                          <button
                            onClick={() => handleSaveRename(thread.id)}
                            className="p-1.5 rounded-md bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 transition"
                            title="Valider le renommage"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingThreadId(null)}
                            className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 transition"
                            title="Annuler"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1 cursor-pointer">
                            <div className="flex items-center gap-1.5">
                              <MessageSquare
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isActive ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'
                                }`}
                              />
                              <p className="text-xs font-semibold truncate leading-tight">
                                {thread.title}
                              </p>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-500">
                              <Clock className="w-2.5 h-2.5 text-gray-600" />
                              <span>{dateStr}</span>
                              <span>·</span>
                              <span>
                                {thread.messages.filter(m => m.author === 'Toi').length} msg
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            {confirmingDeleteId === thread.id ? (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 bg-rose-950/80 border border-rose-700/60 px-2 py-0.5 rounded-lg text-[11px] text-rose-200"
                              >
                                <span>Supprimer ?</span>
                                <button
                                  onClick={() => {
                                    onDeleteThread?.(thread.id);
                                    setConfirmingDeleteId(null);
                                  }}
                                  className="p-1 hover:bg-rose-600/50 rounded text-rose-100 font-bold transition"
                                  title="Confirmer la suppression"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmingDeleteId(null)}
                                  className="p-1 hover:bg-gray-800 rounded text-gray-400 transition"
                                  title="Annuler"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Rename button (Feature 1 - icône de crayon) */}
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingThreadId(thread.id);
                                    setEditingTitle(thread.title);
                                  }}
                                  className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-700/80 hover:text-cyan-300 text-gray-400 transition active:scale-90"
                                  title="Modifier le titre de la discussion"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                {/* Trash can delete button (Requirement 5) */}
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setConfirmingDeleteId(thread.id);
                                  }}
                                  className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-950/60 hover:text-rose-400 text-gray-500 transition active:scale-90"
                                  title="Supprimer la discussion"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages Scroll Area - Only this container scrolls */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 px-3 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-5 overscroll-contain"
      >
        {/* Session banner */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900/80 border border-gray-800 text-[11px] text-gray-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Session cognitive : {activeSession}</span>
          </div>
        </div>

        {/* Message bubbles */}
        {messages.map(msg => {
          const isUser = msg.author === 'Toi';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group transition-all`}
            >
              {/* Author name & source badge */}
              <div
                className={`flex items-center gap-2 mb-1 px-1 text-[11px] font-semibold ${
                  isUser ? 'text-gray-400' : 'text-emerald-400'
                }`}
              >
                <span>{isUser ? 'TOI' : 'KADERBOT NOVA'}</span>
                {!isUser && msg.meta?.source && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700/60">
                    {msg.meta.source === 'groq-agent'
                      ? '🤖 Agent Groq'
                      : msg.meta.source === 'openrouter-agent'
                      ? '🤖 Agent OpenRouter'
                      : msg.meta.source === 'groq-chat'
                      ? '⚡ Groq Chat'
                      : msg.meta.source === 'deduction'
                      ? '⛓️ Déduction logique'
                      : msg.meta.source === 'local_memoire'
                      ? '🧠 Mémoire interne'
                      : msg.meta.source === 'regle'
                      ? '📐 Règle universelle'
                      : msg.meta.source === 'gemini'
                      ? '✨ Gemini 3.8'
                      : msg.meta.source === 'groq'
                      ? '⚡ Groq'
                      : msg.meta.source === 'openrouter'
                      ? '🦙 Llama (OpenRouter)'
                      : 'Système'}
                  </span>
                )}
                {!isUser && msg.meta?.isFallback && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/70 text-amber-300 border border-amber-500/40 cursor-help"
                    title={msg.meta.fallbackReason || 'Mode dégradé sans recherche'}
                  >
                    ⚠️ Mode dégradé (sans recherche)
                  </span>
                )}
                <span className="text-gray-600 text-[10px]">{msg.timestamp}</span>
              </div>

              {/* Message box */}
              <div
                className={`relative max-w-[92%] sm:max-w-[78%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm leading-relaxed shadow-lg ${
                  isUser
                    ? 'bg-[#1E2028] text-white border border-gray-700/60 rounded-tr-sm'
                    : 'bg-[#0E131F] text-gray-100 border border-emerald-500/25 rounded-tl-sm shadow-emerald-950/20'
                }`}
              >
                {/* Main text with Markdown & Typewriter streaming */}
                {isUser ? (
                  <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                ) : msg.isNew ? (
                  <BotTypewriterMessage
                    text={msg.text}
                    onComplete={() => {
                      onMessageAnimationComplete?.(msg.id);
                    }}
                    onTick={handleTypingTick}
                  />
                ) : (
                  <div className="text-gray-100 text-xs sm:text-sm leading-relaxed">
                    <ReactMarkdown components={markdownComponents}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Traces d'exécution de l'agent repliées par défaut sous forme d'accordéon propre */}
                {!isUser && msg.meta?.toolTrace && msg.meta.toolTrace.length > 0 && (
                  <AgentTraceAccordion toolTrace={msg.meta.toolTrace} />
                )}

                {/* Deductive chain visual crumb if applicable */}
                {!isUser && msg.meta?.chemin && msg.meta.chemin.length > 1 && (
                  <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex items-center gap-1.5 flex-wrap text-[11px] text-cyan-300 font-mono">
                    <span className="text-gray-500">Chaîne cognitive :</span>
                    {msg.meta.chemin.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className="bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/30">
                          {step}
                        </span>
                        {idx < msg.meta!.chemin!.length - 1 && <span className="text-gray-600">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {/* Interactive Cognitive Feedback buttons (Admin Only - Just like Python script!) */}
                {isAdmin && !isUser && msg.meta?.sujet && (
                  <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-gray-400">
                      Ce fait sur <span className="text-emerald-400 font-mono font-bold">{msg.meta.sujet}</span> est-il exact ?
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onAdjustWeight(msg.meta!.sujet!, 0.1)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium transition active:scale-95"
                        title="Renforcer le poids de confiance (+0.1)"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>Exact (+0.1)</span>
                      </button>
                      <button
                        onClick={() => onAdjustWeight(msg.meta!.sujet!, -0.15)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-300 text-[11px] font-medium transition active:scale-95"
                        title="Baisser le poids de confiance (-0.15)"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        <span>Inexact (-0.15)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Message action bar: Copy & Speech */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px]"
                    title="Copier le texte"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  {!isUser && (
                    <button
                      onClick={() => speakText(msg.text)}
                      className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px]"
                      title="Lire à haute voix"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Indicateur de chargement dynamique épuré */}
        {isThinking && (
          <div className="flex flex-col items-start space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[11px] font-semibold text-emerald-400">KADERBOT NOVA</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="bg-[#0E131F] border border-emerald-500/30 rounded-2xl px-4 py-3 text-emerald-400 flex items-center gap-3 shadow-lg shadow-emerald-950/20">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-gray-200 font-medium">
                {thinkingStatus || 'Recherche et analyse en cours...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll Buttons (From Tkinter V13.8 on Android) */}
      <div className="absolute right-4 bottom-28 sm:bottom-32 z-20 flex flex-col gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
        <button
          onClick={() => handleScrollUnits('up')}
          className="w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-lg active:scale-95"
          title="Défiler vers le haut"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleScrollUnits('down')}
          className="w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-lg active:scale-95"
          title="Défiler vers le bas"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Pills - Fixed above input */}
      <div className="shrink-0 flex-shrink-0 px-3 sm:px-6 py-1.5 border-t border-gray-800/60 bg-[#090B10]/90 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
        {quickPills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => setInputText(pill.text)}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 text-[11px] font-medium text-gray-300 hover:text-emerald-300 transition"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Input Form Bar - Permanently fixed at bottom of chat */}
      <div className="shrink-0 flex-shrink-0 p-2.5 sm:p-4 bg-[#090B10] border-t border-gray-800/80 z-20">
        <form onSubmit={handleFormSubmit} className="max-w-7xl mx-auto flex items-center gap-2">
          {/* Voice input button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`p-2.5 rounded-xl border transition-all ${
              isRecording
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
            }`}
            title={isRecording ? 'Arrêter dictée' : 'Dicter vocalement en français'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text entry field */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Pose une question, écris 'pourquoi...', ou 'retiens: sujet = définition'..."
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition shadow-inner"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/40 transition active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Envoyer</span>
          </button>

          {/* New Discussion Button */}
          <button
            type="button"
            onClick={onNewThread || onClearMessages}
            className="p-2.5 sm:p-3 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/40 transition active:scale-95"
            title="Démarrer une nouvelle discussion"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
