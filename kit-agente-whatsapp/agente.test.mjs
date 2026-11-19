import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
process.env.META_APP_SECRET = 'secreto';
process.env.VERIFY_TOKEN = 'token';
const { app, quickAnswer, systemPrompt } = await import('./server.mjs');

test('preguntas frecuentes sin IA y prompt con los datos', () => {
  assert.match(quickAnswer('¿A qué hora abren?'), /8:00/);
  assert.match(quickAnswer('Donde están ubicados'), /Calle 60/);
  assert.equal(quickAnswer('quiero un pastel'), null);
  assert.match(systemPrompt(), /Café La Esquina/);
  assert.match(systemPrompt(), /Nunca inventes/);
});

test('webhook: verificación y firma', async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=token&hub.challenge=42`);
  assert.equal(await ok.text(), '42');
  assert.equal((await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=mal`)).status, 403);
  const body = JSON.stringify({ entry: [] });
  const bad = await fetch(`${base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=00' }, body });
  assert.equal(bad.status, 401);
  const sig = crypto.createHmac('sha256', 'secreto').update(body).digest('hex');
  const good = await fetch(`${base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${sig}` }, body });
  assert.equal(good.status, 200);
  server.close();
});
