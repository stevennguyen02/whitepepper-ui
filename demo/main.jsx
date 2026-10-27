import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JellyButton, buttonSpec } from './JellyButton.jsx';
import { ReshapeDialog, dialogSpec } from './ReshapeDialog.jsx';
import { Play } from './Play.jsx';

function ButtonCatalogue() {
  const [style, setStyle] = useState('blue');

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
      </div>
    </article>
  );
}

function DialogCatalogue() {
  const [direction, setDirection] = useState('expand');
  const [style, setStyle] = useState('blue');
  return (
    <article className="component-entry">
      <div className="component-description"><h3>Dialog</h3><p>A dialog that grows from its trigger.</p></div>
      <div>
        <div className={`preview-area ${style === 'dark' ? 'preview-area-dark' : ''}`}>
          <ReshapeDialog direction={direction} variant={style} trigger={<JellyButton variant={style} shape="square">Open</JellyButton>} />
        </div>
        <fieldset className="style-options">
          <legend>Style</legend>
          {Object.entries(dialogSpec.styles).map(([key, option]) => <label key={key}><input type="radio" name="dialog-style" value={key} checked={style === key} onChange={() => setStyle(key)} /> <span>{option.label}</span></label>)}
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
      </div>
    </article>
  );
}

function App() {
  const getPage = () => window.location.hash === '#play' ? 'play' : 'browse';
  const [page, setPage] = useState(getPage);
  useEffect(() => { const sync = () => setPage(getPage()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#browse" aria-label="White Pepper UI home"><span className="brand-symbol">✳</span><span>white pepper<span className="brand-ui"> ui</span></span></a><nav className="top-nav" aria-label="Main navigation"><a href="#browse" aria-current={page === 'browse' ? 'page' : undefined}>Browse</a><a href="#play" aria-current={page === 'play' ? 'page' : undefined}>Play <span aria-hidden="true">↗</span></a></nav><span className="header-note">A library for what’s next.</span></header>
    <main>{page === 'browse' ? <><section className="hero"><img className="petals" src="/petals.svg" alt="" aria-hidden="true" /><div className="hero-copy"><p className="overline">A UI library for the agent era</p><h1>Agent first<br /><span>UI set in motion</span></h1><p>Thoughtful components for the things we make, and the things we haven’t imagined yet.</p><a href="#components" className="hero-link">Explore components <span aria-hidden="true">↘</span></a></div><div className="hero-art"><img src="/whitepepper-art.png" alt="A white pepper hanging from a dark, twisting stem" /><span className="art-caption">WHITE PEPPER UI / 001</span></div></section><section className="catalogue" id="components"><div className="section-heading"><div><p className="overline">The collection</p><h2>Built to be built on.</h2><p>Explore the components, their styles, and the details that make them move.</p></div><span className="count">02 COMPONENTS</span></div><ButtonCatalogue /><DialogCatalogue /></section></> : <Play />}</main>
    <footer><span>✳ &nbsp; WHITE PEPPER UI</span><span>Made for humans and agents.</span><span>© WHITE PEPPER</span></footer>
  </div>;
}

createRoot(document.getElementById('app')).render(<App />);
