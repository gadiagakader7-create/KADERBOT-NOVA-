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
  CloudUpload,
  CloudDownload,
  Server,
} from 'lucide-react';
import { AppConfig, LLMProvider } from '../types/kaderbot';
import { apiService } from '../services/apiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: Partial<AppConfig>) => void;
  onPushMemoryToServer?: () => Promise<{ success: boolean; message: string }>;
  onPullMemoryFromServer?: () => Promise<{ success: boolean; message: string }>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onPushMemoryToServer,
  onPullMemoryFromServer,
}) => {
  const [provider, setProvider] = useState<LLMProvider>(config.provider);
  const [geminiKey, setGeminiKey] = useState(config.geminiApiKey || '');
  const [groqKey, setGroqKey] = useState(config.groqApiKey || '');
  const [groqModel, setGroqModel] = useState(
    config.groqModel === 'llama-3.3-70b-versatile'
      ? 'openai/gpt-oss-120b'
      : config.groqModel || 'openai/gpt-oss-120b'
  );
  const [openrouterKey, setOpenrouterKey] = useState(config.openrouterApiKey || '');
  const [openrouterModel, setOpenrouterModel] = useState(
    config.openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free'
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

  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState(false);
  const [openrouterTestResult, setOpenrouterTestResult] = useState<{
    ok: boolean;
    message: string;
    model?: string;
    latencyMs?: number;
  } | null>(null);

  // Synchronisation Mémoire Hybride
  const [isModalPushing, setIsModalPushing] = useState(false);
  const [isModalPulling, setIsModalPulling] = useState(false);
  const [showModalPullConfirm, setShowModalPullConfirm] = useState(false);
  const [modalSyncStatus, setModalSyncStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Sync state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setModalSyncStatus(null);
      setShowModalPullConfirm(false);
      setProvider(config.provider);
      setGeminiKey(config.geminiApiKey || '');
      setGroqKey(config.groqApiKey || '');
      setGroqModel(
        config.groqModel === 'llama-3.3-70b-versatile'
          ? 'openai/gpt-oss-120b'
          : config.groqModel || 'openai/gpt-oss-120b'
      );
      setOpenrouterKey(config.openrouterApiKey || '');
      setOpenrouterModel(
        config.openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free'
      );
      setSystemPrompt(config.systemPrompt);
      setSoundEnabled(config.soundEnabled);
      setAutoLearn(config.autoLearnFromLLM);
      setTestResult(null);
      setGeminiTestResult(null);
      setOpenrouterTestResult(null);
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

  const handleTestOpenRouter = async () => {
    setIsTestingOpenRouter(true);
    setOpenrouterTestResult(null);

    try {
      const res = await apiService.testOpenRouterConnection(openrouterKey.trim(), openrouterModel);
      if (res.ok) {
        setOpenrouterTestResult({
          ok: true,
          message: `Connecté à OpenRouter (${res.model}) avec succès ! Latence : ${res.latencyMs}ms.`,
          model: res.model,
          latencyMs: res.latencyMs,
        });
      } else {
        setOpenrouterTestResult({
          ok: false,
          message: `Échec OpenRouter : ${res.error || 'Erreur de connexion'}`,
          model: res.model,
        });
      }
    } catch (e: any) {
      setOpenrouterTestResult({
        ok: false,
        message: `Erreur OpenRouter : ${e.message || 'Impossible de joindre le serveur'}`,
      });
    } finally {
      setIsTestingOpenRouter(false);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      provider,
      geminiApiKey: geminiKey.trim(),
      groqApiKey: groqKey.trim(),
      openrouterApiKey: openrouterKey.trim(),
      groqModel,
      openrouterModel,
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                onClick={() => setProvider('openrouter')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'openrouter'
                    ? 'bg-purple-950/40 border-purple-500/60 text-white shadow-sm shadow-purple-500/10'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-purple-400 text-xs">OpenRouter</span>
                  {provider === 'openrouter' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <p className="text-[10px] text-gray-400">
                  Llama 3.3 70B & modèles gratuits (:free) multi-fournisseurs.
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
                    openai/gpt-oss-20b (OpenAI GPT-OSS 20B - Équilibré & Rapide)
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

          {/* OpenRouter Configuration Section */}
          {provider === 'openrouter' && (
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs">
                  <Key className="w-4 h-4" />
                  <span>Configuration OpenRouter</span>
                </div>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-purple-400/80 hover:text-purple-300 underline flex items-center gap-1"
                >
                  <span>Obtenir une clé</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Clé API OpenRouter (Optionnelle) :</label>
                <input
                  type="password"
                  placeholder="sk-or-v1-... (laisser vide pour utiliser la clé serveur)"
                  value={openrouterKey}
                  onChange={e => setOpenrouterKey(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Si non renseignée, le serveur utilise automatiquement sa variable d'environnement <code className="text-purple-400 font-mono">OPENROUTER_API_KEY</code>.
                </p>
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 mb-1">Modèle OpenRouter (:free obligatoire) :</label>
                <select
                  value={openrouterModel}
                  onChange={e => setOpenrouterModel(e.target.value)}
                  className="w-full bg-[#090B10] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                >
                  <option value="meta-llama/llama-3.3-70b-instruct:free">
                    meta-llama/llama-3.3-70b-instruct:free (Recommandé - Llama 3.3 70B Instruct)
                  </option>
                  <option value="qwen/qwen3-coder:free">
                    qwen/qwen3-coder:free (Qwen 3 Coder - Code & Raisonnement)
                  </option>
                  <option value="deepseek/deepseek-r1:free">
                    deepseek/deepseek-r1:free (DeepSeek R1 - Raisonnement avancé)
                  </option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Note : le modèle GPT-OSS 120B est réservé au provider Groq et n'est pas disponible ici.
                </p>
              </div>

              {/* Test OpenRouter Connection Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestOpenRouter}
                  disabled={isTestingOpenRouter}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTestingOpenRouter ? 'animate-spin' : ''}`} />
                  <span>{isTestingOpenRouter ? 'Test en cours...' : 'Tester la connexion OpenRouter'}</span>
                </button>

                {/* Test feedback */}
                {openrouterTestResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-2 ${
                      openrouterTestResult.ok
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {openrouterTestResult.ok ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{openrouterTestResult.ok ? 'Succès' : 'Échec du test'}</p>
                      <p className="opacity-90">{openrouterTestResult.message}</p>
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

          {/* Synchronisation Mémoire Hybride (Locale + Serveur) */}
          {(onPushMemoryToServer || onPullMemoryFromServer) && (
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#0B1528] to-[#080D18] border border-blue-500/30 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Server className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold">Mémoire Hybride (Serveur & Local)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800/40 text-blue-300 ml-auto">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                L'application utilise votre mémoire locale en priorité. Utilisez ces commandes pour synchroniser manuellement avec la base centrale du serveur.
              </p>

              {modalSyncStatus && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    modalSyncStatus.success
                      ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/50 border border-red-500/40 text-red-300'
                  }`}
                >
                  <span>{modalSyncStatus.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!onPushMemoryToServer) return;
                    setIsModalPushing(true);
                    setModalSyncStatus(null);
                    setShowModalPullConfirm(false);
                    try {
                      const res = await onPushMemoryToServer();
                      setModalSyncStatus(res);
                    } catch (e: any) {
                      setModalSyncStatus({ success: false, message: e.message || 'Erreur inconnue' });
                    } finally {
                      setIsModalPushing(false);
                    }
                  }}
                  disabled={isModalPushing || isModalPulling}
                  className="py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-blue-950/40"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{isModalPushing ? 'Envoi...' : 'Envoyer ma mémoire au serveur'}</span>
                </button>

                {showModalPullConfirm ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        setShowModalPullConfirm(false);
                        if (!onPullMemoryFromServer) return;
                        setIsModalPulling(true);
                        setModalSyncStatus(null);
                        try {
                          const res = await onPullMemoryFromServer();
                          setModalSyncStatus(res);
                        } catch (e: any) {
                          setModalSyncStatus({ success: false, message: e.message || 'Erreur inconnue' });
                        } finally {
                          setIsModalPulling(false);
                        }
                      }}
                      disabled={isModalPulling}
                      className="flex-1 py-2 px-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition"
                    >
                      Confirmer écrasement
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModalPullConfirm(false)}
                      className="py-2 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] transition"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowModalPullConfirm(true)}
                    disabled={isModalPushing || isModalPulling}
                    className="py-2.5 px-3 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/40 disabled:opacity-40 text-teal-200 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <CloudDownload className="w-3.5 h-3.5 text-teal-400" />
                    <span>{isModalPulling ? 'Chargement...' : 'Récupérer la mémoire du serveur'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
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
