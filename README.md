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

## OpenUI integration

`demo/agent-library.tsx` registers the existing White Pepper button and dialog with OpenUI and exports `agentLibrary` and `agentSystemPrompt`. Component style and direction options use their `wp.*` IDs. The `WhitePepperScreen` root exposes two named regions (`main` and `side`); the host application decides what each region means and where it appears.

`AgentScreen` in `demo/AgentPreview.tsx` accepts `response`, `isStreaming`, `onAction`, and `onError`, so a host can pass OpenUI Lang from an agent or model stream to the renderer. The Play page can use the local OpenRouter backend or another compatible agent endpoint and render its OpenUI response. The example button jiggles and the example dialog opens fixed sample content; application actions are not yet implemented. The integration uses local OpenUI source; it does not use OpenUI's prebuilt visual component library or a hosted gateway.

## Connect Play to an agent

### Use OpenRouter locally

Create an API key in [OpenRouter](https://openrouter.ai/settings/keys). In a separate terminal, from this project directory, run the following; paste your key only into the hidden terminal prompt, never into the browser or chat:

```sh
read -s "OPENROUTER_API_KEY?OpenRouter API key: "
export OPENROUTER_API_KEY
npm run agent
```

Keep that terminal running. In another terminal run `npm run dev`, open the catalogue, select **Play**, choose **Connect agent**, and save the prefilled `http://127.0.0.1:3001/chat` endpoint. Prompts and conversation context are sent to OpenRouter. The local server is bound to loopback and the key stays in the server environment. Stop it with `Ctrl+C`.

The default model is `openrouter/auto`; OpenRouter chooses a model and usage can incur charges. To use a specific model, set `OPENROUTER_MODEL` before running `npm run agent`, for example `export OPENROUTER_MODEL="provider/model"`. The selected model must support JSON output. This is a local development endpoint, not a production server.

### Use another endpoint

Choose Play and select **Connect agent**. Enter an HTTPS URL or a local HTTP URL for a backend you control. The address stays in the current page session and is not saved to disk. The browser sends prompts and the generated White Pepper system instructions to that endpoint; configure CORS on the endpoint if it uses a different origin. Never put a model API key in the URL or browser code.

The endpoint receives a JSON `POST` with this shape:

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
