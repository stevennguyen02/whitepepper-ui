import { readdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateRegistry, renderTree, renderGraph, renderIndex } from '../registry-tools.mjs';

// Resolve relative to the script, never to the caller's current working directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const actualRoot = await realpath(root);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
async function safeRead(path) {
  const actual = await realpath(resolve(root, path)), rel = relative(actualRoot, actual);
  if (rel === '..' || rel.startsWith(`..${sep}`)) throw new Error(`File escapes library: ${path}`);
  return readFile(actual);
}
const components = [];
const folders = await readdir(resolve(root, 'components'), { withFileTypes: true });
for (const folder of folders.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
  if (folder.name.startsWith('.')) continue;
  if (!folder.isDirectory()) throw new Error(`Expected a component directory: ${folder.name}`);
  const manifest = JSON.parse(await readFile(resolve(root, 'components', folder.name, 'manifest.json'), 'utf8'));
  if (manifest.slug !== folder.name) throw new Error(`Manifest slug does not match directory: ${folder.name}`);
  components.push(manifest);
}
const runtimes = [];
let vendorFolders = [];
try { vendorFolders = await readdir(resolve(root, 'vendor'), { withFileTypes: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const folder of vendorFolders) {
  if (folder.name.startsWith('.')) continue;
  if (!folder.isDirectory() || !/^runtime-[a-f0-9]{24}$/.test(folder.name)) throw new Error(`Invalid vendor directory: ${folder.name}`);
  const manifestPath = `vendor/${folder.name}/manifest.json`;
  const manifest = JSON.parse((await safeRead(manifestPath)).toString('utf8'));
  const { packages, peers, entrypoints, bindings, files } = manifest;
  if (manifest.schemaVersion !== 1 || manifest.id !== folder.name || !files || typeof files !== 'object' || Array.isArray(files) || !entrypoints || typeof entrypoints !== 'object') throw new Error(`Invalid runtime manifest: ${folder.name}`);
  if (manifest.id !== 'runtime-' + sha256(JSON.stringify({ packages, peers, entrypoints, ...(bindings ? { bindings } : {}), files })).slice(0, 24)) throw new Error(`Runtime identity mismatch: ${folder.name}`);
  for (const [path, expected] of Object.entries(files)) {
    if (!/^[A-Za-z0-9@_./-]+$/.test(path) || path.startsWith('/') || path.split('/').some((part) => !part || part === '.' || part === '..') || !/^[a-f0-9]{64}$/.test(expected)) throw new Error(`Unsafe runtime path or checksum: ${path}`);
    if (sha256(await safeRead(`vendor/${folder.name}/${path}`)) !== expected) throw new Error(`Runtime checksum mismatch: ${path}`);
  }
  for (const path of Object.values(entrypoints)) if (!Object.hasOwn(files, path)) throw new Error(`Missing runtime entry: ${path}`);
  runtimes.push({ id: manifest.id, manifest: manifestPath, packages, peers, fileCount: Object.keys(files).length + 1 });
}
const registry = validateRegistry({ schemaVersion: 1, components, ...(runtimes.length ? { runtimes } : {}) });
// Check all paths before writing any generated artifacts, including symlink escapes.
for (const component of registry.components) {
  for (const file of component.files) {
    await safeRead(file);
  }
}
await writeFile(resolve(root, 'registry.json'), JSON.stringify(registry, null, 2) + '\n');
await writeFile(resolve(root, 'COMPONENT_TREE.md'), renderTree(registry));
await writeFile(resolve(root, 'component-tree.mmd'), renderGraph(registry));
await writeFile(resolve(root, 'index.ts'), renderIndex(registry));
console.log(`Registered ${components.length} local component(s) and verified ${runtimes.length} bundled runtime(s). Registry, tree, graph and index refreshed.`);
