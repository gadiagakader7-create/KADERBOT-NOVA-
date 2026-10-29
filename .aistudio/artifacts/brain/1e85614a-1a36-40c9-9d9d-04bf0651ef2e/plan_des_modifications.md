# Plan Détaillé des Modifications — KADERBOT NOVA

## 1. Problématiques Résolues

### A. Refonte de l'Interface Utilisateur (UI Épurée)
- **Problème initial** : Affichage anarchique des logs techniques, tableaux de données brutes, messages d'erreurs HTTP 403 dans le fil principal de discussion.
- **Solution appliquée** :
  - **Composant `AgentTraceAccordion`** replié par défaut.
  - Bouton résumé discret : `⚙️ X actions exécutées (Y échecs) — Voir les détails`.
  - Au clic, déploiement d'une timeline ordonnée des étapes (`#1`, `#2`...) avec badges de statut (`✓ Succès` ou `✕ Échec`), durée d'exécution en ms, requêtes/URLs cliquables et extraits pertinents.
  - Le fil de discussion principal se focalise exclusivement sur le message utilisateur et le rapport synthétique formaté en Markdown.

### B. Indicateur de Chargement Réactif
- **Problème initial** : Gel apparent ou messages génériques lors des recherches longues ou des commandes "Continue".
- **Solution appliquée** :
  - Bulle de statut animée avec pulsation, rebond fluide et message contextuel dynamique :
    - `Recherche et réflexion en cours...`
    - `Agent KADERBOT : exploration des sources et vérification...`
    - `Poursuite de la recherche et synthèse en cours...` (sur commande "Continue").

### C. Élimination des Erreurs HTTP 403 (Forbidden)
- **Problème initial** : Blocage anti-bot (Cloudflare, serveurs d'actualités) renvoyant des 403 lors de l'appel à `open_url`.
- **Solution appliquée** :
  - Headers HTTP complets simulant un navigateur Chrome 130 sur Windows (`Sec-Ch-Ua`, `Accept-Language`, `User-Agent`).
  - Interception douce des codes 403/401 et challenges Cloudflare : pas de crash ni d'interruption. L'incident est tracé dans `toolTrace` avec une explication claire et le LLM est guidé vers d'autres sources.

### D. Optimisation des Délais et Commande "Continue"
- **Problème initial** : Boucles d'outils répétées et risques de timeout HTTP 504.
- **Solution appliquée** :
  - `MAX_AGENT_ITERATIONS = 4`.
  - Limite globale d'exécution de boucle fixée à 25 secondes (`MAX_LOOP_DURATION_MS = 25000`).
  - Timeouts stricts avec `AbortController` (6s sur Brave Search, 6s sur `open_url`, 14s sur les appels LLM, 45s sur le client frontend).
  - Détection prioritaire des mots-clés de continuation (`continue`, `suite`, `poursuis`) orientés directement vers la synthèse finale sans ré-itérations superflues.

---

## 2. Fichiers Modifiés
1. `src/types/kaderbot.ts` : Ajout du type `ToolExecutionTrace` et enrichissement de `ChatMessage.meta`.
2. `src/services/apiService.ts` : AbortController 45s, support du typage enrichi pour `toolTrace`.
3. `server.ts` : Headers desktop anti-blocage, gestion des 403, boucle agentique sécurisée (25s max, 4 itérations max).
4. `src/components/ChatTab.tsx` : Intégration du composant `AgentTraceAccordion` et refonte de l'indicateur de chargement.
5. `src/App.tsx` : Gestion de l'état `thinkingStatus` et transmission au composant `ChatTab`.
