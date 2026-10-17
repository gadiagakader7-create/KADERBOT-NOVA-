import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Brain,
  ThumbsUp,
  ThumbsDown,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import { ChatMessage } from '../types/kaderbot';

interface ChatTabProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSendMessage: (text: string) => void;
  onClearMessages: () => void;
  onAdjustWeight: (sujet: string, delta: number) => void;
  soundEnabled: boolean;
  activeSession: string;
  prefilledText?: string;
  onClearPrefill?: () => void;
  onOpenActions?: () => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
  isThinking,
  onSendMessage,
  onClearMessages,
  onAdjustWeight,
  soundEnabled,
  activeSession,
  prefilledText,
  onClearPrefill,
  onOpenActions,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync prefilledText when passed from Action menu or chips
  useEffect(() => {
    if (prefilledText !== undefined && prefilledText !== '') {
      setInputText(prefilledText);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = prefilledText.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 50);
      onClearPrefill?.();
    }
  }, [prefilledText, onClearPrefill]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Voice Speech Recognition
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée sur ce navigateur.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  // Text-to-speech for a specific message
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isThinking) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  const handleScrollUnits = (direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      const amount = direction === 'up' ? -250 : 250;
      scrollContainerRef.current.scrollBy({ top: amount, behavior: 'smooth' });
    }
  };

  const quickPills = [
    { label: 'C’est quoi...', text: "c'est quoi " },
    { label: 'Pourquoi...', text: 'pourquoi ' },
    { label: 'Retenir un fait', text: 'retiens: ' },
    { label: 'Règle tous les...', text: 'retiens: tous les ' },
    { label: 'Lier concepts', text: 'lie: ' },
    { label: 'Générer idées', text: 'idees 5: ' },
    { label: 'Traduire', text: 'traduis en anglais: ' },
    { label: 'Lister mémoire', text: 'lister: memoire' },
  ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-112px)] sm:h-[calc(100vh-120px)] relative overflow-hidden bg-[#050508] cyber-bg">
      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-5"
      >
        {/* Session banner */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900/80 border border-gray-800 text-[11px] text-gray-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Session cognitive : {activeSession}</span>
          </div>
        </div>

        {/* Message bubbles */}
        {messages.map(msg => {
          const isUser = msg.author === 'Toi';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group transition-all`}
            >
              {/* Author name & source badge */}
              <div
                className={`flex items-center gap-2 mb-1 px-1 text-[11px] font-semibold ${
                  isUser ? 'text-gray-400' : 'text-emerald-400'
                }`}
              >
                <span>{isUser ? 'TOI' : 'KADERBOT NOVA'}</span>
                {!isUser && msg.meta?.source && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700/60">
                    {msg.meta.source === 'deduction'
                      ? '⛓️ Déduction logique'
                      : msg.meta.source === 'local_memoire'
                      ? '🧠 Mémoire interne'
                      : msg.meta.source === 'regle'
                      ? '📐 Règle universelle'
                      : msg.meta.source === 'gemini'
                      ? '✨ Gemini 3.8'
                      : msg.meta.source === 'groq'
                      ? '⚡ Groq'
                      : 'Système'}
                  </span>
                )}
                {msg.confidence !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded ${
                      msg.confidence >= 0.75
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                    }`}
                  >
                    {Math.round(msg.confidence * 100)}% certitude
                  </span>
                )}
                <span className="text-gray-600 text-[10px]">{msg.timestamp}</span>
              </div>

              {/* Message box */}
              <div
                className={`relative max-w-[92%] sm:max-w-[78%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm leading-relaxed shadow-lg ${
                  isUser
                    ? 'bg-[#1E2028] text-white border border-gray-700/60 rounded-tr-sm'
                    : 'bg-[#0E131F] text-gray-100 border border-emerald-500/25 rounded-tl-sm shadow-emerald-950/20'
                }`}
              >
                {/* Main text */}
                <div className="whitespace-pre-wrap break-words">{msg.text}</div>

                {/* Deductive chain visual crumb if applicable */}
                {!isUser && msg.meta?.chemin && msg.meta.chemin.length > 1 && (
                  <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex items-center gap-1.5 flex-wrap text-[11px] text-cyan-300 font-mono">
                    <span className="text-gray-500">Chaîne cognitive :</span>
                    {msg.meta.chemin.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className="bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/30">
                          {step}
                        </span>
                        {idx < msg.meta!.chemin!.length - 1 && <span className="text-gray-600">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {/* Interactive Cognitive Feedback buttons (just like Python script!) */}
                {!isUser && msg.meta?.sujet && (
                  <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-gray-400">
                      Ce fait sur <span className="text-emerald-400 font-mono font-bold">{msg.meta.sujet}</span> est-il exact ?
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onAdjustWeight(msg.meta!.sujet!, 0.1)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium transition active:scale-95"
                        title="Renforcer le poids de confiance (+0.1)"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>Exact (+0.1)</span>
                      </button>
                      <button
                        onClick={() => onAdjustWeight(msg.meta!.sujet!, -0.15)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-300 text-[11px] font-medium transition active:scale-95"
                        title="Baisser le poids de confiance (-0.15)"
                      >
                        <ThumbsDown className="w-3 h-3" />
                        <span>Inexact (-0.15)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Message action bar: Copy & Speech */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px]"
                    title="Copier le texte"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  {!isUser && (
                    <button
                      onClick={() => speakText(msg.text)}
                      className="p-1 rounded bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px]"
                      title="Lire à haute voix"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking Indicator (faithfully reproducing the ". . ." animation from Python Tkinter) */}
        {isThinking && (
          <div className="flex flex-col items-start space-y-1 animate-in fade-in">
            <span className="text-[11px] font-semibold text-emerald-400 px-1">KADERBOT NOVA</span>
            <div className="bg-[#0E131F] border border-emerald-500/30 rounded-2xl px-5 py-3 text-emerald-400 flex items-center gap-2">
              <span className="font-mono text-sm tracking-widest animate-pulse">. . .</span>
              <span className="text-xs text-gray-400 ml-1">KADERBOT réfléchit...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll Buttons (From Tkinter V13.8 on Android) */}
      <div className="absolute right-4 bottom-28 sm:bottom-32 z-20 flex flex-col gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
        <button
          onClick={() => handleScrollUnits('up')}
          className="w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-lg active:scale-95"
          title="Défiler vers le haut"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleScrollUnits('down')}
          className="w-8 h-8 rounded-full bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-lg active:scale-95"
          title="Défiler vers le bas"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Pills */}
      <div className="px-3 sm:px-6 py-1.5 border-t border-gray-800/60 bg-[#090B10]/80 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
        {quickPills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => setInputText(pill.text)}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/40 text-[11px] font-medium text-gray-300 hover:text-emerald-300 transition"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Input Form Bar */}
      <div className="p-2.5 sm:p-4 bg-[#090B10] border-t border-gray-800/80">
        <form onSubmit={handleFormSubmit} className="max-w-7xl mx-auto flex items-center gap-2">
          {/* Voice input button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`p-2.5 rounded-xl border transition-all ${
              isRecording
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
            }`}
            title={isRecording ? 'Arrêter dictée' : 'Dicter vocalement en français'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text entry field */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Pose une question, écris 'pourquoi...', ou 'retiens: sujet = définition'..."
              className="w-full bg-[#161822] border border-gray-800 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition shadow-inner"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/40 transition active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Envoyer</span>
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClearMessages}
            className="p-2.5 sm:p-3 rounded-xl bg-gray-900 border border-gray-800 text-gray-500 hover:text-rose-400 hover:border-gray-700 transition"
            title="Effacer l'historique de discussion"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
