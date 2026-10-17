import React, { useState, useMemo } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  TrendingUp,
  Clock,
  ExternalLink,
  ChevronRight,
  GitBranch,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';
import { deduireChaine, sansAccent } from '../core/cognitiveEngine';

interface KnowledgeGraphTabProps {
  memoire: MemoryStore;
  regles: RulesStore;
  liens: LinksStore;
  synonymes: SynonymsStore;
  onAddDefinition: (sujet: string, defText: string) => void;
  onDeleteConcept: (sujet: string) => void;
  onAdjustWeight: (sujet: string, delta: number) => void;
  onAdjustHits?: (sujet: string, entryIdx: number, delta: number) => void;
  onAddLink: (source: string, target: string) => void;
  onDeleteLink: (source: string, target: string) => void;
  onAskQuestionAbout: (sujet: string) => void;
}

export const KnowledgeGraphTab: React.FC<KnowledgeGraphTabProps> = ({
  memoire,
  regles,
  liens,
  synonymes,
  onAddDefinition,
  onDeleteConcept,
  onAdjustWeight,
  onAdjustHits,
  onAddLink,
  onDeleteLink,
  onAskQuestionAbout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [newDefInput, setNewDefInput] = useState('');
  const [newLinkTarget, setNewLinkTarget] = useState('');

  // Extract all concept nodes
  const conceptsList = useMemo(() => {
    const list = Object.keys(memoire).map(sujet => {
      const defs = memoire[sujet] || [];
      const best = defs.reduce((max, c) => (c.poids > max.poids ? c : max), defs[0] || { poids: 0.8, hits: 1 });
      const parents = liens[sujet] || [];
      const children = Object.keys(liens).filter(k => (liens[k] || []).includes(sujet));
      const isQA = best?.type === 'question_reponse' || Boolean(best?.question_origine && best.question_origine.includes(' ')) || sujet.includes(' ');
      return {
        sujet,
        bestDef: best?.def || '',
        poids: best?.poids || 0.8,
        hits: best?.hits || 1,
        source: best?.source || 'manuel',
        isQA,
        question_origine: best?.question_origine,
        mots_cles: best?.mots_cles || [],
        defsCount: defs.length,
        parents,
        children,
      };
    });

    list.sort((a, b) => b.poids - a.poids);
    return list;
  }, [memoire, liens]);

  // Filtered concepts
  const filteredConcepts = useMemo(() => {
    if (!searchQuery.trim()) return conceptsList;
    const qNorm = sansAccent(searchQuery.toLowerCase());
    return conceptsList.filter(
      c =>
        sansAccent(c.sujet).includes(qNorm) ||
        sansAccent(c.bestDef).includes(qNorm)
    );
  }, [conceptsList, searchQuery]);

  // Current active concept detail
  const currentConceptData = selectedConcept ? memoire[selectedConcept] : null;
  const currentChain = selectedConcept
    ? deduireChaine(selectedConcept, '', memoire, regles, liens, synonymes)
    : null;

  const handleAddDefSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcept || !newDefInput.trim()) return;
    onAddDefinition(selectedConcept, newDefInput.trim());
    setNewDefInput('');
  };

  const handleAddLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcept || !newLinkTarget.trim()) return;
    onAddLink(selectedConcept, newLinkTarget.trim());
    setNewLinkTarget('');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-112px)] sm:h-[calc(100vh-120px)] overflow-hidden bg-[#050508] text-gray-200">
      {/* Left panel: List & Search */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-gray-800/80 flex flex-col bg-[#090B10]/95 flex-shrink-0">
        {/* Search header */}
        <div className="p-3 sm:p-4 border-b border-gray-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs sm:text-sm font-bold text-white">Mémoire Cognitive</h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
              {conceptsList.length} concepts
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un mot (ex: oiseau, python...)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* List of Concepts */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5">
          {filteredConcepts.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-500">
              Aucun concept trouvé. Pose une question au bot pour lui apprendre !
            </div>
          ) : (
            filteredConcepts.map(item => {
              const isSelected = selectedConcept === item.sujet;
              return (
                <div
                  key={item.sujet}
                  onClick={() => setSelectedConcept(item.sujet)}
                  className={`p-2.5 sm:p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-950/30'
                      : 'bg-gray-900/50 hover:bg-gray-800/70 border-gray-800/80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-white truncate capitalize">
                        {item.sujet}
                      </span>
                      {item.isQA ? (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950/70 text-purple-300 border border-purple-800/50">
                          Q&R
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/50">
                          Concept
                        </span>
                      )}
                      {item.parents.length > 0 && (
                        <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-0.5">
                          <GitBranch className="w-2.5 h-2.5" />
                          <span>{item.parents[0]}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.bestDef}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        item.poids >= 0.75
                          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40'
                          : 'bg-amber-900/50 text-amber-300 border border-amber-700/40'
                      }`}
                    >
                      {Math.round(item.poids * 100)}%
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">{item.hits} hits</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel: Detail, Chains & Graph Connections */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#050508]">
        {selectedConcept ? (
          <div className="space-y-5 max-w-4xl mx-auto">
            {/* Header card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl sm:text-2xl font-black text-white capitalize tracking-wide">
                    {selectedConcept}
                  </h3>
                  {currentConceptData?.[0]?.type === 'question_reponse' || currentConceptData?.[0]?.question_origine ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono">
                      Question-Réponse (Q&R)
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono">
                      Concept actif
                    </span>
                  )}
                </div>
                {currentConceptData?.[0]?.question_origine && (
                  <p className="text-xs text-purple-300/90 mt-1 italic font-medium">
                    Question originale : &ldquo;{currentConceptData[0].question_origine}&rdquo;
                  </p>
                )}
                {currentConceptData?.[0]?.mots_cles && currentConceptData[0].mots_cles.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-500 font-mono">Mots-clés déclencheurs :</span>
                    {currentConceptData[0].mots_cles.map(mc => (
                      <span key={mc} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                        {mc}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Enregistré dans la mémoire cognitive locale de KADERBOT
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onAskQuestionAbout(selectedConcept)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Demander au bot</span>
                </button>
                <button
                  onClick={() => {
                    onDeleteConcept(selectedConcept);
                    setSelectedConcept(null);
                  }}
                  className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-500 hover:text-rose-400 hover:border-rose-900/40 transition"
                  title="Supprimer ce concept de la mémoire"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Logical Deduction Chain Visualization */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-cyan-500/20 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Chaîne d’Inférence Logique (Arbre Conceptuel)
                  </h4>
                </div>
                {currentChain && (
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    Confiance : {Math.round(currentChain.confiance * 100)}%
                  </span>
                )}
              </div>

              {currentChain && currentChain.chemin.length > 1 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-mono">
                    {currentChain.chemin.map((node, index) => (
                      <React.Fragment key={index}>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span className="font-bold capitalize">{node}</span>
                        </div>
                        {index < currentChain.chemin.length - 1 && (
                          <span className="text-gray-500 font-bold">est un →</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <p className="text-xs text-gray-400 bg-gray-900/60 p-3 rounded-xl border border-gray-800/80">
                    💡 Grâce à cette chaîne, tout ce qui est vrai pour{' '}
                    <strong className="text-cyan-300">
                      {currentChain.chemin[currentChain.chemin.length - 1]}
                    </strong>{' '}
                    est automatiquement hérité par{' '}
                    <strong className="text-emerald-300">{selectedConcept}</strong> !
                  </p>
                </div>
              ) : (
                <div className="text-xs text-gray-500 bg-gray-900/40 p-3 rounded-xl">
                  Ce concept n'est pas encore relié à un parent (ex: oiseau, animal, langage). Tu
                  peux créer un lien ci-dessous ou dire au bot : « {selectedConcept} est un ... »
                </div>
              )}
            </div>

            {/* Definitions & Weighted Facts */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-3">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                <span>Définitions & Poids de certitude</span>
              </h4>

              <div className="space-y-2">
                {currentConceptData?.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-gray-900/70 border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-gray-200">{entry.def}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 flex-wrap">
                        <span>Source: {entry.source}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          <span>Hits: <strong className="text-emerald-300 font-mono text-xs">{entry.hits}</strong></span>
                          {onAdjustHits && (
                            <span className="inline-flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAdjustHits(selectedConcept, idx, 1);
                                }}
                                className="px-1.5 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-mono text-[10px] border border-emerald-800/50"
                                title="Augmenter les hits (+1)"
                              >
                                +1 hit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAdjustHits(selectedConcept, idx, -1);
                                }}
                                className="px-1.5 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-mono text-[10px] border border-rose-800/50"
                                title="Diminuer les hits (-1)"
                              >
                                -1 hit
                              </button>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {(entry.poids * 100).toFixed(0)}%
                        </span>
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${entry.poids * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onAdjustWeight(selectedConcept, 0.1)}
                          className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[11px] font-mono border border-emerald-800/40"
                          title="Augmenter la confiance"
                        >
                          +0.1
                        </button>
                        <button
                          onClick={() => onAdjustWeight(selectedConcept, -0.1)}
                          className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[11px] font-mono border border-rose-800/40"
                          title="Diminuer la confiance"
                        >
                          -0.1
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add definition form */}
              <form onSubmit={handleAddDefSubmit} className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Ajouter une propriété à "${selectedConcept}"...`}
                  value={newDefInput}
                  onChange={e => setNewDefInput(e.target.value)}
                  className="flex-1 bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="submit"
                  disabled={!newDefInput.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </form>
            </div>

            {/* Hierarchical Links Management (lie: A -> B) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-3">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Liens Parent / Enfant (Taxonomie)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Parents */}
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[11px] text-gray-400 block mb-1.5 font-semibold">
                    Concepts Parents (dont il hérite) :
                  </span>
                  {(liens[selectedConcept] || []).length === 0 ? (
                    <span className="text-gray-500 italic">Aucun parent défini</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {liens[selectedConcept].map(parent => (
                        <span
                          key={parent}
                          className="px-2 py-1 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/40 flex items-center gap-1"
                        >
                          {parent}
                          <button
                            onClick={() => onDeleteLink(selectedConcept, parent)}
                            className="text-gray-500 hover:text-rose-400 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Children */}
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
                  <span className="text-[11px] text-gray-400 block mb-1.5 font-semibold">
                    Concepts Enfants (qui héritent de lui) :
                  </span>
                  {Object.keys(liens).filter(k => (liens[k] || []).includes(selectedConcept)).length === 0 ? (
                    <span className="text-gray-500 italic">Aucun enfant</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(liens)
                        .filter(k => (liens[k] || []).includes(selectedConcept))
                        .map(child => (
                          <span
                            key={child}
                            className="px-2 py-1 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 flex items-center gap-1"
                          >
                            {child}
                            <button
                              onClick={() => onDeleteLink(child, selectedConcept)}
                              className="text-gray-500 hover:text-rose-400 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Link form */}
              <form onSubmit={handleAddLinkSubmit} className="pt-1 flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Lier "${selectedConcept}" comme enfant de (ex: oiseau, mammifère)...`}
                  value={newLinkTarget}
                  onChange={e => setNewLinkTarget(e.target.value)}
                  className="flex-1 bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  type="submit"
                  disabled={!newLinkTarget.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Lier</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
              <Brain className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Graphe Cognitif de KADERBOT</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Sélectionne un concept dans la colonne de gauche pour inspecter sa chaîne de déduction, ses
              liens taxonomiques et ses poids de mémoire.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
