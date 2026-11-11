import { checkAndIncrementBraveQuota } from './storage';

// Sécurité open_url : Liste de domaines et réseaux interdits (localhost, 127.0.0.1, adresses IP nues, *.internal, *.render.com)
export function isUrlForbidden(urlStr: string): { forbidden: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    // Protocole http ou https obligatoire
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { forbidden: true, reason: 'Protocole non autorisé (seuls http et https sont acceptés).' };
    }

    // Localhost
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return { forbidden: true, reason: 'Accès refusé : domaine localhost interdit.' };
    }

    // 127.0.0.1 ou boucle locale
    if (hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return { forbidden: true, reason: 'Accès refusé : adresse de bouclage locale interdite.' };
    }

    // Adresses IP nues (IPv4 standard ou IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(hostname)) {
      return { forbidden: true, reason: 'Accès refusé : adresses IP directes non autorisées.' };
    }
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      return { forbidden: true, reason: 'Accès refusé : adresses IPv6 directes non autorisées.' };
    }

    // *.internal
    if (hostname === 'internal' || hostname.endsWith('.internal')) {
      return { forbidden: true, reason: 'Accès refusé : réseaux internes (*.internal) non autorisés.' };
    }

    // *.render.com
    if (hostname === 'render.com' || hostname.endsWith('.render.com')) {
      return { forbidden: true, reason: 'Accès refusé : domaine de plateforme d’hébergement (*.render.com) interdit.' };
    }

    return { forbidden: false };
  } catch (err: any) {
    return { forbidden: true, reason: `URL invalide : ${err.message}` };
  }
}

// Helper pour exécuter une recherche sur l'API Brave (Search ou News)
export async function executeBraveSearch(
  query: string,
  isNews: boolean,
  customApiKey?: string
): Promise<string> {
  const apiKey = (customApiKey || process.env.BRAVE_SEARCH_API_KEY || '').trim();
  if (!apiKey) {
    return "Clé BRAVE_SEARCH_API_KEY non configurée sur le serveur. Impossible d'effectuer la recherche web.";
  }

  if (!checkAndIncrementBraveQuota(100)) {
    return "Quota de recherche atteint pour aujourd'hui.";
  }

  const endpoint = isNews
    ? 'https://api.search.brave.com/res/v1/news/search'
    : 'https://api.search.brave.com/res/v1/web/search';

  const url = `${endpoint}?q=${encodeURIComponent(query)}&count=5&country=fr&search_lang=fr`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      if (resp.status === 429) {
        return "Quota de recherche atteint pour aujourd'hui.";
      }
      return `Erreur Brave Search (HTTP ${resp.status} : ${resp.statusText}).`;
    }

    const data: any = await resp.json();
    const results = isNews ? (data.results || []) : (data.web?.results || []);

    if (!Array.isArray(results) || results.length === 0) {
      return `Aucun résultat ${isNews ? 'd’actualité' : 'web'} trouvé pour la requête : "${query}".`;
    }

    return results
      .slice(0, 5)
      .map((item: any, idx: number) => {
        const title = item.title || 'Sans titre';
        const itemUrl = item.url || '';
        const snippet = item.description || item.snippet || 'Pas de description';
        return `[${idx + 1}] ${title}\nURL: ${itemUrl}\nRésumé: ${snippet}`;
      })
      .join('\n\n');
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return "Erreur Délai d'attente dépassé (timeout 6s) pour la recherche Brave.";
    }
    return `Erreur réseau lors de la recherche Brave : ${err.message}`;
  }
}
