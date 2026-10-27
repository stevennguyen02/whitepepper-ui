import React, { useLayoutEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { Dialog } from '@base-ui/react/dialog';

export const dialogSpec = {
  id: 'wp.component.dialog',
  animation: { id: 'wp.animation.dialog.reshape', label: 'Reshape', description: 'Morphs between the activating element and the dialog.' },
  styles: {
    blue: { id: 'wp.style.dialog.bright-blue', label: 'Bright blue', description: 'Blue fill and white text.', background: '#0061e8' },
    dark: { id: 'wp.style.dialog.dark-outline', label: 'Dark outline', description: 'Dark fill, light text, and a muted blue-gray outline.', background: '#222b36' },
  },
  directions: {
    expand: { id: 'wp.direction.expand', label: 'Expand from center' },
    ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
      const hour = index + 1;
      return [String(hour), { id: `wp.direction.clock.${hour}`, label: `${hour} o’clock` }];
    })),
  } as Record<string, { id: string; label: string }>,
};

type DialogStyle = keyof typeof dialogSpec.styles;
type Placement = { left: number; top: number; width: number; height: number; triggerBox: { left: number; top: number; width: number; height: number }; triggerRadius: string; triggerBackground: string };
type Animation = ReturnType<typeof animate>;
type Ref<T> = React.RefObject<T | null>;
type DialogProps = { trigger: React.ReactElement<{ children?: React.ReactNode }>; direction?: string; variant?: DialogStyle };
type AnimatedPopupProps = { placement: Placement; popupRef: Ref<HTMLDivElement>; animationRef: Ref<Animation>; reduceMotion: boolean | null; directionId: string; contentRef: Ref<HTMLDivElement>; triggerContentRef: Ref<HTMLSpanElement>; triggerContent: React.ReactNode; variant: DialogStyle };

function getPosition(trigger: DOMRect, direction: string) {
  const margin = 16;
  const width = Math.min(360, window.innerWidth - margin * 2);
  const height = Math.min(230, window.innerHeight - margin * 2);
  const angle = direction === 'expand' ? null : Number(direction) * Math.PI / 6;
  const cx = trigger.left + trigger.width / 2;
  const cy = trigger.top + trigger.height / 2;
  const x = cx - width / 2 + (angle === null ? 0 : Math.sin(angle) * (width - trigger.width) / 2);
  const y = cy - height / 2 - (angle === null ? 0 : Math.cos(angle) * (height - trigger.height) / 2);
  return { left: Math.max(margin, Math.min(x, window.innerWidth - width - margin)), top: Math.max(margin, Math.min(y, window.innerHeight - height - margin)), width, height };
}

export function ReshapeDialog({ trigger, direction = 'expand', variant = 'blue' }: DialogProps) {
  const selectedStyle = Object.hasOwn(dialogSpec.styles, variant) ? variant : 'blue';
  const selectedDirection = dialogSpec.directions[direction] ? direction : 'expand';
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerContentRef = useRef<HTMLSpanElement>(null);
  const closingRef = useRef(false);
  const reduceMotion = useReducedMotion();

  function triggerTransform() {
    const triggerBox = triggerRef.current?.getBoundingClientRect();
    if (!triggerBox || !placement?.width || !placement?.height) return null;
    return {
      x: triggerBox.left + triggerBox.width / 2 - (placement.left + placement.width / 2),
      y: triggerBox.top + triggerBox.height / 2 - (placement.top + placement.height / 2),
      scaleX: triggerBox.width / placement.width,
      scaleY: triggerBox.height / placement.height,
    };
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      if (!triggerRef.current) return;
      closingRef.current = false;
      const triggerStyle = window.getComputedStyle(triggerRef.current);
      const triggerBox = triggerRef.current.getBoundingClientRect();
      setPlacement({ ...getPosition(triggerBox, selectedDirection),
        triggerBox: { left: triggerBox.left, top: triggerBox.top, width: triggerBox.width, height: triggerBox.height },
        triggerRadius: triggerStyle.borderRadius, triggerBackground: triggerStyle.backgroundColor });
      setOpen(true);
      return;
    }
    if (closingRef.current) return;
    const target = triggerTransform();
    if (reduceMotion || !target || !popupRef.current || !placement) {
      setOpen(false);
      return;
    }
    closingRef.current = true;
    animationRef.current?.stop();
    if (contentRef.current) animate(contentRef.current, { opacity: 0 }, { duration: 0.12 });
    if (triggerContentRef.current) animate(triggerContentRef.current, { opacity: 1 }, { duration: 0.18, delay: 0.14 });
    animationRef.current = animate(popupRef.current, {
      x: target.x, y: target.y, scaleX: target.scaleX, scaleY: target.scaleY, borderRadius: placement.triggerRadius, backgroundColor: placement.triggerBackground,
    }, { duration: 0.32, ease: [0.4, 0, 1, 1] });
    animationRef.current.then(() => { closingRef.current = false; setOpen(false); });
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger ref={triggerRef} render={trigger} className={open ? 'reshape-trigger-hidden' : undefined} />
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        {placement && <AnimatedPopup placement={placement} popupRef={popupRef} animationRef={animationRef}
          reduceMotion={reduceMotion} directionId={dialogSpec.directions[selectedDirection].id}
          contentRef={contentRef} triggerContentRef={triggerContentRef} triggerContent={trigger.props.children} variant={selectedStyle} /> }
      </Dialog.Portal>
    </Dialog.Root>
  );
}


function AnimatedPopup({ placement, popupRef, animationRef, reduceMotion, directionId, contentRef, triggerContentRef, triggerContent, variant }: AnimatedPopupProps) {
  const box = placement.triggerBox;
  const origin = {
    x: box.left + box.width / 2 - (placement.left + placement.width / 2),
    y: box.top + box.height / 2 - (placement.top + placement.height / 2),
    scaleX: box.width / placement.width,
    scaleY: box.height / placement.height,
  };

  // The portal may mount after its parent; start the animation when the popup itself mounts.
  useLayoutEffect(() => {
    if (reduceMotion || !popupRef.current) return;
    if (contentRef.current) animate(contentRef.current, { opacity: [0, 0, 1] }, { duration: 0.48, times: [0, 0.45, 1] });
    if (triggerContentRef.current) animate(triggerContentRef.current, { opacity: [1, 0] }, { duration: 0.16 });
    animationRef.current = animate(popupRef.current, {
      x: [origin.x, 0], y: [origin.y, 0], scaleX: [origin.scaleX, 1], scaleY: [origin.scaleY, 1],
      borderRadius: [placement.triggerRadius, '18px'],
      backgroundColor: [placement.triggerBackground, dialogSpec.styles[variant].background],
    }, { duration: 0.48, ease: [0.22, 1, 0.36, 1] });
    return () => animationRef.current?.stop();
  }, [placement, reduceMotion]);

  const initialStyle = reduceMotion ? {} : {
    transform: `translate(${origin.x}px, ${origin.y}px) scale(${origin.scaleX}, ${origin.scaleY})`,
    borderRadius: placement.triggerRadius,
    backgroundColor: placement.triggerBackground,
  };
  return (
    <Dialog.Popup ref={popupRef} className={`reshape-dialog reshape-dialog--${variant}`}
      style={{ left: placement.left, top: placement.top, width: placement.width, height: placement.height, ...initialStyle }}
      data-wp-component={dialogSpec.id} data-wp-animation={dialogSpec.animation.id} data-wp-direction={directionId} data-wp-style={dialogSpec.styles[variant].id}>
      {!reduceMotion && <span ref={triggerContentRef} className="reshape-trigger-content" aria-hidden="true">{triggerContent}</span>}
      <div ref={contentRef} className="reshape-dialog-content" style={reduceMotion ? undefined : { opacity: 0 }}>
        <Dialog.Title className="dialog-title">A little more room.</Dialog.Title>
        <Dialog.Description className="dialog-description">This dialog takes shape from the component that opened it.</Dialog.Description>
        <Dialog.Close className="dialog-close">Close</Dialog.Close>
      </div>
    </Dialog.Popup>
  );
}
