import { PersonalNote } from '../types/kaderbot';

export type { PersonalNote } from '../types/kaderbot';

const DB_NAME = 'kaderbot_personal';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

function openPersonalDb(): Promise<IDBDatabase> {
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
    request.onerror = () =>
      reject(request.error || new Error('Erreur d’ouverture de la mémoire personnelle.'));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (val: T) => void, reject: (err: any) => void) => void
): Promise<T> {
  return openPersonalDb().then(
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

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function listNotes(): Promise<PersonalNote[]> {
  const notes = await runTransaction<PersonalNote[]>('readonly', (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as PersonalNote[]) || []);
    req.onerror = () => reject(req.error);
  });

  return notes.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function addNote(
  input: Omit<PersonalNote, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<PersonalNote> {
  const cleanTitle = (input.title || '').trim();
  const cleanBody = (input.body || '').trim();
  if (!cleanTitle && !cleanBody) {
    throw new Error('Titre ou contenu requis pour enregistrer une note personnelle.');
  }

  const existing = await listNotes();
  const normTitle = normalizeText(cleanTitle);
  const normBody = normalizeText(cleanBody);
  const duplicate = existing.find(
    n => normalizeText(n.title) === normTitle && normalizeText(n.body) === normBody
  );
  if (duplicate) {
    return duplicate;
  }

  if (existing.length === 0 && typeof navigator !== 'undefined' && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  const newNote: PersonalNote = {
    id: input.id || `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: cleanTitle || 'Note',
    body: cleanBody,
    source: input.source === 'fait' ? 'fait' : 'note',
    createdAt: input.createdAt || new Date().toISOString(),
  };

  await runTransaction<void>('readwrite', (store, resolve, reject) => {
    const req = store.put(newNote);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return newNote;
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<PersonalNote, 'title' | 'body' | 'source'>>
): Promise<PersonalNote> {
  const existing = await runTransaction<PersonalNote | null>('readonly', (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as PersonalNote | undefined) || null);
    req.onerror = () => reject(req.error);
  });

  if (!existing) {
    throw new Error('Note introuvable.');
  }

  const nextTitle = typeof updates.title === 'string' ? updates.title.trim() : existing.title;
  const nextBody = typeof updates.body === 'string' ? updates.body.trim() : existing.body;
  const nextSource = updates.source === 'fait' || updates.source === 'note' ? updates.source : existing.source;

  const updated: PersonalNote = {
    ...existing,
    title: nextTitle || existing.title,
    body: nextBody,
    source: nextSource,
  };

  await runTransaction<void>('readwrite', (store, resolve, reject) => {
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  await runTransaction<void>('readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function buildPersonalContext(maxChars = 3000): Promise<string> {
  const notes = await listNotes();
  if (notes.length === 0) return '';

  const header = "CE QUE TU SAIS SUR L'UTILISATEUR (notes enregistrées) :";
  if (maxChars <= header.length) {
    return header.slice(0, Math.max(0, maxChars));
  }

  let result = header;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const line = `- ${n.title} : ${n.body}`;
    const candidate = `${result}\n${line}`;
    if (candidate.length <= maxChars) {
      result = candidate;
    } else {
      if (i === 0) {
        return candidate.slice(0, maxChars);
      }
      break;
    }
  }

  return result;
}
