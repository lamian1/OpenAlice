# Bilingual UI Localization Release Notes

## Summary

This update adds a switchable bilingual user interface for OpenAlice, with Chinese and English support across the main web UI.

## Highlights

- Added a shared i18n layer with persistent locale switching.
- Introduced centralized copy dictionaries for reusable UI terms.
- Localized the main pages, management panels, and trading-related UI.
- Normalized several backend-originated error messages for bilingual display.
- Added locale-aware formatting for dates, times, and numbers.

## User-Facing Changes

- Sidebar language switch now supports Chinese and English.
- Core pages now support bilingual copy:
  - Chat
  - Trading
  - Portfolio
  - Events
  - Heartbeat
  - AI Provider
  - Connectors
  - News
  - Tools
  - Agent Status
  - Dev
  - Market Data
  - Settings
- Shared UI elements such as save states, reconnect actions, approval panels, snapshot details, and input prompts now follow the active locale.

## Internal Changes

- Added `ui/src/i18n/index.tsx` for locale state, phrase lookup, and error translation.
- Added `ui/src/utils/locale.ts` for locale-aware formatting helpers.
- Moved repeated UI labels toward centralized dictionary usage to reduce hardcoded copy.

## Validation

- Frontend TypeScript and production build completed successfully with `pnpm --dir ui build`.

## Notes

- The repository now shows commit `0709db2` on GitHub under `lamian1/OpenAlice`.
- Codacy analysis was not run because the current environment does not provide a usable Codacy CLI installation path.