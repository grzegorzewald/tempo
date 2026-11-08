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

## Deployment

Serve `dist/` over HTTPS. The existing Sites deployment remains separate from this GitHub repository; pushing here does not automatically redeploy it. When changing cached application files, increment the cache version in `dist/sw.js`.
