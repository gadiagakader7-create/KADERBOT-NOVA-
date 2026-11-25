import os
import shutil
import zipfile

root_dir = '/app/applet'
artifact_dirs = [
    os.path.join(root_dir, '.aistudio/artifacts/brain/0948f66a-cc4b-4449-8a92-9481a56e0363'),
    os.path.join(root_dir, '.aistudio/artifacts/brain/1e85614a-1a36-40c9-9d9d-04bf0651ef2e'),
]
for d in artifact_dirs:
    os.makedirs(d, exist_ok=True)

files_to_include = [
    ('package.json', 'json', 'Configuration des dépendances et scripts du projet'),
    ('.env.example', 'bash', 'Modèle des variables d\'environnement serveur'),
    ('metadata.json', 'json', 'Métadonnées de l\'application AI Studio'),
    ('tsconfig.json', 'json', 'Configuration TypeScript'),
    ('vite.config.ts', 'typescript', 'Configuration du bundler Vite, aliases et shims'),
    ('index.html', 'html', 'Point d\'entrée HTML et métadonnées PWA/SEO'),
    ('server.ts', 'typescript', 'Orchestrateur Express serveur, initialisation et démarrage'),
    ('src/server/httpRoutes.ts', 'typescript', 'Définition des endpoints REST (/api/agent, /api/chat, /api/memory, etc.)'),
    ('src/server/adminRoutes.ts', 'typescript', 'Routes Admin protégées (403) pour sandbox, self-modify, validation de patches et /workspace/'),
    ('src/server/fileRoutes.ts', 'typescript', 'Route publique POST /api/files/extract (extraction texte PDF/DOCX/TXT/MD sans stockage)'),
    ('src/server/storage.ts', 'typescript', 'Gestionnaire de persistance JSON (mémoire, logs, notes, quotas Brave)'),
    ('src/server/webSearch.ts', 'typescript', 'Moteur de recherche Brave API et protection anti-SSRF'),
    ('src/server/llmProviders.ts', 'typescript', 'Cascade de repli multi-fournisseurs (Groq, OpenRouter, Gemini)'),
    ('src/server/middleware.ts', 'typescript', 'Middlewares de sécurité (Rate limiting & Auth timing-safe)'),
    ('src/agent/intentClassifier.ts', 'typescript', 'Classificateur d\'intentions ultra-rapide (Groq 20B)'),
    ('src/agent/reactLoop.ts', 'typescript', 'Boucle ReAct 25 itérations (Pensée, Action, Observation, Synthèse)'),
    ('src/agent/toolRegistry.ts', 'typescript', 'Définition et séparation PUBLIC_TOOLS / ADMIN_TOOLS'),
    ('src/agent/toolImplementations.ts', 'typescript', 'Implémentations des outils publics et admin'),
    ('src/agent/toolSecurity.ts', 'typescript', 'Garde-fous de sécurité et validation des paramètres d\'outils'),
    ('src/agent/modelRouter.ts', 'typescript', 'Routage dynamique des modèles IA selon les tâches'),
    ('src/agent/codeWorkspace.ts', 'typescript', 'Stockage virtuel persistant /workspace/ (generated, patches, tests) et diffs unifiés'),
    ('src/agent/codeExecutor.ts', 'typescript', 'Exécution isolée Python/JS (Web Worker Pyodide/JS et sandbox serveur)'),
    ('src/agent/selfModify.ts', 'typescript', 'Protocole strict pour lecture paginée de src/ et proposition de patches'),
    ('src/types/agent.ts', 'typescript', 'Types de la boucle agentique et des politiques d\'outils'),
    ('src/types/kaderbot.ts', 'typescript', 'Typage TypeScript complet (ReAct, Mémoire, Messages, Bibliothèque, Graphe)'),
    ('src/services/apiService.ts', 'typescript', 'Service API client (agent ReAct, chat, extraction fichiers, admin)'),
    ('src/services/libraryService.ts', 'typescript', 'Bibliothèque locale IndexedDB (kaderbot_library) avec plafond 200 Mo et export/import JSON'),
    ('src/hooks/usePWAInstall.ts', 'typescript', 'Hook d\'installation PWA'),
    ('src/shims/style-to-js.ts', 'typescript', 'Shim ESM natif pour compatibilité style-to-js / react-markdown'),
    ('src/core/cognitiveEngine.ts', 'typescript', 'Moteur cognitif, recherche sémantique hybride et déduction logique'),
    ('src/main.tsx', 'tsx', 'Point d\'entrée React'),
    ('src/index.css', 'css', 'Styles globaux Tailwind et thèmes'),
    ('src/App.tsx', 'tsx', 'Composant racine, gestion des discussions, documents activés et navigation'),
    ('src/components/ChatTab.tsx', 'tsx', 'Interface Chat flottante unifiée, tiroirs gauche/droit, bouton trombone et CodeCanvas inline'),
    ('src/components/CodeCanvas.tsx', 'tsx', 'Affichage inline des blocs de code dans la conversation (sans exécution)'),
    ('src/components/AttachSheet.tsx', 'tsx', 'Panneau inférieur d\'ajout de documents (.txt, .md, .pdf, .docx) et accès Bibliothèque'),
    ('src/components/LibraryTab.tsx', 'tsx', 'Écran Bibliothèque locale (activation max 3 docs, jauge Mo, renommage, suppression, export/import)'),
    ('src/components/CodeWorkspaceTab.tsx', 'tsx', 'Atelier Admin d\'auto-évolution (Générés, Patches en attente, Tests)'),
    ('src/components/KnowledgeGraphTab.tsx', 'tsx', 'Visualisation et gestion du graphe de connaissances (défilement mobile corrigé)'),
    ('src/components/RulesTab.tsx', 'tsx', 'Gestion des règles logiques et inférences'),
    ('src/components/SessionsTab.tsx', 'tsx', 'Gestion multi-sessions de la mémoire cognitive et exports'),
    ('src/components/ToolsTab.tsx', 'tsx', 'Atelier Texte (idées, traduction, correction, résumé)'),
    ('src/components/SettingsModal.tsx', 'tsx', 'Modal des paramètres et configuration système'),
    ('src/components/ActionMenuModal.tsx', 'tsx', 'Menu d\'actions rapides et interactions'),
    ('src/components/Header.tsx', 'tsx', 'Composant Header historique conservé'),
]

header = """# Code Source Complet — KADERBOT NOVA (Architecture Modulaire)

Ce document rassemble l'intégralité du code source à jour de l'application **KADERBOT NOVA** :
- **Serveur modulaire & sécurisé** : `httpRoutes`, `adminRoutes`, `fileRoutes` (`POST /api/files/extract`), `storage`, `webSearch`, `llmProviders`, `middleware`.
- **Boucle Agentique & Auto-évolution** : `reactLoop` (Groq / OpenRouter / Gemini), `codeWorkspace` persistant sur disque, `codeExecutor`, `selfModify` avec diffs unifiés compacts.
- **Interface Public & Admin épurée** : en-tête et saisie capsule flottants, tiroir gauche (Historique, Bibliothèque, Atelier Texte), tiroir droit *« Espace admin »*, rendu `CodeCanvas` inline.
- **Bibliothèque locale & Documents** : extraction TXT/MD/PDF/DOCX sans stockage serveur, persistance IndexedDB (`kaderbot_library`, 200 Mo max), activation jusqu'à 3 documents par fil de discussion.

---

## Sommaire des Fichiers Inclus
"""

for rel_path, lang, desc in files_to_include:
    full_path = os.path.join(root_dir, rel_path)
    if os.path.exists(full_path):
        with open(full_path, 'r', encoding='utf-8') as f:
            lines = len(f.readlines())
        anchor = rel_path.replace('/', '').replace('.', '')
        header += f"- [`{rel_path}`](#{anchor}) — {desc} *({lines} lignes)*\n"

header += '\n---\n\n'

primary_dir = artifact_dirs[0]
primary_md = os.path.join(primary_dir, 'kaderbot_code_source_complet.md')
primary_zip = os.path.join(primary_dir, 'kaderbot_projet_complet.zip')

with open(primary_md, 'w', encoding='utf-8') as out:
    out.write(header)
    for rel_path, lang, desc in files_to_include:
        full_path = os.path.join(root_dir, rel_path)
        if os.path.exists(full_path):
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            anchor = rel_path.replace('/', '').replace('.', '')
            out.write(f'<a id="{anchor}"></a>\n')
            out.write(f'## Fichier : `{rel_path}`\n\n')
            out.write(f'> **Description** : {desc}\n\n')
            out.write(f'```{lang}\n')
            out.write(content)
            if not content.endswith('\n'):
                out.write('\n')
            out.write('```\n\n---\n\n')

md_size = os.path.getsize(primary_md)
print(f'Generated {primary_md} - Size: {md_size} bytes ({md_size/1024:.1f} KB)')

with zipfile.ZipFile(primary_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist', '.aistudio', 'data', 'workspace')]
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, root_dir)
            zipf.write(file_path, arcname)

zip_size = os.path.getsize(primary_zip)
print(f'Generated {primary_zip} - Size: {zip_size} bytes ({zip_size/1024:.1f} KB)')

for extra_dir in artifact_dirs[1:]:
    shutil.copy2(primary_md, os.path.join(extra_dir, 'kaderbot_code_source_complet.md'))
    shutil.copy2(primary_zip, os.path.join(extra_dir, 'kaderbot_projet_complet.zip'))
    print(f'Synced to {extra_dir}')

