import { randomUUID } from 'crypto';

export type ToolImplementation = (args: Record<string, any>) => Promise<string>;

export interface ToolImplementationDeps {
  executeBraveSearch: (query: string, isNews: boolean) => Promise<string>;
  isUrlForbidden: (url: string) => { forbidden: boolean; reason?: string };
  readStorageFile: () => any;
  writeStorageFile: (data: any) => void;
  readJsonArray: <T>(filePath: string) => T[];
  writeJsonArray: <T>(filePath: string, data: T[]) => void;
  notesFile: string;
  eventsFile: string;
  telegramBotToken: string;
  telegramAllowedChatIds: Set<string>;
}

interface KaderbotEvent {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  location?: string;
  description?: string;
  createdAt: string;
}

interface KaderbotNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Implémentations concrètes des outils agentiques.
 * Les dépendances sont injectées pour garder la boucle ReAct indépendante du stockage et des APIs externes.
 */
export function createToolImplementations(deps: ToolImplementationDeps): Record<string, ToolImplementation> {
  const {
    executeBraveSearch,
    isUrlForbidden,
    readStorageFile,
    writeStorageFile,
    readJsonArray,
    writeJsonArray,
    notesFile,
    eventsFile,
    telegramBotToken,
    telegramAllowedChatIds,
  } = deps;

return {
  search_web: async ({ query }: { query?: string }) => {
    if (!query?.trim()) return 'Requête de recherche vide.';
    return await executeBraveSearch(query.trim(), false);
  },

  search_news: async ({ query }: { query?: string }) => {
    if (!query?.trim()) return 'Requête d’actualité vide.';
    return await executeBraveSearch(query.trim(), true);
  },

  open_url: async ({ url }: { url?: string }) => {
    if (!url?.trim()) return 'URL manquante.';
    const cleanUrl = url.trim();
    const check = isUrlForbidden(cleanUrl);
    if (check.forbidden) {
      return `Accès refusé : ${check.reason || 'Domaine interdit'}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(cleanUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        if (resp.status === 403 || resp.status === 401) {
          return `Erreur HTTP ${resp.status} (Accès refusé / Anti-bot) : Le site bloque l'accès automatique. Ignore cette URL et poursuis avec les autres sources disponibles.`;
        }
        return `Erreur HTTP ${resp.status} (${resp.statusText}) lors de l'accès à la page. Ignore cette URL et passe aux autres sources.`;
      }

      let html = await resp.text();

      // Détection de protection Cloudflare / Captcha
      if (
        html.includes('cf-browser-verification') ||
        html.includes('Cloudflare Ray ID') ||
        html.includes('Attention Required! | Cloudflare') ||
        html.includes('Just a moment...')
      ) {
        return `Erreur HTTP 403 (Challenge Cloudflare / Anti-bot) : Cette page nécessite une vérification interactive de navigateur. Ignore cette source et passe à une autre.`;
      }

      // Retirer les balises script, style, nav, footer, header et leur contenu
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
      html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
      html = html.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ');
      html = html.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');
      html = html.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ');

      let text = html.replace(/<[^>]+>/g, ' ');
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      text = text.replace(/\s+/g, ' ').trim();

      if (!text || text.length < 50) {
        return 'La page web ne contient aucun contenu textuel exploitable. Passe à une autre source.';
      }
      return text.slice(0, 5000);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return "Délai d'attente dépassé (timeout 6s) pour ouvrir la page web. Ignore cette URL et passe aux autres.";
      }
      return `Erreur lors de la lecture de la page (${err.message}). Ignore cette source.`;
    }
  },

  memo_lookup: async ({ sujet }: { sujet?: string }) => {
    if (!sujet?.trim()) return 'Sujet manquant pour memo_lookup.';
    const storage = readStorageFile();
    const q = sujet.trim().toLowerCase();

    // 1. Chercher dans memoire
    let directMatches: any[] = [];
    if (storage.memoire[q]) {
      directMatches = storage.memoire[q];
    } else {
      const matchingKey = Object.keys(storage.memoire).find(
        k => k.toLowerCase() === q || k.toLowerCase().includes(q) || q.includes(k.toLowerCase())
      );
      if (matchingKey) {
        directMatches = storage.memoire[matchingKey];
      }
    }

    // 2. Chercher les liens
    const links = storage.liens[q] || [];

    // 3. Chercher les règles
    const rules = storage.regles[q] || [];

    if (directMatches.length === 0 && links.length === 0 && rules.length === 0) {
      return `Aucune information trouvée dans la mémoire locale pour le sujet "${sujet}".`;
    }

    let out = `Informations mémoire locale pour "${sujet}" :\n`;
    if (directMatches.length > 0) {
      out += directMatches.map((m: any, idx: number) => `- Définition/Fait [${idx + 1}] : ${m.def || m}`).join('\n') + '\n';
    }
    if (links.length > 0) {
      out += `- Héritage / Liens : ${links.join(', ')}\n`;
    }
    if (rules.length > 0) {
      out += `- Règles logiques : ${rules.map((r: any) => `${r.quant} sont ${r.prop}`).join('; ')}\n`;
    }
    return out.trim();
  },

  search_notes: async ({ query, limit = 10 }: { query?: string; limit?: number }) => {
    if (!query?.trim()) return 'Requête de notes vide.';
    const q = query.trim().toLowerCase();
    const notes = readJsonArray<KaderbotNote>(notesFile)
      .filter(note => `${note.title} ${note.body} ${note.tags.join(' ')}`.toLowerCase().includes(q))
      .slice(-(Math.min(Math.max(Number(limit) || 10, 1), 20)));
    if (notes.length === 0) return `Aucune note trouvée pour « ${query.trim()} ».`;
    return notes
      .map(note => `- ${note.title}${note.tags.length ? ` [${note.tags.join(', ')}]` : ''}\n  ${note.body.slice(0, 500)} (id: ${note.id})`)
      .join('\n');
  },

  list_events: async ({ start_iso, end_iso, limit = 20 }: { start_iso?: string; end_iso?: string; limit?: number }) => {
    const start = Date.parse(String(start_iso || ''));
    const end = Date.parse(String(end_iso || ''));
    if (Number.isNaN(start) || Number.isNaN(end)) return 'Dates ISO invalides.';
    const events = readJsonArray<KaderbotEvent>(eventsFile)
      .filter(event => Date.parse(event.startIso) < end && Date.parse(event.endIso) > start)
      .sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso))
      .slice(0, Math.min(Math.max(Number(limit) || 20, 1), 50));
    if (events.length === 0) return 'Aucun événement trouvé dans cette période.';
    return events
      .map(event => `- ${event.title} : ${event.startIso} → ${event.endIso}${event.location ? ` | ${event.location}` : ''}`)
      .join('\n');
  },

  create_event: async ({ title, start_iso, end_iso, location, description }: { title?: string; start_iso?: string; end_iso?: string; location?: string; description?: string }) => {
    if (!title?.trim() || !start_iso || !end_iso) return 'Titre et dates requis pour l’événement.';
    const event: KaderbotEvent = {
      id: randomUUID(),
      title: title.trim(),
      startIso: new Date(start_iso).toISOString(),
      endIso: new Date(end_iso).toISOString(),
      location: location?.trim() || undefined,
      description: description?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const events = readJsonArray<KaderbotEvent>(eventsFile);
    events.push(event);
    writeJsonArray(eventsFile, events.slice(-1000));

    const toCalendarDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const calendarUrl = new URL('https://calendar.google.com/calendar/render');
    calendarUrl.searchParams.set('action', 'TEMPLATE');
    calendarUrl.searchParams.set('text', event.title);
    calendarUrl.searchParams.set('dates', `${toCalendarDate(event.startIso)}/${toCalendarDate(event.endIso)}`);
    if (event.location) calendarUrl.searchParams.set('location', event.location);
    if (event.description) calendarUrl.searchParams.set('details', event.description);
    return `Événement « ${event.title} » créé. Ajoute-le à ton agenda Google ici : ${calendarUrl.toString()}`;
  },

  create_note: async ({ title, body, tags = [] }: { title?: string; body?: string; tags?: string[] }) => {
    if (!title?.trim() || !body?.trim()) return 'Titre et contenu requis pour créer une note.';
    const now = new Date().toISOString();
    const note: KaderbotNote = {
      id: randomUUID(),
      title: title.trim(),
      body: body.trim(),
      tags: Array.isArray(tags) ? tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 20) : [],
      createdAt: now,
      updatedAt: now,
    };
    const notes = readJsonArray<KaderbotNote>(notesFile);
    notes.push(note);
    writeJsonArray(notesFile, notes.slice(-1000));
    return `Note « ${note.title} » créée avec succès.`;
  },

  send_message: async ({ channel, target, text }: { channel?: string; target?: string; text?: string }) => {
    if (!channel || !target?.trim() || !text?.trim()) return 'Canal, destinataire et texte requis.';
    if (channel === 'whatsapp') {
      const shareUrl = `https://wa.me/?text=${encodeURIComponent(text.trim())}`;
      return `Message WhatsApp préparé pour ${target.trim()} (aucun envoi automatique). Ouvre ce lien puis appuie sur Envoyer : ${shareUrl}`;
    }
    if (channel === 'telegram') {
      if (!telegramBotToken) return 'TELEGRAM_BOT_TOKEN n’est pas configuré sur Render.';
      if (!telegramAllowedChatIds.has(target.trim())) return `Le chat Telegram ${target.trim()} n’est pas autorisé par l’allowlist.`;
      const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: target.trim(), text: text.trim() }),
      });
      const payload: any = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) return `Échec Telegram : ${payload?.description || `HTTP ${response.status}`}`;
      return `Message Telegram envoyé à ${target.trim()}.`;
    }
    return 'L’envoi SMS n’est pas disponible depuis la Web App. Utilise un lien sms: ou un compagnon Android.';
  },

  memo_store: async ({ sujet, definition }: { sujet?: string; definition?: string }) => {
    if (!sujet?.trim() || !definition?.trim()) {
      return 'Sujet ou définition manquant pour memo_store.';
    }
    const storage = readStorageFile();
    const key = sujet.trim().toLowerCase();
    if (!storage.memoire[key]) {
      storage.memoire[key] = [];
    }

    const now = new Date().toISOString();
    storage.memoire[key].push({
      def: definition.trim(),
      poids: 1.0,
      hits: 1,
      source: 'agent',
      type: 'concept',
      created: now,
      last_used: now,
    });

    writeStorageFile(storage);
    return `Le fait "${sujet}" a été mémorisé avec succès dans la mémoire cognitive locale.`;
  },

  link_concepts: async ({ source, cible }: { source?: string; cible?: string }) => {
    if (!source?.trim() || !cible?.trim()) {
      return 'Source ou cible manquante pour link_concepts.';
    }
    const storage = readStorageFile();
    const sKey = source.trim().toLowerCase();
    const cKey = cible.trim().toLowerCase();

    if (!storage.liens[sKey]) {
      storage.liens[sKey] = [];
    }

    if (!storage.liens[sKey].includes(cKey)) {
      storage.liens[sKey].push(cKey);
      writeStorageFile(storage);
      return `Lien d'héritage enregistré : "${source}" est un/une "${cible}".`;
    }
    return `Le lien d'héritage "${source}" -> "${cible}" existait déjà.`;
  },

  ask_user: async ({ question }: { question?: string }) => {
    return `Question posée à l'utilisateur : ${question || 'Pouvez-vous préciser votre demande ?'}`;
  },
};
}
