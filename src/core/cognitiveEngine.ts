import { pipeline, env } from '@xenova/transformers';
import {
  ChatMessage,
  GeneralRule,
  LinksStore,
  MemoryEntry,
  MemoryStore,
  RulesStore,
  SynonymsStore,
} from '../types/kaderbot';

// Configuration de transformers.js pour l'environnement navigateur
// Permet de télécharger le modèle léger depuis le hub HuggingFace et de le mettre en cache local
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton d'extraction d'embeddings côté client
let extracteurEmbeddingsPromise: Promise<any> | null = null;

/**
 * Initialise de manière paresseuse le pipeline d'embeddings Xenova/all-MiniLM-L6-v2.
 * Ce modèle produit des vecteurs de dimension 384 rapides et optimisés pour la recherche sémantique.
 */
export async function obtenirExtracteurEmbeddings() {
  if (!extracteurEmbeddingsPromise) {
    extracteurEmbeddingsPromise = pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true }
    );
  }
  return extracteurEmbeddingsPromise;
}

/**
 * Calcule le vecteur d'embedding pour une chaîne de texte donnée.
 * La normalisation L2 et le pooling moyen sont appliqués pour une comparaison directe par produit scalaire.
 */
export async function calculerVecteur(texte: string): Promise<number[]> {
  if (!texte || !texte.trim()) return [];
  try {
    const extractor = await obtenirExtracteurEmbeddings();
    const output = await extractor(texte.trim(), { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  } catch (error) {
    console.warn('Erreur lors du calcul de vecteur d’embedding:', error);
    return [];
  }
}

// Cache mémoire en arrière-plan pour éviter de recalculer les vecteurs déjà générés
const cacheEmbeddings = new Map<string, number[]>();

/**
 * Récupère un vecteur déjà en cache ou le calcule si nécessaire.
 */
export async function obtenirVecteurCache(texte: string): Promise<number[]> {
  const cle = texte.trim().toLowerCase();
  if (cacheEmbeddings.has(cle)) {
    return cacheEmbeddings.get(cle)!;
  }
  const vec = await calculerVecteur(texte);
  if (vec.length > 0) {
    cacheEmbeddings.set(cle, vec);
  }
  return vec;
}

/**
 * Calcule la similarité cosinus entre deux vecteurs numériques.
 * Résultat compris entre -1.0 et 1.0 (ou 0.0 et 1.0 pour des vecteurs normalisés).
 */
export function similariteCosinus(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let produit = 0;
  let normeA = 0;
  let normeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    produit += vecA[i] * vecB[i];
    normeA += vecA[i] * vecA[i];
    normeB += vecB[i] * vecB[i];
  }
  if (normeA === 0 || normeB === 0) return 0;
  return produit / (Math.sqrt(normeA) * Math.sqrt(normeB));
}

/**
 * Compare sémantiquement la question de l'utilisateur avec toutes les connaissances stockées.
 * Seuil par défaut : 0.80 pour garantir une forte pertinence sans faux positifs.
 */
export async function trouverSensSimilaire(
  question: string,
  memoire: MemoryStore,
  seuilSimilarite = 0.80
): Promise<{ sujet: string; entry: MemoryEntry; score: number } | null> {
  if (!question || !memoire || Object.keys(memoire).length === 0) return null;

  try {
    const questionVec = await obtenirVecteurCache(question);
    if (!questionVec || questionVec.length === 0) return null;

    let meilleurMatch: { sujet: string; entry: MemoryEntry; score: number } | null = null;
    let maxScore = -1;

    for (const [sujet, entries] of Object.entries(memoire)) {
      for (const entry of entries) {
        let entryVec = entry.vecteur;
        if (!entryVec || entryVec.length === 0) {
          // Si l'entrée n'a pas encore son vecteur, le calculer à partir du contenu ou de la question d'origine
          const texteRef = entry.question_origine
            ? `${entry.question_origine} (${sujet})`
            : `${sujet} : ${entry.def}`;
          entryVec = await obtenirVecteurCache(texteRef);
          entry.vecteur = entryVec;
        }

        const score = similariteCosinus(questionVec, entryVec);
        if (score > maxScore) {
          maxScore = score;
          meilleurMatch = { sujet, entry, score };
        }
      }
    }

    if (meilleurMatch && maxScore >= seuilSimilarite) {
      return meilleurMatch;
    }
    return null;
  } catch (err) {
    console.warn('Erreur lors de la recherche sémantique:', err);
    return null;
  }
}

/**
 * Résout les pronoms anaphoriques ("il", "elle", "ça", "sa taille") à l'aide des 5 derniers messages
 * pour enrichir la question et préserver la continuité du dialogue.
 */
export function resoudrePronomsAvecHistorique(
  question: string,
  historiqueMessages: ChatMessage[]
): string {
  if (!question) return '';
  const qClean = sansAccent(question.toLowerCase().trim());
  const mots = qClean.match(/\w+/g) || [];

  const aPronom = mots.some(w => PRONOMS_CONTEXTE.has(w));
  if (!aPronom || !historiqueMessages || historiqueMessages.length === 0) {
    return question;
  }

  // Explore les 5 derniers messages en partant du plus récent
  const recents = historiqueMessages.slice(-5).reverse();
  for (const msg of recents) {
    if (msg.meta?.sujet) {
      return `${question} (${msg.meta.sujet})`;
    }
    const motsCles = extraireMotsCles(msg.text);
    if (motsCles.length > 0) {
      return `${question} (${motsCles[0]})`;
    }
  }

  return question;
}

/**
 * Évalue localement une expression arithmétique ou mathématique si la question le demande.
 * Ex: "combien fait 15 * 8", "calcule 120 / 4", "25 + 75"
 */
export function evaluerCalculMath(texte: string): string | null {
  if (!texte) return null;
  const tClean = sansAccent(texte.toLowerCase().trim())
    .replace(/^combien\s+(?:fait|font|mesure|vaut)\s*/, '')
    .replace(/^calcule(?:\s+moi)?\s*/, '')
    .replace(/^quel\s+est\s+le\s+resultat\s+de\s*/, '')
    .replace(/[?=]/g, '')
    .trim();

  // Test si c'est une expression arithmétique licite avec chiffres et opérateurs
  const sanitized = tClean.replace(/\s+/g, '').replace(/x/g, '*').replace(/÷/g, '/');
  if (/^[0-9+\-*/().^%]+$/.test(sanitized) && /[0-9]/.test(sanitized) && /[+\-*/^%]/.test(sanitized)) {
    try {
      const fn = new Function(`return (${sanitized.replace(/\^/g, '**')});`);
      const res = fn();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return `Le résultat de ce calcul est ${res}.`;
      }
    } catch {}
  }
  return null;
}

export const DEFAULT_POIDS = 0.8;

export const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des',
  'de', 'du', 'd', 'dans', 'sur', 'sous',
  'et', 'ou', 'mais', 'donc', 'car',
  'est', 'sont', 'etre', 'a', 'au', 'aux',
  'pour', 'par', 'avec', 'sans',
  'qui', 'que', 'quoi', 'qu', 'comment',
  'pourquoi', 'quand', 'ou',
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa',
  'ce', 'cet', 'cette', 'ces',
  'en', 'y',
]);

export const PRONOMS_CONTEXTE = new Set([
  'il', 'elle', 'ils', 'elles', 'l', 'le', 'la', 'les', 'lui',
  'leur', 'ca', 'cela', 'ce', 'cet', 'cette', 'son', 'sa', 'ses',
  'leur', 'leurs', 'celui', 'celle', "l'", "qu'il", "qu'elle",
]);

export const SALUTATIONS = [
  'bonjour', 'salut', 'coucou', 'hey', 'yo', 'bonsoir', 'wesh',
  'hello', 'bjr', 'slt', 'au revoir', 'a bientot', 'a plus',
  'merci', 'de rien',
];

export const RS: Record<string, string[]> = {
  bonjour: ['Bonjour !', 'Salut !', 'Coucou !', 'Hey, content de te voir !', 'Bonjour, comment ça va aujourd’hui ?'],
  salut: ['Salut !', 'Bonjour !', 'Hey !', 'Salut, quoi de neuf ?'],
  coucou: ['Coucou !', 'Salut !', 'Bonjour !', 'Coucou, tu vas bien ?'],
  hey: ['Hey !', 'Salut !', 'Bonjour !'],
  yo: ['Yo !', 'Salut !', 'Bonjour !'],
  bonsoir: ['Bonsoir !', 'Salut !', 'Bonsoir, comment s’est passée ta journée ?'],
  wesh: ['Wesh !', 'Salut !', 'Wesh bien ou quoi ?'],
  hello: ['Hello !', 'Bonjour !', 'Salut !'],
  bjr: ['Bonjour !', 'Salut !'],
  slt: ['Salut !', 'Bonjour !'],
  'au revoir': ['Au revoir !', 'À bientôt !', 'Salut !', 'À plus tard !'],
  'a bientot': ['À bientôt !', 'Au revoir !', 'On se revoit vite !'],
  'a plus': ['À plus !', 'À bientôt !', 'Salut !'],
  merci: ['De rien !', 'Avec plaisir !', 'Je t’en prie !', 'Pas de souci, c’est normal !'],
  'de rien': ['Il n’y a pas de quoi !', 'C’est normal !', 'Avec plaisir !'],
};

export const SUITES = [
  ' Tu vas bien ?',
  ' Comment ça va ?',
  ' Ça va ?',
  ' Quoi de neuf ?',
  ' Content de te voir !',
];

export const PE: Record<string, { reponses: string[]; synonymes: string[] }> = {
  'je suis content': { reponses: ['Super ! Content pour toi !', 'Génial ! Qu’est-ce qui te rend content ?', 'Tant mieux ! Profite bien !'], synonymes: ['je suis joyeux'] },
  'je suis triste': { reponses: ['Oh, je suis désolé... Qu’est-ce qui ne va pas ?', 'Tu veux en parler ? Je suis là.'], synonymes: ['j’ai du chagrin'] },
  'je suis en colere': { reponses: ['Calme-toi, respire profondément.', 'Qu’est-ce qui t’énerve ?'], synonymes: ['je ne suis pas content'] },
  "j'ai peur": { reponses: ['N’aie pas peur, je suis là.', 'Qu’est-ce qui te fait peur ?'], synonymes: ['je suis inquiet'] },
  'je suis surpris': { reponses: ['Surprenant, non ?', 'Je ne m’y attendais pas non plus !'], synonymes: ["c'est etonnant"] },
  "je t'aime": { reponses: ['Moi aussi, je t’apprécie !', 'C’est gentil !', 'Ça me touche vraiment.'], synonymes: ['tu es important'] },
  'je suis decu': { reponses: ['C’est dommage...', 'Je comprends, ce n’est pas ce que tu espérais.'], synonymes: ["pas ce que j'esperais"] },
  'je suis fatigue': { reponses: ['Repose-toi bien.', 'Tu devrais faire une petite pause.'], synonymes: ['besoin de repos'] },
  'je suis calme': { reponses: ['C’est parfait, reste comme ça.', 'Cool, zen attitude !'], synonymes: ['paisible'] },
  'je suis stresse': { reponses: ['Respire profondément...', 'Prends une pause, ça ira mieux.'], synonymes: ['pression'] },
  'ca me fait plaisir': { reponses: ['Tant mieux !', 'Ça fait plaisir à entendre !'], synonymes: ['content de ca'] },
  "ca m'enerve": { reponses: ['Calme-toi, ça va passer.', 'Je comprends, c’est énervant.'], synonymes: ['en colere'] },
};

export const STYLES_IDEES: Record<string, string> = {
  serieux: 'Sois concret, pragmatique et professionnel.',
  drole: 'Sois humoristique, décalé et amusant.',
  poetique: 'Sois poétique, imagé et sensible.',
  absurde: 'Sois totalement absurde, inattendu et loufoque.',
  creatif: 'Sois original, surprenant et imaginatif.',
  scientifique: 'Sois rigoureux, factuel et précis.',
  philosophique: 'Sois profond, réflexif et nuancé.',
};

export const INTENTIONS_KEYWORDS: Record<string, string[]> = {
  salutation: ['bonjour', 'salut', 'coucou', 'hey', 'yo', 'bjr', 'slt', 'bonsoir', 'hello', 'wesh'],
  definition: ["c'est quoi", 'c quoi', "qu'est ce que", 'quest ce que', 'qui est', 'definition', "c'est quoi un", "c'est quoi une", 'parle moi de', 'parle-moi de', 'dis moi ce que', "c'est qui"],
  usage: ['a quoi sert', 'sert a quoi', 'a quoi ca sert', 'pour quoi faire', 'utilite', 'comment utiliser', 'sert a'],
  pourquoi: ['pourquoi', 'raison', 'cause', 'explique pourquoi', 'pourquoi est ce que'],
  emotion: ['je suis', "j'ai peur", "je t'aime", 'je suis triste', 'je suis content', 'fatigue', 'colere', 'stresse', 'peur'],
  memoire_ajout: ['retiens', 'apprends', 'souviens', 'enregistre', 'note que'],
  memoire_suppression: ['oublier', 'supprime', 'efface'],
  recherche: ['chercher', 'lister', 'resume', 'cherche', 'liste'],
  synonyme: ['synonymes', 'synonyme', 'equivaut', 'pareil que', 'veut dire'],
};

export function sansAccent(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a.length < b.length) return levenshtein(b, a);
  if (b.length === 0) return a.length;
  let lignePrec = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const ligne = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cout = a[i] === b[j] ? 0 : 1;
      ligne.push(Math.min(ligne[j] + 1, lignePrec[j + 1] + 1, lignePrec[j] + cout));
    }
    lignePrec = ligne;
  }
  return lignePrec[b.length];
}

export function similarite(a: string, b: string): number {
  if (!a || !b) return 0.0;
  if (a === b) return 1.0;
  const d = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1.0 - d / maxLen : 0.0;
}

export function corriger(
  mot: string,
  memoire: MemoryStore,
  regles: RulesStore,
  synonymes: SynonymsStore
): string | null {
  const m = mot.toLowerCase().trim();
  if (synonymes[m]) {
    const v = synonymes[m];
    if (typeof v === 'string') return v;
  }
  for (const [canon, lst] of Object.entries(synonymes)) {
    if (Array.isArray(lst) && lst.includes(m)) {
      return canon;
    }
  }
  if (memoire[m] || regles[m]) return m;
  const sa = sansAccent(m);
  for (const key of [...Object.keys(memoire), ...Object.keys(regles)]) {
    if (sansAccent(key.toLowerCase()) === sa) return key;
  }
  return rechercherFlou(m, memoire, regles, 0.72);
}

export function singulariser(
  mot: string,
  memoire: MemoryStore,
  regles: RulesStore,
  synonymes: SynonymsStore
): string {
  const m = mot.toLowerCase().trim();
  if (m.endsWith('aux')) {
    const base = m.slice(0, -3) + 'al';
    if (corriger(base, memoire, regles, synonymes)) return base;
    return m.slice(0, -1);
  }
  if (m.endsWith('eaux')) {
    return m.slice(0, -1);
  }
  if (m.endsWith('s') && m.length > 3) {
    const sing = m.slice(0, -1);
    if (corriger(sing, memoire, regles, synonymes) || memoire[sing] || regles[sing]) {
      return sing;
    }
    return sing;
  }
  return m;
}

export function rechercherFlou(
  mot: string,
  memoire: MemoryStore,
  regles: RulesStore,
  seuil = 0.7
): string | null {
  const motNorm = sansAccent(mot.toLowerCase().trim());
  if (!motNorm) return null;
  const keys = Array.from(new Set([...Object.keys(memoire), ...Object.keys(regles)]));
  let meilleur: string | null = null;
  let meilleurScore = 0.0;
  for (const cle of keys) {
    const normalise = sansAccent(cle.toLowerCase());
    let score = similarite(motNorm, normalise);
    if (motNorm.includes(normalise) || normalise.includes(motNorm)) {
      score += 0.15;
    }
    if (motNorm.length >= 3 && normalise.startsWith(motNorm.slice(0, 3))) {
      score += 0.1;
    }
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = cle;
    }
  }
  return meilleurScore >= seuil ? meilleur : null;
}

export function extraireQuantificateur(phrase: string): {
  quant: 'tous' | 'aucun' | 'certains';
  sujet: string;
  prop: string;
} | null {
  const q = sansAccent(phrase.toLowerCase().trim());
  const patterns = [
    /^(tous|toutes)\s+(?:les\s+)?([a-z]+)\s+(?:ne\s+)?([a-z\s]+)/,
    /^(aucun|aucune)\s+(?:les\s+)?([a-z]+)\s+(?:ne\s+)?([a-z\s]+)/,
    /^(certains|certaines)\s+(?:les\s+)?([a-z]+)\s+(?:ne\s+)?([a-z\s]+)/,
    /^(chaque)\s+([a-z]+)\s+([a-z\s]+)/,
  ];

  for (const pat of patterns) {
    const m = q.match(pat);
    if (m) {
      const quantRaw = m[1];
      const sujetRaw = m[2];
      const propRaw = m[3];
      let quant: 'tous' | 'aucun' | 'certains' = 'tous';
      if (['tous', 'toutes', 'chaque'].includes(quantRaw)) quant = 'tous';
      else if (['aucun', 'aucune'].includes(quantRaw)) quant = 'aucun';
      else quant = 'certains';
      return {
        quant,
        sujet: sujetRaw.trim(),
        prop: propRaw.trim(),
      };
    }
  }
  return null;
}

export function classifierIntention(question: string): string {
  try {
    const q = sansAccent(question.toLowerCase());
    const scores: Record<string, number> = {};
    for (const [intent, motscles] of Object.entries(INTENTIONS_KEYWORDS)) {
      let sc = 0;
      for (const mc of motscles) {
        const mcNorm = sansAccent(mc.toLowerCase());
        if (q.includes(mcNorm)) {
          sc += q.startsWith(mcNorm) ? 2 : 1;
        }
      }
      scores[intent] = sc;
    }
    let best = 'incompris';
    let maxSc = 0;
    for (const [k, v] of Object.entries(scores)) {
      if (v > maxSc) {
        maxSc = v;
        best = k;
      }
    }
    return maxSc === 0 ? 'incompris' : best;
  } catch {
    return 'incompris';
  }
}

export function detecterEtat(msg: string): string | null {
  const mn = sansAccent(msg.toLowerCase().trim());
  for (const [p, d] of Object.entries(PE)) {
    if (mn.includes(sansAccent(p))) return p;
    for (const s of d.synonymes) {
      if (mn.includes(sansAccent(s))) return p;
    }
  }
  return null;
}

export function repondreEtat(etat: string): string {
  const choices = PE[etat]?.reponses || ['Je comprends.'];
  return choices[Math.floor(Math.random() * choices.length)];
}

export function estSalutationPure(m: string): boolean {
  return SALUTATIONS.includes(sansAccent(m.toLowerCase().trim()));
}

export function estSalutation(q: string): string | null {
  const qq = sansAccent(q.toLowerCase().trim().replace(/[!?.]/g, ''));
  for (const mi of ["c'est quoi", 'quoi sert', 'chercher', 'retiens', 'lire', 'oublier', 'resume', 'definir', 'synonymes', 'pourquoi', 'parle moi']) {
    if (qq.includes(mi)) return null;
  }
  for (const s of SALUTATIONS) {
    if (qq === s || qq.startsWith(s + ' ') || qq.endsWith(' ' + s)) return s;
  }
  return null;
}

export function repondreSalutation(c: string): string {
  const list = RS[c] || ['Salut !'];
  const base = list[Math.floor(Math.random() * list.length)];
  if (['bonjour', 'salut', 'coucou', 'hey', 'yo', 'hello'].includes(c)) {
    const suite = SUITES[Math.floor(Math.random() * SUITES.length)];
    return base + suite;
  }
  return base;
}

export function resoudreContexte(question: string, contexte: string[]): string | null {
  const q = sansAccent(question.toLowerCase());
  const mots = q.match(/\w+/g) || [];
  if (mots.length <= 6 && contexte.length > 0) {
    for (const p of PRONOMS_CONTEXTE) {
      if (q.includes(` ${p} `) || q.startsWith(`${p} `) || q.includes(`${p}'`)) {
        return contexte[contexte.length - 1];
      }
    }
  }
  return null;
}

export function extraireIsA(definition: string): string | null {
  const d = sansAccent(definition.toLowerCase());
  const m = d.match(/((?:est\s+)?un(?:e)?\s+[a-z]+)/);
  if (m) {
    return m[1].replace(/^est\s+/, '').trim();
  }
  const m2 = d.match(/(?:est\s+)?un(?:e)?\s+([a-z]+)/);
  if (m2) {
    return m2[1].trim();
  }
  return null;
}

export const MOTS_INTERROGATIFS_ET_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l',
  'ce', 'cet', 'cette', 'ces',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
  'notre', 'votre', 'leur', 'nos', 'vos', 'leurs',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'me', 'te', 'se', 'moi', 'toi', 'lui', 'eux',
  'est', 'sont', 'etre', 'ete', 'etes', 'sommes', 'suis', 'es',
  'a', 'ai', 'as', 'ont', 'avons', 'avez', 'avoir', 'eu',
  'dans', 'en', 'sur', 'sous', 'par', 'pour', 'avec', 'sans', 'vers', 'chez',
  'et', 'ou', 'mais', 'donc', 'car', 'ni',
  'qui', 'que', 'quoi', 'qu', 'dont', 'ou',
  'comment', 'pourquoi', 'quand', 'combien', 'quel', 'quelle', 'quels', 'quelles',
  'peux', 'peut', 'peuvent', 'pouvez', 'pourrais', 'pourrait',
  'sais', 'sait', 'savez', 'savent',
  'veux', 'veut', 'voulez', 'veulent',
  'dis', 'dit', 'dites', 'dire',
  'explique', 'expliquer', 'donne', 'donner', 'raconte', 'raconter',
  'fait', 'faire', 'font', 'fais',
  'voici', 'voila', 'bonjour', 'salut', 'merci',
]);

export function extraireMotsCles(texte: string): string[] {
  if (!texte) return [];
  const tNorm = sansAccent(texte.toLowerCase()).replace(/[^a-z0-9\s]/g, ' ');
  const words = tNorm
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !MOTS_INTERROGATIFS_ET_VIDES.has(w) && !PRONOMS_CONTEXTE.has(w));
  return Array.from(new Set(words));
}

export function normaliserQuestionCle(question: string): string {
  if (!question) return '';
  let q = sansAccent(question.toLowerCase().trim());
  q = q.replace(/[?!.,;:()"\']+/g, ' ').replace(/\s+/g, ' ').trim();
  return q;
}

export function estRequeteDefinition(texte: string): { estDef: boolean; concept?: string } {
  if (!texte) return { estDef: false };
  const tClean = sansAccent(texte.toLowerCase().trim()).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Concept direct seul (1 ou 2 mots max, avec ou sans article, ex: "moineau", "le moineau", "trou noir")
  const mConceptSeul = tClean.match(/^(?:le |la |les |un |une |des |l |d )?([a-z0-9_-]+(?:\s+[a-z0-9_-]+)?)$/i);
  if (mConceptSeul && mConceptSeul[1]) {
    const cand = mConceptSeul[1].trim();
    if (!MOTS_INTERROGATIFS_ET_VIDES.has(cand) && cand.length >= 3) {
      return { estDef: true, concept: cand };
    }
  }

  // 2. Formulations explicites de demande de définition
  const defPrefixes = [
    "c'est quoi ", 'c quoi ', "qu'est ce que ", 'qu est ce que ', "qu'est-ce que ",
    'qui est ', 'qui sont ', "c'est qui ", 'definition de ', 'definition du ', 'definition d ',
    'parle moi de ', 'parle-moi de ', 'dis moi ce que ', 'dis-moi ce que ',
    'que sais tu sur ', 'que sais-tu sur ', 'tu sais quoi sur ',
    'explique moi ce que ', 'explique-moi ce que ', 'definir ', 'definis '
  ];

  for (const pref of defPrefixes) {
    const prefNorm = sansAccent(pref);
    if (tClean.startsWith(prefNorm)) {
      let rest = tClean.slice(prefNorm.length).trim();
      rest = rest.replace(/^(?:le |la |les |un |une |des |l |d )/i, '').trim();
      if (rest.length >= 2 && !MOTS_INTERROGATIFS_ET_VIDES.has(rest)) {
        return { estDef: true, concept: rest };
      }
    }
  }

  return { estDef: false };
}

export function extraireX(
  qs: string,
  memoire: MemoryStore,
  regles: RulesStore,
  synonymes: SynonymsStore,
  contexte: string[]
): string | null {
  const ql = sansAccent(qs.toLowerCase().trim());
  if (estSalutationPure(ql)) return null;

  // 1. Déduction causale "pourquoi [le|la|un...] [sujet]"
  const mPourquoi = ql.match(/pourquoi\s+(?:le|la|les|un|une)?\s*([a-z]+)/);
  if (mPourquoi) {
    const cand = corriger(mPourquoi[1].trim(), memoire, regles, synonymes) || mPourquoi[1].trim();
    if (!MOTS_VIDES.has(cand) && !PRONOMS_CONTEXTE.has(cand)) return cand;
  }

  // 2. Définitions explicites : c'est quoi, qu'est-ce que, qui est, parle-moi de...
  const defCheck = estRequeteDefinition(qs);
  if (defCheck.estDef && defCheck.concept) {
    const cand = corriger(defCheck.concept, memoire, regles, synonymes) || defCheck.concept;
    if (!MOTS_VIDES.has(cand)) return cand;
  }

  // 3. Pronoms anaphoriques résolus avec le contexte actif
  const ctx = resoudreContexte(qs, contexte);
  if (ctx) return ctx;

  // 4. Message court spécifiant un concept direct
  const qClean = ql.replace(/[^a-z0-9 ]/g, ' ');
  const mots = qClean.split(/\s+/).filter(w => w.length >= 2 && !MOTS_VIDES.has(w) && !PRONOMS_CONTEXTE.has(w));
  
  if (mots.length === 1 || mots.length === 2) {
    const multiCand = mots.join(' ');
    if (memoire[multiCand] || regles[multiCand]) return multiCand;

    for (let i = mots.length - 1; i >= 0; i--) {
      const w = mots[i];
      const c = corriger(w, memoire, regles, synonymes);
      if (c && !estSalutationPure(c)) return c;
      const flou = rechercherFlou(w, memoire, regles, 0.72);
      if (flou && !estSalutationPure(flou)) return flou;
    }
  }

  return null;
}

export function naviguerLiens(sujet: string, liens: LinksStore, maxDepth = 10): string[] {
  const s = sujet.toLowerCase().trim();
  const chemin = [s];
  const visites = new Set([s]);
  let courant = s;
  for (let i = 0; i < maxDepth; i++) {
    const suivants = (liens[courant] || []).filter(item => !visites.has(item));
    if (suivants.length === 0) break;
    courant = suivants[0];
    visites.add(courant);
    chemin.push(courant);
  }
  return chemin;
}

export function trouverLiensCommuns(sujet1: string, sujet2: string, liens: LinksStore): string[] {
  const ancetres1 = new Set(naviguerLiens(sujet1, liens, 10));
  const ancetres2 = new Set(naviguerLiens(sujet2, liens, 10));
  return Array.from(ancetres1).filter(x => ancetres2.has(x) && x !== sujet1 && x !== sujet2);
}

export function deduireChaine(
  sujet: string,
  prop = '',
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore,
  maxDepth = 20
): {
  chemin: string[];
  propriete_source?: string;
  propriete_def?: string;
  confiance: number;
} | null {
  const s = (corriger(sujet, memoire, regles, synonymes) || sujet).toLowerCase().trim();
  const pNorm = sansAccent(prop.toLowerCase().trim());

  const chaineLiens = naviguerLiens(s, liens, maxDepth);
  if (!pNorm && chaineLiens.length > 1) {
    return { chemin: chaineLiens, confiance: 0.95 };
  }
  if (pNorm && chaineLiens.length > 1) {
    for (const ancetre of chaineLiens) {
      if (regles[ancetre]) {
        for (const regle of regles[ancetre]) {
          if (sansAccent(regle.prop.toLowerCase()).includes(pNorm)) {
            const idx = chaineLiens.indexOf(ancetre);
            return {
              chemin: chaineLiens.slice(0, idx + 1),
              propriete_source: ancetre,
              propriete_def: regle.prop,
              confiance: regle.poids * 0.95,
            };
          }
        }
      }
    }
  }

  const chemin = [s];
  const visited = new Set<string>();
  let cur = s;
  let confiance = 1.0;

  for (let step = 0; step < maxDepth; step++) {
    if (visited.has(cur)) break;
    visited.add(cur);
    const defs = memoire[cur] || [];
    if (defs.length === 0) break;

    const bestEntry = defs.reduce((max, curItem) => (curItem.poids > max.poids ? curItem : max), defs[0]);
    confiance *= bestEntry.poids;

    if (pNorm) {
      for (const d of defs) {
        if (sansAccent(d.def.toLowerCase()).includes(pNorm)) {
          if (chemin.length > 1 || cur !== s) {
            return {
              chemin,
              propriete_source: cur,
              propriete_def: d.def,
              confiance,
            };
          }
        }
      }
    }

    let nextNode: string | null = null;
    let nextNodeWithArt: string | null = null;

    for (const d of defs) {
      const isa = extraireIsA(d.def);
      if (isa) {
        const words = isa.split(/\s+/);
        const isaNom = words[words.length - 1];
        const isaCorr = corriger(isaNom, memoire, regles, synonymes) || isaNom;
        if (!visited.has(isaCorr)) {
          nextNode = isaCorr;
          nextNodeWithArt = isa;
          break;
        }
      }
    }

    if (nextNode) {
      chemin.push(nextNodeWithArt || nextNode);
      cur = nextNode;
    } else {
      break;
    }
  }

  if (pNorm) {
    if (regles[cur]) {
      for (const r of regles[cur]) {
        if (sansAccent(r.prop.toLowerCase()).includes(pNorm)) {
          return {
            chemin,
            propriete_source: cur,
            propriete_def: r.prop,
            confiance: confiance * r.poids,
          };
        }
      }
    }
    return null;
  }

  return chemin.length > 1 ? { chemin, confiance } : null;
}

export function deduireGeneralisation(
  sujet: string,
  prop: string,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore,
  maxDepth = 20
): {
  categorie: string;
  quant: 'tous' | 'aucun' | 'certains';
  prop: string;
  confiance: number;
  chemin: string[];
} | null {
  const s = (corriger(sujet, memoire, regles, synonymes) || sujet).toLowerCase().trim();
  const p = sansAccent(prop.toLowerCase().trim());
  if (!p) return null;

  const chaineInfo = deduireChaine(s, '', memoire, regles, liens, synonymes, maxDepth);
  const categoriesSujet: string[] = [];
  if (chaineInfo && chaineInfo.chemin) {
    for (const elem of chaineInfo.chemin) {
      const parts = elem.split(/\s+/);
      const nom = singulariser(parts[parts.length - 1], memoire, regles, synonymes);
      categoriesSujet.push(nom);
      categoriesSujet.push(elem.toLowerCase());
    }
  }
  categoriesSujet.push(s);

  const seen = new Set<string>();
  const cats: string[] = [];
  for (const c of categoriesSujet) {
    const sing = singulariser(c, memoire, regles, synonymes);
    if (!seen.has(sing)) {
      seen.add(sing);
      cats.push(sing);
    }
  }

  for (const cat of cats) {
    const catCorr = corriger(cat, memoire, regles, synonymes) || cat;
    for (const key of [cat, catCorr, singulariser(cat, memoire, regles, synonymes)]) {
      if (regles[key]) {
        for (const regle of regles[key]) {
          const rProp = sansAccent(regle.prop.toLowerCase());
          if (p.includes(rProp) || rProp.includes(p)) {
            const confChaine = chaineInfo ? chaineInfo.confiance : 1.0;
            return {
              categorie: key,
              quant: regle.quant,
              prop: regle.prop,
              confiance: regle.poids * confChaine,
              chemin: chaineInfo ? chaineInfo.chemin : [s],
            };
          }
        }
      }
    }
  }
  return null;
}

export function construirePhraseFluideDefinition(chemin: string[], _confiance = 1.0): string | null {
  if (!chemin || chemin.length < 2) return null;
  const first = chemin[0].charAt(0).toUpperCase() + chemin[0].slice(1);
  const second = chemin[1];
  let phrase = `${first} est ${second}`;
  const connecteurs = ['qui est', 'lui-même', 'qui est à son tour', 'et qui est'];
  for (let i = 1; i < chemin.length - 1; i++) {
    const nxt = chemin[i + 1];
    const conn = connecteurs[Math.floor(Math.random() * connecteurs.length)];
    phrase += `, ${conn} ${nxt}`;
  }
  return phrase + '.';
}

export function construirePhraseFluidePourquoi(
  chemin: string[],
  prop: string,
  propDef: string,
  propSource: string,
  _confiance = 1.0
): string {
  const chaineFluide = (construirePhraseFluideDefinition(chemin, 1.0) || '').replace(/\.$/, '');
  const suiteProp = `Or ${propSource} ${propDef}`;
  const conclusions = [
    `Donc ${chemin[0]} ${prop}.`,
    `Ainsi, ${chemin[0]} ${prop} également.`,
    `Ce qui explique pourquoi ${chemin[0]} ${prop}.`,
  ];
  const conclusion = conclusions[Math.floor(Math.random() * conclusions.length)];
  return `${chaineFluide}. ${suiteProp}, ${conclusion.toLowerCase()}`;
}

export function construirePhraseGeneralisation(
  sujet: string,
  cat: string,
  quant: 'tous' | 'aucun' | 'certains',
  prop: string,
  _confiance: number,
  chemin: string[]
): string {
  const cheminTxt = chemin.length > 1 ? (construirePhraseFluideDefinition(chemin, 1.0) || '') + ' ' : '';
  if (quant === 'tous') {
    return `${cheminTxt}Or tous les ${cat}s ${prop}, donc ${sujet} ${prop}.`;
  } else if (quant === 'aucun') {
    return `${cheminTxt}Or aucun ${cat} ne ${prop}, donc ${sujet} ne ${prop} pas.`;
  } else {
    return `${cheminTxt}Certains ${cat}s ${prop}. ${sujet} étant un ${cat}, il est probable que ${sujet} ${prop}.`;
  }
}

export function repondrePourquoi(
  question: string,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore
): string | null {
  const q = sansAccent(question.toLowerCase());
  const m = q.match(/pourquoi\s+(?:le|la|les|un|une)?\s*([a-z]+)\s+([a-z\s]+)/);
  if (!m) return null;
  const sujet = m[1].trim();
  const prop = m[2].trim();
  const sujetCorr = corriger(sujet, memoire, regles, synonymes) || sujet;

  const deduc = deduireChaine(sujetCorr, prop, memoire, regles, liens, synonymes);
  if (deduc && deduc.chemin && deduc.propriete_source && deduc.propriete_def) {
    return construirePhraseFluidePourquoi(
      deduc.chemin,
      prop,
      deduc.propriete_def,
      deduc.propriete_source,
      deduc.confiance
    );
  }

  const gen = deduireGeneralisation(sujetCorr, prop, memoire, regles, liens, synonymes);
  if (gen) {
    return construirePhraseGeneralisation(sujetCorr, gen.categorie, gen.quant, gen.prop, gen.confiance, gen.chemin);
  }

  if (memoire[sujetCorr]) {
    for (const d of memoire[sujetCorr]) {
      if (sansAccent(d.def.toLowerCase()).includes(prop)) {
        return `${sujetCorr.charAt(0).toUpperCase() + sujetCorr.slice(1)} ${d.def}.`;
      }
    }
  }

  return null;
}

export function phraseDef(
  X: string,
  question: string | null,
  memoire: MemoryStore,
  regles: RulesStore,
  liens: LinksStore,
  synonymes: SynonymsStore
): string | null {
  const xCorr = corriger(X, memoire, regles, synonymes) || X;
  const defs = memoire[xCorr] || [];

  if (question && question.toLowerCase().includes('pourquoi')) {
    const rPourquoi = repondrePourquoi(question, memoire, regles, liens, synonymes);
    if (rPourquoi) return rPourquoi;
  }

  const chaine = deduireChaine(xCorr, '', memoire, regles, liens, synonymes);
  if (chaine && chaine.chemin.length > 1) {
    const fluide = construirePhraseFluideDefinition(chaine.chemin, chaine.confiance);
    if (fluide) return fluide;
  }

  if (defs.length > 0) {
    const best = defs.reduce((max, cur) => (cur.poids > max.poids ? cur : max), defs[0]);
    const d = best.def.trim();
    if (best.type === 'question_reponse' || best.question_origine || d.length > 120 || d.includes('\n')) {
      return d;
    }
    const cap = xCorr.charAt(0).toUpperCase() + xCorr.slice(1);
    if (d.length > 60 || d.startsWith('est ') || d.startsWith('un ') || d.startsWith('une ')) {
      return d.startsWith('est ') ? `${cap} ${d}.` : `${cap} est ${d}.`;
    }
    return `${cap} est ${d}.`;
  }

  if (regles[xCorr]) {
    const rList = regles[xCorr].map(r => `${r.quant} les ${xCorr}s ${r.prop}`);
    return `${xCorr.charAt(0).toUpperCase() + xCorr.slice(1)}: ${rList.join(', ')}.`;
  }

  return null;
}

export function decayMemoire(
  memoire: MemoryStore,
  _regles: RulesStore,
  joursSeuil = 7,
  taux = 0.98
): { modifs: number; supprimes: number } {
  const now = new Date();
  let modifs = 0;
  let supprimes = 0;

  for (const [sujet, entries] of Object.entries(memoire)) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const last = new Date(entry.last_used || entry.created || now.toISOString());
      const deltaDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 3600 * 24));
      if (deltaDays >= joursSeuil) {
        const joursOublie = deltaDays - joursSeuil + 1;
        const ancienPoids = entry.poids;
        let nouveauPoids = Math.max(0.1, ancienPoids * Math.pow(taux, joursOublie));
        if (nouveauPoids < ancienPoids - 0.02) {
          entry.poids = Number(nouveauPoids.toFixed(2));
          modifs++;
        }
        if (deltaDays > 30 && nouveauPoids < 0.25 && entry.hits < 3 && entries.length > 1) {
          entries.splice(i, 1);
          supprimes++;
        }
      }
    }
    if (entries.length === 0) {
      delete memoire[sujet];
    }
  }

  return { modifs, supprimes };
}

export function trouverQuestionReponse(
  question: string,
  memoire: MemoryStore,
  seuilSimilarite = 0.72
): { sujet: string; entry: MemoryEntry; score: number } | null {
  if (!question || !memoire) return null;
  const qNorm = normaliserQuestionCle(question);
  const qKeywords = extraireMotsCles(question);

  if (qKeywords.length === 0) return null;

  let bestMatch: { sujet: string; entry: MemoryEntry; score: number } | null = null;
  let maxScore = 0;

  for (const [sujet, entries] of Object.entries(memoire)) {
    for (const entry of entries) {
      const origQ = entry.question_origine || (entry.type === 'question_reponse' ? sujet : null);
      if (!origQ && !sujet.includes(' ')) continue;

      const qSource = origQ || sujet;
      const storedQNorm = normaliserQuestionCle(qSource);
      const storedKeywords = entry.mots_cles && entry.mots_cles.length > 0
        ? entry.mots_cles
        : extraireMotsCles(qSource);

      if (storedKeywords.length === 0) continue;

      if (qNorm === storedQNorm) {
        return { sujet, entry, score: 1.0 };
      }

      const simText = similarite(qNorm, storedQNorm);
      const intersection = storedKeywords.filter(k => qKeywords.includes(k));

      if (storedKeywords.length >= 2) {
        const recallStored = intersection.length / storedKeywords.length;
        const precisionQ = intersection.length / qKeywords.length;

        if (intersection.length >= 2 && recallStored >= 0.70 && precisionQ >= 0.40) {
          const score = (recallStored * 0.6) + (precisionQ * 0.2) + (simText * 0.2);
          if (score > maxScore && score >= seuilSimilarite) {
            maxScore = score;
            bestMatch = { sujet, entry, score };
          }
        }
      } else if (storedKeywords.length === 1 && qKeywords.length === 1) {
        if (storedKeywords[0] === qKeywords[0] && simText >= 0.85) {
          if (simText > maxScore && simText >= seuilSimilarite) {
            maxScore = simText;
            bestMatch = { sujet, entry, score: simText };
          }
        }
      }
    }
  }

  return bestMatch;
}

export function nettoyerMemoirePolluee(memoire: MemoryStore): number {
  if (!memoire) return 0;
  let nettoyes = 0;
  const nowIso = new Date().toISOString();

  for (const [sujet, entries] of Object.entries(memoire)) {
    if (!sujet.includes(' ') && entries.length > 0) {
      const entry = entries[0];
      if (entry.question_origine && entry.question_origine.trim().includes(' ')) {
        const qTrim = entry.question_origine.trim();
        const mots = extraireMotsCles(qTrim);

        const defCheck = estRequeteDefinition(qTrim);
        if (mots.length >= 2 && (!defCheck.estDef || defCheck.concept !== sujet)) {
          const newKey = normaliserQuestionCle(qTrim);
          if (!memoire[newKey]) {
            memoire[newKey] = [];
          }
          memoire[newKey].unshift({
            ...entry,
            type: 'question_reponse',
            mots_cles: mots,
            last_used: nowIso,
          });

          delete memoire[sujet];
          nettoyes++;
        }
      }
    }
  }

  return nettoyes;
}

export function apprendreDeLLM(
  question: string,
  reponseLLM: string,
  memoire: MemoryStore,
  provider: 'gemini' | 'groq' | 'auto' = 'gemini'
): { sujet: string; def: string; type: 'concept' | 'question_reponse' } | null {
  try {
    if (!question || !reponseLLM) return null;
    const qTrim = question.trim();
    let repTrim = reponseLLM.trim();
    if (qTrim.length < 3 || repTrim.length < 5) return null;

    const qClean = sansAccent(qTrim.toLowerCase());
    if (estSalutationPure(qClean) || qClean.startsWith('retiens:') || qClean.startsWith('regle:') || qClean.startsWith('lien:')) {
      return null;
    }

    for (const intro of ['Voici ', 'Bien sûr', 'Bien sur', "D'accord", 'Daccord', 'Avec plaisir', 'Absolument']) {
      if (repTrim.startsWith(intro)) {
        const parts = repTrim.split('. ');
        if (parts.length > 1) {
          repTrim = parts.slice(1).join('. ');
        }
        break;
      }
    }

    const nowIso = new Date().toISOString();

    const defCheck = estRequeteDefinition(qTrim);
    if (defCheck.estDef && defCheck.concept) {
      const concept = defCheck.concept;
      if (!memoire[concept]) {
        memoire[concept] = [];
      }

      const exists = memoire[concept].find(it => it.def.toLowerCase() === repTrim.toLowerCase());
      if (exists) {
        exists.poids = Math.min(1.0, exists.poids + 0.05);
        exists.hits += 1;
        exists.last_used = nowIso;
      } else {
        memoire[concept].unshift({
          def: repTrim,
          poids: 0.85,
          hits: 1,
          source: provider === 'groq' ? 'groq' : 'gemini',
          question_origine: qTrim,
          type: 'concept',
          last_used: nowIso,
          created: nowIso,
        });
      }
      return { sujet: concept, def: repTrim, type: 'concept' };
    }

    const motsCles = extraireMotsCles(qTrim);
    if (motsCles.length === 0) return null;

    const canonicalKey = normaliserQuestionCle(qTrim);
    if (!memoire[canonicalKey]) {
      memoire[canonicalKey] = [];
    }

    const exists = memoire[canonicalKey].find(it => it.def.toLowerCase() === repTrim.toLowerCase());
    if (exists) {
      exists.poids = Math.min(1.0, exists.poids + 0.05);
      exists.hits += 1;
      exists.last_used = nowIso;
    } else {
      memoire[canonicalKey].unshift({
        def: repTrim,
        poids: 0.85,
        hits: 1,
        source: provider === 'groq' ? 'groq' : 'gemini',
        question_origine: qTrim,
        mots_cles: motsCles,
        type: 'question_reponse',
        last_used: nowIso,
        created: nowIso,
      });
    }

    return { sujet: canonicalKey, def: repTrim, type: 'question_reponse' };
  } catch {
    return null;
  }
}

export const SEED_MEMORY: MemoryStore = {
  moineau: [
    { def: 'un petit oiseau migrateur ou sédentaire', poids: 0.9, hits: 3, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  oiseau: [
    { def: 'un animal à plumes doté d’ailes', poids: 0.95, hits: 5, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  animal: [
    { def: 'un être vivant doué de sensibilité et de mouvement', poids: 0.98, hits: 8, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  python: [
    { def: 'un langage de programmation interprété polyvalent et puissant', poids: 0.92, hits: 4, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  ia: [
    { def: 'intelligence artificielle capable d’apprendre et de raisonner', poids: 0.95, hits: 6, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  groq: [
    { def: 'un fournisseur ultra-rapide d’inférence LLM pour modèles open source', poids: 0.9, hits: 3, source: 'manuel', last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
};

export const SEED_RULES: RulesStore = {
  oiseau: [
    { quant: 'tous', prop: 'a des ailes et pond des œufs', poids: 0.95, hits: 4, last_used: new Date().toISOString(), created: new Date().toISOString() },
    { quant: 'certains', prop: 'volent très haut', poids: 0.85, hits: 2, last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
  animal: [
    { quant: 'tous', prop: 'respire et a besoin de nourriture', poids: 0.98, hits: 5, last_used: new Date().toISOString(), created: new Date().toISOString() },
  ],
};

export const SEED_LINKS: LinksStore = {
  moineau: ['oiseau'],
  oiseau: ['animal'],
};
