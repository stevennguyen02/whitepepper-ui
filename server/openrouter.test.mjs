import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentServer } from './openrouter.mjs';

const origin = 'http://localhost:5173';
const request = { systemPrompt: 'White Pepper schema', messages: [{ role: 'user', content: 'Add a button' }], currentOutput: 'root = WhitePepperScreen([], [])' };

test('local endpoint sends OpenUI context to OpenRouter and returns the response', async (t) => {
  let seen;
  const server = createAgentServer({ apiKey: 'test-key', model: 'test/model', fetchImpl: async (url, options) => {
    seen = { url, options, payload: JSON.parse(options.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ message: 'Added.', output: 'root = WhitePepperScreen([], [])' }) } }] }), { status: 200 });
  } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/chat`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: 'Added.', output: 'root = WhitePepperScreen([], [])' });
  assert.equal(seen.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(seen.payload.model, 'test/model');
  assert.match(seen.payload.messages[0].content, /root = WhitePepperScreen/);
  assert.deepEqual(seen.payload.messages[1], request.messages[0]);
  assert.equal((await fetch(`${base}/chat`, { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: JSON.stringify(request) })).status, 403);
  assert.equal((await fetch(`${base}/chat`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
});

test('missing keys and invalid provider responses return helpful errors', async (t) => {
  for (const [apiKey, fetchImpl, expected] of [
    ['', async () => { throw new Error('must not call'); }, 503],
    ['test-key', async () => new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] })), 502],
  ]) {
    const server = createAgentServer({ apiKey, fetchImpl });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const response = await fetch(`http://127.0.0.1:${server.address().port}/chat`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    assert.equal(response.status, expected);
    assert.equal(typeof (await response.json()).error, 'string');
  }
});
