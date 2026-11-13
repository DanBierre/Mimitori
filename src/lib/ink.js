// "Your ink": the one accent colour the learner picks. `light` is for the
// light page, `dark` the lighter partner for dark mode. Ink blue is the default.
export const INKS = [
  { id: "indigo", name: "Ink blue", light: "#2747d1", dark: "#8ea3ff" },
  { id: "pine", name: "Pine", light: "#1f8a70", dark: "#34c29e" },
  { id: "teal", name: "Teal", light: "#0e7490", dark: "#2fb8d0" },
  { id: "amber", name: "Amber", light: "#b45309", dark: "#f0a24b" },
  { id: "violet", name: "Violet", light: "#8b5cf6", dark: "#a78bfa" },
];

export const inkById = (id) => INKS.find((i) => i.id === id) || INKS[0];

// Light is the Lexicon page and the default; Dark is the night version; Device follows the system.
export const THEMES = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
  { id: "device", name: "Match device" },
];

export const isDark = (choice) =>
  choice === "dark" || (choice === "device" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches));

// Sets data-theme="light|dark" on the root; for "device" it keeps following the system. Returns a cleanup.
// With `fade`, a change cross-fades the whole page (View Transitions), unless the learner asks for less motion.
export function applyTheme(choice, root = document.documentElement, fade = false) {
  const set = (animate) => {
    const next = isDark(choice) ? "dark" : "light";
    if (root.dataset.theme === next) return;
    const swap = () => {
      root.dataset.theme = next;
    };
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (animate && document.startViewTransition && !calm) document.startViewTransition(swap);
    else swap();
  };
  set(fade);
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (choice !== "device" || !mq) return () => {};
  const follow = () => set(true);
  mq.addEventListener("change", follow);
  return () => mq.removeEventListener("change", follow);
}

export function applyInk(id, root = document.documentElement) {
  const ink = inkById(id);
  root.style.setProperty("--ink-l", ink.light);
  root.style.setProperty("--ink-d", ink.dark);
  root.dataset.ink = ink.id; // lets CSS move the due colour off amber
}
