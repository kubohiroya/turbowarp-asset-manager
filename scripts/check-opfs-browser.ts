import {spawn, type ChildProcess} from 'node:child_process';
import {createReadStream, existsSync} from 'node:fs';
import {mkdtemp, rm, stat} from 'node:fs/promises';
import {createServer, type Server} from 'node:http';
import {tmpdir} from 'node:os';
import {extname, join, normalize, resolve} from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const HOST = '127.0.0.1';
const TIMEOUT_MS = 30_000;

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

function chromeExecutable(): string | null {
  const configured = process.env.CHROME_BIN;
  const candidates = [
    configured,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? null;
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, () => resolvePromise());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Browser test server did not bind.');
  return address.port;
}

async function devtoolsPort(browser: ChildProcess): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Chrome did not publish its DevTools endpoint.')),
      TIMEOUT_MS
    );
    const finish = (error: Error | null, port?: number) => {
      clearTimeout(timeout);
      browser.stderr?.removeListener('data', onData);
      browser.removeListener('exit', onExit);
      if (error) reject(error);
      else resolvePromise(port!);
    };
    const onData = (chunk: Buffer) => {
      const match = String(chunk).match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//u);
      if (match?.[1]) finish(null, Number(match[1]));
    };
    const onExit = (code: number | null) => {
      finish(new Error(`Chrome exited before DevTools was ready (${String(code)}).`));
    };
    browser.stderr?.on('data', onData);
    browser.once('exit', onExit);
  });
}

async function devtoolsTarget(devtoolsPort: number): Promise<{webSocketDebuggerUrl: string}> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${HOST}:${devtoolsPort}/json/list`);
      const targets = await response.json() as Array<{
        type?: string;
        url?: string;
        webSocketDebuggerUrl?: string;
      }>;
      const target = targets.find(({type, url, webSocketDebuggerUrl}) =>
        type === 'page' && url?.includes('/tests/browser/opfs-smoke.html') && webSocketDebuggerUrl
      );
      if (target?.webSocketDebuggerUrl) return {webSocketDebuggerUrl: target.webSocketDebuggerUrl};
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error('Chrome DevTools target did not become available.');
}

async function browserResultOnce(webSocketDebuggerUrl: string): Promise<string> {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise<void>((resolvePromise, reject) => {
    socket.addEventListener('open', () => resolvePromise(), {once: true});
    socket.addEventListener('error', () => reject(new Error('DevTools WebSocket failed.')), {once: true});
  });
  try {
    const id = 1;
    socket.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: {
        expression: `new Promise((resolve) => {
          const deadline = Date.now() + ${TIMEOUT_MS};
          const poll = () => {
            const result = document.body?.dataset.result;
            if (result === 'passed' || result === 'failed') {
              resolve(result + ':' + document.body.textContent);
            } else if (Date.now() >= deadline) {
              resolve('timeout:' + result);
            } else {
              setTimeout(poll, 50);
            }
          };
          poll();
        })`,
        awaitPromise: true,
        returnByValue: true
      }
    }));
    return await new Promise<string>((resolvePromise, reject) => {
      const timeout = setTimeout(() => reject(new Error('OPFS browser test timed out.')), TIMEOUT_MS + 2_000);
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as {
          id?: number;
          result?: {result?: {value?: unknown}};
          error?: {message?: string};
        };
        if (message.id !== id) return;
        clearTimeout(timeout);
        if (message.error) reject(new Error(message.error.message ?? 'DevTools evaluation failed.'));
        else resolvePromise(String(message.result?.result?.value));
      });
    });
  } finally {
    socket.close();
  }
}

async function browserResult(webSocketDebuggerUrl: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await browserResultOnce(webSocketDebuggerUrl);
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('Execution context was destroyed')) ||
          attempt === 9) {
        throw error;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  }
  throw new Error('OPFS browser result was unavailable.');
}

async function stopBrowser(browser: ChildProcess): Promise<void> {
  if (browser.exitCode !== null) return;
  const exited = new Promise<void>((resolvePromise) => {
    browser.once('exit', () => resolvePromise());
  });
  browser.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise<false>((resolvePromise) => setTimeout(() => resolvePromise(false), 2_000))
  ]);
  if (stopped || browser.exitCode !== null) return;
  browser.kill('SIGKILL');
  await exited;
}

const chrome = chromeExecutable();
if (!chrome) throw new Error('Chrome/Chromium was not found. Set CHROME_BIN to run the OPFS test.');

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${HOST}`).pathname);
    const relative = normalize(pathname).replace(/^[/\\]+/u, '');
    const file = resolve(ROOT, relative || 'tests/browser/opfs-smoke.html');
    if (file !== ROOT && !file.startsWith(`${ROOT}/`)) throw new Error('Path escaped test root.');
    if (!(await stat(file)).isFile()) throw new Error('Not a file.');
    response.writeHead(200, {'content-type': contentTypes.get(extname(file)) ?? 'application/octet-stream'});
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

let browser: ChildProcess | null = null;
const profile = await mkdtemp(join(tmpdir(), 'twam-opfs-browser-'));
try {
  const port = await listen(server);
  browser = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--disable-popup-blocking',
    '--disable-background-networking',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    `http://${HOST}:${port}/tests/browser/opfs-smoke.html`
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  const target = await devtoolsTarget(await devtoolsPort(browser));
  const result = await browserResult(target.webSocketDebuggerUrl);
  if (!result.startsWith('passed:')) throw new Error(`OPFS browser smoke test failed: ${result}`);
  console.log(result.slice('passed:'.length));
} finally {
  if (browser) await stopBrowser(browser);
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
}
