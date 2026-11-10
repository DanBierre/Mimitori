---
name: Mimitori
description: A plain, polished subtitle player that happens to teach; the learning tools appear only when touched.
colors:
  accent: "#2563eb"
  accent-hover: "#1d4fd7"
  accent-soft: "#e8efff"
  accent-ink: "#ffffff"
  accent-dark: "#6b9bff"
  accent-dark-hover: "#8ab0ff"
  accent-soft-dark: "#1b2741"
  due: "#c26a06"
  due-dark: "#fbbf24"
  danger: "#c4321e"
  danger-dark: "#ff7a66"
  bg: "#fafafa"
  surface: "#ffffff"
  surface-2: "#f4f4f5"
  surface-3: "#e9e9ec"
  line: "#e4e4e7"
  text: "#18181b"
  text-2: "#5f5f68"
  bg-dark: "#0e0e10"
  surface-dark: "#17171a"
  surface-2-dark: "#1f1f23"
  surface-3-dark: "#2a2a2f"
  text-dark: "#ededef"
  text-2-dark: "#a1a1aa"
  stage: "#000000"
  stage-2: "#141416"
  stage-3: "#222226"
  stage-line: "#26262b"
  stage-text: "#ffffff"
  stage-text-2: "#b4b4bb"
typography:
  display:
    fontFamily: "Noto Sans JP, system-ui, -apple-system, Segoe UI, Hiragino Sans, Yu Gothic UI, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 700
    lineHeight: 1.25
  subtitle:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "clamp(20px, 26px, 34px)"
    fontWeight: 500
    lineHeight: 2.15
    letterSpacing: "0.02em"
  reading:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 2.25
    letterSpacing: "0.02em"
  title:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "5px"
  md: "8px"
  lg: "10px"
  card: "14px"
  panel: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    height: "40px"
  ctl-btn:
    backgroundColor: "transparent"
    textColor: "{colors.stage-text}"
    rounded: "{rounded.pill}"
    size: "44px"
  ctl-btn-play:
    backgroundColor: "#ffffff"
    textColor: "#000000"
    rounded: "{rounded.pill}"
    size: "48px"
  ctl-chip:
    backgroundColor: "{colors.stage-3}"
    textColor: "{colors.stage-text}"
    rounded: "18px"
    height: "36px"
    padding: "0 14px"
  ctl-chip-on:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
  word-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "16px"
  words-list:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  grade:
    backgroundColor: "{colors.surface}"
    rounded: "12px"
    height: "64px"
  segmented:
    backgroundColor: "{colors.surface-2}"
    rounded: "9px"
    padding: "3px"
---

# Design System: Mimitori

## Overview

**Creative North Star: "The Trusted Player"**

A subtitle player that looks like the ones learners already trust (the Netflix and YouTube players, Language Reactor) and happens to teach. Neutral greys, one blue accent, amber for due. The app follows the device light or dark setting; Watch's stage is always black. Learning tools (word card, timing, shortcuts) appear only when touched. Everything is Noto Sans JP and one-stroke line icons.

Density is calm and utilitarian: generous reading line-height, 40-48px targets, hairline borders. Personality comes from the Japanese text itself, not from chrome. Category standard at full craft, chosen by the user (Canon form).

**Key Characteristics:**
- State is a thin 2px underline under a word, nothing else.
- One accent hue, used for actions and saved words; amber only for due.
- Light and dark by device; the Watch stage is black in both.
- Flat surfaces, hairline borders; shadow only on floating cards.
- Line icons at one 2px stroke on a 24px grid.

## Colors

A neutral grey system with a single blue voice and one amber signal.

### Primary
- **Player Blue** (#2563eb light, #6b9bff dark; hover #1d4fd7 / #8ab0ff): primary buttons, saved-word underline, focus ring, current tab, active transcript time, progress bar fill. Soft tint (#e8efff / #1b2741) marks a selected word or the current transcript line.

### Secondary
- **Due Amber** (#c26a06 light, #fbbf24 dark): the underline under words due for review. Nothing else.

### Neutral
- **Paper Grey** (#fafafa / #0e0e10): page background. **Surface** (#ffffff / #17171a): cards, rail, lists. **Surface 2** (#f4f4f5 / #1f1f23): hover, chips, segmented track. **Surface 3** (#e9e9ec / #2a2a2f): progress track, scrollbars. **Hairline** (#e4e4e7 / #2a2a2f): every border.
- **Ink** (#18181b / #ededef) body text; **Quiet Ink** (#5f5f68 / #a1a1aa) secondary text.
- **Danger** (#c4321e / #ff7a66): error notes only.
- **Stage** (#000000; panel #141416, control fill #222226, rule #26262b, text #ffffff, secondary #b4b4bb): the Watch player, always dark.

### Named Rules
**The One Voice Rule.** Blue is the only hue besides amber. Saved, selected, current and primary all use it.
**The Underline Rule.** Word state is a 2px inset underline (blue saved, amber due) and a soft tint when selected. No pills, dots, badges or fills for state.
**The Stage Rule.** Watch's stage and controls use the stage tokens in both themes; the word card and pop-ups on it stay theme surfaces.

## Typography

**Display, Body and Label Font:** Noto Sans JP (400, 500, 700; with system-ui, Segoe UI, Hiragino Sans, Yu Gothic UI)

**Character:** One family for everything; hierarchy comes from weight (500 to 700) and size, never from a second face.

### Hierarchy
- **Display** (700, 56px, 1): the due count on Review.
- **Headline** (700, 46px, 1.25): the flashcard term. Word card term is 26px.
- **Subtitle** (500, clamp 20-34px from user size 26px, 2.15, +0.02em): the current Watch line, centred, on the stage directly under the video. Reduced to 28px max on phones; 24-40px in focus mode.
- **Reading** (400, 24px user-sized, 2.25, +0.02em): Read-screen text; ruby `rt` at 0.48em in Quiet Ink.
- **Title** (700, 16-20px, -0.01em): app title, drop prompt, Review big line (26px).
- **Body** (400, 16px, 1.55): default; secondary text 14-15px.
- **Label** (500, 11-14px): tabs (11px), buttons (14px), chips (13px), meta (12px). Numbers use tabular figures.

### Named Rules
**The One Family Rule.** Noto Sans JP only. Weights 400, 500, 700.
**The Sentence-Case Rule.** Labels are sentence case at normal tracking; no uppercase, no tracked-out small caps.

## Layout

Three breakpoints: phone under 720px (bottom tab bar, 64px, Watch goes edge to edge), tablet 720-1023px, desktop from 1024px (220px fixed left sidebar holds title, nav and known count). From 1100px Watch becomes a two-column grid (video stage, 320px transcript, max 1400px) and the Read word card opens as a 340px side column. Content sheets are capped (Read 760px, Words 820px, Review 520px). Spacing is a 4/8/12/16/24px rhythm; page padding 16px on phones, 28x32px on desktop. On Watch the current line sits directly under the video inside the dark stage, not over the picture, so it never covers the image.

## Elevation & Depth

Flat by default: depth comes from surface tone steps and 1px hairlines. Shadow is reserved for things that float.

### Shadow Vocabulary
- **Rest** (`0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px -12px rgb(0 0 0 / 0.18)`): Read compose box and Review card.
- **Pop** (`0 2px 6px rgb(0 0 0 / 0.08), 0 18px 40px -14px rgb(0 0 0 / 0.35)`): word card and pop-ups. Heavier in dark.
- **Segment** (`0 1px 2px rgb(0 0 0 / 0.1)`): selected segmented button.

### Named Rules
**The Float-Only Rule.** Only cards and pop-ups that overlay content carry Pop; everything in the page flow uses a hairline.

## Shapes

Softly rounded, never pill-shaped except controls on the stage. Radii: 5px keys, 8px buttons, 10px inputs and compose, 12px grade buttons, 14px cards and lists, 16px word card, 18px empty states and flashcard. Stage controls are circles (44-48px) or 18px chips; counters and tags are full pills. Borders are 1px hairlines; the drop zone is the one dashed border (1.5px).

## Components

### Buttons
- **Shape:** 8px radius, 40px high (48px wide variant), 14px/500 text, 120ms colour transition.
- **Primary:** Player Blue fill, accent-ink text; hover darkens to accent-hover.
- **Default / Quiet:** surface fill with hairline border; quiet has no border and Quiet Ink text. Disabled is 45% opacity.
- **Icon button:** 36px circle, hover Surface 2.

### Player controls
- Circle icon buttons 44px on the stage; white 48px play button with black icon; pressed toggles turn light blue (#8ab0ff); pressed chips fill #2563eb with white text. On phones the bar is one row of icons and chip labels become screen-reader-only.

### Word card
- 16px radius surface with hairline and Pop shadow; term 26px/700, reading in Quiet Ink, pill tags (12px on Surface 2), numbered glosses. Phone: bottom sheet above the tab bar. Tablet and up on Watch: anchored above the tapped word with a 12px rotated-square tail. Enters with a 260ms rise and fade.

### Word marks
- Inline button, 1px side padding, 4px radius; hover is a 9% tint; saved and due are 2px inset underlines; selected is Soft Blue with blue underline (white at 16% with white underline on the stage).

### Navigation
- Phone and tablet: 64px bottom tab bar, icon over 11px label, current tab in blue, count badge as blue 18px pill. Desktop: 220px sidebar, 40px rows, current row on Surface 2 with Ink text.

### Lists and fields
- Words list is one bordered 14px-radius surface with hairline row dividers. Search field 38px, 9px radius, hairline. Inputs focus with a 2px blue outline. Transcript lines are 44px rows with a tabular timestamp; current line takes Soft Blue.

### Segmented control
- Surface 2 track, 3px padding, 9px radius; selected segment is Surface with Segment shadow.

## Do's and Don'ts

### Do:
- **Do** use `var(--accent)` for every action and saved state, and `--due` only for due.
- **Do** mark word state with a 2px inset underline.
- **Do** draw icons with the `Icon` set: 24px grid, 2px stroke, round caps, `currentColor`.
- **Do** keep the Watch stage on `--stage-*` tokens in both themes, and keep cards on it as theme surfaces.
- **Do** keep targets at least 36px (44px on the stage, 48px for the primary action on phones).
- **Do** honour `prefers-reduced-motion` (all animation and transition are cancelled).

### Don't:
- **Don't** add themed study-app decoration (paper textures, calligraphy motifs, mascots, streak flames).
- **Don't** build button walls; new tools appear on touch (card, pop-up) rather than as always-visible controls.
- **Don't** introduce a second accent hue, a second typeface, or filled badges for word state.
- **Don't** use a second icon style or glyph/emoji icons.
- **Don't** hard-code colours that already have a token.
