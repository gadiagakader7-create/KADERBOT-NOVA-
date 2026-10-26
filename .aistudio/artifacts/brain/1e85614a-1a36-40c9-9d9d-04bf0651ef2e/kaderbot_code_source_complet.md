# KADERBOT NOVA V14 — Catalogue des Modèles & Cascade Agentique (Octobre 2026)

Ce document résume la mise à jour des catalogues de modèles d'IA et de la chaîne de secours dans `server.ts`.

---

## 1. Modèles Groq (Catalogue Octobre 2026)

- **Modèles officiellement supportés et maintenus** :
  - `openai/gpt-oss-120b` (Grand modèle, raisonnement approfondi & boucle agentique principale)
  - `openai/gpt-oss-20b` (Modèle ultra-rapide, équilibré)
- **Modèles dépréciés / retirés définitivement supprimés** :
  - `llama-3.1-8b-instant`
  - `llama-3.3-70b-specdec`
  - `mixtral-8x7b-32768`
  - `qwen/qwen3.8-27b`
- **Résolution (`resolveGroqModel`)** :
  - Si demande spécifique de 120b → `openai/gpt-oss-120b`
  - Si demande spécifique de 20b → `openai/gpt-oss-20b`
  - Toute demande de modèle inconnu ou déprécié → bascule automatique vers `openai/gpt-oss-20b`.
- **Liste `candidateModels`** : uniquement `['openai/gpt-oss-120b', 'openai/gpt-oss-20b']`.

---

## 2. Modèles Google Gemini (`callGeminiWithFallback`)

- **Liste des modèles de secours** :
  1. `gemini-3.8-flash` (GA, ultra-rapide)
  2. `gemini-3.5-flash` (remplace l'ancien `gemini-3.1-flash-lite`)
  3. `gemini-flash-latest`
- **Logs explicites de bascule** : chaque transition est tracée dans la console serveur indiquant le modèle ayant échoué, la cause de l'échec et le modèle vers lequel s'effectue la bascule (`[BASCULE GEMINI SDK]` ou `[BASCULE GEMINI REST]`).

---

## 3. Cascade Complète de la Boucle Agentique (`runAgentLoop` / `/api/agent`)

La boucle agentique exécute une cascade tolérante aux pannes sans jamais renvoyer d'erreur HTTP 500 tant qu'un des maillons répond :

1. **Maillon 1** : Groq `openai/gpt-oss-120b` (avec exécution complète des outils : `search_web`, `search_news`, `open_url`, `memo_lookup`, `memo_store`, `link_concepts`, `ask_user`).
2. **Maillon 2** : Groq `openai/gpt-oss-20b` (avec exécution complète des outils).
3. **Maillon 3** : Gemini via `callGeminiWithFallback` (synthèse textuelle sans outils).
4. **Maillon 4** : OpenRouter `nvidia/nemotron-3.5-lightning:free` (avec exécution complète des outils si `OPENROUTER_API_KEY` est configuré).

---

## 4. Traçabilité & Logs

À chaque bascule entre maillons ou modèles, un avertissement explicite est émis avec :
- Le modèle et le fournisseur ayant échoué.
- La cause technique exacte (code HTTP, message d'erreur ou timeout).
- Le modèle et le maillon cible de la bascule.
