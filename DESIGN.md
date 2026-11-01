---
name: TYMVERA
description: A quiet daily agenda with warm surfaces, charcoal type, and restrained green.
colors:
  bg: "#f8f9f5"
  surface: "#fff"
  ink: "#222c27"
  muted: "#667169"
  line: "#dfe5dd"
  accent: "#356b50"
  accent-ink: "#fff"
  tint: "#eaf1e8"
  danger: "#a63832"
  input: "#fff"
  dark-bg: "#181b19"
  dark-surface: "#202522"
  dark-ink: "#e5eae3"
  dark-muted: "#acb8ae"
  dark-line: "#39423c"
  dark-accent: "#99c9a7"
  dark-accent-ink: "#16281c"
  dark-tint: "#2b3a2e"
  dark-danger: "#ffaaa2"
  dark-input: "#252c27"
typography:
  display:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "36px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: "-0.02em"
  title-small:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.6
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  block-title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.5
  label:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.6
rounded:
  track: "4px"
  control: "8px"
  segmented: "10px"
  editor: "12px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  compact: "12px"
  md: "16px"
  control-x: "18px"
  section-small: "20px"
  lg: "24px"
  section: "28px"
  xl: "32px"
  shell: "40px"
  empty: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
  button-secondary:
    rounded: "{rounded.control}"
    padding: "9px 14px"
  input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  editor:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.editor}"
    padding: "24px"
  navigation-active:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  segmented-active:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "8px 18px"
  period-active:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  select:
    backgroundColor: "{colors.input}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.segmented}"
    padding: "8px 12px 8px 18px"
---

# Design System: TYMVERA

## Overview

**Creative North Star: "Quiet Daily Agenda"**

A calm working space for daily plans: warm white, charcoal text, and a restrained green accent. Manrope, open spacing, and thin dividers create a clean, premium feel without ornamental clutter.

The system prioritizes a legible agenda and visible completion controls on an Android phone. Light, dark, and system appearance share the same structure; only semantic color roles change. The implemented interface uses type, line icons, and simple data marks rather than photographic imagery.

**Key Characteristics:**

- Warm neutral surfaces with restrained green emphasis.
- Clear type hierarchy and flat, divided lists.
- Persistent, labeled Today, Progress, and Account navigation.
- Explicit completion, saved, loading, and error states.

Source of truth: `src/planner/planner.css`, `src/planner/PlannerApp.jsx`, and `src/planner/RoutineVersions.jsx`. This is a code extraction of the implemented redesign.

## Colors

The primary green supplies action and completion emphasis; neutrals carry the interface.

### Primary

- **Restrained Green** (`accent`): primary actions, completion indicators, links, chart bars, focus outlines, and the wordmark dot.
- **Green Wash** (`tint`): selected controls, hover surfaces, avatar, and contextual notices.
- **Accent Contrast** (`accent-ink`): text and checkmarks placed on a solid accent background.

### Neutral

- **Warm Page** (`bg`): the page and phone navigation background.
- **White Surface** (`surface`): editor, Google sign-in button, and error banner.
- **Charcoal Ink** (`ink`): main text, wordmark, primary-button hover, and toast surface.
- **Quiet Text** (`muted`): metadata, secondary text, inactive navigation, and completed block names.
- **Soft Divider** (`line`): list separators, borders, empty progress tracks, and no-plan bars.
- **Field Surface** (`input`): editable fields; separate from surface even when the light values match.
- **Error Red** (`danger`): errors, destructive text, and warning status dots. It is a semantic exception, not a second decorative accent.

Each light token has a corresponding `dark-` frontmatter entry. At runtime the same CSS custom property names are replaced by `:root[data-theme="dark"]`. System mode listens to `prefers-color-scheme: dark`; appearance is persisted as `tymvera_appearance`.

**The Semantic Theme Rule.** Use the CSS color roles in every state so light, dark, and system appearance remain coherent.

## Typography

**Display and Body Font:** Manrope Variable, with sans-serif fallback, bundled through `@fontsource-variable/manrope`. No separate display, serif, or monospace family is used.

**Character:** Compact, quietly expressive headings sit above readable task names and smaller metadata. Weight and spacing establish hierarchy without uppercase ornament.

### Hierarchy

- **Display:** page headings; use the frontmatter display role, reduced to (32px) on phones.
- **Headline:** empty-state heading; reduced to (21px) on phones.
- **Title:** section headings. Progress section headings reduce to (17px) on phones.
- **Small title:** editor headings.
- **Body:** base text. Supporting page descriptions and settings copy use (13px).
- **Block title:** agenda names; reduced to (15px) on phones. Names wrap anywhere when necessary.
- **Label:** editor labels. Supporting metadata uses (12px), reducing to (11px) on phones.
- **Wordmark:** (26px, weight 800, -0.04em), reduced to (23px) on phones.
- **Numbers:** tabular numerals in completion summaries, block metadata, chart values, and history.

Fine print uses (12px, line-height 1.75) and a maximum measure of (65ch). Settings copy also caps at (65ch); sync explanation caps at (55ch).

## Layout

Use a single readable content column. The default shell caps at (960px), including (40px) horizontal padding. Main content and footer cap at (720px). The header is (104px) high; navigation is horizontal above content.

At widths of (1000px) and above, the shell expands to (1120px). Navigation becomes a (140px) vertical rail positioned at (140px) from the top. Main content and footer move right by (180px), cap at (640px), and main begins (48px) below the header.

At widths of (600px) and below, shell padding becomes (22px), header height becomes (80px), and navigation is fixed across the bottom. Navigation includes the device safe-area inset; the footer reserves (120px) bottom padding. Toasts sit above navigation at `calc(92px + env(safe-area-inset-bottom))`.

Agenda rows are at least (94px) high, with (16px) gaps or (8px) on phones. Forms retain two equal columns for start time and minutes, separated by (16px). The editor uses (24px) padding, or (18px) on phones with (-6px) side margins. There is no additional intermediate breakpoint.

Section spacing centers on the documented spacing scale. Page headings use (32px) vertical margin, becoming (24px 0 28px) on phones. Main content starts at (16px) by default and (28px) on phones. Page headings wrap on phones so date controls can move to the next line. Secondary action groups wrap when needed.

**Observed target sizes:** base buttons have a (44px) minimum height, primary buttons (46px), compact primaries (42px), segmented options (40px), and inputs (48px). Completion targets are (48px) wide, reducing to (44px) on phones. Date-arrow and date-picker widths increase from (40px) to (44px) on phones; the edit action remains (44px) wide. These are implementation measurements, not a claim that every control meets a 44-by-44 target.

## Elevation & Depth

The interface is flat at rest. Thin dividers and semantic surface changes separate content; agenda rows and settings sections are not floating cards.

### Shadow Vocabulary

- **Toast, light:** `0 8px 28px #172b1e12`.
- **Toast, dark:** `0 8px 28px #0004`.

**The Flat Agenda Rule.** Keep routine content on the page surface; reserve elevation for transient status feedback.

Motion is limited to completion-track width (0.35s, `cubic-bezier(0.16, 1, 0.3, 1)`) and completion-circle background/border (0.2s). The editor scrolls into view smoothly when opened. Reduced-motion preference removes transitions and smooth scrolling.

## Shapes

Controls and fields use the control radius; the editor uses the larger editor radius. Segmented groups and toasts use the segmented radius. Completion indicators and avatars are circles; the status dot is a (6px) circle.

Borders are generally (1px) solid dividers. The completion circle uses a (1.5px) stroke. Progress tracks use the track radius, while chart bars round only their top corners: (5px) for up to seven chart columns and (3px) for denser charts.

## Components

### Buttons

Primary actions use a solid accent background, contrasting accent text, and weight (650). Hover changes to ink on page-background contrast. Secondary actions use a thin divider border and weight (600); text actions use green without horizontal padding. Ordinary button hover uses the tint surface.

Keyboard focus is a (2px) accent outline with (4px) offset. Disabled buttons use (0.6) opacity and the wait cursor. No separate pressed animation is defined.

### Agenda rows and completion

A circular completion control leads each divided row; the block title and wrapping metadata fill the middle; a muted edit action trails. The completion circle is (27px) inside its larger button target. Completed rows fill the circle with accent, display a checkmark, mute the title, and strike it through with a (1px) line.

The completion button exposes checkbox semantics and its checked state. The title and edit action both open the editor. Inline SVG icons use currentColor, a (24 by 24) viewBox, rounded strokes, and a default (1.7) stroke width.

### Editor and fields

The inline editor is a bordered surface with a section heading and close control. Labels sit above fields with (7px) gaps. Fields use (16px) text, (48px) minimum height, and a divider border; placeholders use (14px) muted text.

Opening focuses the first input. Escape cancels. Validation appears as red alert text. Start time is optional; duration is numeric. Repeat-day buttons fill evenly across a row; selected days use solid accent with accent contrast text and `aria-pressed`. Destructive options sit below a divider.

Task names offer a native datalist of existing names. Actual minutes are entered separately from planned duration. Native selects share field colors and borders, with (44px) minimum height and a (2px) accent focus outline offset by (3px). The compact Day plan selector uses (12px) type, caps at (75%) width, and sits beside its visible label above the agenda.

### Navigation and segmented controls

Today, Progress, and Account use visible text and line icons; the active destination exposes `aria-current="page"`. Default labels are muted. Desktop and tablet selection uses a tinted background and green text. Phone navigation stacks icon and label; selection uses green and a stronger icon stroke (2.3), without a filled background.

Progress range and appearance use bordered segmented groups with (3px) padding and gaps. Selected options use tinted backgrounds, green text, weight (700), and `aria-pressed`. Appearance offers Light, Dark, and System. Progress period controls wrap, using (12px) type and (8px 12px) button padding. Task and metric filters share a wrapping flex row with (16px) gaps; labels sit above their controls with (6px) gaps.

### Progress

The daily completion track is (5px) tall. History charts are (230px) tall and use accent bars, with default opacity (0.65) and the group ending today at opacity (1). No-plan days use divider-colored marks. Completion bars show completed divided by planned blocks; logged-time bars scale minutes against the largest visible group. Plain captions identify the active metric and grouping; empty history is explicitly distinct from failure.

Charts with up to seven columns cap bars at (44px) width. Denser charts use narrower gaps and full-width bars inside each column. The 7-, 28-, 90-, 365-day and Lifetime controls share this visual system; days group daily through 28 days, weekly through 90, and monthly for longer series. Lifetime visibly states its October 31, 2026 baseline; earlier recovered history has a separate link to the one-year view.

The Time by task table aggregates logged minutes under matching normalized task names. Selecting a task narrows the chart and daily record. A real Daily record table provides exact counts and time beneath the chart, links back to each day's agenda, and reveals earlier days in batches of (31). Adjacent history sections separate by (36px).

### Feedback and empty states

The header shows readable local/cloud status with an accent dot; local or sync errors switch the dot to danger. Loading states use plain text and busy semantics. Error banners use a danger border and message, with retry and dismissal.

An empty agenda uses a centered line icon, headline, short copy capped at (310px), and a primary add action. No loading skeleton or animated spinner is implemented.

The fixed toast uses inverted ink/page contrast, a soft shadow, and status semantics. Undo appears when supplied, with a separate dismiss control. Toasts clear after (9 seconds). Opening an editor dismisses the current toast.

### Account surfaces

Account information, appearance, repeating blocks, and data tools are divided sections. Avatars use a tinted (44px) circle. Google sign-in is a bordered surface button with the Google multicolor SVG; its provider colors are an identity asset rather than palette tokens. Busy sign-in disables the button and changes its text to "Opening Google…".

Routine versions opens a focused management view inside Account. It reuses bordered inline editors, divided sections, wrapping action rows, and the existing task-name datalist. Each version shows its block count and planned minutes, with use, edit, and archive actions. Individual version blocks separate with a top divider, (24px) top margin, and (20px) top padding. Today offers immediate selection without adding another navigation destination.

The Android host adds a divided Android reminders section with plain permission and schedule status, secondary action buttons, and red alert text on failure. This section is absent from the browser version. It keeps the same web typography and color roles; native host capabilities do not introduce a second visual language.

## Do's and Don'ts

### Do:

- **Do** use semantic CSS variables for every theme-sensitive surface and state.
- **Do** retain visible labels for the three navigation destinations.
- **Do** pair completion color with the checkmark and struck-through title.
- **Do** distinguish no recorded plan from zero completion.
- **Do** keep keyboard outlines and reduced-motion behavior.

### Don't:

- **Don't** add ornamental clutter to the quiet daily agenda direction.
- **Don't** turn every agenda row or settings section into an elevated card.
- **Don't** hard-code light colors into shared component states.
- **Don't** communicate save or error status through color alone.
