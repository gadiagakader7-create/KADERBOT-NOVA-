import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  Send,
  Loader2,
  Menu,
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
  Lightbulb,
  Compass,
  Layers,
  Eye,
  Workflow,
  MessageSquarePlus,
  RefreshCw,
} from 'lucide-react';
import { ChatMessage, ChatThread, PendingAgentAction, ToolExecutionTrace } from '../types/kaderbot';

const markdownComponents = {
  p: ({ children }: any) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-gray-100 break-words">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside space-y-1.5 my-2.5 text-gray-200 pl-1 break-words">
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside space-y-1.5 my-2.5 text-gray-200 pl-1 break-words">
      {children}
    </ol>
  ),
  li: ({ children }: any) => <li className="leading-relaxed break-words">{children}</li>,
  strong: ({ children }: any) => (
    <strong className="font-semibold text-emerald-300">{children}</strong>
  ),
  em: ({ children }: any) => <em className="italic text-cyan-200">{children}</em>,
  code: ({ className, children }: any) => {
    const isMultiLine = typeof children === 'string' && children.includes('\n');
    if (className || isMultiLine) {
      return (
        <pre className="p-3 my-2.5 rounded-xl bg-[#080B11] border border-gray-800 font-mono text-[11px] sm:text-xs overflow-x-auto max-w-full text-emerald-200 leading-normal">
          <code className={className}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="px-1.5 py-0.5 rounded bg-gray-800/90 text-emerald-300 font-mono text-[11px] sm:text-xs border border-gray-700/50 break-all">
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
    <h1 className="text-base font-bold text-white mb-2 break-words">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-sm font-bold text-emerald-400 mb-1.5 break-words">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-xs font-bold text-cyan-300 mb-1 break-words">{children}</h3>
  ),
  hr: () => <hr className="my-3 border-gray-800" />,
  table: ({ children }: any) => (
    <div className="w-full overflow-x-auto max-w-full my-3 rounded-xl border border-gray-800 bg-[#080B12]/95 shadow-lg shadow-black/40">
      <table className="min-w-full border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-[#101726] text-emerald-300 font-semibold border-b border-gray-800">
      {children}
    </thead>
  ),
  tbody: ({ children }: any) => (
    <tbody className="divide-y divide-gray-800/70 text-gray-200">
      {children}
    </tbody>
  ),
  tr: ({ children }: any) => (
    <tr className="hover:bg-emerald-950/25 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }: any) => (
    <th className="px-3.5 py-2.5 text-[11px] sm:text-xs font-bold tracking-wider text-emerald-400 uppercase bg-[#101726]/90 border-r border-gray-800/60 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-3.5 py-2.5 text-xs text-gray-200 border-r border-gray-800/60 last:border-r-0 whitespace-normal leading-relaxed">
      {children}
    </td>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 inline-flex items-center gap-1 font-medium break-all"
    >
      {children}
      <ExternalLink className="w-3 h-3 inline shrink-0 opacity-70" />
    </a>
  ),
  del: ({ children }: any) => (
    <del className="line-through text-gray-500">{children}</del>
  ),
  math: ({ children }: any) => (
    <div className="overflow-x-auto w-full py-2 my-2 text-center">{children}</div>
  ),
  inlineMath: ({ children }: any) => (
    <span className="inline-block px-0.5">{children}</span>
  ),
  div: ({ className, children, ...props }: any) => {
    if (className?.includes('math') || className?.includes('katex')) {
      return (
        <div className="overflow-x-auto w-full py-2 my-2 text-center" {...props}>
          {children}
        </div>
      );
    }
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  },
};

/**
 * Prétraite le texte Markdown pour convertir proprement les notations LaTeX
 * (\( ... \), \[ ... \], et expressions \displaystyle sans délimiteurs)
 * en syntaxe standard $inline$ et $$bloc$$ reconnue par remark-math et rehype-katex,
 * sans jamais corrompre les formules contenant déjà des délimiteurs $ ou $$.
 */
function formatMarkdownMath(content: string): string {
  if (!content) return '';

  let formatted = content;

  // 1. Convertit les blocs LaTeX \[ ... \] en $$ ... $$
  formatted = formatted.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => `$$\n${math.trim()}\n$$`);

  // 2. Convertit les expressions LaTeX en ligne \( ... \) en $ ... $
  formatted = formatted.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => `$${math.trim()}$`);

  // 3. Détecte les lignes isolées débutant par \displaystyle sans $
  const lines = formatted.split('\n');
  const processed = lines.map(line => {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('```') ||
      trimmed.startsWith('>') ||
      /^[-*+]\s/.test(trimmed) ||
      /^\d+[.)]\s/.test(trimmed) ||
      trimmed.includes('$')
    ) {
      return line;
    }

    if (trimmed.startsWith('\\displaystyle') && !trimmed.includes('$')) {
      return `$$\n${trimmed}\n$$`;
    }
    if (
      trimmed.startsWith('\\begin{') &&
      !trimmed.includes('$') &&
      /\\end\{(?:matrix|pmatrix|bmatrix|cases|aligned|align|equation)\*?\}$/.test(trimmed)
    ) {
      return `$$\n${trimmed}\n$$`;
    }

    // Certains modèles renvoient directement « f(x)=... » avec des commandes
    // LaTeX, sans aucun délimiteur. On ne convertit que les lignes contenant
    // des marqueurs mathématiques explicites afin de préserver le Markdown.
    const contientCommandeLatex = /\\(?:frac|sqrt|sum|prod|int|lim|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|Delta|theta|lambda|mu|pi|sigma|omega|bigl|bigr|left|right)\b/.test(trimmed);
    const contientStructureMath = /[A-Za-z0-9)\]}]\s*[_^]\s*[A-Za-z0-9({[]/.test(trimmed);
    const contientEgalite = /[A-Za-z0-9)\]}]\s*=\s*[^=]/.test(trimmed);
    if ((contientCommandeLatex || contientStructureMath) && contientEgalite) {
      const indentation = line.match(/^\s*/)?.[0] || '';
      return `${indentation}$${trimmed}$`;
    }

    return line;
  });

  return processed.join('\n');
}

interface MarkdownErrorBoundaryProps {
  children: React.ReactNode;
  rawText: string;
}

interface MarkdownErrorBoundaryState {
  hasError: boolean;
}

/**
 * Barrière de sécurité pour isoler tout problème de rendu Markdown ou KaTeX.
 * En cas de formule mal formée, affiche le texte brut sans jamais crasher l'interface.
 */
class MarkdownErrorBoundary extends React.Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  constructor(props: MarkdownErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('Erreur interceptée par MarkdownErrorBoundary :', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-gray-100 text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap">
          {this.props.rawText}
        </div>
      );
    }
    return this.props.children;
  }
}

interface ThinkingAccordionProps {
  thinkingStatus?: string;
}

/**
 * Composant Accordéon repliable affiché pendant que KADERBOT réfléchit (live thinking).
 * Permet de cliquer sur "Réflexion" pour voir les détails en direct de l'étape de raisonnement.
 */
const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({ thinkingStatus }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col items-start space-y-1.5 animate-in fade-in max-w-full sm:max-w-xl">
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[11px] font-semibold text-emerald-400">KADERBOT NOVA</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <span className="text-[10px] text-gray-500 font-mono">Boucle ReAct active</span>
      </div>

      <div className="w-full bg-[#0E131F] border border-emerald-500/35 rounded-2xl p-2.5 sm:p-3 shadow-lg shadow-emerald-950/20">
        {/* En-tête de l'accordéon cliquable */}
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="w-full flex items-center justify-between gap-3 text-left group cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white tracking-wide">
                  Réflexion
                </span>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
              <p className="text-[11px] text-emerald-300/90 truncate font-medium mt-0.5">
                {thinkingStatus || 'Décomposition de la tâche et analyse des intentions...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-gray-400 group-hover:text-emerald-300 text-xs transition">
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              {isOpen ? 'Masquer' : 'Détails de l’étape'}
            </span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {/* Détails déroulants du raisonnement ReAct pendant la réflexion */}
        {isOpen && (
          <div className="mt-3 pt-3 border-t border-gray-800/80 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Workflow className="w-3 h-3" />
                Cycle ReAct (Jusqu'à 25 itérations)
              </span>
              <span>Étape en cours</span>
            </div>

            {/* Barre de progression visuelle animée */}
            <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
              <div className="h-full bg-linear-to-r from-emerald-500 via-cyan-400 to-emerald-400 animate-pulse w-3/4 rounded-full" />
            </div>

            {/* Décomposition des étapes du raisonnement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-lg bg-[#080B12] border border-gray-800/80">
                <div className="flex items-center gap-1.5 text-emerald-300 font-medium mb-0.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>1. Pensée (Thought)</span>
                </div>
                <p className="text-gray-400 text-[10px] leading-tight">
                  Décomposition du problème et formulation d'objectifs ciblés.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-[#080B12] border border-gray-800/80">
                <div className="flex items-center gap-1.5 text-cyan-300 font-medium mb-0.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>2. Action (Outils)</span>
                </div>
                <p className="text-gray-400 text-[10px] leading-tight">
                  Appel des outils : Mémoire cognitive, Brave Search ou lecture d'URLs.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-[#080B12] border border-gray-800/80">
                <div className="flex items-center gap-1.5 text-emerald-300 font-medium mb-0.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. Observation</span>
                </div>
                <p className="text-gray-400 text-[10px] leading-tight">
                  Extraction et examen rigoureux des faits et détection d'incidents.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-[#080B12] border border-gray-800/80">
                <div className="flex items-center gap-1.5 text-purple-300 font-medium mb-0.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>4. Adaptation</span>
                </div>
                <p className="text-gray-400 text-[10px] leading-tight">
                  Ajustement de stratégie et pivot vers la synthèse finale.
                </p>
              </div>
            </div>

            <div className="text-[10px] text-gray-500 italic text-center pt-1">
              KADERBOT adapte sa stratégie à chaque retour d'outil jusqu'à résolution complète.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface AgentTraceAccordionProps {
  toolTrace: ToolExecutionTrace[];
}

/**
 * Composant Accordéon repliable "Réflexion" pour afficher la décomposition ReAct complète dans le message du bot.
 * Replié par défaut avec intitulé "Réflexion : X étapes de raisonnement (ReAct)".
 * Déplie au clic la pensée, l'action, l'observation et l'adaptation de stratégie pour chaque étape.
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
      case 'create_note':
        return { label: 'Création de note', icon: '📝' };
      case 'search_notes':
        return { label: 'Recherche de notes', icon: '📚' };
      case 'create_event':
        return { label: 'Ajout Événement Agenda', icon: '📅' };
      case 'list_events':
        return { label: 'Consultation Agenda', icon: '🗓️' };
      case 'send_message':
        return { label: 'Messagerie', icon: '✉️' };
      case 'ask_user':
        return { label: 'Demande de Précision', icon: '❓' };
      default:
        return { label: toolName, icon: '⚙️' };
    }
  };

  return (
    <div className="mt-3 pt-2 border-t border-gray-800/70">
      {/* Bouton de l'accordéon Réflexion replié par défaut */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#0B0F19]/90 hover:bg-[#111726] border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition group text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-white">
            Réflexion
          </span>
          <span className="text-[11px] text-gray-400 font-normal">
            • {total} étape{total > 1 ? 's' : ''} de raisonnement (ReAct)
          </span>
          {failures > 0 ? (
            <span className="text-amber-400 text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/50">
              {failures} incident{failures > 1 ? 's' : ''} adapté{failures > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-emerald-400 text-[10px] font-medium hidden sm:inline">
              ✓ Stratégie validée
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-gray-400 group-hover:text-emerald-400 text-xs">
          <span className="text-[10px] text-gray-400 hidden sm:inline">
            {isOpen ? 'Masquer' : 'Voir les détails'}
          </span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Contenu déroulant avec la décomposition ReAct pas à pas */}
      {isOpen && (
        <div className="mt-2 p-3 rounded-xl bg-[#070A11] border border-gray-800/80 space-y-3 animate-in fade-in duration-150">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 flex items-center justify-between pb-1 border-b border-gray-800/60">
            <span className="flex items-center gap-1 text-emerald-400">
              <Workflow className="w-3 h-3" />
              Détails du raisonnement ReAct
            </span>
            <span className="text-gray-400 font-mono">
              {total} / 25 itérations max
            </span>
          </div>

          <div className="space-y-3">
            {toolTrace.map((trace, idx) => {
              const meta = getToolMeta(trace.tool);
              const isError = trace.status === 'error' || Boolean(trace.errorMsg);
              const traceUrl = typeof trace.args?.url === 'string' ? trace.args.url : '';
              const isUrl = trace.tool === 'open_url' && traceUrl;
              let hostname = '';
              if (isUrl) {
                try {
                  hostname = new URL(traceUrl).hostname.replace(/^www\./, '');
                } catch {
                  hostname = traceUrl;
                }
              }

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs space-y-2 ${
                    isError
                      ? 'bg-rose-950/15 border-rose-900/40 text-rose-200'
                      : 'bg-[#0E131F] border-gray-800/90 text-gray-300'
                  }`}
                >
                  {/* En-tête de l'étape */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-gray-800 text-emerald-300 font-mono font-bold text-[10px]">
                        Étape #{trace.step || idx + 1}
                      </span>
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
                            <span>Incident adapté</span>
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

                  {/* 1. Pensée (Thought / Décomposition de la tâche) */}
                  {trace.thought && (
                    <div className="p-2 rounded-lg bg-black/40 border border-gray-800/70 text-[11px] text-gray-300 space-y-0.5">
                      <div className="flex items-center gap-1 text-amber-300/90 font-medium text-[10px]">
                        <Lightbulb className="w-3 h-3 text-amber-400" />
                        <span>Pensée & Décomposition</span>
                      </div>
                      <p className="text-gray-200 italic leading-relaxed">
                        {trace.thought}
                      </p>
                    </div>
                  )}

                  {/* 2. Action (Paramètres de l'outil) */}
                  {trace.args && (
                    <div className="text-[11px] text-gray-400 pl-2.5 border-l-2 border-emerald-500/50">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-0.5">
                        Action exécutée :
                      </span>
                      {trace.args.query && (
                        <div>
                          <span className="text-gray-500">Recherche : </span>
                          <span className="text-cyan-200 font-medium">« {trace.args.query} »</span>
                        </div>
                      )}
                      {isUrl && (
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          <span className="text-gray-500">Source : </span>
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

                  {/* 3. Observation (Résultats ou Incident) */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5 text-gray-400" />
                      Observation :
                    </span>
                    {isError && trace.errorMsg ? (
                      <div className="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300 font-sans flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <div>
                          <span className="font-semibold text-rose-200">Incident intercepté : </span>
                          <span>{trace.errorMsg}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-gray-400 bg-black/40 px-2 py-1 rounded border border-gray-800/60 truncate">
                        {trace.observation || trace.resultSnippet || 'Données collectées avec succès.'}
                      </div>
                    )}
                  </div>

                  {/* 4. Stratégie & Adaptation (Réflexion de suite) */}
                  {trace.strategy && (
                    <div className="p-1.5 rounded bg-[#131926]/60 border border-gray-800/60 text-[11px] text-purple-200 flex items-start gap-1.5">
                      <Compass className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-medium text-purple-300 text-[10px] block">
                          Adaptation de la stratégie :
                        </span>
                        <p className="text-gray-300 text-[10px] leading-tight mt-0.5">
                          {trace.strategy}
                        </p>
                      </div>
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

interface AgentActionApprovalProps {
  action: PendingAgentAction;
  onDecision: (actionId: string, decision: 'approve' | 'reject') => Promise<void>;
}

const AgentActionApproval: React.FC<AgentActionApprovalProps> = ({ action, onDecision }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);

  const handleDecision = async (nextDecision: 'approve' | 'reject') => {
    if (isProcessing || decision) return;
    setIsProcessing(true);
    setDecision(nextDecision);
    try {
      await onDecision(action.id, nextDecision);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-amber-500/30">
      <div className="rounded-xl bg-amber-950/30 border border-amber-500/40 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-200">Confirmation nécessaire</p>
            <p className="text-[11px] text-amber-100/80 mt-1 break-words">{action.summary}</p>
            <p className="text-[10px] text-gray-500 mt-1">Cette demande expire dans quelques minutes.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            disabled={isProcessing || Boolean(decision)}
            onClick={() => void handleDecision('approve')}
            className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition"
          >
            {decision === 'approve' && isProcessing ? 'Approbation...' : 'Approuver'}
          </button>
          <button
            type="button"
            disabled={isProcessing || Boolean(decision)}
            onClick={() => void handleDecision('reject')}
            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-rose-900/70 border border-gray-700 disabled:opacity-50 text-gray-200 text-xs font-semibold transition"
          >
            {decision === 'reject' && isProcessing ? 'Refus...' : 'Refuser'}
          </button>
        </div>
      </div>
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
  onAgentActionDecision?: (actionId: string, decision: 'approve' | 'reject') => Promise<void>;
  onRegenerateMessage?: (text: string) => void;
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
  onAgentActionDecision,
  onRegenerateMessage,
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'auto',
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isThinking]);

  // La zone de message grandit avec le texte sans dépasser une hauteur confortable sur mobile.
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [inputText]);

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

  const sendCurrentMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isThinking) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleRegenerate = () => {
    if (isThinking) return;
    const lastUserMessage = [...messages].reverse().find(message => message.author === 'Toi');
    if (lastUserMessage?.text?.trim()) {
      if (onRegenerateMessage) {
        onRegenerateMessage(lastUserMessage.text.trim());
      } else {
        onSendMessage(lastUserMessage.text.trim());
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendCurrentMessage();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Entrée seule = retour à la ligne. Ctrl/Cmd + Entrée = envoi rapide.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendCurrentMessage();
    }
  };

  const handleScrollUnits = (direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      const amount = direction === 'up' ? -250 : 250;
      scrollContainerRef.current.scrollBy({ top: amount, behavior: 'smooth' });
    }
  };

  const quickPills = isAdmin
    ? [
        { label: 'C’est quoi...', text: "c'est quoi " },
        { label: 'Pourquoi...', text: 'pourquoi ' },
        { label: 'Retenir un fait', text: 'retiens: ' },
        { label: 'Règle tous les...', text: 'retiens: tous les ' },
        { label: 'Lier concepts', text: 'lie: ' },
        { label: 'Générer idées', text: 'idees 5: ' },
        { label: 'Traduire', text: 'traduis en anglais: ' },
        { label: 'Lister mémoire', text: 'lister: memoire' },
      ]
    : [
        { label: 'Poser une question', text: 'Je voudrais savoir ' },
        { label: 'Explique-moi', text: 'Explique-moi ' },
        { label: 'Créer une note', text: 'Crée une note : ' },
        { label: 'Aide-moi à rédiger', text: 'Aide-moi à rédiger ' },
        { label: 'Recherche une information', text: 'Recherche une information sur ' },
      ];

  const activeThread = (threads || []).find(t => t.id === activeThreadId);
  const hasMessages = messages.length > 0;

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
    <div className={`flex-1 flex flex-col h-full min-h-0 relative overflow-hidden bg-[#050508] ${isAdmin ? 'cyber-bg' : 'public-bg'}`}>
      {/* Header public modernisé ; le header admin reste volontairement inchangé. */}
      <div className="shrink-0 flex-shrink-0 px-3 sm:px-4 py-2.5 bg-[#090B10]/95 border-b border-gray-800/80 flex items-center justify-between gap-2 z-10">
      {isAdmin ? (
        <>
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
            <div className="min-w-0 flex items-center gap-1.5 text-xs text-gray-400">
              <span className="hidden sm:inline text-gray-700">|</span>
              <span className="truncate font-medium text-gray-300 max-w-[130px] sm:max-w-[280px]">
                {activeThread ? activeThread.title : 'Nouvelle discussion'}
              </span>
            </div>
          </div>
          <button
            onClick={onNewThread}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition active:scale-95 shrink-0 shadow-xs"
            title="Démarrer une nouvelle discussion vierge"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nouvelle discussion</span>
          </button>
        </>
      ) : (
      <>
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-2 rounded-xl bg-[#161822] hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 text-gray-300 hover:text-emerald-300 transition active:scale-95 shrink-0"
            title="Ouvrir l'historique des discussions"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-2 min-w-0 px-2.5 py-1.5 rounded-xl bg-[#161822]/80 border border-gray-800/80 text-[11px] sm:text-xs text-gray-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Session cognitive : {activeSession === 'defaut' ? 'défaut' : activeSession}</span>
          </div>
        </div>

        {hasMessages && (
          <button
            onClick={onNewThread || onClearMessages}
            className="p-2 rounded-xl bg-[#161822] hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 text-gray-300 hover:text-emerald-300 transition active:scale-95 shrink-0"
            title="Démarrer une nouvelle discussion"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
        )}
      </>
      )}
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
        style={{ overflowAnchor: 'none' }}
        className="flex-1 overflow-y-auto min-h-0 px-4 py-4 sm:px-6 sm:py-6 overscroll-contain [overflow-anchor:none]"
      >
        <div className="max-w-4xl mx-auto w-full min-h-full flex flex-col">
          {!isAdmin && !hasMessages ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pb-10 sm:pb-16">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl animate-pulse-glow" />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-emerald-400/70 bg-[#0E131F] flex items-center justify-center shadow-[0_0_35px_rgba(16,163,127,0.28)]">
                  <Brain className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400 animate-pulse" strokeWidth={1.5} />
                </div>
              </div>
              <h1 className="max-w-xl text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-gray-100 leading-tight">
                Bonjour Kader Gadiaga, que fait-on aujourd'hui avec KaderBot ?
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-gray-500">Ton assistant personnel, prêt à t’aider.</p>
            </div>
          ) : (
          <>
          {isAdmin && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900/80 border border-gray-800 text-[11px] text-gray-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Session cognitive : {activeSession === 'defaut' ? 'défaut' : activeSession}</span>
              </div>
            </div>
          )}
          {/* Message bubbles */}
          <div className="space-y-4 sm:space-y-6">
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
                  {isAdmin && !isUser && msg.meta?.source && (
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
                  {isAdmin && !isUser && msg.meta?.isFallback && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/70 text-amber-300 border border-amber-500/40 cursor-help"
                      title={msg.meta.fallbackReason || 'Mode dégradé sans recherche'}
                    >
                      ⚠️ Mode dégradé (sans recherche)
                    </span>
                  )}
                  <span className="text-gray-600 text-[10px]">{msg.timestamp}</span>
                </div>

                {/* Message presentation: User Bubble vs Bot Free Flow (DeepSeek style) */}
                {isUser ? (
                  /* Utilisateur : Bulle alignée à droite, max-w-[85%], bg-[#1E2028], rounded-2xl, bordure */
                  <div className="relative max-w-[85%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm leading-relaxed shadow-lg bg-[#1E2028] text-white border border-gray-700/60 rounded-tr-sm">
                    <div className="whitespace-pre-wrap break-words">{msg.text || ''}</div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text || '')}
                        className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px]"
                        title="Copier le texte"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Bot : Style DeepSeek - aucun fond, aucune bordure, aucun padding de boîte, avec fondu doux */
                  <div className="relative w-full max-w-none bg-transparent px-0 py-2 text-xs sm:text-sm leading-relaxed text-gray-100 animate-in fade-in duration-500 animate-fade-in">
                    {/* Main text with Markdown & KaTeX LaTeX math */}
                    <div className="text-gray-100 text-xs sm:text-sm leading-relaxed break-words">
                      <MarkdownErrorBoundary rawText={msg.text || ''}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                          components={markdownComponents}
                        >
                          {formatMarkdownMath((msg.text && msg.text.trim()) || '')}
                        </ReactMarkdown>
                      </MarkdownErrorBoundary>
                    </div>

                    {/* Traces d'exécution de l'agent repliées par défaut sous forme d'accordéon propre */}
                    {isAdmin && !isUser && msg.meta?.toolTrace && msg.meta.toolTrace.length > 0 && (
                      <AgentTraceAccordion toolTrace={msg.meta.toolTrace} />
                    )}

                    {/* Deductive chain visual crumb if applicable */}
                    {isAdmin && !isUser && msg.meta?.chemin && msg.meta.chemin.length > 1 && (
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

                    {/* Barre d’outils discrète sous la réponse : audio, copie, feedback et régénération. */}
                    <div className={`mt-2 flex items-center gap-1 text-gray-500 opacity-60 hover:opacity-100 transition-opacity ${isAdmin ? 'hidden' : ''}`}>
                      <button
                        onClick={() => handleCopy(msg.id, msg.text || '')}
                        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
                        title="Copier le texte"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => speakText(msg.text || '')}
                        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
                        title="Lire à haute voix"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => msg.meta?.sujet && onAdjustWeight(msg.meta.sujet, 0.1)}
                        className="p-1.5 rounded-lg hover:bg-emerald-950/60 text-gray-400 hover:text-emerald-300 transition"
                        title="Réponse utile"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => msg.meta?.sujet && onAdjustWeight(msg.meta.sujet, -0.15)}
                        className="p-1.5 rounded-lg hover:bg-rose-950/60 text-gray-400 hover:text-rose-300 transition"
                        title="Réponse à améliorer"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      {msg.id === [...messages].reverse().find(message => message.author !== 'Toi')?.id && (
                        <button
                          onClick={handleRegenerate}
                          disabled={isThinking}
                          className="p-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-40 text-gray-400 hover:text-white transition"
                          title="Régénérer cette réponse"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="mt-2 flex items-center gap-2 text-gray-500 opacity-60 hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(msg.id, msg.text || '')}
                          className="px-2 py-1 rounded bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white text-[11px] flex items-center gap-1.5 transition"
                          title="Copier le texte"
                        >
                          {copiedId === msg.id ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copié</span></> : <><Copy className="w-3 h-3" /><span>Copier</span></>}
                        </button>
                        <button
                          onClick={() => speakText(msg.text || '')}
                          className="px-2 py-1 rounded bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white text-[11px] flex items-center gap-1.5 transition"
                          title="Lire à haute voix"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Écouter</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Fenêtre Accordéon repliable "Réflexion" pendant le raisonnement */}
          {isThinking && (
            <ThinkingAccordion thinkingStatus={isAdmin ? thinkingStatus : 'Je réfléchis à ta demande...'} />
          )}
          </div>
          </>
          )}

          <div ref={messagesEndRef} />
        </div>
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
      <div className="shrink-0 flex-shrink-0 px-3 sm:px-6 py-2 border-t border-gray-800/60 bg-[#090B10]/90 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
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
        {isAdmin ? (
        <form onSubmit={handleFormSubmit} className="max-w-7xl mx-auto flex items-center gap-2">
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
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Pose une question, écris 'pourquoi...', ou 'retiens: sujet = définition'..."
              className="w-full max-h-32 min-h-[42px] resize-none overflow-y-auto bg-[#161822] border border-gray-800 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/40 transition active:scale-95"
          >
            {isThinking ? <Loader2 className="w-4 h-4 animate-spin text-emerald-200" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">{isThinking ? 'Réflexion...' : 'Envoyer'}</span>
          </button>
          <button
            type="button"
            onClick={onNewThread || onClearMessages}
            className="p-2.5 sm:p-3 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/40 transition active:scale-95"
            title="Démarrer une nouvelle discussion"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
        ) : (
        <form onSubmit={handleFormSubmit} className="max-w-4xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl bg-[#161822] border border-gray-800 px-2 py-2 shadow-inner focus-within:border-emerald-500/50 transition">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={isAdmin ? "Pose une question, écris 'pourquoi...', ou 'retiens: sujet = définition'..." : 'Écris ton message...'}
              className="flex-1 w-full max-h-32 min-h-[42px] resize-none overflow-y-auto bg-transparent px-2 py-2 text-xs sm:text-sm leading-relaxed text-white placeholder-gray-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-2.5 rounded-xl transition-all shrink-0 ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
              title={isRecording ? 'Arrêter dictée' : 'Dicter vocalement en français'}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            {inputText.trim() && (
              <button
                type="submit"
                disabled={isThinking}
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-md shadow-emerald-950/40 transition active:scale-95 shrink-0"
                title={isThinking ? 'KaderBot réfléchit...' : 'Envoyer'}
              >
                {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            )}
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
