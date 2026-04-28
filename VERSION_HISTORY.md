# Duo Finance App Version History

## V1 - 2026-04-28

This is the first saved baseline version of the app.

### Main Features

- Mobile-first dual-person finance app UI.
- Supabase-ready authentication, household setup, invite code, cloud sync structure.
- Personal and shared ledger support.
- Shared expenses can be included in monthly settlement.
- Personal monthly view can account for shared ledger settlement.
- Monthly settlement ratio can be customized, for example 60% / 40%.
- Quick expense entry on overview page.
- Quick category strip with recent categories and selectable shortcut categories.
- Calculator-style amount input for mobile use.
- Recent expense repeat shortcuts.
- Detail page with personal/shared account filtering.
- Detail page total amount for the current filter.
- Record management mode for edit/delete actions.
- Category page with custom categories and icon selection.
- Category icon library with common daily-life icons.
- Fixed monthly expenses that can be added into the month.
- Theme options including Neon Dark, Dream Glow, Clean White, and Wise Green.
- PWA assets and app icon support.
- Local preview helper file: `START_APP.bat`.

### Verification

- TypeScript check passed with `npx tsc -b`.
- ESLint has no errors.
- Existing hook dependency warnings remain and are not blocking V1.

### Notes

- `node_modules`, build output, temporary Vite logs, and local environment files are not part of the saved release package.
- Supabase project settings and environment variables remain outside the code package.
