import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer, build, parseSync } from 'vite';
import { portabilityPlugin } from '../portability-plugin.mjs';
import { buildVendorRuntime } from '../vendor-runtime.mjs';
import { componentBundle, exportPrompt, starterFiles, zipFolder } from '../demo/export-kit.mjs';
import { validateRegistry, renderTree } from '../demo/portable/registry-tools.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let server, catalogue, temp;
const templates = {};
async function readTemplates(dir, prefix = './portable/') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await readTemplates(resolve(dir, entry.name), prefix + entry.name + '/');
    else templates[prefix + entry.name] = await readFile(resolve(dir, entry.name), 'utf8');
  }
}
async function materialize(files, root) {
  for (const [name, file] of Object.entries(files)) {
    const path = resolve(root, name); await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content);
  }
}
function promptFiles(prompt) {
  return Object.fromEntries([...prompt.matchAll(/^### whitepepper_ui\/([^\n]+) \((utf8|base64)\)\n\n(`{3,})[^\n]*\n([\s\S]*?)\n\3(?=\n|$)/gm)]
    .map(([, path, encoding, , content]) => [path, { encoding, content }]));
}
async function hostOnlyDependencies(root) {
  await mkdir(resolve(root, 'node_modules/@types'), { recursive: true });
  for (const name of ['react', 'react-dom', 'scheduler', 'csstype', '@types/react', '@types/react-dom']) {
    await symlink(resolve(repo, 'node_modules', name), resolve(root, 'node_modules', name), 'dir');
  }
}
before(async () => {
  temp = await mkdtemp(resolve(tmpdir(), 'whitepepper-export-test-'));
  await readTemplates(resolve(repo, 'demo/portable'));
  server = await createServer({ configFile: resolve(repo, 'vite.config.js'), server: { middlewareMode: true }, appType: 'custom' });
  catalogue = (await server.ssrLoadModule('virtual:whitepepper-exports')).default;
});
after(async () => { await server?.close(); if (temp) await rm(temp, { recursive: true, force: true }); });

test('all current component specs are discovered and carry the complete source closure', () => {
  for (const id of ['wp.component.attention-cue', 'wp.component.button', 'wp.component.card', 'wp.component.dialog']) assert.ok(catalogue.some((entry) => entry.id === id));
  for (const entry of catalogue) {
    const source = entry.files[entry.entry].content;
    assert.match(source, /data-wp-component/);
    assert.equal(entry.packages.react, '19.3.1');
    assert.ok(!entry.packages['@openuidev/react-lang']);
    assert.ok(!entry.packages.vite);
  }
});

test('a future component is discovered without an export-list or prompt edit', async () => {
  const sandbox = resolve(temp, 'future');
  await mkdir(resolve(sandbox, 'demo'), { recursive: true });
  await writeFile(resolve(sandbox, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/react': { version: '19.3.1' } } }));
  await writeFile(resolve(sandbox, 'demo/Future.tsx'), `export const futureSpec = { id: 'wp.component.future', portability: { defaults: { label: 'Future' } } } as const;\nexport function Future({label}: {label: string}) { return <span>{label}</span>; }`);
  const plugin = portabilityPlugin();
  plugin.configResolved({ root: resolve(sandbox, 'demo') });
  const generated = await plugin.load.call({ addWatchFile() {} }, '\0virtual:whitepepper-exports');
  assert.match(generated, /wp.component.future/);
  assert.match(generated, /"exportName":"Future"/);
  const executable = generated.replace(/^import .*;\n/, "const spec0 = { id: 'wp.component.future', portability: { defaults: { label: 'Future' } } };\n");
  const future = (await import('data:text/javascript;base64,' + Buffer.from(executable).toString('base64'))).default;
  assert.match(componentBundle(future, 'wp.component.future').files['components/future/Example.tsx'].content, /label=\{"Future"\}/);
  assert.equal(plugin.resolveId('virtual:whitepepper-exports'), '\0virtual:whitepepper-exports');
});

test('selected props, example components, actual motion and styles reach the fixed prompt', () => {
  const dialog = componentBundle(catalogue, 'wp.component.dialog', { variant: 'dark', direction: '3' });
  assert.deepEqual(dialog.registry.components.map((c) => c.id), ['wp.component.button', 'wp.component.dialog']);
  const example = dialog.files['components/dialog/Example.tsx'].content;
  assert.match(example, /variant=\{"dark"\}/);
  assert.match(example, /direction=\{"3"\}/);
  assert.match(example, /shape=\{"square"\}/);
  const cue = componentBundle(catalogue, 'wp.component.attention-cue', { color: '#f80', spinDuration: 0.8 });
  assert.match(cue.files['components/attention-cue/Example.tsx'].content, /color=\{"#f80"\}/);
  assert.match(cue.files['components/attention-cue/Example.tsx'].content, /spinDuration=\{0.8\}/);
  const prompt = exportPrompt(dialog);
  assert.equal(prompt, exportPrompt(dialog));
  assert.match(prompt, /Add this component to the directory whitepepper_ui\/components\/dialog/);
  assert.match(prompt, /rebuild-registry.mjs/);
  assert.match(prompt, /duration: 0.48/);
  assert.match(prompt, /#0061e8/);
  assert.match(prompt, /Do not approximate/);
  assert.ok(!prompt.includes('### whitepepper_ui/registry.json'));
  assert.ok(!prompt.includes('### whitepepper_ui/index.ts'));
  assert.match(prompt, /props declarations/);
  assert.match(prompt, /runtime files are NOT included/);
  assert.ok(!prompt.includes('### whitepepper_ui/vendor/'));
  assert.match(prompt, /If it is missing, stop and ask the user to download and extract the starter/);
  assert.ok(!/standalone|component ZIP/.test(prompt));
  const payloads = promptFiles(prompt);
  const componentFiles = Object.keys(dialog.files).filter((path) => path.startsWith('components/'));
  assert.deepEqual(Object.keys(payloads).sort(), componentFiles.sort());
  for (const path of componentFiles) assert.equal(payloads[path].content, dialog.files[path].content.trimEnd());
});

test('vendor output has no external runtime or type imports beyond host React', () => {
  assert.ok(catalogue.vendor.runtime);
  const unresolved = [];
  for (const [path, file] of Object.entries(catalogue.vendor.files)) {
    if (!/\.[cm]?[jt]s$/.test(path)) continue;
    const ast = parseSync(path, file.content).program;
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source && !node.source.value.startsWith('.') && !/^(?:react|react-dom)(?:\/|$)/.test(node.source.value)) unresolved.push([path, node.source.value]);
      if (node.type === 'TSImportType') {
        const source = node.source ?? node.argument ?? node.parameter;
        const value = source?.value ?? source?.literal?.value;
        if (value && !value.startsWith('.') && !/^(?:react|react-dom)(?:\/|$)/.test(value)) unresolved.push([path, value]);
      }
      for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
    }
    visit(ast);
  }
  assert.deepEqual(unresolved, []);
  for (const entry of catalogue.filter((c) => c.runtime)) {
    assert.equal(entry.runtime, catalogue.vendor.runtime.id);
    assert.ok(!entry.packages.motion && !entry.packages['@base-ui/react']);
    assert.match(entry.files[entry.entry].content, /vendor\/runtime-/);
  }
});

test('runtime identity is reproducible from the recorded imports', async () => {
  const manifest = JSON.parse(catalogue.vendor.files[catalogue.vendor.runtime.manifest].content);
  const imports = new Map(Object.entries(manifest.bindings).map(([name, binding]) => [name, new Set(binding.values)]));
  const typeImports = new Map(Object.entries(manifest.bindings).map(([name, binding]) => [name, new Set(binding.types)]));
  const rebuilt = await buildVendorRuntime({ repo, imports, typeImports, aliases: server.config.resolve.alias });
  assert.equal(rebuilt.runtime.id, catalogue.vendor.runtime.id);
});

test('source inspection includes local assets and rejects incomplete dependencies', async () => {
  const sandbox = resolve(temp, 'assets');
  await mkdir(resolve(sandbox, 'demo'), { recursive: true });
  await writeFile(resolve(sandbox, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/react': { version: '19.3.1' } } }));
  const source = `import './Future.css'; export const futureSpec = { id: 'wp.component.future' }; export function Future() { return <span />; }`;
  await writeFile(resolve(sandbox, 'demo/Future.tsx'), source);
  await writeFile(resolve(sandbox, 'demo/Future.css'), '.future { background: url(icon.png); }');
  await writeFile(resolve(sandbox, 'demo/icon.png'), Buffer.from([0, 255, 128]));
  const plugin = portabilityPlugin(); plugin.configResolved({ root: resolve(sandbox, 'demo') });
  const inspect = () => plugin.load.call({ addWatchFile() {} }, '\0virtual:whitepepper-exports');
  assert.match(await inspect(), /icon.png/);
  assert.match(await inspect(), /"encoding":"base64"/);
  await writeFile(resolve(sandbox, 'demo/Future.css'), '.future { background: url(https://example.com/unbundled.png); }');
  await assert.rejects(inspect, /Remote assets/);
  await writeFile(resolve(sandbox, 'demo/Future.css'), '.future {}');
  await writeFile(resolve(sandbox, 'demo/Future.tsx'), "import './missing'; " + source);
  await assert.rejects(inspect, /Missing portable dependency/);
  await writeFile(resolve(sandbox, 'demo/Future.tsx'), "import('unknown-package'); " + source);
  await assert.rejects(inspect, /Dynamic imports/);
  await writeFile(resolve(sandbox, 'demo/Future.tsx'), source);
  await rm(resolve(sandbox, 'demo/Future.css'));
  await symlink(resolve(repo, 'README.md'), resolve(sandbox, 'demo/Future.css'));
  await assert.rejects(inspect, /symlink escapes/);
});

test('every generated example type checks against the complete portable sources', async () => {
  const root = resolve(temp, 'typecheck');
  const all = starterFiles(templates);
  for (const entry of catalogue) Object.assign(all, componentBundle(catalogue, entry.id).files);
  await materialize(all, root);
  await hostOnlyDependencies(root);
  await writeFile(resolve(root, 'css.d.ts'), 'declare module "*.css" {}\n');
  const config = { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, skipLibCheck: false, noEmit: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'] }, include: ['components/**/*.tsx', 'css.d.ts'] };
  await writeFile(resolve(root, 'tsconfig.json'), JSON.stringify(config));
  execFileSync(process.execPath, [resolve(repo, 'node_modules/typescript/bin/tsc'), '-p', resolve(root, 'tsconfig.json')], { encoding: 'utf8' });
});

test('a starter plus a component Markdown prompt builds with no Base UI or Motion packages installed', async () => {
  const root = resolve(temp, 'starter-and-prompt');
  const library = resolve(root, 'whitepepper_ui');
  await materialize(starterFiles(templates, catalogue.vendor), library);
  const originalRuntime = await readFile(resolve(library, catalogue.vendor.runtime.manifest), 'utf8');
  const prompt = exportPrompt(componentBundle(catalogue, 'wp.component.dialog', { variant: 'dark', direction: '3' }));
  await materialize(promptFiles(prompt), library);
  execFileSync(process.execPath, [resolve(library, 'scripts/rebuild-registry.mjs')], { encoding: 'utf8' });
  assert.equal(await readFile(resolve(library, catalogue.vendor.runtime.manifest), 'utf8'), originalRuntime);
  assert.equal(JSON.parse(await readFile(resolve(library, 'registry.json'), 'utf8')).components.length, 2);
  await hostOnlyDependencies(root);
  await writeFile(resolve(root, 'package.json'), '{"type":"module"}');
  await writeFile(resolve(root, 'index.html'), '<div id="app"></div><script type="module" src="/main.tsx"></script>');
  await writeFile(resolve(root, 'main.tsx'), `import React from 'react'; import { createRoot } from 'react-dom/client'; import Example from './whitepepper_ui/components/dialog/Example'; createRoot(document.getElementById('app')!).render(<Example />);`);
  const manifest = JSON.parse(await readFile(resolve(root, 'whitepepper_ui', catalogue.vendor.runtime.manifest), 'utf8'));
  for (const entry of Object.values(manifest.entrypoints)) await import(pathToFileURL(resolve(root, 'whitepepper_ui/vendor', manifest.id, entry)).href);
  await build({ configFile: false, root, logLevel: 'silent', build: { write: false }, plugins: [{ name: 'no-library-installs', resolveId(id) { if (/^(?:@base-ui\/|motion(?:\/|$)|framer-motion|motion-dom|motion-utils|@floating-ui\/)/.test(id)) throw new Error(`Unexpected package install required: ${id}`); } }] });
});

test('starter ZIP extracts with valid CRCs and includes an empty library', async () => {
  const path = resolve(temp, 'starter.zip');
  await writeFile(path, zipFolder(starterFiles(templates, catalogue.vendor)));
  const result = execFileSync('python3', ['-c', 'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert all(n.startswith("whitepepper_ui/") for n in z.namelist()); print(json.dumps(json.loads(z.read("whitepepper_ui/registry.json"))))', path], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(result).components, []);
  assert.equal(JSON.parse(result).runtimes[0].id, catalogue.vendor.runtime.id);
  assert.throws(() => zipFolder({ '../escape': { content: 'bad' } }), /Unsafe/);
});

test('registry rebuild accumulates imports, is repeatable, and rejects missing files safely', async () => {
  const root = resolve(temp, 'growing/whitepepper_ui');
  await materialize(starterFiles(templates, catalogue.vendor), root);
  const run = () => execFileSync(process.execPath, [resolve(root, 'scripts/rebuild-registry.mjs')], { encoding: 'utf8', cwd: tmpdir(), stdio: 'pipe' });
  run();
  await materialize(componentBundle(catalogue, 'wp.component.button').files, root); run();
  const first = JSON.parse(await readFile(resolve(root, 'registry.json'), 'utf8'));
  assert.equal(first.components.length, 1);
  await materialize(componentBundle(catalogue, 'wp.component.attention-cue').files, root); run();
  const second = await readFile(resolve(root, 'registry.json'), 'utf8');
  assert.equal(JSON.parse(second).components.length, 2);
  assert.match(await readFile(resolve(root, 'component-tree.mmd'), 'utf8'), /requires/);
  run(); assert.equal(await readFile(resolve(root, 'registry.json'), 'utf8'), second);
  const runtime = JSON.parse(second).runtimes[0];
  const manifest = JSON.parse(await readFile(resolve(root, runtime.manifest), 'utf8'));
  const runtimeFile = Object.keys(manifest.files).find((name) => name.endsWith('.mjs'));
  const runtimePath = resolve(root, 'vendor', runtime.id, runtimeFile);
  const saved = await readFile(runtimePath);
  await writeFile(runtimePath, 'altered runtime');
  assert.throws(run);
  assert.equal(await readFile(resolve(root, 'registry.json'), 'utf8'), second);
  await writeFile(runtimePath, saved);
  await rm(resolve(root, 'components/button/Example.tsx'));
  assert.throws(run);
  assert.equal(await readFile(resolve(root, 'registry.json'), 'utf8'), second);
});

test('registry validation rejects duplicate identities, path escapes and dangling dependencies', () => {
  const registry = componentBundle(catalogue, 'wp.component.dialog').registry;
  assert.equal(validateRegistry(registry).components.length, 2);
  assert.match(renderTree(registry), /wp\.animation\.dialog\.reshape/);
  const copy = () => JSON.parse(JSON.stringify(registry));
  let bad = copy(); bad.components.push(bad.components[0]); assert.throws(() => validateRegistry(bad), /Duplicate/);
  bad = copy(); bad.components[0].files.push('components/button/../../escape'); assert.throws(() => validateRegistry(bad), /paths/);
  bad = copy(); bad.components = bad.components.filter((c) => c.id !== 'wp.component.button'); assert.throws(() => validateRegistry(bad), /Missing required/);
  bad = copy(); bad.components[0].featureIds = []; assert.throws(() => validateRegistry(bad), /disagree/);
});

test('binary local assets and Markdown fences survive the component prompt', async () => {
  const bundle = componentBundle(catalogue, 'wp.component.card');
  bundle.files['components/card/test.bin'] = { content: Buffer.from([0, 255, 1, 128]).toString('base64'), encoding: 'base64' };
  bundle.files['components/card/tricky.md'] = { content: '```tsx\nhello\n```', encoding: 'utf8' };
  const prompt = exportPrompt(bundle);
  assert.match(prompt, /````\n```tsx/);
  const root = resolve(temp, 'prompt-assets');
  await materialize(promptFiles(prompt), root);
  assert.deepEqual(await readFile(resolve(root, 'components/card/test.bin')), Buffer.from([0, 255, 1, 128]));
  assert.equal(await readFile(resolve(root, 'components/card/tricky.md'), 'utf8'), bundle.files['components/card/tricky.md'].content);
});
