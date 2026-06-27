# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build all browser targets
npm run build

# Build individual targets
npm run build:chrome

# Watch mode during development
npm run dev         # Chrome (default)
npm run dev:chrome

# Run tests
npm test
npm run test:watch

# CLI/API packages
npm run build:cli
npm run build:api

# Locale management
npm run update-locales
npm run check-strings
npm run add-locale
```

Build outputs: `dist/` (Chrome)

Tests use **Vitest**. Run a single test file with `npx vitest run src/utils/filters/date.test.ts`.

## Architecture

This is a browser extension (Chrome) with a CLI package and an API package.

### Extension entry points

- **`src/background.ts`** — Service worker/background script. Manages tab state, YouTube embed/innertube header rewriting via `declarativeNetRequest`, and Obsidian URL dispatch.
- **`src/content.ts`** — Content script injected into web pages. Manages the sidebar iframe, highlighter mode, and message passing between the page and extension.
- **`src/core/popup.ts`** — Main popup/side-panel UI logic. Orchestrates template selection, variable compilation, interpreter (LLM) runs, and final save actions.
- **`src/reader-script.ts`** / **`src/utils/reader.ts`** — Reader mode, injected as a separate iframe.

### Template engine pipeline

Templates use `{{variable|filter}}` syntax with `{% if %}` / `{% for %}` logic blocks.

1. **`src/utils/tokenizer.ts`** — Lexer that turns template strings into a token stream.
2. **`src/utils/parser.ts`** — Converts tokens into an AST (`TextNode`, `VariableNode`, `IfNode`, `ForNode`, `SetNode`).
3. **`src/utils/renderer.ts`** — Walks the AST, resolves variables, applies filters, and produces the final string.
4. **`src/utils/template-compiler.ts`** — Top-level coordinator: resolves CSS selector variables (`{{selector:…}}`) via the content script before rendering.
5. **`src/utils/filters.ts`** — Registry that imports every filter from `src/utils/filters/`. Each filter lives in its own file with a matching `.test.ts`.

### Content extraction

- **`src/utils/content-extractor.ts`** — Extracts page data (title, author, content, highlights, meta tags, schema.org) via the content script. Uses `defuddle` for article extraction and Markdown conversion.
- **`src/utils/shared.ts`** — Pure functions (no browser APIs) shared between the extension and CLI. `buildVariables()` constructs the `{{variable}}` dictionary from raw page data. `generateFrontmatter()` serializes properties to YAML.

### Data flow: clip → Obsidian

1. User activates extension → `content.ts` injects sidebar iframe.
2. `popup.ts` calls `content-extractor.ts` to scrape the page.
3. `template-compiler.ts` resolves and renders the selected template.
4. `obsidian-note-creator.ts` calls the `obsidian://` URI scheme (or writes a file, or copies to clipboard) depending on `saveBehavior`.

### Key types (`src/types/types.ts`)

- **`Template`** — A saved template: name, behavior (`create` | `append-*` | `prepend-*` | `overwrite`), `noteNameFormat`, `path`, `noteContentFormat`, `properties`, `triggers`.
- **`Settings`** — Global settings stored in extension storage: vaults, templates, LLM providers/models, reader settings, stats, history.
- **`Provider` / `ModelConfig`** — LLM provider connection info and per-model config for the interpreter feature.

### LLM interpreter

`src/utils/interpreter.ts` sends template prompt variables to a configured LLM provider (OpenAI-compatible API). Providers are stored in `Settings.providers`. The interpreter populates `{{prompt:…}}` variables before the template is rendered.

### Browser compatibility

- `src/utils/browser-polyfill.ts` wraps `webextension-polyfill` for cross-browser support.
- `src/utils/browser-detection.ts` detects Chrome at runtime.
- `src/utils/cli-stubs.ts` stubs out browser APIs for the CLI build.

### Localization

Strings live in `src/_locales/<lang>/messages.json`. `src/utils/i18n.ts` is the runtime accessor. Use `getMessage('key')` — never hardcode user-visible strings.

### Webpack builds

Browser targets are built with Webpack (config in `webpack.config.js`). CLI and API packages use esbuild (`scripts/build-cli.mjs`, `scripts/build-api.mjs`).
