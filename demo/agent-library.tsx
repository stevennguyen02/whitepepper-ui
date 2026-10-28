import React from 'react';
import { createLibrary, defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { JellyButton, buttonSpec } from './JellyButton';
import { ReshapeDialog, dialogSpec } from './ReshapeDialog';

const Button = defineComponent({
  name: 'WhitePepperButton',
  description: `A ${buttonSpec.id} with ${buttonSpec.shape.id} and ${buttonSpec.animation.id}. Use it for a simple action.`,
  props: z.object({
    label: z.string().max(60).describe('Text displayed on the button'),
    style: z.enum([buttonSpec.styles.blue.id, buttonSpec.styles.dark.id]).describe('White Pepper button style ID'),
  }),
  component: ({ props }) => <JellyButton variant={props.style === buttonSpec.styles.dark.id ? 'dark' : 'blue'}>{props.label}</JellyButton>,
});

const Dialog = defineComponent({
  name: 'WhitePepperDialog',
  description: `A ${dialogSpec.id} with a square button trigger and ${dialogSpec.animation.id}. Use it to reveal extra details.`,
  props: z.object({
    label: z.string().max(40).describe('Text displayed on the trigger'),
    style: z.enum([dialogSpec.styles.blue.id, dialogSpec.styles.dark.id]).describe('White Pepper dialog style ID'),
    direction: z.enum(Object.values(dialogSpec.directions).map((option) => option.id)).describe('Reshape direction ID'),
  }),
  component: ({ props }) => {
    const variant = props.style === dialogSpec.styles.dark.id ? 'dark' : 'blue';
    const direction = Object.keys(dialogSpec.directions).find((key) => dialogSpec.directions[key].id === props.direction) ?? 'expand';
    return <ReshapeDialog variant={variant} direction={direction} trigger={<JellyButton shape="square" variant={variant}>{props.label}</JellyButton>} />;
  },
});

const Screen = defineComponent({
  name: 'WhitePepperScreen',
  description: 'Place registered components in the main or side region of the screen.',
  props: z.object({
    main: z.array(z.union([Button.ref, Dialog.ref])).describe('Components in the main region'),
    side: z.array(z.union([Button.ref, Dialog.ref])).describe('Components in the side region'),
  }),
  component: ({ props, renderNode }) => (
    <div className="agent-screen">
      <section className="agent-region" aria-label="Main region"><h5>Main region</h5>{renderNode(props.main)}</section>
      <section className="agent-region" aria-label="Side region"><h5>Side region</h5>{renderNode(props.side)}</section>
    </div>
  ),
});

export const agentLibrary = createLibrary({ root: 'WhitePepperScreen', components: [Screen, Button, Dialog] });
export const agentSystemPrompt = agentLibrary.prompt({
  preamble: 'Compose the interface using registered White Pepper UI components in the appropriate screen regions. When asked to add a component, include a reference to it in the correct region; do not claim to add it while leaving that region empty.',
  examples: [
    'root = WhitePepperScreen([primary], [])\nprimary = WhitePepperButton("Make it happen", "wp.style.button.bright-blue")',
    'root = WhitePepperScreen([], [details])\ndetails = WhitePepperDialog("Open", "wp.style.dialog.dark-outline", "wp.direction.clock.3")',
  ],
});
export const exampleAgentOutput = `root = WhitePepperScreen([primary], [details])
primary = WhitePepperButton("Make it happen", "wp.style.button.bright-blue")
details = WhitePepperDialog("Open", "wp.style.dialog.dark-outline", "wp.direction.clock.3")`;
