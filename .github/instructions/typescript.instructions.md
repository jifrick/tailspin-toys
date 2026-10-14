---
description: 'TypeScript documentation, formatting, and API conventions'
applyTo: '**/*.{ts,tsx}'
---

# TypeScript Instructions

## Documentation

- Explain intent and non-obvious decisions; do not restate code mechanics.
- Add TSDoc/JSDoc to exported functions with a purpose, `@param` entries, and an `@returns` entry.
- Keep exported interfaces and types documented when their purpose is not obvious from the name.
- Update or remove stale comments in the same change as the related code.

## Formatting and Types

- Use four-space indentation, single quotes, semicolons, and trailing commas in multiline structures.
- Use explicit parameter and return types for exported functions.
- Prefer `import type` for type-only dependencies.
- Avoid `any`; use a narrower type or document why an exceptional use is required.
- Use `camelCase` for functions and variables, `PascalCase` for types and interfaces, and `UPPER_SNAKE_CASE` only for module-level constants.
