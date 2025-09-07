# tasks-codex audit

## Codebase Issues
- [ ] InputsPanel.tsx has unused imports and state variables (`useQuery`, `ReturnsChart`, `PriceChart`, `requested`, `setRequested`).
- [ ] page.tsx imports `InputsPanel` but does not use it.
- [ ] No test script configured in `package.json` (`npm test` fails).
- [ ] `npm run build` fails because Next.js cannot fetch fonts `Geist` and `Geist Mono`.
