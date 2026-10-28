# Procedural component exports

Prompt exporting is built into the catalogue and works offline after the page is
loaded. It never calls an agent, Play, Ollama, OpenRouter or any model endpoint.

## Source discovery, including future components

`portability-plugin.mjs` inspects React TS/TSX/JS/JSX source under `demo/` at build/dev
time. Each component follows the existing White Pepper convention: export one
component-owned object with a literal `id: 'wp.component.<slug>'` and a named React
component. The first exported capitalized function/value is the public component.
Keep one public component per source file; colocated helpers may be unexported.
Keep the spec initializer as an object literal so source inspection can find it.

The plugin discovers these sources without a central list. It follows relative
imports/re-exports, CSS imports and local CSS URLs, includes text or base64 assets,
and resolves external package versions from `package-lock.json`. It rejects
missing dependencies, dynamic imports, root-relative assets and imports escaping
`demo/` rather than silently exporting an incomplete bundle. Component CSS should
be imported by its source. Remote assets must be copied into a local imported file
before the component can be exported. Specs may use `as const` or `satisfies`.

Discovered source is available to each component preview through
`<ComponentExport id={spec.id} selection={{ ...currentPreviewProps }} />`. Every
preview, including future components, must use this control alongside identifiers
so its current settings are exported. There is no per-component prompt text to
write and no runtime agent to connect.

Browse’s hero **Get started** link jumps to a setup walkthrough after the component
collection. Its download contains the starter folder with no components, plus the
shared runtime, agent instructions and registry tools. Extract `whitepepper_ui/`
beside the destination project’s `package.json`, outside `src/`, then open that
project root in a coding agent. Each preview has one **Download export prompt (.md)**
action. Attach that file to the agent or paste its complete contents. Component
exports reuse the downloaded starter; runtime and setup files are not in prompts.
The walkthrough’s optional registry inspector only reads a local snapshot; it is
not required for installation or agent context.

## Component-owned example data

The spec's optional `portability` field contains data, never prompt prose:

```tsx
export const exampleSpec = {
  id: 'wp.component.example',
  portability: {
    defaults: { variant: 'blue' },
    example: { children: 'Example content' },
    related: ['wp.component.button'],
  },
  // Stable shape, style and animation metadata...
};
```

`defaults` supplies serializable selected props. `example` supplies `props`,
`children`, or React-valued `slots`. A nested node refers to another discovered
component with `componentId`; `$variant` references the parent selection. The
generator follows those references and includes the example's component closure.
Supply values for required props and slots in this data so the exported example
type checks. If no example is supplied, an empty instance is generated; this is
sufficient only for components that have no required props. Source types remain
the authoritative API. Never include credentials or application data in defaults.

The serializer emits ordinary JSX. Event handlers and HTML injection props are
not supported in the serializable example data. Keep application behavior in the
destination project's code. Keep saved IDs and `data-wp-*` attributes in sync.

## Packaging and local context

`demo/export-kit.mjs` interpolates fixed instructions and source data. It includes
the selected props, exact CSS/keyframes, source types, feature IDs, locked runtime
versions and instructions to use the starter’s setup scripts. It does not install anything. External library imports
are rewritten to the matching `whitepepper_ui/vendor/runtime-<content-id>/` entry.
The host supplies React/ReactDOM and React type declarations. Base UI, Motion and
their transitive libraries are compiled and shipped locally. OpenUI, Tailwind, Vite, upstream clones and the
catalogue agent server are not needed in the destination project.

The setup download is a real ZIP with an empty `whitepepper_ui/` folder structure,
the shared dependency runtime, agent instructions, an orchestration contract, registry schema, scoped baseline,
rebuild script, registry, readable tree, Mermaid graph and import index. Download it
first, then use component Markdown prompts to add source. Preserve existing
components when merging any updated starter files.

Manifests own local state. `rebuild-registry.mjs` validates identities, feature IDs,
file paths, relationships, required files, vendor SHA-256 checksums and symlink containment before writing
any generated inventory. It scans all component folders so additions accumulate.
An existing component with the same ID but different code must be reconciled by
the destination agent; blindly overwriting it is forbidden by the fixed prompt.

Browse's registry upload validates and displays a manual snapshot. The catalogue
does not watch your local disk, mark copied prompts as installed, persist the
snapshot between page loads, or send it to a backend. Host agent instructions
must point to `whitepepper_ui/AGENTS.md` so future agents discover the library.

This file workflow borrows OpenUI's component registry and constrained composition
pattern. It does not implement its language parser, streaming renderer or runtime
actions. See [the OpenUI component model](https://www.openui.com/docs/openui-lang/defining-components).

## Verification

Run `npm run test:exports` and `npm run build`. Tests exercise source discovery,
generated JSX/relative imports, selected props, dependency closure, real ZIP
extraction and CRC validation, registry growth, invalid imports and safe failures.
Use Browse to verify prompt downloads and registry snapshot controls at desktop and
mobile widths. New components must be included in these generic export checks.

## Bundled dependency runtime

`vendor-runtime.mjs` builds the exact runtime resolved by the catalogue, preserving
its Base UI source aliases and locked Motion version. It bundles only referenced
entry exports and their transitive JavaScript. React and ReactDOM stay external so
hooks, portals and rendering use the host's existing React copy. Required published
declaration files are copied transitively with rewritten local imports; comments
are removed to reduce size, while package license notices are retained separately.
No broad `any` declarations or reimplementations replace the upstream API.

The runtime directory ID hashes its package versions, host peer versions,
entrypoints and every runtime/type/license file checksum. The same bundle is shared
across component exports and included in the starter. A new runtime gets a new ID;
old IDs remain usable alongside it. Component manifests record their runtime ID,
and the generated registry/tree/graph show both components and local runtimes.
The rebuild script checks all runtime identities, paths and SHA-256 file hashes
before rewriting any inventory. Missing, modified or mismatched runtimes fail.

Component prompts include complete component source, styles, selected props and
metadata, and require the matching starter to have been downloaded and extracted.
They explicitly stop the import when that prerequisite is missing. Runtime files,
setup files and generated inventories are excluded from prompts. Only the dedicated
starter ZIP ships the runtime and setup. There is no standalone prompt mode or
per-component ZIP download. No CDN, install command or agent-generated dependency
replacement is used.

A host-only fixture in `npm run test:exports` has React/ReactDOM and their types but
no Base UI, Motion or Floating UI packages. It type checks exported examples with
library checking enabled and builds an exported dialog. Further tests reject
non-React bare imports and tampered runtime files. The catalogue still uses its
normal dependencies for authoring; the install-free contract applies to exports.

## Setup walkthrough screenshots

`demo/SetupGuide.tsx` documents the root folder, selected-settings export, agent
handoff and identifier workflow. Its screenshots in `demo/public/setup/` capture
a disposable `my-project/` example in Finder, the single catalogue export control
and a rebuilt two-component registry. The Codex attachment screenshot is supplied
by the user; it shows the Markdown file in the message composer. The screenshots
are static documentation images, not a connected agent or an automatic install
status. The Attention cue example uses `color: "#f80"` and `spinDuration: 1.6`; its
Button dependency appears in the local tree. Update the screenshots when these
flows change. Each screenshot links to its original size for inspection.
