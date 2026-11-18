/* ==========================================================
   Live canvas — two collaborators (Pranav + Claude) build the
   page in front of you, section by section, as you scroll.

   Markup contract
     [data-section="Name"]   groups items in the Layers panel
     [data-b="type"]         text, typed in (data-mode="char" for per-letter)
     [data-b="img"]          image placeholder -> image dropped in
     [data-b="box"]          frame / button / card, drawn then filled
     [data-b="rule"]         a line, drawn left to right
     data-name="..."         optional layer name

   Content is visible by default. The page hides it only when the
   inline head script adds html.lb, so no-JS / errors / reduced
   motion always get the complete site.
   ========================================================== */
(() => {
  "use strict";
  window.__lb = true;

  const root = document.documentElement;
  const qs = new URLSearchParams(location.search);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINAL = qs.has("final") || reduce || !root.classList.contains("lb");

  let revisit = false;
  try { revisit = !!sessionStorage.getItem("lb-seen"); sessionStorage.setItem("lb-seen", "1"); } catch (e) {}
  const BASE_SPEED = revisit ? 1.7 : 1;

  const items = [...document.querySelectorAll("[data-b]")];
  items.forEach((el, i) => (el.__i = i));

  const PEOPLE = [
    { id: "pranav", name: "Pranav", color: getVar("--pranav", "#5b8cff") },
    { id: "claude", name: "Claude", color: getVar("--claude", "#d97757") },
  ];

  function getVar(n, f) { return getComputedStyle(root).getPropertyValue(n).trim() || f; }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const isBuilt = (el) => el.classList.contains("is-built");

  /* ---------------- Layers panel ---------------- */
  const layersEl = document.getElementById("layers");
  function layerName(el) {
    if (el.dataset.name) return el.dataset.name;
    const t = el.dataset.b;
    if (t === "type") {
      const s = el.textContent.replace(/\s+/g, " ").trim();
      return s.length > 26 ? s.slice(0, 26) + "…" : s;
    }
    if (t === "img") { const im = el.querySelector("img"); return (im && im.alt) || "Image"; }
    if (t === "rule") return "Line";
    return "Frame";
  }
  const ICON = { type: "T", img: "▧", box: "▢", rule: "—" };
  if (layersEl) {
    const secs = [...document.querySelectorAll("[data-section]")];
    let count = 0;
    secs.forEach((sec) => {
      const wrap = document.createElement("div");
      wrap.className = "ly-sec";
      const head = rowFor("#", sec.dataset.section, "grp");
      head.addEventListener("click", () => sec.scrollIntoView({ behavior: "smooth", block: "start" }));
      wrap.appendChild(head);
      sec.querySelectorAll("[data-b]").forEach((el) => {
        if (el.closest("[data-section]") !== sec) return;
        const r = rowFor(ICON[el.dataset.b] || "▢", layerName(el), "item");
        r.addEventListener("click", () => el.scrollIntoView({ behavior: "smooth", block: "center" }));
        el.__layer = r;
        wrap.appendChild(r);
        count++;
      });
      layersEl.appendChild(wrap);
    });
    const c = document.getElementById("layer-count");
    if (c) c.textContent = count + " layers";
  }
  function rowFor(icon, name, cls) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ly-row " + cls;
    b.innerHTML = '<span class="ic"></span><span class="nm"></span><span class="who"></span>';
    b.querySelector(".ic").textContent = icon;
    b.querySelector(".nm").textContent = name;
    return b;
  }
  function layerState(el, state, p) {
    const r = el.__layer;
    if (!r) return;
    r.classList.toggle("building", state === "building");
    r.classList.toggle("built", state === "built");
    if (p) { r.style.setProperty("--who", p.color); r.querySelector(".who").textContent = p.name; }
    if (state === "building" && layersEl) {
      const lr = r.getBoundingClientRect(), pr = layersEl.getBoundingClientRect();
      if (lr.top < pr.top + 40 || lr.bottom > pr.bottom - 10) {
        layersEl.scrollTo({ top: r.offsetTop - layersEl.clientHeight / 2, behavior: "smooth" });
      }
    }
  }

  /* ---------------- Final / reduced-motion path ---------------- */
  if (FINAL) {
    root.classList.remove("lb");
    items.forEach((el) => { el.classList.add("is-built"); layerState(el, "built"); });
    const hud = document.querySelector(".hud");
    if (hud) hud.style.display = "none";
    return;
  }

  /* ---------------- Split text into reveal units ---------------- */
  function split(el) {
    const perChar = el.dataset.mode === "char";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parts = node.textContent.split(/(\s+)/);
      if (parts.every((p) => !p.trim())) return;
      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (!part) return;
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        if (perChar) {
          const w = document.createElement("span");
          w.style.whiteSpace = "nowrap";
          [...part].forEach((ch) => {
            const s = document.createElement("span");
            s.className = "u"; s.textContent = ch; w.appendChild(s);
          });
          frag.appendChild(w);
        } else {
          const s = document.createElement("span");
          s.className = "u"; s.textContent = part; frag.appendChild(s);
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
    el.__units = [...el.querySelectorAll(".u")];
  }
  items.filter((el) => el.dataset.b === "type").forEach(split);

  /* ---------------- Overlay: cursors, selections, caret ---------------- */
  const mp = document.createElement("div");
  mp.className = "mp";
  mp.setAttribute("aria-hidden", "true");
  document.body.appendChild(mp);

  const CURSOR_SVG =
    '<svg viewBox="0 0 20 20"><path d="M3 2 L3 16.5 L7 12.8 L9.6 18.4 L12.2 17.2 L9.7 11.7 L15.2 11.4 Z" fill="currentColor" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';

  PEOPLE.forEach((p, i) => {
    const c = document.createElement("div");
    c.className = "cur";
    c.style.setProperty("--c", p.color);
    c.style.color = p.color;
    c.innerHTML = CURSOR_SVG + '<div class="cur-name"></div><div class="cur-chat"></div>';
    c.querySelector(".cur-name").textContent = p.name;
    mp.appendChild(c);
    p.el = c;
    p.chat = c.querySelector(".cur-chat");
    // start from opposite edges, as if joining the file
    p.x = i === 0 ? -40 : innerWidth + 40;
    p.y = innerHeight * (i === 0 ? 0.35 : 0.6);
    p.tween = null;

    const sel = document.createElement("div");
    sel.className = "sel";
    sel.style.setProperty("--c", p.color);
    sel.innerHTML = '<i></i><i></i><i></i><i></i><div class="sel-name"></div><div class="sel-size"></div>';
    mp.appendChild(sel);
    p.sel = { el: sel, target: null, progress: 1, name: sel.querySelector(".sel-name"), size: sel.querySelector(".sel-size") };

    const caret = document.createElement("div");
    caret.className = "caret";
    caret.style.setProperty("--c", p.color);
    mp.appendChild(caret);
    p.caret = { el: caret, unit: null };
  });
  const [PRANAV, CLAUDE] = PEOPLE;

  const TOP = () => (parseFloat(getVar("--tb-h", "48")) || 48) + 8;
  const LEFT = () => (parseFloat(getVar("--lw", "0")) || 0) + 8;
  const RIGHT = () => innerWidth - (parseFloat(getVar("--rw", "0")) || 0) - 70;

  function clampPt(x, y) {
    return { x: clamp(x, LEFT(), Math.max(LEFT(), RIGHT())), y: clamp(y, TOP(), innerHeight - 70) };
  }
  function pt(el, where) {
    const r = el.getBoundingClientRect();
    let x = r.left, y = r.top;
    if (where === "br") { x = r.right; y = r.bottom; }
    else if (where === "c") { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    else if (where === "tl") { x = r.left + 2; y = r.top + 2; }
    return clampPt(x, y);
  }
  function inView(el, margin = 0) {
    const r = el.getBoundingClientRect();
    return r.bottom > TOP() + margin && r.top < innerHeight - margin && r.width > 0;
  }

  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function moveTo(p, target, dur) {
    return new Promise((resolve) => {
      const start = { x: p.x, y: p.y };
      const t0 = target();
      const dist = Math.hypot(t0.x - start.x, t0.y - start.y);
      if (dur == null) dur = clamp(230 + dist * 0.55, 230, 870);
      dur /= p.speed || BASE_SPEED;
      if (p.tween) p.tween.resolve();
      p.tween = { start, target, t0: performance.now(), dur, arc: rand(-0.12, 0.12) * dist, resolve };
    });
  }

  // one frame loop drives every cursor, selection box and caret
  function frame(now) {
    PEOPLE.forEach((p) => {
      const tw = p.tween;
      if (tw) {
        const t = clamp((now - tw.t0) / tw.dur, 0, 1);
        const e = easeInOut(t);
        const tg = tw.target();
        const dx = tg.x - tw.start.x, dy = tg.y - tw.start.y;
        const len = Math.hypot(dx, dy) || 1;
        const off = Math.sin(Math.PI * t) * tw.arc;
        p.x = tw.start.x + dx * e + (-dy / len) * off;
        p.y = tw.start.y + dy * e + (dx / len) * off;
        if (t >= 1) { p.tween = null; tw.resolve(); }
      }
      p.el.style.transform = `translate3d(${Math.round(p.x - 3)}px, ${Math.round(p.y - 2)}px, 0)`;
      if (p.ghost) p.ghost.style.transform = `translate3d(${Math.round(p.x + 10)}px, ${Math.round(p.y + 12)}px, 0)`;

      const s = p.sel;
      if (s.target) {
        const r = s.target.getBoundingClientRect();
        const w = r.width * s.progress, h = r.height * s.progress;
        let sx = r.left, sy = r.top;
        if (s.origin === "br") { sx = r.right - w; sy = r.bottom - h; }
        else if (s.origin === "c") { sx = r.left + (r.width - w) / 2; sy = r.top + (r.height - h) / 2; }
        s.el.style.transform = `translate3d(${sx - 1}px, ${sy - 1}px, 0)`;
        s.el.style.width = w + 2 + "px";
        s.el.style.height = h + 2 + "px";
        s.size.textContent = Math.round(w) + " × " + Math.round(h);
      }
      const c = p.caret;
      if (c.unit) {
        const r = c.unit.getBoundingClientRect();
        c.el.style.transform = `translate3d(${r.right + 1}px, ${r.top + r.height * 0.1}px, 0)`;
        c.el.style.height = r.height * 0.85 + "px";
      }
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function select(p, el, origin = "tl") {
    const s = p.sel;
    s.origin = origin;
    s.target = el;
    s.progress = 0;
    s.name.textContent = layerName(el);
    s.el.classList.add("show");
  }
  function deselect(p) {
    const s = p.sel;
    s.el.classList.remove("show");
    setTimeout(() => { if (!s.el.classList.contains("show")) s.target = null; }, 320);
  }
  function animateProgress(p, dur) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / dur, 0, 1);
        p.sel.progress = easeInOut(t);
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /* ---------------- HUD + inspector ---------------- */
  const hudText = {};
  document.querySelectorAll("[data-hud]").forEach((n) => (hudText[n.dataset.hud] = n));
  function status(p, text) { const n = hudText[p.id]; if (n) n.textContent = text; }

  const insp = document.getElementById("inspect-body");
  const frameEl = document.querySelector(".frame");
  function inspect(p, el) {
    if (!insp) return;
    const r = el.getBoundingClientRect();
    const fr = frameEl ? frameEl.getBoundingClientRect() : { left: 0, top: 0 };
    const cs = getComputedStyle(el.dataset.b === "type" ? el : el);
    const type = el.dataset.b;
    const rows = [];
    rows.push(`<div class="in-group"><div class="in-label">Layer</div><div class="in-grid">
      <div class="in-field wide"><b>${ICON[type] || "▢"}</b><span>${esc(layerName(el))}</span></div>
      <div class="in-field wide in-by"><i style="background:${p.color}"></i><span>${p.name} is editing</span></div></div></div>`);
    rows.push(`<div class="in-group"><div class="in-label">Position</div><div class="in-grid">
      <div class="in-field"><b>X</b><span>${Math.round(r.left - fr.left)}</span></div>
      <div class="in-field"><b>Y</b><span>${Math.round(r.top - fr.top)}</span></div>
      <div class="in-field"><b>W</b><span>${Math.round(r.width)}</span></div>
      <div class="in-field"><b>H</b><span>${Math.round(r.height)}</span></div></div></div>`);
    if (type === "type") {
      const fam = cs.fontFamily.split(",")[0].replace(/"/g, "");
      rows.push(`<div class="in-group"><div class="in-label">Text</div><div class="in-grid">
        <div class="in-field wide"><b>Aa</b><span>${esc(fam)}</span></div>
        <div class="in-field"><b>Size</b><span>${Math.round(parseFloat(cs.fontSize))}</span></div>
        <div class="in-field"><b>Wt</b><span>${cs.fontWeight}</span></div>
        <div class="in-field"><b>LH</b><span>${cs.lineHeight === "normal" ? "Auto" : Math.round(parseFloat(cs.lineHeight))}</span></div>
        <div class="in-field"><b>LS</b><span>${cs.letterSpacing === "normal" ? "0" : parseFloat(cs.letterSpacing).toFixed(1)}</span></div>
        <div class="in-field wide"><span class="in-swatch" style="background:${cs.color}"></span><span>${toHex(cs.color)}</span></div></div></div>`);
    } else {
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      rows.push(`<div class="in-group"><div class="in-label">${type === "img" ? "Fill · Image" : "Appearance"}</div><div class="in-grid">
        <div class="in-field"><b>R</b><span>${Math.round(radius)}</span></div>
        <div class="in-field"><b>Op</b><span>100%</span></div>
        <div class="in-field wide"><b>Fill</b><span>${type === "img" ? "Image · Fill" : toHex(cs.backgroundColor)}</span></div></div></div>`);
    }
    insp.innerHTML = rows.join("");
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function toHex(c) {
    const m = c.match(/\d+(\.\d+)?/g);
    if (!m) return c;
    if (m.length === 4 && parseFloat(m[3]) === 0) return "None";
    return "#" + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  /* ---------------- Build queue ---------------- */
  const queue = [];
  const STALE_MS = 3800;

  function enqueue(el) {
    if (el.__q || isBuilt(el)) return;
    el.__q = performance.now();
    queue.push(el);
    queue.sort((a, b) => a.__i - b.__i);
  }
  function ancestorsBuilt(el) {
    let n = el.parentElement && el.parentElement.closest("[data-b]");
    while (n) { if (!isBuilt(n)) return false; n = n.parentElement && n.parentElement.closest("[data-b]"); }
    return true;
  }
  function instant(el) {
    el.classList.remove("is-building");
    el.classList.add("is-built");
    if (el.__units) el.__units.forEach((u) => u.classList.add("on"));
    layerState(el, "built");
  }
  function take() {
    const now = performance.now();
    // fast-forward anything the visitor has been waiting on too long, or scrolled past
    for (let i = queue.length - 1; i >= 0; i--) {
      const el = queue[i];
      if (el.__busy) continue;
      if (now - el.__q > STALE_MS / BASE_SPEED || !inView(el)) {
        if (ancestorsBuilt(el) || !inView(el)) { queue.splice(i, 1); instant(el); }
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const el = queue[i];
      if (el.__busy || !ancestorsBuilt(el)) continue;
      queue.splice(i, 1);
      el.__busy = true;
      return el;
    }
    return null;
  }

  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) { enqueue(en.target); io.unobserve(en.target); }
    }),
    { rootMargin: "0px 0px -12% 0px", threshold: 0 }
  );

  const VERB = { type: "Typing", img: "Placing", box: "Drawing", rule: "Drawing" };

  // pick a style that this cursor did not use last time for this kind of element
  function pickStyle(p, kind, styles) {
    p.lastStyle = p.lastStyle || {};
    const options = styles.filter((x) => x !== p.lastStyle[kind]);
    const pick = options[Math.floor(Math.random() * options.length)];
    p.lastStyle[kind] = pick;
    return pick;
  }
  function click(p) {
    p.el.animate([{ scale: 1 }, { scale: 0.82 }, { scale: 1 }], { duration: 220, easing: "ease-out" });
  }
  function ghostFor(p, el) {
    const img = el.querySelector("img");
    const g = document.createElement("div");
    g.className = "ghost";
    const src = img ? img.currentSrc || img.src : "";
    if (src) g.style.backgroundImage = `url("${src}")`;
    else g.style.backgroundImage = getComputedStyle(el).backgroundImage;
    mp.appendChild(g);
    p.ghost = g;
    return g;
  }
  function dropGhost(p) {
    const g = p.ghost;
    if (!g) return;
    p.ghost = null;
    g.classList.add("gone");
    setTimeout(() => g.remove(), 350);
  }
  function waitImg(el) {
    const img = el.querySelector("img");
    if (!img || img.complete) return Promise.resolve();
    return Promise.race([new Promise((r) => img.addEventListener("load", r, { once: true })), sleep(2500)]);
  }

  async function build(p, el) {
    const type = el.dataset.b;
    p.speed = BASE_SPEED * (queue.length > 8 ? 1.8 : queue.length > 4 ? 1.3 : 1) * rand(0.88, 1.15);
    const k = 1 / p.speed;
    status(p, `${VERB[type] || "Editing"} ${layerName(el)}`);
    el.classList.add("is-building");
    layerState(el, "building", p);
    inspect(p, el);

    // now and then, overshoot a little before settling on the target
    if (Math.random() < 0.18 && queue.length < 5) {
      const q = pt(el, "c");
      const ox = rand(-90, 90), oy = rand(-50, 50);
      await moveTo(p, () => clampPt(q.x + ox, q.y + oy), rand(300, 450));
    }

    if (type === "type") {
      const style = pickStyle(p, "type", ["click", "box"]);
      if (style === "box") {
        // drag out a text box first, then type into it
        await moveTo(p, () => pt(el, "tl"));
        select(p, el, "tl");
        const drag = animateProgress(p, 300 * k);
        await moveTo(p, () => pt(el, "br"), 300);
        await drag;
        await moveTo(p, () => pt(el, "tl"), 260);
      } else {
        await moveTo(p, () => pt(el, "tl"));
        click(p);
        select(p, el, "tl");
        p.sel.progress = 1;
      }
      const units = el.__units || [];
      const per = Math.max(clamp(1500 / Math.max(units.length, 1), el.dataset.mode === "char" ? 35 : 10, 70) - 30, 6) * k;
      const pauses = units.length > 12 ? Math.floor(rand(0, 2.4)) : 0;
      const pauseAt = new Set(Array.from({ length: pauses }, () => Math.floor(rand(4, units.length - 4))));
      const drift = Math.floor(rand(4, 9));
      p.caret.el.classList.add("show");
      for (let i = 0; i < units.length; i++) {
        if (!inView(el)) { units.forEach((u) => u.classList.add("on")); break; }
        units[i].classList.add("on");
        p.caret.unit = units[i];
        if (i % drift === 0 && !p.tween) {
          const u = units[i];
          const ox = rand(10, 22), oy = rand(4, 14);
          moveTo(p, () => { const r = u.getBoundingClientRect(); return clampPt(r.right + ox, r.bottom + oy); }, rand(300, 420));
        }
        await sleep(pauseAt.has(i) ? per + rand(180, 420) * k : per * rand(0.7, 1.3));
      }
      p.caret.el.classList.remove("show");
      p.caret.unit = null;
    } else if (type === "img") {
      const style = pickStyle(p, "img", ["drag", "dragIn", "center"]);
      if (style === "dragIn") {
        // grab the file from the nearest screen edge and carry it in
        const r = el.getBoundingClientRect();
        const fromLeft = r.left + r.width / 2 < innerWidth / 2;
        const ey = clamp(r.top + r.height * rand(0.2, 0.8), TOP() + 40, innerHeight - 120);
        await moveTo(p, () => clampPt(fromLeft ? LEFT() : RIGHT(), ey), rand(380, 520));
        click(p);
        ghostFor(p, el);
        select(p, el, "c");
        p.sel.progress = 1;
        await waitImg(el);
        await moveTo(p, () => pt(el, "c"), rand(520, 700));
        click(p);
        dropGhost(p);
      } else if (style === "center") {
        await moveTo(p, () => pt(el, "c"));
        click(p);
        select(p, el, "c");
        await animateProgress(p, 380 * k);
        await waitImg(el);
        await sleep(90 * k);
      } else {
        const fromBr = Math.random() < 0.5;
        await moveTo(p, () => pt(el, fromBr ? "br" : "tl"));
        select(p, el, fromBr ? "br" : "tl");
        const drag = animateProgress(p, 390 * k);
        await moveTo(p, () => pt(el, fromBr ? "tl" : "br"), 390);
        await drag;
        await waitImg(el);
        await moveTo(p, () => pt(el, "c"), 330);
        await sleep(90 * k);
      }
      el.classList.add("dropped");
    } else {
      const style = pickStyle(p, "box", ["tl", "br", "c"]);
      if (style === "c") {
        await moveTo(p, () => pt(el, "c"));
        click(p);
        select(p, el, "c");
        await animateProgress(p, 300 * k);
      } else {
        await moveTo(p, () => pt(el, style));
        select(p, el, style);
        const drag = animateProgress(p, 350 * k);
        await moveTo(p, () => pt(el, style === "tl" ? "br" : "tl"), 350);
        await drag;
      }
      await sleep(50 * k);
      el.classList.add("popped");
    }

    el.classList.remove("is-building");
    el.classList.add("is-built");
    layerState(el, "built");
    await sleep(rand(160, 300) * k);
    deselect(p);
    el.__busy = false;
  }

  /* ---------------- Idle behaviour: review, select, chat ---------------- */
  const CHATS = (window.LB_CHAT || [
    ["Can we push the headline bigger?", "Bumped it up, and tightened the tracking."],
    ["This spacing feels cramped.", "Moved everything onto an 8pt rhythm."],
    ["Keep the palette monochrome?", "Yes, one red accent from the deck, nothing else."],
    ["Love how the grid lines up.", "12 columns, 20px gutters ✓"],
    ["Ship it?", "Ship it 🚀"],
  ]).slice();
  let nextChatAt = performance.now() + rand(10000, 16000) / BASE_SPEED;
  let pendingReply = null;

  function visibleBuilt() {
    return items.filter((el) => isBuilt(el) && inView(el, 60) && el.getBoundingClientRect().height < innerHeight * 0.9);
  }
  function say(p, text, ms = 2800) {
    p.chat.textContent = text;
    p.chat.classList.add("show");
    clearTimeout(p.chatT);
    p.chatT = setTimeout(() => p.chat.classList.remove("show"), ms);
  }

  // elements both cursors looked at recently, so they spread their attention around
  const recentEls = [];
  function pickEl(p, filter) {
    const other = p === PRANAV ? CLAUDE : PRANAV;
    let pool = visibleBuilt().filter((el) => el !== other.focus && (!filter || filter(el)));
    const fresh = pool.filter((el) => !recentEls.includes(el));
    if (fresh.length) pool = fresh;
    if (!pool.length) return null;
    const el = pool[Math.floor(Math.random() * pool.length)];
    recentEls.push(el);
    if (recentEls.length > 8) recentEls.shift();
    p.focus = el;
    return el;
  }

  const measureEl = document.createElement("div");
  measureEl.className = "measure";
  measureEl.innerHTML = "<span></span>";
  mp.appendChild(measureEl);

  // wait, but wake early when there is new work
  async function calm(ms) {
    const until = performance.now() + ms;
    while (performance.now() < until && !queue.length && !anyRequest()) await sleep(90);
  }

  const IDLE = {
    async glance(p) {
      const el = pickEl(p);
      if (!el) return false;
      const ox = rand(-60, 60), oy = rand(-20, 20);
      await moveTo(p, () => { const q = pt(el, "c"); return clampPt(q.x + ox, q.y + oy); }, rand(1100, 1800));
      await calm(rand(1400, 2600));
    },
    async select(p) {
      const el = pickEl(p);
      if (!el) return false;
      const where = Math.random() < 0.5 ? "tl" : "c";
      await moveTo(p, () => pt(el, where), rand(900, 1400));
      click(p);
      select(p, el, "tl");
      p.sel.progress = 1;
      await calm(rand(900, 1500));
      deselect(p);
      await calm(rand(800, 1600));
    },
    async read(p) {
      // slowly trace across a paragraph, as if proof-reading it
      const el = pickEl(p, (e) => e.dataset.b === "type" && e.getBoundingClientRect().height > 40);
      if (!el) return false;
      const lines = Math.min(3, Math.max(1, Math.round(el.getBoundingClientRect().height / 30)));
      for (let i = 0; i < lines; i++) {
        const f = (i + 0.6) / (lines + 0.2);
        const end = rand(10, 60);
        await moveTo(p, () => { const r = el.getBoundingClientRect(); return clampPt(r.left + 8, r.top + r.height * f + 10); }, i ? 420 : rand(900, 1300));
        await moveTo(p, () => { const r = el.getBoundingClientRect(); return clampPt(r.right - end, r.top + r.height * f + 10); }, rand(1300, 1900));
        if (queue.length) return;
      }
      await calm(rand(900, 1600));
    },
    async measure(p) {
      // check the gap between two stacked elements
      const vis = visibleBuilt().filter((e) => e.dataset.b !== "rule");
      const pairs = [];
      for (let i = 0; i < vis.length - 1; i++) {
        const a = vis[i].getBoundingClientRect(), b = vis[i + 1].getBoundingClientRect();
        const gap = b.top - a.bottom;
        if (gap >= 8 && gap < 220 && Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)) < 400) pairs.push([vis[i], vis[i + 1]]);
      }
      if (!pairs.length) return false;
      const [A, B] = pairs[Math.floor(Math.random() * pairs.length)];
      const ax = rand(0.25, 0.6);
      const place = () => {
        const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
        const x = Math.max(a.left, b.left) + Math.min(a.width, b.width) * ax;
        return { x, y1: a.bottom, y2: b.top };
      };
      await moveTo(p, () => { const m = place(); return clampPt(m.x + 6, (m.y1 + m.y2) / 2); }, rand(900, 1300));
      measureEl.style.setProperty("--c", p.color);
      const m = place();
      measureEl.style.transform = `translate3d(${Math.round(m.x)}px, ${Math.round(m.y1)}px, 0)`;
      measureEl.style.height = m.y2 - m.y1 + "px";
      measureEl.querySelector("span").textContent = Math.round(m.y2 - m.y1);
      measureEl.classList.add("show");
      await calm(rand(1300, 2000));
      measureEl.classList.remove("show");
      await calm(rand(600, 1200));
    },
    async nudge(p) {
      // pick something up, try it a few pixels over, put it back
      const el = pickEl(p, (e) => e.getBoundingClientRect().height < 160);
      if (!el) return false;
      await moveTo(p, () => pt(el, "c"), rand(900, 1300));
      click(p);
      select(p, el, "tl");
      p.sel.progress = 1;
      const dx = rand(6, 12) * (Math.random() < 0.5 ? -1 : 1);
      const start = { x: p.x, y: p.y };
      el.animate([{ translate: "0 0" }, { translate: `${dx}px 0`, offset: 0.35 }, { translate: `${dx}px 0`, offset: 0.65 }, { translate: "0 0" }],
        { duration: 1500, easing: "ease-in-out" });
      await moveTo(p, () => ({ x: start.x + dx, y: start.y }), 520);
      await sleep(460);
      await moveTo(p, () => start, 520);
      deselect(p);
      await calm(rand(800, 1400));
    },
    async rest() {
      await calm(rand(2200, 4200));
    },
    async visit(p) {
      // drift over towards the other person, like pointing something out
      const o = p === PRANAV ? CLAUDE : PRANAV;
      const ox = rand(40, 80) * (Math.random() < 0.5 ? -1 : 1), oy = rand(30, 60);
      const tx = o.x + ox, ty = o.y + oy;
      await moveTo(p, () => clampPt(tx, ty), rand(1200, 1700));
      await calm(rand(1200, 2200));
    },
    async away(p) {
      // step away from the screen for a moment, then come back
      const right = Math.random() < 0.5;
      const y = rand(TOP() + 80, innerHeight - 160);
      await moveTo(p, () => ({ x: right ? innerWidth + 60 : -60, y }), rand(900, 1300));
      await calm(rand(4000, 8000));
    },
    async wander(p) {
      const x = rand(LEFT() + 60, RIGHT() - 60), y = rand(TOP() + 60, innerHeight - 140);
      await moveTo(p, () => clampPt(x, y), rand(1400, 2200));
      await calm(rand(1600, 3000));
    },
  };
  const WEIGHTS = { glance: 3, select: 2, read: 2, measure: 2, nudge: 1.5, rest: 2, visit: 1, away: 0.6, wander: 1.5 };

  function pickIdle(p) {
    const other = p === PRANAV ? CLAUDE : PRANAV;
    p.history = p.history || [];
    const names = Object.keys(IDLE).filter((n) => !p.history.slice(-3).includes(n) && n !== other.doing);
    let r = Math.random() * names.reduce((t, n) => t + WEIGHTS[n], 0);
    for (const n of names) { r -= WEIGHTS[n]; if (r <= 0) return n; }
    return names[0] || "rest";
  }

  // each comment pair is used once before any repeats, in a shuffled order
  let chatDeck = [];
  function nextChat() {
    if (!chatDeck.length) chatDeck = CHATS.slice().sort(() => Math.random() - 0.5);
    return chatDeck.pop();
  }

  async function idle(p) {
    p.speed = 1;
    // Claude answers a pending comment first
    if (p === CLAUDE && pendingReply && performance.now() > pendingReply.at) {
      const { el, text } = pendingReply;
      pendingReply = null;
      if (inView(el)) {
        p.doing = "reply";
        const ox = rand(50, 90), oy = rand(20, 50);
        await moveTo(p, () => { const q = pt(el, "c"); return clampPt(q.x + ox, q.y + oy); });
        if (Math.random() < 0.5) { select(p, el, "tl"); p.sel.progress = 1; }
        say(p, text);
        await calm(1700);
        deselect(p);
        p.doing = null;
        return;
      }
    }
    // Pranav starts a conversation now and then
    if (p === PRANAV && !pendingReply && performance.now() > nextChatAt) {
      const el = pickEl(p);
      if (el) {
        p.doing = "chat";
        const [ask, reply] = nextChat();
        await moveTo(p, () => pt(el, "c"));
        say(p, ask);
        pendingReply = { el, text: reply, at: performance.now() + rand(900, 1500) };
        nextChatAt = performance.now() + rand(20000, 34000);
        await calm(1900);
        p.doing = null;
        return;
      }
    }
    const name = pickIdle(p);
    p.doing = name;
    p.history.push(name);
    if (p.history.length > 6) p.history.shift();
    const ok = await IDLE[name](p);
    if (ok === false) await IDLE.wander(p);
    p.doing = null;
    p.focus = null;
  }

  async function worker(p, delay) {
    await sleep(delay);
    for (;;) {
      if (p.request) {
        const job = p.request;
        p.request = null;
        p.doing = "visitor";
        try { await job(p); } catch (e) {}
        p.doing = null;
        continue;
      }
      if (skipped) { await idle(p); continue; }
      const el = take();
      if (el) {
        if (!inView(el)) { el.__busy = false; instant(el); continue; }
        try { await build(p, el); } catch (e) { el.__busy = false; instant(el); }
      } else if (queue.length) {
        await sleep(80);
      } else {
        await idle(p);
      }
    }
  }

  /* ---------------- Skip ---------------- */
  let skipped = false;
  const skipBtn = document.getElementById("lb-skip");
  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      skipped = true;
      queue.length = 0;
      items.forEach((el) => { io.unobserve(el); instant(el); });
      PEOPLE.forEach((p) => { p.caret.el.classList.remove("show"); p.caret.unit = null; deselect(p); });
      skipBtn.textContent = "Showing final";
      skipBtn.disabled = true;
    });
  }

  /* ---------------- The visitor: their own cursor joins in ---------------- */
  const YOU_COLOR = "#2fbf71";
  const you = { x: -100, y: -100, seen: false, lastMove: 0, still: 0 };
  function anyRequest() { return PEOPLE.some((p) => p.request); }
  function helper(prefer) {
    // whoever is free; never pull someone off a build
    const free = PEOPLE.filter((p) => !p.request && p.doing !== "visitor" && p.doing !== "chat" && p.doing !== "reply");
    if (prefer && free.includes(prefer)) return prefer;
    return free.sort((a, b) => (a.doing ? 1 : 0) - (b.doing ? 1 : 0))[0] || null;
  }
  function nearYou(ox, oy) { return () => clampPt(you.x + ox, you.y + oy); }
  const once = (arr) => { const a = arr.slice().sort(() => Math.random() - 0.5); return () => (a.length ? a.pop() : null); };

  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer) {
    // name tag that rides along with the visitor's own pointer
    const tag = document.createElement("div");
    tag.className = "you-tag";
    tag.textContent = "You";
    tag.style.setProperty("--c", YOU_COLOR);
    mp.appendChild(tag);

    // hover outline in the visitor's colour
    const hov = document.createElement("div");
    hov.className = "you-hover";
    hov.style.setProperty("--c", YOU_COLOR);
    hov.innerHTML = "<span></span>";
    mp.appendChild(hov);
    let hovEl = null;

    // click ripple
    function ripple(x, y) {
      const r = document.createElement("div");
      r.className = "you-ripple";
      r.style.setProperty("--c", YOU_COLOR);
      r.style.left = x + "px"; r.style.top = y + "px";
      mp.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }

    const placeYou = () => {
      tag.style.transform = `translate3d(${Math.round(you.x + 14)}px, ${Math.round(you.y + 20)}px, 0)`;
      if (hovEl && isBuilt(hovEl)) {
        const r = hovEl.getBoundingClientRect();
        hov.style.transform = `translate3d(${r.left - 2}px, ${r.top - 2}px, 0)`;
        hov.style.width = r.width + 4 + "px";
        hov.style.height = r.height + 4 + "px";
      }
      if (chatBox.classList.contains("show")) chatBox.style.transform = `translate3d(${Math.round(you.x + 14)}px, ${Math.round(you.y + 44)}px, 0)`;
    };
    addEventListener("scroll", placeYou, { passive: true });

    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      you.x = e.clientX; you.y = e.clientY; you.lastMove = performance.now();
      if (!you.seen) { you.seen = true; tag.classList.add("show"); greetSoon(); }
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const el = target && target.closest && target.closest("[data-b].is-built");
      hovEl = el && el.getBoundingClientRect().height < innerHeight * 0.9 ? el : null;
      hov.classList.toggle("show", !!hovEl);
      if (hovEl) hov.querySelector("span").textContent = layerName(hovEl);
      placeYou();
      watchLinger(target);
      maybeDodge();
    }, { passive: true });
    document.addEventListener("mouseleave", () => { tag.classList.remove("show"); hov.classList.remove("show"); });
    document.addEventListener("mouseenter", () => { if (you.seen) tag.classList.add("show"); });
    addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") ripple(e.clientX, e.clientY); }, { passive: true });

    /* --- 1. a hello when you arrive (once per visit) --- */
    let greeted = false;
    try { greeted = !!sessionStorage.getItem("lb-greeted"); } catch (e) {}
    function greetSoon() {
      if (greeted) return;
      greeted = true;
      try { sessionStorage.setItem("lb-greeted", "1"); } catch (e) {}
      setTimeout(() => {
        const h = helper(CLAUDE);
        if (!h) return;
        h.request = async (p) => {
          await moveTo(p, nearYou(70, 34), 1000);
          say(p, "Hi 👋 you’re in the file with us!", 3000);
          await sleep(1400);
          const o = p === PRANAV ? CLAUDE : PRANAV;
          if (!o.request) o.request = async (q) => {
            await moveTo(q, nearYou(-150, 50), 1100);
            say(q, "Press / to chat with us", 3400);
            hint.classList.add("show");
            setTimeout(() => hint.classList.remove("show"), 7000);
            await sleep(1600);
          };
          await sleep(900);
        };
      }, 2200);
    }

    /* --- 2. a comment when you linger on a project --- */
    const lingerLines = once([
      "Good pick, click to open it ↗",
      "This one’s a favourite 👀",
      "There are more slides in Portfolio 2",
      "Take your time, we’re still building 🛠️",
      "Pranav loved making this one",
    ]);
    let lingerT = null, lingerEl = null, lastLinger = 0;
    function watchLinger(target) {
      const card = target && target.closest && target.closest(".card, .case-media, .slide .media");
      if (card === lingerEl) return;
      lingerEl = card;
      clearTimeout(lingerT);
      if (!card || performance.now() - lastLinger < 14000) return;
      lingerT = setTimeout(() => {
        const line = lingerLines();
        const h = helper();
        if (!line || !h || lingerEl !== card) return;
        lastLinger = performance.now();
        h.request = async (p) => {
          await moveTo(p, nearYou(rand(50, 90), rand(-70, -40)), 900);
          say(p, line, 2800);
          await sleep(1600);
        };
      }, 1300);
    }

    /* --- 3. they dodge when you get too close --- */
    const dodgeLines = ["Hey! 👋", "Catch me if you can 😄", "Oh, hi there", "Personal space! 😅", "👀"];
    let lastDodge = 0;
    function maybeDodge() {
      if (performance.now() - lastDodge < 5000) return;
      for (const p of PEOPLE) {
        if (p.request || p.doing === "visitor" || p.doing === "chat") continue;
        const building = items.some((el) => el.__busy && p.sel.target === el && el.classList.contains("is-building"));
        if (building) continue;
        if (Math.hypot(p.x - you.x, p.y - you.y) < 46) {
          lastDodge = performance.now();
          const ang = Math.atan2(p.y - you.y, p.x - you.x) + rand(-0.6, 0.6);
          const tx = p.x + Math.cos(ang) * 110, ty = p.y + Math.sin(ang) * 80;
          p.request = async (q) => {
            await moveTo(q, () => clampPt(tx, ty), 420);
            say(q, dodgeLines[Math.floor(Math.random() * dodgeLines.length)], 1800);
            await sleep(900);
          };
          break;
        }
      }
    }

    /* --- 4. cursor chat: press / and type --- */
    const hint = document.createElement("div");
    hint.className = "you-hint";
    hint.innerHTML = "Press <kbd>/</kbd> to chat with Pranav &amp; Claude";
    document.body.appendChild(hint);

    const chatBox = document.createElement("div");
    chatBox.className = "you-chat";
    chatBox.style.setProperty("--c", YOU_COLOR);
    chatBox.innerHTML = '<input type="text" maxlength="80" placeholder="Say something…" aria-label="Chat message">';
    mp.appendChild(chatBox);
    const chatIn = chatBox.querySelector("input");

    function openChat() {
      if (you.x < 0) { you.x = innerWidth / 2; you.y = innerHeight / 2; }
      chatBox.classList.add("show");
      chatBox.classList.remove("said");
      chatIn.readOnly = false;
      chatIn.value = "";
      placeYou();
      chatIn.focus({ preventScroll: true });
      hint.classList.remove("show");
    }
    function closeChat() {
      chatBox.classList.remove("show", "said");
      chatIn.blur();
    }
    function replyTo(msg) {
      const m = msg.toLowerCase();
      if (/\b(hi|hello|hey|hii+|yo|namaste)\b/.test(m)) return "Hey! 👋 Glad you dropped by";
      if (/(hire|job|intern|work with|collab|freelance|opportunit|role)/.test(m)) return "Love that! Pranav’s email is in Contact ✉️";
      if (/(nice|love|cool|great|awesome|amazing|beautiful|wow|fire|sick|good)/.test(m)) return "Thank you! 🙌 That means a lot";
      if (/(who|claude|ai|bot)/.test(m)) return "I’m Claude, I helped Pranav build this 🤝";
      if (/\?$/.test(m)) return "Good question! Ask Pranav via Contact 😊";
      return "Noted! Pranav will see this 😊";
    }
    chatIn.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") { closeChat(); return; }
      if (e.key !== "Enter") return;
      const msg = chatIn.value.trim();
      if (!msg) { closeChat(); return; }
      chatIn.readOnly = true;
      chatBox.classList.add("said");
      chatIn.blur();
      setTimeout(closeChat, 4200);
      const answer = replyTo(msg);
      const h = helper(Math.random() < 0.5 ? PRANAV : CLAUDE) || helper();
      if (h) h.request = async (p) => {
        await moveTo(p, nearYou(rand(60, 100), rand(50, 80)), 800);
        say(p, answer, 3400);
        await sleep(1500);
      };
    });
    addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
      e.preventDefault();
      openChat();
    });
  }

  /* ---------------- Go ---------------- */
  const start = () => {
    items.forEach((el) => io.observe(el));
    worker(PRANAV, 150);
    worker(CLAUDE, 450);
  };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start, start);
})();
