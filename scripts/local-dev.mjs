import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const workerDir = path.join(root, 'worker');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
const npx = isWin ? 'npx.cmd' : 'npx';
let worker;
let frontend;

function run(bin, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: 'inherit', shell: isWin, env: process.env });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${bin} ${args.join(' ')} exited with code ${code}`)));
  });
}
function start(bin, args, cwd) {
  const child = spawn(bin, args, { cwd, stdio: 'inherit', shell: isWin, env: process.env });
  child.on('error', error => console.error(error));
  return child;
}
async function waitForApi(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (r.ok) return true; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}
function stop() {
  for (const child of [frontend, worker]) if (child && !child.killed) child.kill('SIGTERM');
}
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });

async function main() {
  if (!existsSync(path.join(root, 'package.json')) || !existsSync(path.join(workerDir, 'wrangler.toml'))) {
    throw new Error('Run this script from the extracted BazaarBrief project folder.');
  }
  console.log('\nBazaarBrief local live-data startup');
  console.log('1/4 Installing project dependencies…');
  await run(npm, ['install', '--no-audit', '--no-fund']);

  console.log('\n2/4 Preparing isolated local Worker + KV storage…');
  let config = await (await import('node:fs/promises')).readFile(path.join(workerDir, 'wrangler.toml'), 'utf8');
  config = config.replace(/id\s*=\s*"[^"]*"/, 'id = "00000000000000000000000000000001"')
    .replace(/preview_id\s*=\s*"[^"]*"/, 'preview_id = "00000000000000000000000000000002"');
  writeFileSync(path.join(workerDir, 'wrangler.local.toml'), config);
  writeFileSync(path.join(workerDir, '.dev.vars'), 'LOCAL_DEV=true\n');
  writeFileSync(path.join(root, '.env.local'), 'VITE_DATA_BASE_URL=http://127.0.0.1:8787\n');

  console.log('\n3/4 Starting local Worker API…');
  worker = start(npx, ['wrangler', 'dev', '--config', 'wrangler.local.toml', '--local', '--port', '8787'], workerDir);
  const ready = await waitForApi('http://127.0.0.1:8787/health');
  if (!ready) throw new Error('Local Worker did not start. Check the Worker terminal output above.');

  console.log('\nFetching initial live data now (quotes, RSS headlines, IPO and FII/DII endpoints)…');
  try {
    const response = await fetch('http://127.0.0.1:8787/admin/refresh', { method: 'POST', signal: AbortSignal.timeout(90000) });
    const body = await response.text();
    console.log(`Initial refresh HTTP ${response.status}:\n${body}`);
    if (!response.ok) console.warn('Initial refresh did not fully succeed. Unavailable datasets will remain blank rather than use fake values.');
  } catch (error) {
    console.warn(`Initial refresh request failed: ${error instanceof Error ? error.message : error}`);
    console.warn('The site will still start, but datasets without live data will show unavailable.');
  }

  console.log('\n4/4 Starting frontend at http://localhost:5173');
  console.log('The Worker runs at http://127.0.0.1:8787. Keep this terminal open.');
  console.log('Press Ctrl+C to stop both services.');
  frontend = start(npm, ['run', 'dev', '--', '--host', '127.0.0.1'], root);
  frontend.on('exit', code => { if (code && code !== 0) console.error(`Frontend exited with code ${code}`); stop(); });
}
main().catch(error => { console.error('\nLOCAL START FAILED:', error?.message || error); stop(); process.exit(1); });
