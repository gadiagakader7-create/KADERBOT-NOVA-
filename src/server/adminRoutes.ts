import type { Express, Request, RequestHandler, Response, NextFunction } from 'express';
import {
  deleteFile,
  getWorkspaceSnapshot,
  normalizeWorkspacePath,
  readFile,
  saveTestResult,
  writeFile,
} from '../agent/codeWorkspace';
import { executeCode } from '../agent/codeExecutor';
import {
  applyValidatedPatch,
  readTargetFile,
  rejectPatch,
  runSelfModifyProtocol,
} from '../agent/selfModify';

export interface AdminRoutesDeps {
  requireAdmin: RequestHandler;
  projectRoot?: string;
}

/**
 * Réutilise requireAdmin tout en garantissant strictement un code 403
 * si ADMIN_TOKEN est manquant ou invalide (aucune exécution possible).
 */
function createStrictAdmin403Guard(requireAdmin: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    let blocked = false;
    const originalStatus = res.status.bind(res);
    const originalJson = res.json.bind(res);

    const statusSpy = ((code: number) => {
      if (code === 401) {
        blocked = true;
        return originalStatus(403);
      }
      if (code === 503) {
        blocked = true;
        return originalStatus(503);
      }
      return originalStatus(code);
    }) as Response['status'];

    const jsonSpy = ((body: any) => {
      if (blocked) {
        return originalJson({
          error: body?.error || 'Accès refusé (403) : authentification administrateur requise.',
          ...(body?.code ? { code: body.code } : {}),
        });
      }
      return originalJson(body);
    }) as Response['json'];

    res.status = statusSpy;
    res.json = jsonSpy;

    requireAdmin(req, res, (err?: any) => {
      res.status = originalStatus;
      res.json = originalJson;
      if (err) return next(err);
      if (!blocked) return next();
    });
  };
}

export function registerAdminRoutes(app: Express, deps: AdminRoutesDeps): void {
  const adminGuard = createStrictAdmin403Guard(deps.requireAdmin);

  // Liste l'état complet du stockage virtuel /workspace/
  app.get('/api/admin/workspace', adminGuard, (_req, res) => {
    try {
      return res.json(getWorkspaceSnapshot());
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erreur lecture workspace virtuel.' });
    }
  });

  // Lecture contrôlée d'un fichier source src/ (lecture seule pour préparer un patch)
  app.get('/api/admin/source-file', adminGuard, (req, res) => {
    try {
      const targetPath = typeof req.query.path === 'string' ? req.query.path : '';
      const data = readTargetFile(targetPath);
      return res.json(data);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Impossible de lire le fichier cible.' });
    }
  });

  // Créer / mettre à jour un script virtuel dans /workspace/generated/ ou /workspace/tests/
  app.post('/api/admin/workspace/file', adminGuard, (req, res) => {
    try {
      const { path: filePath, content } = req.body || {};
      const normalized = normalizeWorkspacePath(String(filePath || ''), '/workspace/generated/');
      if (normalized.startsWith('/workspace/patches/')) {
        return res.status(400).json({ error: 'Les patches doivent être créés via /api/admin/self-modify.' });
      }
      const saved = writeFile(normalized, typeof content === 'string' ? content : '');
      return res.json({ ok: true, file: saved });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Erreur écriture fichier virtuel.' });
    }
  });

  // Supprimer un fichier virtuel de /workspace/
  app.delete('/api/admin/workspace/file', adminGuard, (req, res) => {
    try {
      const { path: filePath } = req.body || {};
      const removed = deleteFile(String(filePath || ''));
      return res.json({ ok: true, removed });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Erreur suppression fichier virtuel.' });
    }
  });

  // Enregistrer un résultat d'exécution sandbox (ex: Web Worker Pyodide/JS côté client) dans /workspace/tests/
  app.post('/api/admin/workspace/test-log', adminGuard, (req, res) => {
    try {
      const { language, label, success, stdout = '', stderr = '', durationMs = 0, filesCreated = [] } = req.body || {};
      if (language !== 'python' && language !== 'javascript') {
        return res.status(400).json({ error: 'Langage invalide.' });
      }
      const entry = saveTestResult({
        language,
        label: String(label || `Exécution ${language}`),
        success: Boolean(success),
        stdout: String(stdout),
        stderr: String(stderr),
        durationMs: Number(durationMs) || 0,
        filesCreated: Array.isArray(filesCreated) ? filesCreated : [],
      });
      if (Array.isArray(filesCreated)) {
        for (const f of filesCreated) {
          if (f && typeof f.path === 'string' && typeof f.content === 'string') {
            try {
              const norm = normalizeWorkspacePath(f.path, '/workspace/generated/');
              if (!norm.startsWith('/workspace/patches/')) {
                writeFile(norm, f.content);
              }
            } catch {}
          }
        }
      }
      return res.json({ ok: true, entry });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Erreur enregistrement test.' });
    }
  });

  // Exécution isolée (codeExecutor.ts)
  app.post('/api/admin/execute', adminGuard, async (req, res) => {
    try {
      const { language, code, timeoutMs, isTest = false, label } = req.body || {};
      if (language !== 'python' && language !== 'javascript') {
        return res.status(400).json({ error: 'Langage requis : "python" ou "javascript".' });
      }
      if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'Code requis pour l’exécution.' });
      }

      const result = await executeCode({
        language,
        code,
        timeoutMs: typeof timeoutMs === 'number' ? timeoutMs : undefined,
        isTest: Boolean(isTest),
      });

      if (Array.isArray(result.filesCreated)) {
        for (const f of result.filesCreated) {
          if (f && typeof f.path === 'string' && typeof f.content === 'string') {
            try {
              const norm = normalizeWorkspacePath(f.path, '/workspace/generated/');
              if (!norm.startsWith('/workspace/patches/')) {
                writeFile(norm, f.content);
              }
            } catch {}
          }
        }
      }

      saveTestResult({
        language,
        label: typeof label === 'string' && label.trim() ? label.trim() : `Sandbox ${language}`,
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        filesCreated: result.filesCreated,
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erreur lors de l’exécution sandbox.' });
    }
  });

  // Protocole d'auto-modification (Étapes 1 à 4 : lecture -> patch virtuel -> test sur copie -> attente validation)
  app.post('/api/admin/self-modify', adminGuard, async (req, res) => {
    try {
      const { targetPath, newContent, testCode } = req.body || {};
      if (typeof targetPath !== 'string' || !targetPath.trim()) {
        return res.status(400).json({ error: 'targetPath requis (ex: src/agent/toolRegistry.ts).' });
      }
      if (typeof newContent !== 'string') {
        return res.status(400).json({ error: 'newContent requis.' });
      }

      const result = await runSelfModifyProtocol({
        targetPath: targetPath.trim(),
        newContent,
        testCode: typeof testCode === 'string' ? testCode : undefined,
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Erreur lors de la proposition de patch.' });
    }
  });

  // Seule route autorisée à appliquer un patch validé dans src/
  app.post('/api/admin/validate-patch', adminGuard, (req, res) => {
    try {
      const { patchId } = req.body || {};
      if (typeof patchId !== 'string' || !patchId.trim()) {
        return res.status(400).json({ error: 'patchId requis.' });
      }
      const applied = applyValidatedPatch(patchId.trim());
      return res.json({
        ok: true,
        patch: applied,
        message: `Patch ${applied.patchId} appliqué avec succès sur ${applied.originalPath}.`,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Impossible de valider le patch.' });
    }
  });

  // Rejet explicite d'un patch en attente
  app.post('/api/admin/reject-patch', adminGuard, (req, res) => {
    try {
      const { patchId, reason } = req.body || {};
      if (typeof patchId !== 'string' || !patchId.trim()) {
        return res.status(400).json({ error: 'patchId requis.' });
      }
      const rejected = rejectPatch(
        patchId.trim(),
        typeof reason === 'string' && reason.trim() ? reason.trim() : 'Rejeté manuellement par l’administrateur.'
      );
      return res.json({ ok: true, patch: rejected });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Impossible de rejeter le patch.' });
    }
  });

  // Garder readFile importé actif si besoin d'inspection directe
  void readFile;
}
