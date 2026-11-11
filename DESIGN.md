---
name: Mimitori
description: Quiet precision that is personal; the learner's own progress is the only decoration.
colors:
  page: "#fbfbfa"
  surface: "#ffffff"
  surface-2: "#f4f4f2"
  surface-3: "#e7e7ea"
  line: "#ececef"
  line-strong: "#cfcfd6"
  text: "#111114"
  text-2: "#5c5c65"
  text-3: "#70707a"
  page-dark: "#0b0b0d"
  surface-dark: "#141417"
  surface-2-dark: "#1c1c20"
  surface-3-dark: "#2a2a2f"
  line-dark: "#232328"
  line-strong-dark: "#3a3a41"
  text-dark: "#ededef"
  text-2-dark: "#a1a1aa"
  text-3-dark: "#85858f"
  stage: "#0e0e10"
  stage-on-dark: "#101013"
  stage-2: "#17171a"
  stage-3: "#26262b"
  stage-text: "#ffffff"
  stage-text-2: "#a8a8b2"
  ink-indigo: "#5560d8"
  ink-indigo-dark: "#8b8bff"
  ink-pine: "#1f8a70"
  ink-pine-dark: "#34c29e"
  ink-teal: "#0e7490"
  ink-teal-dark: "#2fb8d0"
  ink-amber: "#b45309"
  ink-amber-dark: "#f0a24b"
  ink-violet: "#8b5cf6"
  ink-violet-dark: "#a78bfa"
  ink-strong: "color-mix(in srgb, #5560d8 86%, #000)"
  ink-on-light: "#ffffff"
  ink-on-dark: "#0b0b10"
  due: "#c26a06"
  due-dark: "#fbbf24"
  due-under-amber: "#be185d"
  due-under-amber-dark: "#f472b6"
  danger: "#c4321e"
  danger-dark: "#ff7a66"
typography:
  display:
    fontFamily: "Noto Sans JP, system-ui, -apple-system, Segoe UI, Hiragino Sans, Yu Gothic UI, sans-serif"
    fontSize: "72px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "\"palt\", \"tnum\""
  headline:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 400
    lineHeight: 1.25
    fontFeature: "\"palt\""
  cue:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "clamp(22px, 30px, 36px)"
    fontWeight: 500
    lineHeight: 2.15
    letterSpacing: "0.01em"
    fontFeature: "\"palt\""
  title:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.3
    fontFeature: "\"palt\""
  reading:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 2.25
    letterSpacing: "0.02em"
    fontFeature: "\"palt\""
  figure:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "\"palt\", \"tnum\""
  heading:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.55
    fontFeature: "\"palt\""
  body:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"palt\""
  ui:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "\"palt\""
  label:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"palt\", \"tnum\""
  caption:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"palt\", \"tnum\""
  key:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  pane: "0px"
  chip: "2px"
  swatch: "3px"
  control: "4px"
  float: "6px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink-strong}"
    textColor: "{colors.ink-on-light}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-default:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-default-hover:
    backgroundColor: "{colors.surface-2}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  segmented-option:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  segmented-option-selected:
    backgroundColor: "color-mix(in srgb, #5560d8 6%, transparent)"
    textColor: "{colors.ink-strong}"
  nav-tab:
    textColor: "{colors.text-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
  nav-tab-current:
    textColor: "{colors.ink-strong}"
  word-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.float}"
    width: "280px"
  menu-row:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.ui}"
    rounded: "{rounded.pane}"
    padding: "0 14px"
    height: "36px"
  menu-row-primary:
    backgroundColor: "color-mix(in srgb, #5560d8 7%, transparent)"
    textColor: "{colors.ink-strong}"
  stage:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.stage-text}"
    rounded: "{rounded.control}"
  stage-control:
    backgroundColor: "transparent"
    textColor: "{colors.stage-text-2}"
    rounded: "{rounded.control}"
    size: "44px"
  transcript-row:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.ui}"
    padding: "9px 6px"
    height: "44px"
  transcript-row-current:
    backgroundColor: "color-mix(in srgb, #5560d8 6%, transparent)"
    textColor: "{colors.text}"
  input-text:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  toggle:
    backgroundColor: "transparent"
    rounded: "{rounded.control}"
    size: "18px"
  toggle-checked:
    backgroundColor: "{colors.ink-strong}"
    textColor: "{colors.ink-on-light}"
---

# Design System: Mimitori

## Overview

**Creative North Star: "The Learner's Own Ink"**

Mimitori is a near-bare, exact, calm workspace. The page is almost white, the type is almost black, and the only colour that means anything is the ink the learner picked for themselves. That ink marks the words they saved, the one main action on a screen, and their progress. Nothing else is decorated: the text itself gets cleaner as the learner improves, because furigana falls away from words they know.

Hierarchy comes from size and space, never from heavy weight, boxes or colour blocks. Screens are edge-to-edge panes divided by hairlines. Only things that float (the word card, pop-ups) carry a shadow and a 6px corner. The Watch player always sits on a dark stage, whatever the device theme, with no boxes inside it: the line is set large and centred, the controls are one bare row, and a tick timeline under the video shows where the hard lines are.

The one hand-made touch is the brushed underline: a slightly uneven stroke under saved and due words and along the coverage bar. It is the only imperfect geometry in an otherwise exact system, and it is reserved for the learner's progress.

**Key Characteristics:**
- Near-white page, near-black text, a fine neutral scale; light and dark follow the device.
- One accent, "your ink", chosen from five; it recolours the whole app at once.
- Noto Sans JP with proportional kana (palt); weights 400 and 500 only.
- Hairlines, not cards; shadow only on floating things.
- Brushed, uneven underlines mark saved words, due words and coverage.
- Watch always plays on a dark stage with no inner boxes.
- Motion is one curve, a short slide or fade, and it switches off under reduced motion.

## Colors

A monochrome neutral scale carries the whole interface; the learner's ink is the single accent, and due has its own signal colour.

### Primary
- **Your Ink** (one of five pairs; indigo `ink-indigo` / `ink-indigo-dark` by default): the learner picks it in Settings, and the app sets the light value for the light page and the lighter partner for dark mode and the Watch stage. Used only for saved-word underlines, the main action, the current tab, selection tints, the coverage bar, inked ticks and density dots.
- **The Five Inks**: Indigo, Pine, Teal, Amber, Violet (`ink-*` and `ink-*-dark` in the frontmatter). Each dark partner is lighter so it reads on near-black.
- **Strong Ink** (`ink-strong`, the chosen ink mixed 86% with black on the light page; the plain ink in dark mode): every place ink is used as text or as a filled button background, so ink text and filled buttons reach 4.5:1 for all five inks.
- **Ink On Fill** (`ink-on-light` / `ink-on-dark`): text on a filled ink button; white on the light page, near-black in dark mode.

### Secondary
- **Due Amber** (`due` / `due-dark`): words due for review, and the due count beside the Review tab (mixed 75% with text there). It is a signal, not a second accent.
- **Due Rose** (`due-under-amber` / `due-under-amber-dark`): replaces Due Amber when the learner's ink is Amber, so due never looks like a saved word.

### Tertiary
- **Error Red** (`danger` / `danger-dark`): error notes only.

### Neutral
- **Page** (`page` / `page-dark`): the background of every screen and of the top and bottom bars.
- **Surface** (`surface` / `surface-dark`): floating things only (word card, pop-ups) and the inline edit field.
- **Surface 2** (`surface-2` / `surface-2-dark`): hover fill for buttons, rows and icon buttons; the Anki field chip.
- **Surface 3** (`surface-3` / `surface-3-dark`): scrollbar thumbs and the deepest neutral fill.
- **Hairline** (`line` / `line-dark`): every divider between panes, rows and sections.
- **Strong Hairline** (`line-strong` / `line-strong-dark`): outlines of inputs, default buttons, toggles, keys and dashed draft tags; the coverage bar's rail.
- **Text, Text 2, Text 3** (`text`, `text-2`, `text-3` and dark partners): primary copy; secondary copy and idle controls; captions, timestamps and counts.
- **Stage** (`stage`, `stage-on-dark`, `stage-2`, `stage-3`, `stage-text`, `stage-text-2`): the Watch player. The stage re-points the page tokens (text, ink) to its own values, so anything inside reads on near-black; the word card and tips reset them back to the page theme.

### Named Rules
**The Your-Ink-Only Rule.** Ink appears only on saved words, the one main action, the current place (tab, line, option) and progress. If a use isn't one of those, it is neutral.

**The Strong-Ink Rule.** Ink as text or as a filled background always uses Strong Ink; raw ink is for marks, ticks, dots, hairline underlines and tints.

**The Due-Is-Not-Ink Rule.** Due keeps its own colour and moves to rose when the learner's ink is amber. Never let due and saved share a hue.

**The Six-Percent Rule.** Selected is ink text with a 1px ink underline, or a 6% ink tint behind it (7% on the word card's main row). No solid selected fills.

## Typography

**Body Font:** Noto Sans JP (with system-ui, -apple-system, Segoe UI, Hiragino Sans, Yu Gothic UI, sans-serif)

**Character:** One family for everything, Japanese and English alike, with proportional kana spacing (palt) on. It reads as exact and modern, never as a study app or calligraphy.

### Hierarchy
- **Display** (400, 72px, 1): the number of words due on the Review start screen. Large but light.
- **Headline** (400, 56px, 1.25): the word on the review card.
- **Cue** (500, scales 22–36px with the learner's size setting, default 30px, 2.15): the current subtitle line on the Watch stage, centred, with room for ruby.
- **Title** (400, 56px, 1.2; 40px on phones, one step down for words over five characters): the word on the word card, with its reading and part of speech quietly beneath.
- **Reading** (400, 24px by default and learner-adjustable, 2.25, 0.02em): pasted text in Read.
- **Figure** (500, 23px, 1, tabular): the coverage percentage under the stage.
- **Heading** (500, 22px): screen titles (Settings) and the Watch greeting; section headings drop to 16px, empty-state titles to 18px, the drop prompt to 20px.
- **Body** (400, 16px, 1.55): default copy.
- **UI** (400, 14px): buttons, menu rows, transcript lines, notes, glosses.
- **Label** (400, 13px, tabular): meta rows, segmented labels, control-bar text, progress counts.
- **Caption** (400, 12px, tabular): timestamps, phone tab labels, table headers, grammar notes.
- **Key** (500, 11px): keyboard keys on word-card rows.
- **Furigana** (400, 0.48em of its base, Text 2): ruby over unknown words only.

### Named Rules
**The Two-Weight Rule.** Weights are 400 and 500 only. Headings, strong and bold all render at 500. The biggest numbers on screen are 400.

**The Tabular Rule.** Every count, time, percentage and interval uses tabular numbers.

**The Falling-Furigana Rule.** Furigana shows only on words the learner doesn't know. Marking a word known fades its reading out on every line at once (200ms); under reduced motion it simply disappears.

## Layout

Screens are edge-to-edge panes separated by hairlines, with content held to a calm measure: Read 760px, Words 820px, Settings 720px, Review 520px, Watch up to 1400px.

- **Phone (under 720px):** a 52px top bar with the name, content padded 16px, and a 64px bottom tab bar (plus safe area). On Watch, the transcript sits below the stage and toggles from the control row; the word card is a bottom sheet 8px from the edges.
- **Tablet (720px and up):** the tab bar becomes a quiet row of text links beside the name; content padding grows to 28px / 32px. On Watch the word card anchors above the tapped word (280px wide).
- **Desktop (1100px and up):** Watch becomes a two-column grid, stage plus a 300px transcript divided by a hairline, both filling the viewport height. Read opens its word card as a 340px side panel.
- **Rhythm:** spacing runs in small steps (2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32px). Sections in Settings are 32px apart and start with a hairline and 20px of space.
- **Touch:** every control grows to at least 44px on coarse pointers; keyboard hints hide on touch screens.

## Elevation & Depth

The system is flat. Depth comes from hairlines and from the dark stage sitting against the light page. A shadow appears only on something that floats over other content.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.1), 0 22px 44px -18px rgb(0 0 0 / 0.5)`; dark: `0 2px 6px rgb(0 0 0 / 0.4), 0 18px 40px -14px rgb(0 0 0 / 0.8)`): the word card and pop-ups (timing, shortcuts).

### Named Rules
**The Only-Floating-Things Rule.** If it doesn't sit above other content, it has no shadow. Panes, rows, buttons and the stage are flat.

## Shapes

Corners are small and exact. Controls are 4px-radius rectangles or plain text; floating things are 6px at most; panes and menu rows are square (0px), and the Anki field chip is 2px. Ink swatches in Settings are 12px squares at 3px. The only circles are the transcript's density dots.

Borders are 1px hairlines. A dashed hairline means "draft" or "drop here": the file drop zone, the "draft" tag on made subtitles and the auto-timed tag in the transcript.

**The Brushed Mark.** Saved and due words carry a 7px-tall, slightly uneven stroke under them, drawn as a mask so its colour stays a token (ink for saved, due colour for due). The same stroke fills the coverage bar. It is never replaced by a straight underline or perfect geometry.

## Components

### Buttons
Plain and exact; most actions are text.
- **Shape:** 4px rectangle, 40px tall (48px for wide, 44px on touch), 16px side padding, 14px text.
- **Primary:** Strong Ink fill, white text (near-black in dark mode); one per screen at most.
- **Default:** transparent with a Strong Hairline outline; hover fills Surface 2.
- **Quiet:** no outline, Text 2; hover lifts to Text.
- **Disabled:** 45% opacity.
- **Icon buttons:** 36px square (44px on touch), Text 2, hover Surface 2.

### Segmented Filter
- **Style:** a row of plain text buttons 2px apart, each 36px tall, 4px radius, Text 2, with an optional label in front.
- **State:** the chosen option is Strong Ink text on a 6% ink tint; counts sit beside it in Text 3, tabular.

### Toggles
- **Style:** 18px squares at 4px with a Strong Hairline border; checked fills with ink and shows a drawn tick in Ink On Fill. Never a capsule switch.

### Inputs / Fields
- **Style:** transparent, Strong Hairline outline, 4px radius, 40px tall.
- **Focus:** a 2px ink outline and an ink border; the caret is ink. Focus rings everywhere are 2px ink, 2px offset.

### Navigation
- **Phone:** a fixed bottom tab bar on the page colour with a hairline above; icon over a 12px label, Text 2; the current tab turns ink. The Review tab shows its due count.
- **Tablet and desktop:** the same tabs as a quiet text row beside the logo (15px). The current tab is Strong Ink with a 1px ink underline 9px below; icons are hidden. Settings sits on the right as an icon button.

### Watch Stage (signature)
- **Stage:** always dark, 4px corners, video on top with its top corners rounded and no inner boxes.
- **Ticks:** a 24px strip under the video, one 2px tick per line at its start time, 8px tall plus 4px per new word (max 24px). Ticks are 38% white; lines with three or more new words are inked; the current line is a 3px white tick. Clicking jumps to the nearest line.
- **Cue:** the current line large and centred in the Cue style, translation below it in 14px Stage Text 2; a pressed word gets a 30% ink tint.
- **Controls:** one bare row of 44px icon buttons and text chips in Stage Text 2, hover to white; groups split by an 18px hairline. A pressed toggle is ink text; a pressed text chip is white with a 1px ink underline.
- **Meta row:** under the stage, separated by a hairline: the coverage figure, its label, a 96px brushed ink bar over a hairline rail, the new-word count, and a dashed "draft" tag on made subtitles.

### Transcript
- **Rows:** plain ruled rows (hairline above each), at least 44px tall, timestamp in Caption, text in UI at Text 2. The current row is Text on a 6% ink tint.
- **Density dot:** on the right, a dot that grows with new words: 4px at 60% ink, 6px for two, 8px solid ink for three or more.
- **Foot:** under a hairline, the review note and the local-only line in 12px Text 2.

### Word Card (command menu)
- **Shape:** Surface, hairline border, 6px radius, Float shadow; slides in 8px on the curve. Anchored above the tapped word with a small pointer on tablet and up; a bottom sheet on phones. On the stage it switches back to page-theme colours.
- **Head:** the word in Title, reading and form in 12–13px Text 3, a 36px speak button.
- **Actions:** ruled menu rows (square, 36px, 44px on touch) with their keyboard key on the right in Key style. The main row (add) is Strong Ink on a 7% tint; the others are plain, hover Surface 2. Keys hide on touch screens.

### Review Grades
- **Style:** four outlined 4px tiles (60px tall) with label and interval. "Good" is the one main answer: ink border, Strong Ink text, 6% ink tint.

### Empty States
- **Style:** centred, no illustration: an 18–20px title, one or two lines of 14px Text 2, then one or two buttons. The Watch drop zone is a dashed 4px panel with a single line icon in Text 3; dragging over it turns the border ink and adds a 6% tint.

### Motion
- **Curve:** `cubic-bezier(0.22, 1, 0.36, 1)` for every slide and fade.
- **Durations:** 260ms for tab changes and panels (8px slide), 220ms for pop-ups, 200ms for furigana fading, 300ms for the review progress bar, 120ms for hover colour.
- **Reduced motion:** all animation and transitions are off.

## Do's and Don'ts

### Do:
- **Do** use the learner's ink only for saved words, the one main action, the current place and progress.
- **Do** use Strong Ink whenever ink is text or a filled background.
- **Do** switch due to rose when the learner's ink is amber.
- **Do** build hierarchy with size and space, at weights 400 and 500 only.
- **Do** divide screens with 1px hairlines and keep panes edge to edge.
- **Do** mark saved and due words, and coverage, with the brushed uneven stroke.
- **Do** keep the Watch stage dark in both themes, with nothing boxed inside it.
- **Do** give controls 4px corners and floating things 6px at most.
- **Do** use tabular numbers for every count, time and percentage.
- **Do** make every control at least 44px on touch screens.
- **Do** turn off all motion under reduced motion.

### Don't:
- **Don't** put a shadow on anything that doesn't float.
- **Don't** wrap content in resting cards or tinted boxes; use a hairline.
- **Don't** use weights above 500.
- **Don't** introduce a second accent or decorate with colour blocks; due and error are signals only.
- **Don't** use study-app decoration: mascots, streaks, torii, sakura or brush fonts.
- **Don't** build stat-tile dashboards; progress is a quiet line of text and the brushed bar.
- **Don't** replace the brushed mark with a straight underline or a highlighter fill.
- **Don't** borrow anything from Shoji: no warm cream paper, no Murecho, no vertical side labels, no vermilion, no ensō or seals, no capsule (pill) switches or ink-well controls.
