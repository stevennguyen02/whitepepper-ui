import React, { useState } from 'react';
import { Renderer } from '@openuidev/react-lang';
import { agentLibrary, agentSystemPrompt, exampleAgentOutput } from './agent-library.jsx';

// Accept an agent's complete or streaming OpenUI Lang response from the host app.
export function AgentScreen({ response, isStreaming = false, onAction, onError }) {
  return <Renderer library={agentLibrary} response={response} isStreaming={isStreaming} onAction={onAction} onError={onError} />;
}

export function AgentPreview() {
  const [response, setResponse] = useState(exampleAgentOutput);
  const [errors, setErrors] = useState([]);
  return (
    <section className="agent-demo" aria-labelledby="agent-demo-title">
      <div className="section-heading"><div><h2 id="agent-demo-title">Agent rendering</h2><p>Preview an agent response using White Pepper components.</p></div></div>
      <p className="agent-note">This is a local example, not a live AI connection. Edit the OpenUI response to place components in either region.</p>
      <label className="agent-label" htmlFor="agent-response">OpenUI response</label>
      <textarea id="agent-response" spellCheck="false" value={response} onChange={(event) => setResponse(event.target.value)} />
      {errors.length > 0 && <p className="agent-error" role="status">Some output could not be rendered. Check the component names, IDs, and syntax.</p>}
      <AgentScreen response={response} onError={setErrors} />
      <details className="agent-prompt"><summary>View generated agent instructions</summary><pre>{agentSystemPrompt}</pre></details>
    </section>
  );
}
