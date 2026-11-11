# Plan des Modifications — Architecture Modulaire & Boucle ReAct (KADERBOT NOVA)

## 1. Découpage et Modularisation Complète de `server.ts`

Pour alléger le code de `server.ts` (qui dépassait initialement 800 lignes) sans casser la logique ni les fonctions déjà opérationnelles, nous avons extrait chaque responsabilité dans un module dédié sous `src/server/` et `src/agent/` :

### A. Modules Extraits

1. **`src/server/storage.ts` (Gestionnaire de persistance)**
   - Gestion des chemins de stockage (`DATA_DIR`, `MEMORY_FILE`, `NOTES_FILE`, `ACTION_LOG_FILE`, `EVENTS_FILE`, `BRAVE_USAGE_FILE`).
   - Typages stricts : `KaderbotNote`, `AgentActionLog`, `KaderbotEvent`, `StorageData`.
   - Primitives de lecture/écriture résilientes et atomiques : `readStorageFile`, `writeStorageFile`, `readJsonArray`, `writeJsonArray`, `appendActionLog`.
   - Suivi des quotas journaliers de l'API Brave (`checkAndIncrementBraveQuota`, `loadBraveUsage`).

2. **`src/server/webSearch.ts` (Moteur de recherche Web et protection réseau)**
   - Filtrage anti-SSRF rigoureux (`isUrlForbidden`) : interdiction des adresses locales, RFC 1918 (10.x, 172.16-31.x, 192.168.x), loopback (127.x), link-local (169.254.x), AWS/GCP metadata, IPv6 privés.
   - Exécution Brave Search (`executeBraveSearch`) : appels vers Brave Web et Brave News API avec quota et timeout contrôlé.

3. **`src/server/llmProviders.ts` (Cascade de repli multi-fournisseurs)**
   - Résolution automatique des modèles (`resolveGroqModel`, `resolveOpenRouterModel`).
   - Cascade de repli sur 4 niveaux : **Groq primary** -> **Groq backup (20b/llama3-70b)** -> **OpenRouter** -> **Gemini Flash**.
   - Fonctions dédiées : `callGroqWithFallback`, `callOpenRouterWithFallback`, `callGeminiWithFallback`.
   - Prompt système complet par défaut (`DEFAULT_SYSTEM_PROMPT`).

4. **`src/server/middleware.ts` (Sécurité Express)**
   - Rate limiting par IP en mémoire glissante (`createAgentRateLimiter`).
   - Authentification administrateur timing-safe (`createRequireAdmin` avec `crypto.timingSafeEqual`) pour prévenir les attaques temporelles.

5. **`src/agent/intentClassifier.ts` (Routage cognitif rapide)**
   - Classification d'intention ultra-rapide via Groq 20B (`classifyIntentWithRouter`) : distingue instantanément les salutations/discussions directes (`CHAT`) des requêtes nécessitant des outils et de la recherche (`AGENT`).

6. **`server.ts` (Orchestrateur Principal épuré)**
   - Réduit à **~140 lignes** de code lisibles et maintenables.
   - Rôle exclusif d'orchestrateur : instancie Express, applique les middlewares, initialise Vite dev/prod, enregistre les routes via `registerHttpRoutes`, et démarre l'écoute sur le port 3000.

---

## 2. Boucle ReAct & Interface "Réflexion" (Rappel des Acquis)

### A. Boucle ReAct (25 Itérations)
- Cycle méthodique : **Pensée (Thought) -> Action (Tool) -> Observation (Result) -> Adaptation (Strategy)**.
- Outils disponibles : `memo_lookup`, `search_news`, `search_web`, `open_url` (avec User-Agent réaliste anti-403), `memo_store`, `link_concepts`, `ask_user`.
- Limites serveur sécurisées : 25 itérations max, 90 secondes de boucle ReAct, 120 secondes de timeout client HTTP.

### B. Interface Utilisateur & Accordéons Repliables
- **`ThinkingAccordion`** : Accordéon en direct avec points animés affichant la pensée en temps réel sans saturer le chat.
- **`AgentTraceAccordion`** : Accordéon sobre "🧠 Réflexion • X étapes de raisonnement" replié par défaut au-dessus de la réponse Markdown finale.

---

## 3. Matrice de Vérification et Tests Réalisés

- [x] **Compilation TypeScript (`tsc --noEmit`)** : 0 erreur.
- [x] **Bundle Vite (`npm run build`)** : Réussi en 1.19s.
- [x] **Vérification API Health (`GET /api/health`)** : Réponse `200 OK {"ok": true}`.
- [x] **Test Route Chat (`POST /api/agent`)** : Routage instantané vers Groq conversationnel.
- [x] **Test Route Agent Web (`POST /api/agent`)** : Exécution de recherche Brave, scraping, et synthèse ReAct complète.
- [x] **Artefacts à jour** : `kaderbot_code_source_complet.md` (450 KB) et `kaderbot_projet_complet.zip` (215 KB).
