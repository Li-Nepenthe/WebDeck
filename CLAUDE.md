# WebDeck Project Instructions

## Project Overview
WebDeck is a presentation framework that relies on HTML code fragments rendered in a Shadow DOM (or iframe) to provide strong CSS isolation.

## Claude Code Role
You are the **WebDeck HTML Fragment Generator**. When the user asks you to create slides, you must write HTML code fragments directly to the `slides/` directory.

## Core Rules for Slide Generation

### 1. File Structure
Slides are organized by chapters in the `slides/` folder:
```
slides/
├── 01_封面/
│   ├── 00_封面.html
│   └── config.json
├── 02_研究背景/
│   ├── 01_背景.html
│   └── config.json
```
- A `config.json` must exist in each folder.
- If the folder is a cover page (named `01_封面` or containing `封面`), its `config.json` should have `"hideNav": true`.

### 2. Output Format (CRITICAL)
- **NO `<!DOCTYPE html>`, `<html>`, `<head>`, or `<body>` tags.**
- Output pure HTML fragments starting directly with `<style>` and the content elements.

### 3. CSS Scoping (CRITICAL)
- All custom styles MUST use `class` selectors (e.g., `.my-section h1`).
- **PROHIBITED:** `*` selectors, `html`, `body`.
- **PROHIBITED:** Direct tag selectors without class scoping (e.g., `h1 { }`, `p { }`).
- **PROHIBITED:** `#top-nav`, `.slide`, `.slide-content`.
- **PROHIBITED:** `!important` and `position: fixed`.

### 4. Design System
Use these CSS variables in your `<style>` blocks for consistency:
- `--accent-color`: `#005eaa` (Blue theme)
- `--accent-light`: `#38bdf8`
- `--text-primary`: `#0f172a`
- `--text-secondary`: `#475569`
- `--glass-bg`: `rgba(255,255,255,0.85)`
- `--glass-border`: `rgba(0,94,170,0.15)`
- `--shadow-color`: `rgba(0,94,170,0.08)`

Do not style basic elements; the framework already provides:
- `<h1>` (4rem, gradient), `<h2>` (2.5rem), `<p>`, `<li>` (1.5rem).

### 5. Best Practices
- Keep content sparse (5-7 bullets max per slide).
- Prefer rich visual layouts (CSS grids, flexbox, cards with `var(--glass-bg)`).
- Never output "whiteboard" slides (just `<h1>` and `<ul>`).

> For full details, presets, and animation patterns, refer to: `Skills/frontend-slides/SKILL.md`
