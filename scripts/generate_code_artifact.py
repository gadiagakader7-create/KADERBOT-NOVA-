import os

root_dir = '/app/applet'
target_path = os.path.join(root_dir, '.aistudio/artifacts/brain/1e85614a-1a36-40c9-9d9d-04bf0651ef2e/kaderbot_code_source_complet.md')

files_to_include = [
    ('package.json', 'json', 'Configuration des dépendances et scripts du projet'),
    ('vite.config.ts', 'typescript', 'Configuration du bundler Vite, aliases et shims'),
    ('server.ts', 'typescript', 'Serveur Express & Boucle Agentique ReAct (25 itérations, outils Brave/Web/Mémoire)'),
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
    ('src/components/ToolsTab.tsx', 'tsx', "Console d'outils et tests des moteurs LLM"),
    ('src/components/SettingsModal.tsx', 'tsx', 'Modal des paramètres et configuration système'),
    ('src/components/ActionMenuModal.tsx', 'tsx', "Menu d'actions rapides et interactions"),
    ('index.html', 'html', "Point d'entrée HTML et métadonnées PWA/SEO"),
]

header = """# Code Source Complet — KADERBOT NOVA

Ce document rassemble l'intégralité du code source de l'application **KADERBOT NOVA**, intégrant la boucle **ReAct (Reasoning + Acting)** étendue à **25 itérations**, la recherche sémantique hybride (`@xenova/transformers` + filtrage mots-clés), les outils de navigation web (Brave API + scraping avec empreinte réaliste anti-403) et l'interface utilisateur épurée dotée des fenêtres accordéons repliables **« Réflexion »**.

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

with open(target_path, 'w', encoding='utf-8') as out:
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

size = os.path.getsize(target_path)
print(f'Done! Generated {target_path} - Size: {size} bytes ({size/1024:.1f} KB)')
