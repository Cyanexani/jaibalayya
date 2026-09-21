# Metro OS

A working Metro-style phone that runs in the browser, and the Metro OS website at the same time.
Every app carries its own notes: an overview, what's new, what improved, what was removed, what's
coming next, known issues and its history.

> **Metro OS is not affiliated with, endorsed by, or connected to Microsoft Corporation.**
> "Windows Phone" and "Metro" are mentioned only to describe the design era this project builds on.
> Metro OS uses its own name, its own four-diamond mark, and openly licensed icons and type.

## Run it

```bash
python tools/serve.py        # http://localhost:8000 (no caching, so edits show on reload)
```

Any static host works. It deploys to GitHub Pages from `main` through `.github/workflows/pages.yml`
(turn Pages on once: **Settings → Pages → Source: GitHub Actions**).

## Using it

| Do this | To |
|---|---|
| Tap a tile | open the app |
| **Hold** a tile (or right-click it) | open its **Bloom**: shortcuts fan out around it |
| **Hold and drag** a tile | move it |
| *customize* in a Bloom | resize, unpin, drag freely |
| Swipe left / *All apps* | the app list; tap a letter for the letter grid |
| Hold an app in the list | pin, app info, what's new, copy link |
| Pull down from the top | action center |
| Hold back | app switcher |
| `Esc` / `/` | back / search |

Every screen has a link, e.g. `#/info/music/roadmap`, `#/app/settings/theme`, `#/app/hub/gestures`.
On a wide screen the phone sits in a frame and the panel beside it shows the notes for whatever is open.

## Writing the notes

The notes are plain Markdown. Edit a file and the notes page, the side panel, search and the
update notifications all pick it up.

```
content/os.md              Metro OS as a whole (the "Metro OS" hub app)
content/apps/<id>.md       one per app
```

Each file has front matter and `## section` headings. The `## history` section lists versions,
newest first, as `### <version> · <date> · <headline>`. When a visitor comes back and an app's
newest version has changed, they get a notification that links to its *what's new*.

```md
---
title: Music
summary: One line shown under the title.
status: draft            # remove once the notes are real
---
## overview
## what's new
## improved
## removed
## coming next
## known issues
## history
### 0.2 · 2026-10-05 · queue reordering
- …
```

## Code

No build step and no dependencies: plain ES modules and CSS.

```
index.html
assets/os/css/     os.css (shell, tiles, Bloom, lock…), controls.css, site.css (desktop frame + side panel)
assets/os/js/
  main.js          boot
  shell.js         status bar, navigation bar, routing between home, apps and notes
  registry.js      every app: icon, colour, phase, tile sizes, Bloom shortcuts
  start.js         start screen: live tiles, hold → Bloom, hold-and-drag, edit mode
  bloom.js         places shortcuts on the grid around a held tile
  applist.js       app list, letter grid, hold menu
  lock.js          lock screen and PIN pad
  actioncenter.js  quick actions and notifications
  content.js       loads and parses the notes; search; update checks
  apps/            built apps: hub, settings, search, setup, and the notes page (info.js)
content/           the notes
tools/check.mjs    run before deploy: every app has notes, every referenced file exists
tools/serve.py     local server
```

To ship an app: add `assets/os/js/apps/<id>.js` exporting `default function mount(ctx)`, then set
`built: true` on its entry in `registry.js`. Until then, tapping it opens its notes.

## Build phases

| Phase | Apps |
|---|---|
| 0 · foundation | shell, Bloom, notes, Metro OS hub, Settings, Search |
| 1 · works with nothing extra | Clock, Weather, Calculator, Notes, Calendar, Music, Photos, Camera, Recorder, Files, Documents |
| 2 · free online services | Maps, Radio, Books, Podcasts, Video |
| 3 · demo data | Phone, Messaging, People, Mail, Wallet |
| 4 · accounts and community | Spotify, YouTube Music, Store, Live Tile Studio, Feedback, Browser |

The previous Metro OS marketing site lives on the `old` branch.

## Credits

Icons: [Font Awesome Free](https://fontawesome.com/license/free) (CC BY 4.0). Type: Noto Sans
(SIL OFL). Sounds are synthesised in the browser. Demo artwork and photos are Metro OS's own.
