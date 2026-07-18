/* ============================================================
   Markdown-driven portfolio.
   Content lives in .md files next to the images they describe:
     site.md                          — global (socials, resume, footer)
     Homepage/page.md                 — hero, currently, how-I-work
     Homepage/skills.section/section.md
     Homepage/tools.section/section.md
     Homepage/brands.section/section.md
     About/page.md                    — story, experience, vision, sidebar
     About/hobbies.section/section.md
     About/outdoor.section/section.md
     Work/page.md                     — project list + timeline
     Work/testimonials.section/section.md
     Work/<Project>/project.md        — one per project folder
   Edit a .md file, refresh the browser. See README.md for formats.
   ============================================================ */

/* ---------- tiny md helpers ---------- */

async function loadMD(path) {
  try {
    const res = await fetch(encodeURI(path));
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

/* ---------- renderers ---------- */

function renderSite(text) {
  if (!text) return;
  const sec = mdSections(text);
  const kv = mdKV(sec[""] || text);
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

  const chatKey = Object.keys(sec).find((k) => k.toLowerCase().startsWith("chat"));
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
    mug.hidden = false;
    mug.src = encodeURI("Homepage/tools.section/" + hero.mug);
  }

  const howKey = Object.keys(sec).find((k) => k.toLowerCase().startsWith("how"));
  if (howKey) {
    document.getElementById("how-label").textContent = howKey;
    const how = document.getElementById("how");
    how.replaceChildren(
      ...mdBullets(sec[howKey]).map(([icon, title, txt]) => {
        const d = el("div", "how-col");
        d.append(el("span", "how-icon", esc(icon)), el("h3", null, inlineMD(title || "")), el("p", null, inlineMD(txt || "")));
        return d;
      })
    );
  }
}

function renderSkills(text) {
  if (!text) return;
  const sec = mdSections(text);
  const body = sec["Skills"] ?? sec[""];
  document
    .getElementById("skills")
    .replaceChildren(...mdBullets(body).map(([s]) => el("span", "skill-chip", inlineMD(s))));
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
  document.getElementById("tools-home").replaceChildren(...make());
  document.getElementById("tools-about").replaceChildren(...make());
}

function renderBrands(text) {
  if (!text) return;
  const sec = mdSections(text);
  const key = Object.keys(sec).find((k) => k) || "";
  if (key) document.getElementById("brands-label").textContent = key;
  const items = mdBullets(sec[key] ?? sec[""]);
  const makeCards = () =>
    items.map(([file, name]) => {
      const span = el("span", "brand-card");
      const img = document.createElement("img");
      img.alt = name || file;
      imgFallback(img, "🏷️");
      img.src = encodeURI("Homepage/brands.section/" + file);
      span.append(img);
      return span;
    });
  // two identical halves so the marquee animation (translateX -50%) loops seamlessly
  document.getElementById("brands").replaceChildren(...makeCards(), ...makeCards());
}

function projectCard(p) {
  const a = el("a", "card project-card");
  a.href = "#work/" + p.slug;
  a.style.background = p.tint || "var(--lavender)";
  const thumb = el("div", "project-thumb");
  if (p.cover) {
    const img = document.createElement("img");
    img.alt = p.title + " preview";
    img.loading = "lazy";
    imgFallback(img, p.emoji || "🗂️");
    img.src = encodeURI("Work/" + p.folder + "/" + p.cover);
    thumb.append(img);
  } else {
    thumb.append(el("span", "thumb-emoji", esc(p.emoji || "🗂️")));
  }
  const meta = el("div", "project-meta");
  meta.innerHTML = `
    <span class="project-arrow">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 17L17 7M9 7h8v8"/>
      </svg>
    </span>
    <div><h3>${esc(p.title)}</h3><p>${esc(p.category || "")}</p></div>`;
  a.append(thumb, meta);
  return a;
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
  const cards = () => PROJECTS.map(projectCard);
  document.getElementById("projects-home").replaceChildren(...cards());
  document.getElementById("projects-work").replaceChildren(...cards());

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

  document.getElementById("about-experience").replaceChildren(
    ...mdBullets(sec["Experience"]).map(([role, period]) => {
      const li = document.createElement("li");
      li.append(el("h3", null, inlineMD(role)), el("p", null, inlineMD(period || "")));
      return li;
    })
  );

  const vision = document.getElementById("about-vision");
  const vKey = Object.keys(sec).find((k) => k.toLowerCase().startsWith("where"));
  if (vKey) {
    vision.replaceChildren(el("p", "card-label", esc(vKey)));
    const kv = mdKV(sec[vKey]);
    const paras = mdParas(sec[vKey].split("\n").filter((l) => !/^photo\s*:/i.test(l)).join("\n"));
    if (paras[0]) vision.append(el("p", null, inlineMD(paras[0])));
    if (kv.photo) {
      const img = document.createElement("img");
      img.className = "vision-photo";
      img.alt = kv.alt || "Photo of Shreya";
      imgFallback(img, "📷");
      img.src = encodeURI("About/" + kv.photo);
      vision.append(img);
    }
    for (const p of paras.slice(1)) vision.append(el("p", null, inlineMD(p)));
  }

  const bKey = Object.keys(sec).find((k) => k.toLowerCase().startsWith("what i do best"));
  if (bKey) document.getElementById("about-best").innerHTML = inlineMD(mdParas(sec[bKey])[0] || "");

  const mKey = Object.keys(sec).find((k) => k.toLowerCase().startsWith("more work"));
  if (mKey) {
    document.getElementById("about-morework").replaceChildren(
      ...mdBullets(sec[mKey]).map(([name, period]) => {
        const li = document.createElement("li");
        li.append(el("h3", null, inlineMD(name)), el("p", null, inlineMD(period || "")));
        return li;
      })
    );
  }
}

function renderGallery(containerId, folder, text) {
  const wrap = document.getElementById(containerId);
  if (!text) { wrap.hidden = true; return; }
  const sec = mdSections(text);
  const kv = mdKV(sec[""] ?? "");
  wrap.replaceChildren();
  if (kv.title) wrap.append(el("p", "card-label", esc(kv.title)));
  const grid = el("div", "gallery-grid");
  const imgsKey = Object.keys(sec).find((k) => k.toLowerCase() === "images");
  for (const [file, alt] of mdBullets(sec[imgsKey] ?? "")) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = alt || file;
    imgFallback(img, "📷");
    img.src = encodeURI(folder + "/" + file);
    grid.append(img);
  }
  wrap.append(grid);
  if (kv.caption) wrap.append(el("p", "gallery-caption", inlineMD(kv.caption)));
}

async function renderProject(slug) {
  const p = PROJECTS.find((x) => x.slug === slug);
  if (!p) { showView("work"); return; }
  document.getElementById("project-title").textContent = p.title;
  document.getElementById("project-category").textContent = p.category || "";
  const body = document.getElementById("project-body");
  const gallery = document.getElementById("project-gallery");
  body.replaceChildren();
  gallery.replaceChildren();

  const text = await loadMD("Work/" + p.folder + "/project.md");
  if (text) {
    const sec = mdSections(text);
    const main = sec[Object.keys(sec).find((k) => k && k.toLowerCase() !== "images")] ?? sec[""];
    for (const block of (main || "").split(/\n\s*\n/)) {
      const lines = block.trim().split("\n");
      if (!lines[0]) continue;
      if (lines.every((l) => l.trim().startsWith("- "))) {
        const ul = document.createElement("ul");
        for (const l of lines) ul.append(el("li", null, inlineMD(l.trim().slice(2))));
        body.append(ul);
      } else {
        body.append(el("p", null, inlineMD(block.replace(/\n/g, " "))));
      }
    }
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
  const [site, home, skills, tools, brands, work, about, hobbies, outdoor] =
    await Promise.all([
      loadMD("site.md"),
      loadMD("Homepage/page.md"),
      loadMD("Homepage/skills.section/section.md"),
      loadMD("Homepage/tools.section/section.md"),
      loadMD("Homepage/brands.section/section.md"),
      loadMD("Work/page.md"),
      loadMD("About/page.md"),
      loadMD("About/hobbies.section/section.md"),
      loadMD("About/outdoor.section/section.md"),
    ]);

  renderSite(site);
  renderHomepage(home);
  renderSkills(skills);
  renderTools(tools);
  renderBrands(brands);
  renderWork(work);
  renderAbout(about);
  renderGallery("gallery-hobbies", "About/hobbies.section", hobbies);
  renderGallery("gallery-outdoor", "About/outdoor.section", outdoor);
  route();
})();
