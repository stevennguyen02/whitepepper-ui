# White Pepper UI agent conventions

White Pepper UI is agent-readable first. Make meaningful component features discoverable through stable identifiers and component-owned metadata.

When a user expresses that they like a newly customized component attribute and want to preserve it, offer to create an identifier for that specific attribute. Ask which attribute if their intent is unclear. If they explicitly request an identifier, create it without asking again. Do not interrupt every exploratory adjustment with an identifier question.

When saving an identified feature:

- Choose a descriptive, unique ID in the existing `wp.<category>...` convention. Reuse a matching ID only when it represents the same feature; preserve the meaning of existing IDs. A materially different saved feature needs a new ID and must not silently replace an existing one.
- Put the ID, human-readable label, and a concise description of the feature in metadata exported from the component's own source file. Include the actual implementation and any variant selection needed to reproduce it; metadata alone does not save a design.
- Expose active feature IDs through appropriate `data-wp-*` attributes and show them in the catalogue. Feature IDs can be shared by instances; do not use them as unique HTML `id` attributes.
- Document any new category or usage needed to find and apply the feature. Verify the selected feature, metadata, rendered attributes, and catalogue stay in sync.

These conventions apply to this project's code. The `base-ui/` and `motion/` directories are independent upstream clones with their own instructions; avoid modifying them solely to implement this convention.

## Procedural exports are a built-in component feature

Every new component must follow the discoverable component-owned spec convention
and be portable by default. Do not hand-author a prompt or call a model to make
one. The source-inspection Vite plugin automatically finds named React exports
with a single literal `wp.component.*` spec and makes their source available to
component-level export controls. Keep one public component per source file. Import its own CSS and use
relative local imports/assets so the full source closure can be exported.

Keep serializable defaults and example props/children/slots in the spec's
`portability` metadata. Supply required props there so the generated Example.tsx
works. Declare related component IDs for cross referencing. Never put application
secrets or private data in component examples. New catalogue previews also use
`ComponentExport` with their selected props alongside identifiers.

Read `docs/prompt-exports.md` for the contract. Run `npm run test:exports` and
`npm run build` after component changes. Verify the component is automatically
discovered, its example type checks, and source/CSS/assets/dependencies are complete.
Preserve source IDs and reduced-motion/accessibility behavior in exported code.

Exports bundle third-party runtime code and type declarations with the catalogue's
actual resolution aliases. React and ReactDOM remain host peers. Preserve the
local vendor imports, immutable runtime IDs and package license files. The dedicated
starter download contains the complete runtime and setup. Each component has one
Markdown prompt download that reuses that starter, without embedding runtime or
setup files. Verify exports in the host-only dependency fixture, and keep
runtime checksum checks and version references synchronized with the registry.
