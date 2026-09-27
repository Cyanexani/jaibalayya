# Metro OS trailer

A 64 s keynote-style trailer, cut to the whole of the song's opening minute, for Metro OS as a custom ROM, drawn frame by frame on a canvas (`motion/trailer.html`).

- `brag-video-only.mp4`: the finished picture, with no audio. The soundtrack is a commercial song, so it is not in the repo.
- `brag.jpg`: the poster frame.
- `brag-plan.md`, `composition-brief.md`: the plan and storyboard.
- `share-copy.txt`: the post caption.

## Rebuild with the soundtrack

Put the song at `composition/assets/music/sucker.mp3`, then from `motion/`:

```sh
./build_audio.sh    # trims the song and mixes the SFX into mix.wav
ffmpeg -i ../brag-video-only.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart ../brag.mp4
```

## Re-render the picture

Serve the repo root on port 8765 (`python3 -m http.server 8765 --bind 127.0.0.1`), then from `motion/`:

```sh
node render.cjs stills 12.5,26.3   # preview frames into stills/
node render.cjs video 6            # render seg0-5.mp4 with 6 workers
ffmpeg -f concat -safe 0 -i segs.txt -i mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart -shortest trailer.mp4
```

Needs Playwright with Chromium, and ffmpeg.
