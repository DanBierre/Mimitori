// "Your ink": the one accent colour the learner picks. `light` is for the
// light page, `dark` the lighter partner for dark mode and the Watch stage.
export const INKS = [
  { id: "indigo", name: "Ink blue", light: "#2747d1", dark: "#8ea3ff" },
  { id: "pine", name: "Pine", light: "#1f8a70", dark: "#34c29e" },
  { id: "teal", name: "Teal", light: "#0e7490", dark: "#2fb8d0" },
  { id: "amber", name: "Amber", light: "#b45309", dark: "#f0a24b" },
  { id: "violet", name: "Violet", light: "#8b5cf6", dark: "#a78bfa" },
];

export const inkById = (id) => INKS.find((i) => i.id === id) || INKS[0];

export function applyInk(id, root = document.documentElement) {
  const ink = inkById(id);
  root.style.setProperty("--ink-l", ink.light);
  root.style.setProperty("--ink-d", ink.dark);
  root.dataset.ink = ink.id; // lets CSS move the due colour off amber
}
