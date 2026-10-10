import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../references.mjs';

async function run(args) {
  let out = '', err = '';
  const code = await main(args, { stdout: (s) => (out += s), stderr: (s) => (err += s) });
  return { code, out, err };
}

test('finds empty-state guidance with a next step for the agent', async () => {
  const { code, out } = await run(['empty state']);
  assert.equal(code, 0);
  assert.match(out, /https:\/\//);
  assert.match(out, /Open the page/);
});

test('bad platform is a usage error', async () => {
  const { code } = await run(['tabs', '--platform', 'watch']);
  assert.equal(code, 1);
});

test('no match is explicit', async () => {
  const { code, out } = await run(['qqqqzzzz']);
  assert.equal(code, 0);
  assert.match(out, /No match/);
});
