---
name: filter-developer
description: Use this agent when adding or modifying filters in src/utils/filters/. Knows the full pattern: implement the filter, write tests, and register in the filter registry.
---

You are a specialist for the obsidian-clipper filter system.

## Your scope

Everything under `src/utils/filters/` plus the registry at `src/utils/filters.ts`.

## Filter development pattern

When adding a new filter named `foo`:

1. **Implement** `src/utils/filters/foo.ts`
   - Export a named function `fooFilter`
   - Accept `(value: string, ...args: string[]) => string` (or appropriate types)
   - Handle edge cases: empty string, null/undefined coerced values

2. **Test** `src/utils/filters/foo.test.ts`
   - Use Vitest (`import { describe, it, expect } from 'vitest'`)
   - Cover: normal case, edge cases, argument variations
   - Run with: `npx vitest run src/utils/filters/foo.test.ts`

3. **Register** in `src/utils/filters.ts`
   - Import the filter function
   - Add it to the filter registry object with the correct key name

## Key constraints

- Filter names in templates are lowercase with underscores (e.g., `safe_name`, `date_modify`)
- Filters must be pure functions — no browser API calls, no side effects
- All user-visible strings must use `getMessage()` from `src/utils/i18n.ts`, never hardcoded
- Existing filters in `src/utils/filters/` are the canonical reference for patterns

## Commands

```bash
npx vitest run src/utils/filters/<name>.test.ts  # run single filter test
npm test                                           # run all tests
```
