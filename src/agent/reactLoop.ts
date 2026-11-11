import type { AgentToolDefinition, PendingAgentAction, ToolExecutionTrace, ToolPolicy } from '../types/agent';
import type { ToolImplementation } from './toolImplementations';

export interface ReactLoopDeps {
  agentTools: AgentToolDefinition[];
  toolPolicies: Record<string, ToolPolicy>;
  toolImplementations: Record<string, ToolImplementation>;
  validateToolArguments: (tool: string, args: Record<string, unknown>) => string | null;
  requestPendingAction: (tool: string, args: Record<string, unknown>) => PendingAgentAction;
  defaultSystemPrompt: string;
  maxAgentIterations: number;
  maxLoopDurationMs: number;
}

export async function runToolLoopWithModel(
  endpoint: string,
  apiKey: string,
  model: string,
  providerLabel: string,
  userPrompt: string,
  history: Array<{ role: string; content: string }> = [],
  deps: ReactLoopDeps,
  systemPrompt?: string,
  extraHeaders: Record<string, string> = {}
): Promise<{
  text?: string;
  provider: string;
  model: string;
  toolTrace: Array<{ tool: string; args?: any; status?: 'success' | 'error'; errorMsg?: string; resultSnippet?: string }>;
  awaitingUser?: boolean;
  question?: string;
  pendingAction?: PendingAgentAction;
}> {
  const isContinuePrompt = ['continue', 'continuer', 'poursuis', 'vas-y', 'go on', 'suite'].includes(userPrompt.trim().toLowerCase());
  const effectiveUserPrompt = isContinuePrompt
    ? "Poursuis l'analyse ou la recherche précédente et produis la synthèse finale claire et structurée en français."
    : userPrompt;

  const messages: any[] = [
    { role: 'system', content: systemPrompt || deps.defaultSystemPrompt },
    ...history,
    { role: 'user', content: effectiveUserPrompt },
  ];

  const toolTrace: Array<{ tool: string; args?: any; status?: 'success' | 'error'; errorMsg?: string; resultSnippet?: string }> = [];
  let lastText = '';
  const loopStartTime = Date.now();
  const MAX_LOOP_DURATION_MS = deps.maxLoopDurationMs; // 25s max pour éviter tout blocage réseau

  for (let i = 0; i < deps.maxAgentIterations; i++) {
    // Si le temps limite est presque atteint, forcer la synthèse directe sans nouvel appel d'outil
    const elapsed = Date.now() - loopStartTime;
    if (elapsed > MAX_LOOP_DURATION_MS) {
      console.warn(`[AGENT TIMEOUT PREVENT] Limite de temps atteinte (${elapsed}ms), synthèse immédiate...`);
      break;
    }

    const fetchController = new AbortController();
    const fetchTimeoutId = setTimeout(() => fetchController.abort(), 14000);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages,
          tools: deps.agentTools,
          tool_choice: 'auto',
          temperature: 0.5,
        }),
        signal: fetchController.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(fetchTimeoutId);
      if (fetchErr.name === 'AbortError') {
        throw new Error(`[${model}] Délai d'attente API dépassé (14s)`);
      }
      throw fetchErr;
    }
    clearTimeout(fetchTimeoutId);

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
      throw new Error(`[${model}] ${errMsg}`);
    }

    const data: any = await response.json();
    const assistantMsg = data.choices?.[0]?.message;

    if (!assistantMsg) {
      throw new Error(`[${model}] Réponse vide reçue`);
    }

    // Si la réponse contient des appels d'outils (tool_calls)
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      messages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        const fnName = toolCall.function?.name;
        let parsedArgs: any = {};
        try {
          parsedArgs = JSON.parse(toolCall.function?.arguments || '{}');
        } catch (e: any) {
          console.warn(`Arguments d'outil invalides pour ${fnName}:`, toolCall.function?.arguments);
          parsedArgs = {};
        }

        const validationError = deps.validateToolArguments(fnName, parsedArgs);
        if (validationError) {
          toolTrace.push({ tool: fnName, args: parsedArgs, status: 'error', errorMsg: validationError });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Erreur de validation : ${validationError}`,
          });
          continue;
        }

        // Cas ask_user : interruption de la boucle et retour direct
        if (fnName === 'ask_user') {
          toolTrace.push({ tool: fnName, args: parsedArgs, status: 'success' });
          return {
            awaitingUser: true,
            question: parsedArgs.question || 'Pouvez-vous préciser votre demande ?',
            provider: providerLabel,
            model,
            toolTrace,
          };
        }

        const policy = deps.toolPolicies[fnName];
        const requiresConfirmation =
          policy?.confirmation === true ||
          (fnName === 'send_message' && parsedArgs.channel !== 'whatsapp');
        if (requiresConfirmation) {
          const pendingAction = deps.requestPendingAction(fnName, parsedArgs);
          toolTrace.push({
            tool: fnName,
            args: parsedArgs,
            status: 'success',
            resultSnippet: 'En attente de confirmation utilisateur',
          });
          return {
            awaitingUser: true,
            pendingAction,
            question: `Confirmation requise : ${pendingAction.summary}`,
            provider: providerLabel,
            model,
            toolTrace,
          };
        }

        let toolResultStr = '';
        let isError = false;
        let errorDetail = '';

        try {
          const handler = deps.toolImplementations[fnName];
          if (typeof handler === 'function') {
            toolResultStr = await handler(parsedArgs);
            if (
              toolResultStr.startsWith('Erreur') ||
              toolResultStr.startsWith('Impossible') ||
              toolResultStr.startsWith('Accès refusé') ||
              toolResultStr.includes('403') ||
              toolResultStr.includes("Délai d'attente dépassé")
            ) {
              isError = true;
              errorDetail = toolResultStr.slice(0, 160);
            }
          } else {
            toolResultStr = `Outil inconnu : ${fnName}`;
            isError = true;
            errorDetail = toolResultStr;
          }
        } catch (err: any) {
          toolResultStr = `Erreur lors de l'exécution de l'outil ${fnName} : ${err.message || 'Erreur inconnue'}`;
          isError = true;
          errorDetail = err.message || 'Erreur inconnue';
        }

        const snippet = toolResultStr.replace(/\s+/g, ' ').trim().slice(0, 120);

        toolTrace.push({
          tool: fnName,
          args: parsedArgs,
          status: isError ? 'error' : 'success',
          errorMsg: isError ? errorDetail : undefined,
          resultSnippet: snippet,
        });

        // Tronquer le résultat d'un outil pour l'injecter proprement dans la conversation
        let safeContent = (typeof toolResultStr === 'string' ? toolResultStr : JSON.stringify(toolResultStr)).slice(0, 5000);
        if (isError && fnName === 'open_url') {
          safeContent += ' [Note agent : Cette page est inaccessible ou protégée. Poursuis l’analyse avec une autre source ou résume avec les données déjà disponibles.]';
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: safeContent,
        });
      }

      continue;
    }

    // Réponse texte finale
    const content = assistantMsg.content?.trim() || '';
    if (content) {
      return {
        text: content,
        provider: providerLabel,
        model,
        toolTrace,
      };
    }

    // Si le modèle n'a pas formulé de texte après l'exécution d'un ou plusieurs outils (ex: memo_lookup, memo_store)
    if (toolTrace.length > 0) {
      try {
        const synthController = new AbortController();
        const synthTimeoutId = setTimeout(() => synthController.abort(), 12000);
        messages.push({
          role: 'user',
          content: 'À partir des données obtenues par les outils ci-dessus, formule maintenant ta réponse directe, complète et naturelle pour l’utilisateur en français.',
        });
        const synthResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json',
            ...extraHeaders,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.5,
            max_tokens: 800,
          }),
          signal: synthController.signal,
        });
        clearTimeout(synthTimeoutId);
        if (synthResponse.ok) {
          const synthData: any = await synthResponse.json();
          const synthText = synthData.choices?.[0]?.message?.content?.trim();
          if (synthText) {
            return {
              text: synthText,
              provider: providerLabel,
              model,
              toolTrace,
            };
          }
        }
      } catch (synthErr: any) {
        console.warn('[REACT LOOP] Échec formulation post-outils:', synthErr.message);
      }
    }

    lastText = content;
  }

  // Si la limite d'itérations ou de temps est atteinte, solliciter une dernière synthèse rapide
  if (!lastText && messages.length > 2) {
    try {
      const finalController = new AbortController();
      const finalTimeoutId = setTimeout(() => finalController.abort(), 9000);
      messages.push({
        role: 'user',
        content: 'Synthétise maintenant en 2 à 4 paragraphes clairs les informations recueillies jusqu’ici, sans appel d’outil supplémentaire.',
      });
      const synthResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 800,
        }),
        signal: finalController.signal,
      });
      clearTimeout(finalTimeoutId);
      if (synthResponse.ok) {
        const synthData: any = await synthResponse.json();
        const synthText = synthData.choices?.[0]?.message?.content?.trim();
        if (synthText) {
          return {
            text: synthText,
            provider: providerLabel,
            model,
            toolTrace,
          };
        }
      }
    } catch (e: any) {
      console.warn('Synthèse de secours non disponible:', e.message);
    }
  }

  return {
    text: lastText || 'Voici les informations réunies sur votre demande.',
    provider: providerLabel,
    model,
    toolTrace,
  };
}
