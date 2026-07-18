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
| `Homepage/page.md` | Hero (cutout photo, title, tagline, about, location, pop-out mug), "How I shape user experiences" |
| `Homepage/skills.section/section.md` | Skill chips |
| `Homepage/tools.section/section.md` | Tool icons (images in that folder) |
| `Homepage/brands.section/section.md` | Brand logos in the auto-scrolling carousel |
| `About/page.md` | Story, experience list, "Where I see me", "What I do best", "More work" |
| `About/hobbies.section/section.md` | Hobbies photo gallery |
| `About/outdoor.section/section.md` | Outdoors photo gallery |
| `Work/page.md` | Project cards (home + work pages, `tint` = card color) and the career timeline |
| `Work/<Project>/project.md` | One per project folder: case-study text + image gallery |

## Design system

Dark charcoal background; every card is a colored box (cream, orange, deep blue,
lavender, pink, yellow, green — CSS variables at the top of `style.css`). Elements
pop out of their boxes: the hero photo cutout (`Homepage/meee-cutout.png`), the coffee
mug (`Homepage/tools.section/coffee-cutout.png`), and the paperclipped resume paper.
The cutouts were generated from the originals with macOS Vision (background removal) —
to redo one, ask Claude Code to regenerate it from a new source photo.
Fonts: Nunito for all content; Inter for the header tabs and footer links.

## Formats (quick reference)

- `key: value` lines set fields (photo, title, tagline, …).
- `# Heading` starts a section inside a file; `## Subheading` inside About's story.
- `- a | b | c` bullet lines are list items with `|`-separated fields — each md file
  has a comment line showing its field order.
- `**bold**`, `*italic*`, and `[link](url)` work in text.

## Adding things

- **New project:** make a folder in `Work/`, drop images in, create `project.md`
  (copy one from an existing project), then add a `- folder: <FolderName> | …` line to
  `Work/page.md` under `# Projects`.
- **New gallery image:** drop the image into the `.section` folder and list its filename
  in that section's `section.md` under `# Images`.
- **Design references** (`Homepage/Homepage All.png`, `About/About.png`, `Work/Work.png`,
  `Homepage/inspiration/`) are kept for reference; they are not shown on the site.

## Before publishing for real

A few photos are 3–7 MB (`IMG_3859.JPG`, `IMG_0410.jpeg`, `IMG_6573.jpeg`,
`Work/IMG_8319.jpeg`, `Work/NCR/IMG_2610.jpeg`). Compress/resize them (~1600px wide,
"export for web") so pages load fast. The whole folder deploys as-is to any static host
(GitHub Pages, Netlify, Vercel).
