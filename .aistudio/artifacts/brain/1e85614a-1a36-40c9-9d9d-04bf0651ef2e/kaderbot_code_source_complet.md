# KADERBOT NOVA — Optimisation Sémantique Hybride (12 000+ entrées)

Ce document décrit l'architecture d'optimisation de la mémoire sémantique de **KADERBOT NOVA** conçue pour supporter plus de 12 000 entrées avec une fluidité maximale sur tous supports (desktop et mobile).

---

## 1. Tâche 1 : Pré-calcul Asynchrone des Vecteurs (`precalculerTousLesVecteurs`)

Au lieu de calculer les vecteurs à la volée sur des milliers d'entrées, les vecteurs sont pré-calculés une seule fois au chargement de l'application.

### Fonctionnement :
- **Condition d'exécution :** Vérification du drapeau `localStorage.getItem('hasPrecalculated')`. S'il vaut `'true'`, aucun recalcul n'est effectué.
- **Calcul par lots de 50 :** Traitement séquentiel avec `await new Promise(r => setTimeout(r, 10))` toutes les 50 entrées pour laisser respirer le thread principal JavaScript (UI 60 FPS sans lag).
- **Vecteur de la clé :** Le vecteur de la clé (`sujet`) est extrait via `obtenirVecteur(sujet)` (Transformers.js `all-MiniLM-L6-v2`) et stocké dans `entry.vecteur`.
- **Indicateur de progression en temps réel :** Une notification élégante informe l'utilisateur de l'état d'indexation (`Indexation de la mémoire : X%`). Une fois à 100%, elle disparaît automatiquement.

```typescript
export async function precalculerTousLesVecteurs(
  memoire: MemoryStore,
  onProgress?: (pourcentage: number) => void
): Promise<MemoryStore> {
  if (!memoire) return memoire;
  const sujets = Object.keys(memoire);
  const total = sujets.length;
  if (total === 0) {
    onProgress?.(100);
    return memoire;
  }

  const BATCH_SIZE = 50;

  for (let i = 0; i < total; i++) {
    const sujet = sujets[i];
    const entries = memoire[sujet] || [];

    const needVec = entries.some(e => !e.vecteur || e.vecteur.length === 0);
    if (needVec) {
      const vec = await obtenirVecteur(sujet);
      if (vec && vec.length > 0) {
        for (const entry of entries) {
          if (!entry.vecteur || entry.vecteur.length === 0) {
            entry.vecteur = vec;
          }
        }
      }
    }

    if ((i + 1) % BATCH_SIZE === 0 || i === total - 1) {
      const pct = Math.round(((i + 1) / total) * 100);
      onProgress?.(pct);
      await new Promise(r => setTimeout(r, 10));
    }
  }

  return memoire;
}
```

---

## 2. Tâche 2 : Recherche Hybride (`rechercheHybride`)

Située dans `src/core/cognitiveEngine.ts`, elle combine filtrage lexical ultrarapide et similarité vectorielle :

1. **Filtrage rapide (Mots-clés) :**
   - Extraction des mots-clés de la question (minuscules, sans accents via `sansAccent`, exclusion des mots vides via `MOTS_INTERROGATIFS_ET_VIDES`).
   - Sélection uniquement des entrées de la mémoire dont la clé contient au moins un des mots-clés (`includes`).
   - Si aucun candidat n'est trouvé, retour immédiat de `null` (évite tout calcul vectoriel inutile).

2. **Comparaison vectorielle sur le sous-ensemble filtré :**
   - Calcul du vecteur de la question (`obtenirVecteur(question)`).
   - Calcul de la similarité cosinus (`similariteCosinus`) uniquement sur les entrées filtrées qui possèdent déjà leur vecteur pré-calculé.

3. **Seuil de confiance strict :**
   - Retourne le meilleur résultat uniquement si le score dépasse **0.82**. Sinon, retourne `null`.

```typescript
export async function rechercheHybride(
  question: string,
  memoire: MemoryStore
): Promise<{ sujet: string; entry: MemoryEntry; score: number } | null> {
  if (!question || !memoire || Object.keys(memoire).length === 0) return null;

  const qClean = sansAccent(question.toLowerCase());
  let motsCles = extraireMotsCles(qClean);

  if (motsCles.length === 0) {
    const tokens = qClean
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !MOTS_INTERROGATIFS_ET_VIDES.has(w) && !PRONOMS_CONTEXTE.has(w));
    if (tokens.length > 0) motsCles = tokens;
    else return null;
  }

  const candidats: Array<{ sujet: string; entry: MemoryEntry }> = [];
  const motsClesSansAccents = motsCles.map(m => sansAccent(m.toLowerCase()));

  for (const [sujet, entries] of Object.entries(memoire)) {
    const sNorm = sansAccent(sujet.toLowerCase());
    if (motsClesSansAccents.some(mot => sNorm.includes(mot))) {
      for (const entry of entries) {
        candidats.push({ sujet, entry });
      }
    }
  }

  if (candidats.length === 0) return null;

  const questionVec = await obtenirVecteur(question);
  if (!questionVec || questionVec.length === 0) return null;

  let meilleurResultat: { sujet: string; entry: MemoryEntry; score: number } | null = null;
  let maxScore = -1;

  for (const item of candidats) {
    let entryVec = item.entry.vecteur;
    if (!entryVec || entryVec.length === 0) {
      entryVec = await obtenirVecteur(item.sujet);
      item.entry.vecteur = entryVec;
    }

    if (entryVec && entryVec.length > 0) {
      const score = similariteCosinus(questionVec, entryVec);
      if (score > maxScore) {
        maxScore = score;
        meilleurResultat = { sujet: item.sujet, entry: item.entry, score };
      }
    }
  }

  if (meilleurResultat && maxScore > 0.82) {
    return meilleurResultat;
  }
  return null;
}
```

---

## 3. Tâche 3 : Routeur Cognitif & Apprentissage Vectoriel Immédiat (`App.tsx`)

1. **Remplacement dans le routeur local :**
   - L'Étape 1 utilise maintenant `rechercheHybride(questionResolue, memoire)`.
   - Si un match est trouvé, la réponse locale est formulée immédiatement et les statistiques (`hits`, `last_used`) sont mises à jour.

2. **Calcul et stockage du vecteur lors de l'apprentissage LLM :**
   - Lorsqu'une nouvelle réponse est apprise via `apprendreDeLLM` (fallback Gemini ou Groq), son vecteur sémantique est calculé via `await obtenirVecteur(learned.sujet)` et directement rattaché à l'entrée (`entry.vecteur = vec`) **avant** la sauvegarde dans le state et `localStorage`.
   - La prochaine question sur ce sujet sera donc reconnue instantanément par `rechercheHybride`.

---

## 4. Tests et Validation

- `tsc --noEmit` : 0 erreur de typage.
- `npm run build` : Compilation réussie.
- Respect strict de la non-exposition des scores et vecteurs dans l'UI utilisateur.
