import http from 'node:http';
import { pathToFileURL } from 'node:url';

const MAX_BODY_BYTES = 100_000;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function allowedOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && Number(url.port) >= 5173 && Number(url.port) <= 5183 && url.origin === origin;
  } catch { return false; }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createAgentServer({ apiKey = process.env.OPENROUTER_API_KEY, model = process.env.OPENROUTER_MODEL || 'openrouter/auto', ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434', fetchImpl = fetch } = {}) {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!allowedOrigin(origin)) return json(res, 403, { error: 'Only the local White Pepper development app can use this endpoint.' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS' && req.url === '/chat') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      return res.end();
    }
    if (req.method !== 'POST' || req.url !== '/chat') return json(res, 404, { error: 'Not found.' });
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid or oversized JSON request.' }); }
    if (!body || typeof body.systemPrompt !== 'string' || body.systemPrompt.length > 50_000 || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 50 || body.messages.some((m) => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 10_000) || (body.currentOutput != null && (typeof body.currentOutput !== 'string' || body.currentOutput.length > 20_000))) {
      return json(res, 400, { error: 'Invalid message or UI context.' });
    }
    const provider = body.provider ?? 'openrouter';
    if (!['openrouter', 'ollama'].includes(provider) || (body.model != null && (typeof body.model !== 'string' || body.model.length > 200)) || (body.apiKey != null && (typeof body.apiKey !== 'string' || body.apiKey.length > 512))) return json(res, 400, { error: 'Invalid provider configuration.' });
    const requestKey = body.apiKey || apiKey;
    if (provider === 'openrouter' && !requestKey) return json(res, 503, { error: 'Enter an OpenRouter API key or set OPENROUTER_API_KEY before starting the agent server.' });
    const selectedModel = body.model?.trim() || (provider === 'ollama' ? (process.env.OLLAMA_MODEL || 'gemma4:e2b') : model);
    const instructions = `${body.systemPrompt}\n\nReturn exactly one JSON object with two string fields: "message" (a short conversational response) and "output" (a complete valid OpenUI Lang program). Do not use Markdown fences. Always use WhitePepperScreen as the root and only the registered components and IDs. Respond to the user by updating the existing UI when appropriate; preserve existing components unless the request asks to change or remove them.\nCurrent OpenUI program:\n${body.currentOutput || '(none)'}`;
    try {
      const isOllama = provider === 'ollama';
      const endpoint = isOllama ? new URL('/api/chat', ollamaHost).href : OPENROUTER_URL;
      const messages = [{ role: 'system', content: instructions }, ...body.messages];
      const upstream = await fetchImpl(endpoint, {
        method: 'POST',
        headers: isOllama ? { 'Content-Type': 'application/json' } : { Authorization: `Bearer ${requestKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(isOllama ? {
          model: selectedModel, messages, stream: false,
          format: { type: 'object', properties: { message: { type: 'string' }, output: { type: 'string' } }, required: ['message', 'output'] },
        } : { model: selectedModel, messages, response_format: { type: 'json_object' } }),
        signal: AbortSignal.timeout(isOllama ? 180_000 : 60_000),
      });
      if (!upstream.ok) return json(res, 502, { error: isOllama ? `Ollama request failed (${upstream.status}). Check that the selected model is installed.` : `OpenRouter request failed (${upstream.status}). Check your key, credits, and model access.` });
      const payload = await upstream.json();
      const content = isOllama ? payload.message?.content : payload.choices?.[0]?.message?.content;
      let result;
      try { result = JSON.parse(content); } catch { return json(res, 502, { error: 'The model did not return valid JSON. Try again or choose another model.' }); }
      if (typeof result?.message !== 'string' || typeof result?.output !== 'string') return json(res, 502, { error: 'The model response is missing its message or UI output.' });
      return json(res, 200, { message: result.message, output: result.output });
    } catch (error) {
      return json(res, 502, { error: error?.name === 'TimeoutError' ? `${provider === 'ollama' ? 'Ollama' : 'OpenRouter'} timed out. Try again.` : `Could not reach ${provider === 'ollama' ? 'Ollama' : 'OpenRouter'}. Check your connection and try again.` });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createAgentServer().listen(3001, '127.0.0.1', () => console.log('White Pepper agent listening at http://127.0.0.1:3001/chat'));
}
