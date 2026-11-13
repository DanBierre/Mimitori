---
name: Mimitori
description: A cool-white reading desk with hairline rules, serif Japanese and one ink blue; a word's state is its mark, never its colour.
colors:
  page: "#fbfbfc"
  surface: "#ffffff"
  surface-2: "#f3f4f6"
  surface-3: "#e3e5ea"
  line: "#e3e5ea"
  line-soft: "#eef0f3"
  line-strong: "#cdd1d8"
  text: "#15171c"
  text-2: "#5d6370"
  text-3: "#6b717d"
  page-dark: "#111317"
  surface-dark: "#16191e"
  surface-2-dark: "#1d2026"
  surface-3-dark: "#262a31"
  line-dark: "#262a31"
  line-soft-dark: "#1d2026"
  line-strong-dark: "#3a3f48"
  text-dark: "#eceef2"
  text-2-dark: "#a3a9b5"
  text-3-dark: "#858b97"
  video-frame: "#0d0f12"
  ink-blue: "#2747d1"
  ink-blue-dark: "#8ea3ff"
  ink-pine: "#1f8a70"
  ink-pine-dark: "#34c29e"
  ink-teal: "#0e7490"
  ink-teal-dark: "#2fb8d0"
  ink-amber: "#b45309"
  ink-amber-dark: "#f0a24b"
  ink-violet: "#8b5cf6"
  ink-violet-dark: "#a78bfa"
  ink-strong: "color-mix(in srgb, ink 90%, #000)"
  mark: "color-mix(in srgb, ink 16%, transparent)"
  mark-strong: "color-mix(in srgb, ink 30%, transparent)"
  ink-on-light: "#ffffff"
  ink-on-dark: "#111317"
  danger: "#c4321e"
  danger-dark: "#ff7a66"
typography:
  display:
    fontFamily: "Newsreader, Noto Serif JP, Hiragino Mincho ProN, Yu Mincho, Georgia, serif"
    fontSize: "72px"
    fontWeight: 400
    lineHeight: 1
  headline:
    fontFamily: "Newsreader, Noto Serif JP, serif"
    fontSize: "56px"
    fontWeight: 400
    lineHeight: 1.2
  term:
    fontFamily: "Newsreader, Noto Serif JP, serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.2
  cue:
    fontFamily: "Newsreader, Noto Serif JP, serif"
    fontSize: "clamp(22px, read-size + 6px, 40px)"
    fontWeight: 400
    lineHeight: 1.95
    letterSpacing: "0.01em"
  reading:
    fontFamily: "Newsreader, Noto Serif JP, serif"
    fontSize: "clamp(22px, read-size + 6px, 40px)"
    fontWeight: 400
    lineHeight: 1.95
    letterSpacing: "0.01em"
  figure:
    fontFamily: "Newsreader, Noto Serif JP, serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.2
  entry:
    fontFamily: "Newsreader, Noto Serif JP, serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.4
  meaning:
    fontFamily: "Newsreader, Noto Serif JP, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  margin-note:
    fontFamily: "Newsreader, Noto Serif JP, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontStyle: italic
  body:
    fontFamily: "Noto Sans JP, system-ui, -apple-system, Segoe UI, Hiragino Sans, Yu Gothic UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"palt\""
  ui:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Noto Sans JP, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  index:
    fontFamily: "IBM Plex Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 500
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  control: "0px"
  float: "4px"
spacing:
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
  segmented-option:
    textColor: "{colors.text-2}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  segmented-option-selected:
    textColor: "{colors.text}"
  readout-row:
    textColor: "{colors.text}"
    typography: "{typography.meaning}"
    padding: "8px 10px 8px 0"
  readout-row-selected:
    backgroundColor: "{colors.mark}"
  word-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.float}"
    padding: "0 18px 16px"
  popover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.float}"
    width: "340px"
    padding: "0 16px 16px"
  transcript-line:
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    padding: "8px 4px"
  transcript-line-current:
    backgroundColor: "color-mix(in srgb, ink 6%, transparent)"
    textColor: "{colors.text}"
---

# Design System: Mimitori

## Overview

**Creative North Star: "The Lexicon"**

Mimitori reads like a dictionary page on a cool white desk. The type is ink, the rules are hairlines, and the Japanese is set in a serif. One accent, ink blue, does all the pointing. Light is the default look on every device. Dark is a choice in Settings (Theme: Light, Dark or Match device), and Watch follows it too. Only the video frame stays dark.

Words carry their state in their mark, not in a colour. A new word gets a soft marker. A saved word gets a dotted ink underline. A known word is plain. The learner can read the line without a colour key.

The signature is the Instrument readout. Small mono numbers 1 to 9 sit beside each unknown word in the Watch line. The same numbers head the rows of a table under the video (word, reading, meaning, state). Keys 1 to 9 pick a word. The number ties the word in the line, its row and its entry together.

**Key Characteristics:**
- Cool white page, ink type. Light by default; Dark or Match device in Settings.
- One accent, ink blue by default. The learner can pick Pine, Teal, Amber or Violet instead.
- Serif for Japanese lines, words and meanings. Sans for UI. Mono for timecodes, counts and keys.
- Hairline rules, not cards. A heavy 2px rule opens each entry.
- Word state is the mark: marker, dotted underline or plain.
- Square corners on controls. Floating surfaces get 4px and the one shadow.

## Colors

A cool neutral scale carries the page. Ink is the only accent.

### Primary
- **Ink blue** (`ink-blue` `#2747d1`; dark `ink-blue-dark` `#8ea3ff`): the default ink. The store sets it as `--ink-l` (light) and `--ink-d` (dark). Pine, Teal, Amber and Violet replace it as a pair when the learner picks one in Settings.
- **Strong ink** (`ink-strong`, the ink mixed 90% with black on light; the plain ink on dark): ink as text, as a filled button, the focus ring and the caret. Ink text and filled buttons reach 4.5:1 for every ink.
- **Mark** (`mark`, ink at 16% light / 18% dark) and **Mark strong** (30% / 34%): the word markers, the selected readout row and the hover marker.
- **Ink on fill** (`ink-on-light` `#ffffff`, `ink-on-dark` `#111317`): text on a filled ink button.

### Neutral
- **Page** (`page` `#fbfbfc`; dark `#111317`): every screen and the bars.
- **Surface** (`surface`): floating things only (word sheet, popovers).
- **Surface 2 and 3**: fills for hover and the deepest neutral.
- **Hairline** (`line`): every rule between rows and sections. **Line soft** is the lighter rule between table rows. **Line strong** outlines buttons, inputs and keys.
- **Text, Text 2, Text 3**: main copy; secondary copy and idle controls; captions, timecodes, counts. Text 3 is `#6b717d`, darker than the mock's `#8a8f99`, to keep contrast.
- **Video frame** (`video-frame` `#0d0f12`): the letterbox behind the video and the empty drop frame. It is the only dark that ignores the device theme.
- **Danger** (`danger`): error notes only.

### Named Rules
**The Mark-Not-Colour Rule.** Word state is shown by the mark: New is a soft marker (`mark`, lower 40% of the line); In Anki, saved and due are a dotted 2px ink underline; Known is plain; Selected is `mark-strong` plus a 2px ink rule. No per-state hues.

**The One-Ink Rule.** Ink points at the current place, the main action, the entry numbers and progress. Everything else is neutral.

**The Strong-Ink Rule.** Ink as text or as a filled background uses Strong ink. Raw ink is for markers, underlines, ticks and tints.

**The Light-First Rule.** Light is the default. The store sets `data-theme="dark"` on the root only when the learner picks Dark, or picks Match device and the device is dark. Watch follows the same setting. Only the video frame is always dark.

## Typography

**Serif:** Newsreader, then Noto Serif JP (Newsreader has no kana, so Japanese falls through), Hiragino Mincho ProN, Yu Mincho, Georgia.
**Sans:** Noto Sans JP with system-ui fallbacks, `palt` on.
**Mono:** IBM Plex Mono, only for timecodes, counts and keys.

### Hierarchy
- **Display** (serif 400, 72px): the due count on the Review start screen.
- **Headline** (serif 400, 56px): the word on the Review card, and the Today figure.
- **Term** (serif 400, 40px; 32px for long words, 28px on phones): the word at the head of the word card.
- **Cue and Reading** (serif 400, Read size plus 6px, clamped 22 to 40px, line height 1.95): the Watch line and pasted text in Read. The learner sets the size.
- **Figure** (serif 400, 26px): the percentage and counts at the top of Read and under the video.
- **Entry word** (serif 19px) and **Meaning** (serif 16px): readout rows and entry glosses.
- **Margin note** (serif italic 15px, Strong ink, beside a hairline): grammar and alternatives in the word card.
- **Body** (sans 400, 16px) and **UI** (sans 14px): copy, buttons, rows. **Label** (sans 13px): meta, transcript lines.
- **Index** (mono 500, 11px, Strong ink): the 1 to 9 numbers. **Mono** (12px, Text 3): timecodes, counts, keys, table state.

### Named Rules
**The Two-Weight Rule.** Weights are 400 and 500 only. Headings and bold render at 500. Large serif numbers are 400.

**The Mono-Is-Data Rule.** Mono carries numbers, keys and the short labels that sit with them (table heads, "words you know", "2 new"). Never sentences.

## Layout

Screens are panes divided by hairlines, held to a calm measure: Read 760px, Words 820px, Watch up to 1400px.

- **Phone (under 720px):** a 52px top bar and a 64px bottom tab bar (plus safe area). The word sheet floats 8px from the edges above the tab bar.
- **Tablet (720px and up):** the tabs become a quiet text row beside the name. The word panel floats near the text.
- **Desktop (1100px and up):** Watch becomes the player column plus a 340px side column: the entry on top, the transcript under it. In Read the entry sits beside the text. On desktop the entry is bare, with no surface or shadow.
- **Touch:** controls grow to at least 44px; key hints hide.
- **Rhythm:** steps of 4, 8, 12, 16, 24, 32px.

## Elevation & Depth

The page is flat. Rules, not shadows, separate things. A shadow appears only on a surface that floats.

### Shadow Vocabulary
- **Pop** (light: `0 1px 2px rgb(0 0 0 / 0.08), 0 22px 44px -20px rgb(0 0 0 / 0.4)`; dark: `0 2px 6px rgb(0 0 0 / 0.4), 0 18px 40px -14px rgb(0 0 0 / 0.8)`): the floating word sheet and popovers.

**The Only-Floating-Things Rule.** No shadow on anything that does not float over content.

## Shapes

Controls, rows, tabs, the segmented filter, toggles, the video frame and keys are square (`--radius: 0`). The floating word sheet and popovers are 4px. The only other rounded shapes are 1px bars in the Today chart.

Borders are 1px hairlines. Emphasis is a 2px rule, never a box.

**The Heavy-Rule Rule.** A 2px Text-coloured rule opens each entry: the word card head, the readout table, the popover head, the Review answer. A 2px ink rule marks the current item: the selected word, the current transcript line (left edge), the chosen segment and the current tab.

## Components

### Buttons
- **Primary:** Strong ink fill, ink-on-fill text, 40px tall, 16px padding, square. One per screen.
- **Default:** transparent, line-strong outline, hover 5% text tint.
- **Disabled:** 45% opacity. Icon buttons shrink to 0.94 on press, text buttons to 0.97.

### Segmented Filter
Plain text options, 36px tall, Text 2. The chosen option is Text with a 2px ink rule under it, moved by one sliding marker.

### Toggles and Inputs
- **Toggle:** 18px square, line-strong border, checked fills with ink and a drawn tick. Never a capsule.
- **Input:** transparent, line-strong outline, square, 40px. Focus is a 2px Strong ink ring with 2px offset.

### Navigation
Phone: bottom tab bar, 12px labels, current tab in Text. Tablet and up: text links beside the name. The current tab sits on a 2px Text rule over the header hairline. The Review tab shows its due count in mono.

### Word Marks (signature)
- **New:** `linear-gradient(transparent 60%, mark 60%)`; hover uses `mark-strong`.
- **In Anki, saved, due:** `underline dotted` ink, 2px thick, 0.32em offset. A saved word inks in over 420ms.
- **Known:** no mark.
- **Selected:** `mark-strong` plus `inset 0 -2px 0 ink`.
- **Index number:** a mono 500 Strong ink number, 0.32em of the line size (10px minimum), after each not-yet-known word in the Watch line.

### Readout (signature)
A full-width table under the video, opened by a 2px Text rule. Columns are number, word (serif 19px), reading (sans 14px, Text 2), meaning (serif 16px) and state (mono 12px, Text 3). Header cells are mono 10px, uppercase and tracked, with a hairline under them. Row rules are Line soft. Hover is a 5% tint. The selected row is `mark` with its state in Strong ink. Clicking a row, or pressing 1 to 9, opens the entry.

### Word Panel (entry)
- **Head:** 2px Text rule, then the serif Term, its reading and part of speech in italic serif.
- **Body:** serif meanings, then italic ink margin notes for grammar and alternatives, then a row of square buttons (the main one filled in Strong ink) with their mono keys inside. The entry shows the word's index number when it came from a numbered line.
- **Surface:** bare beside the text on desktop. On phones and tablets: Surface, 1px hairline, 4px corners, Pop shadow, 260ms slide.

### Popover
Surface, hairline, 4px, Pop shadow, 340px wide. It opens with a 2px Text rule.

### Read Header
At the top of Read: `% words you know`, new words, and saved or in-Anki counts. Figures are serif 26px over mono 12px labels. A 4px bar shows coverage in Text on Line soft. A hairline closes the row.

### Watch
- **Video frame:** the one dark element, `video-frame` behind the video. The page around it follows the Theme setting.
- **Line:** serif cue, left-aligned, under a mono timecode and line count, with the index numbers. A pressed word takes the Selected mark. The translation sits under it in sans, Text 2.
- **Transcript:** ruled rows. Timecodes are mono 11px, Text 3; new-word counts read "2 new" in mono Strong ink; draft lines say "auto" in italic serif. The current row has 6% ink, a 2px ink rule on its left edge and an ink timecode.
- **Review grades:** four square outlined tiles. "Good" is the one filled in Strong ink.

### Motion
- **Curve:** `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Timing:** 150ms for controls, 380ms for the sliding marker, 220ms and 260ms for popovers and the word sheet.
- **Reduced motion:** all animation and transitions off.

## Do's and Don'ts

### Do:
- **Do** show word state with the mark: marker, dotted underline, plain, or marker plus 2px rule.
- **Do** open every entry with a 2px rule and divide the rest with hairlines.
- **Do** set Japanese lines, words and meanings in the serif; UI in sans; only timecodes, counts and keys in mono.
- **Do** keep weights at 400 and 500.
- **Do** keep controls square and floating surfaces at 4px with the one shadow.
- **Do** keep light as the default, with Dark and Match device in Settings, Watch included.
- **Do** give every unknown word in the Watch line its index number, and keep keys 1 to 9 working.
- **Do** make controls at least 44px on touch.

### Don't:
- **Don't** colour words by state or use per-item colours.
- **Don't** use resting cards, tinted boxes or pill chips.
- **Don't** add a second accent. Ink, plus danger for errors, is all there is.
- **Don't** use mascots, streak flames, sakura, torii or brush fonts.
- **Don't** borrow from Shoji: cream paper, vermilion, Murecho, seals or ensō.
- **Don't** use weights above 500, or shadows on flat surfaces.
