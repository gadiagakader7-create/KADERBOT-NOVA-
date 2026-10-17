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
