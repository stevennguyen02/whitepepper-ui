'use client';
import './Card.css';
import React, { useEffect, useRef } from 'react';
import { useAnimate, useReducedMotion } from 'motion/react';
// Feature IDs are stable references shared by all instances of this component.
export const cardSpec = {
  id: 'wp.component.card',
  portability: {
    "defaults": {
      "variant": "blue",
      "width": 300,
      "height": 190
    },
    "example": {
      "children": "A plain card"
    },
    "related": []
  },
  shape: { id: 'wp.shape.rectangle', label: 'Rectangle', description: 'A plain rectangle with softly rounded corners.' },
  styles: {
    blue: { id: 'wp.style.card.bright-blue', label: 'Bright blue', description: 'Bright blue fill with white text.' },
    dark: { id: 'wp.style.card.dark-outline', label: 'Dark outline', description: 'Dark fill with a muted blue-gray outline and light text.' },
  },
  animation: { id: 'wp.animation.card.spin-in', label: 'Spin in', description: 'Spawns as a small rounded square and grows as if pulled from its bottom-right corner while rotating a quarter turn counterclockwise into place, finishing with a ricochet bounce; skipped for reduced motion.' },
};

export type CardStyle = keyof typeof cardSpec.styles;
export type CardProps = React.ComponentPropsWithoutRef<'div'> & { width?: number; height?: number; variant?: CardStyle };

const SPAWN_SIZE = 36;
const RADIUS = 14;

export function Card({ children, className = '', width = 300, height = 190, variant = 'blue', style, ...props }: CardProps) {
  const selectedStyle = Object.hasOwn(cardSpec.styles, variant) ? variant : 'blue';
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const frame = scope.current;
    const card = cardRef.current;
    const content = contentRef.current;
    if (!frame || !card || !content) return;
    if (reduceMotion) {
      animate(frame, { rotate: 0 }, { duration: 0 });
      animate(card, { width, height, borderRadius: RADIUS, opacity: 1 }, { duration: 0 });
      animate(content, { opacity: 1 }, { duration: 0 });
      return;
    }
    const controls = animate([
      // The card's top-left corner stays put while the bottom-right corner is pulled out.
      [card, { width: [SPAWN_SIZE, width], height: [SPAWN_SIZE, height], borderRadius: [SPAWN_SIZE * 0.3, RADIUS], opacity: [0, 1] }, { duration: 0.6, ease: [0.22, 1, 0.36, 1] }],
      // At the same time the frame turns a quarter turn counterclockwise and ricochets past its resting angle.
      [frame, { rotate: [90, 0] }, { type: 'spring', stiffness: 70, damping: 9, at: 0 }],
      [content, { opacity: [0, 1] }, { duration: 0.25, at: 0.5 }],
    ]);
    return () => controls.stop();
  }, [width, height, reduceMotion]);

  // The stage reserves the larger dimension so the turning card never shifts layout.
  const stage = Math.max(width, height);
  return (
    <div className="wp-card-stage" style={{ width: stage, height: stage }}>
      <div ref={scope} className="wp-card-frame" style={{ width, height, transform: 'rotate(90deg)' }}>
        <div {...props} ref={cardRef} className={`wp-card wp-card--${selectedStyle} ${className}`} style={{ ...style, width: SPAWN_SIZE, height: SPAWN_SIZE, borderRadius: SPAWN_SIZE * 0.3, opacity: 0 }} data-wp-component={cardSpec.id} data-wp-shape={cardSpec.shape.id} data-wp-animation={cardSpec.animation.id} data-wp-style={cardSpec.styles[selectedStyle].id}>
          <div ref={contentRef} className="wp-card__content" style={{ width, height, opacity: 0 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
