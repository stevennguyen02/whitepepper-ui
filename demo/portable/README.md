# whitepepper_ui

A portable, growing component folder for your coding agent. Start with no components, import
exact components from White Pepper UI, and keep their IDs and source discoverable.

1. Extract `whitepepper_ui/` into your React project's root. Keep the folder if it
   already exists and merge additions instead of replacing it.
2. Ask your agent to read `whitepepper_ui/AGENTS.md` and add a pointer to that file
   in your project's existing agent instructions.
3. Select a component in the catalogue, open **Prompt exportable**, then choose
   **Download export prompt (.md)**. Attach the file or paste its complete contents
   into your agent. It includes code and selected props.
4. After imports/changes, run `node whitepepper_ui/scripts/rebuild-registry.mjs`.
5. Ask for new interfaces using `registry.json` and `COMPONENT_TREE.md` as context.

Read `ORCHESTRATION.md` for the complete workflow and framework notes. This folder
does not connect to an agent or install OpenUI. Base UI, Motion and their required
runtime code and types are included in `vendor/`; do not install those packages.
The destination project supplies React/ReactDOM and React types. No local upstream
clones are needed. The starter contains zero components and a shared runtime.

Component export prompts require this matching starter to be downloaded first.
They add component source and reuse this folder’s runtime and setup files.
Runtime content IDs prevent an import from silently replacing an older version.

The catalogue's **Load registry.json** control displays your local inventory as a
manual snapshot. Exporting a prompt alone does not update or install local files.
