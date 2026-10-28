const COMPONENT_ID = /^wp\.component\.[a-z0-9.-]+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = (value) => Array.isArray(value) && value.every((v) => typeof v === 'string' && v.length > 0 && v.length < 300) && new Set(value).size === value.length;

export function featureIds(spec) {
  const found = new Set();
  function visit(value) {
    if (!plain(value) && !Array.isArray(value)) return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'id' && typeof item === 'string' && item.startsWith('wp.')) found.add(item);
      else if (typeof item === 'object' && item) visit(item);
    }
  }
  visit(spec);
  return [...found].sort();
}

export function validateRegistry(input) {
  if (!plain(input) || input.schemaVersion !== 1 || !Array.isArray(input.components) || input.components.length > 1000) throw new Error('Expected a White Pepper registry with schemaVersion 1 and a components array.');
  const ids = new Set(), slugs = new Set(), exports = new Set();
  const runtimes = input.runtimes ?? [];
  if (!Array.isArray(runtimes) || runtimes.length > 1000) throw new Error('Invalid runtime registry.');
  const runtimeIds = new Set();
  for (const runtime of runtimes) {
    if (!plain(runtime) || !/^runtime-[a-f0-9]{24}$/.test(runtime.id) || runtime.manifest !== `vendor/${runtime.id}/manifest.json` || !plain(runtime.packages) || !plain(runtime.peers) || !Object.values({ ...runtime.packages, ...runtime.peers }).every((v) => typeof v === 'string') || !Number.isSafeInteger(runtime.fileCount) || runtime.fileCount < 1 || runtimeIds.has(runtime.id)) throw new Error('Invalid or duplicate bundled runtime.');
    runtimeIds.add(runtime.id);
  }
  for (const c of input.components) {
    if (!plain(c) || !COMPONENT_ID.test(c.id) || !SLUG.test(c.slug) || !IDENTIFIER.test(c.exportName) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 200) throw new Error('Invalid component identity in registry.');
    if (ids.has(c.id) || slugs.has(c.slug) || exports.has(c.exportName)) throw new Error(`Duplicate component identity: ${c.id}`);
    ids.add(c.id); slugs.add(c.slug); exports.add(c.exportName);
    if (!strings(c.files) || !c.files.length || !strings(c.featureIds) || !strings(c.requires) || !strings(c.related)) throw new Error(`Invalid lists for ${c.id}`);
    if (!plain(c.packages) || !Object.values(c.packages).every((v) => typeof v === 'string') || !plain(c.spec) || !plain(c.props) || !plain(c.selection)) throw new Error(`Invalid metadata for ${c.id}`);
    if (c.spec.id !== c.id || !c.featureIds.every((id) => /^wp\.[a-z0-9.-]+$/.test(id)) || featureIds(c.spec).join('\n') !== [...c.featureIds].sort().join('\n')) throw new Error(`Feature IDs disagree with component-owned metadata: ${c.id}`);
    const prefix = `components/${c.slug}/`;
    if (!c.files.every((path) => path.startsWith(prefix) && /^[A-Za-z0-9_./-]+$/.test(path) && !path.split('/').some((part) => part === '..' || part === '.' || !part)) || !c.files.includes(c.entry) || !c.files.includes(`${prefix}manifest.json`)) throw new Error(`Invalid component file paths: ${c.id}`);
    if (!c.requires.every((id) => COMPONENT_ID.test(id) && id !== c.id) || !c.related.every((id) => COMPONENT_ID.test(id) && id !== c.id)) throw new Error(`Invalid relationships for ${c.id}`);
    if (c.runtime != null && !runtimeIds.has(c.runtime)) throw new Error(`Missing bundled runtime for ${c.id}`);
  }
  for (const c of input.components) for (const id of c.requires) if (!ids.has(id)) throw new Error(`Missing required component ${id} for ${c.id}`);
  return { schemaVersion: 1, components: [...input.components].sort((a, b) => a.slug.localeCompare(b.slug, 'en')), ...(input.runtimes ? { runtimes: [...runtimes].sort((a, b) => a.id.localeCompare(b.id, 'en')) } : {}) };
}

export function renderTree(registry) {
  validateRegistry(registry);
  const lines = ['# Local White Pepper component tree', '', 'Generated from local manifests. Run `node whitepepper_ui/scripts/rebuild-registry.mjs` after changes.', '', '```text', 'whitepepper_ui/', '├── AGENTS.md', '├── ORCHESTRATION.md', '├── registry.json', '├── index.ts', '├── tokens.css'];
  if (registry.runtimes?.length) { lines.push('├── vendor/'); for (const runtime of registry.runtimes) lines.push(`│   ${runtime.id}/ [${runtime.fileCount} verified runtime, type and license files]`); }
  lines.push('└── components/');
  if (!registry.components.length) lines.push('    (empty: paste a component export prompt into your coding agent)');
  registry.components.forEach((c, i) => {
    const last = i === registry.components.length - 1;
    lines.push(`    ${last ? '└' : '├'}── ${c.slug}/ [${c.id}]`);
    for (const file of c.files) lines.push(`    ${last ? ' ' : '│'}   ${file.slice(`components/${c.slug}/`.length)}`);
  });
  lines.push('```', '', '## Features and cross references', '');
  for (const c of registry.components) {
    lines.push(`### ${c.name.replace(/[\r\n`]/g, ' ')} (${c.id})`, '', `Entry: \`${c.entry}\``, '', `Features: ${c.featureIds.map((id) => `\`${id}\``).join(', ')}`, '', `Requires: ${c.requires.join(', ') || 'none'}. Related: ${c.related.join(', ') || 'none'}.`, '', `Runtime: ${c.runtime ?? 'host React only'}.`, '');
  }
  lines.push('## Dependency graph', '', '```mermaid', renderGraph(registry).trimEnd(), '```', '');
  return lines.join('\n');
}

export function renderGraph(registry) {
  validateRegistry(registry);
  const lines = ['flowchart TD', '  library["whitepepper_ui"]'];
  const node = (id) => `c_${[...id].map((character) => character.charCodeAt(0).toString(16)).join('_')}`;
  for (const runtime of registry.runtimes ?? []) lines.push(`  ${node(runtime.id)}["${runtime.id}"]`, `  library --> ${node(runtime.id)}`);
  for (const c of registry.components) {
    lines.push(`  ${node(c.id)}["${c.id}"]`, `  library --> ${node(c.id)}`);
    if (c.runtime) lines.push(`  ${node(c.id)} -->|runtime| ${node(c.runtime)}`);
    for (const id of c.requires) lines.push(`  ${node(c.id)} -->|requires| ${node(id)}`);
    for (const id of c.related.filter((id) => registry.components.some((entry) => entry.id === id) && !c.requires.includes(id))) lines.push(`  ${node(c.id)} -.->|related| ${node(id)}`);
  }
  return lines.join('\n') + '\n';
}

export function renderIndex(registry) {
  validateRegistry(registry);
  return '// Generated from component manifests. Do not hand edit.\n' + registry.components.map((c) => `export { ${c.exportName} } from './${c.entry.replace(/\.(tsx?|jsx?)$/, '')}';`).join('\n') + '\n';
}
