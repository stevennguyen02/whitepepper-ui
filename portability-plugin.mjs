import { readFileSync, readdirSync, existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, dirname, extname, posix } from 'node:path';
import { parseSync } from 'vite';
import { buildVendorRuntime, hostPackage } from './vendor-runtime.mjs';

const publicId = 'virtual:whitepepper-exports';
const internalId = '\0' + publicId;
const textExts = new Set(['.tsx', '.ts', '.jsx', '.js', '.mjs', '.css', '.svg', '.json']);
const slash = (path) => path.replaceAll('\\', '/');
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((file) => {
    if (file.name.startsWith('.') || ['dist', 'node_modules', 'portable'].includes(file.name)) return [];
    const full = resolve(path, file.name);
    return file.isDirectory() ? walk(full) : [full];
  });
}
function parse(path, source = readFileSync(path, 'utf8')) {
  const result = parseSync(path, source);
  if (result.errors.length) throw new Error(`Could not inspect portable source: ${path}: ${result.errors[0].message}`);
  return result.program;
}
function objectValue(node, name) {
  while (['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression'].includes(node.type)) node = node.expression;
  return node.type === 'ObjectExpression' ? node.properties.find((p) => p.type === 'Property' && (p.key.name ?? p.key.value) === name)?.value : undefined;
}
function discover(path) {
  const ast = parse(path);
  const specs = [];
  let component;
  for (const statement of ast.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    const stmt = statement.declaration;
    if (!stmt) continue;
    if (stmt.type === 'FunctionDeclaration' && /^[A-Z]/.test(stmt.id?.name ?? '')) component ??= stmt.id.name;
    if (stmt.type === 'VariableDeclaration') for (const declaration of stmt.declarations) {
      if (declaration.id.type !== 'Identifier') continue;
      if (/^[A-Z]/.test(declaration.id.name)) component ??= declaration.id.name;
      const id = declaration.init && objectValue(declaration.init, 'id');
      if (id?.type === 'Literal' && typeof id.value === 'string' && id.value.startsWith('wp.component.')) specs.push({ specName: declaration.id.name, id: id.value });
    }
  }
  if (!specs.length) return null;
  if (specs.length !== 1 || !component) throw new Error(`Portable components need one exported spec with a literal wp.component ID and a named React export: ${path}`);
  const spec = specs[0];
  const slug = spec.id.slice('wp.component.'.length).replaceAll('.', '-');
  const props = {};
  // Include type declarations verbatim as the authoritative props contract.
  const source = readFileSync(path, 'utf8');
  for (const statement of ast.body) {
    const stmt = statement.declaration ?? statement;
    if (['TSTypeAliasDeclaration', 'TSInterfaceDeclaration'].includes(stmt.type) && /Props$/.test(stmt.id.name)) props[stmt.id.name] = source.slice(stmt.start, stmt.end);
  }
  return { ...spec, slug, exportName: component, name: slug.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '), path, props };
}
function references(path, source) {
  if (extname(path) === '.css') return [...source.matchAll(/(?:@import\s+["']([^"']+)["']|url\(\s*["']?([^)'"\s]+)["']?\s*\))/g)].map((m) => ({ value: m[1] ?? m[2], start: m.index + m[0].indexOf(m[1] ?? m[2]), asset: !m[1] }));
  if (!/\.[cm]?[jt]sx?$/.test(path)) return [];
  const ast = parse(path, source), refs = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) refs.push({
      value: node.source.value, start: node.source.start + 1,
      symbols: (node.specifiers ?? []).filter((s) => node.importKind !== 'type' && node.exportKind !== 'type' && s.importKind !== 'type' && s.exportKind !== 'type').map((s) => s.type === 'ImportDefaultSpecifier' ? 'default' : s.type === 'ImportNamespaceSpecifier' || s.type === 'ExportNamespaceSpecifier' ? '*' : (s.imported?.name ?? s.imported?.value ?? s.local?.name)),
      typeSymbols: (node.specifiers ?? []).filter((s) => node.importKind === 'type' || node.exportKind === 'type' || s.importKind === 'type' || s.exportKind === 'type').map((s) => s.imported?.name ?? s.imported?.value ?? s.local?.name ?? '*'),
      exportAll: node.type === 'ExportAllDeclaration',
      namespaces: (node.specifiers ?? []).filter((s) => s.type === 'ImportNamespaceSpecifier').map((s) => ({ start: s.start, end: s.end, local: s.local.name })),
    });
    if (node.type === 'ImportExpression') throw new Error(`Dynamic imports need an explicit portable adapter: ${path}`);
    if (node.type === 'NewExpression' && node.callee?.name === 'URL' && node.arguments[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string' && node.arguments[1]?.type === 'MemberExpression' && node.arguments[1].object?.type === 'MetaProperty') refs.push({ value: node.arguments[0].value, start: node.arguments[0].start + 1, asset: true });
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  return refs;
}
function resolveLocal(from, specifier) {
  const base = resolve(dirname(from), specifier);
  const path = [base, ...['.tsx', '.ts', '.jsx', '.js', '.mjs', '.css', '/index.tsx', '/index.ts', '/index.js'].map((ext) => base + ext)].find((file) => existsSync(file) && statSync(file).isFile());
  if (!path) throw new Error(`Missing portable dependency ${specifier} in ${from}`);
  return path;
}

// Build-time source inspection only. No agent, API, model, or generated prose.
export function portabilityPlugin() {
  let repo, aliases = [];
  return {
    name: 'whitepepper-portability',
    configResolved(config) { repo = resolve(config.root, '..'); aliases = config.resolve?.alias ?? []; },
    configureServer(server) {
      const refresh = (path) => {
        if (!path.startsWith(resolve(repo, 'demo')) || path.includes('/dist/')) return;
        const module = server.moduleGraph.getModuleById(internalId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh).on('unlink', refresh);
      server.httpServer?.once('close', () => { server.watcher.off('add', refresh).off('unlink', refresh); });
    },
    resolveId(id) { if (id === publicId) return internalId; },
    handleHotUpdate(context) {
      if (context.file.startsWith(resolve(repo, 'demo')) && !context.file.includes('/dist/')) {
        const module = context.server.moduleGraph.getModuleById(internalId);
        if (module) context.server.moduleGraph.invalidateModule(module);
        context.server.ws.send({ type: 'full-reload' });
      }
    },
    async load(id) {
      if (id !== internalId) return;
      const demo = resolve(repo, 'demo');
      const entries = walk(demo).filter((path) => /\.(?:[jt]sx?|mjs)$/.test(path)).map(discover).filter(Boolean).sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
      const lock = JSON.parse(readFileSync(resolve(repo, 'package-lock.json'), 'utf8'));
      this.addWatchFile(resolve(repo, 'package-lock.json'));
      const ids = new Set(), names = new Set(), slugs = new Set();
      const imports = [], collected = [], vendorImports = new Map(), vendorTypes = new Map();
      for (const [i, entry] of entries.entries()) {
        if (ids.has(entry.id) || names.has(entry.exportName) || slugs.has(entry.slug)) throw new Error(`Duplicate portable component ${entry.id}`);
        ids.add(entry.id); names.add(entry.exportName); slugs.add(entry.slug);
        const files = {}, packages = {}, seen = new Set();
        const externalRefs = [];
        const reactVersion = lock.packages?.['node_modules/react']?.version;
        if (!reactVersion) throw new Error('Portable React components require a locked React version.');
        packages.react = reactVersion;
        const target = (path) => `components/${entry.slug}/source/${slash(relative(demo, path))}`;
        function add(path) {
          if (seen.has(path)) return;
          seen.add(path);
          if (relative(demo, path).startsWith('..')) throw new Error(`Portable local imports must stay in demo/: ${path}`);
          if (relative(realpathSync(demo), realpathSync(path)).startsWith('..')) throw new Error(`Portable import symlink escapes demo/: ${path}`);
          thisPlugin.addWatchFile(path);
          const encoding = textExts.has(extname(path)) ? 'utf8' : 'base64';
          let content = readFileSync(path, encoding);
          if (encoding === 'utf8') {
            for (const ref of references(path, content).sort((a, b) => b.start - a.start)) {
              if (/^(?:https?:|\/\/)/.test(ref.value)) throw new Error(`Remote assets need a local portable copy: ${path}: ${ref.value}`);
              if (ref.value.startsWith('.') || (ref.asset && !/^(?:data:|#|\/)/.test(ref.value))) {
                const dependency = resolveLocal(path, ref.value);
                add(dependency);
                let replacement = posix.relative(posix.dirname(target(path)), target(dependency));
                if (!replacement.startsWith('.')) replacement = './' + replacement;
                // Preserve extensionless JS/TS imports for the host bundler.
                if (!extname(ref.value)) replacement = replacement.replace(/\.[cm]?[jt]sx?$/, '');
                content = content.slice(0, ref.start) + replacement + content.slice(ref.start + ref.value.length);
              } else if (!/^(?:https?:|data:|#)/.test(ref.value)) {
                if (ref.value.startsWith('/')) throw new Error(`Root-relative assets need a local portable import: ${path}: ${ref.value}`);
                const name = ref.value.startsWith('@') ? ref.value.split('/').slice(0, 2).join('/') : ref.value.split('/')[0];
                const version = lock.packages?.[`node_modules/${name}`]?.version;
                if (!version) throw new Error(`No locked runtime dependency for ${ref.value}`);
                packages[name] = version;
                if (!hostPackage(ref.value)) {
                  if (!/\.[cm]?[jt]sx?$/.test(path)) throw new Error(`External CSS dependencies need a portable adapter: ${ref.value}`);
                  vendorImports.set(ref.value, new Set([...(vendorImports.get(ref.value) ?? []), ...(ref.exportAll ? ['*'] : ref.symbols ?? [])]));
                  vendorTypes.set(ref.value, new Set([...(vendorTypes.get(ref.value) ?? []), ...(ref.typeSymbols ?? [])]));
                  externalRefs.push({ file: target(path), ...ref });
                }
              }
            }
          }
          files[target(path)] = { content, encoding };
        }
        const thisPlugin = this;
        add(entry.path);
        imports.push(`import { ${entry.specName} as spec${i} } from ${JSON.stringify(entry.path)};`);
        collected.push({ entry, files, packages, externalRefs, target: target(entry.path), specIndex: i });
      }
      const vendor = await buildVendorRuntime({ repo, imports: vendorImports, typeImports: vendorTypes, aliases });
      for (const path of vendor.watchFiles) this.addWatchFile(path);
      const payload = collected.map(({ entry, files, packages, externalRefs, target, specIndex }) => {
        // Reparse the final copied files so offsets stay correct after local import
        // rewrites. Replacements affect module specifiers only, never behavior.
        for (const path of new Set(externalRefs.map((ref) => ref.file))) {
          let source = files[path].content;
          const changes = [];
          for (const ref of references(path, source).filter((r) => vendor.entrypoints[r.value])) {
            let replacement = posix.relative(posix.dirname(path), vendor.entrypoints[ref.value]);
            if (!replacement.startsWith('.')) replacement = './' + replacement;
            changes.push({ start: ref.start, end: ref.start + ref.value.length, value: replacement });
            for (const namespace of ref.namespaces ?? []) changes.push({ start: namespace.start, end: namespace.end, value: `{ __whitepepper_vendor_namespace__ as ${namespace.local} }` });
          }
          for (const change of changes.sort((a, b) => b.start - a.start)) source = source.slice(0, change.start) + change.value + source.slice(change.end);
          files[path] = { content: source, encoding: 'utf8' };
        }
        const peers = Object.fromEntries(Object.entries(packages).filter(([name]) => hostPackage(name)));
        if (externalRefs.length) Object.assign(peers, vendor.runtime.peers);
        return `{...${JSON.stringify({ id: entry.id, slug: entry.slug, name: entry.name, exportName: entry.exportName, entry: target, files, packages: peers, props: entry.props, runtime: externalRefs.length ? vendor.runtime.id : null })},spec:spec${specIndex}}`;
      });
      return imports.join('\n') + '\nexport const vendorRuntime = ' + JSON.stringify({ runtime: vendor.runtime, files: vendor.files }) + ';\nconst catalogue = [' + payload.join(',\n') + '];\nObject.defineProperty(catalogue,"vendor",{value:vendorRuntime});\nexport default catalogue;';
    },
  };
}
