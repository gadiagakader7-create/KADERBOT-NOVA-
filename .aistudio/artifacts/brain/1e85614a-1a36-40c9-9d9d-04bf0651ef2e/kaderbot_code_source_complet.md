# KADERBOT NOVA — Architecture Agentique & Outils (`/api/agent`)

Ce document décrit l'implémentation de la boucle agentique et de la suite d'outils intégrée dans le serveur `server.ts` de KADERBOT NOVA.

---

## 1. Constantes & Sécurité

- **Clé Brave Search** : `BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY?.trim() || ''`
- **Limite d'itérations de l'agent** : `MAX_AGENT_ITERATIONS = 8`
- **Quota journalier Brave Search** : `MAX_BRAVE_CALLS_PER_DAY = 100`
- **Persistance du quota** : `data/brave_usage.json` (structure `{ date: "YYYY-MM-DD", count: number, updatedAt: string }`). Si le quota est atteint, l'outil renvoie `"Quota de recherche atteint pour aujourd'hui."` sans lever d'erreur bloquante.
- **Sécurité `open_url`** : Filtrage strict des domaines interdits (`localhost`, `127.0.0.1`, adresses IP directes, `*.internal`, `*.render.com`).

---

## 2. Définition des Outils (Format Groq / OpenAI Tool Calling)

1. **`search_web(query)`** : Recherche générale sur le web via l'API Brave Search (5 résultats avec titre, URL et extrait).
2. **`open_url(url)`** : Exploration d'une page web avec timeout de 10s, suppression des balises `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>`, et troncature stricte à 6 000 caractères.
3. **`search_news(query)`** : Recherche d'actualités récentes via Brave News API.
4. **`memo_lookup(sujet)`** : Consultation de la mémoire cognitive locale (`data/kaderbot_storage.json`) avant de solliciter le web.
5. **`memo_store(sujet, definition)`** : Mémorisation d'un fait validé par l'utilisateur avec métadonnées (`source: 'agent'`, `type: 'concept'`, `created`, `last_used`).
6. **`link_concepts(source, cible)`** : Création d'une relation d'héritage conceptuelle (`source` est-un `cible`).
7. **`ask_user(question)`** : Demande d'éclaircissement à l'utilisateur lorsqu'une requête est ambiguë (interrompt la boucle et renvoie `{ awaitingUser: true, question }`).

---

## 3. Boucle Agentique (`runAgentLoop`)

- Modèle : `openai/gpt-oss-120b` sur Groq (`temperature: 0.5`).
- Gestion multi-tours automatique jusqu'à 8 itérations.
- Tronquage systématique des résultats d'outils à 6 000 caractères pour préserver la fenêtre de contexte.
- Tolérance aux pannes : en cas d'erreur d'un outil, le message d'erreur est fourni au modèle pour lui permettre d'adapter sa stratégie sans planter la boucle.
- Fallback automatique vers Gemini en cas d'absence de `GROQ_API_KEY` ou d'indisponibilité de Groq.

---

## 4. Endpoints d'API

- **`POST /api/agent`** : Démarre la boucle agentique avec `{ prompt, history, systemPrompt? }`.
- **`GET /api/memory/refresh`** : Recharge les données fraîches de `data/kaderbot_storage.json` depuis le disque.
- **`GET /api/health`** : Endpoint de healthcheck retournant `{ ok: true }` pour les pings de maintien d'activité (Render cron).
