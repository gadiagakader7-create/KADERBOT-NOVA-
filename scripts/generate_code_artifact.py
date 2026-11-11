import os
import zipfile

root_dir = '/app/applet'
artifact_dir = os.path.join(root_dir, '.aistudio/artifacts/brain/1e85614a-1a36-40c9-9d9d-04bf0651ef2e')
os.makedirs(artifact_dir, exist_ok=True)

target_md = os.path.join(artifact_dir, 'kaderbot_code_source_complet.md')
target_zip = os.path.join(artifact_dir, 'kaderbot_projet_complet.zip')

files_to_include = [
    ('package.json', 'json', 'Configuration des dépendances et scripts du projet'),
    ('vite.config.ts', 'typescript', 'Configuration du bundler Vite, aliases et shims'),
    ('server.ts', 'typescript', 'Orchestrateur Express serveur, initialisation et démarrage'),
    ('src/server/httpRoutes.ts', 'typescript', 'Définition des endpoints REST (/api/agent, /api/chat, /api/memory, etc.)'),
    ('src/server/storage.ts', 'typescript', 'Gestionnaire de persistance JSON (mémoire, logs, notes, quotas Brave)'),
    ('src/server/webSearch.ts', 'typescript', 'Moteur de recherche Brave API et protection anti-SSRF'),
    ('src/server/llmProviders.ts', 'typescript', 'Cascade de repli multi-fournisseurs (Groq, OpenRouter, Gemini)'),
    ('src/server/middleware.ts', 'typescript', 'Middlewares de sécurité (Rate limiting & Auth timing-safe)'),
    ('src/agent/intentClassifier.ts', 'typescript', 'Classificateur d\'intentions ultra-rapide (Groq 20B)'),
    ('src/agent/reactLoop.ts', 'typescript', 'Boucle ReAct 25 itérations (Pensée, Action, Observation, Synthèse)'),
    ('src/agent/toolRegistry.ts', 'typescript', 'Définition et schémas JSON des outils de l\'agent'),
    ('src/agent/toolImplementations.ts', 'typescript', 'Implémentations des outils (scraping anti-403, mémoire, calcul, etc.)'),
    ('src/agent/toolSecurity.ts', 'typescript', 'Garde-fous de sécurité et validation des paramètres d\'outils'),
    ('src/agent/modelRouter.ts', 'typescript', 'Routage dynamique des modèles IA selon les tâches'),
    ('src/types/kaderbot.ts', 'typescript', 'Typage TypeScript complet (ReAct, Mémoire, Messages, Graphe)'),
    ('src/services/apiService.ts', 'typescript', 'Service API client avec appel agent ReAct et timeout 120s'),
    ('src/shims/style-to-js.ts', 'typescript', 'Shim ESM natif pour compatibilité style-to-js / react-markdown'),
    ('src/components/ChatTab.tsx', 'tsx', 'Interface Chat avec accordéons Réflexion (live & ReAct breakdown)'),
    ('src/App.tsx', 'tsx', 'Composant racine, gestion de session et moteur hybride'),
    ('src/core/cognitiveEngine.ts', 'typescript', 'Moteur cognitif, recherche sémantique hybride et déduction logique'),
    ('src/components/Header.tsx', 'tsx', 'En-tête de navigation et statut des connexions'),
    ('src/components/KnowledgeGraphTab.tsx', 'tsx', 'Visualisation et gestion du graphe de connaissances'),
    ('src/components/RulesTab.tsx', 'tsx', 'Gestion des règles logiques et inférences'),
    ('src/components/SessionsTab.tsx', 'tsx', 'Gestion multi-sessions de la mémoire cognitive'),
    ('src/components/ToolsTab.tsx', 'tsx', 'Console d\'outils et tests des moteurs LLM'),
    ('src/components/SettingsModal.tsx', 'tsx', 'Modal des paramètres et configuration système'),
    ('src/components/ActionMenuModal.tsx', 'tsx', 'Menu d\'actions rapides et interactions'),
    ('index.html', 'html', 'Point d\'entrée HTML et métadonnées PWA/SEO'),
]

header = """# Code Source Complet — KADERBOT NOVA (Architecture Modulaire)

Ce document rassemble l'intégralité du code source de l'application **KADERBOT NOVA** suite à la refonte modulaire complète :
- **Serveur allégé & découplé** : Orchestrateur épuré, modules dédiés (`httpRoutes`, `storage`, `webSearch`, `llmProviders`, `middleware`, `intentClassifier`).
- **Boucle ReAct 25 itérations** : Décomposition dynamique Pensée -> Action -> Observation -> Synthèse avec cascade de repli IA (Groq, OpenRouter, Gemini).
- **Sécurité & Résilience** : Protection anti-SSRF, User-Agent réaliste anti-403, rate limiting IP, timing-safe auth.
- **Interface épurée** : Accordéons repliables *« Réflexion »*, timeline des étapes et rendu Markdown propre.

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

with open(target_md, 'w', encoding='utf-8') as out:
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

md_size = os.path.getsize(target_md)
print(f'Generated {target_md} - Size: {md_size} bytes ({md_size/1024:.1f} KB)')

# Generate ZIP archive
with zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(root_dir):
        # Exclude node_modules, .git, dist, .aistudio
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist', '.aistudio')]
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, root_dir)
            zipf.write(file_path, arcname)

zip_size = os.path.getsize(target_zip)
print(f'Generated {target_zip} - Size: {zip_size} bytes ({zip_size/1024:.1f} KB)')
