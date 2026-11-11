/**
 * Routeur d'intention rapide (CHAT vs AGENT)
 * Utilise openai/gpt-oss-20b sur Groq avec fallback transparent vers AGENT en cas de doute ou d'échec.
 */
export async function classifyIntentWithRouter(
  userPrompt: string,
  _history: Array<{ role: string; content: string }> = [],
  customGroqApiKey?: string
): Promise<'CHAT' | 'AGENT'> {
  const clean = userPrompt.trim().toLowerCase();
  // Si l'utilisateur demande de continuer ou poursuivre, c'est immédiatement une tâche AGENT
  if (['continue', 'continuer', 'poursuis', 'vas-y', 'go on', 'suite'].includes(clean)) {
    return 'AGENT';
  }

  // Détection directe des requêtes mémoire, préférences, notes et outils
  if (
    clean.includes('mémoire') ||
    clean.includes('memoire') ||
    clean.includes('retiens') ||
    clean.includes('mémorise') ||
    clean.includes('memorise') ||
    clean.includes('rappelle') ||
    clean.includes('note') ||
    clean.includes('agenda') ||
    clean.includes('événement') ||
    clean.includes('evenement') ||
    clean.includes('fruits') ||
    clean.includes("j'aime") ||
    clean.includes('jaime') ||
    clean.includes('préfère') ||
    clean.includes('prefere') ||
    clean.includes('qui suis-je')
  ) {
    return 'AGENT';
  }

  const groqKey = (customGroqApiKey || process.env.GROQ_API_KEY || '').trim();
  if (!groqKey) {
    // Si pas de clé Groq, basculer par défaut sur AGENT pour préserver la cascade
    return 'AGENT';
  }

  try {
    const classificationPrompt = `Réponds uniquement CHAT ou AGENT.
AGENT si le message demande une information en mémoire ou personnelle (ex: "Quels fruits j'aime ?"), une recherche web, une actualité, ou d'apprendre/noter un fait.
CHAT uniquement pour les salutations simples ("bonjour", "coucou") ou de la pure discussion informelle.

Message: "${userPrompt.replace(/"/g, '\\"')}"
Classification:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: classificationPrompt }],
        max_tokens: 150,
        temperature: 0,
        reasoning_format: 'parsed',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[ROUTER AGENT] Classification HTTP ${response.status}, défaut = AGENT`);
      return 'AGENT';
    }

    const data: any = await response.json();
    const msgObj = data.choices?.[0]?.message;
    const content = (msgObj?.content || '').trim().toUpperCase();
    const reasoning = (msgObj?.reasoning || '').trim().toUpperCase();

    if (content.includes('CHAT') || (!content && reasoning.slice(-80).includes('CHAT'))) {
      return 'CHAT';
    }
    return 'AGENT';
  } catch (err: any) {
    console.warn(`[ROUTER AGENT] Erreur classification (${err.message}), défaut = AGENT`);
    return 'AGENT';
  }
}
