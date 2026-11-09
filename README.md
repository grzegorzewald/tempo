# TEMPO

Full-screen fitness timer with Polish and English interfaces, selected from the browser language.

- EMoM: a configured number of one-minute cycles.
- Intervals: alternating work and rest durations, with cycles starting at 1.
- Countdown and transition sounds; mobile audio initialization.
- Up to 16 presets and settings stored in localStorage. No application database.
- Installable offline app, with a service worker and web app manifests.
- Compact mobile-landscape controls; separate portrait and desktop layouts.

## Run locally

This is a static HTML/CSS/JavaScript app with no build step or package dependencies.

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Audio is enabled through user interaction. Offline installation requires HTTPS in production (localhost also supports service workers).

## Files

- `dist/`: application source and directly deployable static files.
- `.openai/hosting.json`: existing Sites project identity and static hosting configuration.
- `.github/workflows/checks.yml`: JavaScript and manifest validation on pushes, pull requests, weekly, and on demand.
- `.github/dependabot.yml`: weekly GitHub Actions dependency update checks, Mondays at 08:00 Europe/Warsaw.

There are no npm dependencies to update. Add a Dependabot ecosystem entry if package dependencies are introduced.

## Contributing

Use Conventional Commits for commits and PR titles, such as `feat: add presets` or `fix: restore sound`. Squash merges must retain the conventional PR title; release-please uses it to choose the next version. Use `feat/` branches for features.

Run the dependency-free unit tests with `node --test`. Every PR runs them alongside JavaScript syntax and manifest validation. The compact issue and PR templates cover both bugs and small improvements.

## Releases and deployment

Release-please opens a release PR on `main` from Conventional Commits. Merging that PR creates a GitHub release and deploys its exact commit from `dist/` to GitHub Pages in the same workflow. Ordinary feature merges do not deploy. The initial version is `0.1.0`.

Release-please uses its Node strategy to keep the JSON versions in `package.json`, `.release-please-manifest.json`, and `dist/version.json` in sync. There are no npm dependencies or build step. `dist/version.json` also holds `repository`, `homepage` (Pages URL), and `bugs` (issue tracker URL); edit these to change the About dialog links. Release updates change only its version and preserve these URLs. The About dialog reads the JSON file, including offline, so its version matches the release. Release artifacts receive a version-specific service worker cache.

One-time repository settings: select **GitHub Actions** under **Settings → Pages → Build and deployment**, and enable **Allow GitHub Actions to create and approve pull requests** under **Settings → Actions → General**. The workflow uses the built-in `GITHUB_TOKEN`; no personal token is required. If branch protection requires checks on release-please PRs, set the optional `RELEASE_PLEASE_TOKEN` secret to a GitHub App token (or a fine-grained token with contents and pull requests write access), since PRs created by `GITHUB_TOKEN` do not trigger other workflows automatically.

For other hosts, serve `dist/` over HTTPS. The existing Sites deployment remains separate. When changing cached app files, increment the cache version in `dist/sw.js` and precache any new offline assets.
