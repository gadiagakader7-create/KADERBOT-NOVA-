export interface MemoryEntry {
  def: string;
  poids: number; // 0.1 to 1.0
  hits: number;
  source: 'manuel' | 'groq' | 'gemini' | 'auto';
  last_used: string;
  created: string;
  question_origine?: string;
  type?: 'concept' | 'question_reponse';
  mots_cles?: string[];
  vecteur?: number[]; // Vecteur d'embedding sémantique (Transformers.js all-MiniLM-L6-v2)
}

export interface GeneralRule {
  quant: 'tous' | 'aucun' | 'certains';
  prop: string;
  poids: number;
  hits: number;
  last_used: string;
  created: string;
}

export type MemoryStore = Record<string, MemoryEntry[]>;
export type RulesStore = Record<string, GeneralRule[]>;
export type LinksStore = Record<string, string[]>;
export type SynonymsStore = Record<string, string | string[]>;

export interface ChatMessage {
  id: string;
  author: 'Toi' | 'KB';
  text: string;
  timestamp: string;
  confidence?: number;
  meta?: {
    intent?: string;
    sujet?: string;
    chemin?: string[];
    source?: 'local_memoire' | 'deduction' | 'regle' | 'groq' | 'gemini' | 'systeme' | 'semantique';
    ruleApplied?: string;
  };
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface IdeaItem {
  id: number;
  title: string;
  theme: string;
  style: string;
  timestamp: string;
  developedText?: string;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  category: string;
  weight: number;
  hits: number;
  definitionsCount: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type: 'is_a' | 'custom_link' | 'rule';
}

export type LLMProvider = 'gemini' | 'groq' | 'local_only';

export interface AppConfig {
  provider: LLMProvider;
  geminiApiKey?: string;
  groqApiKey?: string;
  groqModel: string;
  geminiModel: string;
  systemPrompt: string;
  activeSession: string;
  soundEnabled: boolean;
  autoLearnFromLLM: boolean;
  contexteRecent?: string[];
}
