/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node regression tests */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const exportsObject = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/presentation-transcription.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(exportsObject);
const { handlePresentationTranscription } = exportsObject;

function request(file = new File(['audio'], 'pergunta.webm', { type: 'audio/webm' }), headers = {}) {
  const form = new FormData();
  form.set('file', file);
  return new Request('https://example.com/api/presentation-assistant/transcribe', {
    method: 'POST', headers: { origin: 'https://example.com', ...headers }, body: form,
  });
}

function setup(override = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      apiKey: 'key-never-returned', model: 'configured-transcribe-model',
      async consumeQuota() { calls.push('quota'); return { allowed: true, retryAfter: 0 }; },
      async fetcher(url, options) {
        calls.push({ url, options });
        return Response.json({ text: 'Como funciona a segurança dos dados?' });
      },
      ...override,
    },
  };
}

test('voice transcription rejects cross-origin, invalid media and oversized requests before the provider', async () => {
  for (const req of [
    request(undefined, { origin: 'https://attacker.example' }),
    new Request('https://example.com/api/presentation-assistant/transcribe', { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: '{}' }),
    request(new File(['text'], 'note.txt', { type: 'text/plain' })),
    request(undefined, { 'content-length': String(4 * 1024 * 1024) }),
  ]) {
    const { deps, calls } = setup();
    const response = await handlePresentationTranscription(req, deps);
    assert.ok([400, 403, 413, 415].includes(response.status));
    assert.equal(calls.length, 0);
  }
});

test('voice transcription shares the public quota and fails closed before a billable request', async () => {
  for (const consumeQuota of [async () => ({ allowed: false, retryAfter: 14 }), async () => { throw Error('private'); }]) {
    const { deps, calls } = setup({ consumeQuota });
    const response = await handlePresentationTranscription(request(), deps);
    assert.ok([429, 503].includes(response.status));
    assert.equal(calls.length, 0);
    assert.ok(!(await response.text()).includes('private'));
  }
});

test('valid voice uses Portuguese transcription and returns only bounded text', async () => {
  const { deps, calls } = setup();
  const response = await handlePresentationTranscription(request(), deps);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { text: 'Como funciona a segurança dos dados?' });
  const provider = calls.find(call => typeof call === 'object');
  assert.equal(provider.url, 'https://api.openai.com/v1/audio/transcriptions');
  assert.equal(provider.options.headers.Authorization, 'Bearer key-never-returned');
  assert.equal(provider.options.body.get('model'), 'configured-transcribe-model');
  assert.equal(provider.options.body.get('language'), 'pt');
  assert.match(provider.options.body.get('prompt'), /LGPD/);
  assert.ok(provider.options.body.get('file') instanceof File);
});

test('provider errors and empty transcriptions are explained without exposing provider data', async () => {
  for (const fetcher of [
    async () => Response.json({ error: { message: 'provider-secret' } }, { status: 500 }),
    async () => Response.json({ text: '   ' }),
  ]) {
    const { deps } = setup({ fetcher });
    const response = await handlePresentationTranscription(request(), deps);
    assert.ok([422, 502].includes(response.status));
    assert.ok(!(await response.text()).includes('provider-secret'));
  }
});

test('assistant prompt asks for direct answers while keeping precise site navigation', () => {
  const prompt = fs.readFileSync('src/lib/presentation-assistant.ts', 'utf8');
  assert.match(prompt, /Comece pela resposta direta/);
  assert.match(prompt, /recurso mais específico para explorar/);
  assert.match(prompt, /até 3 linkIds/);
});
