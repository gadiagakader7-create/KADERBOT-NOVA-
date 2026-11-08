# Code Source Complet et Architecture ReAct — KADERBOT NOVA

## Architecture Globale & Boucle ReAct

KADERBOT NOVA est équipé d'une boucle agentique avancée fondée sur le paradigme **ReAct (Reasoning + Acting)** :

### 1. Boucle ReAct Étendue (25 Itérations Max)
- **Pensée (Thought)** : Découpage méthodique de la tâche complexe, identification des manques d'informations et hypothèses de recherche.
- **Action** : Choix de l'outil approprié (`memo_lookup`, `search_news`, `search_web`, `open_url`, `memo_store`, `link_concepts`, `ask_user`).
- **Observation** : Constat sur les retours d'outils, détection des succès ou d'erreurs (403, protection anti-bot).
- **Adaptation de la Stratégie (Reflection)** : Réorientation immédiate sans blocage pour atteindre la réponse synthétique optimale.
- Capacité poussée jusqu'à **25 itérations** avec timeout de sécurité à 90 secondes côté serveur et 120 secondes côté client.

### 2. Interface Utilisateur & Accordéon "Réflexion"
- **Pendant la génération (live)** : Composant `ThinkingAccordion` affichant **"🧠 Réflexion"**, points pulsants et statut dynamique. Le clic déplie la vue détaillée des 4 étapes du cycle ReAct et la progression.
- **Dans le message final** : Composant `AgentTraceAccordion` replié sous l'intitulé **"🧠 Réflexion • X étapes de raisonnement (ReAct)"**. Au clic, l'utilisateur inspecte chaque étape avec la pensée de l'agent, l'action exécutée, l'observation et l'adaptation de stratégie.

### 3. Archive Complète
L'archive complète et fonctionnelle du projet est disponible dans l'artefact :
`kaderbot_projet_complet.zip` (203 Ko, incluant frontend React 19, TypeScript, Express, shims ESM et configuration Tailwind).
