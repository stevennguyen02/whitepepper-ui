import React, { useRef, useState } from 'react';
import { AgentScreen } from './AgentPreview.jsx';
import { agentSystemPrompt } from './agent-library.jsx';

const suggestions = ['Spawn a button in the main region', 'Place a dark dialog in the side region', 'Try a dialog that opens at 3 o’clock'];

export function Play() {
  const [endpoint, setEndpoint] = useState('http://127.0.0.1:3001/chat');
  const [connected, setConnected] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [output, setOutput] = useState(null);
  const [renderErrors, setRenderErrors] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  function saveEndpoint(event) {
    event.preventDefault();
    try {
      const url = new URL(endpoint.trim());
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error();
      setEndpoint(url.href);
      setConnected(true);
      setConfigOpen(false);
      setError('');
    } catch { setError('Use an HTTPS endpoint or a local HTTP endpoint.'); }
  }

  async function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    if (!connected) { setError('Add an agent endpoint to send a prompt.'); setConfigOpen(true); return; }
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next); setDraft(''); setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, systemPrompt: agentSystemPrompt, currentOutput: output }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Endpoint returned ${response.status}.`);
      if (typeof data.message !== 'string' || typeof data.output !== 'string') throw new Error('The endpoint must return JSON with message and output strings.');
      setMessages([...next, { role: 'assistant', content: data.message }]);
      setOutput(data.output); setRenderErrors([]);
    } catch (err) { setError(err.message || 'Could not reach the agent endpoint.'); }
    finally { setBusy(false); }
  }

  return <div className="play-page">
    <div className="play-heading"><div><p className="overline">The playground</p><h1>Make room for<br /><span>what’s next.</span></h1><p>Give the agent a prompt. Watch the interface take shape.</p></div><button className="connection" onClick={() => { setConfigOpen(!configOpen); setError(''); }} aria-expanded={configOpen}><span className={`status-dot ${connected ? 'is-set' : ''}`} />{connected ? 'Endpoint set' : 'Connect agent'}</button></div>
    {configOpen && <form className="connection-panel" onSubmit={saveEndpoint}>
      <label htmlFor="endpoint">Agent endpoint</label><p>Use the local OpenRouter endpoint below, or enter another compatible agent endpoint. API keys stay on the server.</p>
      <div className="connection-row"><input id="endpoint" type="url" placeholder="http://localhost:3001/chat" value={endpoint} onChange={(e) => { setEndpoint(e.target.value); setConnected(false); }} required /><button type="submit">Save endpoint</button></div>
    </form>}
    <div className="play-canvas" aria-label="Agent workspace">
      {!output ? <div className="canvas-empty"><span className="canvas-mark">✳</span><p>Your canvas is ready.</p><span>Components will appear here when your agent responds.</span></div> : <AgentScreen response={output} onError={setRenderErrors} />}
      {renderErrors.length > 0 && <p role="status" className="play-error">The agent returned UI that could not be rendered. Check the component names, IDs, and syntax.</p>}
    </div>
    <div className="play-bottom">
      <div className="chat-messages" aria-live="polite">{messages.map((m, i) => <div className={`chat-message chat-${m.role}`} key={i}><span>{m.role === 'user' ? 'You' : 'Agent'}</span><p>{m.content}</p></div>)}{busy && <p className="thinking">Waiting for agent…</p>}</div>
      {messages.length === 0 && <div className="suggestions" aria-label="Example prompts">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { setDraft(suggestion); inputRef.current?.focus(); }}>{suggestion} <span aria-hidden="true">↗</span></button>)}</div>}
      {error && <p className="play-error" role="alert">{error}</p>}
      <form className="composer" onSubmit={send}><label className="sr-only" htmlFor="play-message">Ask the agent</label><input ref={inputRef} id="play-message" placeholder="Ask the agent to create something..." value={draft} onChange={(e) => setDraft(e.target.value)} /><button type="submit" disabled={busy || !draft.trim()} aria-label="Send prompt">↑</button></form>
      <p className="composer-hint">{connected ? 'Your prompt will be sent to the configured endpoint.' : 'Connect an agent to start prompting.'}</p>
    </div>
  </div>;
}
