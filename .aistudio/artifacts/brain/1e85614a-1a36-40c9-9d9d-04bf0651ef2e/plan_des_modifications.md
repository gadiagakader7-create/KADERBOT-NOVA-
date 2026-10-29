# Plan Détaillé des Modifications & Architecture Complète — KADERBOT NOVA V14

Ce document constitue la référence exhaustive de l'architecture, des composants et des transformations successives de **KADERBOT NOVA V14**, agent cognitif hybride combinant IA symbolique locale, mémoire sémantique vectorielle, boucle agentique avec outillage web, routeur d'intention, et infrastructure d'injection contextuelle chirurgicale pour futur modèle local (Nova).

---

## Sommaire
1. [Vue d'Ensemble & Vision Architecturale](#1-vue-densemble--vision-architecturale)
2. [Moteur Cognitif Symbolique & Appariement Sémantique Local](#2-moteur-cognitif-symbolique--appariement-sémantique-local)
3. [Intégration Cloud Multi-Fournisseurs & Résilience (Groq, Gemini, OpenRouter)](#3-intégration-cloud-multi-fournisseurs--résilience)
4. [Boucle Agentique Autonome avec Outillage Web & Mémoire (`/api/agent`)](#4-boucle-agentique-autonome-avec-outillage-web--mémoire)
5. [Routeur d'Intention Ultra-Rapide (`CHAT` vs `AGENT`)](#5-routeur-dintention-ultra-rapide)
6. [Infrastructure de Mémoire Chirurgicale pour LLM Local Nova (`SmolLM2-1.7B`)](#6-infrastructure-de-mémoire-chirurgicale-pour-llm-local-nova)
7. [Interface Utilisateur, Pastilles d'Outils & Statuts Visuels](#7-interface-utilisateur-pastilles-doutils--statuts-visuels)
8. [Script Embarqué Autonome Python Pydroid 3 & Export Multi-Mode](#8-script-embarqué-autonome-python-pydroid-3--export-multi-mode)
9. [Tableau de Synthèse des Fichiers & Déploiement](#9-tableau-de-synthèse-des-fichiers--déploiement)

---

## 1. Vue d'Ensemble & Vision Architecturale

KADERBOT NOVA est conçu selon le principe de **l'autonomie cognitive échelonnée** :
* **Priorité 1 (Local Sémantique & Symbolique)** : Détection immédiate des questions déjà apprises, déduction logique causale (*pourquoi*), transitivité ontologique (*Is-A*), et recherche vectorielle par embeddings sans jamais faire appel au cloud pour les faits connus.
* **Priorité 2 (Outils Directs & Arithmétique)** : Calculs mathématiques déterministes, commandes taxonomiques (`lie:`, `delie:`, `retiens:`).
* **Priorité 3 (Routeur & Boucle Agentique)** : Si la réponse nécessite des informations d'actualité, une recherche web ou une navigation, l'agent utilise ses outils (Brave Search, scraping d'URL, hub mémoire). S'il s'agit d'une interaction purement conversationnelle, le routeur court-circuite la boucle d'outils pour répondre en ~200ms.
* **Priorité 4 (Futur LLM Local Nova)** : Préparation d'une injection de prompt chirurgical pour modèles locaux légers (`SmolLM2-1.7B` GGUF) garantissant zéro dérive en mode hors-ligne.

---

## 2. Moteur Cognitif Symbolique & Appariement Sémantique Local

### 2.1 Distinction stricte Concept vs Question-Réponse (Q&R)
* **Type `concept`** : Définition d'un terme précis (*"c'est quoi un drone ?"*).
* **Type `question_reponse`** : Réponses contextuelles ou questions ouvertes (*"quelles sont les applications de l'IA ?"*). Évite toute pollution de la mémoire par un mot-clé unique trop générique.

### 2.2 Algorithme d'Appariement Sémantique Hybride (`rechercheHybride`)
* Combinaison d'un pré-filtrage lexical (mots-clés significatifs sans stop-words) et d'un calcul de similarité cosinus sur vecteurs d'embeddings (générés côté navigateur via `@xenova/transformers` avec le modèle `all-MiniLM-L6-v2`).
* Pré-calcul des vecteurs par lots (`precalculerTousLesVecteurs`) au premier lancement avec indicateur de progression dans l'en-tête et persistance dans `localStorage`.

### 2.3 Raisonnement Déductif Causal
* Navigation dans le graphe d'héritage ontologique (`deduireChaine`) sur les relations `Is-A`.
* Résolution causale (`repondrePourquoi`) : articulation logique d'une propriété universelle d'un ancêtre taxonomique (*"Parce que le moineau est un oiseau, et que tous les oiseaux respirent"*).

---

## 3. Intégration Cloud Multi-Fournisseurs & Résilience

### 3.1 Sécurité Stricte des Clés d'API
* Aucune clé API (Groq, Gemini, OpenRouter, Brave Search) n'est jamais exposée au frontend.
* L'ensemble des appels transite par le serveur Express (`server.ts`) via `process.env`.

### 3.2 Catalogue des Modèles Actifs (Octobre 2026)
* **Groq** : `openai/gpt-oss-120b` (modèle principal de raisonnement) et `openai/gpt-oss-20b` (modèle rapide).
* **Google Gemini** : `gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-flash-latest` avec bascule automatique SDK GoogleGenAI vers fallback REST direct sans ADC.
* **OpenRouter** : `nvidia/nemotron-3.5-lightning:free`, `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen3-coder:free`, `deepseek/deepseek-r1:free`.

---

## 4. Boucle Agentique Autonome avec Outillage Web & Mémoire (`/api/agent`)

### 4.1 Cascade à 4 Niveaux Tolérante aux Pannes (`runAgentLoop`)
1. **Niveau 1** : Groq `openai/gpt-oss-120b` avec `tools`.
2. **Niveau 2** : Groq `openai/gpt-oss-20b` avec `tools`.
3. **Niveau 3** : Gemini 3.8 Flash (synthèse textuelle de secours sans outillage).
4. **Niveau 4** : OpenRouter `nvidia/nemotron-3.5-lightning:free` avec `tools`.
* Zéro erreur HTTP 500 renvoyée à l'utilisateur tant qu'un seul maillon est en mesure de répondre.

### 4.2 Boîte à Outils Agentique
* **`search_web(query)`** : Recherche générale sur le web mondial via Brave Search API avec gestion de quota journalier (`data/brave_usage.json`).
* **`search_news(query)`** : Recherche d'actualités récentes via Brave News Search.
* **`open_url(url)`** : Scraping et extraction textuelle sécurisée avec liste blanche anti-SSRF (blocage de `localhost`, `127.0.0.1`, adresses IP nues et domaines internes).
* **`memo_lookup(query)`** : Recherche directe de définitions et règles dans la mémoire locale de Kaderbot.
* **`memo_store(concept, definition)`** : Mémorisation pérenne d'un nouveau fait appris.
* **`link_concepts(source, target)`** : Création d'une relation taxonomique.
* **`ask_user(question)`** : Interruption contrôlée pour solliciter une précision de l'utilisateur.

---

## 5. Routeur d'Intention Ultra-Rapide (`CHAT` vs `AGENT`)

Dans `server.ts` sur la route `POST /api/agent` :
* Interception de chaque message par une micro-inférence sur `openai/gpt-oss-20b` avec `max_tokens: 150`, `temperature: 0` et `reasoning_format: 'parsed'`.
* **Classification `CHAT`** : Détecte les salutations, échanges conversationnels et opinions. Court-circuite la boucle d'outils et répond directement en 150-300ms via `callGroqWithFallback`. Retourne `{ routedTo: 'chat', toolTrace: [] }`.
* **Classification `AGENT`** : Détecte les demandes d'actualités, recherches d'informations externes ou apprentissages. Déclenche la boucle récursive `runAgentLoop` avec exécution d'outils. Retourne `{ routedTo: 'agent', toolTrace: [...] }`.
* **Sécurité de Repli** : En cas de timeout ou d'indisponibilité du classifieur, bascule par défaut sur `AGENT`.

---

## 6. Infrastructure de Mémoire Chirurgicale pour LLM Local Nova (`SmolLM2-1.7B`)

Préparation de l'accueil d'un modèle SLM local autonome (Small Language Model fine-tuné et exporté en GGUF) :
* **Fonction dédiée `construirePromptContextuelNova`** dans `src/core/cognitiveEngine.ts`.
* Recherche chirurgicale dans la mémoire JSON locale du fait vérifié le plus pertinent.
* Injection dynamique d'un en-tête structuré :
  ```
  [FAIT VÉRIFIÉ EN MÉMOIRE LOCALE SUR "CONCEPT"]
  - Définition exacte du concept
  ```
* **Règle stricte de segmentation** : Cette injection contextuelle s'applique **exclusivement** au mode local (`local_only` et script Pydroid 3). Les requêtes vers les APIs Cloud (Groq, Gemini, OpenRouter) restent 100% standard et préservent leur historique natif.

---

## 7. Interface Utilisateur, Pastilles d'Outils & Statuts Visuels

### 7.1 Rendu des Réponses & Markdown
* Intégration de `react-markdown` avec coloration syntaxique des blocs de code, listes à puces structurées, citations et emphase visuelle.
* Effet machine à écrire (streaming visuel fluide) actif uniquement sur les messages nouveaux (`msg.isNew === true`), désactivé lors du parcours de l'historique pour une fluidité instantanée.

### 7.2 Pastilles d'Outils Compactes & Liens Cliquables
* Lorsque l'agent exécute des outils, une pastille élégante s'affiche au bas du message :
  `Outils : 🔎 search_news → 📄 open_url (lemonde.fr)`
* Les URL ouvertes par l'outil `open_url` sont directement cliquables pour ouvrir l'article source dans un nouvel onglet sécurisé (`rel="noopener noreferrer"`).

### 7.3 Badges d'État & Mode Dégradé
* **Statut "Agent actif"** : Badge vert pulsant dans l'en-tête supérieur (`Header.tsx`) lorsque l'agent est opérationnel.
* **Badge "Mode dégradé (sans recherche)"** : Affiché en cas de repli vers un maillon sans outil, avec tooltip détaillant la cause exacte de la bascule.

### 7.4 Gestion Multi-Discussions (Fils Style ChatGPT)
* Tiroir d'historique latéral complet avec recherche instantanée dans les conversations passées, modification du titre au crayon et suppression sécurisée avec confirmation.

---

## 8. Script Embarqué Autonome Python Pydroid 3 & Export Multi-Mode

* Endpoint serveur `/api/export-pydroid` générant un script Python autonome (`kaderbot.py`).
* Intègre les dictionnaires de faits, règles, liens et synonymes encodés en Base64 sans risque d'erreur d'échappement.
* Intègre en natif la fonction `construire_prompt_contextuel_nova(question)` pour le modèle local.
* Mode d'exécution automatique avec bascule résiliente : Interface graphique Tkinter si disponible sur Android, ou Console interactive ultra-légère en fallback.

---

## 9. Tableau de Synthèse des Fichiers & Déploiement

| Fichier | Rôle & Modifications Majeures |
| :--- | :--- |
| `src/core/cognitiveEngine.ts` | Moteur symbolique, recherche sémantique vectorielle, `construirePromptContextuelNova`. |
| `src/types/kaderbot.ts` | Types enrichis `MemoryEntry`, `ChatMessage` avec métadonnées d'agent (`toolTrace`, `routedTo`, `isFallback`). |
| `src/services/apiService.ts` | Méthodes `sendAgentMessage` (`/api/agent`), `chat` (`/api/chat`), tests de connectivité Groq/Gemini/OpenRouter. |
| `server.ts` | Routeur d'intention, boucle agentique à 4 maillons, proxy d'outils Brave/Scraper, export Pydroid 3 et export ZIP. |
| `src/App.tsx` | Dispatcher principal connectant la saisie à l'agent avec repli chat, gestion des fils et du mode local Nova. |
| `src/components/ChatTab.tsx` | Affichage Markdown, pastilles d'outils agentiques avec liens cliquables, badge de repli dégradé. |
| `src/components/Header.tsx` | Indicateur d'état "Agent actif", bascule de modèle et session, commande Actions. |
