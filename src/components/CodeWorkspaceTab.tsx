import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCode,
  GitCompare,
  Terminal,
  Play,
  Copy,
  Check,
  Eye,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { CodeCanvas } from './CodeCanvas';
import { executeCode } from '../agent/codeExecutor';
import { apiService } from '../services/apiService';

interface WorkspaceFileEntry {
  path: string;
  content: string;
  size: number;
  updatedAt: string;
}

interface WorkspacePatchTestResult {
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  testedAt: string;
}

interface WorkspacePatch {
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

interface WorkspaceTestResult {
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

interface CodeWorkspaceTabProps {
  isAdmin: boolean;
  onBack?: () => void;
}


function detectLanguage(filePath: string): 'python' | 'javascript' {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  return 'javascript';
}

function detectCanvasLanguage(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.tsx')) return 'tsx';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.css')) return 'css';
  return 'javascript';
}

export const CodeWorkspaceTab: React.FC<CodeWorkspaceTabProps> = ({ isAdmin, onBack }) => {
  const [subTab, setSubTab] = useState<'generated' | 'patches' | 'tests'>('generated');
  const [generatedFiles, setGeneratedFiles] = useState<WorkspaceFileEntry[]>([]);
  const [patches, setPatches] = useState<WorkspacePatch[]>([]);
  const [tests, setTests] = useState<WorkspaceTestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // États onglet Générés
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [runningPath, setRunningPath] = useState<string | null>(null);
  const [execMode, setExecMode] = useState<'worker' | 'server'>('worker');
  const [newScriptName, setNewScriptName] = useState('script_test.py');
  const [newScriptCode, setNewScriptCode] = useState(
    'print("Bonjour depuis le sandbox KADERBOT NOVA")\nresultat = sum(range(1, 11))\nprint("Somme 1..10 =", resultat)'
  );
  const [showCreator, setShowCreator] = useState(false);

  // États onglet Patches
  const [processingPatchId, setProcessingPatchId] = useState<string | null>(null);
  const [showPatchCreator, setShowPatchCreator] = useState(false);
  const [patchTargetPath, setPatchTargetPath] = useState('src/agent/toolRegistry.ts');
  const [patchNewContent, setPatchNewContent] = useState('');
  const [isSubmittingPatch, setIsSubmittingPatch] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiService.getAdminWorkspace();
      setGeneratedFiles(Array.isArray(data.generated) ? data.generated : []);
      setPatches(Array.isArray(data.patches) ? data.patches : []);
      setTests(Array.isArray(data.tests) ? data.tests : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de charger /workspace/.');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      void loadWorkspace();
    }
  }, [isAdmin, loadWorkspace]);

  if (!isAdmin) {
    return null;
  }

  const handleCopyCode = async (filePath: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPath(filePath);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch {}
  };

  const handleCreateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    const cleanName = newScriptName.trim().replace(/^\/+/, '');
    if (!cleanName) return;
    const target = cleanName.startsWith('/workspace/')
      ? cleanName
      : `/workspace/generated/${cleanName}`;

    try {
      const data = await apiService.saveAdminWorkspaceFile(target, newScriptCode);
      setStatusMsg(`Script enregistré dans ${data.file.path}`);
      setSelectedFilePath(data.file.path);
      setShowCreator(false);
      await loadWorkspace();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur création script.');
    }
  };

  const handleDeleteScript = async (filePath: string) => {
    setErrorMsg(null);
    try {
      await apiService.deleteAdminWorkspaceFile(filePath);
      if (selectedFilePath === filePath) setSelectedFilePath(null);
      await loadWorkspace();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de supprimer le fichier.');
    }
  };

  const handleExecuteScript = async (file: WorkspaceFileEntry) => {
    const language = detectLanguage(file.path);
    setRunningPath(file.path);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      if (execMode === 'worker') {
        const result = await executeCode({
          language,
          code: file.content,
          timeoutMs: 30_000,
          isTest: false,
        });
        await apiService.logAdminWorkspaceTest({
          language,
          label: `WebWorker: ${file.path}`,
          ...result,
        });
        setStatusMsg(
          result.success
            ? `Exécution Web Worker réussie (${result.durationMs} ms). Consultez l'onglet Tests.`
            : `Exécution terminée avec erreur (${result.durationMs} ms). Consultez l'onglet Tests.`
        );
      } else {
        const result = await apiService.executeAdminCode({
          language,
          code: file.content,
          isTest: false,
          label: `Serveur Sandbox: ${file.path}`,
        });
        setStatusMsg(
          result.success
            ? `Exécution sandbox serveur réussie (${result.durationMs} ms).`
            : `Exécution terminée avec erreur (${result.durationMs} ms).`
        );
      }
      await loadWorkspace();
      setSubTab('tests');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Échec de l’exécution sandbox.');
    } finally {
      setRunningPath(null);
    }
  };

  const handleLoadSourceForPatch = async () => {
    setErrorMsg(null);
    try {
      const data = await apiService.getAdminSourceFile(patchTargetPath.trim());
      setPatchNewContent(data.content || '');
      setStatusMsg(`Fichier source chargé en lecture seule : ${data.path}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur chargement fichier source.');
    }
  };

  const handleProposePatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPatch(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const data = await apiService.proposeAdminPatch(patchTargetPath.trim(), patchNewContent);
      setStatusMsg(
        data.status === 'rejeté'
          ? `Patch ${data.patchId} rejeté automatiquement suite à l'échec du test sur copie virtuelle.`
          : `Patch ${data.patchId} créé et testé avec succès. En attente de validation.`
      );
      setShowPatchCreator(false);
      await loadWorkspace();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la proposition de patch.');
    } finally {
      setIsSubmittingPatch(false);
    }
  };

  const handleValidatePatch = async (patchId: string) => {
    setProcessingPatchId(patchId);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const data = await apiService.validateAdminPatch(patchId);
      setStatusMsg(data.message || `Patch ${patchId} appliqué.`);
      await loadWorkspace();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de l’application du patch.');
    } finally {
      setProcessingPatchId(null);
    }
  };

  const handleRejectPatch = async (patchId: string) => {
    setProcessingPatchId(patchId);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await apiService.rejectAdminPatch(patchId);
      setStatusMsg(`Patch ${patchId} rejeté.`);
      await loadWorkspace();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors du rejet du patch.');
    } finally {
      setProcessingPatchId(null);
    }
  };

  const selectedFile = generatedFiles.find(f => f.path === selectedFilePath) || null;
  const pendingCount = patches.filter(p => p.status === 'en_attente').length;

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] text-gray-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {onBack && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121622] hover:bg-[#161c2c] border border-gray-800 hover:border-emerald-500/40 text-gray-200 text-xs font-semibold transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span>Discussion</span>
            </button>
          </div>
        )}
        {/* En-tête Atelier Admin */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Atelier Admin — Auto-évolution & Sandbox
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Stockage virtuel isolé (/workspace/) — Aucun accès direct au système de fichiers sans validation humaine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={execMode}
              onChange={e => setExecMode(e.target.value as 'worker' | 'server')}
              className="px-2.5 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#333] text-xs text-gray-200 outline-none"
              title="Moteur d'exécution sandbox"
            >
              <option value="worker">Web Worker (Pyodide / JS isolé)</option>
              <option value="server">Sandbox Serveur (/api/admin/execute)</option>
            </select>
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2c] border border-[#333] text-xs font-medium text-gray-200 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* Messages d'état */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {statusMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Sous-onglets */}
        <div className="flex items-center gap-2 border-b border-gray-800/80 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubTab('generated')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'generated'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                : 'bg-[#0E131F] border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Générés ({generatedFiles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('patches')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'patches'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                : 'bg-[#0E131F] border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            <span>Patches en attente ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('tests')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'tests'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                : 'bg-[#0E131F] border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Tests ({tests.length})</span>
          </button>
        </div>

        {/* Sous-onglet A : Générés */}
        {subTab === 'generated' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-200">
                Scripts dans /workspace/generated/
              </h3>
              <button
                type="button"
                onClick={() => setShowCreator(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showCreator ? 'Fermer' : 'Nouveau script'}</span>
              </button>
            </div>

            {showCreator && (
              <form
                onSubmit={handleCreateScript}
                className="p-4 rounded-xl bg-[#1e1e1e] border border-[#333] space-y-3"
              >
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newScriptName}
                    onChange={e => setNewScriptName(e.target.value)}
                    placeholder="nom_du_script.py ou .js"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#141414] border border-[#333] text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Enregistrer dans /workspace/generated/
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={newScriptCode}
                  onChange={e => setNewScriptCode(e.target.value)}
                  className="w-full p-3 rounded-lg bg-[#141414] border border-[#333] font-mono text-[13px] text-gray-100 outline-none focus:border-emerald-500/60"
                />
              </form>
            )}

            {generatedFiles.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#0E131F] border border-gray-800 text-center text-xs text-gray-400">
                Aucun script virtuel dans /workspace/generated/ pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {generatedFiles.map(file => (
                  <div
                    key={file.path}
                    className="p-3.5 rounded-xl bg-[#1e1e1e] border border-[#333] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-emerald-300 truncate">{file.path}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {file.size} octets — mis à jour {new Date(file.updatedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFilePath(prev => (prev === file.path ? null : file.path))
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#252526] hover:bg-[#2f2f31] border border-[#333] text-xs text-gray-200 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{selectedFilePath === file.path ? 'Masquer' : 'Voir'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleCopyCode(file.path, file.content)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#252526] hover:bg-[#2f2f31] border border-[#333] text-xs text-gray-200 transition cursor-pointer"
                      >
                        {copiedPath === file.path ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copier</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleExecuteScript(file)}
                        disabled={runningPath === file.path}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-xs font-semibold text-white transition cursor-pointer"
                      >
                        {runningPath === file.path ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Exécution...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Exécuter</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteScript(file.path)}
                        className="p-1.5 rounded-lg bg-[#252526] hover:bg-rose-950/60 border border-[#333] hover:border-rose-500/40 text-gray-400 hover:text-rose-300 transition cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedFile && (
              <div className="pt-2">
                <div className="text-xs font-mono text-gray-400 mb-1">
                  Aperçu : {selectedFile.path}
                </div>
                <CodeCanvas
                  code={selectedFile.content}
                  language={detectCanvasLanguage(selectedFile.path)}
                />
              </div>
            )}
          </div>
        )}

        {/* Sous-onglet B : Patches en attente */}
        {subTab === 'patches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-200">
                Patches proposés (/workspace/patches/)
              </h3>
              <button
                type="button"
                onClick={() => setShowPatchCreator(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2c] border border-[#333] text-xs font-semibold text-gray-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showPatchCreator ? 'Fermer' : 'Proposer un patch'}</span>
              </button>
            </div>

            {showPatchCreator && (
              <form
                onSubmit={handleProposePatch}
                className="p-4 rounded-xl bg-[#1e1e1e] border border-[#333] space-y-3"
              >
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={patchTargetPath}
                    onChange={e => setPatchTargetPath(e.target.value)}
                    placeholder="src/agent/toolRegistry.ts"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#141414] border border-[#333] text-xs font-mono text-gray-100 outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLoadSourceForPatch()}
                    className="px-3 py-2 rounded-lg bg-[#252526] hover:bg-[#2f2f31] border border-[#333] text-xs text-gray-200 transition cursor-pointer"
                  >
                    Charger fichier actuel
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={patchNewContent}
                  onChange={e => setPatchNewContent(e.target.value)}
                  placeholder="Nouveau contenu complet proposé pour la cible src/..."
                  className="w-full p-3 rounded-lg bg-[#141414] border border-[#333] font-mono text-[13px] text-gray-100 outline-none focus:border-emerald-500/60"
                />
                <button
                  type="submit"
                  disabled={isSubmittingPatch || !patchTargetPath.trim() || !patchNewContent.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {isSubmittingPatch
                    ? 'Test sur copie virtuelle en cours...'
                    : 'Créer le patch et tester sur copie virtuelle'}
                </button>
              </form>
            )}

            {patches.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#0E131F] border border-gray-800 text-center text-xs text-gray-400">
                Aucun patch enregistré dans /workspace/patches/.
              </div>
            ) : (
              <div className="space-y-4">
                {patches.map(patch => {
                  const diffLines = (patch.diff || '').split('\n');
                  const isPending = patch.status === 'en_attente';
                  return (
                    <div
                      key={patch.patchId}
                      className="rounded-xl bg-[#1e1e1e] border border-[#333] overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-[#161616] border-b border-[#333] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-white">
                              {patch.originalPath}
                            </span>
                            <span className="font-mono text-[11px] text-gray-400">
                              ({patch.patchId})
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                patch.status === 'en_attente'
                                  ? 'bg-amber-950/70 border border-amber-500/40 text-amber-300'
                                  : patch.status === 'appliqué'
                                  ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                                  : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
                              }`}
                            >
                              {patch.status}
                            </span>
                          </div>
                          {patch.testResult && (
                            <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                              <span
                                className={
                                  patch.testResult.success ? 'text-emerald-400' : 'text-rose-400'
                                }
                              >
                                Test copie virtuelle : {patch.testResult.success ? 'Réussi' : 'Échoué'}
                              </span>
                              <span>({patch.testResult.durationMs} ms)</span>
                              {patch.testResult.stdout && (
                                <span className="font-mono text-gray-300">
                                  — {patch.testResult.stdout}
                                </span>
                              )}
                              {patch.testResult.stderr && (
                                <span className="font-mono text-rose-300">
                                  — {patch.testResult.stderr}
                                </span>
                              )}
                            </div>
                          )}
                          {patch.rejectionReason && (
                            <div className="text-[11px] text-rose-300 mt-1">
                              Motif : {patch.rejectionReason}
                            </div>
                          )}
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleValidatePatch(patch.patchId)}
                              disabled={
                                processingPatchId === patch.patchId || !patch.testResult?.success
                              }
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition cursor-pointer"
                            >
                              Valider
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRejectPatch(patch.patchId)}
                              disabled={processingPatchId === patch.patchId}
                              className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold transition cursor-pointer"
                            >
                              Rejeter
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Affichage du diff : supprimées en rouge, ajoutées en vert */}
                      <div className="max-h-[360px] overflow-auto font-mono text-[13px] leading-relaxed p-3 bg-[#141414]">
                        {diffLines.map((line, idx) => {
                          const isRemoved = line.startsWith('- ') || (line.startsWith('-') && !line.startsWith('---'));
                          const isAdded = line.startsWith('+ ') || (line.startsWith('+') && !line.startsWith('+++'));
                          const isHeader = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');
                          return (
                            <div
                              key={idx}
                              className={`px-2 whitespace-pre ${
                                isRemoved
                                  ? 'bg-rose-950/50 text-rose-300'
                                  : isAdded
                                  ? 'bg-emerald-950/50 text-emerald-300'
                                  : isHeader
                                  ? 'text-cyan-400 font-semibold'
                                  : 'text-gray-300'
                              }`}
                            >
                              {line || ' '}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sous-onglet C : Tests */}
        {subTab === 'tests' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">
              Historique des exécutions (/workspace/tests/)
            </h3>
            {tests.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#0E131F] border border-gray-800 text-center text-xs text-gray-400">
                Aucune exécution enregistrée pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {tests.map(test => (
                  <div
                    key={test.id}
                    className="rounded-xl bg-[#1e1e1e] border border-[#333] overflow-hidden"
                  >
                    <div className="px-4 py-2.5 bg-[#161616] border-b border-[#333] flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {test.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-mono text-xs font-semibold text-white">
                          {test.label}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#252526] border border-[#333] font-mono text-[10px] uppercase text-gray-300">
                          {test.language}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {test.durationMs} ms
                        </span>
                        <span>{new Date(test.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="p-3 space-y-2 font-mono text-[13px]">
                      {test.stdout && (
                        <div>
                          <div className="text-[11px] text-gray-400 mb-1">stdout</div>
                          <pre className="p-2.5 rounded-lg bg-[#141414] border border-[#333] text-emerald-200 overflow-x-auto whitespace-pre-wrap">
                            {test.stdout}
                          </pre>
                        </div>
                      )}
                      {test.stderr && (
                        <div>
                          <div className="text-[11px] text-rose-400 mb-1">stderr</div>
                          <pre className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-200 overflow-x-auto whitespace-pre-wrap">
                            {test.stderr}
                          </pre>
                        </div>
                      )}
                      {!test.stdout && !test.stderr && (
                        <div className="text-xs text-gray-500">Aucune sortie console.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
