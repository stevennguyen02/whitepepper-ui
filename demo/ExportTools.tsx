import React, { useId, useMemo, useRef, useState } from 'react';
import catalogue, { vendorRuntime } from 'virtual:whitepepper-exports';
import { componentBundle, emptyRegistry, exportPrompt, starterFiles, zipFolder } from './export-kit.mjs';
import { renderTree, validateRegistry } from './portable/registry-tools.mjs';

const templates = import.meta.glob('./portable/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
type Selection = Record<string, string | number | boolean>;
type ComponentManifest = { id: string; name: string; slug: string; featureIds: string[]; requires: string[]; related: string[] };

function download(content: Uint8Array | string, filename: string, type: string) {
  const blob = new Blob([typeof content === 'string' ? content : new Uint8Array(content)], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ComponentExport({ id, selection = {} }: { id: string; selection?: Selection }) {
  const promptId = useId();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const result = useMemo(() => {
    if (!open) return null;
    try {
      const bundle = componentBundle(catalogue, id, selection);
      return { prompt: exportPrompt(bundle), error: '' };
    } catch (error) { return { prompt: '', error: error instanceof Error ? error.message : 'Could not prepare export.' }; }
  }, [open, id, JSON.stringify(selection)]);
  const entry = catalogue.find((component) => component.id === id);
  function save() {
    if (!result?.prompt) return;
    try {
      download(result.prompt, `whitepepper-${entry?.slug}-prompt.md`, 'text/markdown;charset=utf-8');
      setStatus('Export prompt downloaded. Attach the Markdown file or paste its contents into your coding agent.');
    } catch { setStatus('Download failed. Please try again.'); }
  }
  return <details className="component-export" onToggle={(event) => { setOpen(event.currentTarget.open); setStatus(''); }}>
    <summary><span>Prompt exportable</span><span aria-hidden="true">↗</span></summary>
    {open && <div className="export-body">
      <p>Exact source, styles, IDs and your selected settings. Paste the complete prompt into an agent in another project.</p>
      {result?.error ? <p role="alert">{result.error}</p> : <>
        <p>First, download and extract the <a href="#get-started">whitepepper_ui starter</a> into your project.</p>
        <div className="export-actions"><button type="button" onClick={save}>Download export prompt (.md)</button></div>
        <p className="export-facts">Procedural export | {Math.ceil((result?.prompt.length ?? 0) / 1024)} KB Markdown</p>
        <label className="sr-only" htmlFor={promptId}>Complete {entry?.name} export prompt</label>
        <textarea id={promptId} value={result?.prompt ?? ''} readOnly spellCheck={false} rows={9} />
        <p className="export-hint">Creates <code>whitepepper_ui/components/{entry?.slug}/</code> and tells the agent to refresh the local registry and tree.</p>
      </>}
      <p className="export-status" role="status">{status}</p>
    </div>}
  </details>;
}

export function StarterDownload() {
  const [status, setStatus] = useState('');
  function starter() {
    try { download(zipFolder(starterFiles(templates, vendorRuntime)), 'whitepepper_ui.zip', 'application/zip'); setStatus('Starter downloaded. Extract whitepepper_ui into your project root.'); }
    catch { setStatus('Could not download the starter. Please try again.'); }
  }
  return <div className="setup-download"><button className="download-library" type="button" onClick={starter}>Download whitepepper_ui <span aria-hidden="true">↓</span></button><p className="export-status" role="status">{status}</p></div>;
}

export function LocalLibraryInspector() {
  const [registry, setRegistry] = useState<{ schemaVersion: number; components: ComponentManifest[] }>(emptyRegistry);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  async function load(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1_048_576) throw new Error('Choose a registry.json smaller than 1 MB.');
      const next = validateRegistry(JSON.parse(await file.text()));
      setRegistry(next); setFilename(file.name); setError('');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not read that registry.'); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }
  const components = registry.components as ComponentManifest[];
  return <details className="local-library-inspector">
    <summary>Inspect your local registry <span>(optional)</span></summary>
        <div className="local-library"><div className="local-library-heading"><h3>Local library context</h3><button type="button" onClick={() => fileInput.current?.click()}>Load registry.json</button><input className="sr-only" ref={fileInput} type="file" accept=".json,application/json" aria-label="Load local White Pepper registry" onChange={(event) => load(event.target.files?.[0])} /></div><p>{filename ? `${filename}: ${components.length} registered component${components.length === 1 ? '' : 's'}. Manual snapshot for this page session.` : 'No local registry loaded. Downloading or copying a prompt does not install components.'}</p>{error && <p role="alert" className="registry-error">{error}</p>}
          <div className="library-tree" aria-label="Local component tree"><code>whitepepper_ui/</code><ul><li><code>AGENTS.md</code><span>Agent entry point</span></li><li><code>ORCHESTRATION.md</code><span>Inspect, reuse, verify</span></li><li><code>registry.json</code><span>Available IDs & relationships</span></li><li><code>components/</code>{components.length ? <ul>{components.map((c) => <li key={c.id}><code>{c.slug}/</code><span>{c.featureIds.length} feature IDs</span><code className="tree-component-id">{c.id}</code>{c.requires.length > 0 && <span>Requires: {c.requires.join(', ')}</span>}</li>)}</ul> : <span className="tree-empty">{filename ? 'This registry is empty.' : 'Import your registry to see what is available.'}</span>}</li></ul></div>
          {'runtimes' in registry && Array.isArray(registry.runtimes) && registry.runtimes.length > 0 && <p>{registry.runtimes.length} shared runtime(s) in this snapshot. Component manifests record which runtime they use.</p>}
          {filename && <button type="button" className="tree-download" onClick={() => download(renderTree(registry), 'COMPONENT_TREE.md', 'text/markdown;charset=utf-8')}>Download snapshot tree .md</button>}
        </div>
  </details>;
}
