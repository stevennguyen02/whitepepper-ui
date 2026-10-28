import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JellyButton, buttonSpec, type ButtonStyle } from './JellyButton';
import { ReshapeDialog, dialogSpec } from './ReshapeDialog';
import { Card, cardSpec, type CardStyle } from './Card';
import { AttentionCue, attentionCueSpec, isHexColor } from './AttentionCue';
import { Play } from './Play';
import { ComponentExport } from './ExportTools';
import { SetupGuide } from './SetupGuide';

function ButtonCatalogue() {
  const [style, setStyle] = useState<ButtonStyle>('blue');

  return (
    <article className="component-entry">
      <div className="component-description">
        <h3>Button</h3>
        <p>A pill button with a little bounce.</p>
      </div>
      <div>
        <div className={`preview-area ${style === 'dark' ? 'preview-area-dark' : ''}`}>
          <JellyButton variant={style}>Make it happen</JellyButton>
        </div>
        <fieldset className="style-options">
          <legend>Style</legend>
          <label><input type="radio" name="button-style" value="blue" checked={style === 'blue'} onChange={() => setStyle('blue')} /> <span>Bright blue</span></label>
          <label><input type="radio" name="button-style" value="dark" checked={style === 'dark'} onChange={() => setStyle('dark')} /> <span>Dark outline</span></label>
        </fieldset>
        <div className="feature-ids" aria-label="Button identifiers">
          <h4>Identifiers</h4>
          <dl>
            <div><dt>Component</dt><dd><code>{buttonSpec.id}</code></dd></div>
            <div><dt>Shape</dt><dd><code>{buttonSpec.shape.id}</code></dd></div>
            <div><dt>Animation</dt><dd><code>{buttonSpec.animation.id}</code></dd></div>
            <div><dt>Style</dt><dd><code>{buttonSpec.styles[style].id}</code></dd></div>
          </dl>
        </div>
        <ComponentExport id="wp.component.button" selection={{ variant: style, shape: 'pill' }} />
      </div>
    </article>
  );
}

function DialogCatalogue() {
  const [direction, setDirection] = useState('expand');
  const [style, setStyle] = useState<ButtonStyle>('blue');
  return (
    <article className="component-entry">
      <div className="component-description"><h3>Dialog</h3><p>A dialog that grows from its trigger.</p></div>
      <div>
        <div className={`preview-area ${style === 'dark' ? 'preview-area-dark' : ''}`}>
          <ReshapeDialog direction={direction} variant={style} trigger={<JellyButton variant={style} shape="square">Open</JellyButton>} />
        </div>
        <fieldset className="style-options">
          <legend>Style</legend>
          {Object.entries(dialogSpec.styles).map(([key, option]) => <label key={key}><input type="radio" name="dialog-style" value={key} checked={style === key} onChange={() => setStyle(key as ButtonStyle)} /> <span>{option.label}</span></label>)}
        </fieldset>
        <div className="direction-options">
          <label htmlFor="dialog-direction">Reshape direction</label>
          <select id="dialog-direction" value={direction} onChange={(event) => setDirection(event.target.value)}>
            {Object.entries(dialogSpec.directions).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
          </select>
        </div>
        <div className="feature-ids" aria-label="Dialog identifiers">
          <h4>Identifiers</h4><dl>
            <div><dt>Component</dt><dd><code>{dialogSpec.id}</code></dd></div>
            <div><dt>Animation</dt><dd><code>{dialogSpec.animation.id}</code></dd></div>
            <div><dt>Style</dt><dd><code>{dialogSpec.styles[style].id}</code></dd></div>
            <div><dt>Direction</dt><dd><code>{dialogSpec.directions[direction].id}</code></dd></div>
          </dl>
        </div>
        <ComponentExport id="wp.component.dialog" selection={{ variant: style, direction }} />
      </div>
    </article>
  );
}

function CardCatalogue() {
  const [run, setRun] = useState(0);
  const [style, setStyle] = useState<CardStyle>('blue');
  return (
    <article className="component-entry">
      <div className="component-description"><h3>Card</h3><p>A rectangle that spins into place.</p></div>
      <div>
        <div className={`preview-area ${style === 'dark' ? 'preview-area-dark' : ''}`}>
          <Card key={run} variant={style}>A plain card</Card>
        </div>
        <fieldset className="style-options">
          <legend>Style</legend>
          {Object.entries(cardSpec.styles).map(([key, option]) => <label key={key}><input type="radio" name="card-style" value={key} checked={style === key} onChange={() => setStyle(key as CardStyle)} /> <span>{option.label}</span></label>)}
        </fieldset>
        <button type="button" className="card-replay" onClick={() => setRun((count) => count + 1)}>Replay animation</button>
        <div className="feature-ids" aria-label="Card identifiers">
          <h4>Identifiers</h4><dl>
            <div><dt>Component</dt><dd><code>{cardSpec.id}</code></dd></div>
            <div><dt>Shape</dt><dd><code>{cardSpec.shape.id}</code></dd></div>
            <div><dt>Animation</dt><dd><code>{cardSpec.animation.id}</code></dd></div>
            <div><dt>Style</dt><dd><code>{cardSpec.styles[style].id}</code></dd></div>
          </dl>
        </div>
        <ComponentExport id="wp.component.card" selection={{ variant: style, width: 300, height: 190 }} />
      </div>
    </article>
  );
}

function AttentionCueCatalogue() {
  const [hex, setHex] = useState(attentionCueSpec.defaults.color);
  const [spinDuration, setSpinDuration] = useState(attentionCueSpec.defaults.spinDuration);
  const valid = isHexColor(hex);
  const color = valid ? hex : attentionCueSpec.defaults.color;
  // The color picker only understands six-digit hex, so expand #rgb shorthand for it.
  const pickerValue = color.length === 4 ? `#${[...color.slice(1)].map((digit) => digit + digit).join('')}` : color;
  return (
    <article className="component-entry">
      <div className="component-description"><h3>Attention cue</h3><p>A glowing border that draws the eye to a component.</p></div>
      <div>
        <div className="preview-area preview-area-dark">
          <AttentionCue color={color} spinDuration={spinDuration}><JellyButton variant="dark">Look here</JellyButton></AttentionCue>
        </div>
        <div className="attention-controls">
          <label>Color <input type="color" value={pickerValue.toLowerCase()} onChange={(event) => setHex(event.target.value)} aria-label="Pick cue color" /><input type="text" value={hex} onChange={(event) => setHex(event.target.value.trim())} aria-label="Cue color hex" aria-invalid={!valid} spellCheck={false} /></label>
          <label>Spin speed <input type="range" min="1" max="6.4" step="0.1" value={7 - spinDuration} onChange={(event) => setSpinDuration(Math.round((7 - Number(event.target.value)) * 10) / 10)} aria-label="Spin speed" /> <output>{spinDuration}s per turn</output></label>
        </div>
        <div className="feature-ids" aria-label="Attention cue identifiers">
          <h4>Identifiers</h4><dl>
            <div><dt>Component</dt><dd><code>{attentionCueSpec.id}</code></dd></div>
            <div><dt>Style</dt><dd><code>{attentionCueSpec.styles.border.id}</code></dd></div>
            <div><dt>Animation</dt><dd><code>{attentionCueSpec.animation.id}</code></dd></div>
          </dl>
        </div>
        <ComponentExport id="wp.component.attention-cue" selection={{ color, spinDuration, radius: 999, offset: 5, variant: 'border' }} />
      </div>
    </article>
  );
}

function App() {
  const getPage = () => window.location.hash === '#play' ? 'play' : 'browse';
  const [page, setPage] = useState(getPage);
  useEffect(() => { const sync = () => setPage(getPage()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#browse" aria-label="White Pepper UI home"><span className="brand-symbol select-none">✳</span><span>white pepper<span className="brand-ui"> ui</span></span></a><nav className="top-nav" aria-label="Main navigation"><a href="#browse" aria-current={page === 'browse' ? 'page' : undefined}>Browse</a><a href="#play" aria-current={page === 'play' ? 'page' : undefined}>Play <span aria-hidden="true">↗</span></a></nav><span className="header-note">A library for what’s next.</span></header>
    <main>{page === 'browse' ? <div className="browse-page">
      <div className="intro-scene">
        <img className="petals" src="/petals.svg" alt="" aria-hidden="true" />
        <section className="hero" aria-label="White Pepper UI introduction">
          <img className="hero-art-image" src="/whitepepper-art.png" alt="A white pepper hanging from a dark, twisting stem" />
          <div className="hero-copy">
            <p className="overline">A UI library for the agent era</p>
            <h1>Agent first<br /><span>UI set in motion</span></h1>
            <p>Thoughtful components for the things we make, and the things we haven’t imagined yet.</p>
            <div className="hero-actions"><a href="#components" className="hero-link">Explore components <span aria-hidden="true">↘</span></a><a href="#get-started" className="hero-get-started">Get started <span aria-hidden="true">↗</span></a></div>
          </div>
        </section>
        <div className="catalogue-intro" id="components"><div className="section-heading"><div><p className="overline">The collection</p><h2 id="components-title">Built to be built on.</h2><p>Explore the components, their styles, and the details that make them move.</p></div><span className="count">04 COMPONENTS</span></div></div>
      </div>
      <section className="catalogue" aria-labelledby="components-title"><ButtonCatalogue /><DialogCatalogue /><CardCatalogue /><AttentionCueCatalogue /></section>
      <SetupGuide />
    </div> : <Play />}</main>
    <footer><span>✳ &nbsp; WHITE PEPPER UI</span><span>Made for humans and agents.</span><span>© WHITE PEPPER</span></footer>
  </div>;
}

const root = document.getElementById('app');
if (!root) throw new Error('Missing app root element');
createRoot(root).render(<App />);
