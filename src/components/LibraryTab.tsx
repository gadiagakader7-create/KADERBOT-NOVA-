import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Library,
  Pencil,
  Trash2,
  Check,
  X,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { LibraryDoc } from '../types/kaderbot';
import {
  listDocs,
  getTotalSize,
  renameDoc,
  deleteDoc,
  exportLibrary,
  importLibrary,
  MAX_LIBRARY_BYTES,
} from '../services/libraryService';

interface LibraryTabProps {
  activeDocIds: string[];
  onToggleDoc: (id: string) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
  onBack: () => void;
  onDocDeleted?: (id: string) => void;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function formatDate(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  activeDocIds,
  onToggleDoc,
  onBack,
  onDocDeleted,
}) => {
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, bytes] = await Promise.all([listDocs(), getTotalSize()]);
      setDocs(items);
      setTotalBytes(bytes);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de charger la bibliothèque.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const handleToggle = async (id: string) => {
    setErrorMsg(null);
    setStatusMsg(null);
    const res = await onToggleDoc(id);
    if (!res.ok && res.error) {
      setErrorMsg(res.error);
    }
  };

  const handleSaveRename = async (id: string) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await renameDoc(id, editingName);
      setEditingId(null);
      setEditingName('');
      await loadLibrary();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors du renommage.');
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await deleteDoc(id);
      setConfirmDeleteId(null);
      onDocDeleted?.(id);
      await loadLibrary();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la suppression.');
    }
  };

  const handleExport = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const json = await exportLibrary();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kaderbot-bibliotheque-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg('Bibliothèque exportée en JSON.');
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de l'export.");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const text = await file.text();
      const result = await importLibrary(text);
      await loadLibrary();
      setStatusMsg(
        `${result.imported} document(s) importé(s)${result.skipped > 0 ? `, ${result.skipped} ignoré(s)` : ''}.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors de l'import.");
    }
  };

  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  const usagePercent = Math.min(100, Math.round((totalBytes / MAX_LIBRARY_BYTES) * 100));

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#050508] text-gray-100 max-w-5xl mx-auto w-full space-y-6">
      {/* Bouton retour Discussion */}
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

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Library className="w-5 h-5 text-emerald-400" />
            <span>Bibliothèque</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Active jusqu’à 3 documents pour enrichir les réponses de KaderBot dans la discussion courante.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleExport}
            disabled={docs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#121622] hover:bg-[#161c2c] disabled:opacity-40 border border-gray-800 hover:border-emerald-500/40 text-xs font-semibold text-gray-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exporter la bibliothèque</span>
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#121622] hover:bg-[#161c2c] border border-gray-800 hover:border-emerald-500/40 text-xs font-semibold text-gray-200 transition"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Importer une bibliothèque</span>
          </button>
        </div>
      </div>

      {/* Barre d'utilisation */}
      <div className="p-4 rounded-2xl bg-[#090B10] border border-gray-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Espace utilisé</span>
          <span className="font-mono font-semibold text-emerald-300">{totalMb} Mo / 200 Mo</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-900 overflow-hidden border border-gray-800/80">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {/* Messages d'erreur / statut */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Liste des documents */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-gray-400">Chargement de la bibliothèque...</div>
      ) : docs.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#090B10] border border-gray-800/80 text-center text-xs sm:text-sm text-gray-400">
          Aucun fichier. Utilise le 📎 dans la zone de saisie pour en ajouter.
        </div>
      ) : (
        <div className="space-y-2.5">
          {docs.map(doc => {
            const isActive = activeDocIds.includes(doc.id);
            const isEditing = editingId === doc.id;
            const isDeleting = confirmDeleteId === doc.id;

            return (
              <div
                key={doc.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  isActive
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-[#090B10] border-gray-800/90 hover:border-gray-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') void handleSaveRename(doc.id);
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditingName('');
                          }
                        }}
                        autoFocus
                        className="flex-1 bg-[#161B26] border border-emerald-500/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveRename(doc.id)}
                        className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 transition"
                        title="Valider"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName('');
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition"
                        title="Annuler"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        {isActive && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                            activé
                          </span>
                        )}
                        <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                          {doc.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {doc.type.toUpperCase()} · {formatFileSize(doc.size)} · {formatDate(doc.addedAt)}
                      </p>
                    </>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleToggle(doc.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition active:scale-95 ${
                        isActive
                          ? 'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                          : 'bg-[#121622] hover:bg-[#161c2c] border-gray-800 hover:border-emerald-500/40 text-gray-200'
                      }`}
                    >
                      {isActive ? 'Désactiver' : 'Activer'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(null);
                        setEditingId(doc.id);
                        setEditingName(doc.name);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#121622] hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-cyan-300 text-xs transition"
                      title="Renommer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Renommer</span>
                    </button>

                    {isDeleting ? (
                      <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-700/60 px-2 py-1 rounded-xl text-[11px] text-rose-200">
                        <span>Supprimer ?</span>
                        <button
                          type="button"
                          onClick={() => void handleConfirmDelete(doc.id)}
                          className="p-1 hover:bg-rose-600/50 rounded text-rose-100 font-bold transition"
                          title="Confirmer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1 hover:bg-gray-800 rounded text-gray-400 transition"
                          title="Annuler"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(doc.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#121622] hover:bg-rose-950/50 border border-gray-800 hover:border-rose-500/40 text-gray-400 hover:text-rose-300 text-xs transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mention en bas */}
      <p className="text-center text-[11px] text-gray-500 pt-2 pb-4">
        Les fichiers restent sur cet appareil et ce navigateur.
      </p>
    </div>
  );
};
