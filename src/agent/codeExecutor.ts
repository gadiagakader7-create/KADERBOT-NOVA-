export interface ExecuteCodeParams {
  language: 'python' | 'javascript';
  code: string;
  timeoutMs?: number;
  isTest?: boolean;
}

export interface ExecuteCodeResult {
  stdout: string;
  stderr: string;
  success: boolean;
  durationMs: number;
  filesCreated: Array<{ path: string; content: string }>;
}

const DEFAULT_EXEC_TIMEOUT_MS = 30_000;
const TEST_EXEC_TIMEOUT_MS = 120_000;

function resolveTimeoutMs(timeoutMs?: number, isTest?: boolean): number {
  const fallback = isTest ? TEST_EXEC_TIMEOUT_MS : DEFAULT_EXEC_TIMEOUT_MS;
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fallback;
  }
  return Math.min(Math.max(timeoutMs, 1000), TEST_EXEC_TIMEOUT_MS);
}

/**
 * Exécution isolée en navigateur via Web Worker (JavaScript) ou Pyodide en Web Worker (Python).
 * Aucun accès réseau (fetch/XHR/WebSocket bloqués), aucun accès au système de fichiers réel.
 */
async function executeInBrowserWorker(
  language: 'python' | 'javascript',
  code: string,
  timeoutMs: number
): Promise<ExecuteCodeResult> {
  const startTime = Date.now();

  if (typeof Worker === 'undefined') {
    return {
      stdout: '',
      stderr: 'Web Worker indisponible dans cet environnement.',
      success: false,
      durationMs: Date.now() - startTime,
      filesCreated: [],
    };
  }

  const workerSource =
    language === 'javascript'
      ? `
self.onmessage = async (event) => {
  const { code } = event.data || {};
  const stdoutLines = [];
  const stderrLines = [];
  const filesCreated = {};

  const formatArg = (val) => {
    if (typeof val === 'string') return val;
    try { return JSON.stringify(val); } catch { return String(val); }
  };

  const sandboxConsole = {
    log: (...args) => stdoutLines.push(args.map(formatArg).join(' ')),
    info: (...args) => stdoutLines.push(args.map(formatArg).join(' ')),
    warn: (...args) => stderrLines.push(args.map(formatArg).join(' ')),
    error: (...args) => stderrLines.push(args.map(formatArg).join(' ')),
  };

  const virtualFs = {
    writeFile: (path, content) => {
      const clean = String(path || '').trim();
      const target = clean.startsWith('/workspace/') ? clean : '/workspace/generated/' + clean.replace(/^\\/+/, '');
      filesCreated[target] = String(content ?? '');
      return target;
    },
    readFile: (path) => filesCreated[String(path || '').trim()] ?? null,
    listFiles: () => Object.keys(filesCreated),
  };

  // Blocage réseau strict dans le Worker
  const blockedNetwork = () => {
    throw new Error('Accès réseau interdit dans le sandbox.');
  };
  try {
    self.fetch = blockedNetwork;
    self.XMLHttpRequest = blockedNetwork;
    self.WebSocket = blockedNetwork;
    self.EventSource = blockedNetwork;
    self.importScripts = blockedNetwork;
  } catch {}

  try {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction(
      'console', 'workspace', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'localStorage', 'indexedDB',
      code
    );
    const result = await fn(
      sandboxConsole, virtualFs, blockedNetwork, blockedNetwork, blockedNetwork, blockedNetwork, blockedNetwork, undefined, undefined
    );
    if (result !== undefined) {
      stdoutLines.push(formatArg(result));
    }
    self.postMessage({
      success: true,
      stdout: stdoutLines.join('\\n'),
      stderr: stderrLines.join('\\n'),
      filesCreated: Object.entries(filesCreated).map(([path, content]) => ({ path, content })),
    });
  } catch (err) {
    stderrLines.push(err && err.stack ? String(err.stack) : String(err));
    self.postMessage({
      success: false,
      stdout: stdoutLines.join('\\n'),
      stderr: stderrLines.join('\\n'),
      filesCreated: Object.entries(filesCreated).map(([path, content]) => ({ path, content })),
    });
  }
};
`
      : `
let pyodideInstance = null;

async function ensurePyodide() {
  if (pyodideInstance) return pyodideInstance;
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
  pyodideInstance = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
  });
  try {
    pyodideInstance.FS.mkdirTree('/workspace/generated');
    pyodideInstance.FS.mkdirTree('/workspace/tests');
  } catch {}
  return pyodideInstance;
}

self.onmessage = async (event) => {
  const { code } = event.data || {};
  try {
    const py = await ensurePyodide();

    // Bloquer les requêtes réseau JS après le chargement de Pyodide
    const blockedNetwork = () => {
      throw new Error('Accès réseau interdit dans le sandbox.');
    };
    try {
      self.fetch = blockedNetwork;
      self.XMLHttpRequest = blockedNetwork;
      self.WebSocket = blockedNetwork;
      self.EventSource = blockedNetwork;
    } catch {}

    await py.runPythonAsync(\`
import sys, io, os
__kb_stdout = io.StringIO()
__kb_stderr = io.StringIO()
sys.stdout = __kb_stdout
sys.stderr = __kb_stderr
for __mod in ['socket', 'urllib', 'urllib.request', 'http', 'http.client', 'ftplib', 'smtplib']:
    sys.modules[__mod] = None
\`);

    let pySuccess = true;
    try {
      await py.runPythonAsync(code);
    } catch (pyErr) {
      pySuccess = false;
      py.globals.set('__kb_err_msg', String(pyErr));
      await py.runPythonAsync('print(__kb_err_msg, file=sys.stderr)');
    }

    const out = await py.runPythonAsync('__kb_stdout.getvalue()');
    const errOut = await py.runPythonAsync('__kb_stderr.getvalue()');

    const filesCreated = [];
    const scanDir = (dir) => {
      try {
        const items = py.FS.readdir(dir);
        for (const name of items) {
          if (name === '.' || name === '..') continue;
          const full = dir + '/' + name;
          const stat = py.FS.stat(full);
          if (py.FS.isDir(stat.mode)) {
            scanDir(full);
          } else {
            filesCreated.push({ path: full, content: py.FS.readFile(full, { encoding: 'utf8' }) });
          }
        }
      } catch {}
    };
    scanDir('/workspace');

    self.postMessage({
      success: pySuccess,
      stdout: String(out || ''),
      stderr: String(errOut || ''),
      filesCreated,
    });
  } catch (err) {
    self.postMessage({
      success: false,
      stdout: '',
      stderr: err && err.message ? err.message : String(err),
      filesCreated: [],
    });
  }
};
`;

  return await new Promise<ExecuteCodeResult>((resolve) => {
    const blob = new Blob([workerSource], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(workerUrl);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      cleanup();
      resolve({
        stdout: '',
        stderr: 'Timeout - exécution arrêtée',
        success: false,
        durationMs: Date.now() - startTime,
        filesCreated: [],
      });
    }, timeoutMs);

    worker.onmessage = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      cleanup();
      const payload = msg.data || {};
      resolve({
        stdout: String(payload.stdout ?? ''),
        stderr: String(payload.stderr ?? ''),
        success: Boolean(payload.success),
        durationMs: Date.now() - startTime,
        filesCreated: Array.isArray(payload.filesCreated) ? payload.filesCreated : [],
      });
    };

    worker.onerror = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      cleanup();
      resolve({
        stdout: '',
        stderr: err.message || 'Erreur dans le Web Worker.',
        success: false,
        durationMs: Date.now() - startTime,
        filesCreated: [],
      });
    };

    worker.postMessage({ code });
  });
}

/**
 * Exécution isolée côté serveur Node.js (Worker thread + vm sans réseau ni fs pour JS,
 * processus Python isolé -I sans env ni réseau ni écriture hors sandbox pour Python).
 */
async function executeInNodeSandbox(
  language: 'python' | 'javascript',
  code: string,
  timeoutMs: number
): Promise<ExecuteCodeResult> {
  const startTime = Date.now();

  if (language === 'javascript') {
    const workerThreadsMod = 'node:worker_threads';
    const { Worker } = await import(/* @vite-ignore */ workerThreadsMod);

    const workerCode = `
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');

const stdoutLines = [];
const stderrLines = [];
const filesCreated = {};

const formatArg = (val) => {
  if (typeof val === 'string') return val;
  try { return JSON.stringify(val); } catch { return String(val); }
};

const blocked = () => {
  throw new Error('Accès réseau ou système interdit dans le sandbox.');
};

const sandbox = {
  console: {
    log: (...args) => stdoutLines.push(args.map(formatArg).join(' ')),
    info: (...args) => stdoutLines.push(args.map(formatArg).join(' ')),
    warn: (...args) => stderrLines.push(args.map(formatArg).join(' ')),
    error: (...args) => stderrLines.push(args.map(formatArg).join(' ')),
  },
  workspace: {
    writeFile: (filePath, content) => {
      const clean = String(filePath || '').trim();
      const target = clean.startsWith('/workspace/') ? clean : '/workspace/generated/' + clean.replace(/^\\/+/, '');
      filesCreated[target] = String(content ?? '');
      return target;
    },
    readFile: (filePath) => filesCreated[String(filePath || '').trim()] ?? null,
    listFiles: () => Object.keys(filesCreated),
  },
  fetch: blocked,
  XMLHttpRequest: blocked,
  WebSocket: blocked,
  require: blocked,
  process: undefined,
  global: undefined,
  globalThis: undefined,
};

(async () => {
  try {
    const ctx = vm.createContext(sandbox, { codeGeneration: { strings: true, wasm: false } });
    const wrapped = '(async () => {\\n' + workerData.code + '\\n})()';
    const script = new vm.Script(wrapped, { filename: 'sandbox.js' });
    const result = await script.runInContext(ctx, { timeout: workerData.timeoutMs });
    if (result !== undefined) {
      stdoutLines.push(formatArg(result));
    }
    parentPort.postMessage({
      success: true,
      stdout: stdoutLines.join('\\n'),
      stderr: stderrLines.join('\\n'),
      filesCreated: Object.entries(filesCreated).map(([path, content]) => ({ path, content })),
    });
  } catch (err) {
    stderrLines.push(err && err.stack ? String(err.stack) : String(err));
    parentPort.postMessage({
      success: false,
      stdout: stdoutLines.join('\\n'),
      stderr: stderrLines.join('\\n'),
      filesCreated: Object.entries(filesCreated).map(([path, content]) => ({ path, content })),
    });
  }
})();
`;

    return await new Promise<ExecuteCodeResult>((resolve) => {
      const worker = new Worker(workerCode, {
        eval: true,
        workerData: { code, timeoutMs },
        resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 },
      });

      let settled = false;
      const timer = setTimeout(async () => {
        if (settled) return;
        settled = true;
        try {
          await worker.terminate();
        } catch {}
        resolve({
          stdout: '',
          stderr: 'Timeout - exécution arrêtée',
          success: false,
          durationMs: Date.now() - startTime,
          filesCreated: [],
        });
      }, timeoutMs);

      worker.on('message', (payload: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate().catch(() => {});
        resolve({
          stdout: String(payload?.stdout ?? ''),
          stderr: String(payload?.stderr ?? ''),
          success: Boolean(payload?.success),
          durationMs: Date.now() - startTime,
          filesCreated: Array.isArray(payload?.filesCreated) ? payload.filesCreated : [],
        });
      });

      worker.on('error', (err: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate().catch(() => {});
        resolve({
          stdout: '',
          stderr: err?.message || 'Erreur dans le worker JavaScript.',
          success: false,
          durationMs: Date.now() - startTime,
          filesCreated: [],
        });
      });
    });
  }

  // Python isolé côté serveur (aucune variable d'environnement, aucun réseau, aucun accès disque réel)
  const childProcessMod = 'node:child_process';
  const { spawn } = await import(/* @vite-ignore */ childProcessMod);

  const pythonSandboxHarness = `
import sys, json, builtins

_kb_files = {}
_kb_orig_open = builtins.open

def _kb_safe_open(file, mode='r', *args, **kwargs):
    path_str = str(file)
    if not path_str.startswith('/workspace/'):
        raise PermissionError(f"Accès fichier refusé hors /workspace/ : {path_str}")
    if any(m in mode for m in ('w', 'a', '+')):
        class _VirtWriter:
            def __init__(self, target):
                self.target = target
                self.chunks = []
            def write(self, data):
                self.chunks.append(data)
                return len(data)
            def writelines(self, lines):
                self.chunks.extend(lines)
            def close(self):
                _kb_files[self.target] = ''.join(self.chunks)
            def __enter__(self):
                return self
            def __exit__(self, exc_type, exc, tb):
                self.close()
        return _VirtWriter(path_str)
    if path_str in _kb_files:
        import io
        return io.StringIO(_kb_files[path_str])
    raise FileNotFoundError(f"Fichier virtuel introuvable : {path_str}")

builtins.open = _kb_safe_open

# Désactivation des modules réseau et subprocess
for _blocked in ('socket', 'urllib', 'urllib.request', 'http', 'http.client', 'ftplib', 'smtplib', 'subprocess', 'multiprocessing', 'shutil'):
    sys.modules[_blocked] = None

_kb_code = sys.stdin.read()
try:
    exec(compile(_kb_code, '<sandbox.py>', 'exec'), {'__name__': '__main__'})
finally:
    if _kb_files:
        sys.stdout.write('\\n__KB_FILES__:' + json.dumps(_kb_files))
`;

  return await new Promise<ExecuteCodeResult>((resolve) => {
    const proc = spawn('python3', ['-I', '-c', pythonSandboxHarness], {
      env: {
        PATH: '/usr/bin:/bin',
        PYTHONIOENCODING: 'utf-8',
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONNOUSERSITE: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        proc.kill('SIGKILL');
      } catch {}
      resolve({
        stdout: stdout.trim(),
        stderr: 'Timeout - exécution arrêtée',
        success: false,
        durationMs: Date.now() - startTime,
        filesCreated: [],
      });
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    proc.on('error', (err: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: err?.message || 'Erreur lors du lancement de Python.',
        success: false,
        durationMs: Date.now() - startTime,
        filesCreated: [],
      });
    });

    proc.on('close', (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      let filesCreated: Array<{ path: string; content: string }> = [];
      let cleanStdout = stdout;
      const markerIdx = stdout.lastIndexOf('\n__KB_FILES__:');
      if (markerIdx !== -1) {
        cleanStdout = stdout.slice(0, markerIdx);
        const jsonPart = stdout.slice(markerIdx + '\n__KB_FILES__:'.length);
        try {
          const parsed = JSON.parse(jsonPart) as Record<string, string>;
          filesCreated = Object.entries(parsed).map(([p, c]) => ({ path: p, content: c }));
        } catch {}
      }

      resolve({
        stdout: cleanStdout.replace(/\n$/, ''),
        stderr: stderr.replace(/\n$/, ''),
        success: exitCode === 0,
        durationMs: Date.now() - startTime,
        filesCreated,
      });
    });

    proc.stdin.write(code);
    proc.stdin.end();
  });
}

export async function executeCode(params: ExecuteCodeParams): Promise<ExecuteCodeResult> {
  const { language, code, timeoutMs, isTest = false } = params;
  const effectiveTimeout = resolveTimeoutMs(timeoutMs, isTest);

  if (!code || typeof code !== 'string') {
    return {
      stdout: '',
      stderr: 'Aucun code à exécuter.',
      success: false,
      durationMs: 0,
      filesCreated: [],
    };
  }

  if (language !== 'python' && language !== 'javascript') {
    return {
      stdout: '',
      stderr: `Langage non supporté : ${String(language)}`,
      success: false,
      durationMs: 0,
      filesCreated: [],
    };
  }

  if (typeof window !== 'undefined') {
    return await executeInBrowserWorker(language, code, effectiveTimeout);
  }

  return await executeInNodeSandbox(language, code, effectiveTimeout);
}
