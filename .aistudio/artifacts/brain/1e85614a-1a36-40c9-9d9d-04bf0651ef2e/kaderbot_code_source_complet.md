# Code Source Complet et Architecture — KADERBOT NOVA

## Architecture Globale

KADERBOT NOVA intègre une architecture cognitive hybride à 4 niveaux :
1. **Moteur Local Sémantique** : Vectorisation et recherche hybride (`rechercheHybride`) combinant filtrage par mots-clés et similarité cosinus via `@xenova/transformers`.
2. **Agent Autonome & Outils** : Boucle agentique sécurisée sur `/api/agent` (Groq `openai/gpt-oss-120b` et `openai/gpt-oss-20b`, OpenRouter, Gemini), capable de rechercher sur le web via Brave API, d'ouvrir des pages web avec `open_url`, d'interroger et de mémoriser des connaissances.
3. **UI Épurée avec Accordéon Repliable (`AgentTraceAccordion`)** :
   - Masquage des logs, tableaux bruts et erreurs techniques dans un accordéon fermé par défaut.
   - Résumé compact : `⚙️ X actions exécutées (Y échecs) — Voir les détails`.
   - Affichage principal recentré sur la synthèse et le rapport final.
4. **Résilience Réseau & Anti-Blocage** :
   - En-têtes réalistes Chrome 130 pour `open_url`.
   - Interception des erreurs 403 Forbidden sans planter l'agent.
   - Timeouts stricts (6s scraping, 14s modèles, 25s boucle totale, 45s client).
   - Traitement instantané des requêtes "Continue" pour éviter les boucles infinies.

## Téléchargement du Projet
L'archive complète du projet prêt à l'emploi est disponible dans l'artefact :
`kaderbot_projet_complet.zip` (200 Ko, incluant frontend React 19 / TypeScript, serveur Express, configuration Tailwind CSS et tests).
