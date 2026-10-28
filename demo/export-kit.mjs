import { featureIds, validateRegistry, renderTree, renderGraph, renderIndex } from './portable/registry-tools.mjs';

export const emptyRegistry = () => ({ schemaVersion: 1, components: [] });
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const file = (content) => ({ content, encoding: 'utf8' });

/** @param {Record<string, string>} templates
 * @param {{runtime: object | null, files: Record<string, {content: string, encoding: string}>} | null} [vendor] */
export function starterFiles(templates, vendor = null) {
  const files = Object.fromEntries(Object.entries(templates).map(([path, content]) => [path.replace('./portable/', ''), file(content)]));
  if (vendor) Object.assign(files, vendor.files);
  const registry = { ...emptyRegistry(), ...(vendor?.runtime ? { runtimes: [vendor.runtime] } : {}) };
  files['components/.gitkeep'] = file('');
  files['registry.json'] = file(json(registry));
  files['COMPONENT_TREE.md'] = file(renderTree(registry));
  files['component-tree.mmd'] = file(renderGraph(registry));
  files['index.ts'] = file(renderIndex(registry));
  return files;
}

function resolveValue(value, selection) {
  return typeof value === 'string' && value.startsWith('$') ? selection[value.slice(1)] : value;
}
function jsxProp(value) { return `{${JSON.stringify(value).replaceAll('<', '\\u003c')}}`; }

export function componentBundle(catalogue, id, requested = {}) {
  const root = catalogue.find((c) => c.id === id);
  if (!root) throw new Error(`Unknown component ${id}`);
  const included = new Map();
  function add(entry, overrides = {}) {
    if (included.has(entry.id)) return;
    const config = entry.spec.portability ?? {};
    const selection = { ...(config.defaults ?? {}), ...overrides };
    // Only keys declared in component metadata can enter generated JSX.
    for (const key of Object.keys(selection)) if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || /^on[A-Z]/.test(key) || key === 'dangerouslySetInnerHTML') throw new Error('Unsupported example prop');
    const deps = new Set();
    function inspect(node) {
      if (!node || typeof node !== 'object') return;
      if (node.componentId && node.componentId !== entry.id) deps.add(node.componentId);
      for (const child of Object.values(node)) if (child && typeof child === 'object') inspect(child);
    }
    inspect(config.example);
    const dependencies = [...deps].map((dep) => {
      const found = catalogue.find((c) => c.id === dep);
      if (!found) throw new Error(`Missing example component ${dep}`);
      return found;
    });
    const manifest = {
      id: entry.id, name: entry.name, slug: entry.slug, exportName: entry.exportName,
      entry: entry.entry,
      files: [...Object.keys(entry.files), `components/${entry.slug}/Example.tsx`, `components/${entry.slug}/manifest.json`].sort(),
      featureIds: featureIds(entry.spec), requires: [...deps].sort(),
      related: config.related ?? [], packages: entry.packages, spec: entry.spec,
      props: entry.props, selection, ...(entry.runtime ? { runtime: entry.runtime } : {}),
    };
    included.set(entry.id, { entry, manifest });
    for (const dependency of dependencies) add(dependency);
  }
  add(root, requested);
  const files = {}, manifests = [];
  for (const { entry, manifest } of included.values()) {
    Object.assign(files, entry.files);
    const config = entry.spec.portability ?? {};
    const imports = new Map([[entry.id, entry]]);
    function render(node, isRoot = false) {
      if (node == null) return '';
      if (Array.isArray(node)) return node.map((child) => render(child)).join('');
      if (typeof node !== 'object') return `{${JSON.stringify(node).replaceAll('<', '\\u003c')}}`;
      const component = catalogue.find((c) => c.id === (node.componentId ?? entry.id));
      if (!component) throw new Error('Unknown example component');
      imports.set(component.id, component);
      const props = { ...(node.props ?? {}), ...(isRoot ? manifest.selection : {}) };
      let attributes = Object.entries(props).map(([key, value]) => {
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || /^on[A-Z]/.test(key) || key === 'dangerouslySetInnerHTML') throw new Error('Unsupported example prop');
        const resolved = resolveValue(value, manifest.selection);
        return resolved === undefined ? '' : ` ${key}=${jsxProp(resolved)}`;
      }).join('');
      for (const [key, value] of Object.entries(node.slots ?? {})) {
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) throw new Error('Unsupported slot');
        attributes += ` ${key}={${render(value)}}`;
      }
      return `<${component.exportName}${attributes}>${render(node.children)}</${component.exportName}>`;
    }
    const jsx = render({ componentId: entry.id, ...(config.example ?? {}) }, true);
    const importLines = [...imports.values()].map((c) => `import { ${c.exportName} } from '${c.id === entry.id ? './' + c.entry.slice(`components/${c.slug}/`.length) : '../' + c.slug + '/' + c.entry.slice(`components/${c.slug}/`.length)}';`.replace(/\.(tsx?|jsx?)';$/, "';"));
    const example = `'use client';\nimport React from 'react';\n${importLines.join('\n')}\n\n// Selected catalogue props. See manifest.json and source for the complete API.\nexport default function Example() {\n  return (${jsx});\n}\n`;
    files[`components/${entry.slug}/Example.tsx`] = file(example);
    files[`components/${entry.slug}/manifest.json`] = file(json(manifest));
    manifests.push(manifest);
  }
  const runtimeIds = new Set(manifests.map((m) => m.runtime).filter(Boolean));
  const runtimes = runtimeIds.size ? [catalogue.vendor?.runtime].filter((runtime) => runtime && runtimeIds.has(runtime.id)) : [];
  if (runtimeIds.size !== runtimes.length) throw new Error('Missing bundled runtime for component export.');
  if (runtimes.length) Object.assign(files, catalogue.vendor.files);
  const registry = validateRegistry({ schemaVersion: 1, components: manifests, ...(runtimes.length ? { runtimes } : {}) });
  return { root, files, registry, runtimes, packages: Object.assign({}, ...manifests.map((m) => m.packages)), selection: included.get(id).manifest.selection };
}

export function exportPrompt(bundle) {
  // The dedicated starter download owns setup and runtime files. Component
  // prompts only add component source; rebuild inventories from all manifests.
  const files = Object.fromEntries(Object.entries(bundle.files).filter(([path]) => !path.startsWith('vendor/')));
  const sections = [
    `# Import ${bundle.root.name} into this project's whitepepper_ui folder`,
    'This is a procedural source export from White Pepper UI. No model generated this prompt. Follow the host project instructions and inspect existing files first.',
    'Before importing, confirm the downloaded whitepepper_ui starter is extracted at the project root, including AGENTS.md, ORCHESTRATION.md, registry.json and scripts/rebuild-registry.mjs. If it is missing, stop and ask the user to download and extract the starter using Get started in White Pepper UI. This component prompt does not create or replace the starter folder.',
    `Add this component to the directory whitepepper_ui/components/${bundle.root.slug}/ at the destination project's root. If the project uses a different source root, preserve this folder structure there and update host imports accordingly.`,
    'Read whitepepper_ui/AGENTS.md, ORCHESTRATION.md, registry.json and COMPONENT_TREE.md. Reuse matching local components. Merge additions; never replace the entire folder or discard existing manifests. If an existing file differs, reconcile it explicitly before writing. Keep all stable wp.* feature IDs and data-wp-* attributes.',
    'The files below contain the implementation, complete transitive local imports/styles/assets, component-owned feature metadata, props declarations and a selected-props Example.tsx. UTF-8 files are literal source; base64 files must be decoded as binary. Do not approximate the animations, colors, dimensions, or accessibility behavior.',
    `Selected props:\n${fence(json(bundle.selection), 'json')}`,
    `Host React packages (catalogue versions):\n${fence(json(bundle.packages), 'json')}\nUse the destination project's React and ReactDOM; do not bundle another React copy. Base UI, Motion and their transitive runtime dependencies are already compiled into local vendor files. Do not install them or rewrite their behavior. No OpenUI, upstream clone, Tailwind, catalogue tooling or agent backend is required. React type declarations remain supplied by a TypeScript host.`,
    ...(bundle.runtimes.length ? [`Shared runtime:\n${fence(json(bundle.runtimes), 'json')}\nThis prompt requires the matching whitepepper_ui starter ZIP to have been extracted first. The runtime files are NOT included in this prompt. Inspect the named vendor manifest before writing components; if it is absent, stop the import and ask the user to download the matching starter from Get started. Never install packages, fetch remote code, or invent a replacement to fill this gap.\nKeep existing runtime directories. Reuse the same runtime ID; different IDs coexist so older components retain their verified code.`] : []),
    'Merge the component files below into the existing starter. Preserve its setup files and existing inventory. Each source file keeps its client boundary and imports its own CSS. Next.js may require moving global CSS imports to the permitted host entry point. Mount the selected example in the host for verification; do not invent application actions.',
    'After writing components and their manifests, run: node whitepepper_ui/scripts/rebuild-registry.mjs (adjust only the folder location if necessary). This scans ALL local component manifests and refreshes registry.json, COMPONENT_TREE.md, component-tree.mmd and index.ts. These generated inventories are deliberately absent from this payload so existing components are preserved.',
    'Add a pointer to whitepepper_ui/AGENTS.md in the host agent instructions, preserving existing instructions. Verify the host type check/build, selected props and IDs, keyboard/focus, reduced motion and visual fidelity. For dialogs also verify focus trapping, Escape and focus return. Report installed paths, reused dependencies and actual check results. Do not claim installation until files exist and checks have run.',
    '## Files to merge into whitepepper_ui/',
  ];
  for (const [path, value] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    sections.push(`### whitepepper_ui/${path} (${value.encoding})\n\n${fence(value.content, value.encoding === 'base64' ? 'text' : path.endsWith('.tsx') ? 'tsx' : path.endsWith('.css') ? 'css' : path.endsWith('.json') ? 'json' : '')}`);
  }
  return sections.join('\n\n') + '\n';
}

function fence(value, lang = '') {
  const runs = value.match(/`+/g) ?? [];
  const marker = '`'.repeat(Math.max(3, ...runs.map((s) => s.length + 1)));
  return `${marker}${lang}\n${value.trimEnd()}\n${marker}`;
}

// Small standards-compliant ZIP writer (stored entries, UTF-8 names). No new
// dependency, network call or compression runtime is needed for downloads.
const encoder = new TextEncoder();
function bytes(value) {
  if (value.encoding !== 'base64') return encoder.encode(value.content);
  return Uint8Array.from(atob(value.content), (char) => char.charCodeAt(0));
}
function crc32(data) {
  let crc = -1;
  for (const byte of data) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
export function zipFolder(files) {
  const chunks = [], directory = [];
  let offset = 0, directorySize = 0;
  const append = (buffer, values) => { const view = new DataView(buffer.buffer); for (const [at, value, width] of values) width === 2 ? view.setUint16(at, value, true) : view.setUint32(at, value, true); };
  for (const [path, value] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    if (path.startsWith('/') || path.split('/').some((part) => part === '..' || part === '.' || !part) || path.includes('\\')) throw new Error('Unsafe ZIP path');
    const name = encoder.encode(`whitepepper_ui/${path}`), data = bytes(value), crc = crc32(data);
    const local = new Uint8Array(30);
    append(local, [[0, 0x04034b50], [4, 20, 2], [6, 0x800, 2], [12, 33, 2], [14, crc], [18, data.length], [22, data.length], [26, name.length, 2]]);
    chunks.push(local, name, data);
    const central = new Uint8Array(46);
    append(central, [[0, 0x02014b50], [4, 20, 2], [6, 20, 2], [8, 0x800, 2], [14, 33, 2], [16, crc], [20, data.length], [24, data.length], [28, name.length, 2], [42, offset]]);
    directory.push(central, name); directorySize += central.length + name.length;
    offset += local.length + name.length + data.length;
  }
  const end = new Uint8Array(22);
  append(end, [[0, 0x06054b50], [8, directory.length / 2, 2], [10, directory.length / 2, 2], [12, directorySize], [16, offset]]);
  const output = new Uint8Array(offset + directorySize + end.length);
  let cursor = 0;
  for (const part of [...chunks, ...directory, end]) { output.set(part, cursor); cursor += part.length; }
  return output;
}
