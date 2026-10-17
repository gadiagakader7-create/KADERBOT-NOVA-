import React, { useState } from 'react';
import {
  X,
  Database,
  GitBranch,
  Sparkles,
  Lightbulb,
  Languages,
  HelpCircle,
  FolderTree,
  Trash2,
  List,
  Search,
} from 'lucide-react';

interface ActionMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (cmd: string, executeImmediately?: boolean) => void;
}

export const ActionMenuModal: React.FC<ActionMenuModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('memoire');
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const categories = [
    { id: 'memoire', label: 'Mémoire', icon: Database, color: 'text-emerald-400' },
    { id: 'liens', label: 'Liens & Arbre', icon: GitBranch, color: 'text-cyan-400' },
    { id: 'groq', label: 'IA & LLM', icon: Sparkles, color: 'text-amber-400' },
    { id: 'idees', label: 'Idées', icon: Lightbulb, color: 'text-yellow-400' },
    { id: 'texte', label: 'Traduction & Texte', icon: Languages, color: 'text-purple-400' },
    { id: 'questions', label: 'Questions & Déduction', icon: HelpCircle, color: 'text-blue-400' },
    { id: 'sessions', label: 'Sessions', icon: FolderTree, color: 'text-teal-400' },
    { id: 'oubli', label: 'Oubli Intelligent', icon: Trash2, color: 'text-rose-400' },
    { id: 'divers', label: 'Divers & Stats', icon: List, color: 'text-gray-400' },
  ];

  const actionsMap: Record<
    string,
    Array<{ cmd: string; label: string; desc: string; immediate?: boolean }>
  > = {
    memoire: [
      { cmd: 'retiens: ', label: 'Retenir un fait', desc: 'Syntaxe: retiens: chat = un animal felin' },
      { cmd: 'retiens: tous les ', label: 'Règle universelle', desc: 'Syntaxe: retiens: tous les oiseaux volent' },
      { cmd: 'retiens: aucun ', label: 'Règle négative', desc: 'Syntaxe: retiens: aucun poisson ne respire dans lair' },
      { cmd: 'retiens: certains ', label: 'Règle particulière', desc: 'Syntaxe: retiens: certains chiens chassent' },
      { cmd: 'retiens masse: ', label: 'Retenir en masse', desc: 'Plusieurs faits séparés par des points' },
      { cmd: 'lister: memoire', label: 'Lister la mémoire', desc: 'Affiche tous les sujets mémorisés', immediate: true },
      { cmd: 'lister: poids', label: 'Lister les poids', desc: 'Affiche les coefficients de confiance', immediate: true },
      { cmd: 'lister: incertains', label: 'Concepts incertains', desc: 'Concepts avec confiance < 50%', immediate: true },
      { cmd: 'lister: regles', label: 'Lister les règles', desc: 'Affiche toutes les règles logiques', immediate: true },
    ],
    liens: [
      { cmd: 'lie: ', label: 'Lier deux concepts', desc: 'Syntaxe: lie: moineau -> oiseau' },
      { cmd: 'delie: ', label: 'Supprimer un lien', desc: 'Syntaxe: delie: moineau -> oiseau' },
      { cmd: 'liens: ', label: 'Inspecter les liens', desc: 'Affiche parents, enfants et chaîne' },
      { cmd: 'cousins: ', label: 'Ancêtres communs', desc: 'Syntaxe: cousins: moineau, aigle' },
    ],
    groq: [
      { cmd: 'groq: ', label: 'Interroger LLM direct', desc: 'Pose une question directe au modèle' },
      { cmd: 'groq on', label: 'Activer LLM Cloud', desc: 'Autorise les réponses étendues', immediate: true },
      { cmd: 'groq off', label: 'Désactiver LLM', desc: 'Mode cognitif 100% local', immediate: true },
      { cmd: 'groq statut', label: 'Statut du LLM', desc: 'Vérifie l’état de connexion', immediate: true },
      { cmd: 'contexte', label: 'Afficher contexte', desc: 'Affiche l’historique glissant', immediate: true },
      { cmd: 'reset contexte', label: 'Vider le contexte', desc: 'Réinitialise le fil de mémoire', immediate: true },
      { cmd: 'lister: groq', label: 'Logs des échanges', desc: 'Derniers apprentissages du LLM', immediate: true },
    ],
    idees: [
      { cmd: 'idees 5: ', label: '5 Idées créatives', desc: 'Génère 5 idées percutantes' },
      { cmd: 'idees 5 drole: ', label: '5 Idées drôles', desc: 'Idées humoristiques et décalées' },
      { cmd: 'idees 5 poetique: ', label: '5 Idées poétiques', desc: 'Idées imagées et sensibles' },
      { cmd: 'idees 5 absurde: ', label: '5 Idées absurdes', desc: 'Idées inattendues et loufoques' },
      { cmd: 'idee 1: ', label: 'Développer une idée', desc: 'Développe l’idée n°1 en détail' },
      { cmd: 'lister: idees', label: 'Historique des idées', desc: 'Affiche le fichier des idées générées', immediate: true },
    ],
    texte: [
      { cmd: 'traduis en anglais: ', label: 'Traduire en anglais', desc: 'Traduction automatique' },
      { cmd: 'traduis en arabe: ', label: 'Traduire en arabe', desc: 'Traduction automatique' },
      { cmd: 'traduis en espagnol: ', label: 'Traduire en espagnol', desc: 'Traduction automatique' },
      { cmd: 'corrige: ', label: 'Corriger un texte', desc: 'Orthographe, grammaire et ponctuation' },
      { cmd: 'resume: ', label: 'Résumer un texte', desc: 'Synthèse en 2-3 phrases' },
    ],
    questions: [
      { cmd: "c'est quoi ", label: "Qu'est-ce que c'est ?", desc: 'Définition exacte ou déduite' },
      { cmd: 'pourquoi ', label: 'Pourquoi ? (Déduction)', desc: 'Recherche la chaîne causale logique' },
      { cmd: 'parle-moi de ', label: 'Explication complète', desc: 'Tout ce que le bot sait du sujet' },
      { cmd: 'proche: ', label: 'Recherche floue', desc: 'Trouve les mots proches phonétiquement' },
      { cmd: 'chercher: ', label: 'Chercher dans la mémoire', desc: 'Recherche par mot-clé' },
    ],
    sessions: [
      { cmd: 'session active', label: 'Session courante', desc: 'Affiche la session active', immediate: true },
      { cmd: 'sessions', label: 'Toutes les sessions', desc: 'Liste les profils disponibles', immediate: true },
      { cmd: 'session defaut', label: 'Session défaut', desc: 'Recharge la base principale', immediate: true },
      { cmd: 'session ', label: 'Créer / Charger', desc: 'Syntaxe: session science' },
    ],
    oubli: [
      { cmd: 'oublier: ', label: 'Oublier un fait/sujet', desc: 'Syntaxe: oublier: sujet ou oublier: sujet = def' },
      { cmd: 'oublier en masse: ', label: 'Oublier plusieurs', desc: 'Séparer par des virgules ou points' },
    ],
    divers: [
      { cmd: 'lister: stats', label: 'Statistiques globales', desc: 'Mots, règles, graphe, mémoire', immediate: true },
      { cmd: 'synonymes: ', label: 'Gérer les synonymes', desc: 'Syntaxe: synonymes: auto = voiture | bagnole' },
      { cmd: 'lire: conversations', label: 'Lire les logs lisibles', desc: 'Derniers échanges de la conversation', immediate: true },
      { cmd: 'effacer conversations', label: 'Purger les logs', desc: 'Réinitialise le fichier lisible', immediate: true },
    ],
  };

  const handleActionClick = (cmd: string, immediate?: boolean) => {
    onSelectAction(cmd, immediate);
    onClose();
  };

  const currentActions = actionsMap[activeCategory] || [];
  const filteredActions = searchFilter
    ? Object.values(actionsMap)
        .flat()
        .filter(
          a =>
            a.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
            a.cmd.toLowerCase().includes(searchFilter.toLowerCase()) ||
            a.desc.toLowerCase().includes(searchFilter.toLowerCase())
        )
    : currentActions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0E131F] border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800/80 bg-[#090B10]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Menu des Commandes KADERBOT</h2>
              <p className="text-[11px] text-gray-400">Toutes les actions du script Python d’origine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="p-3 border-b border-gray-800/60 bg-gray-900/50">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrer une commande ou une action (ex: retiens, liens, groq...)"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full bg-[#090B10] border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Content body with sidebar categories */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar categories (hidden if searching) */}
          {!searchFilter && (
            <div className="w-44 sm:w-48 border-r border-gray-800/60 overflow-y-auto p-2 space-y-1 bg-[#090B10]/60 flex-shrink-0">
              {categories.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                      isActive
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${cat.color}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons list */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2">
            {filteredActions.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">
                Aucune commande ne correspond à votre recherche.
              </div>
            ) : (
              filteredActions.map((action, idx) => (
                <div
                  key={idx}
                  onClick={() => handleActionClick(action.cmd, action.immediate)}
                  className="group p-3 rounded-xl bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/80 hover:border-emerald-500/40 cursor-pointer transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                        {action.cmd}
                      </code>
                      <span className="text-xs font-semibold text-white truncate">{action.label}</span>
                      {action.immediate && (
                        <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.5 rounded font-mono">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 truncate">{action.desc}</p>
                  </div>
                  <span className="text-xs font-medium text-emerald-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    Insérer →
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-gray-800/80 bg-[#090B10] flex items-center justify-between text-[11px] text-gray-400">
          <span>Clique sur une action pour l’insérer instantanément dans la barre de saisie.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
