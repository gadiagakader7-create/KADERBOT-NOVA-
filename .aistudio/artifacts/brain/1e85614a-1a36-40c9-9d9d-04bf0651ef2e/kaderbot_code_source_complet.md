# KADERBOT NOVA — Code Source & Modifications Récentes

Ce document présente les améliorations majeures apportées à **KADERBOT NOVA** :
1. **Formatage Markdown & Structure des réponses** :
   - Mise à jour du **System Prompt** dans `src/App.tsx` et `server.ts` pour exiger des réponses structurées (listes à puces avec tirets, mise en gras avec astérisques, sauts de lignes et paragraphes aérés).
   - Intégration de la bibliothèque `react-markdown` pour rendre le Markdown de manière fluide, élégante et lisible.
2. **Effet Machine à Écrire / Streaming (Typewriter)** :
   - Affichage progressif caractère par caractère (~20ms par caractère).
   - Disparition instantanée de l'indicateur « KADERBOT réfléchit... » dès l'apparition du premier caractère.
   - Les messages de l'historique ou lors d'un changement de discussion s'affichent instantanément sans être re-tapés.
   - Auto-scroll fluide vers le bas qui accompagne la frappe en temps réel.

---

## 1. Nouveau System Prompt (App.tsx & server.ts)

```text
Tu es KADERBOT NOVA, un assistant IA expert, chaleureux et pédagogue. Tu réponds toujours en français. Tu dois structurer tes réponses : utilise des sauts de ligne, des listes à puces (avec des tirets) et du texte en gras (avec des astérisques *) pour les mots importants. Si la question est simple, sois bref. Si la question demande une explication, développe avec des paragraphes clairs. Ne fais jamais un bloc de texte compact.
```

---

## 2. Code du Composant Typewriter & Markdown (`src/components/ChatTab.tsx`)

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface BotTypewriterMessageProps {
  text: string;
  isNew: boolean;
  onComplete: () => void;
  onTick?: () => void;
}

/**
 * Composant de message KADERBOT NOVA avec effet machine à écrire (streaming)
 * et rendu Markdown riche (listes à puces, gras, blocs de code, citations).
 */
const BotTypewriterMessage: React.FC<BotTypewriterMessageProps> = ({
  text,
  isNew,
  onComplete,
  onTick,
}) => {
  const [displayedLength, setDisplayedLength] = useState(() => (isNew ? 1 : text.length));
  const isTyping = isNew && displayedLength < text.length;

  useEffect(() => {
    if (!isNew) {
      setDisplayedLength(text.length);
      return;
    }

    if (displayedLength >= text.length) {
      onComplete();
      return;
    }

    // Vitesse fluide ~20ms par caractère
    const interval = setInterval(() => {
      setDisplayedLength(prev => {
        const step = text.length > 350 ? 2 : 1;
        const next = Math.min(text.length, prev + step);
        if (next >= text.length) {
          clearInterval(interval);
          onComplete();
        }
        return next;
      });
      onTick?.();
    }, 20);

    return () => clearInterval(interval);
  }, [isNew, text, onComplete, onTick]);

  const displayedContent = isNew ? text.slice(0, displayedLength) : text;

  return (
    <div className="relative">
      <div className="text-gray-100 text-xs sm:text-sm leading-relaxed">
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p className="mb-2.5 last:mb-0 leading-relaxed text-gray-100">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1.5 my-2.5 text-gray-200 pl-1">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-1.5 my-2.5 text-gray-200 pl-1">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => (
              <strong className="font-semibold text-emerald-300">{children}</strong>
            ),
            em: ({ children }) => <em className="italic text-cyan-200">{children}</em>,
            code: ({ className, children }: any) => {
              const isMultiLine = typeof children === 'string' && children.includes('\n');
              if (className || isMultiLine) {
                return (
                  <pre className="p-3 my-2.5 rounded-xl bg-[#080B11] border border-gray-800 font-mono text-[11px] sm:text-xs overflow-x-auto text-emerald-200 leading-normal">
                    <code className={className}>{children}</code>
                  </pre>
                );
              }
              return (
                <code className="px-1.5 py-0.5 rounded bg-gray-800/90 text-emerald-300 font-mono text-[11px] sm:text-xs border border-gray-700/50">
                  {children}
                </code>
              );
            },
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-emerald-500/60 pl-3 italic text-gray-300 my-2">
                {children}
              </blockquote>
            ),
            h1: ({ children }) => (
              <h1 className="text-base font-bold text-white mb-2">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-sm font-bold text-emerald-400 mb-1.5">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-xs font-bold text-cyan-300 mb-1">{children}</h3>
            ),
            hr: () => <hr className="my-3 border-gray-800" />,
          }}
        >
          {displayedContent}
        </ReactMarkdown>
      </div>
      {isTyping && (
        <span
          className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse ml-0.5 align-middle rounded-xs"
          title="Frappe en cours..."
        />
      )}
    </div>
  );
};
```
