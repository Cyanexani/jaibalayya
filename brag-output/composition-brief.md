# Composition Brief: Metro OS ROM trailer (full song)

## Objective
A keynote-style trailer for Metro OS as a custom ROM running on real Android phones.

## Output
- Renderer: `brag-output/motion/trailer.html` (hand-drawn canvas 2D, no Hyperframes or GSAP)
- Rendered video: `brag-output/brag.mp4`, poster `brag-output/brag.jpg`
- Format: landscape, 1920x1080, 30 fps
- Duration: 64.41s

## Source Material
- Product name: Metro OS
- Positioning: a custom ROM for Android; the website is only a showcase
- Key UI to recreate: boot mark, lock screen, live-tile start screen, Bloom, notification banner and count tile, the 30-app wall, the incoming call and green call chip, the four-diamond mark
- On-screen copy (all the project's own, no lyrics):
  - Remember Windows Phone? / Reimagined for Android.
  - Live tiles. / Big, confident type. / Motion that tells you where you are.
  - Swipe up to begin.
  - Make it yours. / Twenty accent colours.
  - Wallpapers. / Wave · Aurora · Ember · Dusk
  - Any size. / Small · Medium · Wide · Large
  - One hold away. / Accent. Wallpaper. Size. Layout.
  - Light. / Or dark.
  - Meet Metro OS. / A whole new home screen.
  - Hold any tile. / Its shortcuts bloom out around it.
  - The tile is the notification. / Count. Flip. Live. Quiet.
  - Every app is here. / 30 apps. Every one a live tile.
  - Calls ring through. / When they matter.
  - A custom ROM for Android. / Your phone. The Metro way.
  - Metro OS is not affiliated with Microsoft. (small, as in the README)

## Creative Direction
- Apple keynote: black stage, one lit phone with a glass sheen, Noto Sans 600 headlines at -0.035em, grey sublines, fade-rise-blur reveals
- Match cuts: boot mark → lock screen; dive into the "5:44" clock; Messaging tile → app wall; Phone tile → call screen; call → green chip; diamonds → final logo
- Motion blur: each frame averages sub-frames across a 180° shutter (8 samples, 20 in fast moves)
- Windows Phone is named only to describe the design era, as the README does; no Microsoft logos or marks; no song lyrics on screen

## Storyboard (video time)
1. Cold open — 0.00-9.45 — phone turns out of darkness, boots on the downbeat, diamonds one per beat, spin into the lock screen, dive into the clock
2. Principles — 9.20-14.95 — tile mosaic, big type, a progress line, panorama pan
3. Unlock — 14.17-17.64 — "Swipe up to begin.", tile rows land on beats
4. Make it yours — 17.64-29.80 — accents sweep the grid one per beat, wallpapers wipe in, the Weather tile resizes, "One hold away."
5. Break — 29.80-33.29 — light theme on the silent gap, back to dark, dive into the Photos tile
6. Pre-chorus teases — 33.29-40.26 — Photos flip, letter grid, app switcher, action center, full-frame tile hits, diamonds converge
7. Chorus hero — 40.26-51.10 — burst into "Meet Metro OS.", Bloom, banner, tile flip and count
8. App wall — 50.68-52.63 — Messaging tile flies into the burst wall; Phone tile zooms
9. Call — 52.60-54.17 — rings, answer tap, collapse to the chip
10. Phone row — 54.17-59.38 — five phones rise one per beat, each set up its own way
11. Outro — 59.38-64.41 — diamonds land one per beat, wordmark, two end lines, fade

## Audio
- Music: `composition/assets/music/sucker.mp3`, song 0.90–65.31 straight through, volume 0.82, built by `motion/build_audio.sh`
- Cue guidance: `composition/assets/music/cues/sucker.music-cues.json`, 139.67 BPM
- Audio-reactive: per-frame bass (`motion/bass.js`) drives the glow behind the phone and the mark
- SFX: 54 cues from the brag library, motion-matched, run through a limiter
