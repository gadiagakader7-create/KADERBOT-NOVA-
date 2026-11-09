export type ToolRisk = 'safe' | 'write' | 'external';

export interface ToolPolicy {
  risk: ToolRisk;
  confirmation: boolean;
}

export type JsonSchema = Record<string, unknown>;
export type AgentToolArguments = Record<string, any>;

export interface AgentToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

export interface ToolExecutionTrace {
  step?: number;
  thought?: string;
  tool: string;
  args?: AgentToolArguments;
  status?: 'success' | 'error';
  errorMsg?: string;
  resultSnippet?: string;
  observation?: string;
  strategy?: string;
  durationMs?: number;
}

export interface PendingAgentAction {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  risk: Exclude<ToolRisk, 'safe'>;
  expiresAt: string;
}

export interface AgentFallback {
  used: boolean;
  reason?: string;
}

export interface AgentResponse {
  text?: string;
  provider: string;
  model?: string;
  route?: 'local' | 'chat' | 'agent' | 'tool';
  toolTrace: ToolExecutionTrace[];
  awaitingUser?: boolean;
  question?: string;
  pendingAction?: PendingAgentAction;
  fallback?: AgentFallback;
  isFallback?: boolean;
  fallbackReason?: string;
  routedTo?: 'chat' | 'agent';
}
