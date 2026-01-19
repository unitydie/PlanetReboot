import "./ui.js";

const BEST_KEY = "mythTruthBestScore";
const BEST_STREAK_KEY = "mythTruthBestStreak";
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const QUESTIONS = [
  {
    statement: "«Hvis det står ‘øko’ på emballasjen, betyr det at den garantert er bedre for naturen.»",
    answer: "myth",
    explanation:
      "Ord som ‘øko/naturlig/grønn’ i seg selv garanterer ingenting. Se etter konkret informasjon: innhold, gjenvinning, sertifiseringer og åpenhet.",
    topic: "packaging",
  },
  {
    statement: "«Ikke alt som havner i beholderen ‘plast’ kan faktisk materialgjenvinnes.»",
    answer: "truth",
    explanation:
      "Ulike plasttyper kan gjenvinnes på ulike måter. Skitt og blandede materialer gjør ofte gjenvinning umulig.",
    topic: "sorting",
  },
  {
    statement: "«Biologisk nedbrytbart kan trygt kastes hvor som helst — det brytes jo ned.»",
    answer: "myth",
    explanation:
      "Mange ‘bio’-materialer brytes bare ned under spesielle forhold. I naturen og på deponier kan de bli liggende svært lenge.",
    topic: "packaging",
  },
  {
    statement:
      "«Det mest miljøvennlige er ofte det som allerede er produsert: reparasjon og gjenbruk kan være bedre enn å kjøpe nytt.»",
    answer: "truth",
    explanation:
      "Produksjon og transport gir store utslipp. Å forlenge levetiden til en ting er ofte et av de sterkeste grepene for å redusere avfall.",
    topic: "fashion",
  },
  {
    statement: "«Papiremballasje er alltid bedre enn plast.»",
    answer: "myth",
    explanation:
      "Det kommer an på sammenhengen: papir kan kreve mye vann og energi å lage. Det viktigste er å redusere engangs og velge flergangs der det er mulig.",
    topic: "packaging",
  },
  {
    statement:
      "«Materialgjenvinning sparer ressurser og energi sammenlignet med å produsere av nytt råstoff (i de fleste tilfeller).»",
    answer: "truth",
    explanation:
      "Å bruke materialer på nytt reduserer ofte behovet for råvareutvinning og energibruk, spesielt for metaller og glass.",
    topic: "sorting",
  },
  {
    statement: "«Hvis noe er billig og engangs, er det enklere å gjenvinne det enn å gjøre det holdbart.»",
    answer: "myth",
    explanation:
      "Engangsprodukter lages ofte av blandede og tynne lag som er vanskelige å gjenvinne. Holdbarhet og reparasjon er som regel mer effektivt.",
    topic: "packaging",
  },
  {
    statement: "«Det er viktig å levere batterier og elektronikk separat, fordi de kan inneholde farlige stoffer.»",
    answer: "truth",
    explanation:
      "Tunge metaller og kjemikalier kan lekke til jord og vann. Separat innsamling reduserer skade og gjør det mulig å ta ut verdifulle materialer.",
    topic: "electronics",
  },
  {
    statement: "«Kildesortering virker bare hvis alle sorterer perfekt — ellers er det meningsløst.»",
    answer: "myth",
    explanation:
      "Jo bedre sortering, desto mer effektivt, men selv delvis kildesortering reduserer mengden som går til deponi og kan forbedre gjenvinningen.",
    topic: "sorting",
  },
  {
    statement:
      "«Å redusere forbruket (kjøpe mindre, velge kvalitet) er en av de sterkeste strategiene mot avfall.»",
    answer: "truth",
    explanation:
      "Færre kjøp betyr mindre produksjon, emballasje, transport og avfall. Det er grunnmuren i bærekraftig forbruk.",
    topic: "food",
  },
];

const TOTAL = QUESTIONS.length;

const dom = {
  progressText: document.getElementById("progressText"),
  progressFill: document.getElementById("progressFill"),
  bestScore: document.getElementById("bestScore"),
  streakValue: document.getElementById("streakValue"),

  card: document.getElementById("card"),
  statement: document.getElementById("statement"),
  btnMyth: document.getElementById("btnMyth"),
  btnTruth: document.getElementById("btnTruth"),

  review: document.getElementById("review"),
  reviewStatus: document.getElementById("reviewStatus"),
  reviewCorrect: document.getElementById("reviewCorrect"),
  reviewExplain: document.getElementById("reviewExplain"),
  reviewMore: document.getElementById("reviewMore"),
  reviewExplainFull: document.getElementById("reviewExplainFull"),
  btnNext: document.getElementById("btnNext"),

  result: document.getElementById("result"),
  finalScore: document.getElementById("finalScore"),
  finalRank: document.getElementById("finalRank"),
  finalBest: document.getElementById("finalBest"),
  finalBadge: document.getElementById("finalBadge"),
  finalBestStreak: document.getElementById("finalBestStreak"),
  btnRestart: document.getElementById("btnRestart"),
  btnToMenu: document.getElementById("btnToMenu"),
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

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

function readBestStreak() {
  const raw = localStorage.getItem(BEST_STREAK_KEY);
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return clamp(n, 0, TOTAL);
}

function writeBestStreak(value) {
  localStorage.setItem(BEST_STREAK_KEY, String(clamp(value, 0, TOTAL)));
}

function shortenLine(text, maxLen = 120) {
  const raw = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  const cut = raw.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const out = lastSpace > 60 ? cut.slice(0, lastSpace) : cut;
  return `${out}…`;
}

function labelAnswer(id) {
  return id === "myth" ? "MYTE" : "SANT";
}

function getRank(score) {
  if (score <= 3) return "Nybegynner";
  if (score <= 6) return "På vei";
  if (score <= 8) return "Stødig";
  return "Ekspert";
}

function getBadge(score) {
  if (score <= 3) return "Starter";
  if (score <= 6) return "På sporet";
  if (score <= 8) return "Myteknuser";
  return "Fakta";
}

const state = {
  deck: [],
  index: 0,
  score: 0,
  streak: 0,
  bestStreak: readBestStreak(),
  answered: false,
  best: readBestScore(),
};

function animateEnter(el) {
  if (reduceMotion || !el) return;
  el.classList.remove("is-enter");
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth;
  el.classList.add("is-enter");
}

function renderBest() {
  if (dom.bestScore) dom.bestScore.textContent = String(state.best);
  if (dom.finalBest) dom.finalBest.textContent = String(state.best);
  if (dom.finalBestStreak) dom.finalBestStreak.textContent = String(state.bestStreak);
}

function setAnswerButtonsEnabled(enabled) {
  if (dom.btnMyth) dom.btnMyth.disabled = !enabled;
  if (dom.btnTruth) dom.btnTruth.disabled = !enabled;
}

function renderQuestion() {
  const q = state.deck[state.index];
  if (!q) return;

  if (dom.result) dom.result.hidden = true;
  if (dom.card) dom.card.hidden = false;

  const step = state.index + 1;
  if (dom.progressText) dom.progressText.textContent = `Spørsmål ${step} av ${TOTAL}`;
  if (dom.progressFill) dom.progressFill.style.width = `${Math.round((step / TOTAL) * 100)}%`;
  if (dom.statement) dom.statement.textContent = q.statement;

  state.answered = false;
  setAnswerButtonsEnabled(true);

  if (dom.review) dom.review.hidden = true;
  if (dom.reviewStatus) dom.reviewStatus.classList.remove("is-correct", "is-wrong");
  if (dom.streakValue) dom.streakValue.textContent = String(state.streak);
  if (dom.reviewMore) dom.reviewMore.open = false;

  animateEnter(dom.card);
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
  if (dom.finalBadge) dom.finalBadge.textContent = getBadge(score);

  if (dom.card) dom.card.hidden = true;
  if (dom.result) dom.result.hidden = false;

  dom.btnRestart?.focus?.();
}

function answer(choice) {
  if (state.answered) return;
  const q = state.deck[state.index];
  if (!q) return;

  const isCorrect = choice === q.answer;
  state.answered = true;
  if (isCorrect) {
    state.score += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    writeBestStreak(state.bestStreak);
  } else {
    state.streak = 0;
  }

  setAnswerButtonsEnabled(false);

  const isLast = state.index >= TOTAL - 1;
  if (dom.btnNext) dom.btnNext.textContent = isLast ? "Resultat" : "Neste";

  if (dom.reviewStatus) {
    dom.reviewStatus.textContent = isCorrect ? "Riktig" : "Feil";
    dom.reviewStatus.classList.remove("is-correct", "is-wrong");
    dom.reviewStatus.classList.add(isCorrect ? "is-correct" : "is-wrong");
  }

  if (dom.reviewCorrect) dom.reviewCorrect.textContent = labelAnswer(q.answer);
  if (dom.reviewExplain) dom.reviewExplain.textContent = shortenLine(q.explanation);
  if (dom.reviewExplainFull) dom.reviewExplainFull.textContent = q.explanation;
  if (dom.reviewMore) dom.reviewMore.open = false;
  if (dom.review) dom.review.hidden = false;
  if (dom.streakValue) dom.streakValue.textContent = String(state.streak);

  dom.btnNext?.focus?.();
}

function next() {
  if (!state.answered) return;
  const isLast = state.index >= TOTAL - 1;
  if (isLast) return showResult();
  state.index += 1;
  renderQuestion();
}

function start() {
  state.deck = shuffleCopy(QUESTIONS);
  state.index = 0;
  state.score = 0;
  state.streak = 0;
  state.answered = false;
  renderBest();
  renderQuestion();
}

dom.btnMyth?.addEventListener("click", () => answer("myth"));
dom.btnTruth?.addEventListener("click", () => answer("truth"));
dom.btnNext?.addEventListener("click", next);
dom.btnRestart?.addEventListener("click", start);

window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  e.preventDefault();
  window.location.href = "./index.html";
});

start();
