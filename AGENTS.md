# Working on TEMPO

- Use Conventional Commits for commits and PR titles, for example `feat: add timer presets`, `fix: restore audio`, or `docs: clarify setup`. Squash merges must preserve a conventional PR title so release-please can determine the next version.
- Use `feat/` branches for new features.
- Keep this static app dependency-free unless a dependency has a clear benefit. `dist/` is source and deployable output.
- Run `node --test` and JavaScript syntax checks before opening a PR. Keep Polish and English interfaces in sync.
- Release-please manages `dist/app-metadata.json` and the release manifest. Do not manually bump release versions during feature work.
- Update the service worker cache when changing cached assets; include new offline assets in its precache list.
- Keep issue and PR templates compact.
