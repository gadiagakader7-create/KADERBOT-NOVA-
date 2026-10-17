import React, { useState } from 'react';
import {
  Scale,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  ArrowRight,
} from 'lucide-react';
import {
  GeneralRule,
  LinksStore,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';
import {
  deduireChaine,
  deduireGeneralisation,
  construirePhraseGeneralisation,
} from '../core/cognitiveEngine';

interface RulesTabProps {
  memoire: MemoryStore;
  regles: RulesStore;
  liens: LinksStore;
  synonymes: SynonymsStore;
  onAddRule: (
    quant: 'tous' | 'aucun' | 'certains',
    sujet: string,
    prop: string,
    poids?: number
  ) => void;
  onDeleteRule: (sujet: string, prop: string) => void;
}

export const RulesTab: React.FC<RulesTabProps> = ({
  memoire,
  regles,
  liens,
  synonymes,
  onAddRule,
  onDeleteRule,
}) => {
  // Simulator state
  const [testSujet, setTestSujet] = useState('moineau');
  const [testProp, setTestProp] = useState('respire');
  const [simulationResult, setSimulationResult] = useState<string | null>(null);

  // Form state
  const [newQuant, setNewQuant] = useState<'tous' | 'aucun' | 'certains'>('tous');
  const [newSujet, setNewSujet] = useState('');
  const [newProp, setNewProp] = useState('');

  const handleSimulate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testSujet.trim() || !testProp.trim()) return;

    const s = testSujet.trim().toLowerCase();
    const p = testProp.trim().toLowerCase();

    // 1. Try generalization syllogism
    const gen = deduireGeneralisation(s, p, memoire, regles, liens, synonymes);
    if (gen) {
      const phrase = construirePhraseGeneralisation(
        s,
        gen.categorie,
        gen.quant,
        gen.prop,
        gen.confiance,
        gen.chemin
      );
      setSimulationResult(phrase);
      return;
    }

    // 2. Try direct property deduction through links
    const chaine = deduireChaine(s, p, memoire, regles, liens, synonymes);
    if (chaine && chaine.propriete_def && chaine.propriete_source) {
      setSimulationResult(
        `${s.charAt(0).toUpperCase() + s.slice(1)} hérite de "${chaine.propriete_source}" qui ${chaine.propriete_def}. Donc ${s} ${p} (confiance ${Math.round(chaine.confiance * 100)}%).`
      );
      return;
    }

    setSimulationResult(
      `Impossible de déduire que "${s}" a pour propriété "${p}". Aucune règle générale ni chaîne conceptuelle trouvée.`
    );
  };

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSujet.trim() || !newProp.trim()) return;
    onAddRule(newQuant, newSujet.trim(), newProp.trim());
    setNewSujet('');
    setNewProp('');
  };

  const allRulesList: Array<{
    sujet: string;
    quant: 'tous' | 'aucun' | 'certains';
    prop: string;
    poids: number;
    hits: number;
  }> = [];

  for (const [sujet, rList] of Object.entries(regles)) {
    for (const r of rList) {
      allRulesList.push({
        sujet,
        quant: r.quant,
        prop: r.prop,
        poids: r.poids,
        hits: r.hits,
      });
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#050508] space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            <span>Moteur d'Inférence & Syllogismes</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Règles logiques universelles et déductions causales inspirées des quantificateurs aristotéliciens.
          </p>
        </div>
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
          {allRulesList.length} règles actives
        </span>
      </div>

      {/* Syllogism Simulator Widget */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0E131F] to-[#0A0D15] border border-emerald-500/30 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Simulateur de Déduction Logique (Test de Syllogisme)
          </h3>
        </div>

        <form onSubmit={handleSimulate} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-[11px] text-gray-400 mb-1">Concept Sujet :</label>
            <input
              type="text"
              placeholder="Ex: moineau, aigle, python..."
              value={testSujet}
              onChange={e => setTestSujet(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="sm:col-span-5">
            <label className="block text-[11px] text-gray-400 mb-1">Propriété à vérifier :</label>
            <input
              type="text"
              placeholder="Ex: respire, vole, a des ailes..."
              value={testProp}
              onChange={e => setTestProp(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Tester</span>
            </button>
          </div>
        </form>

        {simulationResult && (
          <div className="p-3.5 rounded-xl bg-gray-900/90 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 leading-relaxed font-sans shadow-inner">
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono font-bold mb-1">
              Résultat de l’inférence :
            </div>
            {simulationResult}
          </div>
        )}
      </div>

      {/* Add new rule form */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E131F] border border-gray-800 space-y-3">
        <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Enseigner une Règle Générale à KADERBOT</span>
        </h3>

        <form onSubmit={handleAddRuleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-3">
            <label className="block text-[11px] text-gray-400 mb-1">Quantificateur :</label>
            <select
              value={newQuant}
              onChange={e => setNewQuant(e.target.value as any)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
            >
              <option value="tous">Tous les (Universel +)</option>
              <option value="aucun">Aucun (Universel -)</option>
              <option value="certains">Certains (Particulier)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[11px] text-gray-400 mb-1">Catégorie / Sujet :</label>
            <input
              type="text"
              placeholder="Ex: oiseau, poisson..."
              value={newSujet}
              onChange={e => setNewSujet(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[11px] text-gray-400 mb-1">Propriété :</label>
            <input
              type="text"
              placeholder="Ex: a des ailes, vit dans l'eau..."
              value={newProp}
              onChange={e => setNewProp(e.target.value)}
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!newSujet.trim() || !newProp.trim()}
              className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </form>
      </div>

      {/* Rules Grid */}
      <div className="space-y-3">
        <h3 className="text-xs sm:text-sm font-bold text-white">Règles Enregistrées en Mémoire</h3>

        {allRulesList.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500 bg-[#0E131F] rounded-2xl border border-gray-800">
            Aucune règle générale enregistrée pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allRulesList.map((r, idx) => {
              const isTous = r.quant === 'tous';
              const isAucun = r.quant === 'aucun';
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#0E131F] border border-gray-800/80 hover:border-gray-700 transition flex items-center justify-between gap-3 shadow-md"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                          isTous
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                            : isAucun
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                        }`}
                      >
                        {r.quant}
                      </span>
                      <span className="text-xs font-bold text-white capitalize">{r.sujet}s</span>
                    </div>

                    <p className="text-xs text-gray-300">
                      {isAucun ? `ne ${r.prop} pas` : r.prop}
                    </p>

                    <span className="text-[10px] text-gray-500 font-mono mt-1 inline-block">
                      Confiance : {Math.round(r.poids * 100)}% · Hits: {r.hits}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteRule(r.sujet, r.prop)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-gray-800 transition"
                    title="Supprimer cette règle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
