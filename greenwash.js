import "./ui.js";

const BEST_KEY = "greenwashDetectiveBest";
const reduceMotion =
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const rounds = [
  {
    options: [
      "Eco-emballasje: omsorg for planeten i hver slurk.",
      "Emballasjen inneholder 60% resirkulert plast, sammensetningen er oppgitt på nettstedet.",
      "Vi reduserte vekten på emballasjen med 15% sammenlignet med i fjor.",
    ],
    correctIndex: 0,
    flags: ["For generelle ord uten fakta", "Ingen tall eller bekreftelser"],
    checks: [
      "Finnes sertifisering/merking?",
      "Hvilke materialer og andeler er det snakk om?",
      "Finnes det en rapport eller en datakilde?",
    ],
    explanation: "Det høres ‘grønt’ ut, men gir ingen etterprøvbart faktum.",
  },
  {
    options: [
      "Carbon neutral — fordi vi elsker naturen.",
      "Vi kompenserer en del av utslippene gjennom prosjekter, men publiserer beregninger og metode.",
      "Vi reduserer utslipp i produksjonen og viser måltall år for år.",
    ],
    correctIndex: 0,
    flags: ["«Carbon neutral» uten metode", "Appell til følelser i stedet for data"],
    checks: [
      "Hvilken beregningsmetode brukes?",
      "Er dette kutt — eller bare kompensasjon?",
      "Hvem har verifisert tallene?",
    ],
    explanation: "«Klimanøytral» uten forklaring betyr ofte markedsføring.",
  },
  {
    options: [
      "100% naturlig — altså miljøvennlig.",
      "Oppskrift uten mikroplast, ingredienslisten er åpen.",
      "Vi gikk over til konsentrat for å redusere emballasje.",
    ],
    correctIndex: 0,
    flags: ["Forveksler «naturlig» med «miljøvennlig»", "Ingen livsløp eller konsekvenser"],
    checks: [
      "Hvordan utvinnes råvaren?",
      "Hvordan håndteres emballasjen etter bruk?",
      "Finnes dokumentasjon på miljøeffekten?",
    ],
    explanation: "«Naturlig» garanterer ikke et lavt miljøavtrykk.",
  },
  {
    options: [
      "Biologisk nedbrytbar — du trenger ikke tenke på avfallshåndtering.",
      "Materialet brytes ned i industrielle forhold, og instruks for innlevering er oppgitt.",
      "Vi fjernet unødvendig ytteremballasje.",
    ],
    correctIndex: 0,
    flags: ["Farlig løfte: «du trenger ikke tenke»", "Uklare nedbrytningsforhold"],
    checks: [
      "Hvor brytes det ned (hjemmekompost/industrielt)?",
      "Finnes det infrastruktur i din kommune?",
      "Hvor lang tid tar nedbrytningen?",
    ],
    explanation: "Nedbrytbarhet avhenger av forhold, ikke av ordet på pakken.",
  },
  {
    options: [
      "Eco-friendly produkt for bevisste mennesker.",
      "Det finnes et sertifikat (oppgi type), og det kan verifiseres.",
      "Vi gjorde produktet gjenbrukbart og selger utskiftbare deler.",
    ],
    correctIndex: 0,
    flags: ["«Eco-friendly» uten bevis", "Ren markedsføringsformulering"],
    checks: [
      "Hvilke sertifikater gjelder det?",
      "Finnes tall, standarder og definisjoner?",
      "Hva er faktisk forbedret — konkret?",
    ],
    explanation: "En generell frase uten fakta er klassisk grønnvasking.",
  },
  {
    options: [
      "Laget av resirkulert: vi redder havet!",
      "Tekstilen inneholder 30% resirkulert fiber, resten er jomfruelig råvare.",
      "Vi tar imot gamle klær tilbake for materialgjenvinning.",
    ],
    correctIndex: 0,
    flags: ["Sterkt følelsesladet slagord", "Ingen prosent eller sammensetning"],
    checks: [
      "Hvor mye resirkulert er det egentlig?",
      "Hva skjer etter bruk — og hvor leverer du det inn?",
      "Er verdikjeden og tallene transparente?",
    ],
    explanation: "Ord som «vi redder» uten konkret innhold er et varselsignal.",
  },
  {
    options: [
      "Vi plantet trær, derfor er varene våre miljøvennlige.",
      "Vi reduserte avfall i produksjonen og viser statistikk.",
      "Vi økte andelen reparerbare deler.",
    ],
    correctIndex: 0,
    flags: ["Kompensasjon i stedet for å endre produktet", "Ingen kobling til varens faktiske avtrykk"],
    checks: [
      "Hva ble endret i produksjonen?",
      "Finnes data på reduserte utslipp/avfall over tid?",
      "Er dette et engangstiltak eller systematisk?",
    ],
    explanation: "Å plante trær opphever ikke skadelig produksjon hvis den ikke endres.",
  },
  {
    options: [
      "Grønt valg — bare fordi vi sier det.",
      "Vi publiserer bærekraftrapport og har uavhengig verifisering.",
      "Vi økte levetiden og gjorde reparasjon tilgjengelig.",
    ],
    correctIndex: 0,
    flags: ["Påstand uten bevis", "Mangel på åpenhet"],
    checks: [
      "Hvor er rapporten/kildene?",
      "Finnes ekstern verifisering?",
      "Hvilke konkrete forbedringer er gjort?",
    ],
    explanation: "Hvis det ikke finnes bevis, er det bare en påstand.",
  },
];

const TOTAL = rounds.length;

const dom = {
  progressText: document.getElementById("progressText"),
  progressFill: document.getElementById("progressFill"),
  bestScore: document.getElementById("bestScore"),

  card: document.getElementById("card"),
  options: document.getElementById("options"),

  review: document.getElementById("review"),
  reviewStatus: document.getElementById("reviewStatus"),
  reviewCorrectText: document.getElementById("reviewCorrectText"),
  reviewFlags: document.getElementById("reviewFlags"),
  reviewChecks: document.getElementById("reviewChecks"),
  reviewExplain: document.getElementById("reviewExplain"),
  reviewMore: document.getElementById("reviewMore"),
  reviewExplainFull: document.getElementById("reviewExplainFull"),
  btnNext: document.getElementById("btnNext"),

  result: document.getElementById("result"),
  finalScore: document.getElementById("finalScore"),
  finalRank: document.getElementById("finalRank"),
  finalBest: document.getElementById("finalBest"),
  finalFlags: document.getElementById("finalFlags"),
  btnRestart: document.getElementById("btnRestart"),
  btnToMenu: document.getElementById("btnToMenu"),
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function shortenLine(text, maxLen = 120) {
  const raw = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  const cut = raw.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const out = lastSpace > 60 ? cut.slice(0, lastSpace) : cut;
  return `${out}…`;
}

function getHintLabels(text) {
  const t = String(text ?? "").toLowerCase();
  const labels = [];
  const hasDigits = /\d/.test(t) || t.includes("%");
  const hasVerify =
    t.includes("sertifikat") ||
    t.includes("verif") ||
    t.includes("rapport") ||
    t.includes("metod") ||
    t.includes("bereg") ||
    t.includes("kilde") ||
    t.includes("data");
  const hasGreenWords =
    t.includes("eco") ||
    t.includes("øko") ||
    t.includes("grønn") ||
    t.includes("miljø") ||
    t.includes("planet") ||
    t.includes("naturen") ||
    t.includes("havet") ||
    t.includes("redder");

  if (hasGreenWords) labels.push("GRØNN");
  if (hasDigits) labels.push("TALL");
  if (hasVerify) labels.push("KILDE");
  if (!labels.length) labels.push("VAG");
  return labels;
}

function initReveal() {
  const els = [...document.querySelectorAll("[data-reveal]")];
  if (!els.length) return;
  if (reduceMotion) {
    for (const el of els) el.classList.add("is-revealed");
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
  for (const el of els) io.observe(el);
}

function shuffleCopy(items) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function readBestScore() {
  const raw = localStorage.getItem(BEST_KEY);
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return clamp(n, 0, TOTAL);
}

function writeBestScore(score) {
  localStorage.setItem(BEST_KEY, String(clamp(score, 0, TOTAL)));
}

function getRank(score) {
  if (score <= 2) return "Nybegynner";
  if (score <= 5) return "Observatør";
  if (score <= 7) return "Detektiv";
  return "Ekspert";
}

function animateEnter(el) {
  if (reduceMotion || !el) return;
  el.classList.remove("is-enter");
  void el.offsetWidth;
  el.classList.add("is-enter");
}

const state = {
  deck: [],
  index: 0,
  score: 0,
  answered: false,
  best: readBestScore(),
  flagCounts: new Map(),
};

function renderBest() {
  if (dom.bestScore) dom.bestScore.textContent = String(state.best);
  if (dom.finalBest) dom.finalBest.textContent = String(state.best);
}

function clearList(el) {
  if (!el) return;
  el.innerHTML = "";
}

function renderChips(el, items, { variant = "neutral", limit = 3 } = {}) {
  if (!el) return;
  clearList(el);
  const list = Array.isArray(items) ? items.filter(Boolean).slice(0, limit) : [];
  if (!list.length) {
    const chip = document.createElement("span");
    chip.className = "chip chip--muted";
    chip.textContent = "Ingen";
    el.appendChild(chip);
    return;
  }
  for (const text of list) {
    const chip = document.createElement("span");
    chip.className = `chip chip--${variant}`;
    chip.textContent = text;
    el.appendChild(chip);
  }
}

function setOptionsEnabled(enabled) {
  if (!dom.options) return;
  for (const btn of dom.options.querySelectorAll("button[data-index]")) {
    btn.disabled = !enabled;
  }
}

function renderRound() {
  const r = state.deck[state.index];
  if (!r || !dom.options) return;

  if (dom.result) dom.result.hidden = true;
  if (dom.card) dom.card.hidden = false;

  const step = state.index + 1;
  if (dom.progressText) dom.progressText.textContent = `Runde ${step} av ${TOTAL}`;
  if (dom.progressFill) dom.progressFill.style.width = `${Math.round((step / TOTAL) * 100)}%`;

  state.answered = false;
  setOptionsEnabled(true);

  if (dom.review) dom.review.hidden = true;
  if (dom.reviewStatus) dom.reviewStatus.classList.remove("is-correct", "is-wrong");

  dom.options.innerHTML = "";
  const letters = ["A", "B", "C"];
  for (let i = 0; i < r.options.length; i += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "scanner-item gw-option";
    btn.dataset.index = String(i);
    btn.setAttribute("role", "listitem");
    btn.setAttribute("aria-label", `Alternativ ${letters[i]}`);

    const head = document.createElement("div");
    head.className = "gw-option-head";

    const kicker = document.createElement("div");
    kicker.className = "gw-option-kicker";
    kicker.textContent = `Alternativ ${letters[i]}`;

    const hints = document.createElement("div");
    hints.className = "gw-option-hints";
    for (const label of getHintLabels(r.options[i])) {
      const s = document.createElement("span");
      s.className = "gw-hint";
      s.textContent = label;
      s.setAttribute("aria-hidden", "true");
      hints.appendChild(s);
    }

    head.append(kicker, hints);

    const text = document.createElement("div");
    text.className = "gw-option-text";
    text.textContent = r.options[i];

    btn.append(head, text);
    dom.options.appendChild(btn);
  }

  animateEnter(dom.card);
  dom.options.querySelector("button")?.focus?.({ preventScroll: true });
}

function topFlags(n = 3) {
  const entries = [...state.flagCounts.entries()];
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.slice(0, n);
}

function showResult() {
  const score = state.score;
  if (score > state.best) {
    state.best = score;
    writeBestScore(score);
  }
  renderBest();

  if (dom.finalScore) dom.finalScore.textContent = String(score);
  if (dom.finalRank) dom.finalRank.textContent = getRank(score);

  if (dom.finalFlags) {
    dom.finalFlags.innerHTML = "";
    const flags = topFlags(3);
    if (!flags.length) {
      const li = document.createElement("li");
      li.textContent = "Ingen røde flagg (enda).";
      dom.finalFlags.appendChild(li);
    } else {
      for (const [flag, count] of flags) {
        const li = document.createElement("li");
        li.textContent = `${flag} (${count})`;
        dom.finalFlags.appendChild(li);
      }
    }
  }

  if (dom.card) dom.card.hidden = true;
  if (dom.result) dom.result.hidden = false;

  dom.btnRestart?.focus?.({ preventScroll: true });
}

function countFlags(flags) {
  for (const f of flags) {
    const prev = state.flagCounts.get(f) ?? 0;
    state.flagCounts.set(f, prev + 1);
  }
}

function answer(choiceIndex) {
  if (state.answered) return;
  const r = state.deck[state.index];
  if (!r) return;

  state.answered = true;
  countFlags(r.flags);

  const isCorrect = choiceIndex === r.correctIndex;
  if (isCorrect) state.score += 1;

  if (dom.reviewStatus) {
    dom.reviewStatus.textContent = isCorrect ? "Riktig" : "Feil";
    dom.reviewStatus.classList.remove("is-correct", "is-wrong");
    dom.reviewStatus.classList.add(isCorrect ? "is-correct" : "is-wrong");
  }

  if (dom.reviewCorrectText) dom.reviewCorrectText.textContent = r.options[r.correctIndex] ?? "—";
  renderChips(dom.reviewFlags, r.flags, { variant: "bad", limit: 3 });
  renderChips(dom.reviewChecks, r.checks, { variant: "good", limit: 3 });
  if (dom.reviewExplain) dom.reviewExplain.textContent = shortenLine(r.explanation);
  if (dom.reviewExplainFull) dom.reviewExplainFull.textContent = r.explanation;
  if (dom.reviewMore) dom.reviewMore.open = false;

  if (dom.options) {
    for (const btn of dom.options.querySelectorAll("button[data-index]")) {
      const idx = Number(btn.dataset.index);
      btn.disabled = true;
      btn.classList.toggle("is-selected", idx === choiceIndex);
      btn.classList.toggle("is-correct", idx === r.correctIndex);
      btn.classList.toggle("is-wrong", idx === choiceIndex && idx !== r.correctIndex);
    }
  }

  const isLast = state.index >= TOTAL - 1;
  if (dom.btnNext) dom.btnNext.textContent = isLast ? "Resultat" : "Neste";
  if (dom.review) dom.review.hidden = false;
  dom.btnNext?.focus?.({ preventScroll: true });
}

function next() {
  if (!state.answered) return;
  if (state.index >= TOTAL - 1) return showResult();
  state.index += 1;
  renderRound();
}

function startNewRun() {
  state.deck = shuffleCopy(rounds);
  state.index = 0;
  state.score = 0;
  state.answered = false;
  state.flagCounts = new Map();
  state.best = readBestScore();
  renderBest();
  renderRound();
}

dom.options?.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("button[data-index]");
  if (!btn) return;
  const idx = Number(btn.dataset.index);
  if (!Number.isFinite(idx)) return;
  answer(idx);
});

dom.options?.addEventListener("keydown", (e) => {
  if (state.answered) return;
  const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  if (!keys.includes(e.key)) return;
  const btns = [...dom.options.querySelectorAll("button[data-index]")];
  const idx = btns.indexOf(document.activeElement);
  if (idx < 0) return;
  e.preventDefault();
  const delta = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1;
  btns[(idx + delta + btns.length) % btns.length]?.focus?.({ preventScroll: true });
});

dom.card?.addEventListener("keydown", (e) => {
  if (state.answered) return;
  const map = { "1": 0, "2": 1, "3": 2 };
  const idx = map[e.key];
  if (idx === undefined) return;
  e.preventDefault();
  answer(idx);
});

dom.btnNext?.addEventListener("click", next);
dom.btnRestart?.addEventListener("click", startNewRun);

initReveal();
startNewRun();
