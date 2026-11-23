import path from 'path';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { createAgentRateLimiter } from './middleware';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md', '.markdown']);

function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

function decodeFileNameHeader(rawHeader: string | undefined): string {
  if (!rawHeader || typeof rawHeader !== 'string') return '';
  try {
    return decodeURIComponent(rawHeader).trim();
  } catch {
    return rawHeader.trim();
  }
}

function isLikelyUtf8Text(buffer: Buffer): boolean {
  const sampleLen = Math.min(buffer.length, 4096);
  for (let i = 0; i < sampleLen; i++) {
    if (buffer[i] === 0) return false;
  }
  return true;
}

export function registerFileRoutes(app: Express): void {
  const checkFileRateLimit = createAgentRateLimiter(60 * 1000, 10);

  app.post(
    '/api/files/extract',
    (req: Request, res: Response, next: NextFunction) => {
      if (!checkFileRateLimit(req)) {
        res.status(429).json({
          error: 'Trop de requêtes d’extraction de fichiers. Patiente une minute avant de réessayer.',
        });
        return;
      }

      const contentLengthHeader = req.header('content-length');
      if (contentLengthHeader) {
        const declaredSize = Number.parseInt(contentLengthHeader, 10);
        if (Number.isFinite(declaredSize) && declaredSize > MAX_FILE_BYTES) {
          res.status(413).json({
            error: 'Fichier trop volumineux. La limite maximale est de 10 Mo.',
          });
          return;
        }
      }

      next();
    },
    express.raw({ type: 'application/octet-stream', limit: '10mb' }),
    (err: any, _req: Request, res: Response, next: NextFunction) => {
      if (err) {
        if (err.status === 413 || err.type === 'entity.too.large') {
          res.status(413).json({
            error: 'Fichier trop volumineux. La limite maximale est de 10 Mo.',
          });
          return;
        }
        res.status(400).json({ error: 'Flux binaire invalide.' });
        return;
      }
      next();
    },
    async (req: Request, res: Response) => {
      let buffer: Buffer | null = Buffer.isBuffer(req.body) ? req.body : null;

      try {
        if (!buffer || buffer.length === 0) {
          return res.status(400).json({ error: 'Aucun contenu de fichier reçu.' });
        }

        if (buffer.length > MAX_FILE_BYTES) {
          return res.status(413).json({
            error: 'Fichier trop volumineux. La limite maximale est de 10 Mo.',
          });
        }

        const rawName = decodeFileNameHeader(req.header('x-file-name'));
        const safeName = path.basename(rawName || 'document');
        const ext = path.extname(safeName).toLowerCase();

        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return res.status(400).json({
            error: 'Format non supporté. Formats acceptés : .txt, .md, .markdown, .pdf, .docx.',
          });
        }

        let rawText = '';

        if (ext === '.pdf') {
          if (buffer.length < 4 || buffer.subarray(0, 4).toString('ascii') !== '%PDF') {
            return res.status(400).json({
              error: 'Fichier PDF invalide (signature %PDF absente).',
            });
          }

          const parser = new PDFParse({ data: new Uint8Array(buffer) });
          try {
            const pdfResult = await parser.getText();
            rawText = pdfResult?.text || '';
          } finally {
            await parser.destroy().catch(() => {});
          }

          const normalizedPdf = normalizeExtractedText(rawText);
          if (normalizedPdf.length < 20) {
            return res.status(422).json({
              error: 'Ce PDF semble être une image scannée. Seuls les PDF contenant du texte sont lus.',
            });
          }

          return res.json({
            name: safeName,
            type: 'pdf',
            size: buffer.length,
            text: normalizedPdf,
          });
        }

        if (ext === '.docx') {
          if (buffer.length < 2 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
            return res.status(400).json({
              error: 'Fichier DOCX invalide (signature ZIP/PK absente).',
            });
          }

          const docxResult = await mammoth.extractRawText({ buffer });
          rawText = docxResult?.value || '';
          const normalizedDocx = normalizeExtractedText(rawText);

          return res.json({
            name: safeName,
            type: 'docx',
            size: buffer.length,
            text: normalizedDocx,
          });
        }

        // .txt, .md, .markdown
        if (!isLikelyUtf8Text(buffer)) {
          return res.status(400).json({
            error: 'Ce fichier texte semble contenir des données binaires non supportées.',
          });
        }

        const normalizedTxt = normalizeExtractedText(buffer.toString('utf8'));
        const cleanType = ext === '.markdown' ? 'md' : ext.slice(1);

        return res.json({
          name: safeName,
          type: cleanType,
          size: buffer.length,
          text: normalizedTxt,
        });
      } catch (err: any) {
        console.error('[FILES] Erreur extraction document:', err?.message || 'Erreur inconnue');
        return res.status(500).json({
          error: 'Impossible d’extraire le texte de ce fichier.',
        });
      } finally {
        buffer = null;
      }
    }
  );
}
