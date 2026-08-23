/* ============================================================
   Markdown-driven portfolio.
   Content lives in .md files next to the images they describe:
     site.md                          — global (socials, resume, footer)
     Homepage/page.md                 — hero (photo, title, tagline, about, mug)
     Homepage/chat.section/section.md — chat widget greeting + canned replies
     Homepage/tools.section/section.md
     Homepage/brands.section/section.md
     About/page.md                    — story, experience, vision, sidebar
     About/hobbies.section/section.md
     About/outdoor.section/section.md
     Work/page.md                     — project list + timeline
     Work/<Project>/project.md        — one per project folder
   Edit a .md file, refresh the browser. See README.md for formats.
   ============================================================ */

/* ---------- tiny md helpers ---------- */

async function loadMD(path) {
  try {
    // no-store: these small text files change often while editing content,
    // and a stale cached copy is a worse failure mode than an extra fetch.
    const res = await fetch(encodeURI(path), { cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Split a file into { "Section Title": "body…" } by top-level "# " headings.
// Text before the first heading is stored under "".
function mdSections(text) {
  const out = {};
  let title = "";
  let buf = [];
  for (const line of (text || "").split("\n")) {
    if (line.startsWith("# ")) {
      out[title] = buf.join("\n").trim();
      title = line.slice(2).trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  out[title] = buf.join("\n").trim();
  return out;
}

// "key: value" lines → object (only lines matching, others ignored)
function mdKV(body) {
  const kv = {};
  for (const line of (body || "").split("\n")) {
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.+)$/);
    if (m) kv[m[1].toLowerCase()] = m[2].trim();
  }
  return kv;
}

// "- a | b | c" lines → [["a","b","c"], …]
function mdBullets(body) {
  return (body || "")
    .split("\n")
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.trim().slice(2).split("|").map((s) => s.trim()));
}

// body minus key:value and bullet lines → paragraphs
function mdParas(body) {
  return (body || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.trim().startsWith("- ") && !/^[A-Za-z][\w-]*\s*:\s*/.test(p.split("\n")[0]) )
    .map((p) => p.replace(/\n/g, " "));
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// minimal inline markdown: **bold**, *italic*, [text](url)
function inlineMD(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function imgFallback(imgEl, emoji) {
  imgEl.addEventListener("error", () => {
    imgEl.replaceWith(
      Object.assign(document.createElement("span"), { className: "thumb-emoji", textContent: emoji || "🖼️" })
    );
  });
}

/* ---------- global state ---------- */

const PROJECTS = []; // {slug, folder, title, category, emoji, tint, cover}
let siteEmail = "";
let spotifyUrl = "";
let chatCollectUrl = "";

/* ---------- sound engine (Web Audio API, unlocks on first user gesture) ---------- */

const SFX_FILES = {
  paper: "sfx/paper-turn.wav",
  brew: "sfx/coffee-brew.wav",
  send: "sfx/imessage-send.wav",
  receive: "sfx/imessage-receive.wav",
};
let audioCtx = null;
const sfxBuffers = {};

function ensureAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}
document.addEventListener("pointerdown", ensureAudioCtx, { once: true });
document.addEventListener("keydown", ensureAudioCtx, { once: true });

async function loadSfx(name) {
  if (sfxBuffers[name]) return sfxBuffers[name];
  const ctx = ensureAudioCtx();
  if (!ctx) return null;
  try {
    const res = await fetch(SFX_FILES[name]);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    sfxBuffers[name] = buf;
    return buf;
  } catch {
    return null;
  }
}
// warm the cache so the first hover/click isn't the one paying the fetch cost
Object.keys(SFX_FILES).forEach((name) => {
  fetch(SFX_FILES[name]).then((r) => r.arrayBuffer()).then((arr) => {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    ctx.decodeAudioData(arr).then((buf) => { sfxBuffers[name] = buf; }).catch(() => {});
  }).catch(() => {});
});

async function playSfx(name, { volume = 0.6 } = {}) {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const buf = sfxBuffers[name] || (await loadSfx(name));
  if (!buf) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    src.start(0);
  } catch {
    /* autoplay blocked or unsupported — fail silently */
  }
}

/* ---------- renderers ---------- */

function renderSite(text) {
  if (!text) return;
  const sec = mdSections(text);
  const kv = mdKV(sec[""] || text);
  siteEmail = kv.email || "";
  spotifyUrl = kv.spotify || "";
  chatCollectUrl = kv.chat_collect || "";
  const links = {
    linkedin: kv.linkedin,
    email: kv.email ? "mailto:" + kv.email : null,
    instagram: kv.instagram,
  };
  document.querySelectorAll("[data-social]").forEach((a) => {
    const href = links[a.dataset.social];
    if (href) a.href = href;
  });
  if (kv.resume)
    document.querySelectorAll("[data-resume]").forEach((a) => (a.href = encodeURI(kv.resume)));

  const chatKey = Object.keys(sec).find((k) => k.toLowerCase().startsWith("chat about"));
  if (chatKey) {
    const wrap = document.getElementById("chat-chips");
    wrap.replaceChildren(...mdBullets(sec[chatKey]).map(([c]) => el("span", null, inlineMD(c))));
  }
}

function renderHomepage(text) {
  if (!text) return;
  const sec = mdSections(text);

  const hero = mdKV(sec["Hero"] || "");
  if (hero.photo) {
    const img = document.getElementById("hero-photo");
    imgFallback(img, "🌸");
    img.src = encodeURI("Homepage/" + hero.photo);
  }
  if (hero.label) document.getElementById("hero-label").textContent = hero.label;
  if (hero.title) document.getElementById("hero-title").textContent = hero.title;
  if (hero.tagline) document.getElementById("hero-tagline").innerHTML = inlineMD(hero.tagline);
  if (hero.about) document.getElementById("hero-about").innerHTML = inlineMD(hero.about);
  if (hero.location) document.getElementById("map-label").textContent = hero.location;
  if (hero.mug) {
    const mug = document.getElementById("hero-mug");
    mug.src = encodeURI("Homepage/tools.section/" + hero.mug);
  }
}

function renderTools(text) {
  if (!text) return;
  const sec = mdSections(text);
  const body = sec["Tools"] ?? sec[""];
  const make = () =>
    mdBullets(body).map(([file, name]) => {
      const span = el("span", "tool");
      span.title = name || file;
      const img = document.createElement("img");
      img.alt = name || file;
      imgFallback(img, "🔧");
      img.src = encodeURI("Homepage/tools.section/" + file);
      span.append(img);
      return span;
    });
  const homeRow = document.getElementById("tools-home");
  const mugEl = document.getElementById("mug-wrap"); // preserve — replaceChildren would otherwise discard it
  homeRow.replaceChildren(...make());
  if (mugEl) homeRow.append(mugEl);
}

let brandsTimer = null;

function renderBrands(text) {
  if (!text) return;
  const sec = mdSections(text);
  const key = Object.keys(sec).find((k) => k) || "";
  if (key) document.getElementById("brands-label").textContent = key;
  const items = mdBullets(sec[key] ?? sec[""]);
  const track = document.getElementById("brands");
  track.replaceChildren(
    ...items.map(([file, name]) => {
      const span = el("span", "brand-card");
      const img = document.createElement("img");
      img.alt = name || file;
      imgFallback(img, "🏷️");
      img.src = encodeURI("Homepage/transparent logos/" + file);
      span.append(img);
      return span;
    })
  );

  // step carousel: every 1s, slide to the next logo; wraps back to the start
  const viewport = track.closest(".marquee");
  if (!viewport) return;
  let index = 0;
  function step() {
    const cards = [...track.children];
    if (!cards.length) return;
    index++;
    if (index >= cards.length) {
      index = 0;
      viewport.scrollTo({ left: 0, behavior: "auto" });
      return;
    }
    viewport.scrollTo({ left: cards[index].offsetLeft, behavior: "smooth" });
  }
  if (brandsTimer) clearInterval(brandsTimer);
  brandsTimer = setInterval(step, 1000);
  viewport.addEventListener("mouseenter", () => clearInterval(brandsTimer));
  viewport.addEventListener("mouseleave", () => {
    clearInterval(brandsTimer);
    brandsTimer = setInterval(step, 1000);
  });
}

/* ---------- chat widget ---------- */

const chatState = { greeting: "Hi!" };

function renderChat(text) {
  if (!text) return;
  const sec = mdSections(text);
  const kv = mdKV(sec[""] || "");
  if (kv.greeting) chatState.greeting = kv.greeting;
  initChat();
}

function chatBubble(dir, text) {
  const row = el("div", "chat-row chat-" + dir);
  if (dir === "in") {
    const avatarSrc = document.getElementById("hero-photo").getAttribute("src");
    const av = document.createElement("img");
    av.className = "chat-avatar";
    av.alt = "";
    if (avatarSrc) av.src = avatarSrc;
    row.append(av);
  }
  row.append(el("div", "chat-bubble", inlineMD(text)));
  return row;
}

// fire-and-forget: logs the visitor's name to a Google Sheet via an Apps Script
// web app URL (site.md's chat_collect field). no-cors + form-encoded body so it
// never triggers a CORS preflight the Apps Script endpoint can't answer; we can't
// read the response, but the row still gets appended on the sheet's side.
function submitChatResponse(name) {
  if (!chatCollectUrl) return;
  const body = new URLSearchParams({ name, page: location.href, when: new Date().toISOString() });
  fetch(chatCollectUrl, { method: "POST", mode: "no-cors", body }).catch(() => {});
}

function initChat() {
  const thread = document.getElementById("chat-thread");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const card = document.getElementById("chat-card");
  if (!thread || !form) return;

  thread.replaceChildren(chatBubble("in", chatState.greeting));
  sendBtn.disabled = true; // input stays enabled so clicking/focusing it can still trigger startIntro()

  let introStarted = false;
  let readyForInput = false; // true once "What's your name?" has been asked
  let exchanged = false; // one text input from the visitor, then the thread is done

  input.addEventListener("input", () => {
    sendBtn.disabled = !readyForInput || !input.value.trim();
  });

  function startIntro() {
    if (introStarted) return;
    introStarted = true;
    thread.append(chatBubble("out", "Yes, definitely!"));
    thread.scrollTop = thread.scrollHeight;
    playSfx("send", { volume: 0.5 });
    window.setTimeout(() => {
      thread.append(chatBubble("in", "What's your name?"));
      thread.scrollTop = thread.scrollHeight;
      playSfx("receive", { volume: 0.45 });
      readyForInput = true;
      input.focus();
    }, 500);
  }
  if (card) card.addEventListener("click", startIntro);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (exchanged || !readyForInput) return;
    const msg = input.value.trim();
    if (!msg) return;
    thread.append(chatBubble("out", esc(msg)));
    playSfx("send", { volume: 0.6 });
    submitChatResponse(msg);
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;
    exchanged = true;
    input.placeholder = "That's all for now!";
    thread.scrollTop = thread.scrollHeight;
    window.setTimeout(() => {
      thread.append(chatBubble("in", `Nice to have you here, ${msg}. Enjoy the portfolio!`));
      thread.scrollTop = thread.scrollHeight;
      playSfx("receive", { volume: 0.45 });
    }, 500);
  });
}

/* ---------- resume + mug micro-interactions ---------- */

function initMicroInteractions() {
  const resumeLink = document.getElementById("resume-link");
  if (resumeLink) {
    resumeLink.addEventListener("click", () => {
      playSfx("paper", { volume: 0.55 });
      resumeLink.classList.remove("flipping");
      void resumeLink.offsetWidth; // restart the animation on repeat clicks
      resumeLink.classList.add("flipping");
    });
  }
  const mugWrap = document.getElementById("mug-wrap");
  if (mugWrap) {
    mugWrap.addEventListener("mouseenter", () => playSfx("brew", { volume: 0.5 }));
    mugWrap.addEventListener("focus", () => playSfx("brew", { volume: 0.5 }));
  }
}

function projectCard(p) {
  const a = el("a", "card project-card");
  a.href = "#work/" + p.slug;
  const thumb = el("div", "project-thumb");
  thumb.style.background = p.tint || "#E9D5F5";
  if (p.cover) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = p.title;
    imgFallback(img, "🖼️");
    img.src = encodeURI(p.cover);
    thumb.append(img);
  }
  const meta = el("div", "project-meta");
  meta.innerHTML = `
    <span class="project-arrow">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 17L17 7M9 7h8v8"/>
      </svg>
    </span>
    <div><h3>${esc(p.title)}</h3></div>`;
  a.append(thumb, meta);
  return a;
}

// "## " blocks of key:value lines → [{quote, name, role}, …]
function parseTestimonialBlocks(body) {
  const blocks = [];
  let buf = [];
  const flush = () => {
    if (buf.some((l) => l.trim())) blocks.push(mdKV(buf.join("\n")));
    buf = [];
  };
  for (const line of (body || "").split("\n")) {
    if (line.startsWith("## ")) flush();
    else buf.push(line);
  }
  flush();
  return blocks;
}

function testimonialCard(t) {
  const card = el("div", "card box-a testimonial-card");
  if (t && t.quote) {
    card.append(el("p", "testimonial-quote", "“" + inlineMD(t.quote) + "”"));
    const who = el("div", "testimonial-who");
    if (t.name) who.append(el("p", "testimonial-name", esc(t.name)));
    if (t.role) who.append(el("p", "testimonial-role", esc(t.role)));
    card.append(who);
  } else {
    card.classList.add("testimonial-empty");
    card.append(el("p", null, "A kind word from a teammate is on its way here."));
  }
  return card;
}

function renderTestimonials(text) {
  const sec = mdSections(text || "");
  const key = Object.keys(sec).find((k) => k.toLowerCase() === "testimonials");
  const blocks = parseTestimonialBlocks(sec[key] ?? "").filter((b) => Object.keys(b).length);
  while (blocks.length < 3) blocks.push({});
  const wrap = document.getElementById("testimonials");
  if (wrap) wrap.replaceChildren(...blocks.slice(0, 3).map(testimonialCard));
}

function renderWork(text) {
  if (!text) return;
  const sec = mdSections(text);

  PROJECTS.length = 0;
  for (const fields of mdBullets(sec["Projects"])) {
    const p = {};
    for (const f of fields) {
      const m = f.match(/^(\w+)\s*:\s*(.+)$/);
      if (m) p[m[1].toLowerCase()] = m[2].trim();
    }
    if (!p.folder) continue;
    p.title = p.title || p.folder;
    p.slug = p.folder.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    PROJECTS.push(p);
  }
  document.getElementById("projects-work").replaceChildren(...PROJECTS.map(projectCard));

  const featured = PROJECTS.filter((p) => (p.featured || "").toLowerCase() === "yes");
  // two independent columns (see .projects-masonry in style.css) so cards can be
  // different heights instead of forced into equal grid rows — alternate projects left/right.
  const col1 = document.getElementById("projects-home-col1");
  const col2 = document.getElementById("projects-home-col2");
  col1.replaceChildren();
  col2.replaceChildren();
  featured.forEach((p, i) => (i % 2 === 0 ? col1 : col2).append(projectCard(p)));

  const tl = document.getElementById("timeline");
  tl.replaceChildren(
    ...mdBullets(sec["Timeline"]).map(([name, role, year, notes, color]) => {
      const d = el("div", "tl-item");
      if (color) d.style.setProperty("--dot", color);
      d.append(el("h3", null, inlineMD(name)), el("p", "tl-role", inlineMD(role || "")), el("p", "tl-year", inlineMD(year || "")), el("span", "tl-dot"));
      d.append(el("p", "tl-notes", (notes || "").split(";").map((n) => inlineMD(n.trim())).join("<br/>")));
      return d;
    })
  );
  positionTimelineConnector(tl);
  window.addEventListener("resize", () => positionTimelineConnector(tl));
}

// aligns the .timeline::before connector line with the vertical center of the dots
function positionTimelineConnector(tl) {
  const dot = tl.querySelector(".tl-dot");
  if (!dot) return;
  const dotRect = dot.getBoundingClientRect();
  const tlRect = tl.getBoundingClientRect();
  tl.style.setProperty("--dot-y", dotRect.top - tlRect.top + dotRect.height / 2 + "px");
}

function renderAbout(text) {
  if (!text) return;
  const sec = mdSections(text);

  // story card: intro heading + ## subsections
  const story = document.getElementById("about-story");
  story.replaceChildren(el("h2", null, "What I’m about"));
  const storyBody = sec["What I'm about"] ?? sec["What I’m about"] ?? "";
  let sub = "";
  let buf = [];
  const flush = () => {
    if (sub) story.append(el("p", "card-label", esc(sub)));
    for (const p of mdParas(buf.join("\n"))) story.append(el("p", null, inlineMD(p)));
    buf = [];
  };
  for (const line of storyBody.split("\n")) {
    if (line.startsWith("## ")) { flush(); sub = line.slice(3).trim(); }
    else buf.push(line);
  }
  flush();
}

// gallery .md → [{src, caption}, …], used to build the combined About carousel
function parseGalleryItems(folder, text) {
  if (!text) return [];
  const sec = mdSections(text);
  const imgsKey = Object.keys(sec).find((k) => k.toLowerCase() === "images");
  return mdBullets(sec[imgsKey] ?? "").map(([file, caption]) => ({
    src: folder + "/" + file,
    caption: caption || "",
  }));
}

const ARROW_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
const ARROW_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

function renderCarousel(containerId, items) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!items.length) { wrap.hidden = true; return; }

  wrap.replaceChildren(el("p", "card-label", "When I'm not designing, I am"));

  const stage = el("div", "carousel-stage");
  const img = document.createElement("img");
  img.loading = "lazy";
  imgFallback(img, "📷");
  const prevBtn = el("button", "carousel-arrow carousel-prev", ARROW_LEFT);
  prevBtn.type = "button";
  prevBtn.setAttribute("aria-label", "Previous photo");
  const nextBtn = el("button", "carousel-arrow carousel-next", ARROW_RIGHT);
  nextBtn.type = "button";
  nextBtn.setAttribute("aria-label", "Next photo");
  stage.append(prevBtn, img, nextBtn);

  const caption = el("p", "carousel-caption");
  const dots = el("div", "carousel-dots");
  items.forEach((_, i) => {
    const dot = el("span", "carousel-dot");
    dot.addEventListener("click", () => show(i));
    dots.append(dot);
  });

  let idx = 0;
  function show(i) {
    idx = (i + items.length) % items.length;
    img.src = encodeURI(items[idx].src);
    img.alt = items[idx].caption || "";
    caption.textContent = items[idx].caption || "";
    [...dots.children].forEach((d, j) => d.classList.toggle("is-active", j === idx));
  }
  prevBtn.addEventListener("click", () => show(idx - 1));
  nextBtn.addEventListener("click", () => show(idx + 1));
  show(0);

  wrap.append(stage, caption, dots);
}

// a Spotify share link → the embed src an oEmbed request for that link returns
function spotifyEmbedUrl(url) {
  const m = (url || "").match(/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=oembed` : null;
}

function renderSpotify() {
  const card = document.getElementById("about-spotify");
  if (!card) return;
  card.replaceChildren(el("p", "card-label", "While listening to"));
  const embedUrl = spotifyEmbedUrl(spotifyUrl);
  if (embedUrl) {
    const embed = el("div", "spotify-embed");
    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.title = "Spotify player";
    iframe.loading = "lazy";
    iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    embed.append(iframe);
    card.append(embed);
  } else {
    const placeholder = el("div", "spotify-placeholder");
    placeholder.append(el("p", null, "My playlist widget is coming soon — for now, just imagine the vibiest mix of everything."));
    card.append(placeholder);
  }
}

// pipe-field bullet blocks render as infographic card grids instead of a plain <ul>:
// "- 20% | Label | description" (3 fields, numeric-looking first field) → big-number stat cards
// "- Title | description" (2 fields) → feature/method cards
// plain "- text" (no pipes) still renders as a normal <ul><li> list.
function statGrid(fields) {
  const grid = el("div", "stat-grid");
  for (const [value, label, desc] of fields) {
    const card = el("div", "stat-card");
    card.append(el("p", "stat-value", esc(value)), el("p", "stat-label", inlineMD(label)));
    if (desc) card.append(el("p", "stat-desc", inlineMD(desc)));
    grid.append(card);
  }
  return grid;
}
function featureGrid(fields) {
  const grid = el("div", "feature-grid");
  for (const [title, body] of fields) {
    const card = el("div", "feature-card");
    card.append(el("h4", "feature-title", inlineMD(title)), el("p", null, inlineMD(body)));
    grid.append(card);
  }
  return grid;
}

let projectScrollspyObserver = null;
let moreProjectsTimer = null;

async function renderProject(slug) {
  const p = PROJECTS.find((x) => x.slug === slug);
  if (!p) { showView("work"); return; }
  document.getElementById("project-title").textContent = p.title;
  document.getElementById("project-category").textContent = p.category || "";
  const body = document.getElementById("project-body");
  const gallery = document.getElementById("project-gallery");
  const layout = document.getElementById("project-layout");
  // a project's own brand color (Work/page.md's `color` field) lightly accents
  // this page — stat numbers, the active scrollspy tick — via the --brand var,
  // falling back to the site's yellow when a project doesn't set one
  if (p.color) layout.style.setProperty("--brand", p.color);
  else layout.style.removeProperty("--brand");
  const navEl = document.getElementById("project-nav");
  const navList = document.getElementById("project-nav-list");
  body.replaceChildren();
  gallery.replaceChildren();
  navList.replaceChildren();
  if (projectScrollspyObserver) { projectScrollspyObserver.disconnect(); projectScrollspyObserver = null; }

  const text = await loadMD("Work/" + p.folder + "/project.md");
  const sections = [];
  if (text) {
    const sec = mdSections(text);
    const main = sec[Object.keys(sec).find((k) => k && k.toLowerCase() !== "images")] ?? sec[""];

    const flushBlocks = (container, blockText) => {
      for (const block of blockText.split(/\n\s*\n/)) {
        const lines = block.trim().split("\n");
        if (!lines[0]) continue;
        const imgMatch = lines.length === 1 && lines[0].match(/^!\[([^\]]*)\]\((.+)\)$/);
        if (imgMatch) {
          const img = document.createElement("img");
          img.className = "project-inline-img";
          img.loading = "lazy";
          img.alt = imgMatch[1];
          imgFallback(img, p.emoji || "🖼️");
          img.src = encodeURI(imgMatch[2]);
          container.append(img);
        } else if (lines.every((l) => l.trim().startsWith("> "))) {
          container.append(el("blockquote", null, lines.map((l) => inlineMD(l.trim().slice(2))).join("<br/>")));
        } else if (lines.every((l) => l.trim().startsWith("- "))) {
          const fields = mdBullets(block);
          const fieldCount = fields[0].length;
          const uniform = fields.every((f) => f.length === fieldCount);
          if (uniform && fieldCount === 3 && /^[+\-$#]?\d/.test(fields[0][0])) {
            container.append(statGrid(fields));
          } else if (uniform && fieldCount === 2) {
            container.append(featureGrid(fields));
          } else {
            const ul = document.createElement("ul");
            for (const l of lines) ul.append(el("li", null, inlineMD(l.trim().slice(2))));
            container.append(ul);
          }
        } else {
          const text = block.replace(/\n/g, " ").trim();
          const soloLabel = text.match(/^\*\*([^*]+:)\*\*$/); // paragraph is *only* a short bold label ending in ":", e.g. "**My work:**"
          if (/^\*\*impact:?\*\*/i.test(text)) {
            // "**Impact:** some sentence" gets wrapped in a highlighted callout card
            const box = el("div", "callout-card");
            box.append(el("p", null, inlineMD(text)));
            container.append(box);
          } else if (soloLabel) {
            // a standalone bold label with nothing else in the paragraph reads as a mini-heading
            container.append(el("p", "project-label", inlineMD(text)));
          } else {
            container.append(el("p", null, inlineMD(text)));
          }
        }
      }
    };

    // "## " headings split the body into <section>s (used for the scrollspy nav below);
    // "### " is a lighter in-section heading — no new section/nav entry, just a
    // bigger label dropped into whatever section is currently open.
    // content before any heading (if a project.md doesn't use them) goes straight into body.
    let current = null;
    let buf = [];
    const flushCurrent = () => { flushBlocks(current ? current.el : body, buf.join("\n")); buf = []; };
    // "::: row" / "::: col" / ":::" — an explicit, opt-in two-column layout: everything
    // between "::: row" and "::: col" renders normally (paragraphs, stat grids, etc.)
    // into a left column; everything between "::: col" and ":::" renders into the right
    // column. Used sparingly, only where a project.md deliberately asks for it.
    let rowMode = null; // null | "left" | "right"
    let rowLeftBuf = [];
    let rowRightBuf = [];
    for (const line of (main || "").split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "::: row") {
        flushCurrent();
        rowMode = "left";
        rowLeftBuf = [];
        rowRightBuf = [];
      } else if (trimmed === "::: col" && rowMode) {
        rowMode = "right";
      } else if (trimmed === ":::" && rowMode) {
        const row = el("div", "media-row");
        const left = el("div", "media-row-text");
        flushBlocks(left, rowLeftBuf.join("\n"));
        row.append(left);
        flushBlocks(row, rowRightBuf.join("\n")); // usually just a single image
        (current ? current.el : body).append(row);
        rowMode = null;
      } else if (rowMode === "left") {
        rowLeftBuf.push(line);
      } else if (rowMode === "right") {
        rowRightBuf.push(line);
      } else if (line.startsWith("## ")) {
        flushCurrent();
        const label = line.slice(3).trim();
        const id = "proj-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const secEl = el("section", "project-section");
        secEl.id = id;
        secEl.append(el("h3", "project-subhead", inlineMD(label)));
        body.append(secEl);
        current = { id, label, el: secEl };
        sections.push(current);
      } else if (line.startsWith("### ")) {
        flushCurrent();
        (current ? current.el : body).append(el("h2", "project-subhead2", inlineMD(line.slice(4).trim())));
      } else {
        buf.push(line);
      }
    }
    flushCurrent();

    const imgsKey = Object.keys(sec).find((k) => k.toLowerCase() === "images");
    for (const [file, alt] of mdBullets(sec[imgsKey] ?? "")) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = alt || file;
      imgFallback(img, p.emoji || "🖼️");
      img.src = encodeURI("Work/" + p.folder + "/" + file);
      gallery.append(img);
    }
  } else {
    body.append(el("p", null, "Case study coming soon."));
  }

  // scrollspy nav — only shows up when the project.md actually has ## sections
  if (sections.length) {
    layout.classList.remove("no-nav");
    navEl.hidden = false;
    const buttons = sections.map((s, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = (i + 1) + ". " + s.label;
      btn.dataset.target = s.id;
      btn.addEventListener("click", () => {
        document.getElementById(s.id).scrollIntoView({ behavior: "smooth", block: "start" });
      });
      const li = document.createElement("li");
      li.append(btn);
      navList.append(li);
      return btn;
    });
    buttons[0].classList.add("is-active");
    projectScrollspyObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            buttons.forEach((b) => b.classList.toggle("is-active", b.dataset.target === entry.target.id));
          }
        }
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 }
    );
    sections.forEach((s) => projectScrollspyObserver.observe(document.getElementById(s.id)));
  } else {
    layout.classList.add("no-nav");
    navEl.hidden = true;
  }

  // "More case studies" strip — every other featured-or-not project, small tiles
  // in a single row with the same step-carousel behavior as the brands section.
  if (moreProjectsTimer) { clearInterval(moreProjectsTimer); moreProjectsTimer = null; }
  const moreTrack = document.getElementById("more-projects");
  if (moreTrack) {
    const others = PROJECTS.filter((x) => x.slug !== p.slug);
    moreTrack.replaceChildren(
      ...others.map((op) => {
        const tile = el("a", "more-project-tile");
        tile.href = "#work/" + op.slug;
        const thumb = el("div", "more-project-thumb");
        thumb.style.background = op.tint || "#E9D5F5";
        if (op.cover) {
          const img = document.createElement("img");
          img.loading = "lazy";
          img.alt = op.title;
          imgFallback(img, "🖼️");
          img.src = encodeURI(op.cover);
          thumb.append(img);
        }
        tile.append(thumb, el("p", null, esc(op.title)));
        return tile;
      })
    );
    const viewport = moreTrack.closest(".card-more-projects");
    let idx = 0;
    function step() {
      const tiles = [...moreTrack.children];
      if (!tiles.length) return;
      idx++;
      if (idx >= tiles.length) {
        idx = 0;
        moreTrack.scrollTo({ left: 0, behavior: "auto" });
        return;
      }
      moreTrack.scrollTo({ left: tiles[idx].offsetLeft, behavior: "smooth" });
    }
    moreProjectsTimer = setInterval(step, 1000);
    if (viewport) {
      viewport.addEventListener("mouseenter", () => clearInterval(moreProjectsTimer));
      viewport.addEventListener("mouseleave", () => {
        clearInterval(moreProjectsTimer);
        moreProjectsTimer = setInterval(step, 1000);
      });
    }
  }
}

/* ---------- router ---------- */

const tabs = document.querySelectorAll(".tab");
const views = {
  home: document.getElementById("view-home"),
  about: document.getElementById("view-about"),
  work: document.getElementById("view-work"),
  project: document.getElementById("view-project"),
};

function showView(name, slug) {
  if (!views[name]) name = "home";
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
  const tabName = name === "project" ? "work" : name;
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tabName));
  history.replaceState(null, "", "#" + (name === "project" ? "work/" + slug : name));
  window.scrollTo({ top: 0, behavior: "instant" });
  if (name === "project") renderProject(slug);
}

function route() {
  const hash = location.hash.replace("#", "");
  const [head, slug] = hash.split("/");
  if (head === "work" && slug) showView("project", slug);
  else showView(head || "home");
}

tabs.forEach((t) => t.addEventListener("click", () => showView(t.dataset.tab)));
document.querySelectorAll("[data-nav]").forEach((a) =>
  a.addEventListener("click", (e) => { e.preventDefault(); showView(a.dataset.nav); })
);
window.addEventListener("hashchange", route);

/* ---------- boot ---------- */

(async function boot() {
  const [site, home, chat, tools, brands, work, about, hobbies, testimonials] =
    await Promise.all([
      loadMD("site.md"),
      loadMD("Homepage/page.md"),
      loadMD("Homepage/chat.section/section.md"),
      loadMD("Homepage/tools.section/section.md"),
      loadMD("Homepage/brands.section/section.md"),
      loadMD("Work/page.md"),
      loadMD("About/page.md"),
      loadMD("About/hobbies.section/section.md"),
      loadMD("Work/testimonials.section/section.md"),
    ]);

  renderSite(site);
  renderHomepage(home);
  renderChat(chat);
  renderTools(tools);
  renderBrands(brands);
  renderWork(work);
  renderAbout(about);
  renderCarousel("about-carousel", parseGalleryItems("About/hobbies.section", hobbies));
  renderSpotify();
  renderTestimonials(testimonials);
  initMicroInteractions();
  route();
})();
