import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const workerDir = path.join(root, 'worker');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
const npx = isWin ? 'npx.cmd' : 'npx';
function run(bin, args, opts = {}) {
  console.log(`\n> ${bin} ${args.join(' ')}`);
  return execFileSync(bin, args, { cwd: opts.cwd || root, encoding: 'utf8', stdio: opts.capture ? ['inherit', 'pipe', 'pipe'] : 'inherit', env: process.env, shell: isWin, ...opts });
}
function capture(bin, args, cwd = root) {
  const res = spawnSync(bin, args, { cwd, encoding: 'utf8', shell: isWin, env: process.env });
  const output = `${res.stdout || ''}\n${res.stderr || ''}`;
  if (res.status !== 0) throw new Error(output || `${bin} failed`);
  return output;
}
function findId(output) {
  const matches = [...output.matchAll(/\b(?:id|namespace_id)\b\s*[:=]\s*["']?([a-f0-9]{16,})/ig)];
  if (matches.length) return matches[matches.length - 1][1];
  try { const json = JSON.parse(output); if (json.id) return json.id; } catch {}
  throw new Error(`Could not find a Cloudflare KV namespace ID in Wrangler output:\n${output}`);
}
async function main() {
  if (!existsSync(path.join(root, 'package.json')) || !existsSync(path.join(workerDir, 'wrangler.toml'))) {
    throw new Error('Run this script from the extracted BazaarBrief project root.');
  }
  console.log('\nBAZAARBRIEF — automated Cloudflare Free deployment');
  console.log('This script creates KV namespaces, deploys the Worker, builds the frontend, deploys Pages, and tries to attach bazaarbrief.in.');
  console.log('You must approve Cloudflare login in the browser; this is required to access your account.\n');
  run(npm, ['install', '--no-audit', '--no-fund']);
  run(npm, ['install', '--no-audit', '--no-fund'], { cwd: workerDir });
  try { capture(npx, ['wrangler', 'whoami']); }
  catch { run(npx, ['wrangler', 'login']); }
  capture(npx, ['wrangler', 'whoami']);

  let config = readFileSync(path.join(workerDir, 'wrangler.toml'), 'utf8');
  let mainId = config.match(/id\s*=\s*"([a-f0-9]{16,})"/)?.[1];
  let previewId = config.match(/preview_id\s*=\s*"([a-f0-9]{16,})"/)?.[1];
  if (!mainId) {
    console.log('\nCreating production KV namespace…');
    const out = capture(npx, ['wrangler', 'kv', 'namespace', 'create', 'MARKET_CACHE'], workerDir);
    console.log(out);
    mainId = findId(out);
  }
  if (!previewId) {
    console.log('\nCreating preview KV namespace…');
    const out = capture(npx, ['wrangler', 'kv', 'namespace', 'create', 'MARKET_CACHE', '--preview'], workerDir);
    console.log(out);
    previewId = findId(out);
  }
  config = config.replace(/id\s*=\s*"[^"]*"/, `id = "${mainId}"`)
    .replace(/preview_id\s*=\s*"[^"]*"/, `preview_id = "${previewId}"`);
  writeFileSync(path.join(workerDir, 'wrangler.toml'), config);

  const deployOutput = capture(npx, ['wrangler', 'deploy'], workerDir);
  console.log(deployOutput);
  const workerUrl = deployOutput.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i)?.[0];
  if (!workerUrl) throw new Error('Worker deployed, but its workers.dev URL could not be detected. Find it in Cloudflare Dashboard → Workers & Pages.');

  // Add a one-time protected refresh so the public site is populated immediately instead of waiting for the next cron tick.
  const refreshSecret = randomBytes(32).toString('hex');
  console.log('\nSetting a random secret for protected first refresh…');
  const secret = spawnSync(npx, ['wrangler', 'secret', 'put', 'REFRESH_SECRET'], { cwd: workerDir, input: `${refreshSecret}\n`, encoding: 'utf8', shell: isWin, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  if (secret.status !== 0) console.warn(`Could not set refresh secret automatically. Scheduled refresh will populate data at the next 15-minute cron.\n${secret.stderr || ''}`);
  else {
    try {
      const r = await fetch(`${workerUrl}/admin/refresh`, { method: 'POST', headers: { authorization: `Bearer ${refreshSecret}` } });
      console.log(`Initial data refresh: HTTP ${r.status}`);
      console.log(await r.text());
    } catch (e) { console.warn(`Initial refresh could not be reached; scheduled cron will retry. ${e}`); }
  }

  process.env.VITE_DATA_BASE_URL = workerUrl;
  writeFileSync(path.join(root, '.env.production.local'), `VITE_DATA_BASE_URL=${workerUrl}\n`);
  run(npm, ['run', 'build']);
  try {
    capture(npx, ['wrangler', 'pages', 'project', 'create', 'bazaarbrief', '--production-branch', 'main']);
  } catch (e) {
    console.log('Pages project may already exist; continuing to deploy to bazaarbrief.');
  }
  const pagesOutput = capture(npx, ['wrangler', 'pages', 'deploy', 'dist', '--project-name', 'bazaarbrief', '--branch', 'main']);
  console.log(pagesOutput);
  const pagesUrl = pagesOutput.match(/https:\/\/[^\s]+\.pages\.dev/i)?.[0] || 'https://bazaarbrief.pages.dev';
  console.log('\nTrying to attach bazaarbrief.in to the Pages project…');
  try { console.log(capture(npx, ['wrangler', 'pages', 'domain', 'add', 'bazaarbrief.in', '--project-name', 'bazaarbrief'])); }
  catch (e) { console.warn('The site is deployed to Pages, but the custom domain could not be attached automatically. This usually means bazaarbrief.in is not yet active in this same Cloudflare account. You can still use the pages.dev URL below.'); }
  console.log('\nDEPLOYMENT FINISHED');
  console.log(`Frontend: ${pagesUrl}`);
  console.log(`Worker:   ${workerUrl}`);
  console.log('Cron:     every 15 minutes (UTC)');
  console.log('Domain:   https://bazaarbrief.in (only if Cloudflare accepted the domain binding)');
  console.log('\nIPO and FII/DII datasets intentionally remain unavailable until a real, permitted feed is configured. No sample financial records are generated.');
}
main().catch(err => { console.error('\nDEPLOYMENT STOPPED:', err?.message || err); process.exit(1); });
