import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative, extname, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { build, parseSync, esmExternalRequirePlugin } from 'vite';

export const hostPackage = (name) => /^(?:react|react-dom)(?:\/|$)/.test(name);
export const packageName = (name) => name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
const hash = (text) => createHash('sha256').update(text).digest('hex');
const slash = (path) => path.replaceAll('\\', '/');
const asFile = (content) => ({ content, encoding: 'utf8' });
const declarationImport = (path) => path.replace(/\.d\.mts$/, '.mjs').replace(/\.d\.cts$/, '.cjs').replace(/\.d\.ts$/, '.js');
const fileExists = (path) => existsSync(path) && statSync(path).isFile();

function packageRoot(name, from) {
  let dir = from;
  while (true) {
    const candidate = resolve(dir, 'node_modules', name);
    if (fileExists(resolve(candidate, 'package.json'))) return candidate;
    if (dirname(dir) === dir) throw new Error(`Cannot find installed portable dependency ${name} from ${from}`);
    dir = dirname(dir);
  }
}
function owner(path) {
  let dir = dirname(path);
  while (!fileExists(resolve(dir, 'package.json'))) {
    if (dirname(dir) === dir) throw new Error(`No package provenance for ${path}`);
    dir = dirname(dir);
  }
  return { root: dir, ...JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) };
}
function typeCondition(value) {
  if (typeof value === 'string') return /\.d\.[cm]?ts$/.test(value) ? value : undefined;
  if (!value || typeof value !== 'object') return;
  for (const key of ['types', 'import', 'default', 'require']) {
    const found = typeCondition(value[key]); if (found) return found;
  }
}
function typeEntry(specifier, from) {
  if (specifier.startsWith('.')) {
    const base = resolve(dirname(from), specifier);
    const stem = base.replace(/\.[cm]?js$/, '');
    const candidates = /\.d\.[cm]?ts$/.test(base) ? [base] : [stem + '.d.mts', stem + '.d.ts', stem + '.d.cts', base + '.d.mts', base + '.d.ts', resolve(base, 'index.d.mts'), resolve(base, 'index.d.ts')];
    const result = candidates.find(fileExists);
    if (!result) throw new Error(`Missing portable declaration ${specifier} from ${from}`);
    return result;
  }
  const name = packageName(specifier), root = packageRoot(name, dirname(from));
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const subpath = specifier === name ? '.' : '.' + specifier.slice(name.length);
  let target = typeCondition(pkg.exports?.[subpath] ?? (subpath === '.' ? pkg.exports : undefined));
  if (!target && pkg.exports) for (const [pattern, value] of Object.entries(pkg.exports)) {
    if (!pattern.includes('*')) continue;
    const [prefix, suffix] = pattern.split('*');
    if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
      const match = subpath.slice(prefix.length, suffix ? -suffix.length : undefined);
      target = typeCondition(value)?.replaceAll('*', match); if (target) break;
    }
  }
  target ??= subpath === '.' ? pkg.types ?? pkg.typings : undefined;
  if (target && fileExists(resolve(root, target))) return resolve(root, target);
  return typeEntry('./' + (subpath === '.' ? 'index.js' : subpath.slice(2) + '/index.js'), resolve(root, '__entry__.d.ts'));
}
function declarationReferences(ast) {
  const refs = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) refs.push(node.source);
    if (node.type === 'TSImportType') {
      const value = node.source ?? node.argument ?? node.parameter;
      if (value?.type === 'Literal') refs.push(value);
      else if (value?.literal?.type === 'Literal') refs.push(value.literal);
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  }
  visit(ast);
  return refs;
}

// Compile exact resolved code once on White Pepper's side. Consumers need only
// their own React/ReactDOM. No destination package install or model is involved.
export async function buildVendorRuntime({ repo, imports, typeImports = new Map(), aliases = [] }) {
  const requested = [...imports].filter(([name]) => !hostPackage(name)).sort(([a], [b]) => a.localeCompare(b, 'en'));
  if (!requested.length) return { runtime: null, files: {}, entrypoints: {}, watchFiles: [] };
  const entries = {}, entrypoints = {}, packages = new Map(), watchFiles = new Set();
  for (const [name, symbols] of requested) {
    const entry = 'module-' + hash(name).slice(0, 12);
    entries[entry] = '\0wp-vendor:' + name;
    entrypoints[name] = entry + '.mjs';
  }
  const result = await build({
    configFile: false, root: repo, publicDir: false, logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    resolve: { alias: aliases, dedupe: ['react', 'react-dom'], conditions: ['module', 'browser', 'production'] },
    plugins: [esmExternalRequirePlugin({ external: [/^(?:react|react-dom)(?:\/|$)/] }), {
      name: 'wp-vendor-entries',
      resolveId(id) { if (id.startsWith('\0wp-vendor:')) return id; },
      load(id) {
        if (!id.startsWith('\0wp-vendor:')) return;
        const name = id.slice('\0wp-vendor:'.length), symbols = imports.get(name);
        return !symbols.size ? 'export {};' : symbols.has('*') ? `export * from ${JSON.stringify(name)}; export * as __whitepepper_vendor_namespace__ from ${JSON.stringify(name)}; ${symbols.has('default') ? `export { default } from ${JSON.stringify(name)};` : ''}` : `export { ${[...symbols].sort().join(', ')} } from ${JSON.stringify(name)};`;
      },
    }],
    build: {
      write: false, minify: true, target: 'es2022', sourcemap: false,
      lib: { entry: entries, formats: ['es'] },
      rolldownOptions: {
        input: entries,
        output: { entryFileNames: '[name].mjs', chunkFileNames: 'chunks/[name]-[hash].mjs' },
      },
    },
  });
  const files = {};
  function recordPackage(pkg) {
    if (hostPackage(pkg.name)) return;
    const previous = packages.get(pkg.name);
    if (previous && previous.version !== pkg.version) throw new Error(`Conflicting vendored versions of ${pkg.name}`);
    packages.set(pkg.name, pkg);
  }
  for (const output of (Array.isArray(result) ? result : [result]).flatMap((r) => r.output)) {
    if (output.type !== 'chunk') throw new Error(`Unexpected vendor asset ${output.fileName}; add an explicit portable asset adapter.`);
    files[output.fileName] = asFile(output.code);
    for (const id of Object.keys(output.modules)) if (!id.startsWith('\0') && fileExists(id.split('?')[0])) {
      const path = id.split('?')[0]; watchFiles.add(path); recordPackage(owner(path));
    }
  }

  const seenTypes = new Set();
  const typeTarget = (path) => { const pkg = owner(path); return `types/${pkg.name}/${slash(relative(pkg.root, path))}`; };
  function addType(path) {
    if (seenTypes.has(path)) return;
    seenTypes.add(path); watchFiles.add(path); recordPackage(owner(path));
    const original = readFileSync(path, 'utf8'), parsed = parseSync(path, original);
    if (parsed.errors.length) throw new Error(`Could not inspect declarations: ${path}: ${parsed.errors[0].message}`);
    const replacements = [];
    for (const ref of declarationReferences(parsed.program)) {
      if (hostPackage(ref.value)) continue;
      const target = typeEntry(ref.value, path); addType(target);
      let replacement = posix.relative(posix.dirname(typeTarget(path)), declarationImport(typeTarget(target)));
      if (!replacement.startsWith('.')) replacement = './' + replacement;
      replacements.push({ start: ref.start + 1, end: ref.end - 1, value: replacement });
    }
    // Documentation comments account for most declaration size. Notices are
    // preserved separately for every included package, rather than repeated.
    for (const comment of parsed.comments ?? []) if (!original.slice(comment.start, comment.end).startsWith('///')) replacements.push({ start: comment.start, end: comment.end, value: '' });
    let content = original;
    for (const change of replacements.sort((a, b) => b.start - a.start)) content = content.slice(0, change.start) + change.value + content.slice(change.end);
    files[typeTarget(path)] = asFile(content.replace(/\n\s*\n/g, '\n'));
  }
  for (const [name, symbols] of requested) {
    const sourceTypes = typeEntry(name, resolve(repo, '__vendor__.d.ts'));
    addType(sourceTypes);
    let target = './' + declarationImport(typeTarget(sourceTypes));
    const allSymbols = new Set([...symbols, ...(typeImports.get(name) ?? [])]);
    const exports = allSymbols.has('*') ? '*' : `{ ${[...allSymbols].sort().join(', ')} }`;
    files[entrypoints[name].replace(/\.mjs$/, '.d.mts')] = asFile(`export ${exports} from '${target}';\n${allSymbols.has('*') ? `export * as __whitepepper_vendor_namespace__ from '${target}';\n${allSymbols.has('default') ? `export { default } from '${target}';\n` : ''}` : ''}`);
  }
  const packageVersions = {};
  for (const [name, pkg] of [...packages].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    packageVersions[name] = pkg.version;
    let dir = pkg.root, notices = [];
    while (!notices.length) {
      notices = readdirSync(dir).filter((name) => /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(name) && fileExists(resolve(dir, name)));
      if (notices.length) break;
      if (dirname(dir) === dir || dir === repo) throw new Error(`Missing license notices for vendored ${name}`);
      dir = dirname(dir);
    }
    for (const notice of notices) { const path = resolve(dir, notice); watchFiles.add(path); files[`licenses/${name}/${notice}`] = asFile(readFileSync(path, 'utf8')); }
  }
  const checksums = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, file]) => [name, hash(file.content)]));
  const lock = JSON.parse(readFileSync(resolve(repo, 'package-lock.json'), 'utf8'));
  const peers = Object.fromEntries(['react', 'react-dom'].map((name) => [name, lock.packages?.[`node_modules/${name}`]?.version]).filter(([, value]) => value));
  const bindings = Object.fromEntries(requested.map(([name, symbols]) => [name, { values: [...symbols].sort(), types: [...(typeImports.get(name) ?? [])].sort() }]));
  const identity = { packages: packageVersions, peers, entrypoints, bindings, files: checksums };
  const id = 'runtime-' + hash(JSON.stringify(identity)).slice(0, 24);
  const manifest = { schemaVersion: 1, id, ...identity };
  files['manifest.json'] = asFile(JSON.stringify(manifest, null, 2) + '\n');
  const directory = `vendor/${id}`;
  return {
    runtime: { id, manifest: `${directory}/manifest.json`, packages: packageVersions, peers, fileCount: Object.keys(files).length },
    files: Object.fromEntries(Object.entries(files).map(([name, value]) => [`${directory}/${name}`, value])),
    entrypoints: Object.fromEntries(Object.entries(entrypoints).map(([name, path]) => [name, `${directory}/${path}`])),
    watchFiles: [...watchFiles],
  };
}
