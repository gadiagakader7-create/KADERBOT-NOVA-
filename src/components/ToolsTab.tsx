import React, { useState } from 'react';
import {
  Lightbulb,
  Languages,
  CheckCheck,
  FileText,
  Sparkles,
  Copy,
  Check,
  Download,
  Volume2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { STYLES_IDEES } from '../core/cognitiveEngine';
import { apiService } from '../services/apiService';
import { AppConfig, IdeaItem } from '../types/kaderbot';

interface ToolsTabProps {
  config: AppConfig;
  onSaveToMemory: (sujet: string, def: string) => void;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({ config, onSaveToMemory }) => {
  const [activeTool, setActiveTool] = useState<'idees' | 'traduction' | 'correction' | 'resume'>('idees');

  // Ideas Generator state
  const [themeInput, setThemeInput] = useState('');
  const [ideasCount, setIdeasCount] = useState(5);
  const [selectedStyle, setSelectedStyle] = useState('creatif');
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [ideasResult, setIdeasResult] = useState<IdeaItem[]>([]);
  const [developingId, setDevelopingId] = useState<number | null>(null);

  // Translation state
  const [transInput, setTransInput] = useState('');
  const [transLang, setTransLang] = useState('English');
  const [transResult, setTransResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // Correction state
  const [corrigeInput, setCorrigeInput] = useState('');
  const [corrigeResult, setCorrigeResult] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);

  // Summary state
  const [resumeInput, setResumeInput] = useState('');
  const [resumeResult, setResumeResult] = useState('');
  const [isResuming, setIsResuming] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleGenerateIdeas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeInput.trim() || isGeneratingIdeas) return;
    setIsGeneratingIdeas(true);
    try {
      const styleDesc = STYLES_IDEES[selectedStyle] || STYLES_IDEES.creatif;
      const text = await apiService.genererIdees({
        theme: themeInput.trim(),
        count: ideasCount,
        style: selectedStyle,
        styleDesc,
        provider: config.provider,
        geminiApiKey: config.geminiApiKey,
        groqApiKey: config.groqApiKey,
        groqModel: config.groqModel,
      });

      const lines = text
        .split('\n')
        .map(l => l.replace(/^\s*(\d+[\.\)\-:]\s*|[\-\*]\s*)/, '').trim())
        .filter(Boolean);

      const items: IdeaItem[] = lines.map((title, idx) => ({
        id: idx + 1,
        title,
        theme: themeInput.trim(),
        style: selectedStyle,
        timestamp: new Date().toLocaleTimeString(),
      }));

      setIdeasResult(items);
    } catch (err: any) {
      alert(`Erreur génération idées : ${err.message}`);
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleDevelopIdea = async (idea: IdeaItem) => {
    setDevelopingId(idea.id);
    try {
      const prompt = `Développe cette idée en 3 à 4 phrases concrètes, claires et inspirantes : "${idea.title}".`;
      const res = await apiService.chat({
        prompt,
        history: [],
        provider: config.provider,
        geminiApiKey: config.geminiApiKey,
        groqApiKey: config.groqApiKey,
        groqModel: config.groqModel,
      });

      setIdeasResult(prev =>
        prev.map(it => (it.id === idea.id ? { ...it, developedText: res.text } : it))
      );

      // Save to memory
      onSaveToMemory(`idee_${idea.id}_${idea.theme.slice(0, 15)}`, `${idea.title} -> ${res.text.slice(0, 180)}`);
    } catch (err: any) {
      alert(`Erreur développement idée : ${err.message}`);
    } finally {
      setDevelopingId(null);
    }
  };

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transInput.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      const result = await apiService.traduire({
        text: transInput.trim(),
        targetLang: transLang,
        provider: config.provider,
        geminiApiKey: config.geminiApiKey,
        groqApiKey: config.groqApiKey,
        groqModel: config.groqModel,
      });
      setTransResult(result);
    } catch (err: any) {
      alert(`Erreur traduction : ${err.message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCorrige = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corrigeInput.trim() || isCorrecting) return;
    setIsCorrecting(true);
    try {
      const result = await apiService.corriger({
        text: corrigeInput.trim(),
        provider: config.provider,
        geminiApiKey: config.geminiApiKey,
        groqApiKey: config.groqApiKey,
        groqModel: config.groqModel,
      });
      setCorrigeResult(result);
    } catch (err: any) {
      alert(`Erreur correction : ${err.message}`);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeInput.trim() || isResuming) return;
    setIsResuming(true);
    try {
      const result = await apiService.resumer({
        text: resumeInput.trim(),
        provider: config.provider,
        geminiApiKey: config.geminiApiKey,
        groqApiKey: config.groqApiKey,
        groqModel: config.groqModel,
      });
      setResumeResult(result);
    } catch (err: any) {
      alert(`Erreur résumé : ${err.message}`);
    } finally {
      setIsResuming(false);
    }
  };

  const languagesList = [
    { label: 'Anglais', val: 'English' },
    { label: 'Arabe', val: 'Arabic' },
    { label: 'Espagnol', val: 'Spanish' },
    { label: 'Allemand', val: 'German' },
    { label: 'Italien', val: 'Italian' },
    { label: 'Portugais', val: 'Portuguese' },
    { label: 'Russe', val: 'Russian' },
    { label: 'Chinois', val: 'Chinese' },
    { label: 'Japonais', val: 'Japanese' },
    { label: 'Coréen', val: 'Korean' },
    { label: 'Peul (Fula)', val: 'Fula' },
    { label: 'Bambara', val: 'Bambara' },
    { label: 'Wolof', val: 'Wolof' },
    { label: 'Swahili', val: 'Swahili' },
    { label: 'Turc', val: 'Turkish' },
    { label: 'Néerlandais', val: 'Dutch' },
    { label: 'Français', val: 'French' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#050508] max-w-5xl mx-auto space-y-6">
      {/* Sub-nav tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#090B10] border border-gray-800 overflow-x-auto">
        <button
          onClick={() => setActiveTool('idees')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'idees'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          <span>Générateur d'Idées</span>
        </button>

        <button
          onClick={() => setActiveTool('traduction')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'traduction'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Languages className="w-4 h-4" />
          <span>Traducteur Universel</span>
        </button>

        <button
          onClick={() => setActiveTool('correction')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'correction'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <CheckCheck className="w-4 h-4" />
          <span>Correcteur Express</span>
        </button>

        <button
          onClick={() => setActiveTool('resume')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTool === 'resume'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Résumeur Automatique</span>
        </button>
      </div>

      {/* 1. IDEAS TOOL */}
      {activeTool === 'idees' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-emerald-400" />
              <span>Brainstorming & Générateur d'Idées Multi-Styles</span>
            </h3>

            <form onSubmit={handleGenerateIdeas} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Thème ou sujet :</label>
                <input
                  type="text"
                  placeholder="Ex: Application mobile d'IA, Projet écologique, Histoire de science-fiction..."
                  value={themeInput}
                  onChange={e => setThemeInput(e.target.value)}
                  className="w-full bg-[#161822] border border-gray-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Style selector */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Style d'idéation :</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(STYLES_IDEES).map(styleKey => (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => setSelectedStyle(styleKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize border transition ${
                        selectedStyle === styleKey
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {styleKey}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Nombre d'idées :</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={ideasCount}
                    onChange={e => setIdeasCount(Number(e.target.value))}
                    className="accent-emerald-500"
                  />
                  <span className="font-mono text-xs font-bold text-emerald-400 w-4">{ideasCount}</span>
                </div>

                <button
                  type="submit"
                  disabled={!themeInput.trim() || isGeneratingIdeas}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isGeneratingIdeas ? 'Génération en cours...' : 'Générer les idées'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Results list */}
          {ideasResult.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">Idées générées pour "{themeInput}" :</h4>
                <button
                  onClick={() =>
                    handleCopy('all_ideas', ideasResult.map(i => `${i.id}. ${i.title}`).join('\n'))
                  }
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Tout copier</span>
                </button>
              </div>

              <div className="space-y-3">
                {ideasResult.map(idea => (
                  <div
                    key={idea.id}
                    className="p-4 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-2.5 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-emerald-950 border border-emerald-800/40 text-emerald-400 font-mono text-xs flex items-center justify-center flex-shrink-0 font-bold">
                          {idea.id}
                        </span>
                        <p className="text-xs sm:text-sm font-medium text-gray-100">{idea.title}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleCopy(`idea_${idea.id}`, idea.title)}
                          className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                          title="Copier l'idée"
                        >
                          {copiedKey === `idea_${idea.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDevelopIdea(idea)}
                          disabled={developingId === idea.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition"
                        >
                          {developingId === idea.id ? 'Développement...' : 'Développer →'}
                        </button>
                      </div>
                    </div>

                    {idea.developedText && (
                      <div className="p-3 rounded-xl bg-gray-900/80 border border-emerald-500/25 text-xs text-gray-300 leading-relaxed font-sans">
                        <div className="text-[10px] text-emerald-400 font-mono font-bold mb-1">
                          Approfondissement mémorisé dans le graphe :
                        </div>
                        {idea.developedText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. TRANSLATOR TOOL */}
      {activeTool === 'traduction' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-cyan-400" />
              <span>Traducteur Polyglotte (18+ langues)</span>
            </h3>

            <form onSubmit={handleTranslate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Texte à traduire :</label>
                <textarea
                  rows={4}
                  placeholder="Écris ou colle ton texte ici..."
                  value={transInput}
                  onChange={e => setTransInput(e.target.value)}
                  className="w-full bg-[#161822] border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Langue cible :</span>
                  <select
                    value={transLang}
                    onChange={e => setTransLang(e.target.value)}
                    className="bg-[#161822] border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                  >
                    {languagesList.map(lang => (
                      <option key={lang.val} value={lang.val}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!transInput.trim() || isTranslating}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-cyan-950/40"
                >
                  {isTranslating ? 'Traduction en cours...' : 'Traduire'}
                </button>
              </div>
            </form>
          </div>

          {transResult && (
            <div className="p-4 rounded-2xl bg-[#0E131F] border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">Traduction ({transLang}) :</span>
                <button
                  onClick={() => handleCopy('trad', transResult)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  {copiedKey === 'trad' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-sm text-gray-100 whitespace-pre-wrap">{transResult}</p>
            </div>
          )}
        </div>
      )}

      {/* 3. CORRECTEUR TOOL */}
      {activeTool === 'correction' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-purple-400" />
              <span>Correcteur Orthographique & Grammatical</span>
            </h3>

            <form onSubmit={handleCorrige} className="space-y-3">
              <textarea
                rows={4}
                placeholder="Colle ton texte contenant des fautes à corriger..."
                value={corrigeInput}
                onChange={e => setCorrigeInput(e.target.value)}
                className="w-full bg-[#161822] border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!corrigeInput.trim() || isCorrecting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-purple-950/40"
                >
                  {isCorrecting ? 'Correction en cours...' : 'Corriger le texte'}
                </button>
              </div>
            </form>
          </div>

          {corrigeResult && (
            <div className="p-4 rounded-2xl bg-[#0E131F] border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400">Texte corrigé :</span>
                <button
                  onClick={() => handleCopy('corrige', corrigeResult)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  {copiedKey === 'corrige' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-sm text-gray-100 whitespace-pre-wrap">{corrigeResult}</p>
            </div>
          )}
        </div>
      )}

      {/* 4. RESUMEUR TOOL */}
      {activeTool === 'resume' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Résumeur Automatique de Textes Longs</span>
            </h3>

            <form onSubmit={handleResume} className="space-y-3">
              <textarea
                rows={5}
                placeholder="Colle un article, une leçon ou un long paragraphe à résumer..."
                value={resumeInput}
                onChange={e => setResumeInput(e.target.value)}
                className="w-full bg-[#161822] border border-gray-800 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!resumeInput.trim() || isResuming}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold transition shadow-lg shadow-amber-950/40"
                >
                  {isResuming ? 'Synthèse en cours...' : 'Générer le résumé'}
                </button>
              </div>
            </form>
          </div>

          {resumeResult && (
            <div className="p-4 rounded-2xl bg-[#0E131F] border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">Résumé concis :</span>
                <button
                  onClick={() => handleCopy('resume', resumeResult)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  {copiedKey === 'resume' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">{resumeResult}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
