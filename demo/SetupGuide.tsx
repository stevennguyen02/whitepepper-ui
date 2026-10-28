import React from 'react';
import { StarterDownload, LocalLibraryInspector } from './ExportTools';

const kickoff = `Read whitepepper_ui/AGENTS.md and the local component registry.
Work inside this project's root folder.
Add the component from the export prompt below, preserving its selected settings.
Reuse the bundled runtime, then refresh the registry and identifier tree.

[Paste the complete component export prompt here]`;

export function SetupGuide() {
  return <section className="setup-guide" id="get-started" aria-labelledby="setup-title">
    <div className="setup-intro">
      <h2 id="setup-title">Your project. Your agent.<br /><span>A little White Pepper.</span></h2>
      <p>Start with a folder. Add the components you like. Give your agent a library it can keep building on.</p>
      <StarterDownload />
      <p className="setup-requirement">For React projects. Includes the shared runtime, agent instructions and registry tools, with no components added yet.</p>
    </div>

    <article className="setup-step setup-project">
      <div className="setup-step-copy">
        <h3>Put the folder at your project’s root.</h3>
        <p>Extract the download and move <code>whitepepper_ui/</code> beside <code>package.json</code>, outside your <code>src/</code> folder.</p>
        <pre className="setup-project-tree" aria-label="Example project folder structure"><code>{`my-project/
├── src/
│   └── App.tsx
├── public/
├── `}<strong>whitepepper_ui/</strong>{`
│   ├── AGENTS.md
│   ├── components/     # empty to start
│   ├── vendor/
│   └── registry.json
├── AGENTS.md
└── package.json`}</code></pre>
        <p>Your project supplies React and ReactDOM. Base UI and Motion are included in the folder.</p>
      </div>
      <figure className="setup-shot"><a href="/setup/project-folder@2x.png" target="_blank" rel="noreferrer" aria-label="Open full-size setup screenshot"><img src="/setup/project-folder@2x.png" alt="An example project with AGENTS.md, package.json, public, README.md, src and whitepepper_ui together in its root folder" loading="lazy" width="701" height="301" /></a><figcaption>The starter lives inside your project. Its components folder begins empty.</figcaption></figure>
    </article>

    <article className="setup-step setup-export">
      <div className="setup-step-copy"><h3>Choose the details. Take the prompt.</h3><p>Set a component’s color, speed or style in its preview. Open <strong>Prompt exportable</strong> underneath it and choose <strong>Download export prompt (.md)</strong>.</p><p>The prompt carries those exact settings, the component source and instructions for adding it to the starter folder you downloaded.</p><a className="setup-text-link" href="#components">Choose a component <span aria-hidden="true">↗</span></a></div>
      <figure className="setup-shot"><a href="/setup/export-prompt@2x.png" target="_blank" rel="noreferrer" aria-label="Open full-size setup screenshot"><img src="/setup/export-prompt@2x.png" alt="The Button export panel with its feature identifiers, a Download export prompt (.md) action and the generated prompt preview" loading="lazy" width="799" height="600" /></a><figcaption>Export from the component’s own preview so your chosen settings come with it.</figcaption></figure>
    </article>

    <article className="setup-step setup-agent">
      <div className="setup-step-copy"><h3>Open your project in your favorite agent.</h3><p>Choose <code>my-project/</code> as the working folder, with <code>package.json</code> and <code>whitepepper_ui/</code> inside it.</p><p>In Codex, use <strong>+</strong> beside the message box to attach the downloaded <code>.md</code> file. You can also paste the file’s complete contents into your coding agent.</p><p>The agent adds the component, checks it in your project and refreshes the local registry. White Pepper does not need a connection to your agent.</p></div>
      <div className="setup-handoff"><figure className="setup-shot"><a href="/setup/codex-attachment@2x.png" target="_blank" rel="noreferrer" aria-label="Open full-size Codex attachment screenshot"><img src="/setup/codex-attachment@2x.png" alt="Codex message composer with a White Pepper component Markdown file attached and the plus attachment control visible" loading="lazy" width="849" height="242" /></a><figcaption>Use + to attach the exported Markdown file, then give your agent the task.</figcaption></figure><div className="setup-agent-note"><h4>Give the agent its starting context.</h4><pre><code>{kickoff}</code></pre><p>Replace the bracketed line with the full exported prompt, or attach its Markdown file. A description of the component alone does not include its source.</p></div></div>
    </article>

    <article className="setup-step setup-identifiers">
      <div className="setup-step-copy"><h3>A library your next prompt can remember.</h3><p>Each component carries stable identifiers for its shape, style and animation. The registry and tree show what is actually available in your local folder, including related components and their shared runtime.</p></div>
      <div className="setup-screenshot-grid"><figure className="setup-shot"><a href="/setup/component-identifiers@2x.png" target="_blank" rel="noreferrer" aria-label="Open full-size setup screenshot"><img src="/setup/component-identifiers@2x.png" alt="Attention cue identifiers showing the component, border style and orbit glow animation IDs" loading="lazy" width="738" height="160" /></a><figcaption>Ask for a specific feature by its identifier, such as <code>wp.animation.attention-cue.orbit-glow</code>.</figcaption></figure><figure className="setup-shot"><a href="/setup/local-library-tree@2x.png" target="_blank" rel="noreferrer" aria-label="Open full-size setup screenshot"><img src="/setup/local-library-tree@2x.png" alt="A local White Pepper registry containing an Attention cue, its Button dependency and their feature identifiers" loading="lazy" width="784" height="484" /></a><figcaption>An example library after adding Attention cue. Its button dependency is recorded too.</figcaption></figure></div>
      <div className="setup-tree-context"><p>Tell your agent to read <code>whitepepper_ui/AGENTS.md</code>, <code>registry.json</code> and <code>COMPONENT_TREE.md</code> before the next UI task.</p><p>After changes, it runs <code>node whitepepper_ui/scripts/rebuild-registry.mjs</code>. The tree grows with your components, so future work can reuse what is already there.</p></div>
      <LocalLibraryInspector />
    </article>
  </section>;
}
