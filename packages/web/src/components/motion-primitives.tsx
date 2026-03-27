"use client";

import { type Variants } from "motion/react";

// ── Spring configs ──────────────────────────────────────────────────────────
export const SPRING_SNAPPY = { type: "spring" as const, stiffness: 500, damping: 30 };
export const SPRING_GENTLE = { type: "spring" as const, stiffness: 300, damping: 25 };
export const SPRING_BOUNCY = { type: "spring" as const, stiffness: 400, damping: 17 };

// ── Card list variants ──────────────────────────────────────────────────────
export const listContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: SPRING_SNAPPY,
  },
  exit: {
    opacity: 0,
    x: -20,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

// ── Fade variants ───────────────────────────────────────────────────────────
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const fadeScaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

// ── Page transition variants ────────────────────────────────────────────────
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: "easeIn" } },
};

// ── Staggered form field variants ───────────────────────────────────────────
export const formContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

export const formFieldVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: SPRING_GENTLE },
};

// ── Stat card stagger variants ──────────────────────────────────────────────
export const statContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export const statCardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: SPRING_GENTLE },
};

// ── Banner variants ─────────────────────────────────────────────────────────
export const bannerVariants: Variants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  show: {
    opacity: 1,
    height: "auto",
    marginTop: 16,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

// ── Chart card stagger variants ──────────────────────────────────────────────
export const chartContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const chartCardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: SPRING_GENTLE },
};

export const shakeVariants: Variants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  show: {
    opacity: 1,
    height: "auto",
    marginTop: 16,
    x: [0, -6, 6, -4, 4, 0],
    transition: { duration: 0.4, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};
