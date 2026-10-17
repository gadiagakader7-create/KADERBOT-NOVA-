import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const MEMORY_FILE = path.join(DATA_DIR, 'kaderbot_storage.json');

// Initialize Gemini SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const DEFAULT_SYSTEM_PROMPT =
  'Tu es KADERBOT, un assistant sympa, concis et curieux. ' +
  'Tu réponds toujours en français, en 2 à 4 phrases maximum. ' +
  'Tu ne fais pas de listes à puces sauf si on te le demande. ' +
  'Tu es chaleureux mais pas excessif.';

// Helper to normalize and resolve Groq model IDs accurately
export function resolveGroqModel(requestedModel?: string): string {
  if (!requestedModel) return 'openai/gpt-oss-120b';
  const clean = requestedModel.trim();
  const lower = clean.toLowerCase();

  // OpenAI GPT-OSS on Groq
  if (lower.includes('gpt-oss-20b') || lower.includes('gpt20b')) {
    return 'openai/gpt-oss-20b';
  }
  if (
    lower === 'openai/gpt-oss-120b' ||
    lower.includes('gpt-oss-120b') ||
    lower.includes('gpt120b') ||
    lower.includes('gpt-120b') ||
    lower.includes('gpt') ||
    lower.includes('oss')
  ) {
    return 'openai/gpt-oss-120b';
  }

  // Deprecated models migration
  if (lower.includes('llama-3.3-70b-versatile')) {
    return 'llama-3.3-70b-specdec';
  }

  // Qwen on Groq
  if (lower.includes('qwen')) {
    return 'qwen/qwen3.8-27b';
  }

  // Llama 3.1 8B Instant
  if (lower.includes('llama-3.1-8b') || lower.includes('llama3-8b')) {
    return 'llama-3.1-8b-instant';
  }

  return clean;
}

// Helper to call Groq with candidate fallback and clean error management
async function callGroqWithFallback(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  requestedModel = 'openai/gpt-oss-120b',
  history: Array<{ role: string; content: string }> = []
): Promise<{ text: string; actualModel: string }> {
  const primaryModel = resolveGroqModel(requestedModel);

  // Candidate models to try in order on Groq
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      'openai/gpt-oss-120b',
      'llama-3.1-8b-instant',
      'llama-3.3-70b-specdec',
      'qwen/qwen3.8-27b',
      'mixtral-8x7b-32768',
    ])
  );

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt },
  ];

  let lastError = '';

  for (const modelToTry of candidateModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToTry,
          messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        return { text: content, actualModel: modelToTry };
      }

      const errData = await response.json().catch(() => null);
      const errMsg = errData?.error?.message || `HTTP ${response.status}`;
      lastError = errMsg;

      // If 404 (model not found / deprecated), try next candidate model
      if (response.status === 404) {
        console.warn(`Modèle Groq "${modelToTry}" non accessible (404), tentative avec modèle suivant...`);
        continue;
      } else {
        // e.g. 401 invalid api key or 429 rate limit - no point trying other models with same key
        break;
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  throw new Error(`Groq: ${lastError}`);
}

// Helper to call Gemini with multi-model fallback in case of temporary 503/429 spikes
async function callGeminiWithFallback(
  fullPrompt: string,
  systemInstruction?: string
): Promise<{ text: string; model: string }> {
  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const m of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: m,
        contents: fullPrompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });
      const text = response.text?.trim();
      if (text) {
        return { text, model: m };
      }
    } catch (err: any) {
      console.warn(`Gemini modèle ${m} indisponible (${err.message}), tentative modèle suivant...`);
      lastError = err;
    }
  }

  throw lastError || new Error('Les modèles Gemini sont temporairement indisponibles.');
}

// 0. Groq Connection & Model Tester Endpoint
app.post('/api/groq/test', async (req, res) => {
  try {
    const { apiKey, model = 'openai/gpt-oss-120b' } = req.body;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Veuillez saisir une clé API Groq (gsk_...) pour effectuer le test.',
      });
    }

    const resolvedModel = resolveGroqModel(model);
    const start = Date.now();

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: 'user', content: 'Réponds en un seul mot: "Connecté".' }],
        max_tokens: 20,
      }),
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || 'Connecté';
      return res.json({
        ok: true,
        model: resolvedModel,
        latencyMs,
        reply,
      });
    }

    const errData = await response.json().catch(() => null);
    const errMsg = errData?.error?.message || `Erreur HTTP ${response.status}`;
    return res.status(response.status).json({
      ok: false,
      status: response.status,
      error: errMsg,
      model: resolvedModel,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 1. Chat endpoint (Gemini or Groq)
app.post('/api/chat', async (req, res) => {
  try {
    const {
      prompt,
      history = [],
      provider = 'gemini',
      groqApiKey,
      groqModel = 'openai/gpt-oss-120b',
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt requis' });
    }

    const formattedHistory = history
      .map((h: { role: string; content: string }) => `${h.role === 'user' ? 'Utilisateur' : 'KADERBOT'}: ${h.content}`)
      .join('\n');
    const fullPrompt = `${systemPrompt}\n\nHistorique récent:\n${formattedHistory}\n\nUtilisateur: ${prompt}\nKADERBOT:`;

    // A. Groq Provider
    if (provider === 'groq') {
      const keyToUse = groqApiKey || process.env.GROQ_API_KEY;

      if (!keyToUse) {
        console.warn('Pas de clé Groq renseignée, bascule fluide sur Gemini');
        const geminiRes = await callGeminiWithFallback(fullPrompt);
        return res.json({
          text: geminiRes.text,
          provider: 'gemini',
          model: geminiRes.model,
          isFallback: true,
          fallbackReason: 'Aucune clé Groq configurée',
        });
      }

      try {
        const { text, actualModel } = await callGroqWithFallback(prompt, systemPrompt, keyToUse, groqModel, history);
        return res.json({ text, provider: 'groq', model: actualModel });
      } catch (groqErr: any) {
        console.warn(`Groq indisponible (${groqErr.message}), bascule de secours sur Gemini...`);
        const geminiRes = await callGeminiWithFallback(fullPrompt);
        return res.json({
          text: geminiRes.text,
          provider: 'gemini',
          model: geminiRes.model,
          isFallback: true,
          fallbackReason: groqErr.message,
        });
      }
    }

    // B. Default: Gemini 3.8 Flash (Server-Side)
    const geminiRes = await callGeminiWithFallback(fullPrompt);
    return res.json({ text: geminiRes.text, provider: 'gemini', model: geminiRes.model });
  } catch (error: any) {
    console.error('Erreur /api/chat:', error);
    return res.status(500).json({ error: error.message || 'Erreur serveur KADERBOT' });
  }
});

// 2. Ideas Generator endpoint
app.post('/api/idees', async (req, res) => {
  try {
    const {
      theme,
      count = 5,
      style = 'creatif',
      styleDesc = '',
      provider = 'gemini',
      groqApiKey,
      groqModel = 'openai/gpt-oss-120b',
    } = req.body;

    const prompt = `Génère exactement ${count} idées courtes sur le thème : "${theme}". Style demandé: ${styleDesc || style}. Format obligatoire : une idée par ligne, numérotée de 1 à ${count}. Pas d'introduction ni de conclusion.`;

    if (provider === 'groq' && (groqApiKey || process.env.GROQ_API_KEY)) {
      try {
        const key = groqApiKey || process.env.GROQ_API_KEY;
        const { text } = await callGroqWithFallback(prompt, "Tu es un générateur d'idées créatif et concis.", key, groqModel);
        return res.json({ text });
      } catch (err) {
        console.warn('Groq idees failed, falling back to Gemini');
      }
    }

    const geminiRes = await callGeminiWithFallback(prompt, "Tu es un générateur d'idées créatif et percutant.");
    return res.json({ text: geminiRes.text });
  } catch (error: any) {
    console.error('Erreur /api/idees:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Translation endpoint
app.post('/api/traduis', async (req, res) => {
  try {
    const { text, targetLang, provider = 'gemini', groqApiKey, groqModel = 'openai/gpt-oss-120b' } = req.body;
    const prompt = `Traduis le texte suivant en ${targetLang}. Réponds UNIQUEMENT par la traduction exacte, sans commentaire, guillemets ni introduction:\n\n${text}`;

    if (provider === 'groq' && (groqApiKey || process.env.GROQ_API_KEY)) {
      try {
        const key = groqApiKey || process.env.GROQ_API_KEY;
        const { text: result } = await callGroqWithFallback(prompt, 'Tu es un traducteur professionnel expert.', key, groqModel);
        return res.json({ text: result });
      } catch (err) {
        console.warn('Groq traduis failed, falling back to Gemini');
      }
    }

    const geminiRes = await callGeminiWithFallback(prompt, 'Tu es un traducteur polyglotte de précision. Tu retournes exclusivement le texte traduit.');
    return res.json({ text: geminiRes.text });
  } catch (error: any) {
    console.error('Erreur /api/traduis:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 4. Corrector endpoint
app.post('/api/corrige', async (req, res) => {
  try {
    const { text, provider = 'gemini', groqApiKey, groqModel = 'openai/gpt-oss-120b' } = req.body;
    const prompt = `Corrige les fautes d'orthographe, de grammaire et de ponctuation du texte suivant en gardant le sens et le ton. Réponds uniquement par le texte corrigé:\n\n${text}`;

    if (provider === 'groq' && (groqApiKey || process.env.GROQ_API_KEY)) {
      try {
        const key = groqApiKey || process.env.GROQ_API_KEY;
        const { text: result } = await callGroqWithFallback(prompt, 'Tu es un correcteur professionnel.', key, groqModel);
        return res.json({ text: result });
      } catch (err) {
        console.warn('Groq corrige failed, falling back to Gemini');
      }
    }

    const geminiRes = await callGeminiWithFallback(prompt, 'Tu es un correcteur linguistique d’élite. Tu renvoies exclusivement le texte corrigé.');
    return res.json({ text: geminiRes.text });
  } catch (error: any) {
    console.error('Erreur /api/corrige:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 5. Summarizer endpoint
app.post('/api/resume', async (req, res) => {
  try {
    const { text, provider = 'gemini', groqApiKey, groqModel = 'openai/gpt-oss-120b' } = req.body;
    const prompt = `Résume le texte suivant en 2 à 3 phrases claires, précises et directes. Réponds uniquement par le résumé:\n\n${text}`;

    if (provider === 'groq' && (groqApiKey || process.env.GROQ_API_KEY)) {
      try {
        const key = groqApiKey || process.env.GROQ_API_KEY;
        const { text: result } = await callGroqWithFallback(prompt, 'Tu es un expert en synthèse documentaire.', key, groqModel);
        return res.json({ text: result });
      } catch (err) {
        console.warn('Groq resume failed, falling back to Gemini');
      }
    }

    const geminiRes = await callGeminiWithFallback(prompt, 'Tu es un synthétiseur d’informations. Rédige un résumé dense et limpide.');
    return res.json({ text: geminiRes.text });
  } catch (error: any) {
    console.error('Erreur /api/resume:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 6. Memory Persistence (Load & Save to JSON disk file)
app.get('/api/memory', (req, res) => {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      return res.json(data);
    }
    return res.json({ memoire: {}, regles: {}, liens: {}, synonymes: {}, sessions: ['defaut'] });
  } catch (err: any) {
    console.error('Erreur lecture mémoire:', err);
    return res.status(500).json({ error: 'Erreur lecture stockage' });
  }
});

app.post('/api/memory/save', (req, res) => {
  try {
    const { memoire, regles, liens, synonymes, sessions } = req.body;
    fs.writeFileSync(
      MEMORY_FILE,
      JSON.stringify({ memoire, regles, liens, synonymes, sessions, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    return res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Erreur sauvegarde mémoire:', err);
    return res.status(500).json({ error: 'Erreur écriture stockage' });
  }
});

// 7. Python Pydroid 3 Export Script
app.post('/api/export-pydroid', (req, res) => {
  try {
    const {
      memoire = {},
      regles = {},
      liens = {},
      synonymes = {},
      groqApiKey = '',
      groqModel = 'openai/gpt-oss-120b',
    } = req.body;
    const resolvedModel = resolveGroqModel(groqModel);

    const safeMemoire = JSON.stringify(memoire, null, 2);
    const safeRegles = JSON.stringify(regles, null, 2);
    const safeLiens = JSON.stringify(liens, null, 2);
    const safeSynonymes = JSON.stringify(synonymes, null, 2);

    const pythonScript = `# -*- coding: utf-8 -*-
"""
===========================================================
KADERBOT NOVA V14 - APPLICATION COMPLETE PYDROID 3 (ANDROID)
===========================================================
Généré automatiquement par KADERBOT NOVA Web Studio.
Ce script est autonome et 100% fonctionnel dans Pydroid 3 sur Android.
Il intègre :
- Le moteur cognitif hybride (mémoire adaptative, déduction, syllogismes)
- La recherche floue Levenshtein / difflib
- L'interface graphique Tkinter sombre optimisée pour écran tactile Android
- L'appel direct à Groq Cloud (${resolvedModel}) avec gestion asynchrone (threads)
"""
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import json
import os
import difflib
import random
import re
import unicodedata
import threading
import urllib.request
import urllib.error
from datetime import datetime

# =========================================================
# CONFIGURATION DU MOTEUR IA & GROQ
# =========================================================
API_KEY = "${groqApiKey}"
API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL_GROQ = "${resolvedModel}"
GROQ_ACTIF = bool(API_KEY.strip())

SYSTEM_PROMPT = (
    "Tu es KADERBOT, un assistant sympa, concis et curieux. "
    "Tu réponds toujours en français, en 2 à 4 phrases maximum. "
    "Tu es chaleureux mais pas excessif."
)

DATA_FILE = "kaderbot_memoire.json"

# =========================================================
# BASES DE CONNAISSANCES SYNCHRONISÉES
# =========================================================
memoire = ${safeMemoire}
regles = ${safeRegles}
liens = ${safeLiens}
synonymes = ${safeSynonymes}

contexte = []
historique_chat = []

# =========================================================
# PERSISTANCE LOCALE ANDROID
# =========================================================
def sauvegarder_donnees():
    try:
        data = {
            "memoire": memoire,
            "regles": regles,
            "liens": liens,
            "synonymes": synonymes,
            "updated_at": datetime.now().isoformat()
        }
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print("Erreur sauvegarde :", e)
        return False

def charger_donnees():
    global memoire, regles, liens, synonymes
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                if "memoire" in d: memoire.update(d["memoire"])
                if "regles" in d: regles.update(d["regles"])
                if "liens" in d: liens.update(d["liens"])
                if "synonymes" in d: synonymes.update(d["synonymes"])
        except Exception as e:
            print("Erreur chargement :", e)

charger_donnees()

# =========================================================
# OUTILS LINGUISTIQUES & NLP
# =========================================================
def sans_accent(t):
    if not t: return ""
    return "".join(c for c in unicodedata.normalize("NFD", str(t)) if unicodedata.category(c) != "Mn").lower()

def singulariser(mot):
    m = mot.strip().lower()
    if m.endswith("aux"): return m[:-3] + "al"
    if m.endswith("s") and len(m) > 3: return m[:-1]
    if m.endswith("x") and len(m) > 3: return m[:-1]
    return m

def rechercher_flou(texte, memoire_dict, regles_dict, seuil=0.72):
    t_clean = sans_accent(texte)
    clefs = list(set(list(memoire_dict.keys()) + list(regles_dict.keys())))
    if not clefs: return None
    matches = difflib.get_close_matches(t_clean, [sans_accent(k) for k in clefs], n=1, cutoff=seuil)
    if matches:
        matched_norm = matches[0]
        for k in clefs:
            if sans_accent(k) == matched_norm:
                return k
    return None

def est_requete_definition(texte):
    t = sans_accent(texte).strip()
    m = re.search(r"^(?:c['\s]est quoi|qu['\s]est-ce qu(?:e|')|qui est|parle[- ]moi de|definition de|definir|definis)\s+(?:le |la |les |un |une |l'|d')?([a-zA-ZÀ-ÿ0-9_-]+)", t)
    if m:
        return m.group(1).strip()
    m_seul = re.search(r"^(?:le |la |les |un |une |des |l'|d')?([a-zA-ZÀ-ÿ0-9_-]+)$", t)
    if m_seul:
        cand = m_seul.group(1).strip()
        if len(cand) >= 3 and cand not in ["bonjour", "salut", "merci"]:
            return cand
    return None

def extraire_x(texte, memoire_dict, regles_dict, syn_dict, ctx_list):
    t = sans_accent(texte).strip()
    m_pourquoi = re.search(r"pourquoi\s+(?:le|la|les|un|une)?\s*([a-zA-ZÀ-ÿ0-9_-]+)", t)
    if m_pourquoi:
        return m_pourquoi.group(1).strip()
    c_def = est_requete_definition(texte)
    if c_def:
        return c_def
    if any(p in t for p in ["il", "elle", "lui", "ceci", "cela"]) and ctx_list:
        return ctx_list[-1]
    return None

def deduire_chaine(sujet, liens_dict, max_depth=6):
    chemin = [sujet]
    curr = sujet
    for _ in range(max_depth):
        parents = liens_dict.get(curr, [])
        if parents:
            curr = parents[0]
            chemin.append(curr)
        else:
            break
    return chemin

def repondre_pourquoi(texte, memoire_dict, regles_dict, liens_dict, syn_dict):
    sujet = extraire_x(texte, memoire_dict, regles_dict, syn_dict, contexte)
    if not sujet: return None
    chaine = deduire_chaine(sujet, liens_dict)
    for ancetre in chaine:
        if ancetre in regles_dict:
            for r in regles_dict[ancetre]:
                if r.get("quant") in ["tous", "chaque"]:
                    return f"Parce que {sujet} est un {ancetre}, et que tous les {ancetre}s {r.get('prop')}."
    return None

def apprendre_de_groq(question, reponse, memoire_dict):
    q_clean = sans_accent(question).strip()
    concept = est_requete_definition(question)
    if concept:
        sujet = concept
        prem_phrase = reponse.split(".")[0].strip()
        if len(prem_phrase) > 10:
            if sujet not in memoire_dict:
                memoire_dict[sujet] = []
            memoire_dict[sujet].insert(0, {
                "def": prem_phrase,
                "poids": 0.85,
                "hits": 1,
                "source": "groq",
                "type": "concept",
                "question_origine": question,
                "last_used": datetime.now().isoformat(),
                "created": datetime.now().isoformat()
            })
            sauvegarder_donnees()
            return sujet
    else:
        # Enregistrer Question + Réponse (Q&A)
        canonical_q = re.sub(r"[?!.,;:\"']+", " ", q_clean).strip()
        if len(canonical_q) > 4:
            if canonical_q not in memoire_dict:
                memoire_dict[canonical_q] = []
            memoire_dict[canonical_q].insert(0, {
                "def": reponse.strip(),
                "poids": 0.85,
                "hits": 1,
                "source": "groq",
                "type": "question_reponse",
                "question_origine": question,
                "last_used": datetime.now().isoformat(),
                "created": datetime.now().isoformat()
            })
            sauvegarder_donnees()
            return canonical_q
    return None

# =========================================================
# APPEL API GROQ ASYNCHRONE
# =========================================================
def appeler_groq_sync(prompt, history_list):
    if not API_KEY.strip():
        return "Clé Groq non configurée. Ouvre les paramètres ou définis API_KEY."
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in history_list[-4:]:
        messages.append(h)
    messages.append({"role": "user", "content": prompt})

    payload = json.dumps({
        "model": MODEL_GROQ,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 600
    }).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {API_KEY.strip()}",
            "Content-Type": "application/json",
            "User-Agent": "kaderbot-pydroid-v14"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        return f"Erreur Groq ({e.code}) : {err_msg}"
    except Exception as e:
        return f"Erreur connexion : {str(e)}"

# =========================================================
# INTERFACE GRAPHIQUE TKINTER (ANDROID & PYDROID 3)
# =========================================================
class KaderbotApp:
    def __init__(self, root):
        self.root = root
        self.root.title("KADERBOT NOVA V14 - Pydroid 3")
        self.root.geometry("480x760")
        self.root.configure(bg="#050508")

        # Bannière supérieure
        top_frame = tk.Frame(root, bg="#090B10", padx=10, pady=8)
        top_frame.pack(fill=tk.X)

        title_lbl = tk.Label(top_frame, text="KADERBOT NOVA V14", fg="#10A37F", bg="#090B10", font=("Arial", 14, "bold"))
        title_lbl.pack(side=tk.LEFT)

        self.stats_lbl = tk.Label(top_frame, text=f"{len(memoire)} faits | {len(regles)} règles", fg="#718096", bg="#090B10", font=("Arial", 9))
        self.stats_lbl.pack(side=tk.RIGHT)

        # Zone d'affichage des messages
        self.chat_area = scrolledtext.ScrolledText(root, bg="#0B0E17", fg="#E2E8F0", font=("Arial", 11), wrap=tk.WORD, bd=0, padx=10, pady=10)
        self.chat_area.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)
        self.chat_area.tag_config("user", foreground="#63B3ED", justify="right")
        self.chat_area.tag_config("bot", foreground="#48BB78")
        self.chat_area.tag_config("logic", foreground="#ED8936")
        self.chat_area.tag_config("system", foreground="#A0AEC0", font=("Arial", 9, "italic"))

        # Boutons d'actions rapides (style Android)
        pills_frame = tk.Frame(root, bg="#050508")
        pills_frame.pack(fill=tk.X, padx=8, pady=2)

        pills = [
            ("C'est quoi...", "c'est quoi "),
            ("Pourquoi...", "pourquoi "),
            ("Retiens", "retiens: "),
            ("Lier", "lie: "),
            ("Idées", "idees 5: "),
            ("Mémoire", "lister: memoire")
        ]
        for label, cmd in pills:
            btn = tk.Button(pills_frame, text=label, bg="#161822", fg="#CBD5E0", activebackground="#2D3748",
                            font=("Arial", 8), bd=1, relief=tk.FLAT, padx=6, pady=2,
                            command=lambda c=cmd: self.prefill(c))
            btn.pack(side=tk.LEFT, padx=2)

        # Barre d'entrée de texte
        bottom_frame = tk.Frame(root, bg="#090B10", padx=8, pady=6)
        bottom_frame.pack(fill=tk.X)

        self.entry = tk.Entry(bottom_frame, bg="#161822", fg="#FFFFFF", insertbackground="#10A37F", font=("Arial", 11), bd=1, relief=tk.FLAT)
        self.entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, padx=(0, 6))
        self.entry.bind("<Return>", lambda e: self.envoyer())

        send_btn = tk.Button(bottom_frame, text="Envoyer", bg="#10A37F", fg="#FFFFFF", activebackground="#0D8A6A",
                             font=("Arial", 10, "bold"), bd=0, padx=12, pady=6, command=self.envoyer)
        send_btn.pack(side=tk.RIGHT)

        # Message d'accueil
        self.ajouter_message("KADERBOT", "Bonjour ! Je suis KADERBOT NOVA V14. Pose-moi une question ou enseigne-moi un fait avec 'retiens: sujet = définition'.", "bot")

    def prefill(self, text):
        self.entry.delete(0, tk.END)
        self.entry.insert(0, text)
        self.entry.focus()

    def ajouter_message(self, auteur, texte, tag):
        self.chat_area.config(state=tk.NORMAL)
        if auteur:
            self.chat_area.insert(tk.END, f"\\n[{auteur}]\\n", tag)
        self.chat_area.insert(tk.END, f"{texte}\\n", tag)
        self.chat_area.see(tk.END)
        self.chat_area.config(state=tk.DISABLED)

    def envoyer(self):
        txt = self.entry.get().strip()
        if not txt: return
        self.entry.delete(0, tk.END)
        self.ajouter_message("Toi", txt, "user")
        self.traiter_message(txt)

    def traiter_message(self, texte):
        txt_lower = texte.lower()

        # 1. Commande retiens
        if txt_lower.startswith("retiens:"):
            corps = texte[8:].strip()
            if "=" in corps:
                s, d = [p.strip() for p in corps.split("=", 1)]
                s_clean = s.lower()
                if s_clean not in memoire: memoire[s_clean] = []
                memoire[s_clean].insert(0, {
                    "def": d, "poids": 0.85, "hits": 1, "source": "manuel",
                    "last_used": datetime.now().isoformat(), "created": datetime.now().isoformat()
                })
                contexte.append(s_clean)
                sauvegarder_donnees()
                self.stats_lbl.config(text=f"{len(memoire)} faits | {len(regles)} règles")
                self.ajouter_message("KADERBOT", f"Fait retenu pour '{s_clean}' : {d}", "bot")
                return
            self.ajouter_message("KADERBOT", "Format : retiens: sujet = définition", "system")
            return

        # 2. Commande lie
        if txt_lower.startswith("lie:"):
            corps = texte[4:].strip()
            if "->" in corps:
                src, dst = [p.strip().lower() for p in corps.split("->", 1)]
                if src not in liens: liens[src] = []
                if dst not in liens[src]: liens[src].append(dst)
                sauvegarder_donnees()
                self.ajouter_message("KADERBOT", f"Lien établi : {src} -> {dst}", "logic")
                return
            self.ajouter_message("KADERBOT", "Format : lie: moineau -> oiseau", "system")
            return

        # 3. Lister
        if txt_lower.startswith("lister:"):
            cible = txt_lower[7:].strip()
            if cible == "memoire":
                keys = sorted(list(memoire.keys()))
                self.ajouter_message("KADERBOT", f"Mémoire ({len(keys)} sujets) :\\n" + ", ".join(keys[:30]), "system")
                return

        # 4. Causalité 'pourquoi'
        if "pourquoi" in txt_lower:
            rep = repondre_pourquoi(texte, memoire, regles, liens, synonymes)
            if rep:
                self.ajouter_message("KADERBOT", rep, "logic")
                return

        # 5. Définition locale
        x = extraire_x(texte, memoire, regles, synonymes, contexte)
        if x and x in memoire:
            contexte.append(x)
            defs = [item["def"] for item in memoire[x]]
            self.ajouter_message("KADERBOT", f"{x.capitalize()} : " + " ; ".join(defs), "bot")
            return

        # 6. Recherche floue
        flou = rechercher_flou(texte, memoire, regles)
        if flou and flou in memoire:
            contexte.append(flou)
            defs = [item["def"] for item in memoire[flou]]
            self.ajouter_message("KADERBOT", f"(Tu voulais dire '{flou}' ?) : " + " ; ".join(defs), "bot")
            return

        # 7. Fallback Groq Asynchrone (Thread pour ne pas figer Android)
        if GROQ_ACTIF:
            self.ajouter_message("KADERBOT", "KADERBOT réfléchit via Groq...", "system")
            threading.Thread(target=self._appeler_groq_thread, args=(texte,)).start()
        else:
            self.ajouter_message("KADERBOT", f"Je ne connais pas encore ce sujet. Enseigne-le moi avec: retiens: {texte} = ...", "bot")

    def _appeler_groq_thread(self, prompt):
        rep = appeler_groq_sync(prompt, historique_chat)
        historique_chat.append({"role": "user", "content": prompt})
        historique_chat.append({"role": "assistant", "content": rep})
        apprendre_de_groq(prompt, rep, memoire)
        self.root.after(0, lambda: self.ajouter_message("KADERBOT", rep, "bot"))

if __name__ == "__main__":
    root = tk.Tk()
    app = KaderbotApp(root)
    root.mainloop()
`;

    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', 'attachment; filename="kaderbot_nova_v14_pydroid.py"');
    return res.send(pythonScript);
  } catch (err: any) {
    console.error('Erreur export pydroid:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur KADERBOT NOVA opérationnel sur http://localhost:${PORT}`);
  });
}

startServer();
