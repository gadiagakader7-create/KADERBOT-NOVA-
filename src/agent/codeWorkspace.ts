import { readWorkspacePatchesFile, writeWorkspacePatchesFile } from '../server/storage';

export type WorkspaceFolder = '/workspace/generated/' | '/workspace/patches/' | '/workspace/tests/';

export interface WorkspaceFileEntry {
  path: string;
  content: string;
  size: number;
  updatedAt: string;
}

export interface WorkspacePatchTestResult {
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  testedAt: string;
}

export interface WorkspacePatch {
  patchId: string;
  originalPath: string;
  diff: string;
  original: string;
  nouveau: string;
  status: 'en_attente' | 'validé' | 'rejeté' | 'appliqué';
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  rejectionReason?: string;
  testResult?: WorkspacePatchTestResult;
}

export interface WorkspaceTestResult {
  id: string;
  language: 'python' | 'javascript';
  label: string;
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  filesCreated: Array<{ path: string; content: string }>;
  createdAt: string;
}

export const WORKSPACE_FOLDERS: readonly WorkspaceFolder[] = [
  '/workspace/generated/',
  '/workspace/patches/',
  '/workspace/tests/',
] as const;

// Stockage strictement virtuel en mémoire pour /workspace/ (aucun accès disque serveur)
const workspaceStore = new Map<string, string>();
const workspaceMeta = new Map<string, { updatedAt: string }>();

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function normalizeWorkspacePath(rawPath: string, defaultFolder: WorkspaceFolder = '/workspace/generated/'): string {
  const cleaned = String(rawPath || '').trim().replace(/\\/g, '/');
  if (!cleaned) {
    throw new Error('Chemin virtuel /workspace/ vide.');
  }
  if (cleaned.includes('..') || cleaned.includes('\0')) {
    throw new Error('Chemin virtuel invalide (traversée interdite).');
  }

  let normalized = cleaned.replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = normalized.startsWith('workspace/') ? `/${normalized}` : `${defaultFolder}${normalized}`;
  } else if (!normalized.startsWith('/workspace/')) {
    throw new Error('Accès restreint exclusivement au stockage virtuel /workspace/.');
  }

  if (normalized.endsWith('/')) {
    throw new Error('Le chemin doit pointer vers un fichier virtuel.');
  }

  const allowedPrefix = WORKSPACE_FOLDERS.some(folder => normalized.startsWith(folder));
  if (!allowedPrefix) {
    const fileName = normalized.slice('/workspace/'.length);
    if (!fileName || fileName.includes('/')) {
      throw new Error('Les fichiers doivent résider dans /workspace/generated/, /workspace/patches/ ou /workspace/tests/.');
    }
    normalized = `${defaultFolder}${fileName}`;
  }

  return normalized;
}

export function listFiles(prefix = '/workspace/'): WorkspaceFileEntry[] {
  const normPrefix = prefix.startsWith('/workspace') ? prefix : '/workspace/';
  const entries: WorkspaceFileEntry[] = [];
  for (const [filePath, content] of workspaceStore.entries()) {
    if (filePath.startsWith(normPrefix)) {
      entries.push({
        path: filePath,
        content,
        size: content.length,
        updatedAt: workspaceMeta.get(filePath)?.updatedAt || new Date().toISOString(),
      });
    }
  }
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readFile(filePath: string): string | null {
  const normalized = normalizeWorkspacePath(filePath);
  return workspaceStore.has(normalized) ? workspaceStore.get(normalized)! : null;
}

export function writeFile(filePath: string, content: string): WorkspaceFileEntry {
  const normalized = normalizeWorkspacePath(filePath);
  const safeContent = typeof content === 'string' ? content : String(content ?? '');
  const now = new Date().toISOString();
  workspaceStore.set(normalized, safeContent);
  workspaceMeta.set(normalized, { updatedAt: now });
  return {
    path: normalized,
    content: safeContent,
    size: safeContent.length,
    updatedAt: now,
  };
}

export function deleteFile(filePath: string): boolean {
  const normalized = normalizeWorkspacePath(filePath);
  workspaceMeta.delete(normalized);
  return workspaceStore.delete(normalized);
}

/**
 * Génère un diff lisible ligne par ligne (lignes supprimées '-', ajoutées '+').
 */
export function computeReadableDiff(originalPath: string, original: string, nouveau: string): string {
  const oldLines = (original ?? '').replace(/\r\n/g, '\n').split('\n');
  const newLines = (nouveau ?? '').replace(/\r\n/g, '\n').split('\n');

  const n = oldLines.length;
  const m = newLines.length;

  // Fallback linéaire si les fichiers sont très volumineux pour éviter une matrice O(n*m)
  if (n * m > 250000) {
    const header = [`--- a/${originalPath}`, `+++ b/${originalPath}`, `@@ -1,${n} +1,${m} @@`];
    const removed = oldLines.map(line => `- ${line}`);
    const added = newLines.map(line => `+ ${line}`);
    return [...header, ...removed, ...added].join('\n');
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const diffLines: string[] = [
    `--- a/${originalPath}`,
    `+++ b/${originalPath}`,
    `@@ -1,${n} +1,${m} @@`,
  ];

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      diffLines.push(`  ${oldLines[i]}`);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diffLines.push(`- ${oldLines[i]}`);
      i++;
    } else {
      diffLines.push(`+ ${newLines[j]}`);
      j++;
    }
  }
  while (i < n) {
    diffLines.push(`- ${oldLines[i]}`);
    i++;
  }
  while (j < m) {
    diffLines.push(`+ ${newLines[j]}`);
    j++;
  }

  return diffLines.join('\n');
}

export function createPatch(
  originalPath: string,
  nouveauContenu: string,
  originalOverride?: string
): {
  patchId: string;
  diff: string;
  original: string;
  nouveau: string;
  patch: WorkspacePatch;
} {
  let original = originalOverride;
  if (original === undefined) {
    try {
      original = readFile(originalPath) ?? '';
    } catch {
      original = '';
    }
  }

  const patchId = generateId('patch');
  const diff = computeReadableDiff(originalPath, original, nouveauContenu);
  const now = new Date().toISOString();

  const patch: WorkspacePatch = {
    patchId,
    originalPath,
    diff,
    original,
    nouveau: nouveauContenu,
    status: 'en_attente',
    createdAt: now,
    updatedAt: now,
  };

  writeFile(`/workspace/patches/${patchId}.json`, JSON.stringify(patch, null, 2));
  persistWorkspaceState();

  return {
    patchId,
    diff,
    original,
    nouveau: nouveauContenu,
    patch,
  };
}

export function getPatch(patchId: string): WorkspacePatch | null {
  const safeId = patchId.replace(/[^a-zA-Z0-9_-]/g, '');
  const raw = readFile(`/workspace/patches/${safeId}.json`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkspacePatch;
  } catch {
    return null;
  }
}

export function updatePatch(patchId: string, updates: Partial<WorkspacePatch>): WorkspacePatch | null {
  const current = getPatch(patchId);
  if (!current) return null;
  const updated: WorkspacePatch = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeFile(`/workspace/patches/${current.patchId}.json`, JSON.stringify(updated, null, 2));
  persistWorkspaceState();
  return updated;
}

export function listPatches(): WorkspacePatch[] {
  const files = listFiles('/workspace/patches/');
  const patches: WorkspacePatch[] = [];
  for (const file of files) {
    if (!file.path.endsWith('.json')) continue;
    try {
      patches.push(JSON.parse(file.content) as WorkspacePatch);
    } catch {
      // Ignorer entrées corrompues
    }
  }
  return patches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveTestResult(
  result: Omit<WorkspaceTestResult, 'id' | 'createdAt'>
): WorkspaceTestResult {
  const id = generateId('test');
  const entry: WorkspaceTestResult = {
    ...result,
    id,
    createdAt: new Date().toISOString(),
  };
  writeFile(`/workspace/tests/${id}.json`, JSON.stringify(entry, null, 2));
  persistWorkspaceState();
  return entry;
}

function persistWorkspaceState(): void {
  writeWorkspacePatchesFile({
    patches: listPatches(),
    tests: listTestResults().slice(0, 200),
  });
}

export function loadWorkspaceFromDisk(): {
  patchesLoaded: number;
  testsLoaded: number;
  corrupted: boolean;
} {
  const { patches, tests, corrupted } = readWorkspacePatchesFile();
  if (corrupted) {
    for (const key of Array.from(workspaceStore.keys())) {
      if (key.startsWith('/workspace/patches/') || key.startsWith('/workspace/tests/')) {
        workspaceStore.delete(key);
        workspaceMeta.delete(key);
      }
    }
    return { patchesLoaded: 0, testsLoaded: 0, corrupted: true };
  }

  let patchesLoaded = 0;
  for (const patch of patches) {
    if (patch && typeof patch.patchId === 'string' && typeof patch.originalPath === 'string') {
      const filePath = `/workspace/patches/${patch.patchId}.json`;
      workspaceStore.set(filePath, JSON.stringify(patch, null, 2));
      workspaceMeta.set(filePath, { updatedAt: patch.updatedAt || patch.createdAt || new Date().toISOString() });
      patchesLoaded++;
    }
  }

  let testsLoaded = 0;
  for (const test of tests) {
    if (test && typeof test.id === 'string' && typeof test.success === 'boolean') {
      const filePath = `/workspace/tests/${test.id}.json`;
      workspaceStore.set(filePath, JSON.stringify(test, null, 2));
      workspaceMeta.set(filePath, { updatedAt: test.createdAt || new Date().toISOString() });
      testsLoaded++;
    }
  }

  return { patchesLoaded, testsLoaded, corrupted: false };
}

export function listTestResults(): WorkspaceTestResult[] {
  const files = listFiles('/workspace/tests/');
  const tests: WorkspaceTestResult[] = [];
  for (const file of files) {
    if (!file.path.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(file.content) as WorkspaceTestResult;
      if (parsed && parsed.id && typeof parsed.success === 'boolean') {
        tests.push(parsed);
      }
    } catch {
      // Ignorer fichiers non-résultats
    }
  }
  return tests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getWorkspaceSnapshot() {
  return {
    files: listFiles('/workspace/'),
    generated: listFiles('/workspace/generated/'),
    patches: listPatches(),
    tests: listTestResults(),
  };
}
