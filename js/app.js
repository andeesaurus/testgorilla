/* Bain screening test simulator: test flow, timer, results, formulas and history. */
(function () {
  "use strict";

  const D = window.TG_DATA;
  const F = window.TG_FORMULAS;
  const CATS = D.CATS;

  /* ---------------- utilities ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const now = () => Date.now();
  const mmss = (sec) => {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const fmtDate = (ts) => new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem("tg." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem("tg." + k, JSON.stringify(v)); } catch (e) { /* storage blocked: keep going without it */ } },
    del(k) { try { localStorage.removeItem("tg." + k); } catch (e) { /* ignore */ } },
  };

  /* ---------------- settings & state ---------------- */
  const LINEUPS = {
    standard: { label: "Bain 2026 standard", cats: ["CT", "WD", "NR", "PS"] },
    legacy: { label: "Legacy US", cats: ["NR", "BJ", "LP", "PS"] },
  };
  const DEFAULTS = {
    format: "mock", lineup: "standard", single: "NR", practiceCat: "all", practiceSub: "all",
    qcount: "random", calc: "physical", extra: 0, progression: "progressive",
    custom: ["CT", "WD", "NR", "PS", "BJ", "LP"].map((cat, i) => ({ cat, on: i < 4, min: 10, n: "random" })),
  };
  let settings = Object.assign({}, DEFAULTS, store.get("settings", {}));
  if (!Array.isArray(settings.custom) || settings.custom.length !== 6) settings.custom = DEFAULTS.custom;
  const saveSettings = () => store.set("settings", settings);

  let A = store.get("attempt", null); // the session on the Simulator tab
  const saveA = () => (A ? store.set("attempt", A) : store.del("attempt"));
  let tab = "sim";
  let timer = null;
  let formulasFocus = null; // card id to highlight on the Formulas tab
  let formulasSection = "pct";
  let formulasQuery = "";
  let historyPanel = null; // "export" | "import" | "reset"

  const isTimed = () => A && (A.kind === "mock" || A.kind === "single");
  const timedRunning = () => isTimed() && A.phase === "question";
  const mockInProgress = () => isTimed() && A.phase !== "results";

  /* ---------------- difficulty ---------------- */
  // Share of L1-L4 questions in each test. Progressive mode moves up one level per finished mock.
  const LEVELS = [
    { name: "Level 1 · Standard mix", mix: [0.25, 0.5, 0.25, 0] },
    { name: "Level 2 · Harder", mix: [0.17, 0.42, 0.29, 0.12] },
    { name: "Level 3 · Hard", mix: [0.08, 0.34, 0.33, 0.25] },
    { name: "Level 4 · Hardest", mix: [0, 0.25, 0.42, 0.33] },
  ];
  const mocksDone = () => store.get("history", []).filter((h) => String(h.label).startsWith("Full mock")).length;
  function currentLevel() {
    if (settings.progression !== "progressive") return Math.max(0, Math.min(3, Number(settings.progression) || 0));
    return Math.min(3, mocksDone());
  }

  /* ---------------- question selection ---------------- */
  function tierSplit(n, level) {
    const counts = LEVELS[level].mix.map((m) => Math.round(m * n));
    counts[1] += n - counts.reduce((a, b) => a + b, 0);
    return counts;
  }

  function parseNum(t) {
    const m = String(t).replace(/−/g, "-").replace(/,/g, "")
      .match(/^([+-])?[£$€]?([+-])?(\d*\.?\d+)\s*(%|pp|percentage points|units|years|days|hours|m|k|bn)?$/i);
    if (!m) return null;
    const sign = m[1] === "-" || m[2] === "-" ? -1 : 1;
    return sign * parseFloat(m[3]);
  }

  // Display order of a question's options: numeric options ascending, others shuffled.
  function optionOrder(q) {
    const idx = q.opts.map((_, i) => i);
    const vals = q.opts.map((o) => parseNum(o.t));
    if (vals.every((v) => v !== null)) return idx.sort((a, b) => vals[a] - vals[b]);
    return shuffle(idx);
  }

  // Picks `need` items, spreading sub-skills. Items solved correctly before are used only when
  // nothing else is left; items merely seen come next; harder items win ties when filling gaps.
  function pickDiverse(cands, need, chosen, seen, solved, preferHard) {
    const out = [];
    const subCount = {};
    chosen.forEach((q) => (subCount[q.sub] = (subCount[q.sub] || 0) + 1));
    let pool = cands.slice();
    while (out.length < need && pool.length) {
      let best = 0, bestScore = Infinity;
      pool.forEach((q, i) => {
        const score = (solved.has(q.id) ? 1000 : 0) + (seen.has(q.id) ? 100 : 0) + (subCount[q.sub] || 0) * 3 +
          (preferHard ? (4 - q.tier) * 2 : 0) + Math.random();
        if (score < bestScore) { bestScore = score; best = i; }
      });
      const q = pool.splice(best, 1)[0];
      out.push(q);
      subCount[q.sub] = (subCount[q.sub] || 0) + 1;
      pool = pool.filter((x) => x.id !== q.id);
    }
    return out;
  }

  function draw(cat, n, used, level) {
    const seen = new Set(store.get("seen", []));
    const solved = new Set(store.get("solved", []));
    const gens = [];
    for (let i = 0; i < 14; i++) {
      const g = D.generate(cat);
      if (g && !used.has(g.id) && !gens.some((x) => x.id === g.id)) gens.push(g);
    }
    const all = D.BANK.filter((q) => q.cat === cat && !used.has(q.id)).concat(gens);
    const chosen = [];
    tierSplit(n, level).forEach((need, t) => {
      const cands = shuffle(all.filter((q) => q.tier === t + 1));
      chosen.push(...pickDiverse(cands, need, chosen, seen, solved, false));
    });
    if (chosen.length < n) { // a tier ran short: fill with the hardest items left
      const rest = shuffle(all.filter((q) => !chosen.includes(q)));
      chosen.push(...pickDiverse(rest, n - chosen.length, chosen, seen, solved, true));
    }
    while (chosen.length < n) { // tiny pool: allow repeats rather than a short test
      chosen.push(shuffle(D.BANK.filter((q) => q.cat === cat))[0]);
    }
    chosen.forEach((q) => used.add(q.id));
    return arrange(chosen);
  }

  // Questions get harder as the test goes on: warm-ups first, challenge items last.
  function arrange(qs) {
    return qs.map((q) => ({ q, k: q.tier + Math.random() * 0.9 })).sort((a, b) => a.k - b.k).map((x) => x.q);
  }

  /* ---------------- starting sessions ---------------- */
  const qCount = (v) => (v === "random" ? ri(12, 15) : Number(v));
  const extraFactor = () => 1 + Number(settings.extra || 0) / 100;

  function makeTest(cat, minutes, n, used, level) {
    const qs = draw(cat, n, used, level);
    return {
      cat, name: CATS[cat].name, sec: Math.round(minutes * 60 * extraFactor()),
      qs, ord: qs.map(optionOrder), ans: qs.map(() => ({ sel: null, t: 0, st: "unseen" })),
      idx: 0, deadline: null, started: null, ended: null, timedOut: false, ann: {},
      ex: D.EXAMPLES[cat], exOrd: optionOrder(D.EXAMPLES[cat]),
    };
  }

  function startTimed() {
    const used = new Set();
    const level = currentLevel();
    let tests, label;
    if (settings.format === "single") {
      tests = [makeTest(settings.single, 10, qCount(settings.qcount), used, level)];
      label = `Single test · ${CATS[settings.single].name}`;
    } else if (settings.lineup === "custom") {
      const rows = settings.custom.filter((r) => r.on);
      if (!rows.length) { toast("Choose at least one test for the custom lineup."); return; }
      tests = rows.map((r) => makeTest(r.cat, Number(r.min), qCount(r.n), used, level));
      label = "Full mock · Custom";
    } else {
      tests = LINEUPS[settings.lineup].cats.map((c) => makeTest(c, 10, qCount(settings.qcount), used, level));
      label = `Full mock · ${LINEUPS[settings.lineup].label}`;
    }
    A = {
      kind: settings.format === "single" ? "single" : "mock", label, created: now(),
      calc: settings.calc, extra: Number(settings.extra || 0), level,
      tests, ti: 0, phase: "intro", cur: null, qStart: null, hidden: 0,
      notice: null, saved: false, pauseUntil: null, exChecked: false, exSel: null,
    };
    saveA();
    render();
  }

  function startPractice(cat, sub, count, title) {
    let pool = D.BANK.filter((q) => (cat === "all" || q.cat === cat) && (sub === "all" || q.sub === sub));
    const genCats = cat === "all" ? Object.keys(D.GENERATORS) : [cat];
    for (let i = 0; i < 12; i++) {
      const c = genCats[i % genCats.length];
      const g = sub === "all" ? D.generate(c) : D.generateFor(c, sub);
      if (g && !pool.some((x) => x.id === g.id)) pool.push(g);
    }
    let qs = shuffle(pool).slice(0, count);
    if (qs.length < count && cat !== "all") {
      const more = shuffle(D.BANK.filter((q) => q.cat === cat && !qs.includes(q)));
      qs = qs.concat(more.slice(0, count - qs.length));
    }
    if (!qs.length) { toast("No questions match that choice yet."); return; }
    A = {
      kind: "practice", label: title, created: now(), phase: "practice",
      qs, ord: qs.map(optionOrder), ans: qs.map(() => ({ sel: null, checked: false })), idx: 0,
    };
    saveA();
    tab = "sim";
    render();
  }

  function startDrill(cat, sub) {
    if (mockInProgress()) { toast("Finish or end your mock before starting a drill."); return; }
    startPractice(cat, sub, 5, `Drill · ${sub}`);
  }

  /* ---------------- timed flow ---------------- */
  const curTest = () => A.tests[A.ti];

  function beginTest() {
    const t = curTest();
    t.started = now();
    t.deadline = t.started + t.sec * 1000;
    A.phase = "question";
    A.qStart = now();
    A.cur = null;
    A.notice = null;
    saveA();
    try { history.pushState({ tg: 1 }, ""); } catch (e) { /* ignore */ }
    render();
  }

  function submit(skip) {
    const t = curTest();
    if (!skip && A.cur == null) return;
    const spent = (now() - A.qStart) / 1000;
    t.ans[t.idx] = { sel: skip ? null : t.ord[t.idx][A.cur], t: Math.round(spent * 10) / 10, st: skip ? "skipped" : "answered" };
    t.idx++;
    A.cur = null;
    A.qStart = now();
    if (t.idx >= t.qs.length) finishTest(false);
    else { saveA(); render(); }
  }

  function finishTest(timedOut) {
    const t = curTest();
    stopTimer();
    if (timedOut) {
      t.timedOut = true;
      if (t.idx < t.qs.length) {
        const spent = (t.deadline - A.qStart) / 1000;
        t.ans[t.idx] = A.cur != null
          ? { sel: t.ord[t.idx][A.cur], t: Math.round(spent * 10) / 10, st: "answered" }
          : { sel: null, t: Math.round(spent * 10) / 10, st: "timeout" };
      }
      const unseen = t.ans.filter((a) => a.st === "unseen" || a.st === "timeout").length;
      A.notice = `Time ran out on ${t.name}. ${A.cur != null ? "Your selected option on the open question counted. " : ""}${unseen} question${unseen === 1 ? "" : "s"} you didn't reach scored as wrong.`;
    }
    t.ended = Math.min(now(), t.deadline);
    A.cur = null;
    if (A.ti >= A.tests.length - 1) {
      A.phase = "results";
      recordResults();
    } else {
      A.phase = "between";
    }
    saveA();
    render();
  }

  function nextTest() {
    A.ti++;
    A.phase = "intro";
    A.pauseUntil = null;
    A.exChecked = false;
    A.exSel = null;
    saveA();
    render();
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(tick, 250);
    tick();
  }
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }

  function tick() {
    if (!A) return stopTimer();
    if (A.phase === "pause") {
      const rem = (A.pauseUntil - now()) / 1000;
      const el = $("#pause-clock");
      if (el) el.textContent = mmss(rem);
      if (rem <= 0) nextTest();
      return;
    }
    if (A.phase !== "question") return stopTimer();
    const t = curTest();
    const rem = (t.deadline - now()) / 1000;
    const el = $("#clock");
    if (el) {
      el.textContent = mmss(rem);
      el.classList.toggle("warn", rem <= 60 && rem > 15);
      el.classList.toggle("crit", rem <= 15);
    }
    [[300, "5 minutes remaining"], [60, "1 minute remaining"], [15, "15 seconds remaining"]].forEach(([s, msg]) => {
      if (rem <= s && rem > 0 && !t.ann[s] && t.sec > s) { t.ann[s] = 1; announce(msg); saveA(); }
    });
    if (rem <= 0) finishTest(true);
  }

  /* ---------------- results ---------------- */
  const isRight = (q, sel) => sel != null && q.opts[sel].w === null;

  function summarize(a) {
    let correct = 0, total = 0, seenQ = 0, used = 0;
    const lost = {};
    const tests = a.tests.map((t) => {
      const c = t.qs.filter((q, i) => isRight(q, t.ans[i].sel)).length;
      const timeUsed = Math.max(0, Math.round(((t.ended || now()) - t.started) / 1000));
      const seenN = t.ans.filter((x) => x.st === "answered" || x.st === "skipped" || x.st === "timeout").length;
      t.qs.forEach((q, i) => {
        if (!isRight(q, t.ans[i].sel)) {
          const k = q.cat + "|" + q.sub;
          lost[k] = (lost[k] || 0) + 1;
        }
      });
      correct += c; total += t.qs.length; seenQ += seenN; used += timeUsed;
      return { cat: t.cat, name: t.name, correct: c, total: t.qs.length, timeUsed, limit: t.sec, avg: seenN ? Math.round(timeUsed / seenN) : 0, timedOut: t.timedOut };
    });
    let weakest = null;
    Object.entries(lost).forEach(([k, v]) => { if (!weakest || v > weakest.lost) weakest = { cat: k.split("|")[0], sub: k.split("|")[1], lost: v }; });
    return { tests, correct, total, pct: total ? Math.round((correct / total) * 100) : 0, avgSec: seenQ ? Math.round(used / seenQ) : 0, weakest };
  }

  function recordResults() {
    if (A.saved) return;
    A.saved = true;
    const s = summarize(A);
    const hist = store.get("history", []);
    hist.push({
      date: A.created, label: A.label, calc: A.calc, extra: A.extra, hidden: A.hidden, level: A.level,
      pct: s.pct, correct: s.correct, total: s.total, avgSec: s.avgSec,
      tests: s.tests.map((t) => ({ name: t.name, correct: t.correct, total: t.total, timeUsed: t.timeUsed, avg: t.avg })),
    });
    store.set("history", hist.slice(-200));
    const seen = store.get("seen", []);
    A.tests.forEach((t) => t.qs.forEach((q) => seen.push(q.id)));
    store.set("seen", seen.slice(-600));
    A.tests.forEach((t) => t.qs.forEach((q, i) => { if (isRight(q, t.ans[i].sel)) markSolved(q.id); }));
  }

  // Questions answered correctly are held back from later draws while fresh ones remain.
  function markSolved(id) {
    const solved = store.get("solved", []);
    if (!solved.includes(id)) { solved.push(id); store.set("solved", solved.slice(-1000)); }
  }

  const TIER_NAMES = { 1: "L1 warm-up", 2: "L2 core", 3: "L3 stretch", 4: "L4 challenge" };
  const paceFlag = (sec) => (sec < 30 ? "fast" : sec <= 60 ? "on pace" : "slow");

  /* ---------------- exhibits ---------------- */
  function exhibitHTML(ex) {
    if (!ex) return "";
    if (ex.type === "table") {
      return `<figure class="ex"><div class="tablewrap"><table><caption>${esc(ex.title)}</caption>
        <thead><tr>${ex.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${ex.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("")}</tbody>
        </table></div>${ex.note ? `<figcaption class="ex-note">${esc(ex.note)}</figcaption>` : ""}</figure>`;
    }
    if (ex.type === "passage") {
      return `<figure class="ex"><figcaption class="ex-title">${esc(ex.title)}</figcaption><blockquote class="passage">${esc(ex.text)}</blockquote></figure>`;
    }
    if (ex.type === "rules") {
      return `<figure class="ex"><figcaption class="ex-title">${esc(ex.title)}</figcaption><ul class="rules">${ex.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></figure>`;
    }
    if (ex.type === "bar" || ex.type === "line") return `<figure class="ex"><figcaption class="ex-title">${esc(ex.title)}</figcaption>${xyChart(ex)}</figure>`;
    if (ex.type === "pie") return `<figure class="ex"><figcaption class="ex-title">${esc(ex.title)}</figcaption>${pieChart(ex)}</figure>`;
    return "";
  }

  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  function xyChart(ex) {
    const W = 380, H = 230, L = 44, R = 12, T = 18, B = 30;
    const max = niceMax(Math.max(...ex.values) * 1.08);
    const iw = W - L - R, ih = H - T - B;
    const n = ex.values.length;
    const y = (v) => T + ih - (v / max) * ih;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
    const label = ex.labels.map((l, i) => `${l}: ${ex.values[i]}${ex.unit === "%" ? "%" : ""}`).join(", ");
    let marks = "";
    if (ex.type === "bar") {
      const bw = (iw / n) * 0.56;
      ex.values.forEach((v, i) => {
        const cx = L + (iw / n) * (i + 0.5);
        marks += `<rect x="${cx - bw / 2}" y="${y(v)}" width="${bw}" height="${T + ih - y(v)}" rx="2" style="fill:var(--accent)"/>`;
        marks += `<text x="${cx}" y="${y(v) - 5}" text-anchor="middle" class="ch-val">${v}</text>`;
        marks += `<text x="${cx}" y="${H - 10}" text-anchor="middle" class="ch-lab">${esc(ex.labels[i])}</text>`;
      });
    } else {
      const x = (i) => L + (iw / (n - 1)) * i;
      const pts = ex.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
      marks += `<polyline points="${pts}" style="fill:none;stroke:var(--accent);stroke-width:2.2"/>`;
      ex.values.forEach((v, i) => {
        marks += `<circle cx="${x(i)}" cy="${y(v)}" r="3.6" style="fill:var(--surface);stroke:var(--accent);stroke-width:2"/>`;
        marks += `<text x="${x(i)}" y="${y(v) - 9}" text-anchor="middle" class="ch-val">${v}</text>`;
        marks += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="ch-lab">${esc(ex.labels[i])}</text>`;
      });
    }
    const grid = ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line);stroke-width:1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ch-lab">${Math.round(v * 10) / 10}</text>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ex.title + ". " + label)}">${grid}${marks}</svg>`;
  }

  function pieChart(ex) {
    const total = ex.values.reduce((a, b) => a + b, 0);
    let a0 = -Math.PI / 2;
    const cx = 90, cy = 90, r = 82;
    const slices = ex.values.map((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`;
      a0 = a1;
      return `<path d="${d}" style="fill:var(--c${(i % 7) + 1});stroke:var(--surface);stroke-width:1.5"/>`;
    }).join("");
    const label = ex.labels.map((l, i) => `${l} ${ex.values[i]}%`).join(", ");
    const legend = ex.labels.map((l, i) => `<li><span class="sw" style="background:var(--c${(i % 7) + 1})"></span><span>${esc(l)}</span><span class="num">${ex.values[i]}%</span></li>`).join("");
    return `<div class="pie"><svg viewBox="0 0 180 180" role="img" aria-label="${esc(ex.title + ". " + label)}">${slices}</svg><ul class="legend">${legend}</ul></div>`;
  }

  /* ---------------- rendering: shell ---------------- */
  function render() {
    renderTabs();
    const main = $("#main");
    if (tab === "formulas") main.innerHTML = formulasHTML(false);
    else if (tab === "history") main.innerHTML = historyHTML();
    else main.innerHTML = simHTML();
    afterRender();
  }

  function renderTabs() {
    const locked = timedRunning();
    $$(".tab").forEach((b) => {
      const name = b.dataset.tab;
      b.setAttribute("aria-selected", String(name === tab));
      const dis = locked && name !== "sim";
      b.disabled = dis;
      b.title = dis ? "Locked during timed tests, as in the real assessment." : "";
    });
  }

  function afterRender() {
    if (tab === "sim" && A && (A.phase === "question" || A.phase === "pause")) startTimer();
    else stopTimer();
    const focusEl = $("[data-autofocus]");
    if (focusEl) focusEl.focus({ preventScroll: true });
    if (tab === "formulas" && formulasFocus) {
      const card = document.getElementById("card-" + formulasFocus);
      if (card) { card.classList.add("flash"); card.scrollIntoView({ block: "center" }); }
      formulasFocus = null;
    }
  }

  function simHTML() {
    if (!A) return setupHTML();
    switch (A.phase) {
      case "intro": return introHTML();
      case "question": return questionHTML();
      case "between": return betweenHTML();
      case "pause": return pauseHTML();
      case "results": return resultsHTML();
      case "practice": return practiceHTML();
      case "practiceDone": return practiceDoneHTML();
      default: return setupHTML();
    }
  }

  /* ---------------- setup ---------------- */
  const radio = (name, value, cur, label, hint) => `
    <label class="choice"><input type="radio" name="${name}" value="${value}" ${String(cur) === String(value) ? "checked" : ""}>
    <span><span class="choice-l">${label}</span>${hint ? `<span class="choice-h">${hint}</span>` : ""}</span></label>`;

  function lineupChips(cats) {
    return `<ol class="lineup">${cats.map((c, i) => `<li><span class="lineup-n">Test ${i + 1}</span>${esc(CATS[c].name)}</li>`).join("")}</ol>`;
  }

  function setupHTML() {
    const s = settings;
    const catOpts = (cur, withAll) => (withAll ? `<option value="all" ${cur === "all" ? "selected" : ""}>All categories</option>` : "") +
      Object.keys(CATS).map((k) => `<option value="${k}" ${cur === k ? "selected" : ""}>${esc(CATS[k].name)}</option>`).join("");
    const subs = Array.from(new Set(D.BANK.filter((q) => s.practiceCat === "all" || q.cat === s.practiceCat).map((q) => q.sub))).sort();
    const subOpts = `<option value="all">All sub-skills</option>` + subs.map((x) => `<option value="${esc(x)}" ${s.practiceSub === x ? "selected" : ""}>${esc(x)}</option>`).join("");
    const nOpts = (cur) => `<option value="random" ${cur === "random" ? "selected" : ""}>Random 12–15</option>` +
      [10, 11, 12, 13, 14, 15].map((n) => `<option value="${n}" ${String(cur) === String(n) ? "selected" : ""}>${n}</option>`).join("");

    let detail = "";
    if (s.format === "mock") {
      detail = `
        <div class="field"><span class="field-l">Lineup</span>
          <div class="choices">
            ${radio("lineup", "standard", s.lineup, "Bain 2026 standard", "Critical Thinking, Working with Data, Numerical Reasoning, Problem Solving")}
            ${radio("lineup", "legacy", s.lineup, "Legacy US", "Numerical Reasoning, Business Judgment, Leadership & People Management, Problem Solving")}
            ${radio("lineup", "custom", s.lineup, "Custom", "Pick 1–6 tests and set time and questions for each")}
          </div>
        </div>
        ${s.lineup === "custom" ? customHTML() : lineupChips(LINEUPS[s.lineup].cats)}`;
    } else if (s.format === "single") {
      detail = `<div class="field"><label class="field-l" for="single">Test</label><select id="single">${catOpts(s.single, false)}</select></div>`;
    } else {
      detail = `
        <div class="row2">
          <div class="field"><label class="field-l" for="practiceCat">Category</label><select id="practiceCat">${catOpts(s.practiceCat, true)}</select></div>
          <div class="field"><label class="field-l" for="practiceSub">Sub-skill</label><select id="practiceSub">${subOpts}</select></div>
        </div>
        <p class="muted">10 questions, no time limit. Back and Next work, and each answer is checked as you go. Formulas open in a side drawer.</p>`;
    }

    const timedOnly = s.format !== "practice" ? `
      <section class="panel">
        <h2>Test conditions</h2>
        <div class="row3">
          ${s.lineup === "custom" && s.format === "mock" ? "" : `<div class="field"><label class="field-l" for="qcount">Questions per test</label><select id="qcount">${nOpts(s.qcount)}</select><span class="field-h">10:00 per test</span></div>`}
          <div class="field"><label class="field-l" for="calc">Calculator</label>
            <select id="calc"><option value="physical" ${s.calc === "physical" ? "selected" : ""}>Physical calculator allowed</option><option value="none" ${s.calc === "none" ? "selected" : ""}>No calculator (hard mode)</option></select>
            <span class="field-h">There is no on-screen calculator</span></div>
          <div class="field"><label class="field-l" for="progression">Difficulty</label>
            <select id="progression"><option value="progressive" ${s.progression === "progressive" ? "selected" : ""}>Progressive (now ${LEVELS[Math.min(3, mocksDone())].name.split(" · ")[0]})</option>${LEVELS.map((l, i) => `<option value="${i}" ${String(s.progression) === String(i) ? "selected" : ""}>${l.name}</option>`).join("")}</select>
            <span class="field-h">Progressive steps up after each full mock you finish</span></div>
          <div class="field"><label class="field-l" for="extra">Extra time</label>
            <select id="extra">${[0, 25, 50].map((v) => `<option value="${v}" ${Number(s.extra) === v ? "selected" : ""}>${v ? "+" + v + "%" : "None"}</option>`).join("")}</select>
            <span class="field-h">For non-fluent English speakers</span></div>
        </div>
      </section>
      <section class="panel">
        <h2>Before you start</h2>
        <ul class="checklist">
          ${["Quiet room", "Charger plugged in", "Other tabs and apps closed", "One monitor", "Scratch paper and pen" + (s.calc === "physical" ? ", plus a calculator" : "")]
            .map((c, i) => `<li><label><input type="checkbox" id="chk${i}"> ${esc(c)}</label></li>`).join("")}
        </ul>
        <p class="muted">Once a test starts, the clock keeps running if you leave or refresh the page. Submitting locks your answer; you can't go back.</p>
      </section>` : "";

    const startLabel = s.format === "mock" ? "Start full mock" : s.format === "single" ? "Start test" : "Start practice";
    const resume = store.get("attempt", null);
    return `
      <div class="setup">
        <header class="page-head">
          <p class="eyebrow">Screening test practice</p>
          <h1>Set up your session</h1>
          <p class="lede">Timed tests with answers that lock on submit, built from reference sample questions and new questions written in the same style.</p>
        </header>
        <section class="panel">
          <h2>Format</h2>
          <div class="choices choices-3">
            ${radio("format", "mock", s.format, "Full mock", "All tests back to back, results at the end")}
            ${radio("format", "single", s.format, "Single test", "One 10-minute test")}
            ${radio("format", "practice", s.format, "Practice", "Untimed, instant feedback")}
          </div>
          ${detail}
        </section>
        ${timedOnly}
        <div class="actions"><button class="btn primary" id="start">${startLabel}</button></div>
        ${resume ? "" : ""}
      </div>`;
  }

  function customHTML() {
    const rows = settings.custom.map((r, i) => `
      <tr>
        <td><input type="checkbox" id="cu-on-${i}" data-cu="${i}" data-k="on" ${r.on ? "checked" : ""} aria-label="Include ${esc(CATS[r.cat].name)}"></td>
        <th scope="row">${esc(CATS[r.cat].name)}</th>
        <td><select id="cu-min-${i}" data-cu="${i}" data-k="min" aria-label="Minutes">${[5, 8, 10, 12, 15].map((m) => `<option ${Number(r.min) === m ? "selected" : ""}>${m}</option>`).join("")}</select></td>
        <td><select id="cu-n-${i}" data-cu="${i}" data-k="n" aria-label="Questions"><option value="random" ${r.n === "random" ? "selected" : ""}>12–15</option>${[10, 11, 12, 13, 14, 15].map((n) => `<option ${String(r.n) === String(n) ? "selected" : ""}>${n}</option>`).join("")}</select></td>
        <td class="order-btns"><button class="icon-btn" data-move="${i}" data-dir="-1" aria-label="Move ${esc(CATS[r.cat].name)} up" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-btn" data-move="${i}" data-dir="1" aria-label="Move ${esc(CATS[r.cat].name)} down" ${i === 5 ? "disabled" : ""}>↓</button></td>
      </tr>`).join("");
    return `<div class="tablewrap"><table class="custom"><caption class="sr-only">Custom lineup</caption>
      <thead><tr><th scope="col">Use</th><th scope="col">Test</th><th scope="col">Minutes</th><th scope="col">Questions</th><th scope="col">Order</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  /* ---------------- intro / question / between ---------------- */
  function introHTML() {
    const t = curTest();
    const n = A.tests.length;
    const ex = t.ex;
    const exOpts = t.exOrd.map((oi, k) => {
      const o = ex.opts[oi];
      let mark = "";
      if (A.exChecked) mark = o.w === null ? `<span class="tag ok">✓ Correct answer</span>` : (A.exSel === k ? `<span class="tag bad">✗ Your choice</span>` : "");
      return `<label class="opt ${A.exChecked ? "locked" : ""}"><input type="radio" name="exopt" value="${k}" ${A.exSel === k ? "checked" : ""} ${A.exChecked ? "disabled" : ""}><span class="key">${k + 1}</span><span class="opt-t">${esc(o.t)}</span>${mark}</label>`;
    }).join("");
    const exSolution = A.exChecked ? `<div class="explain"><p><strong>${isRight(ex, A.exSel != null ? t.exOrd[A.exSel] : null) ? "Correct." : "Answer: " + esc(ex.opts.find((o) => o.w === null).t) + "."}</strong> ${esc(ex.sol.join(" "))}</p></div>` : "";
    const extra = A.extra ? ` (includes +${A.extra}% extra time)` : "";
    return `
      <div class="intro">
        ${A.notice ? `<div class="banner" role="status">${esc(A.notice)}</div>` : ""}
        <header class="page-head">
          <p class="eyebrow">Test ${A.ti + 1} of ${n}</p>
          <h1>${esc(t.name)}</h1>
        </header>
        <div class="intro-grid">
          <section class="panel">
            <dl class="facts">
              <div><dt>Time</dt><dd class="num">You have ${mmss(t.sec)} for this test${extra}</dd></div>
              <div><dt>Questions</dt><dd class="num">${t.qs.length}, multiple choice, one answer each</dd></div>
              <div><dt>Difficulty</dt><dd>${esc(LEVELS[A.level || 0].name)}. Questions get harder as the test goes on.</dd></div>
              <div><dt>Calculator</dt><dd>${A.calc === "physical" ? "Physical calculator allowed, plus pen and paper" : "No calculator. Pen and paper only"}</dd></div>
            </dl>
            <ul class="rules-list">
              <li>Submit locks your answer; you cannot return.</li>
              <li>The timer continues if you leave or refresh.</li>
              <li>Skipped questions score as wrong. At 0:00 the test submits itself.</li>
              <li>Number keys choose an option; Enter submits.</li>
            </ul>
            <button class="btn primary big" id="begin" data-autofocus>Begin test</button>
          </section>
          <section class="panel example">
            <h2>Practice example <span class="muted">· untimed, not scored</span></h2>
            ${exhibitHTML(ex.ex)}
            <p class="stem">${esc(ex.stem)}</p>
            <div class="opts" role="radiogroup" aria-label="Example options">${exOpts}</div>
            ${A.exChecked ? exSolution : `<button class="btn" id="check-ex" ${A.exSel == null ? "disabled" : ""}>Check example</button>`}
          </section>
        </div>
      </div>`;
  }

  function questionHTML() {
    const t = curTest();
    const q = t.qs[t.idx];
    const last = t.idx === t.qs.length - 1;
    const rem = (t.deadline - now()) / 1000;
    const opts = t.ord[t.idx].map((oi, k) => `
      <label class="opt"><input type="radio" name="opt" value="${k}" ${A.cur === k ? "checked" : ""}>
      <span class="key">${k + 1}</span><span class="opt-t">${esc(q.opts[oi].t)}</span></label>`).join("");
    return `
      <div class="qscreen">
        <header class="qhead">
          <div><p class="eyebrow">${esc(t.name)}</p><p class="qcount num">Question ${t.idx + 1} of ${t.qs.length}</p></div>
          <div class="clock-wrap"><span class="sr-only">Time remaining</span><span id="clock" class="clock num ${rem <= 15 ? "crit" : rem <= 60 ? "warn" : ""}">${mmss(rem)}</span></div>
        </header>
        <div class="progress" aria-hidden="true"><span style="width:${(t.idx / t.qs.length) * 100}%"></span></div>
        <div class="qbody ${q.ex ? "" : "solo"} nocopy" id="qarea">
          ${q.ex ? `<div class="qex">${exhibitHTML(q.ex)}</div>` : ""}
          <div class="qmain">
            <p class="stem" id="stem">${esc(q.stem)}</p>
            <p class="select-one">Select only one</p>
            <div class="opts" role="radiogroup" aria-labelledby="stem">${opts}</div>
          </div>
        </div>
        <footer class="qfoot">
          <button class="btn ghost" id="skip">Skip question</button>
          <button class="btn primary" id="submit" ${A.cur == null ? "disabled" : ""}>${last ? "Submit &amp; finish test" : "Submit &amp; continue"}</button>
        </footer>
      </div>`;
  }

  function betweenHTML() {
    const done = curTest();
    const next = A.tests[A.ti + 1];
    return `
      <div class="between">
        ${A.notice ? `<div class="banner" role="status">${esc(A.notice)}</div>` : ""}
        <header class="page-head">
          <p class="eyebrow">Test ${A.ti + 1} of ${A.tests.length} complete</p>
          <h1>${esc(done.name)} submitted</h1>
          <p class="lede">Next: <strong>${esc(next.name)}</strong> · ${next.qs.length} questions · ${mmss(next.sec)}. Scores appear at the end of the mock.</p>
        </header>
        <div class="actions">
          <button class="btn primary" id="next" data-autofocus>Start next test now</button>
          <button class="btn" id="pause">Pause for 2 minutes</button>
        </div>
        <p class="muted">The real assessment has no break between tests, so the default is to carry straight on. Formulas &amp; Tips are open until the next test starts.</p>
      </div>`;
  }

  function pauseHTML() {
    return `
      <div class="between">
        <header class="page-head">
          <p class="eyebrow">Short break</p>
          <h1>Next test in <span id="pause-clock" class="num">${mmss((A.pauseUntil - now()) / 1000)}</span></h1>
          <p class="lede">The next test's intro screen opens automatically when the break ends.</p>
        </header>
        <div class="actions"><button class="btn primary" id="next" data-autofocus>Continue now</button></div>
      </div>`;
  }

  /* ---------------- results & review ---------------- */
  function linkFor(sub) {
    const l = F.SUB_LINK[sub];
    if (!l) return null;
    return l.startsWith("tip:") ? { id: "tip-" + l.slice(4), label: "Open the tip" } : { id: l, label: "Open formula card" };
  }

  function resultsHTML() {
    const s = summarize(A);
    const rows = s.tests.map((t) => `
      <tr><th scope="row">${esc(t.name)}${t.timedOut ? ` <span class="tag warn">Timed out</span>` : ""}</th>
      <td class="num">${t.correct}/${t.total}</td><td class="num">${Math.round((t.correct / t.total) * 100)}%</td>
      <td class="num">${mmss(t.timeUsed)} of ${mmss(t.limit)}</td><td class="num">${t.avg} s</td></tr>`).join("");
    const w = s.weakest;
    const link = w && linkFor(w.sub);
    const focus = w ? `
      <section class="panel focus">
        <p class="eyebrow">One thing to work on</p>
        <h2>${esc(w.sub)} <span class="muted">· ${esc(CATS[w.cat].name)}</span></h2>
        <p>You lost ${w.lost} point${w.lost === 1 ? "" : "s"} here, more than on any other sub-skill.</p>
        <div class="actions">
          ${link ? `<button class="btn" data-goto="${link.id}">${link.label}</button>` : ""}
          <button class="btn primary" data-drill="${w.cat}|${esc(w.sub)}">Practise 5 questions</button>
        </div>
      </section>` : `<section class="panel focus"><p class="eyebrow">One thing to work on</p><h2>No points lost</h2><p>Try a harder setting: no calculator, or 15 questions per test.</p></section>`;
    const notes = [LEVELS[A.level || 0].name + "."];
    if (A.extra) notes.push(`Taken with +${A.extra}% extra time.`);
    notes.push(A.calc === "physical" ? "Physical calculator allowed." : "No calculator.");
    if (A.hidden) notes.push(`You left the test window ${A.hidden} time${A.hidden === 1 ? "" : "s"}. That isn't penalised here, but the real test tracks it.`);
    const review = A.tests.map((t) => `
      <section class="review-test">
        <h3>${esc(t.name)} <span class="muted num">· ${t.qs.filter((q, i) => isRight(q, t.ans[i].sel)).length}/${t.qs.length}</span></h3>
        ${t.qs.map((q, i) => reviewRow(q, t.ord[i], t.ans[i], i)).join("")}
      </section>`).join("");
    return `
      <div class="results">
        <header class="page-head">
          <p class="eyebrow">${esc(A.label)} · ${fmtDate(A.created)}</p>
          <h1>Your results</h1>
        </header>
        <div class="score-grid">
          <section class="panel score">
            <p class="big-num num">${s.pct}%</p>
            <p class="muted num">${s.correct} of ${s.total} correct · ${s.avgSec} s per question on average</p>
            <p class="small">${esc(notes.join(" "))}</p>
          </section>
          ${focus}
        </div>
        <section class="panel">
          <h2>By test</h2>
          <div class="tablewrap"><table class="data"><thead><tr><th scope="col">Test</th><th scope="col">Score</th><th scope="col">%</th><th scope="col">Time used</th><th scope="col">Avg per question</th></tr></thead><tbody>${rows}</tbody></table></div>
          <p class="small muted">There's no pass or fail here. Bain publishes no cutoff, and accuracy reportedly counts for more than speed.</p>
        </section>
        <section class="panel">
          <h2>Question review</h2>
          <p class="small muted">Pace: fast under 30 s, on pace 30–60 s, slow over 60 s.</p>
          ${review}
        </section>
        <div class="actions"><button class="btn primary" id="new">Set up another session</button></div>
      </div>`;
  }

  function statusOf(q, a) {
    if (a.st === "unseen") return { cls: "bad", icon: "–", text: "Not reached" };
    if (a.st === "timeout") return { cls: "bad", icon: "–", text: "Time ran out" };
    if (a.st === "skipped" || a.sel == null) return { cls: "bad", icon: "–", text: "Skipped" };
    return isRight(q, a.sel) ? { cls: "ok", icon: "✓", text: "Correct" } : { cls: "bad", icon: "✗", text: "Wrong" };
  }

  function solutionHTML(q, ord, sel) {
    const right = q.opts.find((o) => o.w === null);
    const opts = ord.map((oi) => {
      const o = q.opts[oi];
      const mine = sel === oi;
      const tags = (o.w === null ? `<span class="tag ok">✓ Correct answer</span>` : "") + (mine ? `<span class="tag ${o.w === null ? "ok" : "bad"}">Your answer</span>` : "");
      return `<li class="${o.w === null ? "is-right" : mine ? "is-mine" : ""}"><span class="opt-t">${esc(o.t)}</span>${tags}${o.w ? `<span class="why">${mine ? "<strong>Why your choice does not work:</strong> " : ""}${esc(o.w)}</span>` : ""}</li>`;
    }).join("");
    return `
      ${exhibitHTML(q.ex)}
      <p class="stem">${esc(q.stem)}</p>
      <ul class="review-opts">${opts}</ul>
      <div class="explain"><p class="explain-h">Worked solution · ${esc(right.t)}</p><ol>${q.sol.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
      <p class="src small muted">${esc(q.src)} · ${esc(q.sub)} · ${TIER_NAMES[q.tier]}</p>`;
  }

  function reviewRow(q, ord, a, i) {
    const st = statusOf(q, a);
    const pace = a.st === "unseen" ? "" : `<span class="pace">${a.t} s · ${paceFlag(a.t)}</span>`;
    return `
      <details class="rrow">
        <summary><span class="rnum num">Q${i + 1}</span><span class="tag ${st.cls}">${st.icon} ${st.text}</span><span class="rsub">${esc(q.sub)}</span>${pace}</summary>
        <div class="rbody">${solutionHTML(q, ord, a.sel)}</div>
      </details>`;
  }

  /* ---------------- practice ---------------- */
  function practiceHTML() {
    const q = A.qs[A.idx];
    const a = A.ans[A.idx];
    const ord = A.ord[A.idx];
    const opts = ord.map((oi, k) => {
      const o = q.opts[oi];
      let mark = "";
      if (a.checked) {
        if (o.w === null) mark = `<span class="tag ok">✓ Correct answer</span>`;
        else if (a.sel === oi) mark = `<span class="tag bad">✗ Your answer</span>`;
      }
      return `<label class="opt ${a.checked ? "locked" : ""}"><input type="radio" name="opt" value="${k}" ${a.sel === oi ? "checked" : ""} ${a.checked ? "disabled" : ""}><span class="key">${k + 1}</span><span class="opt-t">${esc(o.t)}</span>${mark}</label>`;
    }).join("");
    let feedback = "";
    if (a.checked) {
      const ok = isRight(q, a.sel);
      const mine = q.opts[a.sel];
      feedback = `
        <div class="feedback ${ok ? "ok" : "bad"}" role="status">
          <p class="fb-h">${ok ? "✓ Correct" : "✗ Not quite"}</p>
          ${!ok && mine && mine.w ? `<p><strong>Why your choice does not work:</strong> ${esc(mine.w)}</p>` : ""}
          <ol>${q.sol.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
          <p class="small muted">${esc(q.src)} · ${esc(q.sub)} · ${TIER_NAMES[q.tier]}</p>
        </div>`;
    }
    const lastQ = A.idx === A.qs.length - 1;
    return `
      <div class="qscreen practice">
        <header class="qhead">
          <div><p class="eyebrow">${esc(A.label)} · ${esc(CATS[q.cat].name)}</p><p class="qcount num">Question ${A.idx + 1} of ${A.qs.length}</p></div>
          <div class="qhead-tools"><button class="btn ghost small-btn" id="drawer-open">Formulas</button><button class="btn ghost small-btn" id="end-practice">End practice</button></div>
        </header>
        <div class="progress" aria-hidden="true"><span style="width:${(A.idx / A.qs.length) * 100}%"></span></div>
        <div class="qbody ${q.ex ? "" : "solo"}">
          ${q.ex ? `<div class="qex">${exhibitHTML(q.ex)}</div>` : ""}
          <div class="qmain">
            <p class="stem" id="stem">${esc(q.stem)}</p>
            <p class="select-one">Select only one</p>
            <div class="opts" role="radiogroup" aria-labelledby="stem">${opts}</div>
            ${feedback}
          </div>
        </div>
        <footer class="qfoot">
          <button class="btn ghost" id="p-back" ${A.idx === 0 ? "disabled" : ""}>Back</button>
          ${a.checked
            ? `<button class="btn primary" id="p-next" data-autofocus>${lastQ ? "See summary" : "Next"}</button>`
            : `<button class="btn primary" id="p-check" ${a.sel == null ? "disabled" : ""}>Check answer</button>`}
        </footer>
      </div>`;
  }

  function practiceDoneHTML() {
    const done = A.ans.filter((a) => a.checked).length;
    const right = A.qs.filter((q, i) => A.ans[i].checked && isRight(q, A.ans[i].sel)).length;
    return `
      <div class="between">
        <header class="page-head">
          <p class="eyebrow">${esc(A.label)}</p>
          <h1><span class="num">${right} of ${done}</span> correct</h1>
          <p class="lede">${done < A.qs.length ? `You checked ${done} of ${A.qs.length} questions. ` : ""}Open any question below to see its worked solution again.</p>
        </header>
        <section class="panel">${A.qs.map((q, i) => reviewRow(q, A.ord[i], { sel: A.ans[i].sel, st: A.ans[i].checked ? "answered" : "skipped", t: "–" }, i).replace(/<span class="pace">.*?<\/span>/, "")).join("")}</section>
        <div class="actions"><button class="btn primary" id="new">Set up another session</button></div>
      </div>`;
  }

  /* ---------------- formulas & tips ---------------- */
  function formulasHTML(inDrawer) {
    const qy = formulasQuery.trim().toLowerCase();
    const match = (...xs) => !qy || xs.join(" ").toLowerCase().includes(qy);
    const canDrill = !mockInProgress();
    const menu = [["pct", "Percentages & growth"], ["biz", "Business math"], ["stats", "Statistics & probability"], ["mental", "Mental math"], ["tips", "Approach tips"]];
    const sectionsToShow = qy ? menu.map((m) => m[0]) : [formulasSection];
    const body = sectionsToShow.map((sid) => {
      if (sid === "mental") {
        const items = F.MENTAL.filter((m) => match(m));
        if (!items.length) return "";
        return `<section class="fsec"><h2>Mental math</h2><ul class="mental">${items.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></section>`;
      }
      if (sid === "tips") {
        const items = F.TIPS.filter((t) => match(t.name, t.text));
        if (!items.length) return "";
        return `<section class="fsec"><h2>Approach tips</h2><div class="cards">${items.map((t) => `<article class="card" id="card-tip-${t.id}"><h3>${esc(t.name)}</h3><p>${esc(t.text)}</p></article>`).join("")}</div></section>`;
      }
      const sec = F.SECTIONS.find((s) => s.id === sid);
      const cards = sec.cards.filter((c) => match(c.name, c.formula, c.example, c.trap));
      if (!cards.length) return "";
      return `<section class="fsec"><h2>${esc(sec.name)}</h2><div class="cards">${cards.map((c) => `
        <article class="card" id="card-${c.id}">
          <h3>${esc(c.name)}</h3>
          <p class="formula">${esc(c.formula)}</p>
          <dl class="card-dl"><div><dt>Example</dt><dd class="num">${esc(c.example)}</dd></div><div><dt>Trap</dt><dd>${esc(c.trap)}</dd></div></dl>
          ${inDrawer ? "" : `<button class="btn small-btn" data-drill="${c.drill[0]}|${esc(c.drill[1])}" ${canDrill ? "" : `disabled title="Available after your mock"`}>Practice this</button>`}
        </article>`).join("")}</div></section>`;
    }).join("") || `<p class="muted">Nothing matches “${esc(formulasQuery)}”.</p>`;
    return `
      <div class="formulas ${inDrawer ? "in-drawer" : ""}">
        ${inDrawer ? "" : `<header class="page-head"><p class="eyebrow">Reference</p><h1>Formulas &amp; Tips</h1></header>`}
        <div class="f-layout">
          <nav class="f-nav" aria-label="Sections">
            <label class="sr-only" for="f-search${inDrawer ? "-d" : ""}">Search formulas and tips</label>
            <input type="search" id="f-search${inDrawer ? "-d" : ""}" class="f-search" placeholder="Search, e.g. margin" value="${esc(formulasQuery)}">
            <select class="f-select" id="f-select${inDrawer ? "-d" : ""}" aria-label="Section">${menu.map(([id, n]) => `<option value="${id}" ${formulasSection === id ? "selected" : ""}>${n}</option>`).join("")}</select>
            <ul class="f-menu">${menu.map(([id, n]) => `<li><button class="f-link" data-fsec="${id}" aria-current="${!qy && formulasSection === id}">${n}</button></li>`).join("")}</ul>
          </nav>
          <div class="f-body">${body}</div>
        </div>
      </div>`;
  }

  function openDrawer() {
    const d = $("#drawer");
    $("#drawer-body").innerHTML = formulasHTML(true);
    d.hidden = false;
    $("#drawer-close").focus();
  }
  function closeDrawer() { $("#drawer").hidden = true; }

  function goFormulas(cardId) {
    if (cardId.startsWith("tip-")) formulasSection = "tips";
    else {
      const sec = F.SECTIONS.find((s) => s.cards.some((c) => c.id === cardId));
      if (sec) formulasSection = sec.id;
    }
    formulasQuery = "";
    formulasFocus = cardId;
    tab = "formulas";
    render();
  }

  /* ---------------- history ---------------- */
  function lineChart(values, opts) {
    const W = 420, H = 180, L = 40, R = 14, T = 16, B = 26;
    const max = opts.max || niceMax(Math.max(...values, 1) * 1.1);
    const iw = W - L - R, ih = H - T - B, n = values.length;
    const x = (i) => (n === 1 ? L + iw / 2 : L + (iw / (n - 1)) * i);
    const y = (v) => T + ih - (v / max) * ih;
    const grid = [0, 0.5, 1].map((f) => f * max).map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ch-lab">${Math.round(v)}${opts.unit}</text>`).join("");
    const area = n > 1 ? `<path d="M${x(0)},${y(0)} ${values.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(n - 1)},${y(0)} Z" style="fill:var(--accent-weak)"/>` : "";
    const line = n > 1 ? `<polyline points="${values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" style="fill:none;stroke:var(--accent);stroke-width:2"/>` : "";
    const dots = values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === n - 1 ? 4.5 : 3}" style="fill:${i === n - 1 ? "var(--accent)" : "var(--surface)"};stroke:var(--accent);stroke-width:2"/>`).join("");
    const xl = values.map((_, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="ch-lab">${i + 1}</text>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label + ": " + values.join(", "))}">${grid}${area}${line}${dots}${xl}</svg>`;
  }

  function historyHTML() {
    const hist = store.get("history", []);
    let panel = "";
    if (historyPanel === "export") {
      panel = `<section class="panel"><h2>Export</h2><p class="small muted">Copy this text and keep it somewhere safe. Paste it into Import on another browser to bring your history across.</p>
        <textarea id="export-text" class="mono" rows="6" readonly>${esc(JSON.stringify({ history: hist, settings }))}</textarea>
        <div class="actions"><button class="btn primary" id="copy-export">Copy</button><button class="btn ghost" data-hpanel="">Close</button></div></section>`;
    } else if (historyPanel === "import") {
      panel = `<section class="panel"><h2>Import</h2><p class="small muted">Paste text from Export. It replaces the history in this browser.</p>
        <textarea id="import-text" class="mono" rows="6"></textarea>
        <div class="actions"><button class="btn primary" id="do-import">Import</button><button class="btn ghost" data-hpanel="">Cancel</button></div></section>`;
    } else if (historyPanel === "reset") {
      panel = `<section class="panel warnbox"><h2>Reset history?</h2><p>This deletes all ${hist.length} saved attempts from this browser. It can't be undone.</p>
        <div class="actions"><button class="btn danger" id="do-reset">Delete history</button><button class="btn ghost" data-hpanel="">Cancel</button></div></section>`;
    }
    const tools = `<div class="actions"><button class="btn" data-hpanel="export" ${hist.length ? "" : "disabled"}>Export</button><button class="btn" data-hpanel="import">Import</button><button class="btn ghost" data-hpanel="reset" ${hist.length ? "" : "disabled"}>Reset history</button></div>`;
    if (!hist.length) {
      return `<div class="history"><header class="page-head"><p class="eyebrow">This device only</p><h1>History</h1></header>
        <section class="panel empty"><h2>No attempts yet</h2><p>Finish a full mock or a single test and its scores appear here, with charts of accuracy and pace across attempts. Practice sessions aren't recorded.</p></section>
        ${panel}${tools}</div>`;
    }
    const rows = hist.slice().reverse().map((h) => `
      <tr><td class="num">${fmtDate(h.date)}</td><td>${esc(h.label)}${h.extra ? ` <span class="tag">+${h.extra}% time</span>` : ""}</td>
      <td>${h.tests.map((t) => `<span class="pill">${esc(t.name)} <span class="num">${t.correct}/${t.total}</span></span>`).join(" ")}</td>
      <td class="num">${h.pct}%</td><td class="num">${h.avgSec} s</td></tr>`).join("");
    return `
      <div class="history">
        <header class="page-head"><p class="eyebrow">This device only</p><h1>History</h1></header>
        <div class="charts">
          <section class="panel"><h2>Accuracy by attempt</h2>${lineChart(hist.map((h) => h.pct), { max: 100, unit: "%", label: "Accuracy by attempt" })}</section>
          <section class="panel"><h2>Average seconds per question</h2>${lineChart(hist.map((h) => h.avgSec), { unit: " s", label: "Average seconds per question" })}</section>
        </div>
        <section class="panel"><h2>Attempts</h2>
          <div class="tablewrap"><table class="data"><thead><tr><th scope="col">Date</th><th scope="col">Session</th><th scope="col">Score per test</th><th scope="col">Overall</th><th scope="col">Avg per question</th></tr></thead><tbody>${rows}</tbody></table></div>
        </section>
        ${panel}${tools}
      </div>`;
  }

  /* ---------------- feedback helpers ---------------- */
  function announce(msg) {
    const el = $("#sr-live");
    el.textContent = "";
    setTimeout(() => (el.textContent = msg), 50);
  }
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3200);
  }

  /* ---------------- events ---------------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-fsec]");
    if (!t || t.disabled) return;

    if (t.classList.contains("tab")) { tab = t.dataset.tab; historyPanel = null; render(); return; }
    if (t.id === "start") { saveSettings(); settings.format === "practice" ? startPractice(settings.practiceCat, settings.practiceSub, 10, "Practice") : startTimed(); return; }
    if (t.id === "begin") { beginTest(); return; }
    if (t.id === "check-ex") { A.exChecked = true; saveA(); render(); return; }
    if (t.id === "submit") { submit(false); return; }
    if (t.id === "skip") { submit(true); return; }
    if (t.id === "next") { nextTest(); return; }
    if (t.id === "pause") { A.phase = "pause"; A.pauseUntil = now() + 120000; saveA(); render(); return; }
    if (t.id === "new") { A = null; saveA(); render(); return; }
    if (t.dataset.goto) { goFormulas(t.dataset.goto); return; }
    if (t.dataset.drill) { const [c, s] = t.dataset.drill.split("|"); closeDrawer(); startDrill(c, s); return; }
    if (t.dataset.move) {
      const i = Number(t.dataset.move), j = i + Number(t.dataset.dir);
      [settings.custom[i], settings.custom[j]] = [settings.custom[j], settings.custom[i]];
      saveSettings(); render(); return;
    }
    if (t.dataset.fsec) {
      formulasSection = t.dataset.fsec; formulasQuery = "";
      if (t.closest("#drawer")) $("#drawer-body").innerHTML = formulasHTML(true); else render();
      return;
    }
    if (t.id === "drawer-open") { openDrawer(); return; }
    if (t.id === "drawer-close") { closeDrawer(); return; }
    if (t.id === "end-practice") { A.phase = "practiceDone"; saveA(); render(); return; }
    if (t.id === "p-check") { A.ans[A.idx].checked = true; if (isRight(A.qs[A.idx], A.ans[A.idx].sel)) markSolved(A.qs[A.idx].id); saveA(); render(); return; }
    if (t.id === "p-next") { if (A.idx < A.qs.length - 1) A.idx++; else A.phase = "practiceDone"; saveA(); render(); return; }
    if (t.id === "p-back") { if (A.idx > 0) A.idx--; saveA(); render(); return; }
    if (t.dataset.hpanel !== undefined) { historyPanel = t.dataset.hpanel || null; render(); return; }
    if (t.id === "copy-export") {
      const ta = $("#export-text");
      const done = () => toast("Copied.");
      const fallback = () => { ta.focus(); ta.select(); toast("Selected. Press Ctrl+C or ⌘C to copy."); };
      try { navigator.clipboard.writeText(ta.value).then(done, fallback); } catch (err) { fallback(); }
      return;
    }
    if (t.id === "do-import") {
      try {
        const data = JSON.parse($("#import-text").value);
        if (!Array.isArray(data.history)) throw new Error("no history");
        store.set("history", data.history);
        if (data.settings) { settings = Object.assign({}, DEFAULTS, data.settings); saveSettings(); }
        historyPanel = null; render(); toast(`Imported ${data.history.length} attempts.`);
      } catch (err) { toast("That text isn't a valid export. Copy it again from Export."); }
      return;
    }
    if (t.id === "do-reset") { store.del("history"); historyPanel = null; render(); toast("History deleted."); return; }
    if (t.id === "banner-close") { $("#mobile-banner").hidden = true; try { sessionStorage.setItem("tg.mb", "1"); } catch (err) { /* ignore */ } }
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "format") { settings.format = t.value; saveSettings(); render(); return; }
    if (t.name === "lineup") { settings.lineup = t.value; saveSettings(); render(); return; }
    if (t.dataset.cu) {
      const r = settings.custom[Number(t.dataset.cu)];
      r[t.dataset.k] = t.type === "checkbox" ? t.checked : t.value;
      saveSettings(); return;
    }
    if (["single", "qcount", "calc", "extra", "practiceSub", "progression"].includes(t.id)) { settings[t.id] = t.value; saveSettings(); if (t.id === "calc") render(); return; }
    if (t.id === "practiceCat") { settings.practiceCat = t.value; settings.practiceSub = "all"; saveSettings(); render(); return; }
    if (t.id === "f-select" || t.id === "f-select-d") {
      formulasSection = t.value; formulasQuery = "";
      if (t.id === "f-select-d") $("#drawer-body").innerHTML = formulasHTML(true); else render();
      return;
    }
    if (t.name === "opt") selectOpt(Number(t.value));
    if (t.name === "exopt") { A.exSel = Number(t.value); saveA(); const b = $("#check-ex"); if (b) b.disabled = false; }
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "f-search" || t.id === "f-search-d") {
      formulasQuery = t.value;
      const pos = t.selectionStart;
      if (t.id === "f-search-d") $("#drawer-body").innerHTML = formulasHTML(true); else render();
      const again = document.getElementById(t.id);
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) { /* ignore */ } }
    }
  });

  function selectOpt(k) {
    if (!A) return;
    if (A.phase === "question") {
      A.cur = k;
      saveA();
      $$('input[name="opt"]').forEach((r) => (r.checked = Number(r.value) === k));
      const b = $("#submit"); if (b) b.disabled = false;
    } else if (A.phase === "practice" && !A.ans[A.idx].checked) {
      A.ans[A.idx].sel = A.ord[A.idx][k];
      saveA();
      $$('input[name="opt"]').forEach((r) => (r.checked = Number(r.value) === k));
      const b = $("#p-check"); if (b) b.disabled = false;
    } else if (A.phase === "intro" && !A.exChecked) {
      A.exSel = k;
      saveA();
      $$('input[name="exopt"]').forEach((r) => (r.checked = Number(r.value) === k));
      const b = $("#check-ex"); if (b) b.disabled = false;
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#drawer").hidden) { closeDrawer(); return; }
    if (!A || tab !== "sim") return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "textarea" || (tag === "input" && e.target.type !== "radio") || tag === "select") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-4]$/.test(e.key) && ["question", "practice", "intro"].includes(A.phase)) {
      e.preventDefault();
      const radios = $$(`input[name="${A.phase === "intro" ? "exopt" : "opt"}"]`);
      if (Number(e.key) > radios.length) return;
      selectOpt(Number(e.key) - 1);
      const r = $$(`input[name="${A.phase === "intro" ? "exopt" : "opt"}"]`)[Number(e.key) - 1];
      if (r && !r.disabled) r.focus();
      return;
    }
    if (e.key === "Enter" && tag !== "button") {
      if (A.phase === "question" && A.cur != null) { e.preventDefault(); submit(false); }
      else if (A.phase === "practice") {
        const b = $("#p-check") || $("#p-next");
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
      }
    }
  });

  // Timed tests: block copying and the context menu on question content, and catch browser back.
  ["copy", "cut", "contextmenu"].forEach((ev) => document.addEventListener(ev, (e) => {
    if (timedRunning() && e.target.closest && e.target.closest("#qarea")) e.preventDefault();
  }));
  window.addEventListener("popstate", () => {
    if (timedRunning()) {
      try { history.pushState({ tg: 1 }, ""); } catch (e) { /* ignore */ }
      toast("You cannot return to previous questions.");
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && timedRunning()) { A.hidden++; saveA(); }
  });

  /* ---------------- boot ---------------- */
  function boot() {
    try { if (window.matchMedia("(max-width: 899px)").matches && !sessionStorage.getItem("tg.mb")) $("#mobile-banner").hidden = false; } catch (e) { $("#mobile-banner").hidden = false; }
    // An attempt whose clock ran out while the page was closed submits now.
    if (A && A.phase === "question" && now() >= curTest().deadline) finishTest(true);
    else if (A && A.phase === "pause" && now() >= A.pauseUntil) nextTest();
    else render();
  }
  boot();
})();
