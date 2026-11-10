import { randomUUID } from 'crypto';
import { TOOL_POLICIES } from './toolRegistry';
import type { PendingAgentAction } from '../types/agent';

export type PendingActionStore = Pick<Map<string, PendingAgentAction>, 'set'>;

export interface PendingActionOptions {
  ttlMs: number;
  store: PendingActionStore;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Valide les arguments avant toute exécution d’outil, y compris après approbation. */
export function validateToolArguments(tool: string, args: Record<string, unknown>): string | null {
  const policy = TOOL_POLICIES[tool];
  if (!policy) return `Outil non autorisé : ${tool}`;

  if (tool === 'search_web' || tool === 'search_news' || tool === 'memo_lookup') {
    const key = tool === 'memo_lookup' ? 'sujet' : 'query';
    if (!isNonEmptyString(args[key]) || String(args[key]).length > 500) return `Paramètre ${key} invalide.`;
  }
  if (tool === 'search_notes' && (!isNonEmptyString(args.query) || String(args.query).length > 500)) return 'Paramètre query invalide.';
  if (tool === 'list_events') {
    if (!isNonEmptyString(args.start_iso) || !isNonEmptyString(args.end_iso)) return 'Période de recherche requise.';
    if (Number.isNaN(Date.parse(String(args.start_iso))) || Number.isNaN(Date.parse(String(args.end_iso)))) return 'Dates ISO invalides.';
  }
  if (tool === 'create_event') {
    if (!isNonEmptyString(args.title) || !isNonEmptyString(args.start_iso) || !isNonEmptyString(args.end_iso)) return 'Titre et dates requis pour l’événement.';
    const start = Date.parse(String(args.start_iso));
    const end = Date.parse(String(args.end_iso));
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 'Période de l’événement invalide.';
    if (String(args.title).length > 200) return 'Titre d’événement trop long.';
  }
  if (tool === 'open_url' && (!isNonEmptyString(args.url) || String(args.url).length > 2048)) return 'Paramètre url invalide.';
  if (tool === 'memo_store' && (!isNonEmptyString(args.sujet) || !isNonEmptyString(args.definition))) return 'Sujet et définition requis.';
  if (tool === 'link_concepts' && (!isNonEmptyString(args.source) || !isNonEmptyString(args.cible))) return 'Source et cible requises.';
  if (tool === 'ask_user' && (!isNonEmptyString(args.question) || String(args.question).length > 500)) return 'Question invalide.';

  if (tool === 'create_note') {
    if (!isNonEmptyString(args.title) || !isNonEmptyString(args.body)) return 'Titre et contenu requis pour la note.';
    if (String(args.title).length > 200 || String(args.body).length > 10000) return 'Note trop longue.';
    if (args.tags !== undefined && (!Array.isArray(args.tags) || args.tags.some(tag => !isNonEmptyString(tag)))) return 'Tags invalides.';
  }

  if (tool === 'send_message') {
    if (!['sms', 'telegram', 'whatsapp'].includes(String(args.channel))) return 'Canal de message non autorisé.';
    if (!isNonEmptyString(args.target) || !isNonEmptyString(args.text)) return 'Destinataire et texte requis.';
    if (String(args.text).length > 4000) return 'Message trop long.';
    if ((args.channel === 'sms' || args.channel === 'telegram') && args.confirm !== true) return 'Confirmation explicite requise pour ce canal.';
  }
  return null;
}

export function summarizePendingAction(tool: string, args: Record<string, unknown>): string {
  if (tool === 'memo_store') return `Mémoriser « ${String(args.sujet)} » : ${String(args.definition).slice(0, 180)}`;
  if (tool === 'link_concepts') return `Créer le lien « ${String(args.source)} » → « ${String(args.cible)} »`;
  if (tool === 'create_note') return `Créer la note « ${String(args.title)} »`;
  if (tool === 'send_message') return `Envoyer un message ${String(args.channel)} à ${String(args.target)} : « ${String(args.text).slice(0, 180)} »`;
  if (tool === 'create_event') return `Créer l’événement « ${String(args.title || 'sans titre')} »`;
  return `Autoriser l’action ${tool}`;
}

export function createPendingAction(
  tool: string,
  args: Record<string, unknown>,
  options: PendingActionOptions
): PendingAgentAction {
  const action: PendingAgentAction = {
    id: randomUUID(),
    tool,
    args,
    summary: summarizePendingAction(tool, args),
    risk: TOOL_POLICIES[tool]?.risk === 'external' ? 'external' : 'write',
    expiresAt: new Date(Date.now() + options.ttlMs).toISOString(),
  };
  options.store.set(action.id, action);
  return action;
}
