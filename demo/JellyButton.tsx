'use client';
import './JellyButton.css';
import React from 'react';
import { useAnimate, useReducedMotion } from 'motion/react';
import { Button } from '@base-ui/react/button';
// Feature IDs are stable references shared by all instances of this component.
export const buttonSpec = {
  id: 'wp.component.button',
  portability: {
    "defaults": {
      "variant": "blue",
      "shape": "pill"
    },
    "example": {
      "children": "Make it happen"
    },
    "related": [
      "wp.component.dialog",
      "wp.component.attention-cue"
    ]
  },
  shape: { id: 'wp.shape.pill', label: 'Pill', description: 'Fully rounded button ends.' },
  squareShape: { id: 'wp.shape.square', label: 'Square', description: 'Equal width and height with softly rounded corners.' },
  animation: { id: 'wp.animation.jello-click', label: 'Jello on click', description: 'A squish and rebound on activation; skipped for reduced motion.' },
  styles: {
    blue: { id: 'wp.style.button.bright-blue', label: 'Bright blue', description: 'Bright blue fill with white text.' },
    dark: { id: 'wp.style.button.dark-outline', label: 'Dark outline', description: 'Dark fill with a muted blue-gray outline and light text.' },
  },
};

export type ButtonStyle = keyof typeof buttonSpec.styles;
export type JellyButtonProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'color'> & { variant?: ButtonStyle; shape?: 'pill' | 'square' };

export const JellyButton = React.forwardRef<HTMLElement, JellyButtonProps>(function JellyButton({ children, onClick, className = '', variant = 'blue', shape = 'pill', ...props }, forwardedRef) {
  const selectedStyle = buttonSpec.styles[variant] ? variant : 'blue';
  const [scope, animate] = useAnimate();
  const reduceMotion = useReducedMotion();

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!reduceMotion && scope.current) {
      animate(scope.current, {
        scaleX: [1, 1.16, 0.9, 1.07, 0.97, 1],
        scaleY: [1, 0.86, 1.12, 0.94, 1.03, 1],
      }, { duration: 0.65, ease: 'easeOut' });
    }
    onClick?.(event);
  }

  function setRefs(node: HTMLElement | null) {
    (scope as { current: HTMLElement | null }).current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  return <Button {...props} ref={setRefs} className={`jelly-button jelly-button--${selectedStyle} ${shape === 'square' ? 'jelly-button--square' : ''} ${className}`} data-wp-component={buttonSpec.id} data-wp-shape={shape === 'square' ? buttonSpec.squareShape.id : buttonSpec.shape.id} data-wp-animation={buttonSpec.animation.id} data-wp-style={buttonSpec.styles[selectedStyle].id} onClick={handleClick}>{children}</Button>;
});
