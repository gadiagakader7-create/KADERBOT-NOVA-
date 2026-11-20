import type { AgentToolDefinition, ToolPolicy } from '../types/agent';

/**
 * Outils accessibles à l'interface publique et à l'agent général.
 * Aucun outil d'exécution de code ou de modification du code source n'y figure.
 */
export const PUBLIC_TOOLS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Recherche générale sur le web via Brave. À utiliser pour toute question factuelle, actuelle, ou inconnue.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Requête textuelle de recherche.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_url',
      description: 'Ouvre une URL et renvoie le texte principal de la page. Utilise après search_web pour approfondir un résultat.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'L’URL absolue de la page web à explorer.',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_news',
      description: "Recherche d'actualités récentes via Brave News. Utiliser pour les événements récents.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Requête pour actualités récentes.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memo_lookup',
      description: 'Consulte la mémoire cognitive locale de KADERBOT (faits, définitions, Q&R appris) avant de chercher sur le web. Toujours appeler AVANT search_web si la question peut être connue.',
      parameters: {
        type: 'object',
        properties: {
          sujet: {
            type: 'string',
            description: 'Le concept, mot ou sujet à vérifier dans la mémoire locale.',
          },
        },
        required: ['sujet'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memo_store',
      description: "Enregistre un fait ou une définition validé par l'utilisateur dans la mémoire cognitive. À n'utiliser que si l'utilisateur dit explicitement 'retiens' ou demande de mémoriser. JAMAIS automatiquement depuis le web.",
      parameters: {
        type: 'object',
        properties: {
          sujet: {
            type: 'string',
            description: 'Le sujet ou concept clé du fait.',
          },
          definition: {
            type: 'string',
            description: 'La définition ou le fait validé par l’utilisateur.',
          },
        },
        required: ['sujet', 'definition'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'link_concepts',
      description: "Crée un lien d'héritage (source est-un cible) dans le graphe de connaissances.",
      parameters: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Le concept source / sous-concept (ex: "chat").',
          },
          cible: {
            type: 'string',
            description: 'Le concept parent / catégorie (ex: "félin").',
          },
        },
        required: ['source', 'cible'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_event',
      description: 'Crée un événement dans l’agenda KADERBOT après confirmation et fournit un lien Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_iso: { type: 'string', description: 'Date ISO 8601 avec fuseau horaire.' },
          end_iso: { type: 'string', description: 'Date ISO 8601 avec fuseau horaire.' },
          location: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['title', 'start_iso', 'end_iso'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_events',
      description: 'Liste les événements KADERBOT compris dans une période donnée.',
      parameters: {
        type: 'object',
        properties: {
          start_iso: { type: 'string' },
          end_iso: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
        required: ['start_iso', 'end_iso'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_note',
      description: 'Crée une note locale persistante après confirmation de l’utilisateur.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_notes',
      description: 'Recherche dans les notes locales par titre, contenu ou tags.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 20 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'Envoie un message Telegram après confirmation ou prépare un partage WhatsApp sans envoi automatique.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['telegram', 'whatsapp', 'sms'] },
          target: { type: 'string' },
          text: { type: 'string' },
          confirm: { type: 'boolean' },
        },
        required: ['channel', 'target', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: "Pose une question courte à l'utilisateur quand la demande est ambiguë et que tu ne peux pas deviner. Une seule fois par conversation maximum.",
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'La question courte et ciblée à poser à l’utilisateur.',
          },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_code_for_canvas',
      description: 'Génère un extrait de code texte formaté pour affichage dans CodeCanvas sans aucune exécution.',
      parameters: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            description: 'Langage du code pour la coloration/affichage (ex: python, javascript, typescript, html, css).',
          },
          code: {
            type: 'string',
            description: 'Le code source texte à afficher dans CodeCanvas.',
          },
        },
        required: ['language', 'code'],
      },
    },
  },
];

/**
 * Outils strictement réservés au mode Admin (Atelier d'auto-évolution et sandbox isolé).
 */
export const ADMIN_ONLY_TOOLS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'code_workspace',
      description: 'Gère le stockage virtuel /workspace/ (list, read, write, delete dans /workspace/generated/, /workspace/patches/, /workspace/tests/).',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'read', 'write', 'delete'] },
          path: { type: 'string', description: 'Chemin virtuel sous /workspace/.' },
          content: { type: 'string', description: 'Contenu à écrire pour action=write.' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_code',
      description: 'Exécute du code Python ou JavaScript dans un sandbox isolé sans réseau ni accès disque réel (Admin uniquement).',
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['python', 'javascript'] },
          code: { type: 'string' },
          isTest: { type: 'boolean' },
          timeoutMs: { type: 'integer', minimum: 1000, maximum: 120000 },
        },
        required: ['language', 'code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'self_modify',
      description: 'Lit un fichier de src/ (action="read") ou propose un patch selon le protocole strict (lecture -> patch virtuel -> test sur copie virtuelle -> attente validation humaine). Pour modifier une partie ciblée sans réécrire tout le fichier, fournis search + replace (ou newContent complet).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['read', 'propose'],
            description: '"read" pour lire le fichier cible dans src/ avant patch, ou "propose" (défaut) pour créer et tester un patch en_attente.',
          },
          targetPath: { type: 'string', description: 'Chemin relatif dans src/ (ex: src/agent/toolRegistry.ts).' },
          newContent: { type: 'string', description: 'Nouveau contenu complet proposé pour le fichier (si search/replace non utilisé).' },
          search: { type: 'string', description: 'Extrait exact existant dans le fichier cible à remplacer (alternative sûre à newContent).' },
          replace: { type: 'string', description: 'Nouveau texte qui remplace search dans le fichier cible.' },
          testCode: { type: 'string', description: 'Code de test optionnel à exécuter sur la copie virtuelle.' },
        },
        required: ['targetPath'],
      },
    },
  },
];

export const ADMIN_TOOLS: AgentToolDefinition[] = [...PUBLIC_TOOLS, ...ADMIN_ONLY_TOOLS];
export const AGENT_TOOL_REGISTRY: AgentToolDefinition[] = PUBLIC_TOOLS;

/** Politique de risque associée à chaque outil agentique : l'agent gère les confirmations de manière conversationnelle. */
export const TOOL_POLICIES: Record<string, ToolPolicy> = {
  search_web: { risk: 'safe', confirmation: false },
  search_news: { risk: 'safe', confirmation: false },
  open_url: { risk: 'safe', confirmation: false },
  memo_lookup: { risk: 'safe', confirmation: false },
  search_notes: { risk: 'safe', confirmation: false },
  list_events: { risk: 'safe', confirmation: false },
  ask_user: { risk: 'safe', confirmation: false },
  generate_code_for_canvas: { risk: 'safe', confirmation: false },
  memo_store: { risk: 'write', confirmation: false },
  link_concepts: { risk: 'write', confirmation: false },
  create_note: { risk: 'write', confirmation: false },
  create_event: { risk: 'write', confirmation: false },
  send_message: { risk: 'external', confirmation: false },
  code_workspace: { risk: 'write', confirmation: false, adminOnly: true },
  execute_code: { risk: 'write', confirmation: false, adminOnly: true },
  self_modify: { risk: 'write', confirmation: false, adminOnly: true },
};

export const AGENT_TOOLS = PUBLIC_TOOLS;
