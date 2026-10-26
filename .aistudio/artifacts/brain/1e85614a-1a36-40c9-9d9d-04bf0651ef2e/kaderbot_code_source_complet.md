# KADERBOT NOVA V14 — Architecture & Intégration OpenRouter

KADERBOT NOVA intègre désormais trois fournisseurs d'intelligence artificielle majeurs en plus de son moteur cognitif local (Transformers.js Embeddings & Inférence logique) :
1. **Google Gemini (3.8 Flash)** : Provider par défaut, ultra-rapide et gratuit via SDK officiel ou fallback REST.
2. **Groq Cloud** : Spécialisé ultra-basse latence avec `openai/gpt-oss-120b` et `llama-3.1-8b-instant`.
3. **OpenRouter** : Nouvelle intégration multi-fournisseurs axée sur les modèles gratuits (`:free`), avec **Meta Llama 3.3 70B Instruct** en modèle prioritaire.

---

## 1. Architecture Backend (`server.ts`)

### 1.1 Sécurité des clés API
- La clé API OpenRouter est lue exclusivement via `process.env.OPENROUTER_API_KEY`.
- Si le frontend envoie une clé personnalisée saisie dans le modal Paramètres, elle est transmise de manière éphémère sans jamais être loggée ni exposée.
- La clé serveur n'est jamais exposée aux requêtes clientes.

### 1.2 Résolution stricte des modèles (`resolveOpenRouterModel`)
- **Interdiction formelle de GPT-OSS 120B** : `openai/gpt-oss-120b` est réservé à Groq. Toute demande vers ce modèle sur OpenRouter est redirigée vers `meta-llama/llama-3.3-70b-instruct:free`.
- **Suffixe obligatoire `:free`** : Tout modèle OpenRouter non terminé par `:free` se voit automatiquement suffixé par `:free`.
- **Modèle par défaut** : `meta-llama/llama-3.3-70b-instruct:free`.

### 1.3 Gestionnaire d'appels avec Fallback (`callOpenRouterWithFallback`)
- **Endpoint** : `https://openrouter.ai/api/v1/chat/completions`
- **Headers requis** :
  - `Authorization: Bearer <API_KEY>`
  - `Content-Type: application/json`
  - `HTTP-Referer: https://kaderbot-nova.local`
  - `X-Title: KADERBOT NOVA`
- **Chaîne de fallback ordonnée** :
  1. Modèle demandé (ex: `meta-llama/llama-3.3-70b-instruct:free`)
  2. Modèle de secours 1 : `qwen/qwen3-coder:free`
  3. Modèle de secours 2 : `deepseek/deepseek-r1:free`
- **Gestion des erreurs HTTP 429 et 401** :
  - Sur 429 (quota/rate limit) ou 401 (clé invalide), aucun autre modèle OpenRouter n'est testé inutilement ; une erreur immédiate est levée pour déclencher le fallback vers Gemini.
- **Support des endpoints applicatifs** :
  - `POST /api/openrouter/test`
  - `POST /api/chat`
  - `POST /api/idees`
  - `POST /api/traduis`
  - `POST /api/corrige`
  - `POST /api/resume`

---

## 2. Architecture Frontend

### 2.1 Types (`src/types/kaderbot.ts`)
- Ajout de `'openrouter'` dans le type `LLMProvider`.
- Ajout de `'openrouter'` dans `ChatMessage['meta']['source']`.
- Ajout de `openrouterModel: string` et `openrouterApiKey?: string` dans `AppConfig`.

### 2.2 Service API (`src/services/apiService.ts`)
- Méthode `testOpenRouterConnection(apiKey?: string, model?: string)`.
- Transmission systématique de `openrouterModel` dans les payloads `/api/chat`, `/api/idees`, `/api/traduis`, etc.

### 2.3 En-tête (`src/components/Header.tsx`)
- Sélecteur rapide de modèle avec option OpenRouter (`🦙 Llama 3.3 (OpenRouter)`).
- Badge violet distinctif `#A855F7` / `border-purple-500/50`.

### 2.4 Modal Paramètres (`src/components/SettingsModal.tsx`)
- Carte de sélection "OpenRouter" dans la grille des moteurs IA (4 colonnes).
- Section de configuration dédiée avec champ de clé API sécurisé, sélecteur de modèle gratuit (`llama-3.3-70b-instruct:free`, `qwen3-coder:free`, `deepseek-r1:free`) et bouton de test de latence en temps réel.

### 2.5 Onglet de Discussion (`src/components/ChatTab.tsx`)
- Badge d'identification de source : `🦙 Llama (OpenRouter)`.
