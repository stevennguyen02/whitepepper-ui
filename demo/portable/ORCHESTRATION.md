# Compose UI from a growing local library

This workflow provides the useful catalogue, constrained selection and shared
context pattern of OpenUI to a coding agent working in your project. It uses
ordinary React/TSX and static files. It does not reproduce OpenUI's language
parser, streaming renderer, schema repair, model connection or runtime actions.
No OpenUI package or upstream clone is needed for this workflow.

## Start a task

Paste this into your coding agent:

> Read `whitepepper_ui/AGENTS.md`, `whitepepper_ui/ORCHESTRATION.md`,
> `whitepepper_ui/registry.json` and `whitepepper_ui/COMPONENT_TREE.md`.
> Inspect relevant source and manifests before composing UI. Reuse available
> component and feature IDs, keep their actual behavior, and implement ordinary
> React in this project's framework. Register additions and refresh the tree.
> My UI task is: [describe the interface here].

The host project's agent instructions should link to `whitepepper_ui/AGENTS.md`.
This is a deliberate setup step: a nested instructions file is not automatically
read by every agent for edits elsewhere in a project.

## Import a component

Download and extract this starter at the destination project's root. In the White
Pepper catalogue, select the desired style/direction/color/speed, then choose
**Prompt exportable → Download export prompt (.md)**. Attach the Markdown file or
paste its complete contents into your coding agent with access to that project. The prompt includes
the actual source, CSS, feature metadata, a selected-props example, transitive
example components and the content ID of its bundled dependency runtime.

The prompt reuses the matching runtime from the dedicated starter download. It
contains component files only. Download and extract the starter before importing
components; if the required runtime is missing, stop and request the matching
starter from Get started. Merge it while preserving existing components.

The agent merges files into `whitepepper_ui/`, reuses the bundled runtime, mounts
and verifies the example, and rebuilds the registry. Base UI, Motion and their
transitive packages require no destination installation. The host supplies React,
ReactDOM and their type declarations.
Do not replace an existing folder with a fresh starter: that would lose history.

## Local source contract

- `registry.json` lists only components actually present in this folder.
- `components/<slug>/manifest.json` owns the component's identity, source paths,
  feature metadata, props/defaults, dependencies and cross references.
- `components/<slug>/Example.tsx` records the exported selection. It is a working
  example, not a general application action handler.
- `tokens.css` supplies scoped baseline typography and box sizing. Exported source
  carries its imported baseline with it; keep that copy in sync when changing
  shared tokens. Keep host resets from overriding these component rules.
- `vendor/runtime-<content-id>/` contains compiled dependency code, declarations,
  licenses and an integrity manifest. These directories are immutable and shared
  by components. Keep older directories while components still reference them.
- `index.ts` exports registered components using paths relative to this directory.
- `COMPONENT_TREE.md` is a readable inventory with feature IDs and relationships.
- `component-tree.mmd` is the same inventory as a Mermaid dependency graph.

After each addition or change, run:

```sh
node whitepepper_ui/scripts/rebuild-registry.mjs
```

The script validates manifests, checks files/relationships and runtime SHA-256 checksums, and
regenerates the inventory deterministically without installing anything. It also
works when this folder sits under `src/`; pass its actual path to Node. Source
imports in the host use that same actual location.

## Share local context with the catalogue

The catalogue cannot watch your disk and has no connected agent. Use **Load
registry.json** on the home page to inspect a snapshot after the agent rebuilds
your folder. Reload the file after later edits. This snapshot stays in the page
session and is never a claim that a prompt export installed a component.

## Framework and fidelity

The supplied components target React 19, TypeScript and browser CSS. Vite needs
no aliases to upstream clones. Next.js consumers retain the supplied `use client`
boundaries and may need to move global CSS imports to a permitted application
entry point. Other frameworks require a deliberate port and visual verification;
do not claim byte-for-byte behavior after an unverified rewrite. Keep peer
versions compatible with the host; do not force a major upgrade without need.

Exact implementations and selected props are provided. Host resets, inherited
styles, browser rendering and host React versions can still change appearance.
Compare the result with the catalogue and report any differences.

Reference: [OpenUI custom component and library model](https://www.openui.com/docs/openui-lang/defining-components).
