---
title: Metro OS
summary: A working Metro-style phone that runs in your browser. The OS is the website: every app carries its own notes on what's new, what improved, what was removed and what's coming next.
status: draft
---

## about

Metro OS is an independent, open-source take on the Metro design era: live tiles, big confident type, and motion that tells you where you are. It runs right here in the browser. There's nothing to install.

It's also the Metro OS website. Instead of reading about a feature on a separate page, you open the app and use it. Each app's notes (what it does, what changed, what's planned) live inside the OS, one tap away.

- **Hold any tile** and its shortcuts bloom out around it.
- **Hold and drag** a tile to move it.
- **Swipe left** (or press the arrow under the tiles) for every app.
- **Pull down** from the top for the action center.

> Metro OS is not affiliated with Microsoft. It uses its own name, its own four-diamond mark and open-licensed icons and type.

## what's new

### 0.3: every app is here
Phases 2, 3 and 4 land together. All thirty apps now open for real.

- **Free online services:** Maps (OpenStreetMap), Radio (thousands of live stations), Books (public-domain books from Wikisource), Podcasts, and Video with freely licensed open movies.
- **People and messages:** People, Phone, Messaging, Mail and Wallet. They start with a few made-up contacts; calls, texts and emails hand off to your own device.
- **Accounts and community:** Spotify and YouTube Music (sign in with an app ID only, no secret keys), the Store (wallpapers and live tiles, reviewed through GitHub), Live Tile Studio (design and pin your own tiles), Feedback and Browser.
- Music, Radio, Podcasts and videos now pause each other.
- Screen changes can no longer get stuck when the tab is in the background.

### 0.2: eleven everyday apps
Phase 1 is here: apps that work with nothing extra, no accounts and no keys.

- **Clock** with alarms, a timer and a stopwatch that keep running wherever you are.
- **Weather** from Open-Meteo: now, hourly and 10 days, for your city or your location.
- **Calculator** with a unit converter. **Notes**, with one pinned to start. **Calendar** with reminders.
- **Music** plays songs you add from your device, with a now playing screen and a queue you can reorder by dragging.
- **Photos**, **Camera** and **Recorder**, all saved in this browser. Set any photo as your wallpaper.
- **Files** and **Documents**: everything you make, in one place, with export.
- Live tiles and Bloom shortcuts now show your real data: next alarm, next event, the weather, your pinned note, what's playing.
- Full screen mode (press **F**), and full motion by default with a Motion setting.

### 0.1: the foundation
The first build of Metro OS in the browser.

- **Bloom tiles.** Hold a tile and its shortcuts fan out on the same grid, over a blurred start screen. Music gets playback controls, Mail gets compose and search, Settings jumps straight to the accent colour.
- **Hold and drag to move.** No separate "edit mode" needed just to rearrange. Bloom's *customize* shortcut still gives you resize and unpin.
- **Every screen has a link.** Share `#/info/music/roadmap` and it opens right there.
- **Notes inside the OS.** Every app has an overview, what's new, improved, removed, coming next, known issues and history.
- **Setup is optional.** Visitors land on a ready-made start screen; *make it yours* is offered, never forced.
- **Lock screen** with detailed status, notification counts and an optional PIN.
- **Action center** with quick actions (theme, sounds, full screen, brightness, motion, tile density) and notifications grouped by app.

## roadmap

### done: phase 0, foundation
- Shell, start screen, app list, lock screen, action center, app switcher
- Bloom, hold-and-drag, tile resize and unpin
- Notes for every app, search across them, update notifications
- Metro OS hub, Settings, Search

### done: phase 1, works with nothing extra
Clock, Weather, Calculator, Notes, Calendar, Music (your own files), Photos, Camera, Recorder, Files, Documents.

### done: phase 2, free online services
Maps (OpenStreetMap), Radio, Books (Wikisource), Podcasts, Video.

### done: phase 3, people and messages
People, Phone, Messaging, Mail, Wallet.

### done: phase 4, accounts and community
Spotify, YouTube Music, Store, Live Tile Studio, Feedback, Browser.

### next
- Offline support, so Metro OS opens without a connection.
- Tile folders: drop one tile on another to group them.
- Real mail accounts.
- Your votes decide the rest: see *community*.

## apps

Every app, with a link to its notes: what it does, what's new, what improved, what was removed and what's coming.

## gestures

- **Tap** a tile to open it.
- **Hold** a tile (about half a second) to open its Bloom. With a mouse, right-click does the same.
- **Hold and drag** a tile to move it. Other tiles make room.
- **customize** in a Bloom lets you resize or unpin, and drag any tile without holding.
- **Swipe left** on start for all apps. **Tap a letter** in the list for the letter grid.
- **Hold an app** in the list for pin, app info, what's new and copy link.
- **Pull down** from the status bar for the action center.
- **Hold back** for the app switcher; swipe a card up to close it.
- Keyboard: `Esc` goes back, `/` opens search, `Shift+F10` opens a focused tile's Bloom.

## principles

- **Content over chrome.** Type and space do the work; there are no drop shadows standing in for hierarchy.
- **Glanceable.** A tile should tell you something before you open it.
- **Motion with meaning.** Turnstiles and flips show where you came from and where you're going. *Reduce motion* turns them off.
- **Honest.** Unfinished apps say so and show their plans instead of pretending.
- **Yours.** Accent colour, wallpaper, tile size and layout are one hold away.

## get it

- **Right here.** Metro OS runs in any modern browser, on a phone or a computer.
- **Install it.** In Chrome or Edge, use *Install app* / *Add to home screen* to give it its own window.
- **Android.** The Metro OS launcher for Android 11 and up is described on the old site. Download links will return here once builds are public.

## community

Metro OS is built in the open. The Feedback app writes a clear GitHub issue for you, and ideas are ranked by 👍 reactions. Wallpapers and live tiles for the Store arrive as pull requests to `store/catalog.json`.

## faq

**Is my data sent anywhere?**
No. Your layout, theme, notifications and PIN are stored in this browser only.

**Why do some apps start with made-up people?**
People, Phone, Messaging and Mail start with a few invented contacts so there's something to see. Their numbers and addresses are reserved for fiction; add your own and delete theirs any time.

**Do Spotify and YouTube Music need my password?**
No. You sign in on Spotify's or Google's own page. Metro OS only ever holds a short-lived access token, in this browser.

**Does it work offline?**
Not yet. It's next on the roadmap.

**Where are my photos, songs and documents kept?**
In this browser, on this device. Files › storage shows how much space they use and can ask the browser to keep them.

## credits

- Icons: [Font Awesome Free](https://fontawesome.com/license/free), CC BY 4.0.
- Type: [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans), SIL Open Font License. Open Sans and Inter are optional.
- Sounds are synthesised in the browser; Metro OS ships no audio recordings.
- Album art and photos in the demo are Metro OS's own.
- Maps: © OpenStreetMap contributors, drawn with Leaflet; search by Photon.
- Books from Wikisource; Browser articles from Wikipedia (CC BY-SA 4.0). Open movies from Wikimedia Commons, each shown with its own licence.
- Radio stations from the Radio Browser directory; podcast search from Apple's public directory.

## history

### 0.3 · 2026-09-21 · every app is here
- Maps, Radio, Books, Podcasts, Video.
- People, Phone, Messaging, Mail, Wallet.
- Spotify, YouTube Music, Store, Live Tile Studio, Feedback, Browser.
- Media apps pause each other; transitions can't stall in a background tab.

### 0.2 · 2026-09-21 · eleven everyday apps
- Clock, Weather, Calculator, Notes, Calendar, Music, Photos, Camera, Recorder, Files, Documents.
- Live tiles and Bloom shortcuts show real data.
- Full screen mode; Motion setting.

### 0.1 · 2026-09-21 · the foundation
- Shell, start screen with live tiles, app list with letter grid, lock screen, action center, app switcher.
- Bloom tiles; hold and drag to move; resize and unpin.
- Notes for every app, search, update notifications, desktop companion panel.
