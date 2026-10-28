# White Pepper UI

A workspace for building a web UI library. The local catalogue is where we preview and document components as we make them.

## Set up and run

You need Git, Node.js 22.12 or newer, and npm. From a fresh checkout, first clone the upstream libraries at the versions used by this project:

```sh
git clone https://github.com/mui/base-ui.git base-ui
git -C base-ui checkout cc9075a414c93577a10b3085dbc5f122ea2fe564

git clone https://github.com/motiondivision/motion.git motion
git -C motion checkout 9ba8846b6819172cb829e65a9f46433a4de377ab

git clone --filter=blob:none --sparse https://github.com/thesysdev/openui.git openui
git -C openui sparse-checkout set packages/react-lang packages/lang-core packages/observability
git -C openui checkout f08a660535e55b5b2a24a0eb68568edaf9e4fe4b
```

These local checkouts are ignored by the root repository and have independent Git histories. The application imports source from Base UI and OpenUI; Motion is currently used via its npm package. The Motion clone is retained for local development but is not required to run the catalogue.

Install the project dependencies and start the development server:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite in your browser (normally [http://localhost:5173](http://localhost:5173)). Stop the server with `Ctrl+C`. Run `npm run typecheck` to check the React TypeScript sources and `npm run build` to type-check and build the catalogue. The frontend supports TypeScript/TSX, JavaScript/JSX, HTML, CSS, and Tailwind CSS utilities. Tailwind’s preflight reset is disabled so existing styles remain intact. For the Play agent, see the OpenRouter setup below.

The catalogue lives in `demo/`. Matching published Base UI and OpenUI packages supply TypeScript declarations; Vite runs the actual components and renderer from the local clones. Its button uses the local Base UI clone and the open-source Motion npm package; the agent renderer uses the local OpenUI clone.

## Workspace

- `demo/` contains the local catalogue.
- `base-ui/` is a local clone of [Base UI](https://github.com/mui/base-ui), an unstyled React component library.
- `motion/` is a local clone of [Motion](https://github.com/motiondivision/motion), an animation library.
- `openui/` is a sparse local clone of [OpenUI](https://github.com/thesysdev/openui), containing the React language renderer, language core, and required observability event bus.

The clones retain their own Git histories, upstream remotes, and license files. They are separate repositories; changes within them are managed independently. Base UI, the open-source Motion library, and OpenUI are MIT licensed. See their respective license files when using or distributing their code.

## Agent-readable components

White Pepper UI gives components and their meaningful features stable, descriptive IDs so people can refer to the same design choices in prompts and code. The catalogue displays the IDs for the selected preview. Each component owns and exports its feature metadata alongside its implementation; `buttonSpec` in `demo/JellyButton.tsx` is the button’s source of truth.

The Button exposes `wp.component.button`, `wp.shape.pill`, `wp.animation.jello-click`, and one of `wp.style.button.bright-blue` or `wp.style.button.dark-outline`. For example: “Use `wp.component.button` with `wp.style.button.dark-outline` and `wp.animation.jello-click`.” The animation is skipped when reduced motion is requested.

The rendered element exposes these IDs as `data-wp-component`, `data-wp-shape`, `data-wp-animation`, and `data-wp-style`. These are reusable feature identifiers, not HTML `id` values: multiple instances may share them. The style attribute reflects the selected variant. When a user likes a newly customized attribute, an agent should offer to give that specific attribute a reusable ID. Once the user agrees or explicitly requests it, the agent records the ID, label, and description in the component's metadata, connects it to the actual implementation, and makes it discoverable in the catalogue. For example, a saved new button style might get `wp.style.button.ocean-blue`.

Keep existing IDs stable and preserve their meaning. A distinct saved look or behavior gets a new ID; don't silently reuse an old ID for a materially different design. IDs describe real, selectable or active features, not individual CSS properties by default. They are not yet a general-purpose configuration API. See `AGENTS.md` for the agent workflow.

## Dialog preview

The catalogue includes `wp.component.dialog` and its `wp.animation.dialog.reshape` transition, with `wp.style.dialog.bright-blue` and `wp.style.dialog.dark-outline` styles. The trigger can be any button-compatible React element that forwards its ref and passed props to the activating DOM element. The dialog measures that element and reshapes from its bounds, background, and corner radius. `wp.direction.expand` grows around the trigger; `wp.direction.clock.1` through `wp.direction.clock.12` grow toward that hour. Placement is kept inside the viewport where possible, so near an edge it may be adjusted. Reduced-motion settings skip the transition.

## Card preview

The catalogue includes `wp.component.card`, a `wp.shape.rectangle` card (300×190 by default; set `width` and `height` in pixels) with the `wp.animation.card.spin-in` entrance, in `wp.style.card.bright-blue` or `wp.style.card.dark-outline`. It appears as a small rounded square and grows as if pulled from its bottom-right corner, while turning a quarter turn counterclockwise into place. It overshoots its resting angle, bounces back and settles. Its content fades in at the end. The animation is skipped when reduced motion is requested. `cardSpec` in `demo/Card.tsx` is the card's source of truth.

## Attention cue preview

`wp.component.attention-cue` wraps a button or other component to draw attention to it. Its `wp.style.attention-cue.border` style draws a ring just outside the wrapped component; `wp.animation.attention-cue.orbit-glow` gives the ring a soft, breathing glow and a brighter light of the same color that circles it. Set `color` to a hex value (`#rgb` or `#rrggbb`; invalid values fall back to `#0061e8`), `spinDuration` to the seconds per turn (lower is faster), and `radius` and `offset` in pixels to match the wrapped component's corners (999 suits pill buttons). The rendered wrapper exposes `data-wp-color` and `data-wp-spin-duration` alongside its feature IDs. The light stops circling when reduced motion is requested. `attentionCueSpec` in `demo/AttentionCue.tsx` is the source of truth.

## OpenUI integration

`demo/agent-library.tsx` registers the existing White Pepper button and dialog with OpenUI and exports `agentLibrary` and `agentSystemPrompt`. Component style and direction options use their `wp.*` IDs. The `WhitePepperScreen` root exposes two named regions (`main` and `side`); the host application decides what each region means and where it appears.

`AgentScreen` in `demo/AgentPreview.tsx` accepts `response`, `isStreaming`, `onAction`, and `onError`, so a host can pass OpenUI Lang from an agent or model stream to the renderer. The Play page can use Ollama or OpenRouter through the local agent backend, or another compatible agent endpoint and render its OpenUI response. The example button jiggles and the example dialog opens fixed sample content; application actions are not yet implemented. The integration uses local OpenUI source; it does not use OpenUI's prebuilt visual component library or a hosted gateway.

## Connect Play to an agent

### Use Ollama or OpenRouter locally

Start the catalogue and agent server in separate terminals:

```sh
npm run dev
```

```sh
npm run agent
```

In **Play → Connect agent**, choose **Ollama** and enter an installed model. The default is `gemma4:e2b`, served at `http://127.0.0.1:11434`. Start Ollama and install the model before sending prompts. To use an Ollama server at another address, set `OLLAMA_HOST` in the agent server's environment before starting it.

To use **OpenRouter**, select it in Play and enter your API key in the password field, or set `OPENROUTER_API_KEY` in the agent server's environment. A key entered in Play is held in page memory and sent to the local agent server with each request; it is never saved to disk. Don't paste a key into chat or a URL. The default model is `openrouter/auto`; usage can incur charges. You can enter another OpenRouter model in Play.

Both options use the local agent endpoint at `http://127.0.0.1:3001/chat`; the agent server forwards prompts and context to the selected provider. It is a local development endpoint, not a production server. Stop either server with `Ctrl+C`.

### Use another endpoint

Choose Play and select **Connect agent**. Enter an HTTPS URL or a local HTTP URL for a backend you control. The address stays in the current page session and is not saved to disk. The browser sends prompts and the generated White Pepper system instructions to that endpoint; configure CORS on the endpoint if it uses a different origin. Never put a model API key in the URL or browser code.

A compatible endpoint receives a JSON `POST` with this shape (the local agent also accepts `provider`, `model`, and an optional `apiKey`):

```json
{
  "messages": [{ "role": "user", "content": "Spawn a button in the main region" }],
  "systemPrompt": "<generated OpenUI instructions>"
}
```

It returns a JSON object with a conversational `message` and an OpenUI Lang `output`:

```json
{
  "message": "Here is a button.",
  "output": "root = WhitePepperScreen([item], [])\nitem = WhitePepperButton(\"Hello\", \"wp.style.button.bright-blue\")"
}
```

The backend is responsible for calling an agent or model and protecting its credentials. Play also sends the current OpenUI program as `currentOutput` so the agent can preserve or modify it on follow-up turns. Play currently accepts a complete JSON response, not streamed responses. The available generated components, style IDs, and screen regions are defined in `demo/agent-library.tsx`.

## Portable component prompts and starter folder

Every component is **Prompt exportable**. Select its style and controls, then
choose **Download export prompt (.md)**. It carries actual source,
CSS, types, stable feature IDs, selected props, local dependencies and import steps
for an agent working in another project. Prompts are always procedural; this
feature never calls an agent or model.

Choose **Get started** beside **Explore components** on Browse to jump to the
setup walkthrough at the bottom of the page. Download the empty `whitepepper_ui/`
starter there, extract it beside your project’s `package.json` (outside `src/`),
and open that project root in your coding agent. Download a component’s export
prompt, then attach the Markdown file or paste its complete contents. The walkthrough includes real screenshots
of folder placement, prompt export and the growing identifier tree, plus
instructions for attaching the Markdown file in Codex.
The starter includes agent instructions, a registry and a growing component tree. The agent stores
components in `whitepepper_ui/components/` and runs the included registry rebuild
script after changes. No OpenUI install, upstream clones or catalogue backend is
needed. Base UI, Motion and their transitive runtime dependencies now ship locally
in `vendor/`. The destination supplies React/ReactDOM and their type declarations.
Component prompts reuse the matching runtime from the dedicated starter download;
they do not include runtime or setup files. Download and extract the starter first.
The registry rebuild verifies runtime file checksums.

Future components with the standard component-owned `wp.component.*` spec are
automatically discovered by the source exporter. Each preview exposes
**Prompt exportable** with its selected settings; there is no per-component prompt
to author. The setup download is a starter with zero components and all shared
runtime/instructions. The optional **Inspect your local registry** disclosure at
the end of the walkthrough loads a destination project’s `registry.json` to view
a manual snapshot of its local tree; agents use the local files directly.

See [the export architecture and contribution contract](docs/prompt-exports.md).
Run `npm run test:exports` for procedural export, ZIP and registry checks.
