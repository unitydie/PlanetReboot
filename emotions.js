import "./ui.js";

const reduceMotion =
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const EMO_PLAN_KEY = "emotionPlanList";
const EMO_LAST_KEY = "emotionLastSelected";
const EMO_PLAN_MAX = 7;

const EMO_PLAN_KEY_OLD = "ecoSpectrum.plan.v1";
const EMO_LAST_KEY_OLD = "ecoSpectrum.lastEmotion.v1";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function initReveal() {
  const elements = [...document.querySelectorAll("[data-reveal]")];
  if (!elements.length) return;

  if (reduceMotion) {
    for (const el of elements) el.classList.add("is-revealed");
    return;
  }

  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-revealed");
        obs.unobserve(e.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  for (const el of elements) io.observe(el);
}

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 600);
}

function normalizePlanList(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of arr) {
    const text = String(item ?? "").trim();
    if (!text) continue;
    out.push(text);
  }
  return out.slice(0, EMO_PLAN_MAX);
}

function pickDifferent(list, previous) {
  const arr = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  let next = arr[Math.floor(Math.random() * arr.length)];
  let guard = 12;
  while (next === previous && guard-- > 0) {
    next = arr[Math.floor(Math.random() * arr.length)];
  }
  return next;
}

function migrateStorage() {
  const planNow = localStorage.getItem(EMO_PLAN_KEY);
  const planOld = localStorage.getItem(EMO_PLAN_KEY_OLD);
  if (!planNow && planOld) {
    const oldParsed = safeParseJSON(planOld);
    const migrated = normalizePlanList(oldParsed);
    if (migrated.length) {
      localStorage.setItem(EMO_PLAN_KEY, JSON.stringify(migrated));
    }
  }

  const lastNow = localStorage.getItem(EMO_LAST_KEY);
  const lastOld = String(localStorage.getItem(EMO_LAST_KEY_OLD) ?? "").trim();
  if (!lastNow && lastOld) {
    localStorage.setItem(EMO_LAST_KEY, lastOld);
  }
}

const emotionsData = {
  anxiety: {
    title: "Uro",
    validationLine:
      "Det er helt normalt å kjenne uro når verden føles for stor.",
    copingTips: [
      "Smalne fokus: velg én handling, ikke ti.",
      "Skill mellom det du kan kontrollere og det du ikke kan.",
      "Uro blir mindre når det finnes en plan.",
    ],
    actionsToday: [
      "Ta med en flergangsflaske eller kopp.",
      "Si nei til pose: bruk handlenett eller bær i hånden.",
      "Del opp avfallet hjemme i minst to kategorier.",
      "Slå av unødvendig lys og ladere i dag.",
      "Velg én ting: selg eller gi bort i stedet for å kaste.",
      "Finn et sted for batteriinnsamling i nærheten.",
    ],
    actionsWeek: [
      "Samle batterier og lever dem inn.",
      "En uke uten engangsflasker: bruk egen beholder.",
      "Lag ett måltid der du bruker opp restene.",
      "Reparer en ting (knapp, glidelås, kabel) i stedet for å bytte.",
      "Prøv å kjøpe én ting brukt i stedet for ny.",
      "Velg et produkt uten unødvendig emballasje minst tre ganger.",
    ],
  },
  anger: {
    title: "Sinne",
    validationLine: "Sinne er energi. Den kan rettes mot handling.",
    copingTips: [
      "Gjør følelsen til ett konkret steg: hva kan jeg gjøre akkurat nå?",
      "Velg handlinger som endrer systemet, ikke bare deg.",
      "Hold tempoet: litt og jevnlig slår å brenne ut på én dag.",
    ],
    actionsToday: [
      "Dropp den mest meningsløse engangstingen i dag.",
      "Spør på kafé: kan jeg få i min egen kopp?",
      "Del én ting som kan gjøre det lettere for andre å sortere.",
      "Støtt et lokalt initiativ for kildesortering (hvis det finnes).",
      "Plukk søppel i fem minutter i nærområdet (trygt).",
      "Del et mottakspunkt for avfall eller ting med en venn.",
    ],
    actionsWeek: [
      "Arranger et mini-bytte av ting med venner.",
      "Finn et verksted eller repair cafe i byen.",
      "Gi bort klær til gjenbruk eller materialgjenvinning.",
      "Halver leveranser med mye emballasje.",
      "Skriv til en butikk eller kafé og be om kildesortering.",
      "Prøv en uke uten engangskaffe.",
    ],
  },
  fatigue: {
    title: "Utmattelse",
    validationLine: "Utmattelse er et signal om å senke belastningen, ikke å gi opp.",
    copingTips: [
      "Velg den letteste handlingen. Det teller også.",
      "Ikke sammenlign deg med perfekte bilder.",
      "Hvile er en del av bærekraft.",
    ],
    actionsToday: [
      "Ta ett enkelt steg: nett, flaske eller boks.",
      "Ikke kjøp noe ekstra på impuls i dag.",
      "Sorter én kategori: bare papir eller bare plast.",
      "Velg større pakning i stedet for flere små.",
      "Bruk det du allerede har hjemme i stedet for å kjøpe nytt.",
      "Sett en påminnelse om batterier eller elektronikk til helgen.",
    ],
    actionsWeek: [
      "Kjøp brukt eller bytt én gang i stedet for ny.",
      "Gå gjennom én hylle og gi bort det du ikke trenger.",
      "Lag en dag uten levering.",
      "Lær en enkel reparasjon (knapp, søm, kabel).",
      "Velg tre produkter med mindre emballasje.",
      "Samle resirkulerbart og lever alt i én tur.",
    ],
  },
  motivation: {
    title: "Motivasjon",
    validationLine: "Kult. Bruk denne energien til å gjøre det til en vane.",
    copingTips: [
      "Sett et lite mål for en uke, ikke for livet.",
      "Gjør det enkelt: legg nett eller flaske klart på forhånd.",
      "Marker fremgang. Motivasjon liker synlige resultater.",
    ],
    actionsToday: [
      "Lag et mini-kit: handlenett, flaske og matboks.",
      "Sorter og gjør klar resirkulerbart.",
      "Velg reparasjon i stedet for å kjøpe nytt (hvis mulig).",
      "Kjøp én ting brukt.",
      "Kutt emballasje: velg løsvekt, refill eller større pakning.",
      "Fortell én person om en sirkulær idé.",
    ],
    actionsWeek: [
      "Gjør en utfordring: 7 dager med flergangsflaske.",
      "Lever inn elektronikk og batterier.",
      "Finn og prøv en reparasjonstjeneste for én ting.",
      "Lag handleliste for å unngå ekstra kjøp.",
      "Arranger bytte av klær eller ting.",
      "Lag en enkel upcycle: gjør om noe i stedet for å kaste.",
    ],
  },
  apathy: {
    title: "Likegyldighet",
    validationLine: "Likegyldighet dukker ofte opp når temaet føles for fjernt.",
    copingTips: [
      "Gjør noe som også lønner seg for deg: sparer penger eller tid.",
      "Start med én gjenstand, ikke med hele verden.",
      "Noen ganger kommer interessen etter det første enkle steget.",
    ],
    actionsToday: [
      "Ta med handlenett. Det er ofte bare mer praktisk.",
      "Kjøp drikke i større pakning i stedet for små.",
      "Ikke ta engangsbestikk eller servietter for sikkerhets skyld.",
      "Gi bort én ting til brukt i stedet for å kaste.",
      "Velg varer med mindre emballasje.",
      "Sjekk hvor nærmeste batteriinnsamling er.",
    ],
    actionsWeek: [
      "Prøv å kjøpe brukt én gang for å spare penger.",
      "Gjør en liten rydderunde: hva kan selges eller gis bort?",
      "Kutt engangskaffe minst to ganger.",
      "Lever resirkulerbart i én tur.",
      "Finn et reparasjonstilbud for telefon eller hodetelefoner.",
      "Prøv én vane fra listen og vurder om det ble enklere.",
    ],
  },
};

initReveal();
migrateStorage();

const dom = {
  bubbleField: document.getElementById("emotionBubbles"),
  planBadge: document.getElementById("emotionPlanBadge"),
  planTyped: document.getElementById("emotionPlanTyped"),
  planCursor: document.getElementById("emotionPlanCursor"),
  btnReroll: document.getElementById("emotionReroll"),
  btnSave: document.getElementById("emotionSave"),
  btnClear: document.getElementById("emotionPlanClear"),
  btnDownload: document.getElementById("emotionPlanDownload"),
  planList: document.getElementById("emotionPlanList"),
  note: document.getElementById("emotionNote"),
};

if (!dom.bubbleField || !dom.planTyped || !dom.planList) {
  throw new Error("Økospektrum: mangler nødvendige DOM-elementer.");
}

const bubbleButtons = [
  ...dom.bubbleField.querySelectorAll("button[data-emotion]"),
];

const state = {
  selected: null,
  today: "",
  week: "",
  plan: normalizePlanList(safeParseJSON(localStorage.getItem(EMO_PLAN_KEY))),
};

const typing = {
  token: 0,
  timer: 0,
  cursorTimer: 0,
};

function setNote(text) {
  if (!dom.note) return;
  dom.note.textContent = String(text ?? "");
}

function persistPlan() {
  localStorage.setItem(EMO_PLAN_KEY, JSON.stringify(state.plan));
}

function renderPlanList() {
  dom.planList.innerHTML = "";

  if (!state.plan.length) {
    const li = document.createElement("li");
    li.className = "emotion-plan-item emotion-plan-item--empty";
    li.textContent = "Tomt ennå. Lagre en plan, så dukker den opp her.";
    dom.planList.appendChild(li);
    return;
  }

  for (const entry of state.plan) {
    const li = document.createElement("li");
    li.className = "emotion-plan-item";
    li.textContent = entry;
    dom.planList.appendChild(li);
  }
}

function stopTyping() {
  typing.token += 1;
  if (typing.timer) window.clearTimeout(typing.timer);
  if (typing.cursorTimer) window.clearTimeout(typing.cursorTimer);
  typing.timer = 0;
  typing.cursorTimer = 0;

  dom.planTyped.classList.remove("is-typing");
  if (dom.planCursor) dom.planCursor.hidden = true;
}

function typeText(text) {
  stopTyping();
  const safe = String(text ?? "");

  if (reduceMotion) {
    dom.planTyped.textContent = safe;
    if (dom.planCursor) dom.planCursor.hidden = true;
    return;
  }

  dom.planTyped.textContent = "";
  dom.planTyped.classList.add("is-typing");
  if (dom.planCursor) dom.planCursor.hidden = false;

  const token = (typing.token += 1);
  let i = 0;
  const perChar = clamp(620 / Math.max(6, safe.length), 14, 34);

  const tick = () => {
    if (typing.token !== token) return;
    i += 1;
    dom.planTyped.textContent = safe.slice(0, i);
    if (i >= safe.length) {
      dom.planTyped.classList.remove("is-typing");
      typing.timer = 0;
      typing.cursorTimer = window.setTimeout(() => {
        if (typing.token !== token) return;
        if (dom.planCursor) dom.planCursor.hidden = true;
      }, 420);
      return;
    }
    typing.timer = window.setTimeout(tick, perChar);
  };

  tick();
}

function getPlanText() {
  if (!state.selected) return "Velg en boble for å starte.";
  const data = emotionsData[state.selected];
  if (!data) return "Velg en boble for å starte.";
  const today = state.today || pickDifferent(data.actionsToday, "");
  const week = state.week || pickDifferent(data.actionsWeek, "");
  return `${data.validationLine}\n\nI dag: ${today}\nDenne uken: ${week}`;
}

function updatePressedState() {
  for (const btn of bubbleButtons) {
    const key = btn.dataset.emotion;
    const isSelected = Boolean(key && key === state.selected);
    btn.classList.toggle("is-selected", isSelected);
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
  }
}

function renderPlanPane({ animate = true } = {}) {
  if (!state.selected || !emotionsData[state.selected]) {
    if (dom.planBadge) dom.planBadge.hidden = true;
    if (animate) typeText("Velg en boble for å starte.");
    else dom.planTyped.textContent = "Velg en boble for å starte.";
    return;
  }

  const data = emotionsData[state.selected];
  if (dom.planBadge) {
    dom.planBadge.hidden = false;
    dom.planBadge.textContent = data.title;
    dom.planBadge.dataset.emotion = state.selected;
  }

  const text = `${data.validationLine}\n\nI dag: ${state.today}\nDenne uken: ${state.week}`;
  if (animate) typeText(text);
  else dom.planTyped.textContent = text;
}

function rerollPlan() {
  if (!state.selected) return;
  const data = emotionsData[state.selected];
  if (!data) return;
  state.today = pickDifferent(data.actionsToday, state.today);
  state.week = pickDifferent(data.actionsWeek, state.week);
  renderPlanPane({ animate: true });
}

function setSelected(emotionKey, { persist = true, reroll = true } = {}) {
  if (!emotionsData[emotionKey]) return;
  const changed = state.selected !== emotionKey;

  state.selected = emotionKey;
  if (persist) localStorage.setItem(EMO_LAST_KEY, emotionKey);

  if (changed) {
    state.today = "";
    state.week = "";
  }

  updatePressedState();
  setNote("");
  if (reroll) rerollPlan();
}

dom.btnReroll?.addEventListener("click", () => {
  if (!state.selected) return setNote("Velg en boble først.");
  setNote("");
  rerollPlan();
});

dom.btnSave?.addEventListener("click", () => {
  if (!state.selected) return setNote("Velg en boble først.");
  const data = emotionsData[state.selected];
  if (!data) return;
  if (!state.today || !state.week) rerollPlan();

  const entry = `${data.title}\nI dag: ${state.today}\nDenne uken: ${state.week}`;
  const last = state.plan[0] ?? "";
  if (last === entry) return setNote("Allerede lagret.");

  state.plan = [entry, ...state.plan].slice(0, EMO_PLAN_MAX);
  persistPlan();
  renderPlanList();
  setNote("Lagret.");
});

dom.btnClear?.addEventListener("click", () => {
  state.plan = [];
  persistPlan();
  renderPlanList();
  setNote("Tømt.");
});

dom.btnDownload?.addEventListener("click", () => {
  if (!state.plan.length) return setNote("Planen er tom.");
  setNote("");
  const stamp = new Date().toISOString().slice(0, 10);
  const body = state.plan
    .map((entry, i) => `${i + 1}.\n${entry}`)
    .join("\n\n");
  downloadTextFile(`Min plan — Planet Reboot\n\n${body}\n`, `min-plan-${stamp}.txt`);
});

renderPlanList();
renderPlanPane({ animate: false });

const last = String(localStorage.getItem(EMO_LAST_KEY) ?? "").trim();
if (last && emotionsData[last]) setSelected(last, { persist: false, reroll: true });

// --- Bubble UI ----------------------------------------------------------------
function initEmotionBubbles() {
  if (!dom.bubbleField) return;
  if (!bubbleButtons.length) return;

  if (reduceMotion) dom.bubbleField.classList.add("is-static");

  const bounds = { w: 0, h: 0 };

  const bubbles = bubbleButtons.map((btn) => {
    const key = String(btn.dataset.emotion ?? "");
    const size = reduceMotion ? 128 : randInt(112, 148);
    btn.style.setProperty("--bubble-size", `${size}px`);
    btn.style.willChange = "transform";
    return {
      el: btn,
      key,
      size,
      r: size / 2,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      popped: false,
      hidden: false,
      popTimer: 0,
      respawnTimer: 0,
    };
  });

  const byEl = new Map(bubbles.map((b) => [b.el, b]));

  const measure = () => {
    const rect = dom.bubbleField.getBoundingClientRect();
    bounds.w = Math.max(0, rect.width);
    bounds.h = Math.max(0, rect.height);
  };

  const randomizeVelocity = (b) => {
    const speed = rand(16, 28);
    const angle = rand(0, Math.PI * 2);
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
  };

  const apply = (b) => {
    b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
  };

  const clampIntoBounds = (b) => {
    const maxX = Math.max(0, bounds.w - b.size);
    const maxY = Math.max(0, bounds.h - b.size);
    b.x = clamp(b.x, 0, maxX);
    b.y = clamp(b.y, 0, maxY);
  };

  const place = (b) => {
    measure();
    if (!bounds.w || !bounds.h) return;

    const maxX = Math.max(0, bounds.w - b.size);
    const maxY = Math.max(0, bounds.h - b.size);
    let x = rand(0, maxX);
    let y = rand(0, maxY);

    let guard = 40;
    while (guard-- > 0) {
      const cx = x + b.r;
      const cy = y + b.r;
      let ok = true;
      for (const other of bubbles) {
        if (other === b) continue;
        if (other.hidden || other.popped) continue;
        const ocx = other.x + other.r;
        const ocy = other.y + other.r;
        const min = b.r + other.r + 10;
        const dx = cx - ocx;
        const dy = cy - ocy;
        if (dx * dx + dy * dy < min * min) {
          ok = false;
          break;
        }
      }
      if (ok) break;
      x = rand(0, maxX);
      y = rand(0, maxY);
    }

    b.x = x;
    b.y = y;
    randomizeVelocity(b);
    apply(b);
  };

  function createSparkles(inner) {
    if (reduceMotion) return;
    const container = document.createElement("span");
    container.className = "bubble-sparkles";
    container.setAttribute("aria-hidden", "true");
    const count = 8;
    for (let i = 0; i < count; i += 1) {
      const sp = document.createElement("span");
      sp.className = "bubble-sparkle";
      const a = rand(0, Math.PI * 2);
      const d = rand(18, 40);
      sp.style.setProperty("--sx", `${Math.cos(a) * d}px`);
      sp.style.setProperty("--sy", `${Math.sin(a) * d}px`);
      sp.style.setProperty("--sd", `${rand(0, 120).toFixed(0)}ms`);
      container.appendChild(sp);
    }
    inner.appendChild(container);
    window.setTimeout(() => container.remove(), 520);
  }

  const pop = (b) => {
    if (reduceMotion) {
      b.el.classList.add("is-pop-reduced");
      window.setTimeout(() => b.el.classList.remove("is-pop-reduced"), 280);
      return;
    }
    if (b.popped || b.hidden) return;
    b.popped = true;
    b.el.disabled = true;
    b.el.classList.add("is-popping");

    const inner = b.el.querySelector(".emotion-bubble-inner");
    if (inner) createSparkles(inner);

    if (b.popTimer) window.clearTimeout(b.popTimer);
    if (b.respawnTimer) window.clearTimeout(b.respawnTimer);

    b.popTimer = window.setTimeout(() => {
      b.el.classList.remove("is-popping");
      b.el.classList.add("is-hidden");
      b.hidden = true;
      b.popTimer = 0;

      b.respawnTimer = window.setTimeout(() => {
        b.el.classList.remove("is-hidden");
        b.hidden = false;
        b.popped = false;
        b.el.disabled = false;
        place(b);
        b.respawnTimer = 0;
      }, randInt(700, 1000));
    }, 420);
  };

  const onClick = (e) => {
    const btn = e.target?.closest?.("button[data-emotion]");
    if (!btn) return;
    const b = byEl.get(btn);
    if (!b) return;
    pop(b);
    const key = String(btn.dataset.emotion ?? "").trim();
    if (key) setSelected(key, { persist: true, reroll: true });
  };

  dom.bubbleField.addEventListener("click", onClick);

  if (reduceMotion) return () => dom.bubbleField.removeEventListener("click", onClick);

  for (const b of bubbles) place(b);

  let raf = 0;
  let lastT = 0;
  let running = true;

  const resolveCollisions = () => {
    const active = bubbles.filter((b) => !b.hidden && !b.popped);
    const margin = 6;
    for (let i = 0; i < active.length; i += 1) {
      const a = active[i];
      for (let j = i + 1; j < active.length; j += 1) {
        const c = active[j];
        const ax = a.x + a.r;
        const ay = a.y + a.r;
        const cx = c.x + c.r;
        const cy = c.y + c.r;
        const dx = cx - ax;
        const dy = cy - ay;
        const min = a.r + c.r + margin;
        const dist2 = dx * dx + dy * dy;
        if (dist2 >= min * min) continue;
        const dist = Math.sqrt(dist2) || 0.001;
        const overlap = (min - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        c.x += nx * overlap;
        c.y += ny * overlap;

        a.vx -= nx * 0.8;
        a.vy -= ny * 0.8;
        c.vx += nx * 0.8;
        c.vy += ny * 0.8;
      }
    }
  };

  const update = (dt) => {
    measure();
    for (const b of bubbles) {
      if (b.hidden || b.popped) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const maxX = Math.max(0, bounds.w - b.size);
      const maxY = Math.max(0, bounds.h - b.size);

      if (b.x <= 0) {
        b.x = 0;
        b.vx = Math.abs(b.vx);
      } else if (b.x >= maxX) {
        b.x = maxX;
        b.vx = -Math.abs(b.vx);
      }

      if (b.y <= 0) {
        b.y = 0;
        b.vy = Math.abs(b.vy);
      } else if (b.y >= maxY) {
        b.y = maxY;
        b.vy = -Math.abs(b.vy);
      }
    }

    resolveCollisions();

    for (const b of bubbles) {
      if (b.hidden || b.popped) continue;
      clampIntoBounds(b);
      apply(b);
    }
  };

  const loop = (t) => {
    if (!running) return;
    if (document.hidden) {
      raf = window.requestAnimationFrame(loop);
      lastT = t;
      return;
    }

    if (!lastT) lastT = t;
    const dtMs = t - lastT;
    if (dtMs >= 33) {
      const dt = Math.min(0.05, dtMs / 1000);
      lastT = t;
      update(dt);
    }
    raf = window.requestAnimationFrame(loop);
  };

  const start = () => {
    if (raf) return;
    lastT = 0;
    raf = window.requestAnimationFrame(loop);
  };

  const stop = () => {
    if (!raf) return;
    window.cancelAnimationFrame(raf);
    raf = 0;
  };

  start();

  const onResize = () => {
    measure();
    for (const b of bubbles) {
      if (b.hidden) continue;
      clampIntoBounds(b);
      apply(b);
    }
  };

  const hasResizeObserver = typeof ResizeObserver !== "undefined";
  const ro = hasResizeObserver ? new ResizeObserver(onResize) : null;
  if (ro) ro.observe(dom.bubbleField);
  else window.addEventListener("resize", onResize);

  const onVis = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    dom.bubbleField.removeEventListener("click", onClick);
    document.removeEventListener("visibilitychange", onVis);
    if (ro) ro.disconnect();
    else window.removeEventListener("resize", onResize);
    stop();
    running = false;
    for (const b of bubbles) {
      if (b.popTimer) window.clearTimeout(b.popTimer);
      if (b.respawnTimer) window.clearTimeout(b.respawnTimer);
    }
  };
}

const cleanup = initEmotionBubbles();
window.addEventListener(
  "pagehide",
  () => {
    stopTyping();
    if (typeof cleanup === "function") cleanup();
  },
  { once: true }
);
