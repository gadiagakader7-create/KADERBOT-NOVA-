# 📦 KADERBOT NOVA V14 - Code Source Complet & Guide d Application Mobile

Ce document contient l intégralité du code source mis à jour de **KADERBOT NOVA** (Interface Hybride, Mode Public/Admin, Clés serveur Render 100% autonomes, Affichage mobile 3 zones fixes).

---

## 📄 Fichier : `package.json`

```json
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build",
    "start": "tsx server.ts",
    "preview": "vite preview",
    "clean": "rm -rf dist server.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "lucide-react": "^0.546.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "vite": "^8.3.0",
    "express": "^4.21.2",
    "dotenv": "^17.2.3",
    "motion": "^12.23.24"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2",
    "@types/express": "^4.17.21"
  }
}

```

---

## 📄 Fichier : `vite.config.ts`

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

```

---

## 📄 Fichier : `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "types": ["vite/client"],
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}

```

---

## 📄 Fichier : `index.html`

```html
<!doctype html>
<html lang="fr" class="dark h-full w-full overflow-hidden">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>KADERBOT NOVA - Système Cognitif & IA</title>
    <meta name="description" content="Assistant cognitif hybride KADERBOT avec moteur d'apprentissage autonome, graphe de connaissances, déduction logique et intégration IA." />
    <meta property="og:title" content="KADERBOT NOVA - Système Cognitif & IA" />
    <meta property="og:description" content="Assistant cognitif hybride KADERBOT avec moteur d'apprentissage autonome, graphe de connaissances, déduction logique et intégration IA." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#0a0a0f" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="KADERBOT" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  </head>
  <body class="bg-[#050508] text-gray-100 antialiased selection:bg-[#10A37F]/30 selection:text-emerald-300 fixed inset-0 w-full h-full overflow-hidden">
    <div id="root" class="w-full h-full overflow-hidden"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

```

---

## 📄 Fichier : `server.ts`

```typescript
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

// 0. Gemini Connection Tester Endpoint (Uses process.env.GEMINI_API_KEY exclusively)
app.post('/api/gemini/test', async (req, res) => {
  try {
    const keyToUse = process.env.GEMINI_API_KEY || req.body?.apiKey;
    if (!keyToUse) {
      return res.status(400).json({
        ok: false,
        error: 'Aucune variable GEMINI_API_KEY configurée sur le serveur.',
      });
    }

    const testClient = new GoogleGenAI({
      apiKey: keyToUse.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const start = Date.now();
    const result = await testClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Réponds en un seul mot: "Connecté".',
    });
    const latencyMs = Date.now() - start;

    return res.json({
      ok: true,
      model: 'gemini-3.8-flash',
      latencyMs,
      reply: result.text?.trim() || 'Connecté',
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 0.1 Groq Connection & Model Tester Endpoint (Uses process.env.GROQ_API_KEY exclusively)
app.post('/api/groq/test', async (req, res) => {
  try {
    const keyToUse = process.env.GROQ_API_KEY || req.body?.apiKey;
    const model = req.body?.model || 'openai/gpt-oss-120b';

    if (!keyToUse) {
      return res.status(400).json({
        ok: false,
        error: 'Aucune variable GROQ_API_KEY configurée sur le serveur.',
      });
    }

    const resolvedModel = resolveGroqModel(model);
    const start = Date.now();

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keyToUse.trim()}`,
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

// 1. Chat endpoint (Exclusively uses process.env.GEMINI_API_KEY and process.env.GROQ_API_KEY)
app.post('/api/chat', async (req, res) => {
  try {
    const {
      prompt,
      history = [],
      provider = 'gemini',
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

    // A. Groq Provider (Exclusively using process.env.GROQ_API_KEY)
    if (provider === 'groq') {
      const serverGroqKey = process.env.GROQ_API_KEY;

      if (!serverGroqKey) {
        console.warn('Pas de GROQ_API_KEY sur le serveur, bascule transparente sur Gemini (GEMINI_API_KEY)');
        const geminiRes = await callGeminiWithFallback(fullPrompt);
        return res.json({
          text: geminiRes.text,
          provider: 'gemini',
          model: geminiRes.model,
          isFallback: true,
          fallbackReason: 'Aucune variable GROQ_API_KEY configurée sur le serveur',
        });
      }

      try {
        const { text, actualModel } = await callGroqWithFallback(prompt, systemPrompt, serverGroqKey, groqModel, history);
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

    // B. Default: Gemini 3.8 Flash (Exclusively using process.env.GEMINI_API_KEY via ai client)
    const geminiRes = await callGeminiWithFallback(fullPrompt);
    return res.json({ text: geminiRes.text, provider: 'gemini', model: geminiRes.model });
  } catch (error: any) {
    console.error('Erreur /api/chat:', error);
    return res.status(500).json({ error: error.message || 'Erreur serveur KADERBOT' });
  }
});

// 2. Ideas Generator endpoint (Exclusively server env keys)
app.post('/api/idees', async (req, res) => {
  try {
    const {
      theme,
      count = 5,
      style = 'creatif',
      styleDesc = '',
      provider = 'gemini',
      groqModel = 'openai/gpt-oss-120b',
    } = req.body;

    const prompt = `Génère exactement ${count} idées courtes sur le thème : "${theme}". Style demandé: ${styleDesc || style}. Format obligatoire : une idée par ligne, numérotée de 1 à ${count}. Pas d'introduction ni de conclusion.`;

    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        const { text } = await callGroqWithFallback(prompt, "Tu es un générateur d'idées créatif et concis.", process.env.GROQ_API_KEY, groqModel);
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

// 3. Translation endpoint (Exclusively server env keys)
app.post('/api/traduis', async (req, res) => {
  try {
    const { text, targetLang, provider = 'gemini', groqModel = 'openai/gpt-oss-120b' } = req.body;
    const prompt = `Traduis le texte suivant en ${targetLang}. Réponds UNIQUEMENT par la traduction exacte, sans commentaire, guillemets ni introduction:\n\n${text}`;

    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        const { text: result } = await callGroqWithFallback(prompt, 'Tu es un traducteur professionnel expert.', process.env.GROQ_API_KEY, groqModel);
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

// 4. Corrector endpoint (Exclusively server env keys)
app.post('/api/corrige', async (req, res) => {
  try {
    const { text, provider = 'gemini', groqModel = 'openai/gpt-oss-120b' } = req.body;
    const prompt = `Corrige les fautes d'orthographe, de grammaire et de ponctuation du texte suivant en gardant le sens et le ton. Réponds uniquement par le texte corrigé:\n\n${text}`;

    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        const { text: result } = await callGroqWithFallback(prompt, 'Tu es un correcteur professionnel.', process.env.GROQ_API_KEY, groqModel);
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

// 5. Summarizer endpoint (Exclusively server env keys)
app.post('/api/resume', async (req, res) => {
  try {
    const { text, provider = 'gemini', groqModel = 'openai/gpt-oss-120b' } = req.body;
    const prompt = `Résume le texte suivant en 2 à 3 phrases claires, précises et directes. Réponds uniquement par le résumé:\n\n${text}`;

    if (provider === 'groq' && process.env.GROQ_API_KEY) {
      try {
        const { text: result } = await callGroqWithFallback(prompt, 'Tu es un expert en synthèse documentaire.', process.env.GROQ_API_KEY, groqModel);
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

// Route de téléchargement de l'archive ZIP complète du projet web
app.get('/api/export-project-zip', (req, res) => {
  try {
    const zipPath = path.resolve(__dirname, '.aistudio/artifacts/brain/1e85614a-1a36-40c9-9d9d-04bf0651ef2e/kaderbot_projet_complet.zip');
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="kaderbot-projet-web-complet.zip"');
      return res.sendFile(zipPath);
    } else {
      return res.status(404).json({ error: "L'archive ZIP n'est pas encore générée." });
    }
  } catch (err) {
    console.error('Erreur export zip:', err);
    return res.status(500).json({ error: 'Erreur lors du téléchargement du zip' });
  }
});

// 7. Python Pydroid 3 Export Script (Multi-mode: Console & Tkinter)
app.post('/api/export-pydroid', (req, res) => {
  try {
    const {
      memoire = {},
      regles = {},
      liens = {},
      synonymes = {},
      groqApiKey = '',
      groqModel = 'openai/gpt-oss-120b',
      mode = 'auto', // 'auto' | 'console' | 'gui'
    } = req.body;
    const resolvedModel = resolveGroqModel(groqModel);

    // Encode memory and rules safely in Base64 so Python json.loads NEVER fails on null, true, false or quotes
    const b64Memoire = Buffer.from(JSON.stringify(memoire)).toString('base64');
    const b64Regles = Buffer.from(JSON.stringify(regles)).toString('base64');
    const b64Liens = Buffer.from(JSON.stringify(liens)).toString('base64');
    const b64Synonymes = Buffer.from(JSON.stringify(synonymes)).toString('base64');

    const defaultTargetMode = mode === 'console' ? 'CONSOLE' : mode === 'gui' ? 'GUI' : 'AUTO';

    const pythonScript = `# -*- coding: utf-8 -*-
"""
================================================================================
KADERBOT NOVA V14 - APPLICATION COMPLETE MULTI-MODE POUR PYDROID 3 (ANDROID)
================================================================================
Généré par KADERBOT NOVA Web Studio.
Ce script est conçu pour fonctionner SANS AUCUN CRASH sur Pydroid 3 (Android).

CARACTERISTIQUES :
- Mode hybride intelligent : Console interactive ultra-fluide ou Interface Tkinter
- Tolérance zéro crash : Si Tkinter n'est pas installé sur Android, bascule
  automatiquement sur la Console interactive
- Moteur cognitif complet : Déduction symbolique, causalité 'pourquoi',
  recherche floue (difflib), et association sémantique Question-Réponse
- Sauvegarde locale automatique dans 'kaderbot_memoire.json' sur votre téléphone
- Connectivité Groq Cloud ultra-rapide (${resolvedModel})
================================================================================
"""

import sys
import os
import json
import base64
import re
import difflib
import unicodedata
import threading
import urllib.request
import urllib.error
from datetime import datetime

# ==============================================================================
# CONFIGURATION & MODE D'EXECUTION
# ==============================================================================
# Modes possibles : 'CONSOLE' (recommandé Pydroid 3), 'GUI' (Tkinter), ou 'AUTO'
MODE_CIBLE = "${defaultTargetMode}"

API_KEY = "${groqApiKey}"
API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL_GROQ = "${resolvedModel}"
GROQ_ACTIF = bool(API_KEY.strip())

SYSTEM_PROMPT = (
    "Tu es KADERBOT, un assistant cognitif sympa, concis et curieux. "
    "Tu réponds toujours en français, en 2 à 4 phrases maximum."
)

DATA_FILE = "kaderbot_memoire.json"

# ==============================================================================
# CHARGEMENT DES BASES DE CONNAISSANCES (DECODAGE BASE64 ULTRA-STABLE)
# ==============================================================================
def _decoder_base64_json(payload_b64):
    try:
        raw_bytes = base64.b64decode(payload_b64.encode('utf-8'))
        return json.loads(raw_bytes.decode('utf-8'))
    except Exception as e:
        print("[!] Erreur décodage interne:", e)
        return {}

memoire = _decoder_base64_json("${b64Memoire}")
regles = _decoder_base64_json("${b64Regles}")
liens = _decoder_base64_json("${b64Liens}")
synonymes = _decoder_base64_json("${b64Synonymes}")

contexte = []
historique_chat = []

# ==============================================================================
# PERSISTANCE LOCALE ANDROID
# ==============================================================================
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
        print("[!] Erreur sauvegarde locale :", e)
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
            print("[!] Erreur chargement sauvegarde :", e)

charger_donnees()

# ==============================================================================
# OUTILS LINGUISTIQUES & EXTRACTION SEMANTIQUE
# ==============================================================================
MOTS_INTERROGATIFS_ET_VIDES = {
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l',
    'ce', 'cet', 'cette', 'ces', 'mon', 'ton', 'son', 'ma', 'ta', 'sa',
    'qui', 'que', 'quoi', 'quel', 'quelle', 'quels', 'quelles',
    'comment', 'pourquoi', 'quand', 'est', 'sont', 'ete', 'etre',
    'avoir', 'fait', 'font', 'bonjour', 'salut', "s'il", 'te', 'plait'
}

def sans_accent(t):
    if not t: return ""
    return "".join(c for c in unicodedata.normalize("NFD", str(t)) if unicodedata.category(c) != "Mn").lower()

PONCT_SET = set(['?', '!', '.', ',', ';', ':', '"', chr(39), '(', ')', '[', ']', '{', '}', '-'])

def nettoyer_ponctuation(chaine):
    return "".join(" " if c in PONCT_SET else c for c in chaine)

def normaliser_question_cle(q):
    s = sans_accent(q)
    s = nettoyer_ponctuation(s)
    tokens = [w.strip() for w in s.split() if w.strip()]
    tokens_significatifs = [w for w in tokens if w not in MOTS_INTERROGATIFS_ET_VIDES and len(w) > 2]
    return " ".join(tokens_significatifs if tokens_significatifs else tokens)

def extraire_mots_cles(q):
    s = sans_accent(q)
    s = nettoyer_ponctuation(s)
    tokens = [w.strip() for w in s.split() if w.strip()]
    return set([w for w in tokens if w not in MOTS_INTERROGATIFS_ET_VIDES and len(w) > 2])

def rechercher_flou(texte, memoire_dict, regles_dict, seuil=0.72):
    t_clean = sans_accent(texte).strip()
    clefs = list(set(list(memoire_dict.keys()) + list(regles_dict.keys())))
    if not clefs: return None
    matches = difflib.get_close_matches(t_clean, [sans_accent(k) for k in clefs], n=1, cutoff=seuil)
    if matches:
        matched_norm = matches[0]
        for k in clefs:
            if sans_accent(k) == matched_norm:
                return k
    return None

def trouver_question_reponse(question, memoire_dict, seuil=0.70):
    if not question or not memoire_dict: return None
    q_norm = normaliser_question_cle(question)
    q_mots = extraire_mots_cles(question)
    if not q_norm and not q_mots: return None

    meilleur = None
    meilleur_score = 0.0

    for sujet, entries in memoire_dict.items():
        if not entries: continue
        entry = entries[0]
        is_qa = entry.get("type") == "question_reponse" or bool(entry.get("question_origine")) or " " in sujet
        if not is_qa: continue

        sujet_norm = normaliser_question_cle(entry.get("question_origine") or sujet)
        sujet_mots = set(entry.get("mots_cles") or list(extraire_mots_cles(sujet_norm)))

        if q_norm == sujet_norm:
            return {"sujet": sujet, "entry": entry, "score": 1.0}

        score = 0.0
        if q_mots and sujet_mots:
            intersection = q_mots.intersection(sujet_mots)
            union = q_mots.union(sujet_mots)
            score = len(intersection) / float(len(union)) if union else 0.0

        if score > meilleur_score:
            meilleur_score = score
            meilleur = {"sujet": sujet, "entry": entry, "score": score}

    if meilleur and meilleur_score >= seuil:
        return meilleur
    return None

def est_requete_definition(texte):
    t = sans_accent(texte).strip().rstrip("?.! ")
    prefixes = [
        "c'est quoi", "cest quoi", "qu'est ce que", "qu'est-ce que",
        "qu'est ce qu'", "qu'est-ce qu'", "qui est", "parle moi de",
        "parle-moi de", "definition de", "definir", "definis"
    ]
    for pref in prefixes:
        if t.startswith(pref):
            reste = t[len(pref):].strip()
            for art in ["le ", "la ", "les ", "un ", "une ", "des ", "l'", "d'"]:
                if reste.startswith(art):
                    reste = reste[len(art):].strip()
                    break
            mots = reste.split()
            if mots:
                return mots[0]
    mots_totaux = t.split()
    if len(mots_totaux) == 1:
        mot = mots_totaux[0]
        if len(mot) >= 3 and mot not in ["bonjour", "salut", "merci", "aide", "oui", "non"]:
            return mot
    elif len(mots_totaux) == 2 and mots_totaux[0] in ["le", "la", "les", "un", "une", "des", "ce", "cet", "cette"]:
        return mots_totaux[1]
    return None

def extraire_x(texte, memoire_dict, regles_dict, syn_dict, ctx_list):
    t = sans_accent(texte).strip().rstrip("?.! ")
    if "pourquoi" in t:
        idx = t.find("pourquoi")
        reste = t[idx + 8:].strip()
        for art in ["le ", "la ", "les ", "un ", "une ", "l'", "d'"]:
            if reste.startswith(art):
                reste = reste[len(art):].strip()
                break
        mots = reste.split()
        if mots:
            return mots[0]
    c_def = est_requete_definition(texte)
    if c_def:
        return c_def
    for p in ["il", "elle", "lui", "ceci", "cela"]:
        if p in t.split() and ctx_list:
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
        # Enregistrer Question + Réponse (Q&R)
        canonical_q = " ".join(nettoyer_ponctuation(q_clean).split())
        if len(canonical_q) > 4:
            mots_cles = list(extraire_mots_cles(question))
            if canonical_q not in memoire_dict:
                memoire_dict[canonical_q] = []
            memoire_dict[canonical_q].insert(0, {
                "def": reponse.strip(),
                "poids": 0.85,
                "hits": 1,
                "source": "groq",
                "type": "question_reponse",
                "mots_cles": mots_cles,
                "question_origine": question,
                "last_used": datetime.now().isoformat(),
                "created": datetime.now().isoformat()
            })
            sauvegarder_donnees()
            return canonical_q
    return None

# ==============================================================================
# APPEL API GROQ
# ==============================================================================
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

# ==============================================================================
# DISPATCHER CENTRAL DE TRAITEMENT DES MESSAGES
# ==============================================================================
def traiter_message_texte(texte):
    """
    Traite un message et retourne un tuple : (type_source, message_reponse)
    type_source : 'LOCAL', 'DEDUCTION', 'GROQ', 'COMMANDE', 'SYSTEME'
    """
    txt = texte.strip()
    if not txt:
        return ("SYSTEME", "Message vide.")
    txt_lower = txt.lower()

    # 1. Commande retiens
    if txt_lower.startswith("retiens:"):
        corps = txt[8:].strip()
        if "=" in corps:
            s, d = [p.strip() for p in corps.split("=", 1)]
            s_clean = s.lower()
            if s_clean not in memoire: memoire[s_clean] = []
            memoire[s_clean].insert(0, {
                "def": d, "poids": 0.85, "hits": 1, "source": "manuel",
                "type": "concept",
                "last_used": datetime.now().isoformat(), "created": datetime.now().isoformat()
            })
            contexte.append(s_clean)
            sauvegarder_donnees()
            return ("COMMANDE", f"Fait retenu pour '{s_clean}' : {d}")
        return ("SYSTEME", "Format : retiens: sujet = définition")

    # 2. Commande lie
    if txt_lower.startswith("lie:"):
        corps = txt[4:].strip()
        if "->" in corps:
            src, dst = [p.strip().lower() for p in corps.split("->", 1)]
            if src not in liens: liens[src] = []
            if dst not in liens[src]: liens[src].append(dst)
            sauvegarder_donnees()
            return ("DEDUCTION", f"Lien d'héritage établi : {src} -> {dst}")
        return ("SYSTEME", "Format : lie: moineau -> oiseau")

    # 3. Commande lister
    if txt_lower.startswith("lister:"):
        cible = txt_lower[7:].strip()
        if cible == "memoire":
            keys = sorted(list(memoire.keys()))
            return ("SYSTEME", f"Mémoire ({len(keys)} sujets) :\\n" + ", ".join(keys[:35]))
        if cible == "regles":
            return ("SYSTEME", f"Règles ({len(regles)} catégories) :\\n" + ", ".join(regles.keys()))
        if cible == "liens":
            lignes = [f"{k} -> {', '.join(v)}" for k, v in liens.items()]
            return ("SYSTEME", "Liens d'héritage :\\n" + "\\n".join(lignes[:20]))

    # 4. Question causale 'pourquoi'
    if "pourquoi" in txt_lower:
        rep = repondre_pourquoi(txt, memoire, regles, liens, synonymes)
        if rep:
            return ("DEDUCTION", rep)

    # 5. Recherche Question-Réponse (Q&R enregistrée)
    qa_match = trouver_question_reponse(txt, memoire)
    if qa_match:
        entry = qa_match["entry"]
        rep = entry.get("def", "")
        return ("LOCAL", rep)

    # 6. Définition directe de concept
    x = extraire_x(txt, memoire, regles, synonymes, contexte)
    if x and x in memoire:
        contexte.append(x)
        defs = [item["def"] for item in memoire[x]]
        return ("LOCAL", f"{x.capitalize()} : " + " ; ".join(defs))

    # 7. Recherche floue Levenshtein (en cas de faute de frappe)
    flou = rechercher_flou(txt, memoire, regles)
    if flou and flou in memoire:
        contexte.append(flou)
        defs = [item["def"] for item in memoire[flou]]
        return ("LOCAL", f"(Tu voulais dire '{flou}' ?) : " + " ; ".join(defs))

    # 8. Fallback Groq Cloud
    if GROQ_ACTIF:
        rep = appeler_groq_sync(txt, historique_chat)
        historique_chat.append({"role": "user", "content": txt})
        historique_chat.append({"role": "assistant", "content": rep})
        apprendre_de_groq(txt, rep, memoire)
        return ("GROQ", rep)

    return ("LOCAL", f"Je ne connais pas encore ce sujet. Enseigne-le moi avec : retiens: {txt} = ...")

# ==============================================================================
# MODE 1 : INTERFACE CONSOLE / TERMINAL INTERACTIF (100% GARANTI SUR PYDROID 3)
# ==============================================================================
def lancer_mode_console():
    banner = f"""
================================================================================
          KADERBOT NOVA V14 - MOTEUR COGNITIF HYBRIDE (PYDROID 3)
================================================================================
[INFO] Mémoire locale chargée : {len(memoire)} entrées | {len(regles)} règles | {len(liens)} liens
[INFO] Modèle Groq actif : {"OUI (" + MODEL_GROQ + ")" if GROQ_ACTIF else "NON (Mode local seul)"}
--------------------------------------------------------------------------------
Commandes utiles :
  • Poser une question   : "c'est quoi le moineau ?", "pourquoi le faucon vole ?"
  • Apprendre un concept : "retiens: pigeon = oiseau urbain"
  • Créer un lien Is-A   : "lie: pigeon -> oiseau"
  • Inspecter la mémoire : "lister: memoire" ou "lister: regles"
  • Quitter              : "quitter" ou "exit"
================================================================================
"""
    print(banner)

    while True:
        try:
            user_input = input("\\n[Toi] > ").strip()
            if not user_input:
                continue

            if user_input.lower() in ["quitter", "exit", "quit", "q"]:
                print("\\n[KADERBOT] Au revoir et à bientôt ! Données sauvegardées.")
                sauvegarder_donnees()
                break

            source, reponse = traiter_message_texte(user_input)
            prefixe = f"[KADERBOT | {source}]"
            print(f"\\n{prefixe}\\n{reponse}")

        except (KeyboardInterrupt, EOFError):
            print("\\n\\n[KADERBOT] Interruption détectée. Données sauvegardées.")
            sauvegarder_donnees()
            break
        except Exception as err:
            print(f"[!] Erreur inattendue : {err}")

# ==============================================================================
# MODE 2 : INTERFACE GRAPHIQUE TKINTER (SI DISPONIBLE SUR ANDROID)
# ==============================================================================
def lancer_mode_tkinter():
    try:
        import tkinter as tk
        from tkinter import scrolledtext
    except Exception as e:
        print(f"[!] Tkinter n'est pas disponible dans ce Pydroid 3 ({e}).")
        print("[*] Bascule automatique sur la Console Interactive...")
        lancer_mode_console()
        return

    class KaderbotTkApp:
        def __init__(self, root):
            self.root = root
            self.root.title("KADERBOT NOVA V14 - Pydroid 3")
            self.root.geometry("480x760")
            self.root.configure(bg="#050508")

            # Bannière supérieure
            top_frame = tk.Frame(root, bg="#090B10", padx=10, pady=8)
            top_frame.pack(fill=tk.X)

            title_lbl = tk.Label(top_frame, text="KADERBOT NOVA V14", fg="#10A37F", bg="#090B10", font=("Arial", 13, "bold"))
            title_lbl.pack(side=tk.LEFT)

            self.stats_lbl = tk.Label(top_frame, text=f"{len(memoire)} faits", fg="#718096", bg="#090B10", font=("Arial", 9))
            self.stats_lbl.pack(side=tk.RIGHT)

            # Zone de discussion
            self.chat_area = scrolledtext.ScrolledText(root, bg="#0B0E17", fg="#E2E8F0", font=("Arial", 11), wrap=tk.WORD, bd=0, padx=10, pady=10)
            self.chat_area.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)
            self.chat_area.tag_config("user", foreground="#63B3ED", justify="right")
            self.chat_area.tag_config("bot", foreground="#48BB78")
            self.chat_area.tag_config("system", foreground="#A0AEC0", font=("Arial", 9, "italic"))

            # Raccourcis tactiles
            pills_frame = tk.Frame(root, bg="#050508")
            pills_frame.pack(fill=tk.X, padx=8, pady=2)
            pills = [("C'est quoi...", "c'est quoi "), ("Pourquoi...", "pourquoi "), ("Retiens", "retiens: "), ("Mémoire", "lister: memoire")]
            for label, cmd in pills:
                btn = tk.Button(pills_frame, text=label, bg="#161822", fg="#CBD5E0", font=("Arial", 8), bd=1, relief=tk.FLAT, padx=6, pady=2,
                                command=lambda c=cmd: self.prefill(c))
                btn.pack(side=tk.LEFT, padx=2)

            # Zone d'envoi
            bottom_frame = tk.Frame(root, bg="#090B10", padx=8, pady=6)
            bottom_frame.pack(fill=tk.X)
            self.entry = tk.Entry(bottom_frame, bg="#161822", fg="#FFFFFF", insertbackground="#10A37F", font=("Arial", 11), bd=1, relief=tk.FLAT)
            self.entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, padx=(0, 6))
            self.entry.bind("<Return>", lambda e: self.envoyer())

            send_btn = tk.Button(bottom_frame, text="Envoyer", bg="#10A37F", fg="#FFFFFF", font=("Arial", 10, "bold"), bd=0, padx=12, pady=6, command=self.envoyer)
            send_btn.pack(side=tk.RIGHT)

            self.ajouter_message("KADERBOT", "Bonjour ! Je suis KADERBOT NOVA V14. Pose-moi une question ou utilise 'retiens: sujet = définition'.", "bot")

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
            source, rep = traiter_message_texte(txt)
            self.stats_lbl.config(text=f"{len(memoire)} faits")
            self.ajouter_message(f"KADERBOT | {source}", rep, "bot")

    try:
        root = tk.Tk()
        app = KaderbotTkApp(root)
        root.mainloop()
    except Exception as e:
        print(f"[!] Erreur au lancement de l'interface graphique Tkinter ({e}).")
        print("[*] Bascule automatique sur la Console Interactive...")
        lancer_mode_console()

# ==============================================================================
# POINT D'ENTREE PRINCIPAL
# ==============================================================================
if __name__ == "__main__":
    if MODE_CIBLE == "GUI":
        lancer_mode_tkinter()
    elif MODE_CIBLE == "CONSOLE":
        lancer_mode_console()
    else: # AUTO
        try:
            import tkinter as tk
            lancer_mode_tkinter()
        except Exception:
            lancer_mode_console()
`;

    const filename =
      mode === 'console'
        ? 'kaderbot_v14_pydroid_terminal.py'
        : mode === 'gui'
        ? 'kaderbot_v14_pydroid_tkinter.py'
        : 'kaderbot_v14_pydroid.py';

    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
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

```

---

## 📄 Fichier : `src/main.tsx`

```typescript
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

```

---

## 📄 Fichier : `src/App.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Brain,
  Scale,
  Wrench,
  FolderTree,
} from 'lucide-react';

import {
  AppConfig,
  ChatMessage,
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from './types/kaderbot';
import {
  SEED_MEMORY,
  SEED_RULES,
  SEED_LINKS,
  sansAccent,
  estSalutation,
  repondreSalutation,
  detecterEtat,
  repondreEtat,
  extraireX,
  extraireQuantificateur,
  phraseDef,
  repondrePourquoi,
  deduireChaine,
  deduireGeneralisation,
  construirePhraseGeneralisation,
  apprendreDeLLM,
  rechercherFlou,
  naviguerLiens,
  trouverLiensCommuns,
  corriger,
  trouverQuestionReponse,
  estRequeteDefinition,
  nettoyerMemoirePolluee,
} from './core/cognitiveEngine';
import { Header } from './components/Header';
import { ChatTab } from './components/ChatTab';
import { KnowledgeGraphTab } from './components/KnowledgeGraphTab';
import { RulesTab } from './components/RulesTab';
import { ToolsTab } from './components/ToolsTab';
import { SessionsTab } from './components/SessionsTab';
import { ActionMenuModal } from './components/ActionMenuModal';
import { SettingsModal } from './components/SettingsModal';
import { apiService } from './services/apiService';

export default function App() {
  // Admin detection via URL (?admin=true)
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === 'true';
  });

  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'rules' | 'tools' | 'sessions'>('chat');

  // Keep admin status synced on URL changes
  useEffect(() => {
    const checkAdmin = () => {
      const params = new URLSearchParams(window.location.search);
      setIsAdmin(params.get('admin') === 'true');
    };
    window.addEventListener('popstate', checkAdmin);
    return () => window.removeEventListener('popstate', checkAdmin);
  }, []);

  // When not in admin mode, restrict active tab to 'chat' or 'tools'
  useEffect(() => {
    if (!isAdmin && (activeTab === 'graph' || activeTab === 'rules' || activeTab === 'sessions')) {
      setActiveTab('chat');
    }
  }, [isAdmin, activeTab]);

  // Modals state
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Configuration
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('kaderbot_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.groqModel === 'llama-3.3-70b-versatile' || !parsed.groqModel) {
          parsed.groqModel = 'openai/gpt-oss-120b';
        }
        return parsed;
      } catch {}
    }
    return {
      provider: 'gemini',
      geminiApiKey: '',
      groqApiKey: '',
      groqModel: 'openai/gpt-oss-120b',
      geminiModel: 'gemini-3.8-flash',
      systemPrompt:
        'Tu es KADERBOT, un assistant sympa, concis et curieux. ' +
        'Tu réponds toujours en français, en 2 à 4 phrases maximum. ' +
        'Tu ne fais pas de listes à puces sauf si on te le demande. ' +
        'Tu es chaleureux mais pas excessif.',
      activeSession: 'defaut',
      soundEnabled: false,
      autoLearnFromLLM: true,
    };
  });

  // Sessions state
  const [sessions, setSessions] = useState<string[]>(() => {
    const saved = localStorage.getItem('kaderbot_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return ['defaut'];
  });

  // Knowledge base state for active session
  const [memoire, setMemoire] = useState<MemoryStore>(() => {
    const saved = localStorage.getItem(`kaderbot_memoire_${config.activeSession}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        nettoyerMemoirePolluee(parsed);
        return parsed;
      } catch {}
    }
    return { ...SEED_MEMORY };
  });

  const [regles, setRegles] = useState<RulesStore>(() => {
    const saved = localStorage.getItem(`kaderbot_regles_${config.activeSession}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return SEED_RULES;
  });

  const [liens, setLiens] = useState<LinksStore>(() => {
    const saved = localStorage.getItem(`kaderbot_liens_${config.activeSession}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return SEED_LINKS;
  });

  const [synonymes, setSynonymes] = useState<SynonymsStore>(() => {
    const saved = localStorage.getItem(`kaderbot_synonymes_${config.activeSession}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      ordi: 'ordinateur',
      bagnole: 'voiture',
      auto: 'voiture',
    };
  });

  // Pronoun context history
  const [contexte, setContexte] = useState<string[]>([]);
  const [chatPrefill, setChatPrefill] = useState('');
  const [dernieresIdees, setDernieresIdees] = useState<string[]>([]);
  const [groqLog, setGroqLog] = useState<Array<{ q: string; r: string; time: string }>>([]);

  // Messages list
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const hour = new Date().getHours();
    let welcome = 'Bonjour, prêt pour une nouvelle session inspirante ?';
    if (hour >= 12 && hour < 18) {
      welcome = "Bon après-midi, je suis là pour t'aider.";
    } else if (hour >= 18 || hour < 6) {
      welcome = 'Bonsoir, envie de discuter ou d’apprendre ensemble ?';
    }

    return [
      {
        id: 'welcome',
        author: 'KB',
        text: `${welcome} Je suis KADERBOT NOVA V14. Pose-moi une question, enseigne-moi un fait avec "retiens: ...", ou explore les déductions logiques.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        meta: { source: 'systeme' },
      },
    ];
  });

  const [isThinking, setIsThinking] = useState(false);

  // Server Memory Synchronization (Requirement 4: Share data live between Admin and Public)
  const lastServerTimestamp = useRef<string>('');
  const isSyncingRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSharedMemory = async () => {
      if (isSyncingRef.current) return;
      try {
        const remote = await apiService.loadMemoryFromServer();
        if (remote && isMounted) {
          const remoteUpdated = (remote as any).updatedAt || '';
          if (remoteUpdated && remoteUpdated === lastServerTimestamp.current) {
            return;
          }
          if (remote.memoire && Object.keys(remote.memoire).length > 0) {
            setMemoire(remote.memoire);
          }
          if (remote.regles && Object.keys(remote.regles).length > 0) {
            setRegles(remote.regles);
          }
          if (remote.liens && Object.keys(remote.liens).length > 0) {
            setLiens(remote.liens);
          }
          if (remote.synonymes && Object.keys(remote.synonymes).length > 0) {
            setSynonymes(remote.synonymes);
          }
          if (remote.sessions && remote.sessions.length > 0) {
            setSessions(remote.sessions);
          }
          if (remoteUpdated) {
            lastServerTimestamp.current = remoteUpdated;
          }
        }
      } catch (err) {
        // Silently keep local state if offline
      }
    };

    fetchSharedMemory();
    const interval = setInterval(fetchSharedMemory, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync to localStorage & Server disk
  useEffect(() => {
    localStorage.setItem('kaderbot_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('kaderbot_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(`kaderbot_memoire_${config.activeSession}`, JSON.stringify(memoire));
    localStorage.setItem(`kaderbot_regles_${config.activeSession}`, JSON.stringify(regles));
    localStorage.setItem(`kaderbot_liens_${config.activeSession}`, JSON.stringify(liens));
    localStorage.setItem(`kaderbot_synonymes_${config.activeSession}`, JSON.stringify(synonymes));

    // Save to server backend so updates made in Admin mode are shared to all users
    isSyncingRef.current = true;
    apiService
      .saveMemoryToServer({
        memoire,
        regles,
        liens,
        synonymes,
        sessions,
      })
      .then(res => {
        if (res && res.savedAt) {
          lastServerTimestamp.current = res.savedAt;
        }
      })
      .catch(() => {})
      .finally(() => {
        isSyncingRef.current = false;
      });
  }, [memoire, regles, liens, synonymes, config.activeSession, sessions]);

  // Adjust hits on specific concept definition
  const handleAdjustHits = (sujet: string, entryIdx: number, delta: number) => {
    setMemoire(prev => {
      const list = prev[sujet];
      if (!list || !list[entryIdx]) return prev;
      const updated = [...list];
      const newHits = Math.max(0, (updated[entryIdx].hits || 0) + delta);
      updated[entryIdx] = { ...updated[entryIdx], hits: newHits };
      return { ...prev, [sujet]: updated };
    });
  };

  // Handle switching sessions
  const handleSelectSession = (newSession: string) => {
    if (newSession === config.activeSession) return;
    setConfig(prev => ({ ...prev, activeSession: newSession }));

    const savedMemo = localStorage.getItem(`kaderbot_memoire_${newSession}`);
    const savedRegles = localStorage.getItem(`kaderbot_regles_${newSession}`);
    const savedLiens = localStorage.getItem(`kaderbot_liens_${newSession}`);

    setMemoire(savedMemo ? JSON.parse(savedMemo) : SEED_MEMORY);
    setRegles(savedRegles ? JSON.parse(savedRegles) : SEED_RULES);
    setLiens(savedLiens ? JSON.parse(savedLiens) : SEED_LINKS);

    addBotMessage(`Session chargée : ${newSession}`);
  };

  const handleCreateSession = (name: string) => {
    if (sessions.includes(name)) return;
    const updated = [...sessions, name];
    setSessions(updated);
    handleSelectSession(name);
  };

  const addBotMessage = (
    text: string,
    meta?: ChatMessage['meta'],
    confidence?: number
  ) => {
    const newMsg: ChatMessage = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      author: 'KB',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      confidence,
      meta,
    };
    setMessages(prev => [...prev, newMsg]);

    // Audio narration if enabled
    if (config.soundEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    }
  };

  // Adjust cognitive weight
  const handleAdjustWeight = (sujet: string, delta: number) => {
    setMemoire(prev => {
      const copy = { ...prev };
      if (!copy[sujet] || copy[sujet].length === 0) return prev;
      const list = copy[sujet].map((entry, idx) => {
        if (idx === 0) {
          const newWeight = Math.max(0.1, Math.min(1.0, entry.poids + delta));
          return {
            ...entry,
            poids: Number(newWeight.toFixed(2)),
            hits: entry.hits + 1,
            last_used: new Date().toISOString(),
          };
        }
        return entry;
      });
      copy[sujet] = list;
      return copy;
    });

    const isPositive = delta > 0;
    addBotMessage(
      isPositive
        ? `Parfait ! J'ai renforcé ma certitude sur "${sujet}" (+${delta}).`
        : `Compris ! J'ai baissé mon indice de confiance sur "${sujet}" (${delta}).`
    );
  };

  // Add rule helper
  const handleAddRule = (
    quant: 'tous' | 'aucun' | 'certains',
    sujet: string,
    prop: string,
    poids = 0.85
  ) => {
    const s = sujet.toLowerCase().trim();
    const p = prop.toLowerCase().trim();
    setRegles(prev => {
      const copy = { ...prev };
      const current = copy[s] ? [...copy[s]] : [];
      const existing = current.find(r => r.quant === quant && r.prop === p);
      if (existing) {
        existing.poids = Math.min(1.0, existing.poids + 0.1);
        existing.hits += 1;
        existing.last_used = new Date().toISOString();
      } else {
        current.push({
          quant,
          prop: p,
          poids,
          hits: 1,
          last_used: new Date().toISOString(),
          created: new Date().toISOString(),
        });
      }
      copy[s] = current;
      return copy;
    });
  };

  const handleDeleteRule = (sujet: string, prop: string) => {
    setRegles(prev => {
      const copy = { ...prev };
      if (!copy[sujet]) return prev;
      copy[sujet] = copy[sujet].filter(r => r.prop !== prop);
      if (copy[sujet].length === 0) delete copy[sujet];
      return copy;
    });
  };

  const handleAddLink = (source: string, target: string) => {
    const s = source.toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (!s || !t || s === t) return;
    setLiens(prev => {
      const copy = { ...prev };
      const current = copy[s] ? [...copy[s]] : [];
      if (!current.includes(t)) {
        current.push(t);
        copy[s] = current;
      }
      return copy;
    });
  };

  const handleDeleteLink = (source: string, target: string) => {
    setLiens(prev => {
      const copy = { ...prev };
      if (!copy[source]) return prev;
      copy[source] = copy[source].filter(item => item !== target);
      if (copy[source].length === 0) delete copy[source];
      return copy;
    });
  };

  // CORE COGNITIVE NLP DISPATCHER
  // Faithfully executing every capability from the user's Python code
  const handleProcessUserMessage = async (rawMessage: string) => {
    const text = rawMessage.trim();
    if (!text) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      author: 'Toi',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);

    const msgLower = text.toLowerCase();
    const msgClean = sansAccent(msgLower);

    // 1. Context commands
    if (msgLower === 'reset contexte' || msgLower === 'vider contexte') {
      setContexte([]);
      addBotMessage('Contexte cognitif réinitialisé.', { source: 'systeme' });
      return;
    }

    if (msgLower === 'contexte') {
      if (contexte.length === 0) {
        addBotMessage('Aucun échange en contexte actuellement.', { source: 'systeme' });
      } else {
        addBotMessage(`Contexte actuel (${contexte.length} concepts récents) : ${contexte.join(' → ')}`, { source: 'systeme' });
      }
      return;
    }

    // 2. Groq toggle & status commands
    if (msgLower === 'groq on') {
      setConfig(prev => ({ ...prev, provider: 'groq' }));
      addBotMessage('Moteur Groq activé.', { source: 'systeme' });
      return;
    }

    if (msgLower === 'groq off') {
      setConfig(prev => ({ ...prev, provider: 'local_only' }));
      addBotMessage('Mode 100% local activé (Groq désactivé).', { source: 'systeme' });
      return;
    }

    if (msgLower === 'groq statut') {
      addBotMessage(
        `Statut IA :\nMoteur actif : ${config.provider}\nModèle : ${config.provider === 'groq' ? config.groqModel : config.geminiModel}\nApprentissage auto : ${config.autoLearnFromLLM ? 'Activé' : 'Désactivé'}`
      );
      return;
    }

    // 3. Direct Groq question
    if (msgLower.startsWith('groq:')) {
      const q = text.slice(5).trim();
      if (!q) {
        addBotMessage('Format : groq: ta question');
        return;
      }
      setIsThinking(true);
      try {
        const res = await apiService.chat({
          prompt: q,
          history: messages.slice(-5).map(m => ({
            role: m.author === 'Toi' ? ('user' as const) : ('assistant' as const),
            content: m.text,
          })),
          provider: 'groq',
          groqModel: config.groqModel || 'openai/gpt-oss-120b',
          systemPrompt: config.systemPrompt,
        });
        addBotMessage(res.text, { source: res.provider === 'gemini' ? 'gemini' : 'groq' });
        setGroqLog(prev => [{ q, r: res.text, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 20)]);
        if (config.autoLearnFromLLM) {
          const learned = apprendreDeLLM(q, res.text, memoire, 'groq');
          if (learned) {
            setMemoire({ ...memoire });
            setContexte(prev => [...prev, learned.sujet]);
          }
        }
      } catch (err: any) {
        addBotMessage(`(Groq) Erreur : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 4. Session commands
    if (msgLower === 'session' || msgLower === 'session active') {
      addBotMessage(
        `Session active : ${config.activeSession}\nSujets en mémoire : ${Object.keys(memoire).length}\nRègles actives : ${Object.values(regles).reduce((acc, l) => acc + l.length, 0)}`
      );
      return;
    }

    if (msgLower === 'sessions' || msgLower === 'lister: sessions') {
      addBotMessage(`Sessions disponibles :\n${sessions.map(s => ` - ${s}${s === config.activeSession ? ' (active)' : ''}`).join('\n')}\n\nPour changer : écris "session <nom>"`);
      return;
    }

    if (msgLower.startsWith('session ')) {
      const newName = text.split(' ')[1]?.trim().toLowerCase();
      if (newName) {
        handleCreateSession(newName);
        return;
      }
    }

    // 5. Taxonomy & Link commands: lie:, delie:, liens:, cousins:
    if (msgLower.startsWith('lie:') || msgLower.startsWith('lie ')) {
      const rest = text.includes(':') ? text.split(':')[1].trim() : text.slice(3).trim();
      if (rest.includes('->')) {
        const [source, target] = rest.split('->').map(s => s.trim().toLowerCase());
        handleAddLink(source, target);
        addBotMessage(`Lien cognitif établi : ${source} -> ${target}`, { source: 'local_memoire' });
        return;
      }
      addBotMessage('Format requis : lie: source -> cible (ex: lie: moineau -> oiseau)');
      return;
    }

    if (msgLower.startsWith('delie:') || msgLower.startsWith('delie ')) {
      const rest = text.includes(':') ? text.split(':')[1].trim() : text.slice(5).trim();
      if (rest.includes('->')) {
        const [source, target] = rest.split('->').map(s => s.trim().toLowerCase());
        handleDeleteLink(source, target);
        addBotMessage(`Lien supprimé : ${source} -> ${target}`, { source: 'local_memoire' });
        return;
      }
      addBotMessage('Format requis : delie: source -> cible');
      return;
    }

    if (msgLower.startsWith('liens:') || msgLower.startsWith('liens ')) {
      const target = text.includes(':') ? text.split(':')[1].trim().toLowerCase() : text.slice(5).trim().toLowerCase();
      const parents = liens[target] || [];
      const children = Object.keys(liens).filter(k => (liens[k] || []).includes(target));
      const chain = naviguerLiens(target, liens, 8);
      let rep = `Liens pour "${target}" :\nParents : ${parents.join(', ') || 'aucun'}\nEnfants : ${children.join(', ') || 'aucun'}`;
      if (chain.length > 1) {
        rep += `\nChaîne complète : ${chain.join(' → ')}`;
      }
      addBotMessage(rep, { source: 'local_memoire' });
      return;
    }

    if (msgLower.startsWith('cousins:') || msgLower.startsWith('cousins ')) {
      const rest = text.includes(':') ? text.split(':')[1].trim() : text.slice(7).trim();
      const [s1, s2] = rest.split(',').map(s => s.trim().toLowerCase());
      if (s1 && s2) {
        const communs = trouverLiensCommuns(s1, s2, liens);
        addBotMessage(
          communs.length > 0
            ? `Ancêtres conceptuels communs entre ${s1} et ${s2} : ${communs.join(', ')}`
            : `Aucun ancêtre commun trouvé entre ${s1} et ${s2}.`
        );
        return;
      }
      addBotMessage('Format : cousins: sujet1, sujet2');
      return;
    }

    // 6. Translation commands: "traduis en anglais: ...", "traduis en espagnol: ..."
    if (msgLower.startsWith('traduis en ') || msgLower.startsWith('traduis ')) {
      if (!text.includes(':')) {
        addBotMessage('Format : traduis en anglais: ton texte ici');
        return;
      }
      const [entete, ...corpsParts] = text.split(':');
      const corps = corpsParts.join(':').trim();
      if (!corps) {
        addBotMessage('Il manque le texte à traduire.');
        return;
      }
      const enteteClean = sansAccent(entete.toLowerCase()).replace(/^traduis(?:\s+en)?\s*/, '').trim();
      const languesMap: Record<string, string> = {
        anglais: 'English', english: 'English',
        arabe: 'Arabic', arabic: 'Arabic',
        espagnol: 'Spanish', spanish: 'Spanish',
        allemand: 'German', german: 'German',
        italien: 'Italian', italian: 'Italian',
        portugais: 'Portuguese', portuguese: 'Portuguese',
        russe: 'Russian', russian: 'Russian',
        chinois: 'Chinese', chinese: 'Chinese',
        japonais: 'Japanese', japanese: 'Japanese',
        coreen: 'Korean', korean: 'Korean',
        turc: 'Turkish', turkish: 'Turkish',
        neerlandais: 'Dutch', dutch: 'Dutch',
        peul: 'Fula', fula: 'Fula',
        bambara: 'Bambara', wolof: 'Wolof',
        swahili: 'Swahili',
        francais: 'French', french: 'French',
      };

      const cible = languesMap[enteteClean] || 'English';
      setIsThinking(true);
      try {
        const result = await apiService.traduire({
          text: corps,
          targetLang: cible,
          provider: config.provider,
        });
        addBotMessage(result, { source: 'systeme' });
      } catch (err: any) {
        addBotMessage(`Erreur traduction : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 7. Text Correction: "corrige: ..."
    if (msgLower.startsWith('corrige:') || msgLower.startsWith('corrige ')) {
      const corps = text.includes(':') ? text.split(':')[1].trim() : text.slice(7).trim();
      if (!corps) {
        addBotMessage('Format : corrige: ton texte');
        return;
      }
      setIsThinking(true);
      try {
        const result = await apiService.corriger({
          text: corps,
          provider: config.provider,
        });
        addBotMessage(result, { source: 'systeme' });
      } catch (err: any) {
        addBotMessage(`Erreur correction : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 8. Ideas Generator: "idees 5: theme" or "idees 3 drole: theme"
    if (msgLower.startsWith('idees ') || msgLower.startsWith('idées ') || msgLower.startsWith('idees:')) {
      if (!text.includes(':')) {
        addBotMessage('Format : idees 5: theme  ou  idees 3 drole: theme');
        return;
      }
      const [entete, ...corpsParts] = text.split(':');
      const theme = corpsParts.join(':').trim();
      const matchNb = entete.match(/\d+/);
      const count = matchNb ? Math.max(1, Math.min(15, parseInt(matchNb[0], 10))) : 5;
      let style = 'creatif';
      for (const st of ['serieux', 'drole', 'poetique', 'absurde', 'creatif', 'scientifique', 'philosophique']) {
        if (entete.toLowerCase().includes(st)) {
          style = st;
          break;
        }
      }

      setIsThinking(true);
      try {
        const result = await apiService.genererIdees({
          theme,
          count,
          style,
          provider: config.provider,
        });

        const lines = result
          .split('\n')
          .map(l => l.replace(/^\s*(\d+[\.\)\-:]\s*|[\-\*]\s*)/, '').trim())
          .filter(Boolean);

        setDernieresIdees(lines);
        const formatted = [`Idées sur : ${theme}`, ...lines.map((l, i) => `${i + 1}. ${l}`)].join('\n');
        addBotMessage(formatted, { source: 'systeme' });
      } catch (err: any) {
        addBotMessage(`Erreur idées : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 9. Single Idea Development: "idee 1:", "idee 2:"
    if (msgLower.startsWith('idee ') || msgLower.startsWith('idée ')) {
      const matchNb = msgLower.match(/\d+/);
      if (!matchNb) {
        addBotMessage('Précise le numéro : idee 3:');
        return;
      }
      const num = parseInt(matchNb[0], 10) - 1;
      if (num < 0 || num >= dernieresIdees.length) {
        addBotMessage(`Pas d'idée numéro ${num + 1} en mémoire récente. Génère d'abord une liste avec "idees 5: thème"`);
        return;
      }
      const chosenIdea = dernieresIdees[num];
      setIsThinking(true);
      try {
        const prompt = `Développe cette idée en 3 à 4 phrases claires, concrètes et inspirantes : "${chosenIdea}".`;
        const res = await apiService.chat({
          prompt,
          history: [],
          provider: config.provider,
        });

        addBotMessage(`Idée ${num + 1} développée :\n${res.text}`, { source: 'systeme' });

        // Auto-save to memory
        const sujetIdea = `idee_${num + 1}`;
        const fact = `${chosenIdea} -> ${res.text.slice(0, 180)}`;
        setMemoire(prev => ({
          ...prev,
          [sujetIdea]: [
            {
              def: fact,
              poids: 0.75,
              hits: 1,
              source: 'auto',
              last_used: new Date().toISOString(),
              created: new Date().toISOString(),
            },
          ],
        }));
      } catch (err: any) {
        addBotMessage(`Erreur développement idée : ${err.message}`, { source: 'systeme' });
      } finally {
        setIsThinking(false);
      }
      return;
    }

    // 10. Summarize: "resume: texte" or "resume: concept"
    if (msgLower.startsWith('resume:')) {
      const corps = text.split(':')[1]?.trim();
      if (!corps) {
        addBotMessage('Format : resume: ton texte ou ton concept');
        return;
      }

      // If text is long (> 30 words), call LLM summarizer
      if (corps.split(/\s+/).length > 25 || corps.length > 150) {
        setIsThinking(true);
        try {
          const res = await apiService.resumer({
            text: corps,
            provider: config.provider,
          });
          addBotMessage(res, { source: 'systeme' });
        } catch (err: any) {
          addBotMessage(`Erreur résumé : ${err.message}`, { source: 'systeme' });
        } finally {
          setIsThinking(false);
        }
        return;
      }

      // Short concept summary from memory & rules
      const xCorr = corriger(corps, memoire, regles, synonymes) || corps;
      const defs = (memoire[xCorr] || []).map(d => d.def);
      const rList = (regles[xCorr] || []).map(r => `${r.quant} les ${xCorr}s ${r.prop}`);
      if (defs.length > 0 || rList.length > 0) {
        let rep = `${xCorr} : ${defs.join('; ') || 'pas de définition'}`;
        if (rList.length > 0) rep += `\nRègles associées : ${rList.join('; ')}`;
        addBotMessage(rep, { source: 'local_memoire', sujet: xCorr });
        return;
      }
      addBotMessage(`Aucune donnée enregistrée pour "${corps}".`);
      return;
    }

    // 11. Synonyms management: "synonymes: canon = syn1 | syn2" or "synonymes: mot"
    if (msgLower.startsWith('synonymes:')) {
      const rest = text.split(':')[1]?.trim();
      if (!rest) {
        addBotMessage('Format : synonymes: canon = syn1 | syn2');
        return;
      }
      if (rest.includes('=')) {
        const [canonPart, synPart] = rest.split('=').map(s => s.trim().toLowerCase());
        const synList = synPart.split('|').map(s => s.trim()).filter(Boolean);
        if (canonPart && synList.length > 0) {
          setSynonymes(prev => {
            const copy = { ...prev };
            const currentList = Array.isArray(copy[canonPart]) ? (copy[canonPart] as string[]) : [];
            const merged = Array.from(new Set([...currentList, ...synList]));
            copy[canonPart] = merged;
            for (const s of synList) {
              copy[s] = canonPart;
            }
            return copy;
          });
          addBotMessage(`Synonymes enregistrés pour "${canonPart}" : ${synList.join(', ')}`, { source: 'local_memoire' });
          return;
        }
      } else {
        const q = rest.toLowerCase();
        if (synonymes[q]) {
          const val = synonymes[q];
          const rep = Array.isArray(val) ? `${q} = ${val.join(' | ')}` : `${q} -> ${val}`;
          addBotMessage(rep, { source: 'local_memoire' });
          return;
        }
        addBotMessage(`Aucun synonyme trouvé pour "${q}".`);
        return;
      }
    }

    // 12. Fuzzy near search: "proche: mot"
    if (msgLower.startsWith('proche:') || msgLower.startsWith('proche ')) {
      const target = (text.includes(':') ? text.split(':')[1] : text.slice(7)).trim().toLowerCase();
      const keys = Array.from(new Set([...Object.keys(memoire), ...Object.keys(regles)]));
      const candidates = keys.map(k => {
        const kNorm = sansAccent(k);
        const tNorm = sansAccent(target);
        let score = kNorm === tNorm ? 1.0 : 0.0;
        if (!score) {
          const d = Math.max(kNorm.length, tNorm.length) - Math.abs(kNorm.length - tNorm.length);
          score = (kNorm.includes(tNorm) || tNorm.includes(kNorm)) ? 0.75 : 0.4;
        }
        return { key: k, score };
      });
      candidates.sort((a, b) => b.score - a.score);
      const top = candidates.filter(c => c.score >= 0.5).slice(0, 6);
      if (top.length > 0) {
        addBotMessage(`Sujets proches de "${target}" :\n${top.map(c => ` - ${c.key}`).join('\n')}`, { source: 'local_memoire' });
      } else {
        addBotMessage(`Aucun sujet proche de "${target}".`);
      }
      return;
    }

    // 13. Substring Search: "chercher: mot"
    if (msgLower.startsWith('chercher:')) {
      const q = text.split(':')[1]?.trim().toLowerCase();
      if (!q) {
        addBotMessage('Format : chercher: mot');
        return;
      }
      const results: string[] = [];
      for (const [k, list] of Object.entries(memoire)) {
        if (k.includes(q)) {
          results.push(`${k} = ${list.map(d => d.def).join(' | ')}`);
        }
      }
      for (const [s, list] of Object.entries(regles)) {
        if (s.includes(q)) {
          for (const r of list) results.push(`${r.quant} les ${s}s ${r.prop}`);
        }
      }
      addBotMessage(
        results.length > 0
          ? `Résultats pour "${q}" :\n${results.slice(0, 10).join('\n')}`
          : `Rien trouvé pour "${q}".`,
        { source: 'local_memoire' }
      );
      return;
    }

    // 14. Bulk forgetting: "oublier masse:" or single "oublier:"
    if (msgLower.startsWith('oublier masse:') || msgLower.startsWith('oublier en masse:')) {
      const rest = text.split(':')[1]?.trim() || '';
      const items = rest.split(/[,\n;.]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const removed: string[] = [];
      setMemoire(prev => {
        const copy = { ...prev };
        for (const item of items) {
          if (copy[item]) {
            delete copy[item];
            removed.push(item);
          }
        }
        return copy;
      });
      addBotMessage(
        removed.length > 0
          ? `Concepts oubliés en masse (${removed.length}) : ${removed.join(', ')}`
          : 'Aucun concept trouvé à supprimer.',
        { source: 'systeme' }
      );
      return;
    }

    if (msgLower.startsWith('oublier:')) {
      const rest = text.split(':')[1]?.trim().toLowerCase() || '';
      if (!rest) {
        addBotMessage('Format : oublier: sujet ou oublier: sujet = def');
        return;
      }
      if (rest.includes('=')) {
        const [sujet, defText] = rest.split('=').map(s => s.trim());
        setMemoire(prev => {
          const copy = { ...prev };
          if (copy[sujet]) {
            copy[sujet] = copy[sujet].filter(d => !d.def.toLowerCase().includes(defText.toLowerCase()));
            if (copy[sujet].length === 0) delete copy[sujet];
          }
          return copy;
        });
        addBotMessage(`Définition oubliée pour "${sujet}".`, { source: 'systeme' });
        return;
      } else {
        let found = false;
        if (memoire[rest]) {
          setMemoire(prev => {
            const copy = { ...prev };
            delete copy[rest];
            return copy;
          });
          found = true;
        }
        if (regles[rest]) {
          setRegles(prev => {
            const copy = { ...prev };
            delete copy[rest];
            return copy;
          });
          found = true;
        }
        addBotMessage(
          found ? `J'ai complètement oublié "${rest}".` : `Je ne connaissais pas "${rest}".`,
          { source: 'systeme' }
        );
        return;
      }
    }

    // 15. Bulk Learning: "retiens masse: part1 . part2"
    if (msgLower.startsWith('retiens masse:')) {
      const rest = text.split(':')[1]?.trim() || '';
      const parts = rest.split(/[.\n;]+/).map(p => p.trim()).filter(Boolean);
      const ok: string[] = [];
      const nowIso = new Date().toISOString();

      setMemoire(prevMemo => {
        const memoCopy = { ...prevMemo };
        for (const part of parts) {
          const rq = extraireQuantificateur(part);
          if (rq) {
            handleAddRule(rq.quant, rq.sujet, rq.prop, 0.85);
            ok.push(`${rq.quant} ${rq.sujet} -> ${rq.prop}`);
            continue;
          }
          if (part.includes('=')) {
            const [sRaw, dRaw] = part.split('=').map(x => x.trim().toLowerCase());
            if (sRaw && dRaw) {
              const current = memoCopy[sRaw] ? [...memoCopy[sRaw]] : [];
              current.unshift({
                def: dRaw,
                poids: 0.85,
                hits: 1,
                source: 'manuel',
                last_used: nowIso,
                created: nowIso,
              });
              memoCopy[sRaw] = current;
              ok.push(sRaw);
            }
          }
        }
        return memoCopy;
      });

      addBotMessage(
        ok.length > 0
          ? `Notes enregistrées en masse (${ok.length}) :\n${ok.join(', ')}`
          : 'Aucune note valide trouvée. Sépare tes phrases par des points.',
        { source: 'local_memoire' }
      );
      return;
    }

    // 16. Single "retiens:"
    if (msgLower.startsWith('retiens:')) {
      const content = text.split(':')[1]?.trim();
      if (!content) {
        addBotMessage('Format : retiens: sujet = définition');
        return;
      }

      // Check quantifier rule
      const rq = extraireQuantificateur(content);
      if (rq) {
        handleAddRule(rq.quant, rq.sujet, rq.prop, 0.85);
        addBotMessage(`Règle enregistrée : ${rq.quant} les ${rq.sujet}s ${rq.prop} (certitude 85%)`, { source: 'regle' }, 0.85);
        return;
      }

      // Subject = Def1 | Def2
      if (content.includes('=')) {
        const [sujetRaw, defsRaw] = content.split('=').map(s => s.trim());
        const s = sujetRaw.toLowerCase();
        const defsList = defsRaw.split('|').map(d => d.trim()).filter(Boolean);
        if (s && defsList.length > 0) {
          const nowIso = new Date().toISOString();
          setMemoire(prev => {
            const copy = { ...prev };
            const current = copy[s] ? [...copy[s]] : [];
            for (const d of defsList) {
              current.unshift({
                def: d,
                poids: 0.85,
                hits: 1,
                source: 'manuel',
                last_used: nowIso,
                created: nowIso,
              });
            }
            copy[s] = current;
            return copy;
          });
          setContexte(prev => [...prev, s]);
          addBotMessage(`Fait retenu pour "${s}" : ${defsList.join(' | ')} (poids 0.85)`, { source: 'local_memoire', sujet: s }, 0.85);
          return;
        }
      }
      addBotMessage('Format requis : retiens: sujet = définition (ou plusieurs avec: retiens: sujet = def1 | def2)');
      return;
    }

    // 17. Quantifiers direct input: "tous les oiseaux ont des plumes"
    const directRq = extraireQuantificateur(text);
    if (directRq && (msgClean.startsWith('tous') || msgClean.startsWith('aucun') || msgClean.startsWith('certains') || msgClean.startsWith('chaque'))) {
      handleAddRule(directRq.quant, directRq.sujet, directRq.prop, 0.85);
      addBotMessage(`Règle généralisée enregistrée : ${directRq.quant} les ${directRq.sujet}s ${directRq.prop}`, { source: 'regle' }, 0.85);
      return;
    }

    // 18. Listing commands
    if (msgLower.startsWith('lister:')) {
      const target = msgLower.split(':')[1]?.trim();
      if (target === 'memoire') {
        const keys = Object.keys(memoire).sort();
        addBotMessage(`Mémoire active (${keys.length} sujets) :\n${keys.slice(0, 35).join(', ')}${keys.length > 35 ? '...' : ''}`, { source: 'local_memoire' });
        return;
      }
      if (target === 'regles') {
        const lines: string[] = [];
        for (const [s, list] of Object.entries(regles)) {
          for (const r of list) {
            lines.push(`${r.quant} les ${s}s ${r.prop}`);
          }
        }
        addBotMessage(`Règles générales (${lines.length}) :\n${lines.join('\n') || 'Aucune règle'}`, { source: 'regle' });
        return;
      }
      if (target === 'poids') {
        const lines: string[] = [];
        for (const [k, list] of Object.entries(memoire)) {
          for (const m of list.slice(0, 2)) {
            lines.push(`${k} = ${m.def} [poids ${m.poids.toFixed(2)}, hits ${m.hits}]`);
          }
        }
        addBotMessage(`Coefficients de poids :\n${lines.slice(0, 15).join('\n')}`, { source: 'local_memoire' });
        return;
      }
      if (target === 'incertains') {
        const lines: string[] = [];
        for (const [k, list] of Object.entries(memoire)) {
          for (const m of list) {
            if (m.poids < 0.6) {
              lines.push(`${k} = ${m.def} [poids ${m.poids.toFixed(2)}]`);
            }
          }
        }
        addBotMessage(
          lines.length > 0 ? `Concepts incertains :\n${lines.join('\n')}` : 'Aucun concept incertain (tous >= 60%).',
          { source: 'local_memoire' }
        );
        return;
      }
      if (target === 'idees') {
        addBotMessage(
          dernieresIdees.length > 0
            ? `Dernières idées générées :\n${dernieresIdees.map((l, i) => `${i + 1}. ${l}`).join('\n')}`
            : 'Aucune idée archivée dans cette session.',
          { source: 'systeme' }
        );
        return;
      }
      if (target === 'groq') {
        addBotMessage(
          groqLog.length > 0
            ? `Derniers échanges LLM :\n${groqLog.slice(0, 5).map(l => `[${l.time}] Q: ${l.q}\nR: ${l.r.slice(0, 80)}...`).join('\n\n')}`
            : 'Aucun échange LLM enregistré.',
          { source: 'systeme' }
        );
        return;
      }
      if (target === 'stats') {
        addBotMessage(
          `Statistiques : ${Object.keys(memoire).length} concepts · ${Object.values(regles).reduce((a, b) => a + b.length, 0)} règles · ${Object.keys(liens).length} liaisons taxonomiques · Contexte: ${contexte.join(', ') || 'vide'}`
        );
        return;
      }
    }

    // 19. Greetings
    const salutation = estSalutation(text);
    if (salutation) {
      addBotMessage(repondreSalutation(salutation), { source: 'systeme' });
      return;
    }

    // 20. Emotions & states
    const etat = detecterEtat(text);
    if (etat) {
      addBotMessage(repondreEtat(etat), { source: 'systeme' });
      return;
    }

    // 21. Reinforcement confirmations ("oui", "c'est ça", "non ce n'est pas ça")
    if (['oui', "c'est ca", 'exact', 'parfait', 'merci'].includes(msgClean)) {
      if (contexte.length > 0) {
        const last = contexte[contexte.length - 1];
        handleAdjustWeight(last, 0.1);
        return;
      }
    }
    if (['non', 'pas ca', 'faux', 'erreur'].includes(msgClean)) {
      if (contexte.length > 0) {
        const last = contexte[contexte.length - 1];
        handleAdjustWeight(last, -0.15);
        return;
      }
    }

    // 22. Causal Questions: "pourquoi le moineau vole ?" or "pourquoi l'aigle respire ?"
    if (msgClean.includes('pourquoi')) {
      const whyAnswer = repondrePourquoi(text, memoire, regles, liens, synonymes);
      if (whyAnswer) {
        const s = extraireX(text, memoire, regles, synonymes, contexte);
        if (s) setContexte(prev => [...prev, s]);
        addBotMessage(whyAnswer, { source: 'deduction', sujet: s || undefined });
        return;
      }
    }

    // 23. Question-Réponse mémorisée (recherche précise par combinaison de mots-clés de la question)
    const qaMatch = trouverQuestionReponse(text, memoire);
    if (qaMatch) {
      qaMatch.entry.hits += 1;
      qaMatch.entry.last_used = new Date().toISOString();
      setMemoire({ ...memoire });
      setContexte(prev => [...prev, qaMatch.sujet]);
      addBotMessage(
        qaMatch.entry.def,
        { source: 'local_memoire', sujet: qaMatch.sujet },
        qaMatch.entry.poids
      );
      return;
    }

    // 24. Demande de Définition de Concept ("c'est quoi le moineau ?", "parle-moi de python", "moineau")
    const defCheck = estRequeteDefinition(text);
    if (defCheck.estDef && defCheck.concept) {
      const candX = corriger(defCheck.concept, memoire, regles, synonymes) || defCheck.concept;
      const localDef = phraseDef(candX, text, memoire, regles, liens, synonymes);
      if (localDef) {
        setContexte(prev => [...prev, candX]);
        const bestEntry = memoire[candX]?.[0];
        addBotMessage(localDef, { source: 'local_memoire', sujet: candX }, bestEntry?.poids || 0.85);
        return;
      }
    }

    // 25. Recherche Floue uniquement sur requêtes courtes (1 à 3 mots max)
    const wordsCount = text.trim().split(/\s+/).length;
    if (wordsCount <= 3) {
      const flouMatch = rechercherFlou(text, memoire, regles, 0.72);
      if (flouMatch) {
        const flouDef = phraseDef(flouMatch, text, memoire, regles, liens, synonymes);
        if (flouDef) {
          setContexte(prev => [...prev, flouMatch]);
          addBotMessage(`Tu voulais sans doute parler de "${flouMatch}" : ${flouDef}`, { source: 'local_memoire', sujet: flouMatch });
          return;
        }
      }
    }

    // 26. Fallback en mode local_only
    if (config.provider === 'local_only') {
      const candX = extraireX(text, memoire, regles, synonymes, contexte);
      addBotMessage(
        candX
          ? `Je n'ai pas encore d'information sur "${candX}" dans ma mémoire locale. Enseigne-le moi avec: retiens: ${candX} = ...`
          : "Je n'ai pas compris en mode local. Tu peux m'enseigner ce fait avec: retiens: sujet = définition",
        { source: 'systeme' }
      );
      return;
    }

    // Call LLM
    setIsThinking(true);
    try {
      const historyFormatted = messages.slice(-5).map(m => ({
        role: m.author === 'Toi' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const res = await apiService.chat({
        prompt: text,
        history: historyFormatted,
        provider: config.provider,
        groqModel: config.groqModel || 'openai/gpt-oss-120b',
        systemPrompt: config.systemPrompt,
      });

      const responseText = res.text;

      addBotMessage(
        responseText,
        { source: res.provider === 'groq' ? 'groq' : 'gemini' },
        0.8
      );

      setGroqLog(prev => [{ q: text, r: responseText, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 20)]);

      // Apprentissage automatique du couple Question + Réponse (Q&A)
      if (config.autoLearnFromLLM) {
        const learned = apprendreDeLLM(text, responseText, memoire, res.provider === 'groq' ? 'groq' : 'gemini');
        if (learned) {
          setMemoire({ ...memoire });
          setContexte(prev => [...prev, learned.sujet]);
        }
      }
    } catch (err: any) {
      addBotMessage(`Erreur de connexion : ${err.message}`, { source: 'systeme' });
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="fixed inset-0 h-full w-full max-h-[100dvh] flex flex-col bg-[#050508] text-gray-100 font-sans selection:bg-emerald-500/20 selection:text-emerald-300 overflow-hidden">
      {/* Top Header - Fixé en haut, toujours visible */}
      <Header
        config={config}
        onUpdateConfig={updates => setConfig(prev => ({ ...prev, ...updates }))}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onOpenSettings={() => {
          if (isAdmin) setIsSettingsModalOpen(true);
        }}
        onOpenActionsMenu={() => {
          if (isAdmin) setIsActionsModalOpen(true);
        }}
        conceptsCount={Object.keys(memoire).length}
        rulesCount={Object.values(regles).reduce((acc, l) => acc + l.length, 0)}
        isAdmin={isAdmin}
      />

      {/* Main View Workspace - flex-1 min-h-0 overflow-hidden */}
      <main className="flex-1 flex flex-col min-h-0 w-full overflow-hidden relative">
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            isThinking={isThinking}
            onSendMessage={handleProcessUserMessage}
            onClearMessages={() => setMessages([])}
            onAdjustWeight={handleAdjustWeight}
            soundEnabled={config.soundEnabled}
            activeSession={config.activeSession}
            prefilledText={chatPrefill}
            onClearPrefill={() => setChatPrefill('')}
            onOpenActions={() => {
              if (isAdmin) setIsActionsModalOpen(true);
            }}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'graph' && isAdmin && (
          <KnowledgeGraphTab
            memoire={memoire}
            regles={regles}
            liens={liens}
            synonymes={synonymes}
            onAddDefinition={(s, d) => {
              const nowIso = new Date().toISOString();
              setMemoire(prev => {
                const copy = { ...prev };
                const current = copy[s] ? [...copy[s]] : [];
                current.unshift({
                  def: d,
                  poids: 0.85,
                  hits: 1,
                  source: 'manuel',
                  last_used: nowIso,
                  created: nowIso,
                });
                copy[s] = current;
                return copy;
              });
            }}
            onDeleteConcept={s => {
              setMemoire(prev => {
                const copy = { ...prev };
                delete copy[s];
                return copy;
              });
            }}
            onAdjustWeight={handleAdjustWeight}
            onAdjustHits={handleAdjustHits}
            onAddLink={handleAddLink}
            onDeleteLink={handleDeleteLink}
            onAskQuestionAbout={s => {
              setActiveTab('chat');
              handleProcessUserMessage(`c'est quoi ${s} ?`);
            }}
          />
        )}

        {activeTab === 'rules' && isAdmin && (
          <RulesTab
            memoire={memoire}
            regles={regles}
            liens={liens}
            synonymes={synonymes}
            onAddRule={handleAddRule}
            onDeleteRule={handleDeleteRule}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsTab
            config={config}
            onSaveToMemory={(sujet, def) => {
              const nowIso = new Date().toISOString();
              setMemoire(prev => ({
                ...prev,
                [sujet]: [
                  {
                    def,
                    poids: 0.85,
                    hits: 1,
                    source: 'auto',
                    last_used: nowIso,
                    created: nowIso,
                  },
                ],
              }));
            }}
          />
        )}

        {activeTab === 'sessions' && isAdmin && (
          <SessionsTab
            sessions={sessions}
            activeSession={config.activeSession}
            onSelectSession={handleSelectSession}
            onCreateSession={handleCreateSession}
            memoire={memoire}
            regles={regles}
            liens={liens}
            synonymes={synonymes}
            onUpdateMemory={(newM, newR) => {
              setMemoire(newM);
              setRegles(newR);
            }}
            onImportFullBackup={data => {
              setMemoire(data.memoire);
              setRegles(data.regles);
              setLiens(data.liens);
            }}
            groqApiKey={config.groqApiKey}
            groqModel={config.groqModel}
          />
        )}
      </main>

      {/* Bottom Navigation Tabs - Public shows only Discussion & Atelier Texte */}
      <nav className="h-14 sm:h-16 shrink-0 flex-shrink-0 bg-[#090B10] border-t border-gray-800/80 px-2 sm:px-6 flex items-center justify-around z-30">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
            activeTab === 'chat'
              ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] sm:text-xs font-semibold">Discussion</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('graph')}
            className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
              activeTab === 'graph'
                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-semibold">Cerveau & Graphe</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
              activeTab === 'rules'
                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-semibold">Règles & Inférence</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('tools')}
          className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
            activeTab === 'tools'
              ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] sm:text-xs font-semibold">Atelier Texte</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex flex-col items-center gap-1 py-1 px-3 sm:px-5 rounded-xl transition ${
              activeTab === 'sessions'
                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FolderTree className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[10px] sm:text-xs font-semibold">Sessions & Pydroid</span>
          </button>
        )}
      </nav>

      {/* Action Command Menu Modal (Admin Only) */}
      {isAdmin && (
        <ActionMenuModal
          isOpen={isActionsModalOpen}
          onClose={() => setIsActionsModalOpen(false)}
          onSelectAction={(cmd, immediate) => {
            if (immediate) {
              handleProcessUserMessage(cmd);
            } else {
              setActiveTab('chat');
              setChatPrefill(cmd);
            }
          }}
        />
      )}

      {/* Settings Modal (Admin Only) */}
      {isAdmin && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          config={config}
          onSaveConfig={updates => setConfig(prev => ({ ...prev, ...updates }))}
        />
      )}
    </div>
  );
}

```

---

## 📄 Fichier : `src/index.css`

```css
@import "tailwindcss";

@layer base {
  html, body, #root {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    overscroll-behavior: none;
    -webkit-overflow-scrolling: touch;
  }

  body {
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  code, pre, .font-mono {
    font-family: 'Fira Code', monospace;
  }
}

/* Custom dark scrollbar for sleek cyber look */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(10, 10, 15, 0.6);
}
::-webkit-scrollbar-thumb {
  background: rgba(16, 163, 127, 0.35);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(16, 163, 127, 0.7);
}

/* Subtle cyber matrix background */
.cyber-bg {
  background-image: 
    radial-gradient(circle at 50% 0%, rgba(16, 163, 127, 0.08) 0%, transparent 70%),
    linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 100% 100%, 32px 32px, 32px 32px;
}

@keyframes pulseGlow {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

.animate-pulse-glow {
  animation: pulseGlow 4s ease-in-out infinite;
}

```

---

## 📄 Fichier : `src/types/kaderbot.ts`

```typescript
export interface MemoryEntry {
  def: string;
  poids: number; // 0.1 to 1.0
  hits: number;
  source: 'manuel' | 'groq' | 'gemini' | 'auto';
  last_used: string;
  created: string;
  question_origine?: string;
  type?: 'concept' | 'question_reponse';
  mots_cles?: string[];
}

export interface GeneralRule {
  quant: 'tous' | 'aucun' | 'certains';
  prop: string;
  poids: number;
  hits: number;
  last_used: string;
  created: string;
}

export type MemoryStore = Record<string, MemoryEntry[]>;
export type RulesStore = Record<string, GeneralRule[]>;
export type LinksStore = Record<string, string[]>;
export type SynonymsStore = Record<string, string | string[]>;

export interface ChatMessage {
  id: string;
  author: 'Toi' | 'KB';
  text: string;
  timestamp: string;
  confidence?: number;
  meta?: {
    intent?: string;
    sujet?: string;
    chemin?: string[];
    source?: 'local_memoire' | 'deduction' | 'regle' | 'groq' | 'gemini' | 'systeme';
    ruleApplied?: string;
  };
}

export interface IdeaItem {
  id: number;
  title: string;
  theme: string;
  style: string;
  timestamp: string;
  developedText?: string;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  category: string;
  weight: number;
  hits: number;
  definitionsCount: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type: 'is_a' | 'custom_link' | 'rule';
}

export type LLMProvider = 'gemini' | 'groq' | 'local_only';

export interface AppConfig {
  provider: LLMProvider;
  geminiApiKey?: string;
  groqApiKey?: string;
  groqModel: string;
  geminiModel: string;
  systemPrompt: string;
  activeSession: string;
  soundEnabled: boolean;
  autoLearnFromLLM: boolean;
}

```

---

## 📄 Fichier : `src/core/cognitiveEngine.ts`

```typescript
import {
  GeneralRule,
  LinksStore,
  MemoryEntry,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';

export const DEFAULT_POIDS = 0.8;

export const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des',
  'de', 'du', 'd', 'dans', 'sur', 'sous',
  'et', 'ou', 'mais', 'donc', 'car',
  'est', 'sont', 'etre', 'a', 'au', 'aux',
  'pour', 'par', 'avec', 'sans',
  'qui', 'que', 'quoi', 'qu', 'comment',
  'pourquoi', 'quand', 'ou',
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa',
  'ce', 'cet', 'cette', 'ces',
  'en', 'y',
]);

export const PRONOMS_CONTEXTE = new Set([
  'il', 'elle', 'ils', 'elles', 'l', 'le', 'la', 'les', 'lui',
  'leur', 'ca', 'cela', 'ce', 'cet', 'cette', 'son', 'sa', 'ses',
  'leur', 'leurs', 'celui', 'celle', "l'", "qu'il", "qu'elle",
]);

export const SALUTATIONS = [
  'bonjour', 'salut', 'coucou', 'hey', 'yo', 'bonsoir', 'wesh',
  'hello', 'bjr', 'slt', 'au revoir', 'a bientot', 'a plus',
  'merci', 'de rien',
];

export const RS: Record<string, string[]> = {
  bonjour: ['Bonjour !', 'Salut !', 'Coucou !', 'Hey, content de te voir !', 'Bonjour, comment ça va aujourd’hui ?'],
  salut: ['Salut !', 'Bonjour !', 'Hey !', 'Salut, quoi de neuf ?'],
  coucou: ['Coucou !', 'Salut !', 'Bonjour !', 'Coucou, tu vas bien ?'],
  hey: ['Hey !', 'Salut !', 'Bonjour !'],
  yo: ['Yo !', 'Salut !', 'Bonjour !'],
  bonsoir: ['Bonsoir !', 'Salut !', 'Bonsoir, comment s’est passée ta journée ?'],
  wesh: ['Wesh !', 'Salut !', 'Wesh bien ou quoi ?'],
  hello: ['Hello !', 'Bonjour !', 'Salut !'],
  bjr: ['Bonjour !', 'Salut !'],
  slt: ['Salut !', 'Bonjour !'],
  'au revoir': ['Au revoir !', 'À bientôt !', 'Salut !', 'À plus tard !'],
  'a bientot': ['À bientôt !', 'Au revoir !', 'On se revoit vite !'],
  'a plus': ['À plus !', 'À bientôt !', 'Salut !'],
  merci: ['De rien !', 'Avec plaisir !', 'Je t’en prie !', 'Pas de souci, c’est normal !'],
  'de rien': ['Il n’y a pas de quoi !', 'C’est normal !', 'Avec plaisir !'],
};

export const SUITES = [
  ' Tu vas bien ?',
  ' Comment ça va ?',
  ' Ça va ?',
  ' Quoi de neuf ?',
  ' Content de te voir !',
];

export const PE: Record<string, { reponses: string[]; synonymes: string[] }> = {
  'je suis content': { reponses: ['Super ! Content pour toi !', 'Génial ! Qu’est-ce qui te rend content ?', 'Tant mieux ! Profite bien !'], synonymes: ['je suis joyeux'] },
  'je suis triste': { reponses: ['Oh, je suis désolé... Qu’est-ce qui ne va pas ?', 'Tu veux en parler ? Je suis là.'], synonymes: ['j’ai du chagrin'] },
  'je suis en colere': { reponses: ['Calme-toi, respire profondément.', 'Qu’est-ce qui t’énerve ?'], synonymes: ['je ne suis pas content'] },
  "j'ai peur": { reponses: ['N’aie pas peur, je suis là.', 'Qu’est-ce qui te fait peur ?'], synonymes: ['je suis inquiet'] },
  'je suis surpris': { reponses: ['Surprenant, non ?', 'Je ne m’y attendais pas non plus !'], synonymes: ["c'est etonnant"] },
  "je t'aime": { reponses: ['Moi aussi, je t’apprécie !', 'C’est gentil !', 'Ça me touche vraiment.'], synonymes: ['tu es important'] },
  'je suis decu': { reponses: ['C’est dommage...', 'Je comprends, ce n’est pas ce que tu espérais.'], synonymes: ["pas ce que j'esperais"] },
  'je suis fatigue': { reponses: ['Repose-toi bien.', 'Tu devrais faire une petite pause.'], synonymes: ['besoin de repos'] },
  'je suis calme': { reponses: ['C’est parfait, reste comme ça.', 'Cool, zen attitude !'], synonymes: ['paisible'] },
  'je suis stresse': { reponses: ['Respire profondément...', 'Prends une pause, ça ira mieux.'], synonymes: ['pression'] },
  'ca me fait plaisir': { reponses: ['Tant mieux !', 'Ça fait plaisir à entendre !'], synonymes: ['content de ca'] },
  "ca m'enerve": { reponses: ['Calme-toi, ça va passer.', 'Je comprends, c’est énervant.'], synonymes: ['en colere'] },
};

export const STYLES_IDEES: Record<string, string> = {
  serieux: 'Sois concret, pragmatique et professionnel.',
  drole: 'Sois humoristique, décalé et amusant.',
  poetique: 'Sois poétique, imagé et sensible.',
  absurde: 'Sois totalement absurde, inattendu et loufoque.',
  creatif: 'Sois original, surprenant et imaginatif.',
  scientifique: 'Sois rigoureux, factuel et précis.',
  philosophique: 'Sois profond, réflexif et nuancé.',
};

export const INTENTIONS_KEYWORDS: Record<string, string[]> = {
  salutation: ['bonjour', 'salut', 'coucou', 'hey', 'yo', 'bjr', 'slt', 'bonsoir', 'hello', 'wesh'],
  definition: ["c'est quoi", 'c quoi', "qu'est ce que", 'quest ce que', 'qui est', 'definition', "c'est quoi un", "c'est quoi une", 'parle moi de', 'parle-moi de', 'dis moi ce que', "c'est qui"],
  usage: ['a quoi sert', 'sert a quoi', 'a quoi ca sert', 'pour quoi faire', 'utilite', 'comment utiliser', 'sert a'],
  pourquoi: ['pourquoi', 'raison', 'cause', 'explique pourquoi', 'pourquoi est ce que'],
  emotion: ['je suis', "j'ai peur", "je t'aime", 'je suis triste', 'je suis content', 'fatigue', 'colere', 'stresse', 'peur'],
  memoire_ajout: ['retiens', 'apprends', 'souviens', 'enregistre', 'note que'],
  memoire_suppression: ['oublier', 'supprime', 'efface'],
  recherche: ['chercher', 'lister', 'resume', 'cherche', 'liste'],
  synonyme: ['synonymes', 'synonyme', 'equivaut', 'pareil que', 'veut dire'],
};

export function sansAccent(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a.length < b.length) return levenshtein(b, a);
  if (b.length === 0) return a.length;
  let lignePrec = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const ligne = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cout = a[i] === b[j] ? 0 : 1;
      ligne.push(Math.min(ligne[j] + 1, lignePrec[j + 1] + 1, lignePrec[j] + cout));
    }
    lignePrec = ligne;
  }
  return lignePrec[b.length];
}

export function similarite(a: string, b: string): number {
  if (!a || !b) return 0.0;
  if (a === b) return 1.0;
  const d = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1.0 - d / maxLen : 0.0;
}

export function corriger(
  mot: string,
  memoire: MemoryStore,
  regles: RulesStore,
  synonymes: SynonymsStore
): string | null {
  const m = mot.toLowerCase().trim();
  if (synonymes[m]) {
    const v = synonymes[m];
    if (typeof v === 'string') return v;
  }
  for (const [canon, lst] of Object.entries(synonymes)) {
    if (Array.isArray(lst) && lst.includes(m)) {
      return canon;
    }
  }
  if (memoire[m] || regles[m]) return m;
  const sa = sansAccent(m);
  for (const key of [...Object.keys(memoire), ...Object.keys(regles)]) {
    if (sansAccent(key.toLowerCase()) === sa) return key;
  }
  return rechercherFlou(m, memoire, regles, 0.72);
}

export function singulariser(
  mot: string,
  memoire: MemoryStore,
  regles: RulesStore,
  synonymes: SynonymsStore
): string {
  const m = mot.toLowerCase().trim();
  if (m.endsWith('aux')) {
    const base = m.slice(0, -3) + 'al';
    if (corriger(base, memoire, regles, synonymes)) return base;
    return m.slice(0, -1);
  }
  if (m.endsWith('eaux')) {
    return m.slice(0, -1);
  }
  if (m.endsWith('s') && m.length > 3) {
    const sing = m.slice(0, -1);
    if (corriger(sing, memoire, regles, synonymes) || memoire[sing] || regles[sing]) {
      return sing;
    }
    return sing;
  }
  return m;
}

export function rechercherFlou(
  mot: string,
  memoire: MemoryStore,
  regles: RulesStore,
  seuil = 0.7
): string | null {
  const motNorm = sansAccent(mot.toLowerCase().trim());
  if (!motNorm) return null;
  const keys = Array.from(new Set([...Object.keys(memoire), ...Object.keys(regles)]));
  let meilleur: string | null = null;
  let meilleurScore = 0.0;
  for (const cle of keys) {
    const normalise = sansAccent(cle.toLowerCase());
    let score = similarite(motNorm, normalise);
    if (motNorm.includes(normalise) || normalise.includes(motNorm)) {
      score += 0.15;
    }
    if (motNorm.length >= 3 && normalise.startsWith(motNorm.slice(0, 3))) {
      score += 0.1;
    }
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = cle;
    }
  }
  return meilleurScore >= seuil ? meilleur : null;
}

export function extraireQuantificateur(phrase: string): {
  quant: 'tous' | 'aucun' | 'certains';
  sujet: string;
  prop: string;
} | null {
  const q = sansAccent(phrase.toLowerCase().trim());
  const patterns = [
    /^(tous|toutes)\s+(?:les\s+)?([a-z]+)\s+(?:ne\s+)?([a-z\s]+)/,
    /^(aucun|aucune)\s+(?:les\s+)?([a-z]+)\s+(?:ne\s+)?([a-z\s]+)/,
    /^(certains|certaines)\s+(?:les\s+)?([a-z]+)\s+(?:ne\s+)?([a-z\s]+)/,
    /^(chaque)\s+([a-z]+)\s+([a-z\s]+)/,
  ];

  for (const pat of patterns) {
    const m = q.match(pat);
    if (m) {
      const quantRaw = m[1];
      const sujetRaw = m[2];
      const propRaw = m[3];
      let quant: 'tous' | 'aucun' | 'certains' = 'tous';
      if (['tous', 'toutes', 'chaque'].includes(quantRaw)) quant = 'tous';
      else if (['aucun', 'aucune'].includes(quantRaw)) quant = 'aucun';
      else quant = 'certains';
      return {
        quant,
        sujet: sujetRaw.trim(),
        prop: propRaw.trim(),
      };
    }
  }
  return null;
}

export function classifierIntention(question: string): string {
  try {
    const q = sansAccent(question.toLowerCase());
    const scores: Record<string, number> = {};
    for (const [intent, motscles] of Object.entries(INTENTIONS_KEYWORDS)) {
      let sc = 0;
      for (const mc of motscles) {
        const mcNorm = sansAccent(mc.toLowerCase());
        if (q.includes(mcNorm)) {
          sc += q.startsWith(mcNorm) ? 2 : 1;
        }
      }
      scores[intent] = sc;
    }
    let best = 'incompris';
    let maxSc = 0;
    for (const [k, v] of Object.entries(scores)) {
      if (v > maxSc) {
        maxSc = v;
        best = k;
      }
    }
    return maxSc === 0 ? 'incompris' : best;
  } catch {
    return 'incompris';
  }
}

export function detecterEtat(msg: string): string | null {
  const mn = sansAccent(msg.toLowerCase().trim());
  for (const [p, d] of Object.entries(PE)) {
    if (mn.includes(sansAccent(p))) return p;
    for (const s of d.synonymes) {
      if (mn.includes(sansAccent(s))) return p;
    }
  }
  return null;
}

export function repondreEtat(etat: string): string {
  const choices = PE[etat]?.reponses || ['Je comprends.'];
  return choices[Math.floor(Math.random() * choices.length)];
}

export function estSalutationPure(m: string): boolean {
  return SALUTATIONS.includes(sansAccent(m.toLowerCase().trim()));
}

export function estSalutation(q: string): string | null {
  const qq = sansAccent(q.toLowerCase().trim().replace(/[!?.]/g, ''));
  for (const mi of ["c'est quoi", 'quoi sert', 'chercher', 'retiens', 'lire', 'oublier', 'resume', 'definir', 'synonymes', 'pourquoi', 'parle moi']) {
    if (qq.includes(mi)) return null;
  }
  for (const s of SALUTATIONS) {
    if (qq === s || qq.startsWith(s + ' ') || qq.endsWith(' ' + s)) return s;
  }
  return null;
}

export function repondreSalutation(c: string): string {
  const list = RS[c] || ['Salut !'];
  const base = list[Math.floor(Math.random() * list.length)];
  if (['bonjour', 'salut', 'coucou', 'hey', 'yo', 'hello'].includes(c)) {
    const suite = SUITES[Math.floor(Math.random() * SUITES.length)];
    return base + suite;
  }
  return base;
}

export function resoudreContexte(question: string, contexte: string[]): string | null {
  const q = sansAccent(question.toLowerCase());
  const mots = q.match(/\w+/g) || [];
  if (mots.length <= 6 && contexte.length > 0) {
    for (const p of PRONOMS_CONTEXTE) {
      if (q.includes(` ${p} `) || q.startsWith(`${p} `) || q.includes(`${p}'`)) {
        return contexte[contexte.length - 1];
      }
    }
  }
  return null;
}

export function extraireIsA(definition: string): string | null {
  const d = sansAccent(definition.toLowerCase());
  const m = d.match(/((?:est\s+)?un(?:e)?\s+[a-z]+)/);
  if (m) {
    return m[1].replace(/^est\s+/, '').trim();
  }
  const m2 = d.match(/(?:est\s+)?un(?:e)?\s+([a-z]+)/);
  if (m2) {
    return m2[1].trim();
  }
  return null;
}

export const MOTS_INTERROGATIFS_ET_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l',
  'ce', 'cet', 'cette', 'ces',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
  'notre', 'votre', 'leur', 'nos', 'vos', 'leurs',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'me', 'te', 'se', 'moi', 'toi', 'lui', 'eux',
  'est', 'sont', 'etre', 'ete', 'etes', 'sommes', 'suis', 'es',
  'a', 'ai', 'as', 'ont', 'avons', 'avez', 'avoir', 'eu',
  'dans', 'en', 'sur', 'sous', 'par', 'pour', 'avec', 'sans', 'vers', 'chez',
  'et', 'ou', 'mais', 'donc', 'car', 'ni',
  'qui', 'que', 'quoi', 'qu', 'dont', 'ou',
  'comment', 'pourquoi', 'quand', 'combien', 'quel', 'quelle', 'quels', 'quelles',
  'peux', 'peut', 'peuvent', 'pouvez', 'pourrais', 'pourrait',
  'sais', 'sait', 'savez', 'savent',
  'veux', 'veut', 'voulez', 'veulent',
  'dis', 'dit', 'dites', 'dire',
  'explique', 'expliquer', 'donne', 'donner', 'raconte', 'raconter',
  'fait', 'faire', 'font', 'fais',
  'voici', 'voila', 'bonjour', 'salut', 'merci',
]);

export function extraireMotsCles(texte: string): string[] {
  if (!texte) return [];
  const tNorm = sansAccent(texte.toLowerCase()).replace(/[^a-z0-9\s]/g, ' ');
  const words = tNorm
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !MOTS_INTERROGATIFS_ET_VIDES.has(w) && !PRONOMS_CONTEXTE.has(w));
  return Array.from(new Set(words));
}

export function normaliserQuestionCle(question: string): string {
  if (!question) return '';
  let q = sansAccent(question.toLowerCase().trim());
  q = q.replace(/[?!.,;:()"\']+/g, ' ').replace(/\s+/g, ' ').trim();
  return q;
}

export function estRequeteDefinition(texte: string): { estDef: boolean; concept?: string } {
  if (!texte) return { estDef: false };
  const tClean = sansAccent(texte.toLowerCase().trim()).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Concept direct seul (1 ou 2 mots max, avec ou sans article, ex: "moineau", "le moineau", "trou noir")
  const mConceptSeul = tClean.match(/^(?:le |la |les |un |une |des |l |d )?([a-z0-9_-]+(?:\s+[a-z0-9_-]+)?)$/i);
  if (mConceptSeul && mConceptSeul[1]) {
    const cand = mConceptSeul[1].trim();
    if (!MOTS_INTERROGATIFS_ET_VIDES.has(cand) && cand.length >= 3) {
      return { estDef: true, concept: cand };
    }
  }

  // 2. Formulations explicites de demande de définition
  const defPrefixes = [
    "c'est quoi ", 'c quoi ', "qu'est ce que ", 'qu est ce que ', "qu'est-ce que ",
    'qui est ', 'qui sont ', "c'est qui ", 'definition de ', 'definition du ', 'definition d ',
    'parle moi de ', 'parle-moi de ', 'dis moi ce que ', 'dis-moi ce que ',
    'que sais tu sur ', 'que sais-tu sur ', 'tu sais quoi sur ',
    'explique moi ce que ', 'explique-moi ce que ', 'definir ', 'definis '
  ];

  for (const pref of defPrefixes) {
    const prefNorm = sansAccent(pref);
    if (tClean.startsWith(prefNorm)) {
      let rest = tClean.slice(prefNorm.length).trim();
      rest = rest.replace(/^(?:le |la |les |un |une |des |l |d )/i, '').trim();
      if (rest.length >= 2 && !MOTS_INTERROGATIFS_ET_VIDES.has(rest)) {
        return { estDef: true, concept: rest };
      }
    }
  }

  return { estDef: false };
}

export function extraireX(
  qs: string,
  memoire: MemoryStore,
  regles: RulesStore,
  synonymes: SynonymsStore,
  contexte: string[]
): string | null {
  const ql = sansAccent(qs.toLowerCase().trim());
  if (estSalutationPure(ql)) return null;

  // 1. Déduction causale "pourquoi [le|la|un...] [sujet]"
  const mPourquoi = ql.match(/pourquoi\s+(?:le|la|les|un|une)?\s*([a-z]+)/);
  if (mPourquoi) {
    const cand = corriger(mPourquoi[1].trim(), memoire, regles, synonymes) || mPourquoi[1].trim();
    if (!MOTS_VIDES.has(cand) && !PRONOMS_CONTEXTE.has(cand)) return cand;
  }

  // 2. Définitions explicites : c'est quoi, qu'est-ce que, qui est, parle-moi de...
  const defCheck = estRequeteDefinition(qs);
  if (defCheck.estDef && defCheck.concept) {
    const cand = corriger(defCheck.concept, memoire, regles, synonymes) || defCheck.concept;
    if (!MOTS_VIDES.has(cand)) return cand;
  }

  // 3. Pronoms anaphoriques résolus avec le contexte actif
  const ctx = resoudreContexte(qs, contexte);
  if (ctx) return ctx;

  // 4. Message court spécifiant un concept direct (1 ou 2 mots max, ex: "moineau", "l'aigle", "trou noir")
  const qClean = ql.replace(/[^a-z0-9 ]/g, ' ');
  const mots = qClean.split(/\s+/).filter(w => w.length >= 2 && !MOTS_VIDES.has(w) && !PRONOMS_CONTEXTE.has(w));
  
  if (mots.length === 1 || mots.length === 2) {
    const multiCand = mots.join(' ');
    if (memoire[multiCand] || regles[multiCand]) return multiCand;

    for (let i = mots.length - 1; i >= 0; i--) {
      const w = mots[i];
      const c = corriger(w, memoire, regles, synonymes);
      if (c && !estSalutationPure(c)) return c;
      const flou = rechercherFlou(w, memoire, regles, 0.72);
      if (flou && !estSalutationPure(flou)) return flou;
    }
  }

  // Dans une phrase ordinaire complexe, ne pas extraire un mot isolé par hasard
  return null;
}

export function naviguerLiens(sujet: string, liens: LinksStore, maxDepth = 10): string[] {
  const s = sujet.toLowerCase().trim();
  const chemin = [s];
  const visites = new Set([s]);
  let courant = s;
  for (let i = 0; i < maxDepth; i++) {
    const suivants = (liens[courant] || []).filter(item => !visites.has(item));
    if (suivants.length === 0) break;
    courant = suivants[0];
    visites.add(courant);
    chemin.push(courant);
  }
  return chemin;
}

export function trouverLiensCommuns(sujet1: string, sujet2: string, liens: LinksStore): string[] {
  const ancetres1 = new Set(naviguerLiens(sujet1, liens, 10));
  const ancetres2 = new Set(naviguerLiens(sujet2, liens, 10));
  return Array.from(ancetres1).filter(x => ancetres2.has(x) && x !== sujet1 && x !== sujet2);
}

export function deduireChaine(
  sujet: string,
  prop = '',
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore,
  maxDepth = 20
): {
  chemin: string[];
  propriete_source?: string;
  propriete_def?: string;
  confiance: number;
} | null {
  const s = (corriger(sujet, memoire, regles, synonymes) || sujet).toLowerCase().trim();
  const pNorm = sansAccent(prop.toLowerCase().trim());

  // Check explicit graph links first
  const chaineLiens = naviguerLiens(s, liens, maxDepth);
  if (!pNorm && chaineLiens.length > 1) {
    return { chemin: chaineLiens, confiance: 0.95 };
  }
  if (pNorm && chaineLiens.length > 1) {
    for (const ancetre of chaineLiens) {
      if (regles[ancetre]) {
        for (const regle of regles[ancetre]) {
          if (sansAccent(regle.prop.toLowerCase()).includes(pNorm)) {
            const idx = chaineLiens.indexOf(ancetre);
            return {
              chemin: chaineLiens.slice(0, idx + 1),
              propriete_source: ancetre,
              propriete_def: regle.prop,
              confiance: regle.poids * 0.95,
            };
          }
        }
      }
    }
  }

  const chemin = [s];
  const visited = new Set<string>();
  let cur = s;
  let confiance = 1.0;

  for (let step = 0; step < maxDepth; step++) {
    if (visited.has(cur)) break;
    visited.add(cur);
    const defs = memoire[cur] || [];
    if (defs.length === 0) break;

    const bestEntry = defs.reduce((max, curItem) => (curItem.poids > max.poids ? curItem : max), defs[0]);
    confiance *= bestEntry.poids;

    if (pNorm) {
      for (const d of defs) {
        if (sansAccent(d.def.toLowerCase()).includes(pNorm)) {
          if (chemin.length > 1 || cur !== s) {
            return {
              chemin,
              propriete_source: cur,
              propriete_def: d.def,
              confiance,
            };
          }
        }
      }
    }

    let nextNode: string | null = null;
    let nextNodeWithArt: string | null = null;

    for (const d of defs) {
      const isa = extraireIsA(d.def);
      if (isa) {
        const words = isa.split(/\s+/);
        const isaNom = words[words.length - 1];
        const isaCorr = corriger(isaNom, memoire, regles, synonymes) || isaNom;
        if (!visited.has(isaCorr)) {
          nextNode = isaCorr;
          nextNodeWithArt = isa;
          break;
        }
      }
    }

    if (nextNode) {
      chemin.push(nextNodeWithArt || nextNode);
      cur = nextNode;
    } else {
      break;
    }
  }

  if (pNorm) {
    // Check if cur has the property in rules
    if (regles[cur]) {
      for (const r of regles[cur]) {
        if (sansAccent(r.prop.toLowerCase()).includes(pNorm)) {
          return {
            chemin,
            propriete_source: cur,
            propriete_def: r.prop,
            confiance: confiance * r.poids,
          };
        }
      }
    }
    return null;
  }

  return chemin.length > 1 ? { chemin, confiance } : null;
}

export function deduireGeneralisation(
  sujet: string,
  prop: string,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore,
  maxDepth = 20
): {
  categorie: string;
  quant: 'tous' | 'aucun' | 'certains';
  prop: string;
  confiance: number;
  chemin: string[];
} | null {
  const s = (corriger(sujet, memoire, regles, synonymes) || sujet).toLowerCase().trim();
  const p = sansAccent(prop.toLowerCase().trim());
  if (!p) return null;

  const chaineInfo = deduireChaine(s, '', memoire, regles, liens, synonymes, maxDepth);
  const categoriesSujet: string[] = [];
  if (chaineInfo && chaineInfo.chemin) {
    for (const elem of chaineInfo.chemin) {
      const parts = elem.split(/\s+/);
      const nom = singulariser(parts[parts.length - 1], memoire, regles, synonymes);
      categoriesSujet.push(nom);
      categoriesSujet.push(elem.toLowerCase());
    }
  }
  categoriesSujet.push(s);

  const seen = new Set<string>();
  const cats: string[] = [];
  for (const c of categoriesSujet) {
    const sing = singulariser(c, memoire, regles, synonymes);
    if (!seen.has(sing)) {
      seen.add(sing);
      cats.push(sing);
    }
  }

  for (const cat of cats) {
    const catCorr = corriger(cat, memoire, regles, synonymes) || cat;
    for (const key of [cat, catCorr, singulariser(cat, memoire, regles, synonymes)]) {
      if (regles[key]) {
        for (const regle of regles[key]) {
          const rProp = sansAccent(regle.prop.toLowerCase());
          if (p.includes(rProp) || rProp.includes(p)) {
            const confChaine = chaineInfo ? chaineInfo.confiance : 1.0;
            return {
              categorie: key,
              quant: regle.quant,
              prop: regle.prop,
              confiance: regle.poids * confChaine,
              chemin: chaineInfo ? chaineInfo.chemin : [s],
            };
          }
        }
      }
    }
  }
  return null;
}

export function construirePhraseFluideDefinition(chemin: string[], confiance = 1.0): string | null {
  if (!chemin || chemin.length < 2) return null;
  const first = chemin[0].charAt(0).toUpperCase() + chemin[0].slice(1);
  const second = chemin[1];
  let phrase = `${first} est ${second}`;
  const connecteurs = ['qui est', 'lui-même', 'qui est à son tour', 'et qui est'];
  for (let i = 1; i < chemin.length - 1; i++) {
    const nxt = chemin[i + 1];
    const conn = connecteurs[Math.floor(Math.random() * connecteurs.length)];
    phrase += `, ${conn} ${nxt}`;
  }
  if (confiance < 0.5) {
    phrase += ` (confiance estimée à ${Math.round(confiance * 100)}%)`;
  } else if (confiance < 0.75) {
    phrase += ` (confiance ${Math.round(confiance * 100)}%)`;
  }
  return phrase + '.';
}

export function construirePhraseFluidePourquoi(
  chemin: string[],
  prop: string,
  propDef: string,
  propSource: string,
  confiance = 1.0
): string {
  const chaineFluide = (construirePhraseFluideDefinition(chemin, 1.0) || '').replace(/\.$/, '');
  const suiteProp = `Or ${propSource} ${propDef}`;
  const conclusions = [
    `Donc ${chemin[0]} ${prop}.`,
    `Ainsi, ${chemin[0]} ${prop} également.`,
    `Ce qui explique pourquoi ${chemin[0]} ${prop}.`,
  ];
  const conclusion = conclusions[Math.floor(Math.random() * conclusions.length)];
  const confTxt = confiance < 0.75 ? ` (indice de confiance : ${Math.round(confiance * 100)}%)` : '';
  return `${chaineFluide}. ${suiteProp}, ${conclusion.toLowerCase()}${confTxt}`;
}

export function construirePhraseGeneralisation(
  sujet: string,
  cat: string,
  quant: 'tous' | 'aucun' | 'certains',
  prop: string,
  confiance: number,
  chemin: string[]
): string {
  const cheminTxt = chemin.length > 1 ? (construirePhraseFluideDefinition(chemin, 1.0) || '') + ' ' : '';
  const pct = Math.round(confiance * 100);
  if (quant === 'tous') {
    return `${cheminTxt}Or tous les ${cat}s ${prop}, donc ${sujet} ${prop} (confiance ${pct}%).`;
  } else if (quant === 'aucun') {
    return `${cheminTxt}Or aucun ${cat} ne ${prop}, donc ${sujet} ne ${prop} pas (confiance ${pct}%).`;
  } else {
    return `${cheminTxt}Certains ${cat}s ${prop}. ${sujet} étant un ${cat}, il est probable que ${sujet} ${prop} (confiance ${pct}%).`;
  }
}

export function repondrePourquoi(
  question: string,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore
): string | null {
  const q = sansAccent(question.toLowerCase());
  const m = q.match(/pourquoi\s+(?:le|la|les|un|une)?\s*([a-z]+)\s+([a-z\s]+)/);
  if (!m) return null;
  const sujet = m[1].trim();
  const prop = m[2].trim();
  const sujetCorr = corriger(sujet, memoire, regles, synonymes) || sujet;

  const deduc = deduireChaine(sujetCorr, prop, memoire, regles, liens, synonymes);
  if (deduc && deduc.chemin && deduc.propriete_source && deduc.propriete_def) {
    return construirePhraseFluidePourquoi(
      deduc.chemin,
      prop,
      deduc.propriete_def,
      deduc.propriete_source,
      deduc.confiance
    );
  }

  const gen = deduireGeneralisation(sujetCorr, prop, memoire, regles, liens, synonymes);
  if (gen) {
    return construirePhraseGeneralisation(sujetCorr, gen.categorie, gen.quant, gen.prop, gen.confiance, gen.chemin);
  }

  if (memoire[sujetCorr]) {
    for (const d of memoire[sujetCorr]) {
      if (sansAccent(d.def.toLowerCase()).includes(prop)) {
        return `${sujetCorr.charAt(0).toUpperCase() + sujetCorr.slice(1)} ${d.def}.`;
      }
    }
  }

  return null;
}

export function phraseDef(
  X: string,
  question: string | null,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore
): string | null {
  const xCorr = corriger(X, memoire, regles, synonymes) || X;
  const defs = memoire[xCorr] || [];

  if (question && question.toLowerCase().includes('pourquoi')) {
    const rPourquoi = repondrePourquoi(question, memoire, regles, liens, synonymes);
    if (rPourquoi) return rPourquoi;
  }

  // Deductive chain
  const chaine = deduireChaine(xCorr, '', memoire, regles, liens, synonymes);
  if (chaine && chaine.chemin.length > 1) {
    const fluide = construirePhraseFluideDefinition(chaine.chemin, chaine.confiance);
    if (fluide) return fluide;
  }

  if (defs.length > 0) {
    const best = defs.reduce((max, cur) => (cur.poids > max.poids ? cur : max), defs[0]);
    const d = best.def.trim();
    if (best.type === 'question_reponse' || best.question_origine || d.length > 120 || d.includes('\n')) {
      return d;
    }
    const cap = xCorr.charAt(0).toUpperCase() + xCorr.slice(1);
    if (d.length > 60 || d.startsWith('est ') || d.startsWith('un ') || d.startsWith('une ')) {
      return d.startsWith('est ') ? `${cap} ${d}.` : `${cap} est ${d}.`;
    }
    return `${cap} est ${d}.`;
  }

  if (regles[xCorr]) {
    const rList = regles[xCorr].map(r => `${r.quant} les ${xCorr}s ${r.prop}`);
    return `${xCorr.charAt(0).toUpperCase() + xCorr.slice(1)}: ${rList.join(', ')}.`;
  }

  return null;
}

export function decayMemoire(
  memoire: MemoryStore,
  regles: RulesStore,
  joursSeuil = 7,
  taux = 0.98
): { modifs: number; supprimes: number } {
  const now = new Date();
  let modifs = 0;
  let supprimes = 0;

  for (const [sujet, entries] of Object.entries(memoire)) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const last = new Date(entry.last_used || entry.created || now.toISOString());
      const deltaDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 3600 * 24));
      if (deltaDays >= joursSeuil) {
        const joursOublie = deltaDays - joursSeuil + 1;
        const ancienPoids = entry.poids;
        let nouveauPoids = Math.max(0.1, ancienPoids * Math.pow(taux, joursOublie));
        if (nouveauPoids < ancienPoids - 0.02) {
          entry.poids = Number(nouveauPoids.toFixed(2));
          modifs++;
        }
        if (deltaDays > 30 && nouveauPoids < 0.25 && entry.hits < 3 && entries.length > 1) {
          entries.splice(i, 1);
          supprimes++;
        }
      }
    }
    if (entries.length === 0) {
      delete memoire[sujet];
    }
  }

  return { modifs, supprimes };
}

export function trouverQuestionReponse(
  question: string,
  memoire: MemoryStore,
  seuilSimilarite = 0.72
): { sujet: string; entry: MemoryEntry; score: number } | null {
  if (!question || !memoire) return null;
  const qNorm = normaliserQuestionCle(question);
  const qKeywords = extraireMotsCles(question);

  if (qKeywords.length === 0) return null;

  let bestMatch: { sujet: string; entry: MemoryEntry; score: number } | null = null;
  let maxScore = 0;

  for (const [sujet, entries] of Object.entries(memoire)) {
    for (const entry of entries) {
      // Entrée candidate si c'est un Q&A ou si une question d'origine est renseignée, ou si le sujet a plusieurs mots
      const origQ = entry.question_origine || (entry.type === 'question_reponse' ? sujet : null);
      if (!origQ && !sujet.includes(' ')) continue;

      const qSource = origQ || sujet;
      const storedQNorm = normaliserQuestionCle(qSource);
      const storedKeywords = entry.mots_cles && entry.mots_cles.length > 0
        ? entry.mots_cles
        : extraireMotsCles(qSource);

      if (storedKeywords.length === 0) continue;

      // 1. Correspondance exacte ou quasi-identique de la question
      if (qNorm === storedQNorm) {
        return { sujet, entry, score: 1.0 };
      }

      // 2. Score de similarité globale
      const simText = similarite(qNorm, storedQNorm);

      // 3. Recouvrement des mots-clés essentiels
      const intersection = storedKeywords.filter(k => qKeywords.includes(k));

      // Si la question mémorisée a plusieurs mots-clés (ex: "capitale" + "australie"),
      // TOUS ou la grande majorité des mots-clés doivent concorder. JAMAIS un mot isolé !
      if (storedKeywords.length >= 2) {
        const recallStored = intersection.length / storedKeywords.length;
        const precisionQ = intersection.length / qKeywords.length;

        if (intersection.length >= 2 && recallStored >= 0.70 && precisionQ >= 0.40) {
          const score = (recallStored * 0.6) + (precisionQ * 0.2) + (simText * 0.2);
          if (score > maxScore && score >= seuilSimilarite) {
            maxScore = score;
            bestMatch = { sujet, entry, score };
          }
        }
      } else if (storedKeywords.length === 1 && qKeywords.length === 1) {
        // Cas d'un seul mot-clé : uniquement si la requête est elle-même exactement ce seul mot
        if (storedKeywords[0] === qKeywords[0] && simText >= 0.85) {
          if (simText > maxScore && simText >= seuilSimilarite) {
            maxScore = simText;
            bestMatch = { sujet, entry, score: simText };
          }
        }
      }
    }
  }

  return bestMatch;
}

export function nettoyerMemoirePolluee(memoire: MemoryStore): number {
  if (!memoire) return 0;
  let nettoyes = 0;
  const nowIso = new Date().toISOString();

  for (const [sujet, entries] of Object.entries(memoire)) {
    // Si la clé est un mot isolé simple sans espace (ex: "australie" ou "taille" ou "intelligence")
    if (!sujet.includes(' ') && entries.length > 0) {
      const entry = entries[0];
      // Vérifier si elle provient d'une question LLM qui avait plusieurs mots
      if (entry.question_origine && entry.question_origine.trim().includes(' ')) {
        const qTrim = entry.question_origine.trim();
        const mots = extraireMotsCles(qTrim);

        // Si la question originale contenait au moins 2 mots clés et n'était pas juste une définition de ce mot
        const defCheck = estRequeteDefinition(qTrim);
        if (mots.length >= 2 && (!defCheck.estDef || defCheck.concept !== sujet)) {
          const newKey = normaliserQuestionCle(qTrim);
          if (!memoire[newKey]) {
            memoire[newKey] = [];
          }
          memoire[newKey].unshift({
            ...entry,
            type: 'question_reponse',
            mots_cles: mots,
            last_used: nowIso,
          });

          // Supprimer la clé corrompue d'un mot unique pour ne plus intercepter hors-contexte
          delete memoire[sujet];
          nettoyes++;
        }
      }
    }
  }

  return nettoyes;
}

export function apprendreDeLLM(
  question: string,
  reponseLLM: string,
  memoire: MemoryStore,
  provider: 'gemini' | 'groq' | 'auto' = 'gemini'
): { sujet: string; def: string; type: 'concept' | 'question_reponse' } | null {
  try {
    if (!question || !reponseLLM) return null;
    const qTrim = question.trim();
    let repTrim = reponseLLM.trim();
    if (qTrim.length < 3 || repTrim.length < 5) return null;

    const qClean = sansAccent(qTrim.toLowerCase());
    if (estSalutationPure(qClean) || qClean.startsWith('retiens:') || qClean.startsWith('regle:') || qClean.startsWith('lien:')) {
      return null;
    }

    // Nettoyer les formules d'introduction superflues dans la réponse
    for (const intro of ['Voici ', 'Bien sûr', 'Bien sur', "D'accord", 'Daccord', 'Avec plaisir', 'Absolument']) {
      if (repTrim.startsWith(intro)) {
        const parts = repTrim.split('. ');
        if (parts.length > 1) {
          repTrim = parts.slice(1).join('. ');
        }
        break;
      }
    }

    const nowIso = new Date().toISOString();

    // 1. Est-ce une demande de DÉFINITION DE CONCEPT (ex: "c'est quoi un trou noir", "qu'est-ce que l'IA", "définition de X") ?
    const defCheck = estRequeteDefinition(qTrim);
    if (defCheck.estDef && defCheck.concept) {
      const concept = defCheck.concept;
      if (!memoire[concept]) {
        memoire[concept] = [];
      }

      const exists = memoire[concept].find(it => it.def.toLowerCase() === repTrim.toLowerCase());
      if (exists) {
        exists.poids = Math.min(1.0, exists.poids + 0.05);
        exists.hits += 1;
        exists.last_used = nowIso;
      } else {
        memoire[concept].unshift({
          def: repTrim,
          poids: 0.85,
          hits: 1,
          source: provider === 'groq' ? 'groq' : 'gemini',
          question_origine: qTrim,
          type: 'concept',
          last_used: nowIso,
          created: nowIso,
        });
      }
      return { sujet: concept, def: repTrim, type: 'concept' };
    }

    // 2. Sinon : c'est une QUESTION GÉNÉRALE -> Enregistrer QUESTION + RÉPONSE (Q&A)
    // On conserve la question entière (clé canonique) et ses mots-clés distinctifs
    const motsCles = extraireMotsCles(qTrim);
    if (motsCles.length === 0) return null;

    const canonicalKey = normaliserQuestionCle(qTrim);
    if (!memoire[canonicalKey]) {
      memoire[canonicalKey] = [];
    }

    const exists = memoire[canonicalKey].find(it => it.def.toLowerCase() === repTrim.toLowerCase());
    if (exists) {
      exists.poids = Math.min(1.0, exists.poids + 0.05);
      exists.hits += 1;
      exists.last_used = nowIso;
    } else {
      memoire[canonicalKey].unshift({
        def: repTrim,
        poids: 0.85,
        hits: 1,
        source: provider === 'groq' ? 'groq' : 'gemini',
        question_origine: qTrim,
        mots_cles: motsCles,
        type: 'question_reponse',
        last_used: nowIso,
        created: nowIso,
      });
    }

    return { sujet: canonicalKey, def: repTrim, type: 'question_reponse' };
  } catch {
    return null;
  }
}

export const SEED_MEMORY: MemoryStore = {
  moineau: [
    { def: 'un petit oiseau migrateur ou sédentaire', poids: 0.9, hits: 3, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  oiseau: [
    { def: 'un animal à plumes doté d’ailes', poids: 0.95, hits: 5, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  animal: [
    { def: 'un être vivant doué de sensibilité et de mouvement', poids: 0.98, hits: 8, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  python: [
    { def: 'un langage de programmation interprété polyvalent et puissant', poids: 0.92, hits: 4, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  ia: [
    { def: 'intelligence artificielle capable d’apprendre et de raisonner', poids: 0.95, hits: 6, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  groq: [
    { def: 'un fournisseur ultra-rapide d’inférence LLM pour modèles open source', poids: 0.9, hits: 3, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
};

export const SEED_RULES: RulesStore = {
  oiseau: [
    { quant: 'tous', prop: 'a des ailes et pond des œufs', poids: 0.95, hits: 4, last_used: new Date().toISOString(), created: new Date().toISOString() },
    { quant: 'certains', prop: 'volent très haut', poids: 0.85, hits: 2, last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  animal: [
    { quant: 'tous', prop: 'respire et a besoin de nourriture', poids: 0.98, hits: 5, last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
};

export const SEED_LINKS: LinksStore = {
  moineau: ['oiseau'],
  oiseau: ['animal'],
};

```

---

## 📄 Fichier : `src/services/apiService.ts`

```typescript
import { MemoryStore, RulesStore, LinksStore, SynonymsStore } from '../types/kaderbot';

export interface ChatApiParams {
  prompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  provider: 'gemini' | 'groq' | 'local_only';
  groqModel?: string;
  systemPrompt?: string;
}

export interface ChatApiResponse {
  text: string;
  provider: string;
  model?: string;
  isFallback?: boolean;
  fallbackReason?: string;
}

export const apiService = {
  async chat(params: ChatApiParams): Promise<ChatApiResponse> {
    // Strip any sensitive keys - Server exclusively uses process.env keys
    const { prompt, history, provider, groqModel, systemPrompt } = params as any;
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        history,
        provider,
        groqModel,
        systemPrompt,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
      throw new Error(err.error || `Erreur serveur (${res.status})`);
    }

    return await res.json();
  },

  async testGroqConnection(
    apiKey?: string,
    model = 'openai/gpt-oss-120b'
  ): Promise<{ ok: boolean; model?: string; latencyMs?: number; error?: string; reply?: string }> {
    const res = await fetch('/api/groq/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey?.trim() || undefined, model }),
    });

    return await res.json();
  },

  async testGeminiConnection(
    apiKey?: string
  ): Promise<{ ok: boolean; model?: string; latencyMs?: number; error?: string; reply?: string }> {
    const res = await fetch('/api/gemini/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey?.trim() || undefined }),
    });

    return await res.json();
  },

  async genererIdees(params: {
    theme: string;
    count: number;
    style: string;
    styleDesc?: string;
    provider: string;
    groqModel?: string;
  }): Promise<string> {
    const { theme, count, style, styleDesc, provider, groqModel } = params as any;
    const res = await fetch('/api/idees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme,
        count,
        style,
        styleDesc,
        provider,
        groqModel,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur génération idées' }));
      throw new Error(err.error || 'Erreur génération');
    }

    const data = await res.json();
    return data.text || '';
  },

  async traduire(params: {
    text: string;
    targetLang: string;
    provider: string;
    groqModel?: string;
  }): Promise<string> {
    const { text, targetLang, provider, groqModel } = params as any;
    const res = await fetch('/api/traduis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLang,
        provider,
        groqModel,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur traduction' }));
      throw new Error(err.error || 'Erreur traduction');
    }

    const data = await res.json();
    return data.text || '';
  },

  async corriger(params: {
    text: string;
    provider: string;
    groqModel?: string;
  }): Promise<string> {
    const { text, provider, groqModel } = params as any;
    const res = await fetch('/api/corrige', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        provider,
        groqModel,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur correction' }));
      throw new Error(err.error || 'Erreur correction');
    }

    const data = await res.json();
    return data.text || '';
  },

  async resumer(params: {
    text: string;
    provider: string;
    groqModel?: string;
  }): Promise<string> {
    const { text, provider, groqModel } = params as any;
    const res = await fetch('/api/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        provider,
        groqModel,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur résumé' }));
      throw new Error(err.error || 'Erreur résumé');
    }

    const data = await res.json();
    return data.text || '';
  },

  async loadMemoryFromServer(): Promise<{
    memoire: MemoryStore;
    regles: RulesStore;
    liens: LinksStore;
    synonymes: SynonymsStore;
    sessions: string[];
  }> {
    const res = await fetch('/api/memory');
    if (!res.ok) throw new Error('Impossible de charger la mémoire distante');
    return await res.json();
  },

  async saveMemoryToServer(data: {
    memoire: MemoryStore;
    regles: RulesStore;
    liens: LinksStore;
    synonymes: SynonymsStore;
    sessions: string[];
  }): Promise<{ success: boolean; savedAt: string }> {
    const res = await fetch('/api/memory/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erreur sauvegarde sur serveur');
    return await res.json();
  },

  async downloadPydroidScript(data: {
    memoire: MemoryStore;
    regles: RulesStore;
    liens: LinksStore;
    groqApiKey?: string;
    groqModel?: string;
    mode?: 'auto' | 'console' | 'gui';
  }): Promise<Blob> {
    const res = await fetch('/api/export-pydroid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erreur téléchargement script Pydroid 3');
    return await res.blob();
  },
};

```

---

## 📄 Fichier : `src/components/Header.tsx`

```typescript
import React from 'react';
import {
  Brain,
  Sparkles,
  Download,
  Settings,
  Volume2,
  VolumeX,
  Layers,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import { AppConfig } from '../types/kaderbot';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HeaderProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: Partial<AppConfig>) => void;
  sessions: string[];
  onSelectSession: (session: string) => void;
  onOpenSettings: () => void;
  onOpenActionsMenu: () => void;
  conceptsCount: number;
  rulesCount: number;
  isAdmin?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onUpdateConfig,
  sessions,
  onSelectSession,
  onOpenSettings,
  onOpenActionsMenu,
  conceptsCount,
  rulesCount,
  isAdmin = false,
}) => {
  const { isInstallable, install } = usePWAInstall();

  // Short label helper for current model
  const getGroqShortName = () => {
    const m = (config.groqModel || '').toLowerCase();
    if (m.includes('gpt')) return 'GPT-120B';
    if (m.includes('70b')) return 'Llama 70B';
    if (m.includes('8b')) return 'Llama 8B';
    if (m.includes('qwen')) return 'Qwen 27B';
    return 'Groq';
  };

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 flex-shrink-0 bg-[#090B10]/95 backdrop-blur-md border-b border-gray-800/80 px-3 py-2 sm:px-6 sm:py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 md:gap-4">
        {/* Tier 1: Brand & Action Controls */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          {/* Brand identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#10A37F] to-[#06B6D4] p-0.5 shadow-md shadow-emerald-500/20">
                <div className="w-full h-full bg-[#0E131F] rounded-[10px] flex items-center justify-center">
                  <Brain className="w-5 h-5 text-[#10A37F] animate-pulse" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#090B10] rounded-full" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
                  KADERBOT
                </h1>
                <span className="text-[#10A37F] font-mono text-[10px] sm:text-xs px-1.5 py-0.2 rounded bg-[#10A37F]/15 border border-[#10A37F]/30 font-semibold shrink-0">
                  NOVA V14
                </span>
                {isAdmin ? (
                  <span className="text-amber-300 font-mono text-[10px] px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 font-bold shrink-0 flex items-center gap-1 shadow-sm">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    <span>Mode Admin</span>
                  </span>
                ) : (
                  <span className="text-emerald-400 font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 font-medium shrink-0">
                    Public
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 truncate flex items-center gap-1.5">
                <span>Hybride</span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span className="text-emerald-400 font-mono text-[10px] sm:text-[11px]">
                  {conceptsCount} faits · {rulesCount} règles
                </span>
              </p>
            </div>
          </div>

          {/* Quick tool icons on mobile (Actions, Sound, Settings) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Actions Menu button (Admin Only) */}
            {isAdmin && (
              <button
                onClick={onOpenActionsMenu}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-sm shadow-emerald-900/30 transition-all active:scale-95"
                title="Menu des commandes rapides (Tkinter Actions)"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span className="inline text-[11px] sm:text-xs">Actions</span>
              </button>
            )}

            {/* Sound toggle button */}
            <button
              onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
              className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border transition-colors flex-shrink-0 ${
                config.soundEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'
              }`}
              title={config.soundEnabled ? 'Synthèse vocale active' : 'Synthèse vocale désactivée'}
            >
              {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* PWA Install Button if available */}
            {isInstallable && (
              <button
                onClick={install}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 text-xs font-medium transition-all"
                title="Installer l'application sur Android / PC"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PWA</span>
              </button>
            )}

            {/* Settings button (Admin Only) */}
            {isAdmin && (
              <button
                onClick={onOpenSettings}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-colors flex-shrink-0"
                title="Paramètres de l'IA et clés API"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Selectors (Session & AI Model) - Cleanly displayed side-by-side without any overlap */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Session Switcher Pill (Admin Only) */}
          {isAdmin && (
            <div className="flex-1 md:flex-initial flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900/90 border border-gray-800 text-xs text-gray-300 font-medium min-w-0">
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden sm:inline text-gray-400 shrink-0">Session:</span>
              <select
                value={config.activeSession}
                onChange={e => onSelectSession(e.target.value)}
                className="bg-transparent text-white font-semibold cursor-pointer outline-none text-xs w-full min-w-0 truncate"
              >
                {sessions.map(s => (
                  <option key={s} value={s} className="bg-gray-900 text-white">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* AI Provider Direct Selector */}
          <div className={`flex-1 md:flex-initial flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors bg-gray-900/90 min-w-0 ${
            config.provider === 'gemini'
              ? 'border-emerald-500/40 text-emerald-300'
              : config.provider === 'groq'
              ? 'border-amber-500/40 text-amber-300'
              : 'border-blue-500/40 text-blue-300'
          }`}>
            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${
              config.provider === 'gemini' ? 'text-emerald-400' : config.provider === 'groq' ? 'text-amber-400' : 'text-blue-400'
            }`} />
            <select
              value={config.provider}
              onChange={e => onUpdateConfig({ provider: e.target.value as any })}
              className="bg-transparent font-semibold cursor-pointer outline-none text-xs text-white w-full min-w-0 truncate"
              title="Sélectionner le moteur IA"
            >
              <option value="gemini" className="bg-gray-900 text-emerald-300">
                ✨ Gemini 3.8 Flash
              </option>
              <option value="groq" className="bg-gray-900 text-amber-300">
                ⚡ Groq ({getGroqShortName()})
              </option>
              <option value="local_only" className="bg-gray-900 text-blue-300">
                🧠 100% Local (Hors-ligne)
              </option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};

```

---

## 📄 Fichier : `src/components/ChatTab.tsx`

```typescript
import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Brain,
  ThumbsUp,
  ThumbsDown,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import { ChatMessage } from '../types/kaderbot';

interface ChatTabProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSendMessage: (text: string) => void;
  onClearMessages: () => void;
  onAdjustWeight: (sujet: string, delta: number) => void;
  soundEnabled: boolean;
  activeSession: string;
  prefilledText?: string;
  onClearPrefill?: () => void;
  onOpenActions?: () => void;
  isAdmin?: boolean;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
  isThinking,
  onSendMessage,
  onClearMessages,
  onAdjustWeight,
  soundEnabled,
  activeSession,
  prefilledText,
  onClearPrefill,
  onOpenActions,
  isAdmin = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync prefilledText when passed from Action menu or chips
  useEffect(() => {
    if (prefilledText !== undefined && prefilledText !== '') {
      setInputText(prefilledText);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = prefilledText.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 50);
      onClearPrefill?.();
    }
  }, [prefilledText, onClearPrefill]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Voice Speech Recognition
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée sur ce navigateur.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  // Text-to-speech for a specific message
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isThinking) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleScrollUnits = (direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      const amount = direction === 'up' ? -250 : 250;
      scrollContainerRef.current.scrollBy({ top: amount, behavior: 'smooth' });
    }
  };

  const quickPills = [
    { label: 'C’est quoi...', text: "c'est quoi " },
    { label: 'Pourquoi...', text: 'pourquoi ' },
    { label: 'Retenir un fait', text: 'retiens: ' },
    { label: 'Règle tous les...', text: 'retiens: tous les ' },
    { label: 'Lier concepts', text: 'lie: ' },
    { label: 'Générer idées', text: 'idees 5: ' },
    { label: 'Traduire', text: 'traduis en anglais: ' },
    { label: 'Lister mémoire', text: 'lister: memoire' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden bg-[#050508] cyber-bg">
      {/* Messages Scroll Area - Only this container scrolls */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 px-3 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-5 overscroll-contain"
      >
        {/* Session banner */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900/80 border border-gray-800 text-[11px] text-gray-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Session cognitive : {activeSession}</span>
          </div>
        </div>

        {/* Message bubbles */}
        {messages.map(msg => {
          const isUser = msg.author === 'Toi';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group transition-all`}
            >
              {/* Author name & source badge */}
              <div
                className={`flex items-center gap-2 mb-1 px-1 text-[11px] font-semibold ${
                  isUser ? 'text-gray-400' : 'text-emerald-400'
                }`}
              >
                <span>{isUser ? 'TOI' : 'KADERBOT NOVA'}</span>
                {!isUser && msg.meta?.source && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700/60">
                    {msg.meta.source === 'deduction'
                      ? '⛓️ Déduction logique'
                      : msg.meta.source === 'local_memoire'
                      ? '🧠 Mémoire interne'
                      : msg.meta.source === 'regle'
                      ? '📐 Règle universelle'
                      : msg.meta.source === 'gemini'
                      ? '✨ Gemini 3.8'
                      : msg.meta.source === 'groq'
                      ? '⚡ Groq'
                      : 'Système'}
                  </span>
                )}
                {msg.confidence !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded ${
                      msg.confidence >= 0.75
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                    }`}
                  >
                    {Math.round(msg.confidence * 100)}% certitude
                  </span>
                )}
                <span className="text-gray-600 text-[10px]">{msg.timestamp}</span>
              </div>

              {/* Message box */}
              <div
                className={`relative max-w-[92%] sm:max-w-[78%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm leading-relaxed shadow-lg ${
                  isUser
                    ? 'bg-[#1E2028] text-white border border-gray-700/60 rounded-tr-sm'
                    : 'bg-[#0E131F] text-gray-100 border border-emerald-500/25 rounded-tl-sm shadow-emerald-950/20'
                }`}
              >
                {/* Main text */}
                <div className="whitespace-pre-wrap break-words">{msg.text}</div>

                {/* Deductive chain visual crumb if applicable */}
                {!isUser && msg.meta?.chemin && msg.meta.chemin.length > 1 && (
                  <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex items-center gap-1.5 flex-wrap text-[11px] text-cyan-300 font-mono">
                    <span className="text-gray-500">Chaîne cognitive :</span>
                    {msg.meta.chemin.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className="bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/30">
                          {step}
                        </span>
                        {idx < msg.meta!.chemin!.length - 1 && <span className="text-gray-600">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {/* Interactive Cognitive Feedback buttons (Admin Only - Just like Python script!) */}
                {isAdmin && !isUser && msg.meta?.sujet && (
                  <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-gray-400">
                      Ce fait sur <span className="text-emerald-400 font-mono font-bold">{msg.meta.sujet}</span> est-il exact ?
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onAdjustWeight(msg.meta!.sujet!, 0.1)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium transition active:scale-95"
                        title="Renforcer le poids de confiance (+0.1)"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>Exact (+0.1)</span>
                      </button>
                      <button
                        onClick={() => onAdjustWeight(msg.meta!.sujet!, -0.15)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-300 text-[11px] font-medium transition active:scale-95"
                        title="Baisser le poids de confiance (-0.15)"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        <span>Inexact (-0.15)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Message action bar: Copy & Speech */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px]"
                    title="Copier le texte"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  {!isUser && (
                    <button
                      onClick={() => speakText(msg.text)}
                      className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px]"
                      title="Lire à haute voix"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking Indicator (faithfully reproducing the ". . ." animation from Python Tkinter) */}
        {isThinking && (
          <div className="flex flex-col items-start space-y-1 animate-in fade-in">
            <span className="text-[11px] font-semibold text-emerald-400 px-1">KADERBOT NOVA</span>
            <div className="bg-[#0E131F] border border-emerald-500/30 rounded-2xl px-5 py-3 text-emerald-400 flex items-center gap-2">
              <span className="font-mono text-sm tracking-widest animate-pulse">. . .</span>
              <span className="text-xs text-gray-400 ml-1">KADERBOT réfléchit...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll Buttons (From Tkinter V13.8 on Android) */}
      <div className="absolute right-4 bottom-28 sm:bottom-32 z-20 flex flex-col gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
        <button
          onClick={() => handleScrollUnits('up')}
          className="w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-lg active:scale-95"
          title="Défiler vers le haut"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleScrollUnits('down')}
          className="w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-lg active:scale-95"
          title="Défiler vers le bas"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Pills - Fixed above input */}
      <div className="shrink-0 flex-shrink-0 px-3 sm:px-6 py-1.5 border-t border-gray-800/60 bg-[#090B10]/90 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
        {quickPills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => setInputText(pill.text)}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 text-[11px] font-medium text-gray-300 hover:text-emerald-300 transition"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Input Form Bar - Permanently fixed at bottom of chat */}
      <div className="shrink-0 flex-shrink-0 p-2.5 sm:p-4 bg-[#090B10] border-t border-gray-800/80 z-20">
        <form onSubmit={handleFormSubmit} className="max-w-7xl mx-auto flex items-center gap-2">
          {/* Voice input button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`p-2.5 rounded-xl border transition-all ${
              isRecording
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
            }`}
            title={isRecording ? 'Arrêter dictée' : 'Dicter vocalement en français'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text entry field */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Pose une question, écris 'pourquoi...', ou 'retiens: sujet = définition'..."
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition shadow-inner"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/40 transition active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Envoyer</span>
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClearMessages}
            className="p-2.5 sm:p-3 rounded-xl bg-gray-900 border border-gray-800 text-gray-500 hover:text-rose-400 hover:border-gray-700 transition"
            title="Effacer l'historique de discussion"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

```

---

## 📄 Fichier : `src/components/KnowledgeGraphTab.tsx`

```typescript
import React, { useState, useMemo } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  TrendingUp,
  Clock,
  ExternalLink,
  ChevronRight,
  GitBranch,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';
import { deduireChaine, sansAccent } from '../core/cognitiveEngine';

interface KnowledgeGraphTabProps {
  memoire: MemoryStore;
  regles: RulesStore;
  liens: LinksStore;
  synonymes: SynonymsStore;
  onAddDefinition: (sujet: string, defText: string) => void;
  onDeleteConcept: (sujet: string) => void;
  onAdjustWeight: (sujet: string, delta: number) => void;
  onAdjustHits?: (sujet: string, entryIdx: number, delta: number) => void;
  onAddLink: (source: string, target: string) => void;
  onDeleteLink: (source: string, target: string) => void;
  onAskQuestionAbout: (sujet: string) => void;
}

export const KnowledgeGraphTab: React.FC<KnowledgeGraphTabProps> = ({
  memoire,
  regles,
  liens,
  synonymes,
  onAddDefinition,
  onDeleteConcept,
  onAdjustWeight,
  onAdjustHits,
  onAddLink,
  onDeleteLink,
  onAskQuestionAbout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [newDefInput, setNewDefInput] = useState('');
  const [newLinkTarget, setNewLinkTarget] = useState('');

  // Extract all concept nodes
  const conceptsList = useMemo(() => {
    const list = Object.keys(memoire).map(sujet => {
      const defs = memoire[sujet] || [];
      const best = defs.reduce((max, c) => (c.poids > max.poids ? c : max), defs[0] || { poids: 0.8, hits: 1 });
      const parents = liens[sujet] || [];
      const children = Object.keys(liens).filter(k => (liens[k] || []).includes(sujet));
      const isQA = best?.type === 'question_reponse' || Boolean(best?.question_origine && best.question_origine.includes(' ')) || sujet.includes(' ');
      return {
        sujet,
        bestDef: best?.def || '',
        poids: best?.poids || 0.8,
        hits: best?.hits || 1,
        source: best?.source || 'manuel',
        isQA,
        question_origine: best?.question_origine,
        mots_cles: best?.mots_cles || [],
        defsCount: defs.length,
        parents,
        children,
      };
    });

    list.sort((a, b) => b.poids - a.poids);
    return list;
  }, [memoire, liens]);

  // Filtered concepts
  const filteredConcepts = useMemo(() => {
    if (!searchQuery.trim()) return conceptsList;
    const qNorm = sansAccent(searchQuery.toLowerCase());
    return conceptsList.filter(
      c =>
        sansAccent(c.sujet).includes(qNorm) ||
        sansAccent(c.bestDef).includes(qNorm)
    );
  }, [conceptsList, searchQuery]);

  // Current active concept detail
  const currentConceptData = selectedConcept ? memoire[selectedConcept] : null;
  const currentChain = selectedConcept
    ? deduireChaine(selectedConcept, '', memoire, regles, liens, synonymes)
    : null;

  const handleAddDefSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcept || !newDefInput.trim()) return;
    onAddDefinition(selectedConcept, newDefInput.trim());
    setNewDefInput('');
  };

  const handleAddLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcept || !newLinkTarget.trim()) return;
    onAddLink(selectedConcept, newLinkTarget.trim());
    setNewLinkTarget('');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-112px)] sm:h-[calc(100vh-120px)] overflow-hidden bg-[#050508] text-gray-200">
      {/* Left panel: List & Search */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-gray-800/80 flex flex-col bg-[#090B10]/95 flex-shrink-0">
        {/* Search header */}
        <div className="p-3 sm:p-4 border-b border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs sm:text-sm font-bold text-white">Mémoire Cognitive</h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
              {conceptsList.length} concepts
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un mot (ex: oiseau, python...)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* List of Concepts */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5">
          {filteredConcepts.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-500">
              Aucun concept trouvé. Pose une question au bot pour lui apprendre !
            </div>
          ) : (
            filteredConcepts.map(item => {
              const isSelected = selectedConcept === item.sujet;
              return (
                <div
                  key={item.sujet}
                  onClick={() => setSelectedConcept(item.sujet)}
                  className={`p-2.5 sm:p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-950/30'
                      : 'bg-gray-900/50 hover:bg-gray-800/70 border-gray-800/80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-white truncate capitalize">
                        {item.sujet}
                      </span>
                      {item.isQA ? (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950/70 text-purple-300 border border-purple-800/50">
                          Q&R
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/50">
                          Concept
                        </span>
                      )}
                      {item.parents.length > 0 && (
                        <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-0.5">
                          <GitBranch className="w-2.5 h-2.5" />
                          <span>{item.parents[0]}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.bestDef}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        item.poids >= 0.75
                          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40'
                          : 'bg-amber-900/50 text-amber-300 border border-amber-700/40'
                      }`}
                    >
                      {Math.round(item.poids * 100)}%
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">{item.hits} hits</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel: Detail, Chains & Graph Connections */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#050508]">
        {selectedConcept ? (
          <div className="space-y-5 max-w-4xl mx-auto">
            {/* Header card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl sm:text-2xl font-black text-white capitalize tracking-wide">
                    {selectedConcept}
                  </h3>
                  {currentConceptData?.[0]?.type === 'question_reponse' || currentConceptData?.[0]?.question_origine ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono">
                      Question-Réponse (Q&R)
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono">
                      Concept actif
                    </span>
                  )}
                </div>
                {currentConceptData?.[0]?.question_origine && (
                  <p className="text-xs text-purple-300/90 mt-1 italic font-medium">
                    Question originale : &ldquo;{currentConceptData[0].question_origine}&rdquo;
                  </p>
                )}
                {currentConceptData?.[0]?.mots_cles && currentConceptData[0].mots_cles.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-500 font-mono">Mots-clés déclencheurs :</span>
                    {currentConceptData[0].mots_cles.map(mc => (
                      <span key={mc} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                        {mc}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Enregistré dans la mémoire cognitive locale de KADERBOT
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onAskQuestionAbout(selectedConcept)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Demander au bot</span>
                </button>
                <button
                  onClick={() => {
                    onDeleteConcept(selectedConcept);
                    setSelectedConcept(null);
                  }}
                  className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-500 hover:text-rose-400 hover:border-rose-900/40 transition"
                  title="Supprimer ce concept de la mémoire"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Logical Deduction Chain Visualization */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-cyan-500/20 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Chaîne d’Inférence Logique (Arbre Conceptuel)
                  </h4>
                </div>
                {currentChain && (
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    Confiance : {Math.round(currentChain.confiance * 100)}%
                  </span>
                )}
              </div>

              {currentChain && currentChain.chemin.length > 1 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-mono">
                    {currentChain.chemin.map((node, index) => (
                      <React.Fragment key={index}>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span className="font-bold capitalize">{node}</span>
                        </div>
                        {index < currentChain.chemin.length - 1 && (
                          <span className="text-gray-500 font-bold">est un →</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <p className="text-xs text-gray-400 bg-gray-900/60 p-3 rounded-xl border border-gray-800/80">
                    💡 Grâce à cette chaîne, tout ce qui est vrai pour{' '}
                    <strong className="text-cyan-300">
                      {currentChain.chemin[currentChain.chemin.length - 1]}
                    </strong>{' '}
                    est automatiquement hérité par{' '}
                    <strong className="text-emerald-300">{selectedConcept}</strong> !
                  </p>
                </div>
              ) : (
                <div className="text-xs text-gray-500 bg-gray-900/40 p-3 rounded-xl">
                  Ce concept n'est pas encore relié à un parent (ex: oiseau, animal, langage). Tu
                  peux créer un lien ci-dessous ou dire au bot : « {selectedConcept} est un ... »
                </div>
              )}
            </div>

            {/* Definitions & Weighted Facts */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-3">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                <span>Définitions & Poids de certitude</span>
              </h4>

              <div className="space-y-2">
                {currentConceptData?.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-gray-900/70 border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-gray-200">{entry.def}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 flex-wrap">
                        <span>Source: {entry.source}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          <span>Hits: <strong className="text-emerald-300 font-mono text-xs">{entry.hits}</strong></span>
                          {onAdjustHits && (
                            <span className="inline-flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAdjustHits(selectedConcept, idx, 1);
                                }}
                                className="px-1.5 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-mono text-[10px] border border-emerald-800/50"
                                title="Augmenter les hits (+1)"
                              >
                                +1 hit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAdjustHits(selectedConcept, idx, -1);
                                }}
                                className="px-1.5 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-mono text-[10px] border border-rose-800/50"
                                title="Diminuer les hits (-1)"
                              >
                                -1 hit
                              </button>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {(entry.poids * 100).toFixed(0)}%
                        </span>
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${entry.poids * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onAdjustWeight(selectedConcept, 0.1)}
                          className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[11px] font-mono border border-emerald-800/40"
                          title="Augmenter la confiance"
                        >
                          +0.1
                        </button>
                        <button
                          onClick={() => onAdjustWeight(selectedConcept, -0.1)}
                          className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[11px] font-mono border border-rose-800/40"
                          title="Diminuer la confiance"
                        >
                          -0.1
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add definition form */}
              <form onSubmit={handleAddDefSubmit} className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Ajouter une propriété à "${selectedConcept}"...`}
                  value={newDefInput}
                  onChange={e => setNewDefInput(e.target.value)}
                  className="flex-1 bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="submit"
                  disabled={!newDefInput.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </form>
            </div>

            {/* Hierarchical Links Management (lie: A -> B) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-3">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Liens Parent / Enfant (Taxonomie)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Parents */}
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[11px] text-gray-400 block mb-1.5 font-semibold">
                    Concepts Parents (dont il hérite) :
                  </span>
                  {(liens[selectedConcept] || []).length === 0 ? (
                    <span className="text-gray-500 italic">Aucun parent défini</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {liens[selectedConcept].map(parent => (
                        <span
                          key={parent}
                          className="px-2 py-1 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/40 flex items-center gap-1"
                        >
                          {parent}
                          <button
                            onClick={() => onDeleteLink(selectedConcept, parent)}
                            className="text-gray-500 hover:text-rose-400 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Children */}
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[11px] text-gray-400 block mb-1.5 font-semibold">
                    Concepts Enfants (qui héritent de lui) :
                  </span>
                  {Object.keys(liens).filter(k => (liens[k] || []).includes(selectedConcept)).length === 0 ? (
                    <span className="text-gray-500 italic">Aucun enfant</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(liens)
                        .filter(k => (liens[k] || []).includes(selectedConcept))
                        .map(child => (
                          <span
                            key={child}
                            className="px-2 py-1 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 flex items-center gap-1"
                          >
                            {child}
                            <button
                              onClick={() => onDeleteLink(child, selectedConcept)}
                              className="text-gray-500 hover:text-rose-400 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Link form */}
              <form onSubmit={handleAddLinkSubmit} className="pt-1 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Lier "${selectedConcept}" comme enfant de (ex: oiseau, mammifère)...`}
                  value={newLinkTarget}
                  onChange={e => setNewLinkTarget(e.target.value)}
                  className="flex-1 bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  type="submit"
                  disabled={!newLinkTarget.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Lier</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
              <Brain className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Graphe Cognitif de KADERBOT</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Sélectionne un concept dans la colonne de gauche pour inspecter sa chaîne de déduction, ses
              liens taxonomiques et ses poids de mémoire.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

```

---

## 📄 Fichier : `src/components/RulesTab.tsx`

```typescript
import React, { useState } from 'react';
import {
  Scale,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  ArrowRight,
} from 'lucide-react';
import {
  GeneralRule,
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';
import {
  deduireChaine,
  deduireGeneralisation,
  construirePhraseGeneralisation,
} from '../core/cognitiveEngine';

interface RulesTabProps {
  memoire: MemoryStore;
  regles: RulesStore;
  liens: LinksStore;
  synonymes: SynonymsStore;
  onAddRule: (
    quant: 'tous' | 'aucun' | 'certains',
    sujet: string,
    prop: string,
    poids?: number
  ) => void;
  onDeleteRule: (sujet: string, prop: string) => void;
}

export const RulesTab: React.FC<RulesTabProps> = ({
  memoire,
  regles,
  liens,
  synonymes,
  onAddRule,
  onDeleteRule,
}) => {
  // Simulator state
  const [testSujet, setTestSujet] = useState('moineau');
  const [testProp, setTestProp] = useState('respire');
  const [simulationResult, setSimulationResult] = useState<string | null>(null);

  // Form state
  const [newQuant, setNewQuant] = useState<'tous' | 'aucun' | 'certains'>('tous');
  const [newSujet, setNewSujet] = useState('');
  const [newProp, setNewProp] = useState('');

  const handleSimulate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testSujet.trim() || !testProp.trim()) return;

    const s = testSujet.trim().toLowerCase();
    const p = testProp.trim().toLowerCase();

    // 1. Try generalization syllogism
    const gen = deduireGeneralisation(s, p, memoire, regles, liens, synonymes);
    if (gen) {
      const phrase = construirePhraseGeneralisation(
        s,
        gen.categorie,
        gen.quant,
        gen.prop,
        gen.confiance,
        gen.chemin
      );
      setSimulationResult(phrase);
      return;
    }

    // 2. Try direct property deduction through links
    const chaine = deduireChaine(s, p, memoire, regles, liens, synonymes);
    if (chaine && chaine.propriete_def && chaine.propriete_source) {
      setSimulationResult(
        `${s.charAt(0).toUpperCase() + s.slice(1)} hérite de "${chaine.propriete_source}" qui ${chaine.propriete_def}. Donc ${s} ${p} (confiance ${Math.round(chaine.confiance * 100)}%).`
      );
      return;
    }

    setSimulationResult(
      `Impossible de déduire que "${s}" a pour propriété "${p}". Aucune règle générale ni chaîne conceptuelle trouvée.`
    );
  };

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSujet.trim() || !newProp.trim()) return;
    onAddRule(newQuant, newSujet.trim(), newProp.trim());
    setNewSujet('');
    setNewProp('');
  };

  const allRulesList: Array<{
    sujet: string;
    quant: 'tous' | 'aucun' | 'certains';
    prop: string;
    poids: number;
    hits: number;
  }> = [];

  for (const [sujet, rList] of Object.entries(regles)) {
    for (const r of rList) {
      allRulesList.push({
        sujet,
        quant: r.quant,
        prop: r.prop,
        poids: r.poids,
        hits: r.hits,
      });
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#050508] space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            <span>Moteur d'Inférence & Syllogismes</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Règles logiques universelles et déductions causales inspirées des quantificateurs aristotéliciens.
          </p>
        </div>
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
          {allRulesList.length} règles actives
        </span>
      </div>

      {/* Syllogism Simulator Widget */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0E131F] to-[#0A0D15] border border-emerald-500/30 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Simulateur de Déduction Logique (Test de Syllogisme)
          </h3>
        </div>

        <form onSubmit={handleSimulate} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-[11px] text-gray-400 mb-1">Concept Sujet :</label>
            <input
              type="text"
              placeholder="Ex: moineau, aigle, python..."
              value={testSujet}
              onChange={e => setTestSujet(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="sm:col-span-5">
            <label className="block text-[11px] text-gray-400 mb-1">Propriété à vérifier :</label>
            <input
              type="text"
              placeholder="Ex: respire, vole, a des ailes..."
              value={testProp}
              onChange={e => setTestProp(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Tester</span>
            </button>
          </div>
        </form>

        {simulationResult && (
          <div className="p-3.5 rounded-xl bg-gray-900/90 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 leading-relaxed font-sans shadow-inner">
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono font-bold mb-1">
              Résultat de l’inférence :
            </div>
            {simulationResult}
          </div>
        )}
      </div>

      {/* Add new rule form */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-3">
        <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Enseigner une Règle Générale à KADERBOT</span>
        </h3>

        <form onSubmit={handleAddRuleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-3">
            <label className="block text-[11px] text-gray-400 mb-1">Quantificateur :</label>
            <select
              value={newQuant}
              onChange={e => setNewQuant(e.target.value as any)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
            >
              <option value="tous">Tous les (Universel +)</option>
              <option value="aucun">Aucun (Universel -)</option>
              <option value="certains">Certains (Particulier)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[11px] text-gray-400 mb-1">Catégorie / Sujet :</label>
            <input
              type="text"
              placeholder="Ex: oiseau, poisson..."
              value={newSujet}
              onChange={e => setNewSujet(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[11px] text-gray-400 mb-1">Propriété :</label>
            <input
              type="text"
              placeholder="Ex: a des ailes, vit dans l'eau..."
              value={newProp}
              onChange={e => setNewProp(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!newSujet.trim() || !newProp.trim()}
              className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </form>
      </div>

      {/* Rules Grid */}
      <div className="space-y-3">
        <h3 className="text-xs sm:text-sm font-bold text-white">Règles Enregistrées en Mémoire</h3>

        {allRulesList.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500 bg-[#0E131F] rounded-2xl border border-gray-800">
            Aucune règle générale enregistrée pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allRulesList.map((r, idx) => {
              const isTous = r.quant === 'tous';
              const isAucun = r.quant === 'aucun';
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#0E131F] border border-gray-800/80 hover:border-gray-700 transition flex items-center justify-between gap-3 shadow-md"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                          isTous
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                            : isAucun
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                        }`}
                      >
                        {r.quant}
                      </span>
                      <span className="text-xs font-bold text-white capitalize">{r.sujet}s</span>
                    </div>

                    <p className="text-xs text-gray-300">
                      {isAucun ? `ne ${r.prop} pas` : r.prop}
                    </p>

                    <span className="text-[10px] text-gray-500 font-mono mt-1 inline-block">
                      Confiance : {Math.round(r.poids * 100)}% · Hits: {r.hits}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteRule(r.sujet, r.prop)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-gray-800 transition"
                    title="Supprimer cette règle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

```

---

## 📄 Fichier : `src/components/ToolsTab.tsx`

```typescript
import React, { useState } from 'react';
import {
  Lightbulb,
  Languages,
  CheckCheck,
  FileText,
  Sparkles,
  Copy,
  Check,
  Download,
  Volume2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { STYLES_IDEES } from '../core/cognitiveEngine';
import { apiService } from '../services/apiService';
import { AppConfig, IdeaItem } from '../types/kaderbot';

interface ToolsTabProps {
  config: AppConfig;
  onSaveToMemory: (sujet: string, def: string) => void;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({ config, onSaveToMemory }) => {
  const [activeTool, setActiveTool] = useState<'idees' | 'traduction' | 'correction' | 'resume'>('idees');

  // Ideas Generator state
  const [themeInput, setThemeInput] = useState('');
  const [ideasCount, setIdeasCount] = useState(5);
  const [selectedStyle, setSelectedStyle] = useState('creatif');
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [ideasResult, setIdeasResult] = useState<IdeaItem[]>([]);
  const [developingId, setDevelopingId] = useState<number | null>(null);

  // Translation state
  const [transInput, setTransInput] = useState('');
  const [transLang, setTransLang] = useState('English');
  const [transResult, setTransResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // Correction state
  const [corrigeInput, setCorrigeInput] = useState('');
  const [corrigeResult, setCorrigeResult] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  // Summary state
  const [resumeInput, setResumeInput] = useState('');
  const [resumeResult, setResumeResult] = useState('');
  const [isResuming, setIsResuming] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleGenerateIdeas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeInput.trim() || isGeneratingIdeas) return;
    setIsGeneratingIdeas(true);
    try {
      const styleDesc = STYLES_IDEES[selectedStyle] || STYLES_IDEES.creatif;
      const text = await apiService.genererIdees({
        theme: themeInput.trim(),
        count: ideasCount,
        style: selectedStyle,
        styleDesc,
        provider: config.provider,
        groqModel: config.groqModel,
      });

      const lines = text
        .split('\n')
        .map(l => l.replace(/^\s*(\d+[\.\)\-:]\s*|[\-\*]\s*)/, '').trim())
        .filter(Boolean);

      const items: IdeaItem[] = lines.map((title, idx) => ({
        id: idx + 1,
        title,
        theme: themeInput.trim(),
        style: selectedStyle,
        timestamp: new Date().toLocaleTimeString(),
      }));

      setIdeasResult(items);
    } catch (err: any) {
      alert(`Erreur génération idées : ${err.message}`);
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleDevelopIdea = async (idea: IdeaItem) => {
    setDevelopingId(idea.id);
    try {
      const prompt = `Développe cette idée en 3 à 4 phrases concrètes, claires et inspirantes : "${idea.title}".`;
      const res = await apiService.chat({
        prompt,
        history: [],
        provider: config.provider,
        groqModel: config.groqModel,
      });

      setIdeasResult(prev =>
        prev.map(it => (it.id === idea.id ? { ...it, developedText: res.text } : it))
      );

      // Save to memory
      onSaveToMemory(`idee_${idea.id}_${idea.theme.slice(0, 15)}`, `${idea.title} -> ${res.text.slice(0, 180)}`);
    } catch (err: any) {
      alert(`Erreur développement idée : ${err.message}`);
    } finally {
      setDevelopingId(null);
    }
  };

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transInput.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      const result = await apiService.traduire({
        text: transInput.trim(),
        targetLang: transLang,
        provider: config.provider,
        groqModel: config.groqModel,
      });
      setTransResult(result);
    } catch (err: any) {
      alert(`Erreur traduction : ${err.message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCorrige = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corrigeInput.trim() || isCorrecting) return;
    setIsCorrecting(true);
    try {
      const result = await apiService.corriger({
        text: corrigeInput.trim(),
        provider: config.provider,
        groqModel: config.groqModel,
      });
      setCorrigeResult(result);
    } catch (err: any) {
      alert(`Erreur correction : ${err.message}`);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeInput.trim() || isResuming) return;
    setIsResuming(true);
    try {
      const result = await apiService.resumer({
        text: resumeInput.trim(),
        provider: config.provider,
        groqModel: config.groqModel,
      });
      setResumeResult(result);
    } catch (err: any) {
      alert(`Erreur résumé : ${err.message}`);
    } finally {
      setIsResuming(false);
    }
  };

  const languagesList = [
    { label: 'Anglais', val: 'English' },
    { label: 'Arabe', val: 'Arabic' },
    { label: 'Espagnol', val: 'Spanish' },
    { label: 'Allemand', val: 'German' },
    { label: 'Italien', val: 'Italian' },
    { label: 'Portugais', val: 'Portuguese' },
    { label: 'Russe', val: 'Russian' },
    { label: 'Chinois', val: 'Chinese' },
    { label: 'Japonais', val: 'Japanese' },
    { label: 'Coréen', val: 'Korean' },
    { label: 'Peul (Fula)', val: 'Fula' },
    { label: 'Bambara', val: 'Bambara' },
    { label: 'Wolof', val: 'Wolof' },
    { label: 'Swahili', val: 'Swahili' },
    { label: 'Turc', val: 'Turkish' },
    { label: 'Néerlandais', val: 'Dutch' },
    { label: 'Français', val: 'French' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#050508] max-w-5xl mx-auto space-y-6">
      {/* Sub-nav tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#090B10] border border-gray-800 overflow-x-auto">
        <button
          onClick={() => setActiveTool('idees')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'idees'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          <span>Générateur d'Idées</span>
        </button>

        <button
          onClick={() => setActiveTool('traduction')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'traduction'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Languages className="w-4 h-4" />
          <span>Traducteur Universel</span>
        </button>

        <button
          onClick={() => setActiveTool('correction')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'correction'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <CheckCheck className="w-4 h-4" />
          <span>Correcteur Express</span>
        </button>

        <button
          onClick={() => setActiveTool('resume')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'resume'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Résumeur Automatique</span>
        </button>
      </div>

      {/* 1. IDEAS TOOL */}
      {activeTool === 'idees' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-emerald-400" />
              <span>Brainstorming & Générateur d'Idées Multi-Styles</span>
            </h3>

            <form onSubmit={handleGenerateIdeas} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Thème ou sujet :</label>
                <input
                  type="text"
                  placeholder="Ex: Application mobile d'IA, Projet écologique, Histoire de science-fiction..."
                  value={themeInput}
                  onChange={e => setThemeInput(e.target.value)}
                  className="w-full bg-[#161822] border border-gray-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Style selector */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Style d'idéation :</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(STYLES_IDEES).map(styleKey => (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => setSelectedStyle(styleKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize border transition ${
                        selectedStyle === styleKey
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {styleKey}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Nombre d'idées :</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={ideasCount}
                    onChange={e => setIdeasCount(Number(e.target.value))}
                    className="accent-emerald-500"
                  />
                  <span className="font-mono text-xs font-bold text-emerald-400 w-4">{ideasCount}</span>
                </div>

                <button
                  type="submit"
                  disabled={!themeInput.trim() || isGeneratingIdeas}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isGeneratingIdeas ? 'Génération en cours...' : 'Générer les idées'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Results list */}
          {ideasResult.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">Idées générées pour "{themeInput}" :</h4>
                <button
                  onClick={() =>
                    handleCopy('all_ideas', ideasResult.map(i => `${i.id}. ${i.title}`).join('\n'))
                  }
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Tout copier</span>
                </button>
              </div>

              <div className="space-y-3">
                {ideasResult.map(idea => (
                  <div
                    key={idea.id}
                    className="p-4 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-2.5 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-emerald-950 border border-emerald-800/40 text-emerald-400 font-mono text-xs flex items-center justify-center flex-shrink-0 font-bold">
                          {idea.id}
                        </span>
                        <p className="text-xs sm:text-sm font-medium text-gray-100">{idea.title}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleCopy(`idea_${idea.id}`, idea.title)}
                          className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                          title="Copier l'idée"
                        >
                          {copiedKey === `idea_${idea.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDevelopIdea(idea)}
                          disabled={developingId === idea.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition"
                        >
                          {developingId === idea.id ? 'Développement...' : 'Développer →'}
                        </button>
                      </div>
                    </div>

                    {idea.developedText && (
                      <div className="p-3 rounded-xl bg-gray-900/80 border border-emerald-500/25 text-xs text-gray-300 leading-relaxed font-sans">
                        <div className="text-[10px] text-emerald-400 font-mono font-bold mb-1">
                          Approfondissement mémorisé dans le graphe :
                        </div>
                        {idea.developedText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. TRANSLATOR TOOL */}
      {activeTool === 'traduction' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-cyan-400" />
              <span>Traducteur Polyglotte (18+ langues)</span>
            </h3>

            <form onSubmit={handleTranslate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Texte à traduire :</label>
                <textarea
                  rows={4}
                  placeholder="Écris ou colle ton texte ici..."
                  value={transInput}
                  onChange={e => setTransInput(e.target.value)}
                  className="w-full bg-[#161822] border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Langue cible :</span>
                  <select
                    value={transLang}
                    onChange={e => setTransLang(e.target.value)}
                    className="bg-[#161822] border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                  >
                    {languagesList.map(lang => (
                      <option key={lang.val} value={lang.val}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!transInput.trim() || isTranslating}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-cyan-950/40"
                >
                  {isTranslating ? 'Traduction en cours...' : 'Traduire'}
                </button>
              </div>
            </form>
          </div>

          {transResult && (
            <div className="p-4 rounded-2xl bg-[#0E131F] border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">Traduction ({transLang}) :</span>
                <button
                  onClick={() => handleCopy('trad', transResult)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  {copiedKey === 'trad' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-sm text-gray-100 whitespace-pre-wrap">{transResult}</p>
            </div>
          )}
        </div>
      )}

      {/* 3. CORRECTEUR TOOL */}
      {activeTool === 'correction' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-purple-400" />
              <span>Correcteur Orthographique & Grammatical</span>
            </h3>

            <form onSubmit={handleCorrige} className="space-y-3">
              <textarea
                rows={4}
                placeholder="Colle ton texte contenant des fautes à corriger..."
                value={corrigeInput}
                onChange={e => setCorrigeInput(e.target.value)}
                className="w-full bg-[#161822] border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!corrigeInput.trim() || isCorrecting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-purple-950/40"
                >
                  {isCorrecting ? 'Correction en cours...' : 'Corriger le texte'}
                </button>
              </div>
            </form>
          </div>

          {corrigeResult && (
            <div className="p-4 rounded-2xl bg-[#0E131F] border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400">Texte corrigé :</span>
                <button
                  onClick={() => handleCopy('corrige', corrigeResult)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  {copiedKey === 'corrige' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-sm text-gray-100 whitespace-pre-wrap">{corrigeResult}</p>
            </div>
          )}
        </div>
      )}

      {/* 4. RESUMEUR TOOL */}
      {activeTool === 'resume' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Résumeur Automatique de Textes Longs</span>
            </h3>

            <form onSubmit={handleResume} className="space-y-3">
              <textarea
                rows={5}
                placeholder="Colle un article, une leçon ou un long paragraphe à résumer..."
                value={resumeInput}
                onChange={e => setResumeInput(e.target.value)}
                className="w-full bg-[#161822] border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!resumeInput.trim() || isResuming}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-amber-950/40"
                >
                  {isResuming ? 'Synthèse en cours...' : 'Générer le résumé'}
                </button>
              </div>
            </form>
          </div>

          {resumeResult && (
            <div className="p-4 rounded-2xl bg-[#0E131F] border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">Résumé concis :</span>
                <button
                  onClick={() => handleCopy('resume', resumeResult)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  {copiedKey === 'resume' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">{resumeResult}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

```

---

## 📄 Fichier : `src/components/SessionsTab.tsx`

```typescript
import React, { useState } from 'react';
import {
  FolderTree,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Plus,
  Check,
  FileCode,
  Smartphone,
  Brain,
  Sparkles,
} from 'lucide-react';
import {
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';
import { decayMemoire } from '../core/cognitiveEngine';
import { apiService } from '../services/apiService';

interface SessionsTabProps {
  sessions: string[];
  activeSession: string;
  onSelectSession: (s: string) => void;
  onCreateSession: (name: string) => void;
  memoire: MemoryStore;
  regles: RulesStore;
  liens: LinksStore;
  synonymes: SynonymsStore;
  onUpdateMemory: (newMemo: MemoryStore, newRegles: RulesStore) => void;
  onImportFullBackup: (data: {
    memoire: MemoryStore;
    regles: RulesStore;
    liens: LinksStore;
  }) => void;
  groqApiKey?: string;
  groqModel?: string;
}

export const SessionsTab: React.FC<SessionsTabProps> = ({
  sessions,
  activeSession,
  onSelectSession,
  onCreateSession,
  memoire,
  regles,
  liens,
  synonymes,
  onUpdateMemory,
  onImportFullBackup,
  groqApiKey,
  groqModel,
}) => {
  const [newSessionName, setNewSessionName] = useState('');
  const [decayReport, setDecayReport] = useState<{ modifs: number; supprimes: number } | null>(null);
  const [isExportingPydroid, setIsExportingPydroid] = useState(false);

  const handleCreateSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSessionName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || sessions.includes(clean)) return;
    onCreateSession(clean);
    setNewSessionName('');
  };

  const handleRunDecay = () => {
    const res = decayMemoire(memoire, regles, 7, 0.98);
    onUpdateMemory({ ...memoire }, { ...regles });
    setDecayReport(res);
  };

  const handleDownloadPydroid = async (mode: 'console' | 'gui' | 'auto' = 'console') => {
    setIsExportingPydroid(true);
    try {
      const blob = await apiService.downloadPydroidScript({
        memoire,
        regles,
        liens,
        groqApiKey,
        groqModel,
        mode,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = mode === 'console' ? 'terminal' : mode === 'gui' ? 'tkinter' : 'auto';
      a.download = `kaderbot_v14_pydroid_${suffix}_${activeSession}.py`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Erreur export script : ${err.message}`);
    } finally {
      setIsExportingPydroid(false);
    }
  };

  const handleExportJSON = () => {
    const data = {
      version: '14.0',
      activeSession,
      exportedAt: new Date().toISOString(),
      memoire,
      regles,
      liens,
      synonymes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kaderbot_backup_${activeSession}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (json.memoire || json.regles) {
          onImportFullBackup({
            memoire: json.memoire || {},
            regles: json.regles || {},
            liens: json.liens || {},
          });
          alert('Sauvegarde importée avec succès dans la session active !');
        } else {
          alert('Fichier JSON invalide pour KADERBOT.');
        }
      } catch (err) {
        alert('Erreur lors du décodage du fichier JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#050508] max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-teal-400" />
            <span>Gestion des Sessions & Exportation Pydroid 3</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Bascule entre différentes mémoires isolées, lance l'oubli intelligent et exporte ton code pour Android.
          </p>
        </div>
      </div>

      {/* 1. Android Pydroid 3 Sync Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0E131F] to-[#0A121A] border border-cyan-500/30 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Exporter vers Pydroid 3 (Android)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800/40 text-emerald-300">
                  Version V14 Corrigée Anti-Crash
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Deux formats d'exécution prêts à l'emploi selon la configuration de votre application Pydroid 3 sur mobile.
              </p>
            </div>
          </div>
        </div>

        {/* Action cards: Mode Console vs Mode Tkinter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Card 1: Console / Terminal (Recommandé Pydroid 3) */}
          <div className="p-4 rounded-xl bg-[#090D18] border border-emerald-500/30 hover:border-emerald-500/60 transition flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Mode Console / Terminal (Recommandé)</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                  100% Garanti
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Tourne <strong>nativement</strong> dans la fenêtre noire de Pydroid 3. Zéro plugin requis, dialogue fluide, saisie <code>[Toi] &gt;</code>, déduction causale, apprentissage et appel Groq.
              </p>
            </div>
            <button
              onClick={() => handleDownloadPydroid('console')}
              disabled={isExportingPydroid}
              className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <FileCode className="w-4 h-4" />
              <span>{isExportingPydroid ? 'Génération...' : 'Télécharger Mode Terminal (Recommandé)'}</span>
            </button>
          </div>

          {/* Card 2: Tkinter GUI */}
          <div className="p-4 rounded-xl bg-[#090D18] border border-cyan-500/30 hover:border-cyan-500/60 transition flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>Mode Graphique Tkinter</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                  Fenêtre Graphique
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Tente d'ouvrir la fenêtre Tkinter. <strong>Sécurité anti-crash</strong> : si Pydroid 3 n'a pas le plugin Tkinter installé, il bascule automatiquement sur le terminal !
              </p>
            </div>
            <button
              onClick={() => handleDownloadPydroid('gui')}
              disabled={isExportingPydroid}
              className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-cyan-950/40 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <FileCode className="w-4 h-4" />
              <span>{isExportingPydroid ? 'Génération...' : 'Télécharger Mode Graphique Tkinter'}</span>
            </button>
          </div>
        </div>

        {/* Diagnostics & Explications */}
        <div className="bg-[#07090F] p-3.5 rounded-xl border border-gray-800 text-xs text-gray-300 space-y-2">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold text-xs">
            <Smartphone className="w-4 h-4" />
            <span>Pourquoi Tkinter ne s'ouvrait pas et comment le résoudre :</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-400">
            <li>
              <strong>Pydroid 3 n'inclut pas Tkinter par défaut</strong> : Sur Android, Tkinter dépend d'un serveur X11. Sans le plugin <em>&ldquo;Pydroid repository plugin&rdquo;</em> (disponible sur le Play Store), Python plante dès <code>import tkinter</code>.
            </li>
            <li>
              <strong>Le Mode Terminal (Console) est la solution idéale</strong> : Il s'exécute directement dans la console native de Pydroid 3, sans aucun plugin externe, avec toutes les capacités cognitives de KaderBot.
            </li>
            <li>
              <strong>Sécurité Base64</strong> : Les données étaient précédemment sujettes à des erreurs de parsing JSON (<code>null</code> au lieu de <code>None</code>). C'est désormais 100% corrigé.
            </li>
          </ul>
        </div>
      </div>

      {/* 2. Package Web Complet pour Transformation en Application Mobile (APK) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#120F24] to-[#0A0D18] border border-purple-500/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Code Source Web Complet (ZIP) pour App Mobile</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-800/40 text-purple-300">
                  Prêt pour Outil Dédié (APK / iOS)
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Téléchargez l'intégralité du projet web (Vite, React, Moteur Cognitif, UI et bundle compilé <code>dist/</code>) en un seul clic.
              </p>
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-[#090714] rounded-xl border border-purple-500/20 text-xs text-gray-300 space-y-2">
          <div className="font-semibold text-purple-300 flex items-center gap-2">
            <span>Comment le transformer en application mobile avec votre outil dédié :</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-400">
            <li><strong>Avec WebIntoApp / Website 2 APK :</strong> Importez le dossier <code>dist/</code> inclus dans l'archive ZIP pour générer directement un fichier APK installable sur n'importe quel smartphone Android.</li>
            <li><strong>Avec Capacitor / Cordova :</strong> Décompressez l'archive, lancez <code>npm install && npx cap add android</code> pour obtenir un projet natif Android Studio.</li>
            <li><strong>Installation PWA directe :</strong> Vous pouvez aussi installer l'application immédiatement depuis le navigateur Chrome via le menu ou l'icône d'installation dans la barre d'adresse.</li>
          </ul>
        </div>

        <a
          href="/api/export-project-zip"
          download="kaderbot-projet-web-complet.zip"
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2.5 transition active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Télécharger le Projet Web Complet (.ZIP)</span>
        </a>
      </div>

      {/* 2. Sessions Management */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-emerald-400" />
          <span>Profils & Sessions de Mémoire</span>
        </h3>

        {/* Sessions list */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {sessions.map(s => {
            const isActive = activeSession === s;
            return (
              <div
                key={s}
                onClick={() => onSelectSession(s)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  isActive
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-md'
                    : 'bg-gray-900/60 border-gray-800 text-gray-300 hover:bg-gray-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-emerald-400' : 'bg-gray-600'
                    }`}
                  />
                  <span className="text-xs font-bold capitalize">{s}</span>
                </div>
                {isActive && (
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/40">
                    Active
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Create new session form */}
        <form onSubmit={handleCreateSessionSubmit} className="pt-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="Nom d'une nouvelle session (ex: physique, histoire, perso)..."
            value={newSessionName}
            onChange={e => setNewSessionName(e.target.value)}
            className="flex-1 bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            type="submit"
            disabled={!newSessionName.trim()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Créer session</span>
          </button>
        </form>
      </div>

      {/* 3. Intelligent Decay (Oubli intelligent de la V13) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Mécanisme d'Oubli Intelligent (Decay)</h3>
          </div>
          <button
            onClick={handleRunDecay}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition"
          >
            Lancer l'oubli maintenant
          </button>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          Comme dans le cerveau humain, les faits peu utilisés ou mémorisés il y a plus de 7 jours voient leur coefficient de certitude diminuer progressivement. Les connaissances erronées ou obsolètes finissent par disparaître naturellement.
        </p>

        {decayReport && (
          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-200">
            Résultat de l’oubli : <strong>{decayReport.modifs}</strong> faits recalculés à la baisse,{' '}
            <strong>{decayReport.supprimes}</strong> faits obsolètes purgés.
          </div>
        )}
      </div>

      {/* 4. Backup & Restore JSON */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Sauvegarde & Restauration JSON</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Exportez l’intégralité de la base de données cognitive pour la conserver ou la transférer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter JSON</span>
          </button>

          <label className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5" />
            <span>Importer JSON</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};

```

---

## 📄 Fichier : `src/components/SettingsModal.tsx`

```typescript
import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Key,
  Check,
  Sliders,
  Volume2,
  BookOpen,
  Activity,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { AppConfig, LLMProvider } from '../types/kaderbot';
import { apiService } from '../services/apiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: Partial<AppConfig>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [provider, setProvider] = useState<LLMProvider>(config.provider);
  const [geminiKey, setGeminiKey] = useState(config.geminiApiKey || '');
  const [groqKey, setGroqKey] = useState(config.groqApiKey || '');
  const [groqModel, setGroqModel] = useState(
    config.groqModel === 'llama-3.3-70b-versatile'
      ? 'openai/gpt-oss-120b'
      : config.groqModel || 'openai/gpt-oss-120b'
  );
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [soundEnabled, setSoundEnabled] = useState(config.soundEnabled);
  const [autoLearn, setAutoLearn] = useState(config.autoLearnFromLLM);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Connection tester states
  const [isTestingGroq, setIsTestingGroq] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    model?: string;
    latencyMs?: number;
  } | null>(null);

  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{
    ok: boolean;
    message: string;
    model?: string;
    latencyMs?: number;
  } | null>(null);

  // Sync state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setProvider(config.provider);
      setGeminiKey(config.geminiApiKey || '');
      setGroqKey(config.groqApiKey || '');
      setGroqModel(
        config.groqModel === 'llama-3.3-70b-versatile'
          ? 'openai/gpt-oss-120b'
          : config.groqModel || 'openai/gpt-oss-120b'
      );
      setSystemPrompt(config.systemPrompt);
      setSoundEnabled(config.soundEnabled);
      setAutoLearn(config.autoLearnFromLLM);
      setTestResult(null);
      setGeminiTestResult(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult(null);

    try {
      const res = await apiService.testGeminiConnection(geminiKey.trim());
      if (res.ok) {
        setGeminiTestResult({
          ok: true,
          message: `Connecté à Gemini (${res.model}) avec succès ! Latence : ${res.latencyMs}ms.`,
          model: res.model,
          latencyMs: res.latencyMs,
        });
      } else {
        setGeminiTestResult({
          ok: false,
          message: res.error || 'Erreur de connexion Gemini',
        });
      }
    } catch (e: any) {
      setGeminiTestResult({
        ok: false,
        message: e.message || 'Impossible de joindre le serveur de test',
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleTestGroq = async () => {
    setIsTestingGroq(true);
    setTestResult(null);

    try {
      const res = await apiService.testGroqConnection(groqKey.trim() || undefined, groqModel);
      if (res.ok) {
        setTestResult({
          ok: true,
          message: `Connecté à Groq avec succès ! Latence : ${res.latencyMs}ms.`,
          model: res.model,
          latencyMs: res.latencyMs,
        });
      } else {
        setTestResult({
          ok: false,
          message: res.error || 'Erreur de connexion Groq',
        });
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        message: e.message || 'Impossible de joindre le serveur de test',
      });
    } finally {
      setIsTestingGroq(false);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      provider,
      geminiApiKey: geminiKey.trim(),
      groqApiKey: groqKey.trim(),
      groqModel,
      systemPrompt,
      soundEnabled,
      autoLearnFromLLM: autoLearn,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0E131F] border border-gray-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800/80 bg-[#090B10]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Paramètres KADERBOT NOVA</h2>
              <p className="text-[11px] text-gray-400">Configuration du cerveau hybride & des moteurs IA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs text-gray-300">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-semibold text-white mb-2">
              Moteur d'Intelligence Artificielle Actif
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'gemini'
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm shadow-emerald-500/10'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-emerald-400 text-xs">Gemini 3.8 Flash</span>
                  {provider === 'gemini' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-gray-400">
                  Prêt à l'emploi. Aucun réglage de clé requis, ultra-rapide et gratuit.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProvider('groq')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'groq'
                    ? 'bg-amber-950/40 border-amber-500/60 text-white shadow-sm shadow-amber-500/10'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-amber-400 text-xs">Groq API</span>
                  {provider === 'groq' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <p className="text-[10px] text-gray-400">
                  Supporte GPT-OSS 120B & Llama. Requiert une clé API Groq gratuite.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProvider('local_only')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'local_only'
                    ? 'bg-blue-950/40 border-blue-500/60 text-white shadow-sm shadow-blue-500/10'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-blue-400 text-xs">100% Local</span>
                  {provider === 'local_only' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <p className="text-[10px] text-gray-400">
                  Graphe de mémoire, règles et déductions logiques sans aucun appel réseau.
                </p>
              </button>
            </div>
          </div>

          {/* Gemini Configuration Section */}
          {provider === 'gemini' && (
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                  <Key className="w-4 h-4" />
                  <span>Configuration Gemini (Google AI Studio)</span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-emerald-400/80 hover:text-emerald-300 underline flex items-center gap-1"
                >
                  <span>Obtenir une clé gratuite</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Clé API Gemini (Optionnelle) :</label>
                <input
                  type="password"
                  placeholder="AIzaSy... (laisser vide pour utiliser la clé serveur)"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Si non renseignée, le serveur utilise automatiquement sa propre variable d'environnement <code className="text-emerald-400 font-mono">GEMINI_API_KEY</code>.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={isTestingGemini}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{isTestingGemini ? 'Test en cours...' : 'Tester la connexion Gemini'}</span>
                </button>
              </div>

              {geminiTestResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                    geminiTestResult.ok
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                  }`}
                >
                  {geminiTestResult.ok ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{geminiTestResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Groq Configuration Section */}
          {provider === 'groq' && (
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                  <Key className="w-4 h-4" />
                  <span>Configuration Groq Cloud</span>
                </div>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-amber-400/80 hover:text-amber-300 underline flex items-center gap-1"
                >
                  <span>Obtenir une clé gratuite</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Clé API Groq :</label>
                <input
                  type="password"
                  placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={groqKey}
                  onChange={e => setGroqKey(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Modèle d'IA Groq :</label>
                <select
                  value={groqModel}
                  onChange={e => setGroqModel(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="openai/gpt-oss-120b">
                    openai/gpt-oss-120b (OpenAI GPT-OSS 120B - Très puissant & Grand modèle)
                  </option>
                  <option value="openai/gpt-oss-20b">
                    openai/gpt-oss-20b (OpenAI GPT-OSS 20B - Équilibré)
                  </option>
                  <option value="llama-3.1-8b-instant">
                    llama-3.1-8b-instant (Meta Llama 3.1 8B - Gratuit & Ultra-rapide)
                  </option>
                  <option value="llama-3.3-70b-specdec">
                    llama-3.3-70b-specdec (Meta Llama 3.3 70B SpecDec)
                  </option>
                  <option value="qwen/qwen3.8-27b">
                    qwen/qwen3.8-27b (Qwen 3.8 27B)
                  </option>
                  <option value="mixtral-8x7b-32768">
                    mixtral-8x7b-32768 (Mistral 8x7B)
                  </option>
                </select>
              </div>

              {/* Test Groq Connection Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestGroq}
                  disabled={isTestingGroq}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTestingGroq ? 'animate-spin' : ''}`} />
                  <span>{isTestingGroq ? 'Test en cours...' : 'Tester la connexion & le modèle'}</span>
                </button>

                {/* Test feedback */}
                {testResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-2 ${
                      testResult.ok
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {testResult.ok ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{testResult.ok ? 'Succès' : 'Échec du test'}</p>
                      <p className="opacity-90">{testResult.message}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Auto-learning toggle */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Apprentissage Automatique</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Lorsque l’IA répond, KADERBOT extrait automatiquement le sujet principal et enrichit son graphe de mémoire local avec un score de confiance adaptatif.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoLearn}
              onChange={e => setAutoLearn(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
            />
          </div>

          {/* Voice Speech toggle */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-900/60 border border-gray-800">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>Synthèse Vocale (Voix française)</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Lit à voix haute les réponses et déductions logiques de KADERBOT.
              </p>
            </div>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={e => setSoundEnabled(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
          </div>

          {/* System Prompt Customization */}
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              Instruction Système (Personnalité de KADERBOT)
            </label>
            <textarea
              rows={3}
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              className="w-full bg-[#090B10] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Définit le ton concis, chaleureux et curieux du bot tel qu'il a été programmé dans Pydroid 3.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800/80 bg-[#090B10] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium"
          >
            Fermer
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 ${
              savedSuccess
                ? 'bg-emerald-600'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-900/30'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Enregistré !</span>
              </>
            ) : (
              <span>Sauvegarder</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

```

---

## 📄 Fichier : `src/components/ActionMenuModal.tsx`

```typescript
import React, { useState } from 'react';
import {
  X,
  Database,
  GitBranch,
  Sparkles,
  Lightbulb,
  Languages,
  HelpCircle,
  FolderTree,
  Trash2,
  List,
  Search,
} from 'lucide-react';

interface ActionMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (cmd: string, executeImmediately?: boolean) => void;
}

export const ActionMenuModal: React.FC<ActionMenuModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('memoire');
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const categories = [
    { id: 'memoire', label: 'Mémoire', icon: Database, color: 'text-emerald-400' },
    { id: 'liens', label: 'Liens & Arbre', icon: GitBranch, color: 'text-cyan-400' },
    { id: 'groq', label: 'IA & LLM', icon: Sparkles, color: 'text-amber-400' },
    { id: 'idees', label: 'Idées', icon: Lightbulb, color: 'text-yellow-400' },
    { id: 'texte', label: 'Traduction & Texte', icon: Languages, color: 'text-purple-400' },
    { id: 'questions', label: 'Questions & Déduction', icon: HelpCircle, color: 'text-blue-400' },
    { id: 'sessions', label: 'Sessions', icon: FolderTree, color: 'text-teal-400' },
    { id: 'oubli', label: 'Oubli Intelligent', icon: Trash2, color: 'text-rose-400' },
    { id: 'divers', label: 'Divers & Stats', icon: List, color: 'text-gray-400' },
  ];

  const actionsMap: Record<
    string,
    Array<{ cmd: string; label: string; desc: string; immediate?: boolean }>
  > = {
    memoire: [
      { cmd: 'retiens: ', label: 'Retenir un fait', desc: 'Syntaxe: retiens: chat = un animal felin' },
      { cmd: 'retiens: tous les ', label: 'Règle universelle', desc: 'Syntaxe: retiens: tous les oiseaux volent' },
      { cmd: 'retiens: aucun ', label: 'Règle négative', desc: 'Syntaxe: retiens: aucun poisson ne respire dans lair' },
      { cmd: 'retiens: certains ', label: 'Règle particulière', desc: 'Syntaxe: retiens: certains chiens chassent' },
      { cmd: 'retiens masse: ', label: 'Retenir en masse', desc: 'Plusieurs faits séparés par des points' },
      { cmd: 'lister: memoire', label: 'Lister la mémoire', desc: 'Affiche tous les sujets mémorisés', immediate: true },
      { cmd: 'lister: poids', label: 'Lister les poids', desc: 'Affiche les coefficients de confiance', immediate: true },
      { cmd: 'lister: incertains', label: 'Concepts incertains', desc: 'Concepts avec confiance < 50%', immediate: true },
      { cmd: 'lister: regles', label: 'Lister les règles', desc: 'Affiche toutes les règles logiques', immediate: true },
    ],
    liens: [
      { cmd: 'lie: ', label: 'Lier deux concepts', desc: 'Syntaxe: lie: moineau -> oiseau' },
      { cmd: 'delie: ', label: 'Supprimer un lien', desc: 'Syntaxe: delie: moineau -> oiseau' },
      { cmd: 'liens: ', label: 'Inspecter les liens', desc: 'Affiche parents, enfants et chaîne' },
      { cmd: 'cousins: ', label: 'Ancêtres communs', desc: 'Syntaxe: cousins: moineau, aigle' },
    ],
    groq: [
      { cmd: 'groq: ', label: 'Interroger LLM direct', desc: 'Pose une question directe au modèle' },
      { cmd: 'groq on', label: 'Activer LLM Cloud', desc: 'Autorise les réponses étendues', immediate: true },
      { cmd: 'groq off', label: 'Désactiver LLM', desc: 'Mode cognitif 100% local', immediate: true },
      { cmd: 'groq statut', label: 'Statut du LLM', desc: 'Vérifie l’état de connexion', immediate: true },
      { cmd: 'contexte', label: 'Afficher contexte', desc: 'Affiche l’historique glissant', immediate: true },
      { cmd: 'reset contexte', label: 'Vider le contexte', desc: 'Réinitialise le fil de mémoire', immediate: true },
      { cmd: 'lister: groq', label: 'Logs des échanges', desc: 'Derniers apprentissages du LLM', immediate: true },
    ],
    idees: [
      { cmd: 'idees 5: ', label: '5 Idées créatives', desc: 'Génère 5 idées percutantes' },
      { cmd: 'idees 5 drole: ', label: '5 Idées drôles', desc: 'Idées humoristiques et décalées' },
      { cmd: 'idees 5 poetique: ', label: '5 Idées poétiques', desc: 'Idées imagées et sensibles' },
      { cmd: 'idees 5 absurde: ', label: '5 Idées absurdes', desc: 'Idées inattendues et loufoques' },
      { cmd: 'idee 1: ', label: 'Développer une idée', desc: 'Développe l’idée n°1 en détail' },
      { cmd: 'lister: idees', label: 'Historique des idées', desc: 'Affiche le fichier des idées générées', immediate: true },
    ],
    texte: [
      { cmd: 'traduis en anglais: ', label: 'Traduire en anglais', desc: 'Traduction automatique' },
      { cmd: 'traduis en arabe: ', label: 'Traduire en arabe', desc: 'Traduction automatique' },
      { cmd: 'traduis en espagnol: ', label: 'Traduire en espagnol', desc: 'Traduction automatique' },
      { cmd: 'corrige: ', label: 'Corriger un texte', desc: 'Orthographe, grammaire et ponctuation' },
      { cmd: 'resume: ', label: 'Résumer un texte', desc: 'Synthèse en 2-3 phrases' },
    ],
    questions: [
      { cmd: "c'est quoi ", label: "Qu'est-ce que c'est ?", desc: 'Définition exacte ou déduite' },
      { cmd: 'pourquoi ', label: 'Pourquoi ? (Déduction)', desc: 'Recherche la chaîne causale logique' },
      { cmd: 'parle-moi de ', label: 'Explication complète', desc: 'Tout ce que le bot sait du sujet' },
      { cmd: 'proche: ', label: 'Recherche floue', desc: 'Trouve les mots proches phonétiquement' },
      { cmd: 'chercher: ', label: 'Chercher dans la mémoire', desc: 'Recherche par mot-clé' },
    ],
    sessions: [
      { cmd: 'session active', label: 'Session courante', desc: 'Affiche la session active', immediate: true },
      { cmd: 'sessions', label: 'Toutes les sessions', desc: 'Liste les profils disponibles', immediate: true },
      { cmd: 'session defaut', label: 'Session défaut', desc: 'Recharge la base principale', immediate: true },
      { cmd: 'session ', label: 'Créer / Charger', desc: 'Syntaxe: session science' },
    ],
    oubli: [
      { cmd: 'oublier: ', label: 'Oublier un fait/sujet', desc: 'Syntaxe: oublier: sujet ou oublier: sujet = def' },
      { cmd: 'oublier en masse: ', label: 'Oublier plusieurs', desc: 'Séparer par des virgules ou points' },
    ],
    divers: [
      { cmd: 'lister: stats', label: 'Statistiques globales', desc: 'Mots, règles, graphe, mémoire', immediate: true },
      { cmd: 'synonymes: ', label: 'Gérer les synonymes', desc: 'Syntaxe: synonymes: auto = voiture | bagnole' },
      { cmd: 'lire: conversations', label: 'Lire les logs lisibles', desc: 'Derniers échanges de la conversation', immediate: true },
      { cmd: 'effacer conversations', label: 'Purger les logs', desc: 'Réinitialise le fichier lisible', immediate: true },
    ],
  };

  const handleActionClick = (cmd: string, immediate?: boolean) => {
    onSelectAction(cmd, immediate);
    onClose();
  };

  const currentActions = actionsMap[activeCategory] || [];
  const filteredActions = searchFilter
    ? Object.values(actionsMap)
        .flat()
        .filter(
          a =>
            a.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
            a.cmd.toLowerCase().includes(searchFilter.toLowerCase()) ||
            a.desc.toLowerCase().includes(searchFilter.toLowerCase())
        )
    : currentActions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0E131F] border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800/80 bg-[#090B10]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Menu des Commandes KADERBOT</h2>
              <p className="text-[11px] text-gray-400">Toutes les actions du script Python d’origine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-3 border-b border-gray-800/60 bg-gray-900/50">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrer une commande ou une action (ex: retiens, liens, groq...)"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full bg-[#090B10] border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Content body with sidebar categories */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar categories (hidden if searching) */}
          {!searchFilter && (
            <div className="w-44 sm:w-48 border-r border-gray-800/60 overflow-y-auto p-2 space-y-1 bg-[#090B10]/60 flex-shrink-0">
              {categories.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                      isActive
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${cat.color}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons list */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2">
            {filteredActions.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">
                Aucune commande ne correspond à votre recherche.
              </div>
            ) : (
              filteredActions.map((action, idx) => (
                <div
                  key={idx}
                  onClick={() => handleActionClick(action.cmd, action.immediate)}
                  className="group p-3 rounded-xl bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/80 hover:border-emerald-500/40 cursor-pointer transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        {action.cmd}
                      </code>
                      <span className="text-xs font-semibold text-white truncate">{action.label}</span>
                      {action.immediate && (
                        <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.5 rounded font-mono">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 truncate">{action.desc}</p>
                  </div>
                  <span className="text-xs font-medium text-emerald-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    Insérer →
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-gray-800/80 bg-[#090B10] flex items-center justify-between text-[11px] text-gray-400">
          <span>Clique sur une action pour l’insérer instantanément dans la barre de saisie.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

```

---
