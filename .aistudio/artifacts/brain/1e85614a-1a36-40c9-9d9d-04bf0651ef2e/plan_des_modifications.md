# Plan des Modifications — Boucle ReAct & Accordéon "Réflexion" (KADERBOT NOVA)

## 1. Objectifs Réalisés

### A. Intégration de la Boucle de Raisonnement ReAct (Reasoning + Acting)
- **Principe ReAct appliqué** :
  1. **Pensée (Thought)** : Décomposition de la tâche en sous-objectifs, analyse de l'état actuel et formulation de l'hypothèse de travail.
  2. **Action** : Sélection et appel de l'outil approprié (`memo_lookup`, `search_news`, `search_web`, `open_url`, `memo_store`, `link_concepts`, `ask_user`).
  3. **Observation** : Analyse rigoureuse des données retournées par l'outil ou constat des incidents (ex: protection 403, timeout).
  4. **Adaptation de la Stratégie (Reflection)** : Réajustement dynamique de la démarche (pivot vers d'autres URLs en cas de blocage, affinement des mots-clés, synthèse dès que les informations suffisent).

### B. Extension de la Capacité de Raisonnement à 25 Itérations
- `MAX_AGENT_ITERATIONS` porté de 8 à **25 itérations** dans `server.ts`.
- `MAX_LOOP_DURATION_MS` ajusté à **90 secondes** côté serveur pour permettre une exploration en profondeur sans coupure prématurée.
- Timeout client étendu à **120 secondes** via `AbortController` dans `src/services/apiService.ts`.

### C. Fenêtre / Accordéon Repliable "Réflexion"
- **Pendant la réflexion (`ThinkingAccordion`)** :
  - Petite fenêtre repliable sous le nom de KADERBOT NOVA avec mention **"🧠 Réflexion"**, points animés et statut en direct.
  - Clic interactif permettant de déployer les détails de l'étape en cours, la barre de progression ReAct et les 4 piliers méthodologiques (Pensée, Action, Observation, Adaptation).
- **Dans la réponse finale (`AgentTraceAccordion`)** :
  - Accordéon sobre replié par défaut : **"🧠 Réflexion • X étapes de raisonnement (ReAct)"**.
  - Au clic, déploiement complet de la chronologie étape par étape avec :
    - 💭 **Pensée & Décomposition (Thought)**
    - ⚙️ **Action exécutée** (outil, arguments, URL source cliquable)
    - 👁️ **Observation** (extraits ou constat d'incident)
    - 🎯 **Adaptation de la stratégie** (comment l'agent a réagi pour poursuivre)

---

## 2. Fichiers Modifiés
1. `server.ts` : Passage à 25 itérations, enrichissement du prompt système ReAct, capture des pensées et de l'adaptation de stratégie à chaque étape.
2. `src/types/kaderbot.ts` : Extension de `ToolExecutionTrace` avec `step`, `thought`, `observation`, `strategy`.
3. `src/services/apiService.ts` : Ajustement du timeout à 120s pour supporter jusqu'à 25 itérations.
4. `src/components/ChatTab.tsx` : Création de `ThinkingAccordion` et refonte complète de `AgentTraceAccordion` sous forme d'accordéon ReAct "Réflexion".
5. `src/App.tsx` : Gestion et transmission des statuts dynamiques ReAct au composant de discussion.
