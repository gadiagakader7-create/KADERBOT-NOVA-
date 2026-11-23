import React, { useRef, useState } from 'react';
import { Plus, Library, Loader2, AlertCircle, X } from 'lucide-react';
import { LibraryDoc } from '../types/kaderbot';
import { addDoc, extractFileForLibrary } from '../services/libraryService';

interface AttachSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLibrary: () => void;
  onFileAdded: (doc: LibraryDoc) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
}

export const AttachSheet: React.FC<AttachSheetProps> = ({
  isOpen,
  onClose,
  onOpenLibrary,
  onFileAdded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isLoading) return;
    setErrorMsg(null);
    setStatusLabel('');
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setIsLoading(true);
    setStatusLabel(`Lecture de « ${file.name} »...`);

    try {
      const extracted = await extractFileForLibrary(file);
      const savedDoc = await addDoc({
        name: extracted.name,
        type: extracted.type,
        size: extracted.size,
        text: extracted.text,
      });

      const activationResult = await onFileAdded(savedDoc);
      if (!activationResult.ok) {
        setErrorMsg(activationResult.error || "Impossible d'activer ce document.");
        setIsLoading(false);
        setStatusLabel('');
        return;
      }

      setIsLoading(false);
      setStatusLabel('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de l’ajout du fichier.');
      setIsLoading(false);
      setStatusLabel('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Fond semi-transparent cliquable */}
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Panneau qui monte depuis le bas */}
      <div className="relative w-full max-w-xl bg-[#090B10] border-t border-x border-gray-800 rounded-t-2xl p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400">Joindre un document</span>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition disabled:opacity-40"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,.pdf,.docx"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Gros bouton "+ Ajouter un fichier" */}
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            setErrorMsg(null);
            fileInputRef.current?.click();
          }}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 transition active:scale-[0.99]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{statusLabel || 'Extraction en cours...'}</span>
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              <span>+ Ajouter un fichier</span>
            </>
          )}
        </button>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* En bas : icône Bibliothèque avec libellé */}
        <div className="pt-2 border-t border-gray-800/80">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setErrorMsg(null);
              onClose();
              onOpenLibrary();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-[#121622] hover:bg-[#161c2c] border border-gray-800 hover:border-emerald-500/40 text-gray-200 font-semibold text-xs transition active:scale-[0.99] disabled:opacity-40"
          >
            <Library className="w-4 h-4 text-emerald-400" />
            <span>Bibliothèque</span>
          </button>
        </div>
      </div>
    </div>
  );
};
