import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

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

export function createRequireAdmin(getAdminToken: () => string) {
  return function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const adminToken = getAdminToken();
    if (!adminToken) {
      res.status(503).json({ error: 'Fonction d’administration indisponible : ADMIN_TOKEN n’est pas configuré.' });
      return;
    }

    const authorization = req.header('authorization') || '';
    const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const providedToken = req.header('x-admin-token')?.trim() || bearerToken;
    const expected = Buffer.from(adminToken);
    const provided = Buffer.from(providedToken);

    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      res.status(401).json({ error: 'Jeton administrateur invalide ou manquant.' });
      return;
    }

    next();
  };
}
