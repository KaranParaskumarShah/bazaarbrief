import { spawnSync } from 'node:child_process';
import process from 'node:process';

const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
const npx = isWin ? 'npx.cmd' : 'npx';
function run(bin, args) {
  console.log(`\n> ${bin} ${args.join(' ')}`);
  const result = spawnSync(bin, args, { stdio: 'inherit', shell: isWin, env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${bin} ${args.join(' ')} failed with exit code ${result.status}`);
}
function succeeds(bin, args) {
  const result = spawnSync(bin, args, { encoding: 'utf8', shell: isWin, env: process.env });
  return result.status === 0;
}
async function main() {
  console.log('\nBAZAARBRIEF — single Worker + static assets deployment');
  console.log('This deploys the React site and API from the root wrangler.jsonc. No KV namespace is required for first launch.');
  run(npm, ['install', '--no-audit', '--no-fund']);
  if (!succeeds(npx, ['wrangler', 'whoami'])) run(npx, ['wrangler', 'login']);
  run(npm, ['run', 'build']);
  run(npx, ['wrangler', 'deploy']);
  console.log('\nDeployment command completed. Verify https://bazaarbrief.in/health and /api/indices.');
  console.log('If the custom domain is not attached to this Worker, configure it under Cloudflare → Workers & Pages → bazaarbrief → Settings → Domains & Routes.');
}
main().catch(error => { console.error('\nDEPLOYMENT STOPPED:', error?.message || error); process.exit(1); });
