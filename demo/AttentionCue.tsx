'use client';
import './AttentionCue.css';
import React from 'react';
// Feature IDs are stable references shared by all instances of this component.
export const attentionCueSpec = {
  id: 'wp.component.attention-cue',
  portability: {
    "defaults": {
      "color": "#0061e8",
      "spinDuration": 2.4,
      "radius": 999,
      "offset": 5,
      "variant": "border"
    },
    "example": {
      "children": {
        "componentId": "wp.component.button",
        "props": {
          "variant": "dark"
        },
        "children": "Look here"
      }
    },
    "related": [
      "wp.component.button"
    ]
  },
  styles: {
    border: { id: 'wp.style.attention-cue.border', label: 'Border', description: 'A glowing ring drawn just outside the wrapped component, following its corner radius.' },
  },
  animation: { id: 'wp.animation.attention-cue.orbit-glow', label: 'Orbit glow', description: 'A soft, breathing glow in the cue color with a brighter, harsher light of the same color circling the ring; the light stops circling for reduced motion.' },
  defaults: { color: '#0061e8', spinDuration: 2.4 },
};

export type AttentionCueStyle = keyof typeof attentionCueSpec.styles;
export type AttentionCueProps = React.ComponentPropsWithoutRef<'span'> & {
  /** Hex color such as `#0061e8` or `#f80`. Invalid values fall back to the default. */
  color?: string;
  /** Seconds per full turn of the circling light; lower is faster. */
  spinDuration?: number;
  /** Corner radius of the wrapped component in pixels. Use 999 for pill shapes. */
  radius?: number;
  /** Gap between the wrapped component and the ring in pixels. */
  offset?: number;
  variant?: AttentionCueStyle;
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string) {
  return HEX_COLOR.test(value);
}

export function AttentionCue({ children, className = '', color = attentionCueSpec.defaults.color, spinDuration = attentionCueSpec.defaults.spinDuration, radius = 999, offset = 5, variant = 'border', style, ...props }: AttentionCueProps) {
  const selectedStyle = Object.hasOwn(attentionCueSpec.styles, variant) ? variant : 'border';
  const cueColor = isHexColor(color) ? color : attentionCueSpec.defaults.color;
  const duration = Number.isFinite(spinDuration) && spinDuration > 0 ? spinDuration : attentionCueSpec.defaults.spinDuration;
  const cueVars = { '--wp-attention-color': cueColor, '--wp-attention-spin': `${duration}s`, '--wp-attention-radius': `${radius}px`, '--wp-attention-offset': `${offset}px` } as React.CSSProperties;

  return (
    <span {...props} className={`wp-attention wp-attention--${selectedStyle} ${className}`} style={{ ...cueVars, ...style }} data-wp-component={attentionCueSpec.id} data-wp-style={attentionCueSpec.styles[selectedStyle].id} data-wp-animation={attentionCueSpec.animation.id} data-wp-color={cueColor} data-wp-spin-duration={duration}>
      {children}
      <span className="wp-attention__layer wp-attention__glow" aria-hidden="true" />
      <span className="wp-attention__layer wp-attention__bloom" aria-hidden="true"><span className="wp-attention__beam" /></span>
      <span className="wp-attention__layer wp-attention__beam" aria-hidden="true" />
    </span>
  );
}
