import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';

export interface CodeCanvasProps {
  code: string;
  language: string;
}

export const CodeCanvas: React.FC<CodeCanvasProps> = ({ code, language }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const normalizedCode = (code ?? '').replace(/\r\n/g, '\n').replace(/\n$/, '');
  const lines = normalizedCode.split('\n');
  const totalLines = lines.length;
  const isLongCode = totalLines > 15;
  const isCollapsed = isLongCode && !isExpanded;
  const displayedCode = isCollapsed ? lines.slice(0, 5).join('\n') : normalizedCode;
  const remainingLines = Math.max(0, totalLines - 5);
  const displayLang = (language || 'code').trim() || 'code';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(normalizedCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = normalizedCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      // Silencieux si le presse-papiers est bloqué par le navigateur
    }
  };

  return (
    <div
      className={`my-3 w-full max-w-full rounded-xl bg-[#1e1e1e] border border-[#333] overflow-hidden shadow-lg shadow-black/40 transition-all ${
        isExpanded ? 'w-full' : ''
      }`}
    >
      {/* Barre d'en-tête : langage à gauche, boutons [ < > ] et [ Copier ] sur la même ligne à droite */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-[#161616] border-b border-[#333]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-400 truncate">
            {displayLang}
          </span>
          <span className="text-[11px] font-mono text-gray-500 shrink-0">
            {totalLines} {totalLines > 1 ? 'lignes' : 'ligne'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className={`px-2 py-1 rounded-md border text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
              isExpanded
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-[#252526] hover:bg-[#2f2f31] border-[#333] text-gray-300 hover:text-white'
            }`}
            title={isExpanded ? 'Réduire l’aperçu' : 'Agrandir le code'}
            aria-label={isExpanded ? 'Réduire' : 'Agrandir'}
          >
            {'< >'}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              copied
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-[#252526] hover:bg-[#2f2f31] border-[#333] text-gray-300 hover:text-white'
            }`}
            title="Copier tout le code"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copié !</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copier</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contenu du code (affichage uniquement, jamais d'exécution) */}
      <div
        className={`w-full overflow-x-auto ${
          isExpanded ? 'max-h-[600px] overflow-y-auto' : ''
        }`}
      >
        <pre className="m-0 p-3.5 font-mono text-[13px] leading-relaxed text-gray-100 whitespace-pre">
          <code>{displayedCode}</code>
        </pre>
      </div>

      {isCollapsed && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full text-left px-3.5 py-2 border-t border-[#333] bg-[#181818] hover:bg-[#222224] text-gray-400 hover:text-emerald-300 font-mono text-[13px] transition-colors cursor-pointer"
        >
          ... {remainingLines} lignes.
        </button>
      )}
    </div>
  );
};
