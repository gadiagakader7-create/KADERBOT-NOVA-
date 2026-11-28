import React, { useEffect, useRef, useState } from 'react';
import { Brain, Lock } from 'lucide-react';
import { apiService } from '../services/apiService';

interface AdminAuthScreenProps {
  savedToken: string;
  onAuthenticated: (sessionId: string, tokenToSave: string) => void;
  onExitToPublic: () => void;
}

type AuthStep = 'token' | 'keyword';
type VisualState = 'idle' | 'verifying' | 'success' | 'denied';

const MIN_VERIFY_DURATION_MS = 800;
const SUCCESS_DELAY_MS = 900;
const DENIED_DELAY_MS = 1200;

export const AdminAuthScreen: React.FC<AdminAuthScreenProps> = ({
  savedToken,
  onAuthenticated,
  onExitToPublic,
}) => {
  const initialToken = savedToken.trim();
  const [step, setStep] = useState<AuthStep>(() => (initialToken ? 'keyword' : 'token'));
  const [tokenValue, setTokenValue] = useState<string>(() => initialToken);
  const [keywordValue, setKeywordValue] = useState<string>('');
  const [visualState, setVisualState] = useState<VisualState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const clearPendingTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      clearPendingTimeout();
    };
  }, []);

  useEffect(() => {
    if (visualState === 'idle') {
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(id);
    }
  }, [step, visualState]);

  const handleExitClick = () => {
    cancelledRef.current = true;
    clearPendingTimeout();
    setKeywordValue('');
    setTokenValue('');
    onExitToPublic();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (visualState === 'verifying' || visualState === 'success' || visualState === 'denied') {
      return;
    }

    if (step === 'token') {
      const trimmedToken = tokenValue.trim();
      if (!trimmedToken) {
        setErrorMessage('Saisis le jeton administrateur.');
        inputRef.current?.focus();
        return;
      }
      setTokenValue(trimmedToken);
      setErrorMessage(null);
      setStep('keyword');
      return;
    }

    if (!keywordValue.trim()) {
      inputRef.current?.focus();
      return;
    }

    const submittedKeyword = keywordValue;
    const submittedToken = tokenValue.trim();

    setVisualState('verifying');
    setErrorMessage(null);

    const startedAt = Date.now();
    const result = await apiService.loginAdminSession({
      keyword: submittedKeyword,
      token: submittedToken,
    });

    // Effacer immédiatement le mot-clé de l'état React dès réception de la réponse serveur.
    setKeywordValue('');

    if (cancelledRef.current) {
      if (result.ok && result.sessionId) {
        void apiService.logoutAdminSession(result.sessionId, submittedToken);
      }
      return;
    }

    const elapsed = Date.now() - startedAt;
    const remainingMinDuration = Math.max(0, MIN_VERIFY_DURATION_MS - elapsed);

    const finalizeResponse = () => {
      if (cancelledRef.current) {
        if (result.ok && result.sessionId) {
          void apiService.logoutAdminSession(result.sessionId, submittedToken);
        }
        return;
      }

      if (result.ok && result.sessionId) {
        setVisualState('success');
        timeoutRef.current = window.setTimeout(() => {
          if (cancelledRef.current) {
            void apiService.logoutAdminSession(result.sessionId, submittedToken);
            return;
          }
          onAuthenticated(result.sessionId!, submittedToken);
        }, SUCCESS_DELAY_MS);
        return;
      }

      if (result.code === 'ADMIN_TOKEN_INVALID') {
        setVisualState('idle');
        setStep('token');
        setTokenValue('');
        setErrorMessage('Jeton administrateur invalide.');
        return;
      }

      if (
        result.code === 'ADMIN_KEYWORD_INVALID' ||
        result.code === 'ADMIN_KEYWORD_LOCKED' ||
        result.code === 'ADMIN_NOT_CONFIGURED' ||
        result.status === 429 ||
        result.status === 503
      ) {
        setVisualState('denied');
        setErrorMessage(null);
        timeoutRef.current = window.setTimeout(() => {
          if (cancelledRef.current) return;
          setTokenValue('');
          onExitToPublic();
        }, DENIED_DELAY_MS);
        return;
      }

      setVisualState('idle');
      setErrorMessage(
        result.status === 0
          ? 'Connexion au serveur impossible. Réessaye.'
          : 'Service temporairement indisponible. Réessaye.'
      );
    };

    if (remainingMinDuration > 0) {
      timeoutRef.current = window.setTimeout(finalizeResponse, remainingMinDuration);
    } else {
      finalizeResponse();
    }
  };

  const isLockedInput =
    visualState === 'verifying' || visualState === 'success' || visualState === 'denied';

  const glowClass =
    visualState === 'success'
      ? 'bg-emerald-500/25'
      : visualState === 'denied'
      ? 'bg-rose-500/20'
      : 'bg-slate-400/5';

  const ringClass =
    visualState === 'success'
      ? 'border-emerald-400/80 shadow-[0_0_34px_rgba(16,185,129,0.35)]'
      : visualState === 'denied'
      ? 'border-rose-500/80 shadow-[0_0_32px_rgba(244,63,94,0.32)]'
      : 'border-gray-700/80 shadow-[0_0_24px_rgba(148,163,184,0.08)]';

  const brainClass =
    visualState === 'success'
      ? 'text-emerald-400'
      : visualState === 'denied'
      ? 'text-rose-400'
      : 'text-gray-400';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#050508] text-gray-100 overflow-y-auto overscroll-contain public-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Authentification administrateur"
    >
      <div className="min-h-full w-full flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-xs flex flex-col items-center">
          {/* Logo Cerveau KaderBot centré */}
          <div className="relative mb-7">
            <div className={`absolute inset-0 rounded-full blur-2xl transition-colors duration-300 ${glowClass}`} />
            <div
              className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 bg-[#0E131F] flex items-center justify-center transition-all duration-300 ${ringClass}`}
            >
              <Brain
                className={`w-10 h-10 sm:w-12 sm:h-12 transition-colors duration-300 ${brainClass}`}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
          </div>

          <h1 className="text-sm font-medium tracking-wide text-gray-400 mb-5 text-center">
            Accès administrateur
          </h1>

          {/* Formulaire avec un seul champ masqué */}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="password"
                value={step === 'token' ? tokenValue : keywordValue}
                onChange={e => {
                  if (step === 'token') {
                    setTokenValue(e.target.value);
                  } else {
                    setKeywordValue(e.target.value);
                  }
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder={step === 'token' ? 'Admin Token' : 'Keyword'}
                aria-label={step === 'token' ? 'Admin Token' : 'Admin Authentification Keyword'}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint={step === 'token' ? 'next' : 'go'}
                disabled={isLockedInput}
                className="w-full h-12 rounded-2xl bg-[#0E131F] border border-gray-800 focus:border-gray-600 pl-4 pr-14 text-sm text-gray-100 placeholder-gray-500 outline-none transition-colors disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={isLockedInput}
                aria-label={step === 'token' ? 'Continuer' : 'Valider l’authentification'}
                className={`absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 disabled:cursor-default ${
                  visualState === 'verifying'
                    ? 'text-gray-200 bg-gray-800/70'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/60 active:scale-95'
                }`}
              >
                <Lock
                  className={`w-4 h-4 ${
                    visualState === 'verifying'
                      ? 'animate-spin motion-reduce:animate-none motion-reduce:opacity-60'
                      : ''
                  }`}
                  aria-hidden="true"
                />
                {visualState === 'verifying' && (
                  <span className="sr-only">Vérification en cours</span>
                )}
              </button>
            </div>

            {errorMessage && (
              <p className="mt-3 text-center text-xs text-gray-400" role="alert">
                {errorMessage}
              </p>
            )}
          </form>

          {/* Lien discret vers le mode public */}
          <button
            type="button"
            onClick={handleExitClick}
            className="mt-7 py-2 px-3 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
          >
            Retour au mode public
          </button>
        </div>
      </div>
    </div>
  );
};
