# Plan Détaillé des Modifications — Nouvelle Version de KADERBOT

Ce document récapitule l'ensemble des transformations, corrections et innovations intégrées dans le projet pour aboutir à cette nouvelle version majeure de **KADERBOT** (Moteur Cognitif Hybride Symbolique & LLM).

---

## Sommaire
1. [Vue d'ensemble & Objectifs](#1-vue-densemble--objectifs)
2. [Refonte de la Mémoire Cognitive & Résolution du Bug de Mot-Clé](#2-refonte-de-la-mémoire-cognitive--résolution-du-bug-de-mot-clé)
3. [Correction & Unification des Intégrations LLM (Groq & Gemini)](#3-correction--unification-des-intégrations-llm-groq--gemini)
4. [Améliorations de l'Interface Graphique & Ergonomie Responsive](#4-améliorations-de-linterface-graphique--ergonomie-responsive)
5. [Enrichissement du Moteur de Raisonnement Symbolique](#5-enrichissement-du-moteur-de-raisonnement-symbolique)
6. [Générateur de Script Python Autonome (`kaderbot.py`)](#6-générateur-de-script-python-autonome-kaderbotpy)
7. [Architecture Technique, Fichiers Modifiés & Déploiement](#7-architecture-technique-fichiers-modifiés--déploiement)

---

## 1. Vue d'ensemble & Objectifs

Le projet initial reposait sur un script Python avec un automate de règles et une extraction basique par mots-clés. La nouvelle version transforme ce concept en une **application web complète, modulaire et prête pour la production**, combinant :
- **L'IA Symbolique déterministe** : Déduction logique, transitivité ontologique, règles de causalité, zéro hallucination.
- **L'IA Générative moderne (LLM)** : Groq (Llama 3) et Gemini (Google AI) comme cerveaux externes en cas d'inconnu.
- **Un apprentissage continu local** : Chaque échange pertinent est mémorisé sans nécessiter de serveur de base de données externe.

---

## 2. Refonte de la Mémoire Cognitive & Résolution du Bug de Mot-Clé

### 🛑 Le problème identifié
Auparavant, lorsqu'un modèle externe (Groq ou Gemini) fournissait une réponse :
- L'algorithme isolait un seul mot de la question (souvent le mot le plus long).
- Il stockait l'intégralité de la réponse sous cette clé unique (`memoire[mot] = reponse`).
- **Conséquence néfaste** : Dès que ce mot apparaissait dans n'importe quelle autre phrase anodine (même hors contexte), KaderBot détournait la conversation et ressortait toute la réponse stockée.

### ✅ Les solutions implémentées
1. **Distinction stricte entre Concept et Question-Réponse (Q&R)** :
   - **Type `concept`** : Réservé exclusivement aux demandes explicites de définitions (*"c'est quoi un drone ?"*, *"définition de l'aigle"*).
   - **Type `question_reponse`** : Appliqué à toutes les questions informatives ou ouvertes (*"quelle est la capitale de l'Australie ?"*, *"pourquoi le ciel est bleu ?"*).
2. **Stockage de la question canonique entière** :
   - Sauvegarde de `question_origine` et d'une clé normalisée complète (sans ponctuation excessive).
   - Extraction des mots-clés significatifs via `extraireMotsCles()` en filtrant une liste élargie de stop-words français (`MOTS_INTERROGATIFS_ET_VIDES`).
3. **Moteur d'appariement sémantique (`trouverQuestionReponse`)** :
   - Calcule un indice de similarité combinant la formule de Jaccard sur les mots-clés et la proximité de la chaîne normalisée.
   - Seuil de confiance strict ($\ge 0.72$) : un mot isolé ne déclenche plus jamais une réponse mémorisée.
4. **Correction de l'extracteur de sujet (`extraireX`)** :
   - N'interprète plus un mot au hasard d'une phrase longue comme un sujet de définition.
   - Ne s'active que si la structure de la phrase est explicitement interrogative/définitionnelle ou s'il s'agit d'un mot unique.
5. **Nettoyage automatique du cache (`nettoyerMemoirePolluee`)** :
   - Au chargement du navigateur, détection automatique des anciennes entrées corrompues (mots uniques avec paragraphes de plus de 140 caractères) et reclassement propre en Q&R.

---

## 3. Correction & Unification des Intégrations LLM (Groq & Gemini)

### 🛑 Les problèmes identifiés
- Les requêtes Groq échouaient avec des erreurs de format ou de modèle indisponible.
- Lors des réponses de Gemini, un message d'erreur résiduel de Groq apparaissait sous la bulle de discussion déjà complétée.

### ✅ Les solutions implémentées
1. **Gestion robuste du modèle Groq côté serveur (`server.ts`)** :
   - Passage au modèle Groq actuel et ultra-rapide `llama-3.3-70b-versatile` (avec fallback sur `llama-3.1-8b-instant`).
   - Normalisation stricte de la structure du payload OpenAI-compatible (`messages: [{ role: 'system', content: ... }, { role: 'user', content: ... }]`).
2. **Isolation des canaux LLM (`App.tsx`)** :
   - Séparation stricte des états d'erreur entre Groq et Gemini : une erreur Groq n'apparaît plus jamais dans le flux d'une réponse Gemini réussie.
   - Indicateurs visuels clairs de la source dans chaque bulle :
     - ⚡ **Local** (Raisonnement symbolique instantané en ~2ms)
     - 🟣 **Groq Llama 3** (Interrogation ultra-rapide)
     - 🔵 **Google Gemini** (Raisonnement approfondi)
3. **Support multi-niveaux des clés API** :
   - Prise en charge des variables d'environnement serveur (`.env` ou variables de déploiement cloud).
   - Prise en charge des clés personnalisées saisies par l'utilisateur dans l'onglet **Paramètres**, stockées de manière chiffrée/isolée dans son navigateur.

---

## 4. Améliorations de l'Interface Graphique & Ergonomie Responsive

### 🛑 Les problèmes identifiés
- Les boutons d'onglets et de filtres en haut de page se chevauchaient sur les écrans moyens et mobiles.

### ✅ Les solutions implémentées
1. **Refonte de la barre de navigation supérieure** :
   - Mise en place d'un conteneur flexible `flex-wrap` avec espacement calculé (`gap-2`), barres de défilement masquées et safe-zones tactiles.
   - Aucun chevauchement entre le sélecteur de session, l'état de la mémoire et les onglets principaux.
2. **Amélioration de l'onglet Graphe & Mémoire (`KnowledgeGraphTab.tsx`)** :
   - Affichage immédiat d'un badge distinctif :
     - 🟣 **[Q&R]** pour les questions-réponses apprises.
     - 🟢 **[Concept]** pour les entités du graphe ontologique.
   - Carte de détail affichant la question originale exacte et les mots-clés déclencheurs.
   - Recherche en direct dans les concepts et les définitions.
   - Possibilité d'ajouter manuellement des liens d'héritage Is-A et de nouvelles définitions.
3. **Onglets spécialisés intégrés** :
   - **Discussion (Chat)** : Interface épurée avec historique de session, suggestions de questions en un clic, et mode d'apprentissage manuel avec la syntaxe `retiens: X est Y`.
   - **Règles & Déductions** : Visualisation des règles d'inférence avec quantificateurs (*tous*, *chaque*, *certains*).
   - **Sandbox & Diagnostic** : Console de test unitaire pour simuler en temps réel les fonctions cognitives du bot (`deduireChaine`, `repondrePourquoi`, etc.).
   - **Export & API** : Documentation des routes REST et générateur de code.

---

## 5. Enrichissement du Moteur de Raisonnement Symbolique

Le fichier `src/core/cognitiveEngine.ts` a été profondément enrichi :
1. **Raisonnement Causal ("Pourquoi ?")** :
   - Fonction `repondrePourquoi()` : Remonte l'arbre taxonomique (`moineau` $\rightarrow$ `oiseau` $\rightarrow$ `animal`) pour trouver la règle universelle qui justifie une propriété (ex. *"Parce que le moineau est un oiseau, et que tous les oiseaux volent"*).
2. **Transitivité d'héritage Is-A (`deduireChaine`)** :
   - Capable d'inférer des liens jusqu'à 6 niveaux de profondeur avec détection des boucles cycliques.
3. **Tolérance orthographique et lemmatisation** :
   - Suppression des accents (`sansAccent`).
   - Correction phonétique / Levenshtein sur les requêtes courtes pour rattraper les fautes de frappe de l'utilisateur.

---

## 6. Générateur de Script Python Autonome (`kaderbot.py`)

Dans l'onglet **Export & API**, la fonction de téléchargement génère un script Python 3 complet et exécutable :
- Intègre en natif les dictionnaires `memoire`, `regles`, `liens`, `synonymes`.
- Réplique fidèlement la logique cognitive `extraire_x`, `deduire_chaine`, `repondre_pourquoi`.
- Intègre le client Groq officiel en Python avec gestion propre des exceptions.
- Comprend le nouveau système d'apprentissage `apprendre_de_groq` corrigé (distinction Q&R vs Concept).
- Fonctionne en invite de commande interactive dans n'importe quel terminal avec `python kaderbot.py`.

---

## 7. Architecture Technique, Fichiers Modifiés & Déploiement

### Tableau récapitulatif des fichiers majeurs

| Fichier | Nature des modifications |
| :--- | :--- |
| `src/types/kaderbot.ts` | Définition des types `MemoryEntry` enrichis (`type`, `mots_cles`, `question_origine`). |
| `src/core/cognitiveEngine.ts` | Ajout de `trouverQuestionReponse`, `nettoyerMemoirePolluee`, refonte de `extraireX` et `apprendreDeLLM`. |
| `src/App.tsx` | Correction du chevauchement d'onglets, isolation des erreurs Groq/Gemini, synchronisation de la mémoire assainie. |
| `src/components/KnowledgeGraphTab.tsx` | Ajout des badges Q&R / Concept, affichage de la question source et des mots-clés. |
| `server.ts` | Serveur Express, proxy sécurisé Groq (`llama-3.3-70b-versatile`) et Gemini, générateur Python mis à jour. |

### Déploiement pour utilisateurs externes
- **Prêt pour le Web** : L'application compile sans aucune erreur (`npm run build` validé).
- **Multi-utilisateurs et confidentialité** : Le stockage `localStorage` est automatiquement cloisonné par navigateur/utilisateur ; chaque visiteur dispose de son propre environnement d'apprentissage autonome.
- **Hébergement supporté** : Déployable directement sur Vercel, Render, Railway, ou sur serveur privé (Docker / Node.js).
