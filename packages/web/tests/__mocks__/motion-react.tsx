import React from "react";

const motionPropNames = new Set([
  "initial",
  "animate",
  "exit",
  "variants",
  "transition",
  "whileHover",
  "whileTap",
  "whileFocus",
  "whileDrag",
  "whileInView",
  "layout",
  "layoutId",
  "onAnimationStart",
  "onAnimationComplete",
  "drag",
  "dragConstraints",
  "dragElastic",
  "dragMomentum",
  "onDragStart",
  "onDragEnd",
  "onDrag",
]);

// Cache created components so React doesn't unmount/remount on re-render
const componentCache = new Map<string, React.ForwardRefExoticComponent<Record<string, unknown>>>();

function createMotionComponent(element: string) {
  if (componentCache.has(element)) {
    return componentCache.get(element)!;
  }

  const Component = React.forwardRef<HTMLElement, Record<string, unknown>>(
    (props, ref) => {
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (!motionPropNames.has(key)) {
          filtered[key] = value;
        }
      }
      return React.createElement(element, { ...filtered, ref });
    }
  );
  Component.displayName = `motion.${element}`;

  componentCache.set(element, Component);
  return Component;
}

// motion.div, motion.form, motion.span, etc.
export const motion = new Proxy(
  {},
  {
    get: (_target, prop: string) => {
      return createMotionComponent(prop);
    },
  }
);

// AnimatePresence just renders children
export function AnimatePresence({
  children,
}: {
  children: React.ReactNode;
  mode?: string;
  initial?: boolean;
}) {
  return <>{children}</>;
}

// MotionConfig passes children through
export function MotionConfig({
  children,
}: {
  children: React.ReactNode;
  reducedMotion?: string;
}) {
  return <>{children}</>;
}

// useReducedMotion always returns false in tests
export function useReducedMotion() {
  return false;
}
