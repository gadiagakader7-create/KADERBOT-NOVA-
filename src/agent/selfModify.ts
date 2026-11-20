import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transformSync } from 'esbuild';
import {
  createPatch as createVirtualPatch,
  getPatch,
  saveTestResult,
  updatePatch,
  writeFile as writeVirtualFile,
  type WorkspacePatch,
  type WorkspacePatchTestResult,
} from './codeWorkspace';
import { executeCode } from './codeExecutor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProjectRoot(): string {
  const candidates = [
    path.resolve(__dirname, '../../'),
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), 'src'),
    path.resolve(process.cwd(), '..'),
  ];
  for (const candidate of candidates) {
    const srcDir = path.join(candidate, 'src');
    const pkgFile = path.join(candidate, 'package.json');
    if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory() && fs.existsSync(pkgFile)) {
      return candidate;
    }
  }
  for (const candidate of candidates) {
    const srcDir = path.join(candidate, 'src');
    if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
      return candidate;
    }
  }
  return path.resolve(__dirname, '../../');
}

export const PROJECT_ROOT = resolveProjectRoot();
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.json']);
const DEFAULT_READ_LINE_WINDOW = 250;

export function isDirectoryInSrc(targetPath: string): boolean {
  const cleaned = String(targetPath || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!cleaned || cleaned.includes('..') || cleaned.includes('\0')) return false;
  if (cleaned !== 'src' && !cleaned.startsWith('src/')) return false;
  const abs = path.resolve(PROJECT_ROOT, cleaned);
  const srcRoot = path.resolve(PROJECT_ROOT, 'src');
  if (abs !== srcRoot && !abs.startsWith(srcRoot + path.sep)) return false;
  return fs.existsSync(abs) && fs.statSync(abs).isDirectory();
}

export function listSourceFiles(subDir = 'src'): Array<{ path: string; lines: number; size: number }> {
  const cleaned = String(subDir || 'src').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'src';
  if (cleaned.includes('..') || cleaned.includes('\0') || (cleaned !== 'src' && !cleaned.startsWith('src/'))) {
    throw new Error('Le listage des fichiers source est limité au dossier src/.');
  }

  const srcRoot = path.resolve(PROJECT_ROOT, 'src');
  const startDir = path.resolve(PROJECT_ROOT, cleaned);
  if (startDir !== srcRoot && !startDir.startsWith(srcRoot + path.sep)) {
    throw new Error('Chemin hors de src/.');
  }
  if (!fs.existsSync(startDir) || !fs.statSync(startDir).isDirectory()) {
    throw new Error(`Dossier introuvable : ${cleaned}`);
  }

  const results: Array<{ path: string; lines: number; size: number }> = [];
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;
        const rel = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        results.push({
          path: rel,
          lines: content.split('\n').length,
          size: stat.size,
        });
      }
    }
  };
  walk(startDir);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

export function validateSelfModifyTarget(targetPath: string): { valid: boolean; normalized: string; absolutePath: string; error?: string } {
  const cleaned = String(targetPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('..') || cleaned.includes('\0')) {
    return { valid: false, normalized: cleaned, absolutePath: '', error: 'Chemin cible invalide.' };
  }
  if (!cleaned.startsWith('src/')) {
    return {
      valid: false,
      normalized: cleaned,
      absolutePath: '',
      error: 'Seuls les fichiers situés dans src/ peuvent faire l’objet d’une proposition de patch.',
    };
  }

  const ext = path.extname(cleaned).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      normalized: cleaned,
      absolutePath: '',
      error: `Extension non autorisée pour auto-modification : ${ext || 'aucune'}`,
    };
  }

  const absolutePath = path.resolve(PROJECT_ROOT, cleaned);
  const srcRoot = path.resolve(PROJECT_ROOT, 'src');
  if (!absolutePath.startsWith(srcRoot + path.sep)) {
    return { valid: false, normalized: cleaned, absolutePath: '', error: 'Chemin hors de src/.' };
  }

  return { valid: true, normalized: cleaned, absolutePath };
}

/**
 * Étape 1 : Lecture contrôlée du fichier cible depuis src/ (lecture seule).
 */
export function readTargetFile(targetPath: string): { path: string; content: string } {
  const check = validateSelfModifyTarget(targetPath);
  if (!check.valid) {
    throw new Error(check.error || 'Chemin cible refusé.');
  }
  if (!fs.existsSync(check.absolutePath)) {
    throw new Error(`Fichier introuvable : ${check.normalized} (racine détectée : ${PROJECT_ROOT}). Utilise action="list" pour voir les fichiers disponibles.`);
  }
  const content = fs.readFileSync(check.absolutePath, 'utf-8');
  return { path: check.normalized, content };
}

/**
 * Lecture formatée et paginée par plage de lignes pour éviter de saturer la fenêtre/TPM du modèle sur les gros fichiers.
 */
export function formatTargetFileRead(targetPath: string, startLine?: number, endLine?: number): string {
  const file = readTargetFile(targetPath);
  const lines = file.content.split('\n');
  const totalLines = lines.length;

  const hasRange = typeof startLine === 'number' || typeof endLine === 'number';
  const start = Math.max(1, typeof startLine === 'number' && Number.isFinite(startLine) ? Math.floor(startLine) : 1);
  const defaultEnd = hasRange ? Math.min(totalLines, start + DEFAULT_READ_LINE_WINDOW - 1) : Math.min(totalLines, DEFAULT_READ_LINE_WINDOW);
  const end = Math.min(
    totalLines,
    typeof endLine === 'number' && Number.isFinite(endLine) ? Math.max(start, Math.floor(endLine)) : defaultEnd
  );

  // Si le fichier tient dans DEFAULT_READ_LINE_WINDOW et aucune plage n'est demandée, renvoyer le texte brut complet
  if (!hasRange && totalLines <= DEFAULT_READ_LINE_WINDOW) {
    return `Contenu de ${file.path} (${totalLines} lignes, lecture seule) :\n${file.content}`;
  }

  const slice = lines.slice(start - 1, end);
  const numbered = slice.map((line, idx) => `${start + idx}: ${line}`).join('\n');
  const suffix =
    end < totalLines
      ? `\n\n[Affichage lignes ${start}-${end} sur ${totalLines}. Pour lire la suite : self_modify(action="read", targetPath="${file.path}", startLine=${end + 1}, endLine=${Math.min(totalLines, end + DEFAULT_READ_LINE_WINDOW)})]`
      : `\n\n[Fin du fichier : lignes ${start}-${end} sur ${totalLines}]`;

  return `Contenu de ${file.path} (lignes ${start}-${end}/${totalLines}, lecture seule) :\n${numbered}${suffix}`;
}

/**
 * Étape 1bis : Construit le nouveau contenu complet à partir d'un remplacement ciblé (sans troncature).
 */
export function buildTargetedPatchContent(targetPath: string, search: string, replace: string): string {
  const { content } = readTargetFile(targetPath);
  if (!search) {
    throw new Error('Paramètre search vide pour le patch ciblé.');
  }
  const index = content.indexOf(search);
  if (index === -1) {
    throw new Error(`Extrait search introuvable dans ${targetPath}. Utilise action="read" pour vérifier le contenu exact.`);
  }
  return content.slice(0, index) + replace + content.slice(index + search.length);
}

/**
 * Étape 2 : Création d'un patch dans /workspace/patches/ avec statut "en_attente".
 */
export function createPatchProposal(targetPath: string, nouveauContenu: string): WorkspacePatch {
  const { path: cleanPath, content: originalContent } = readTargetFile(targetPath);
  const { patch } = createVirtualPatch(cleanPath, nouveauContenu, originalContent);
  return patch;
}

/**
 * Étape 3 : Applique le patch sur une COPIE virtuelle et lance executeCode en mode test (timeout 120s).
 * Si le test échoue, le patch est immédiatement marqué "rejeté".
 */
export async function testPatchSurCopie(
  patchId: string,
  customTestCode?: string
): Promise<{
  success: boolean;
  patch: WorkspacePatch;
  testResult: WorkspacePatchTestResult;
  error?: string;
}> {
  const patch = getPatch(patchId);
  if (!patch) {
    throw new Error(`Patch introuvable : ${patchId}`);
  }

  const start = Date.now();
  const virtualCopyPath = `/workspace/tests/copy_${patch.patchId}_${path.basename(patch.originalPath)}`;
  writeVirtualFile(virtualCopyPath, patch.nouveau);

  const ext = path.extname(patch.originalPath).toLowerCase();
  let executableJs = '';

  try {
    if (ext === '.json') {
      JSON.parse(patch.nouveau);
      executableJs = `console.log("Validation JSON réussie (${patch.originalPath})");`;
    } else if (ext === '.css') {
      if (!patch.nouveau.trim()) {
        throw new Error('Fichier CSS vide.');
      }
      executableJs = `console.log("Validation CSS réussie (${patch.originalPath})");`;
    } else {
      const loader = ext === '.tsx' ? 'tsx' : ext === '.jsx' ? 'jsx' : ext === '.ts' ? 'ts' : 'js';
      const transformed = transformSync(patch.nouveau, {
        loader,
        format: 'cjs',
        target: 'es2022',
        sourcefile: patch.originalPath,
      });

      const syntaxOnlyScript = [
        `const __sourceLen = ${patch.nouveau.length};`,
        `const __compiledLen = ${transformed.code.length};`,
        `if (__compiledLen === 0) throw new Error('Transpilation vide');`,
        `console.log('Syntaxe et transpilation valides (' + __sourceLen + ' -> ' + __compiledLen + ' octets)');`,
        customTestCode ? `\n${customTestCode}` : '',
      ].join('\n');

      executableJs = syntaxOnlyScript;
    }
  } catch (syntaxErr: any) {
    const failedResult: WorkspacePatchTestResult = {
      success: false,
      stdout: '',
      stderr: syntaxErr?.message || 'Erreur de syntaxe lors du test sur copie virtuelle.',
      durationMs: Date.now() - start,
      testedAt: new Date().toISOString(),
    };

    const rejected = updatePatch(patch.patchId, {
      status: 'rejeté',
      rejectionReason: failedResult.stderr,
      testResult: failedResult,
    })!;

    saveTestResult({
      language: 'javascript',
      label: `Patch ${patch.patchId} (${patch.originalPath})`,
      success: false,
      stdout: failedResult.stdout,
      stderr: failedResult.stderr,
      durationMs: failedResult.durationMs,
      filesCreated: [],
    });

    return {
      success: false,
      patch: rejected,
      testResult: failedResult,
      error: failedResult.stderr,
    };
  }

  const execRes = await executeCode({
    language: 'javascript',
    code: executableJs,
    isTest: true,
    timeoutMs: 120_000,
  });

  const testResult: WorkspacePatchTestResult = {
    success: execRes.success,
    stdout: execRes.stdout,
    stderr: execRes.stderr,
    durationMs: execRes.durationMs,
    testedAt: new Date().toISOString(),
  };

  saveTestResult({
    language: 'javascript',
    label: `Patch ${patch.patchId} (${patch.originalPath})`,
    success: execRes.success,
    stdout: execRes.stdout,
    stderr: execRes.stderr,
    durationMs: execRes.durationMs,
    filesCreated: execRes.filesCreated,
  });

  if (!execRes.success) {
    const rejected = updatePatch(patch.patchId, {
      status: 'rejeté',
      rejectionReason: execRes.stderr || 'Échec du test sur copie virtuelle.',
      testResult,
    })!;
    return {
      success: false,
      patch: rejected,
      testResult,
      error: execRes.stderr || 'Échec du test sur copie virtuelle.',
    };
  }

  const updated = updatePatch(patch.patchId, {
    status: 'en_attente',
    testResult,
  })!;

  return {
    success: true,
    patch: updated,
    testResult,
  };
}

/**
 * Étape 4 : Formule la demande de validation humaine avec le diff et le résultat du test.
 */
export function demandeValidation(patch: WorkspacePatch): {
  patchId: string;
  status: WorkspacePatch['status'];
  diff: string;
  testResult?: WorkspacePatchTestResult;
  message: string;
} {
  const testStatusLabel = patch.testResult?.success ? 'réussi' : 'échoué';
  const message =
    patch.status === 'rejeté'
      ? `Patch rejeté automatiquement (${patch.patchId}) :\n${patch.diff}\n\nTest : échoué (${patch.rejectionReason || patch.testResult?.stderr || 'erreur inconnue'}).`
      : `Patch proposé (${patch.patchId}) :\n${patch.diff}\n\nTest : ${testStatusLabel}. Tu valides ?`;

  return {
    patchId: patch.patchId,
    status: patch.status,
    diff: patch.diff,
    testResult: patch.testResult,
    message,
  };
}

/**
 * Exécute strictement les étapes 1 -> 2 -> 3 -> 4 sans jamais modifier src/ directement.
 */
export async function runSelfModifyProtocol(params: {
  targetPath: string;
  newContent: string;
  testCode?: string;
}) {
  const patch = createPatchProposal(params.targetPath, params.newContent);
  const testOutcome = await testPatchSurCopie(patch.patchId, params.testCode);
  return {
    ...demandeValidation(testOutcome.patch),
    patch: testOutcome.patch,
  };
}

/**
 * Seule fonction autorisée à écrire dans src/ après validation humaine explicite via /api/admin/validate-patch.
 */
export function applyValidatedPatch(patchId: string): WorkspacePatch {
  const patch = getPatch(patchId);
  if (!patch) {
    throw new Error(`Patch introuvable : ${patchId}`);
  }
  if (patch.status !== 'en_attente') {
    throw new Error(`Impossible d'appliquer un patch au statut "${patch.status}".`);
  }
  if (!patch.testResult?.success) {
    throw new Error('Impossible d’appliquer un patch dont le test sur copie virtuelle n’a pas réussi.');
  }

  const check = validateSelfModifyTarget(patch.originalPath);
  if (!check.valid) {
    throw new Error(check.error || 'Cible de patch non autorisée.');
  }

  fs.writeFileSync(check.absolutePath, patch.nouveau, 'utf-8');
  const applied = updatePatch(patch.patchId, {
    status: 'appliqué',
    appliedAt: new Date().toISOString(),
  });

  if (!applied) {
    throw new Error('Erreur lors de la mise à jour du statut du patch.');
  }
  return applied;
}

export function rejectPatch(patchId: string, reason = 'Rejeté par l’administrateur.'): WorkspacePatch {
  const patch = getPatch(patchId);
  if (!patch) {
    throw new Error(`Patch introuvable : ${patchId}`);
  }
  const rejected = updatePatch(patch.patchId, {
    status: 'rejeté',
    rejectionReason: reason,
  });
  if (!rejected) {
    throw new Error('Erreur lors du rejet du patch.');
  }
  return rejected;
}
