import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const ADMIN_SESSION_IDLE_MS = 30 * 60 * 1000; // 30 minutes sans requête
export const ADMIN_SESSION_MAX_MS = 8 * 60 * 60 * 1000; // 8 heures maximum
export const ADMIN_KEYWORD_MAX_FAILURES = 5;
export const ADMIN_KEYWORD_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes de blocage

export type AdminErrorCode =
  | 'ADMIN_NOT_CONFIGURED'
  | 'ADMIN_TOKEN_INVALID'
  | 'ADMIN_KEYWORD_INVALID'
  | 'ADMIN_SESSION_REQUIRED'
  | 'ADMIN_KEYWORD_LOCKED';

interface AdminSessionRecord {
  createdAt: number;
  lastActivityAt: number;
}

export interface AdminSecurityConfig {
  getAdminToken: () => string;
  getAdminKeyword: () => string;
  idleTimeoutMs?: number;
  maxSessionMs?: number;
  maxKeywordFailures?: number;
  lockoutDurationMs?: number;
}

export interface AdminSecurityController {
  requireAdmin: RequestHandler;
  createSessionHandler: RequestHandler;
  destroySessionHandler: RequestHandler;
  clearAllSessions: () => void;
}

export function normalizeAdminKeyword(raw: string): string {
  return raw.trim().normalize('NFC');
}

function constantTimeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a, 'utf8').digest();
  const hashB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(hashA, hashB);
}

function extractProvidedAdminToken(req: Request): string {
  const authorization = req.header('authorization') || '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  return (req.header('x-admin-token')?.trim() || bearerToken).trim();
}

export function createAgentRateLimiter(windowMs = 60 * 1000, maxRequests = 10) {
  const agentRateLimits = new Map<string, { startedAt: number; count: number }>();

  return function checkAgentRateLimit(req: Request): boolean {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = agentRateLimits.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      agentRateLimits.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= maxRequests) return false;
    current.count += 1;
    return true;
  };
}

export function createAdminSecurity(config: AdminSecurityConfig): AdminSecurityController {
  const idleTimeoutMs = config.idleTimeoutMs ?? ADMIN_SESSION_IDLE_MS;
  const maxSessionMs = config.maxSessionMs ?? ADMIN_SESSION_MAX_MS;
  const maxKeywordFailures = config.maxKeywordFailures ?? ADMIN_KEYWORD_MAX_FAILURES;
  const lockoutDurationMs = config.lockoutDurationMs ?? ADMIN_KEYWORD_LOCKOUT_MS;

  const sessions = new Map<string, AdminSessionRecord>();
  let keywordFailures = 0;
  let lockedUntil = 0;

  const pruneExpiredSessions = (now: number) => {
    for (const [sid, record] of sessions.entries()) {
      if (now - record.lastActivityAt > idleTimeoutMs || now - record.createdAt > maxSessionMs) {
        sessions.delete(sid);
      }
    }
  };

  const verifyConfiguredSecrets = (res: Response): { adminToken: string; adminKeyword: string } | null => {
    const adminToken = (config.getAdminToken() || '').trim();
    const adminKeyword = normalizeAdminKeyword(config.getAdminKeyword() || '');
    if (!adminToken || !adminKeyword) {
      res.status(503).json({
        error: 'Fonction d’administration indisponible : ADMIN_TOKEN ou ADMIN_AUTH_KEYWORD n’est pas configuré.',
        code: 'ADMIN_NOT_CONFIGURED' as AdminErrorCode,
      });
      return null;
    }
    return { adminToken, adminKeyword };
  };

  const verifyAdminTokenOrReject = (req: Request, res: Response, expectedToken: string): boolean => {
    const providedToken = extractProvidedAdminToken(req);
    if (!providedToken || !constantTimeEqual(providedToken, expectedToken)) {
      res.status(401).json({
        error: 'Jeton administrateur invalide ou manquant.',
        code: 'ADMIN_TOKEN_INVALID' as AdminErrorCode,
      });
      return false;
    }
    return true;
  };

  const createSessionHandler: RequestHandler = (req: Request, res: Response): void => {
    const secrets = verifyConfiguredSecrets(res);
    if (!secrets) return;

    // Un jeton faux ne compte jamais dans les tentatives de mot-clé.
    if (!verifyAdminTokenOrReject(req, res, secrets.adminToken)) {
      return;
    }

    const now = Date.now();
    pruneExpiredSessions(now);

    if (lockedUntil > now) {
      res.status(429).json({
        error: 'Trop de tentatives invalides. Accès temporairement bloqué.',
        code: 'ADMIN_KEYWORD_LOCKED' as AdminErrorCode,
      });
      return;
    }

    const rawKeyword = typeof req.body?.keyword === 'string' ? req.body.keyword : '';
    const providedKeyword = normalizeAdminKeyword(rawKeyword);

    if (!providedKeyword || !constantTimeEqual(providedKeyword, secrets.adminKeyword)) {
      keywordFailures += 1;
      if (keywordFailures >= maxKeywordFailures) {
        lockedUntil = now + lockoutDurationMs;
        keywordFailures = 0;
      }
      res.status(401).json({
        error: 'Mot-clé administrateur invalide.',
        code: 'ADMIN_KEYWORD_INVALID' as AdminErrorCode,
      });
      return;
    }

    keywordFailures = 0;
    lockedUntil = 0;

    const sessionId = randomBytes(32).toString('hex');
    sessions.set(sessionId, {
      createdAt: now,
      lastActivityAt: now,
    });

    res.json({
      ok: true,
      sessionId,
    });
  };

  const destroySessionHandler: RequestHandler = (req: Request, res: Response): void => {
    const secrets = verifyConfiguredSecrets(res);
    if (!secrets) return;

    if (!verifyAdminTokenOrReject(req, res, secrets.adminToken)) {
      return;
    }

    const headerSession = req.header('x-admin-session')?.trim() || '';
    const bodySession = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
    const sessionId = headerSession || bodySession;
    if (sessionId) {
      sessions.delete(sessionId);
    }

    res.json({ ok: true });
  };

  const requireAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
    const secrets = verifyConfiguredSecrets(res);
    if (!secrets) return;

    if (!verifyAdminTokenOrReject(req, res, secrets.adminToken)) {
      return;
    }

    const now = Date.now();
    pruneExpiredSessions(now);

    const sessionId = req.header('x-admin-session')?.trim() || '';
    if (!sessionId) {
      res.status(401).json({
        error: 'Session administrateur requise.',
        code: 'ADMIN_SESSION_REQUIRED' as AdminErrorCode,
      });
      return;
    }

    const record = sessions.get(sessionId);
    if (!record) {
      res.status(401).json({
        error: 'Session administrateur invalide ou expirée.',
        code: 'ADMIN_SESSION_REQUIRED' as AdminErrorCode,
      });
      return;
    }

    if (now - record.lastActivityAt > idleTimeoutMs || now - record.createdAt > maxSessionMs) {
      sessions.delete(sessionId);
      res.status(401).json({
        error: 'Session administrateur expirée.',
        code: 'ADMIN_SESSION_REQUIRED' as AdminErrorCode,
      });
      return;
    }

    record.lastActivityAt = now;
    next();
  };

  return {
    requireAdmin,
    createSessionHandler,
    destroySessionHandler,
    clearAllSessions: () => {
      sessions.clear();
    },
  };
}

export function createRequireAdmin(getAdminToken: () => string, getAdminKeyword: () => string = () => '') {
  return createAdminSecurity({ getAdminToken, getAdminKeyword }).requireAdmin;
}
