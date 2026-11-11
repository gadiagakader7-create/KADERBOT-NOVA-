import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin racine du projet : deux niveaux au-dessus de src/server
export const PROJECT_ROOT = path.resolve(__dirname, '../../');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const MEMORY_FILE = path.join(DATA_DIR, 'kaderbot_storage.json');
export const BRAVE_USAGE_FILE = path.join(DATA_DIR, 'brave_usage.json');
export const NOTES_FILE = path.join(DATA_DIR, 'kaderbot_notes.json');
export const ACTION_LOG_FILE = path.join(DATA_DIR, 'kaderbot_action_logs.json');
export const EVENTS_FILE = path.join(DATA_DIR, 'kaderbot_events.json');

export type KaderbotNote = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type AgentActionLog = {
  id: string;
  tool: string;
  args?: Record<string, unknown>;
  status: 'success' | 'error' | 'rejected' | 'expired';
  message?: string;
  createdAt: string;
};

export type KaderbotEvent = {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  location?: string;
  description?: string;
  createdAt: string;
};

export interface StorageData {
  memoire: Record<string, any[]>;
  regles: Record<string, any[]>;
  liens: Record<string, string[]>;
  synonymes: Record<string, any>;
  sessions: string[];
  updatedAt?: string;
}

export function readStorageFile(): StorageData {
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
      return {
        memoire: parsed.memoire || {},
        regles: parsed.regles || {},
        liens: parsed.liens || {},
        synonymes: parsed.synonymes || {},
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : ['defaut'],
      };
    } catch (e) {
      console.warn('Erreur lecture kaderbot_storage.json:', e);
    }
  }
  return { memoire: {}, regles: {}, liens: {}, synonymes: {}, sessions: ['defaut'] };
}

export function writeStorageFile(data: any): void {
  try {
    fs.writeFileSync(
      MEMORY_FILE,
      JSON.stringify(
        {
          memoire: data.memoire || {},
          regles: data.regles || {},
          liens: data.liens || {},
          synonymes: data.synonymes || {},
          sessions: Array.isArray(data.sessions) ? data.sessions : ['defaut'],
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (err) {
    console.error('Erreur écriture kaderbot_storage.json:', err);
  }
}

export function readJsonArray<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`Erreur lecture ${filePath}:`, err);
    return [];
  }
}

export function writeJsonArray<T>(filePath: string, data: T[]): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function appendActionLog(entry: Omit<AgentActionLog, 'id' | 'createdAt'>): void {
  try {
    const logs = readJsonArray<AgentActionLog>(ACTION_LOG_FILE);
    logs.push({ ...entry, id: randomUUID(), createdAt: new Date().toISOString() });
    writeJsonArray(ACTION_LOG_FILE, logs.slice(-500));
  } catch (err) {
    console.warn('Erreur écriture journal agentique:', err);
  }
}

// Compteur d'appels Brave en mémoire (Map avec date du jour), persisté dans data/brave_usage.json
const braveDailyUsage = new Map<string, number>();

export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadBraveUsage(): void {
  const today = getTodayString();
  try {
    if (fs.existsSync(BRAVE_USAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(BRAVE_USAGE_FILE, 'utf-8'));
      if (data && data.date === today && typeof data.count === 'number') {
        braveDailyUsage.set(today, data.count);
        return;
      }
    }
  } catch (err) {
    console.warn('Erreur lecture brave_usage.json:', err);
  }
  braveDailyUsage.set(today, 0);
}

export function checkAndIncrementBraveQuota(maxCallsPerDay = 100): boolean {
  const today = getTodayString();
  if (!braveDailyUsage.has(today)) {
    loadBraveUsage();
  }
  const currentCount = braveDailyUsage.get(today) || 0;
  if (currentCount >= maxCallsPerDay) {
    return false; // Quota de recherche atteint pour aujourd'hui
  }
  const newCount = currentCount + 1;
  braveDailyUsage.set(today, newCount);
  try {
    fs.writeFileSync(
      BRAVE_USAGE_FILE,
      JSON.stringify({ date: today, count: newCount, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn('Erreur persistance brave_usage.json:', err);
  }
  return true;
}

// Initialisation au chargement
loadBraveUsage();
