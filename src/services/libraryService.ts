import { LibraryDoc } from '../types/kaderbot';
import { apiService } from './apiService';

const DB_NAME = 'kaderbot_library';
const DB_VERSION = 1;
const STORE_NAME = 'docs';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo
export const MAX_LIBRARY_BYTES = 200 * 1024 * 1024; // 200 Mo

const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.pdf', '.docx']);
const LOCAL_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);

const textEncoder = new TextEncoder();

export function getTextByteSize(text: string): number {
  return textEncoder.encode(text || '').length;
}

export function normalizeDocumentText(raw: string): string {
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

function getFileExtension(name: string): string {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx < 0) return '';
  return name.slice(dotIdx).toLowerCase();
}

function openLibraryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB n’est pas disponible sur ce navigateur.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Erreur d’ouverture de la bibliothèque locale.'));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (val: T) => void, reject: (err: any) => void) => void
): Promise<T> {
  return openLibraryDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('Erreur IndexedDB'));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error || new Error('Transaction IndexedDB annulée'));
        };
        executor(store, resolve, reject);
      })
  );
}

export async function listDocs(): Promise<LibraryDoc[]> {
  const docs = await runTransaction<LibraryDoc[]>('readonly', (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as LibraryDoc[]) || []);
    req.onerror = () => reject(req.error);
  });

  return docs.sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt));
}

export async function getTotalSize(): Promise<number> {
  const docs = await listDocs();
  return docs.reduce((sum, doc) => sum + getTextByteSize(doc.text), 0);
}

export async function getDoc(id: string): Promise<LibraryDoc | null> {
  return runTransaction<LibraryDoc | null>('readonly', (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as LibraryDoc | undefined) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function addDoc(
  docInput: Omit<LibraryDoc, 'id' | 'addedAt'> & { id?: string; addedAt?: string }
): Promise<LibraryDoc> {
  const existing = await listDocs();
  const currentTotal = existing.reduce((sum, doc) => sum + getTextByteSize(doc.text), 0);
  const incomingBytes = getTextByteSize(docInput.text);

  if (currentTotal + incomingBytes > MAX_LIBRARY_BYTES) {
    throw new Error('Bibliothèque pleine (200 Mo). Supprime des fichiers pour continuer.');
  }

  if (existing.length === 0 && typeof navigator !== 'undefined' && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  const newDoc: LibraryDoc = {
    id: docInput.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: docInput.name,
    type: docInput.type,
    size: docInput.size,
    addedAt: docInput.addedAt || new Date().toISOString(),
    text: docInput.text,
  };

  await runTransaction<void>('readwrite', (store, resolve, reject) => {
    const req = store.put(newDoc);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return newDoc;
}

export async function renameDoc(id: string, newName: string): Promise<LibraryDoc> {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error('Le nom du document ne peut pas être vide.');
  }

  const existing = await getDoc(id);
  if (!existing) {
    throw new Error('Document introuvable.');
  }

  const updated: LibraryDoc = { ...existing, name: trimmed };
  await runTransaction<void>('readwrite', (store, resolve, reject) => {
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return updated;
}

export async function deleteDoc(id: string): Promise<void> {
  await runTransaction<void>('readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function exportLibrary(): Promise<string> {
  const docs = await listDocs();
  return JSON.stringify(
    {
      app: 'KADERBOT NOVA',
      version: 1,
      exportedAt: new Date().toISOString(),
      docs,
    },
    null,
    2
  );
}

export async function importLibrary(jsonStr: string): Promise<{ imported: number; skipped: number }> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Fichier JSON invalide.');
  }

  const candidateList: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.docs)
      ? parsed.docs
      : [];

  if (!Array.isArray(candidateList) || candidateList.length === 0) {
    throw new Error('Aucun document valide trouvé dans ce fichier JSON.');
  }

  const existing = await listDocs();
  const existingIds = new Set(existing.map(d => d.id));
  let runningBytes = existing.reduce((sum, doc) => sum + getTextByteSize(doc.text), 0);

  let imported = 0;
  let skipped = 0;

  for (const item of candidateList) {
    if (!item || typeof item.name !== 'string' || typeof item.text !== 'string') {
      skipped += 1;
      continue;
    }

    const docBytes = getTextByteSize(item.text);
    if (runningBytes + docBytes > MAX_LIBRARY_BYTES) {
      throw new Error('Bibliothèque pleine (200 Mo). Supprime des fichiers pour continuer.');
    }

    const docId =
      typeof item.id === 'string' && item.id.trim() && !existingIds.has(item.id)
        ? item.id
        : `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    existingIds.add(docId);
    runningBytes += docBytes;

    await addDoc({
      id: docId,
      name: item.name,
      type: typeof item.type === 'string' && item.type ? item.type : 'txt',
      size: typeof item.size === 'number' && Number.isFinite(item.size) ? item.size : docBytes,
      addedAt: typeof item.addedAt === 'string' && item.addedAt ? item.addedAt : new Date().toISOString(),
      text: item.text,
    });
    imported += 1;
  }

  return { imported, skipped };
}

export async function extractFileForLibrary(file: File): Promise<{
  name: string;
  type: string;
  size: number;
  text: string;
}> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Fichier trop volumineux. La limite maximale est de 10 Mo.');
  }

  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('Format non supporté. Formats acceptés : .txt, .md, .markdown, .pdf, .docx.');
  }

  if (LOCAL_TEXT_EXTENSIONS.has(ext)) {
    const raw = await file.text();
    return {
      name: file.name,
      type: ext === '.markdown' ? 'md' : ext.slice(1),
      size: file.size,
      text: normalizeDocumentText(raw),
    };
  }

  return apiService.extractFileText(file);
}
