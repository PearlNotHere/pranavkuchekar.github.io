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
      if (dur == null) dur = clamp(260 + dist * 0.55, 260, 900);
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
      p.el.style.transform = `translate3d(${p.x - 3}px, ${p.y - 2}px, 0)`;

      const s = p.sel;
      if (s.target) {
        const r = s.target.getBoundingClientRect();
        const w = r.width * s.progress, h = r.height * s.progress;
        s.el.style.transform = `translate3d(${r.left - 1}px, ${r.top - 1}px, 0)`;
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

  function select(p, el) {
    const s = p.sel;
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

  async function build(p, el) {
    const type = el.dataset.b;
    p.speed = BASE_SPEED * (queue.length > 8 ? 1.8 : queue.length > 4 ? 1.3 : 1);
    const k = 1 / p.speed;
    status(p, `${VERB[type] || "Editing"} ${layerName(el)}`);
    el.classList.add("is-building");
    layerState(el, "building", p);
    inspect(p, el);

    await moveTo(p, () => pt(el, "tl"));
    select(p, el);

    if (type === "type") {
      p.sel.progress = 1;
      const units = el.__units || [];
      const per = clamp(1500 / Math.max(units.length, 1), el.dataset.mode === "char" ? 35 : 10, 70) * k;
      p.caret.el.classList.add("show");
      for (let i = 0; i < units.length; i++) {
        if (!inView(el)) { units.forEach((u) => u.classList.add("on")); break; }
        units[i].classList.add("on");
        p.caret.unit = units[i];
        // the cursor drifts along with the text, a little behind the caret
        if (i % 6 === 0 && !p.tween) {
          const u = units[i];
          moveTo(p, () => { const r = u.getBoundingClientRect(); return clampPt(r.right + 14, r.bottom + 6); }, 380);
        }
        await sleep(per);
      }
      p.caret.el.classList.remove("show");
      p.caret.unit = null;
    } else if (type === "img") {
      // drag out the frame with the placeholder, then drop the image in
      const drag = animateProgress(p, 420 * k);
      await moveTo(p, () => pt(el, "br"), 420);
      await drag;
      const img = el.querySelector("img");
      if (img && !img.complete) await Promise.race([new Promise((r) => img.addEventListener("load", r, { once: true })), sleep(2500)]);
      await moveTo(p, () => pt(el, "c"), 360);
      await sleep(120 * k);
      el.classList.add("dropped");
    } else {
      const drag = animateProgress(p, 380 * k);
      await moveTo(p, () => pt(el, "br"), 380);
      await drag;
      await sleep(80 * k);
      el.classList.add("popped");
    }

    el.classList.remove("is-building");
    el.classList.add("is-built");
    layerState(el, "built");
    await sleep(260 * k);
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
  let chatIdx = Math.floor(Math.random() * CHATS.length);
  let nextChatAt = performance.now() + rand(9000, 14000) / BASE_SPEED;
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

  async function idle(p) {
    p.speed = 1;
    // Claude answers a pending comment first
    if (p === CLAUDE && pendingReply && performance.now() > pendingReply.at) {
      const { el, text } = pendingReply;
      pendingReply = null;
      if (inView(el)) {
        status(p, "Replying to Pranav");
        await moveTo(p, () => { const q = pt(el, "c"); return clampPt(q.x + 70, q.y + 30); });
        select(p, el); p.sel.progress = 1;
        say(p, text);
        await sleep(1600);
        deselect(p);
        return;
      }
    }
    // Pranav starts a conversation now and then
    if (p === PRANAV && !pendingReply && performance.now() > nextChatAt) {
      const pool = visibleBuilt();
      if (pool.length) {
        const el = pool[Math.floor(Math.random() * pool.length)];
        const [ask, reply] = CHATS[chatIdx++ % CHATS.length];
        status(p, "Leaving a comment");
        await moveTo(p, () => pt(el, "c"));
        say(p, ask);
        pendingReply = { el, text: reply, at: performance.now() + 1100 };
        nextChatAt = performance.now() + rand(14000, 22000);
        await sleep(1800);
        return;
      }
    }
    // otherwise: look over something on screen, sometimes select it
    const pool = visibleBuilt();
    status(p, p === PRANAV ? "Reviewing layout" : "Checking alignment");
    if (pool.length && Math.random() < 0.55) {
      const el = pool[Math.floor(Math.random() * pool.length)];
      await moveTo(p, () => { const q = pt(el, "c"); return clampPt(q.x + rand(-60, 60), q.y + rand(-20, 20)); }, rand(700, 1200));
      if (Math.random() < 0.4 && !queue.length) {
        select(p, el); p.sel.progress = 1;
        await sleep(900);
        deselect(p);
      }
    } else {
      const x = rand(LEFT() + 60, RIGHT() - 60), y = rand(TOP() + 60, innerHeight - 140);
      await moveTo(p, () => clampPt(x, y), rand(800, 1400));
    }
    // wait a bit, but wake early if there is work
    const until = performance.now() + rand(500, 1300);
    while (performance.now() < until && !queue.length) await sleep(90);
  }

  async function worker(p, delay) {
    await sleep(delay);
    for (;;) {
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

  /* ---------------- Go ---------------- */
  const start = () => {
    items.forEach((el) => io.observe(el));
    worker(PRANAV, 150);
    worker(CLAUDE, 450);
  };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start, start);
})();
