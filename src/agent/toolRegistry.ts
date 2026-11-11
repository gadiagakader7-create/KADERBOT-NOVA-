import type { AgentToolDefinition, ToolPolicy } from '../types/agent';

/**
 * Registre unique des outils exposés au modèle agentique.
 * Les schémas restent compatibles OpenAI/Groq/OpenRouter.
 */
export const AGENT_TOOL_REGISTRY: AgentToolDefinition[] = [
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
];



/** Politique de risque associée à chaque outil agentique : l'agent gère les confirmations de manière conversationnelle. */
export const TOOL_POLICIES: Record<string, ToolPolicy> = {
  search_web: { risk: 'safe', confirmation: false },
  search_news: { risk: 'safe', confirmation: false },
  open_url: { risk: 'safe', confirmation: false },
  memo_lookup: { risk: 'safe', confirmation: false },
  search_notes: { risk: 'safe', confirmation: false },
  list_events: { risk: 'safe', confirmation: false },
  ask_user: { risk: 'safe', confirmation: false },
  memo_store: { risk: 'write', confirmation: false },
  link_concepts: { risk: 'write', confirmation: false },
  create_note: { risk: 'write', confirmation: false },
  create_event: { risk: 'write', confirmation: false },
  send_message: { risk: 'external', confirmation: false },
};

export const AGENT_TOOLS = AGENT_TOOL_REGISTRY;
