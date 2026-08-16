# Shreya's Portfolio — how this folder works

This folder is the **source of truth** for the portfolio site. The folder structure IS the
information architecture:

- **Single-name folders are pages** — `Homepage/`, `About/`, `Work/`, and each project
  folder inside `Work/` (e.g. `Work/NCR/`) is a project page.
- **`*.section` folders are sections** on their parent page. Images inside them are used
  for display.
- **Every page/section has a markdown file** that controls its content. Edit the md file,
  refresh the browser — done. No build step.

## The code

`index.html`, `style.css`, `script.js` — a static site that reads the md files at runtime.

Run it locally:

```sh
cd ~/Documents/Portfolio && python3 -m http.server 8090
```

then open http://localhost:8090. (It must be served over http — opening index.html
directly as a file won't load the md content.)

## Content files — edit these to update the site

| File | Controls |
|---|---|
| `site.md` | Socials, email, resume link, footer "chat about" chips |
| `Homepage/page.md` | Hero: photo, title, tagline, about paragraph, location, pop-out mug |
| `Homepage/chat.section/section.md` | The chat widget's greeting + canned reply lines |
| `Homepage/tools.section/section.md` | Tool icons (images in that folder) |
| `Homepage/brands.section/section.md` | Brand logos in the auto-scrolling carousel (images live in `Homepage/transparent logos/`) |
| `About/page.md` | Only `# What I'm about` is rendered now (story card). The `Experience`, `Where I see me`, `What I do best`, and `More work` sections are still in the file but not shown anywhere — kept in case you want them back. |
| `About/hobbies.section/section.md` | Feeds the one photo carousel on About — each image's `| caption` field is its filename-derived caption, arrows/dots included. (`About/outdoor.section/` is currently empty and unused — drop images in and list them there to bring it back into the mix, see `renderCarousel` call in `script.js`'s `boot()`.) |
| `Work/page.md` | Project cards (`featured: yes` = also shown on Home, `tint` = thumbnail color, `cover` = image path shown instead of the flat tint) and the career timeline |
| `Work/<Project>/project.md` | One per project folder: case-study text + image gallery |
| `Work/testimonials.section/section.md` | 3 testimonial blocks (`quote`/`name`/`role`) shown at the bottom of Work — leave a block's `quote` empty to show a "coming soon" placeholder box |
| `site.md`'s `spotify:` field | Paste a Spotify share/embed URL (e.g. `https://open.spotify.com/playlist/...`) here to make the About page's Spotify box live — `script.js`'s `spotifyEmbedUrl()` converts it to the oEmbed-equivalent `/embed/` iframe automatically |

`Homepage/skills.section/` still has content but isn't rendered anywhere right now (the
skills-chips box was dropped from the homepage redesign) — kept in case you want it back.

## Design system

**Light neobrutalism, calmed down a notch.** Cream page background (`#F2EEE3`, with a subtle
dot-grid texture) instead of the old navy; every bento box is a warm off-white card (`#FFFBF3`,
not stark pure white — it reads calmer against the cream bg) with a thick navy border
(`3px solid #1B264F`). Shadows are hover-only now — no shadow at rest, `box-shadow: var(--shadow)`
(`5px 5px 0 #1B264F`, no blur — the flat "sticker" shadow, not a soft glow) appears on `:hover`.
Interactive cards (project cards, the resume paper) also lift on hover — they translate
up-left and the shadow grows to `7px 7px 0`. Yellow (`#FFD23F`-ish, see `--yellow`) is the one
accent color: the active nav tab, the chat card fill, send/CTA buttons, carousel arrows, and
timeline dots. Project-card thumbnails show a `cover` image when the project has one (set per
project in `Work/page.md`, art lives in `Homepage/covers/`) and fall back to a flat pastel
`tint` block otherwise. The wordmark logo switched back to the original dark
`Homepage/mylogo.png` (not the cream-recolored one) since it now sits on a light background.
The resume paper (top-right of the intro card) is pure white (`#FFFFFF`), a shade brighter
than the other cards, and just shows the "Resume" title + fake text lines — no "Open ↗" label.
Fonts: **Montserrat** for headings, **Hind** for body copy, nav/footer labels, and (in
italic) accent lines like the tagline. Page content is capped at `1240px` (`.page`'s
`max-width`).

The header is `position: sticky` (stays pinned near the top while you scroll, like
marco.fyi's nav), styled as the same white/navy-border card so it reads clearly over
whatever scrolls beneath it.

The hero is a 4-column aligned grid — photo, "who is she" text, and chat are each a single
box spanning the full height; only the map/tools column splits into two stacked boxes (map
taller, tools shorter). Below that: the brands carousel, then every `featured: yes` project
card from `Work/page.md`, laid out as **two independent flex columns** (`.projects-masonry` /
`.masonry-col` in `style.css`, built in `script.js`'s `renderWork()`) rather than a strict
equal-height grid — each card's height comes from its own content (a longer title makes a
taller card), which is what gives the "varied size" bento look. Cards alternate into the two
columns by index (odd → left, even → right) — add or remove a `featured: yes` project and the
columns just redistribute. Every box size in the hero row is otherwise a fixed px value set
per breakpoint in `.bento-grid`'s `grid-template-rows` (see the "responsive" section of
`style.css`) — box size only changes because the viewport crossed a breakpoint, never because
content inside a box (e.g. chat messages) grew.

The hero photo (`Homepage/meee.jpeg`) is used as-is, uncropped by hand — no background-removal
cutout. (The old cutout files, `meee-cutout.png` / `meee-removebg-preview.png`, are unused now
but left in place in case you want that look back.) The map card is a real screenshot
(`Homepage/atlanta-map.jpg`, cropped to strip out the Maps app's UI chrome) rather than an
illustration. The coffee mug sits inline in the tools row, sized a bit larger than the tool
icons so it still stands out — note in `script.js`'s `renderTools()`: since the icon row is
rebuilt from `tools.section/section.md` on every load, the mug element is deliberately
re-appended after that rebuild, or it would get wiped out.

### Micro-interactions & sound

Four short sound effects live in `sfx/` (`paper-turn.wav`, `coffee-brew.wav`,
`imessage-send.wav`, `imessage-receive.wav`) — all synthesized locally (see the generation
notes in git history), not ripped from iOS, so they're original assets safe to ship. Browsers
block audio until the visitor has clicked/tapped somewhere on the page at least once; after
that, sounds play normally. Behavior:

- **Resume paper** — click plays a page-turn sound and a quick flip animation, then opens
  the PDF in a new tab.
- **Coffee mug** — hovering (or focusing via keyboard) raises steam and plays a brewing
  sound.
- **Chat widget** — a scripted mini-chat, not a live connection to Shreya. It opens showing
  just the greeting; clicking anywhere on the chat card plays the send sound and starts the
  script — an outgoing "Yes, definitely!" bubble, then (after the receive sound, 500ms later)
  an incoming "What's your name?" bubble that unlocks the input for one reply. Edit the
  greeting in `Homepage/chat.section/section.md`; the scripted lines and the click-to-start
  wiring live in `initChat()` in `script.js`.

### About page: photo carousel + Spotify

The About page is just the story card, then a photo carousel + Spotify box below it. The
carousel (`renderCarousel()` in `script.js`) reads `About/hobbies.section/section.md` —
each bullet's `| caption` text (by convention, the filename in plain words, e.g.
`Climbing rocks.jpeg | Climbing rocks`) becomes that photo's caption, and it changes as you
click the arrows or a dot. Add more photos there and they show up automatically.

The Spotify box: paste a Spotify link — a track, album, or playlist "Share" link works as-is
(no need to manually build the embed URL) — into `site.md`'s `spotify:` field. `script.js`'s
`spotifyEmbedUrl()` extracts the type + ID and points the iframe at Spotify's `/embed/` path
(the same thing their oEmbed endpoint would return), replacing the "coming soon" placeholder
with a live embedded player. Leave the field blank to keep the placeholder.

### Work page: testimonials

`Work/testimonials.section/section.md` holds 3 `## ` blocks of `quote` / `name` / `role`. Fill in
a block to show a real testimonial card; leave `quote` empty and that box shows a dashed
"coming soon" placeholder instead — always keep exactly 3 blocks so the row of boxes stays even.

## Formats (quick reference)

- `key: value` lines set fields (photo, title, tagline, …).
- `# Heading` starts a section inside a file; `## Subheading` inside About's story.
- `- a | b | c` bullet lines are list items with `|`-separated fields — each md file
  has a comment line showing its field order.
- `**bold**`, `*italic*`, and `[link](url)` work in text.

## Adding things

- **New project:** make a folder in `Work/`, drop images in, create `project.md`
  (copy one from an existing project), then add a `- folder: <FolderName> | …` line to
  `Work/page.md` under `# Projects`. Pick a `tint` pastel that complements the palette (used
  as a fallback color if you don't set a `cover` image, and briefly while the cover loads).
- **New gallery image:** drop the image into the `.section` folder and list its filename
  in that section's `section.md` under `# Images`.
- **New timeline entry:** add a `- [Company](url) | role | year | highlights; separated;
  by semicolons | #dotcolor` line under `# Timeline` in `Work/page.md`.
- **Design references** (`Homepage/Homepage All.png`, `About/About.png`, `Work/Work.png`,
  `Homepage/inspiration/`, `Homepage/wireframe-homepage.heic`, `design system/`) are kept
  for reference; they are not shown on the site.

## Before publishing for real

A few photos are 2–7 MB (`Work/IMG_8319.jpeg`, `Work/NCR/IMG_9073.jpeg`,
`Work/NCR/IMG_2610.jpeg`, and most of `About/hobbies.section/`). Compress/resize them
(~1600px wide, "export for web") so pages load fast. The whole folder deploys as-is to any
static host (GitHub Pages, Netlify, Vercel).
