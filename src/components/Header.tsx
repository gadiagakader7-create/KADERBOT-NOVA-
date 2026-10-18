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
