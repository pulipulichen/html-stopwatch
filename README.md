# HTML Stopwatch

A compact, browser-based stopwatch designed to keep accurate time while taking up as little screen space as possible.

> **Status:** In development. The planned behavior and acceptance criteria are tracked in [Issue #1](https://github.com/pulipulichen/html-stopwatch/issues/1).

## Features

- **Millisecond precision** — Display elapsed time as `HH:MM:SS.mmm`, with accurate start, pause, and resume behavior.
- **Keyboard shortcuts** — Use `Space` to start or pause and `Escape` to reset. Shortcuts are ignored while an editable field has focus.
- **Copy elapsed time** — Copy the currently displayed elapsed time with one click.
- **Editable title** — Click the title to edit it inline. Press `Enter` or leave the field to save; press `Escape` to cancel editing.
- **Responsive title display** — Keep the title on one line and resize it to fit the available space. If it still overflows, use a slow marquee; titles that fit remain static.
- **Synchronized mini window** — Pop the stopwatch out into a small, toolbar-free window. The main page and mini window share the same timer state and title.
- **Compact, responsive layout** — Keep margins, spacing, and controls small while preserving readability on narrow windows and mobile screens.
- **Installable PWA** — Support installation through compatible browsers. An internet connection is required; offline HTML and asset caching are intentionally not provided.

## Controls

| Action | Keyboard / UI |
| --- | --- |
| Start or pause | `Space` |
| Reset to zero | `Escape` |
| Edit the title | Click or tap the title |
| Save the title | `Enter` or blur |
| Cancel title editing | `Escape` while editing |
| Copy elapsed time | Copy button |
| Open mini window | Popup control |

Keyboard shortcuts do not run while the user is typing in an input, textarea, or another editable control. Pressing `Space` for the stopwatch shortcut also must not scroll the page.

## Time formats

The stopwatch display includes milliseconds:

```text
HH:MM:SS.mmm
```

The browser tab title uses a shorter format without milliseconds:

- Less than one hour: `MM:SS - Custom title`
- One hour or more: `HH:MM:SS - Custom title`
- Empty custom title: use `HTML Stopwatch` as the title

For example: `01:12 - Meeting` or `01:02:03 - Meeting`.

## Title overflow behavior

The title stays still whenever it fits in its available space. When it overflows:

1. Wait one second before moving.
2. Scroll horizontally at approximately 30 CSS pixels per second.
3. Pause for approximately one second at the end before continuing the loop.
4. Keep the movement clipped to the title area so it never overlaps the timer or controls.

The overflow check is repeated when the title or window size changes. Marquee movement stops while the title is being edited.

## Mini window

Use the popup control on the main screen to open a compact, toolbar-free mini window. Both views operate on the same stopwatch: elapsed time, title changes, and start, pause, and reset actions stay synchronized.

## PWA and connectivity

The application is intended to be installable as a Progressive Web App (PWA). It does **not** provide offline support:

- No offline HTML fallback.
- No service-worker asset caching for offline use.
- An internet connection may be required to load and use the application.

## Project specification

See [Issue #1 — Compact stopwatch with millisecond precision and popup mini mode](https://github.com/pulipulichen/html-stopwatch/issues/1) for the complete requirements and acceptance criteria.
