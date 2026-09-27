# Brag Plan: Metro OS

## What is this app?
Metro OS is a custom ROM for Android phones: a Metro-style home screen with live tiles, Bloom shortcuts, notifications that live on the tile, and calls that ring through when they matter. The website is only a showcase of it.

## The angle
"Your Android phone. Reborn in Metro." Launch it like an Apple keynote film: black stage, one lit phone, big confident type, match cuts instead of wipes, all cut inside the song on its downbeats.

## Hook (0.00-9.45s)
Darkness. A phone turns from edge-on under "Your Android phone." On the downbeat it powers on and the four diamonds boot one per beat under "Reborn in Metro." The boot mark spins into the lock screen, and the camera dives into the "5:44" clock (match cut).

## Key moments (the middle)
- Metro principles, one per bar: "Live tiles." (a mosaic turns in), "Big, confident type.", "Motion that tells you where you are." A panorama pan to "Swipe up to begin." and the lock screen swipes away.
- The rest of the verse, on the same phone: "Make it yours." (the tiles recolour through the accent colours one per beat, with the Settings swatch grid), "Wallpapers." (Wave, Aurora, Ember, Dusk wipe in), "Any size." (the Weather tile lifts out: small, wide, large), "One hold away."
- The break: the song's silent gap flips the whole frame to the light theme ("Light."), then back ("Or dark."), and the camera dives into the Photos tile.
- Pre-chorus build, cuts getting faster: a Photos tile flipping, a count rolling 1 → 4, a Bloom, a call ringing, full-frame Music / Maps / Weather tile hits, then the diamonds converge.
- Chorus drop: the diamonds burst and the phone slams up into "Meet Metro OS." Bloom ("Hold any tile."), then the lifted Messaging tile flips and counts ("The tile is the notification.").
- The Messaging tile flies into its slot as the 30-app wall bursts around it ("Every app is here."). The Phone tile zooms open into the call ("Calls ring through."), and the call collapses into the green chip.
- Post-chorus: five phones rise one per beat, each with its own accent, wallpaper or light theme, flip their live tiles, and drop away.

## Outro / punchline
The mark lands one diamond per beat and "METRO OS" rises letter by letter. "A custom ROM for Android." holds through the song's dropout; "Your phone. The Metro way." lands when the music comes back.

## User flow worth showing
Boot → lock screen → swipe up → hold a tile (Bloom) → a notification arrives on its tile → open an app → answer a call.

## Tone
- Preset: app-store
- Creative direction: Apple keynote trailer: black, a lit phone with a glass sheen, Noto Sans 600 headlines with grey sublines, fade-rise-blur reveals.
- Interpretation: slow cold open, then faster beat cuts through the pre-chorus, and match cuts through the chorus. Every frame is hand-drawn on canvas (no Hyperframes or GSAP), with real motion blur from averaged sub-frames.

## Format: landscape — 1920x1080, 30 fps
## Duration: 64.41s (the song straight through, 0.90-65.31)

## Visual identity (from the project)
- Background: #000; lock gradient #0a1a5c → #1a3fa8
- Accent: #1ba1e2; mark gradient #4FDCF2 → #2A86FF → #7A4DFF
- Text: #fff, sublines #a1a1a6
- Font: Noto Sans 300/400/600 (bundled), Font Awesome Free 6.6 icons
- Strongest visual element: the live-tile start screen and the four-diamond mark
- App tile colours from registry.js (30 apps)

People's names in UI are fictional stand-ins. No song lyrics on screen.

## Share copy
Metro OS: your Android phone, reborn in Metro.
A custom ROM with live tiles, Bloom shortcuts, notifications that live on the tile, and calls that ring through when they matter.

## Audio direction
- Music: user-supplied "Sucker" (Jonas Brothers), song 0.90–65.31 with no cuts (video = song − 0.90), 0.83 s fade out:
  intro and verse 0–17.6, rest of the verse 17.6–29.8, break 29.8–33.3, pre-chorus 33.3–40.3, chorus 40.3–54.2, post-chorus 54.2–59.4, last bar and dropout 59.4–62.4, music returns 62.4
- Beat grid: 139.67 BPM (beat 0.433 s, bar 1.74 s), from analyze_music_cues.py
- Audio-reactive: bass energy drives the glow behind the phone and the mark
- SFX: boot drops and glass on the diamonds, picker clicks on the accents, slides on the wallpapers, chips on the resizes, a switch on light and dark, card places on the phone row, card slides on moves, chip lays on counts, card fans on bursts, a click on the answer tap, soft impacts and a bell on the logo; limited to -3.3 dB peak

## Build
- Renderer: `motion/trailer.html` (canvas 2D), `motion/render.cjs` (headless Chromium → ffmpeg, 6 workers)
- Soundtrack: `motion/build_audio.sh` → `music.wav`, `mix.wav`
- Output: `brag.mp4`, poster `brag.jpg` (frame at 41.95 s, baked into frame 0)
