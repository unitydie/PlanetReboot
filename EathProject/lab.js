const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function safeInt(value, fallback = 0) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
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

function initLabTabs(dom) {
  if (!dom.labTabPuzzle || !dom.labTabTrainer || !dom.labPuzzle || !dom.labTrainer) return;

  let active = "puzzle";

  const isMobile = () => window.matchMedia?.("(max-width: 760px)")?.matches ?? window.innerWidth <= 760;

  const apply = () => {
    const mobile = isMobile();
    if (!mobile) {
      dom.labPuzzle.hidden = false;
      dom.labTrainer.hidden = false;
    } else {
      dom.labPuzzle.hidden = active !== "puzzle";
      dom.labTrainer.hidden = active !== "trainer";
    }

    dom.labTabPuzzle.setAttribute("aria-selected", active === "puzzle" ? "true" : "false");
    dom.labTabTrainer.setAttribute("aria-selected", active === "trainer" ? "true" : "false");
    dom.labTabPuzzle.classList.toggle("is-active", active === "puzzle");
    dom.labTabTrainer.classList.toggle("is-active", active === "trainer");
  };

  const setActive = (next) => {
    active = next;
    apply();
    const panel = next === "puzzle" ? dom.labPuzzle : dom.labTrainer;
    panel?.focus?.({ preventScroll: true });
    panel?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  };

  dom.labTabPuzzle.addEventListener("click", () => setActive("puzzle"));
  dom.labTabTrainer.addEventListener("click", () => setActive("trainer"));
  window.addEventListener("resize", apply, { passive: true });
  apply();
}

function arrayMove(items, fromIndex, toIndex) {
  const arr = [...items];
  const from = clamp(fromIndex, 0, arr.length - 1);
  const to = clamp(toIndex, 0, arr.length - 1);
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
  return arr;
}

// ---------------------------------------------------------------------------
// Puzzle: build the circular loop
// ---------------------------------------------------------------------------

const PUZZLE_STORAGE_KEY = "circularPuzzleBest";

const PUZZLE_STAGES = [
  { id: "design", text: "Design for lang levetid" },
  { id: "production", text: "Produksjon" },
  { id: "use", text: "Bruk" },
  { id: "care", text: "Vedlikehold og reparasjon" },
  { id: "reuse", text: "Gjenbruk / bytte" },
  { id: "sorting", text: "Demontering og sortering" },
  { id: "recycling", text: "Materialgjenvinning" },
  { id: "back", text: "Tilbake til produksjon (nytt liv)" },
];

const PUZZLE_CORRECT = PUZZLE_STAGES.map((s) => s.id);
const PUZZLE_TEXT = Object.fromEntries(PUZZLE_STAGES.map((s) => [s.id, s.text]));

function initPuzzle(dom) {
  if (!dom.puzzleList || !dom.puzzleCheck || !dom.puzzleHint || !dom.puzzleReset) return;

  const best = safeInt(localStorage.getItem(PUZZLE_STORAGE_KEY), 0);
  if (dom.puzzleBest) dom.puzzleBest.textContent = String(clamp(best, 0, 100));

  const state = {
    order: shuffle(PUZZLE_CORRECT),
    checked: false,
    mask: [],
    hintUsed: false,
    hintPair: null,
    dragFrom: null,
  };

  const setNote = (text) => {
    if (!dom.puzzleNote) return;
    dom.puzzleNote.textContent = text || "";
  };

  const clearCheck = () => {
    state.checked = false;
    state.mask = [];
    if (dom.puzzleResult) dom.puzzleResult.hidden = true;
  };

  const render = () => {
    dom.puzzleList.innerHTML = "";

    for (let i = 0; i < state.order.length; i += 1) {
      const id = state.order[i];

      const item = document.createElement("div");
      item.className = "puzzle-item";
      item.setAttribute("role", "listitem");
      item.draggable = true;
      item.dataset.id = id;
      item.dataset.index = String(i);

      if (state.checked) {
        const ok = Boolean(state.mask[i]);
        item.classList.add(ok ? "is-correct" : "is-wrong");
      }
      if (state.hintPair && state.hintPair.includes(id)) item.classList.add("is-hint");

      const num = document.createElement("div");
      num.className = "puzzle-num";
      num.textContent = String(i + 1);

      const text = document.createElement("div");
      text.className = "puzzle-text";
      text.textContent = PUZZLE_TEXT[id] ?? id;

      const move = document.createElement("div");
      move.className = "puzzle-move";
      move.setAttribute("aria-label", "Flytt");

      const btnUp = document.createElement("button");
      btnUp.type = "button";
      btnUp.className = "btn btn-ghost puzzle-move-btn";
      btnUp.dataset.action = "up";
      btnUp.dataset.index = String(i);
      btnUp.setAttribute("aria-label", "Opp");
      btnUp.textContent = "↑";
      btnUp.disabled = i === 0;

      const btnDown = document.createElement("button");
      btnDown.type = "button";
      btnDown.className = "btn btn-ghost puzzle-move-btn";
      btnDown.dataset.action = "down";
      btnDown.dataset.index = String(i);
      btnDown.setAttribute("aria-label", "Ned");
      btnDown.textContent = "↓";
      btnDown.disabled = i === state.order.length - 1;

      move.append(btnUp, btnDown);

      const flag = document.createElement("div");
      flag.className = "puzzle-flag";
      flag.setAttribute("aria-hidden", "true");

      item.append(num, text, move, flag);
      dom.puzzleList.appendChild(item);
    }

    dom.puzzleHint.disabled = state.hintUsed;
  };

  const doCheck = () => {
    state.checked = true;
    state.mask = state.order.map((id, idx) => id === PUZZLE_CORRECT[idx]);
    const correct = state.mask.filter(Boolean).length;
    const percent = Math.round((correct / PUZZLE_CORRECT.length) * 100);

    if (dom.puzzleResult) dom.puzzleResult.hidden = false;
    if (dom.puzzleScore) dom.puzzleScore.textContent = `Riktig: ${correct}/${PUZZLE_CORRECT.length} (${percent}%)`;

    const prevBest = safeInt(localStorage.getItem(PUZZLE_STORAGE_KEY), 0);
    const nextBest = Math.max(prevBest, percent);
    localStorage.setItem(PUZZLE_STORAGE_KEY, String(nextBest));
    if (dom.puzzleBest) dom.puzzleBest.textContent = String(nextBest);

    setNote(correct === PUZZLE_CORRECT.length ? "Flott! Sirkelen er lukket." : "Nesten. Flytt trinnene og prøv igjen.");
    render();
  };

  const doHint = () => {
    if (state.hintUsed) return setNote("Hintet er allerede brukt. Trykk «Tilbakestill» for å starte på nytt.");
    state.hintUsed = true;

    const pairs = [];
    for (let i = 0; i < PUZZLE_CORRECT.length - 1; i += 1) {
      pairs.push([PUZZLE_CORRECT[i], PUZZLE_CORRECT[i + 1]]);
    }
    const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
    state.hintPair = [a, b];
    setNote(`Hint: etter «${PUZZLE_TEXT[a]}» kommer «${PUZZLE_TEXT[b]}».`);
    render();
  };

  const doReset = () => {
    state.order = shuffle(PUZZLE_CORRECT);
    state.checked = false;
    state.mask = [];
    state.hintUsed = false;
    state.hintPair = null;
    setNote("");
    if (dom.puzzleResult) dom.puzzleResult.hidden = true;
    render();
  };

  dom.puzzleList.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("button.puzzle-move-btn");
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = safeInt(btn.dataset.index, -1);
    if (idx < 0) return;
    clearCheck();
    if (action === "up") state.order = arrayMove(state.order, idx, idx - 1);
    if (action === "down") state.order = arrayMove(state.order, idx, idx + 1);
    render();
  });

  dom.puzzleList.addEventListener("dragstart", (event) => {
    const el = event.target?.closest?.(".puzzle-item");
    const idx = safeInt(el?.dataset?.index, -1);
    if (idx < 0) return;
    state.dragFrom = idx;
    event.dataTransfer?.setData?.("text/plain", String(idx));
    event.dataTransfer?.setDragImage?.(el, 20, 20);
  });

  dom.puzzleList.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  dom.puzzleList.addEventListener("drop", (event) => {
    event.preventDefault();
    const el = event.target?.closest?.(".puzzle-item");
    const toIdx = safeInt(el?.dataset?.index, -1);
    const fromIdx = state.dragFrom;
    state.dragFrom = null;
    if (typeof fromIdx !== "number" || fromIdx < 0) return;
    if (toIdx < 0) return;
    if (fromIdx === toIdx) return;
    clearCheck();
    state.order = arrayMove(state.order, fromIdx, toIdx);
    render();
  });

  dom.puzzleList.addEventListener("dragend", () => {
    state.dragFrom = null;
  });

  dom.puzzleCheck.addEventListener("click", doCheck);
  dom.puzzleHint.addEventListener("click", doHint);
  dom.puzzleReset.addEventListener("click", doReset);

  render();
}

// ---------------------------------------------------------------------------
// Trainer: material detective
// ---------------------------------------------------------------------------

const TRAINER_STORAGE_KEY = "materialTrainerBest";

const MATERIALS = [
  { id: "pet", label: "Plast PET" },
  { id: "hdpe", label: "Plast HDPE" },
  { id: "pp", label: "Plast PP" },
  { id: "paper", label: "Papir/kartong" },
  { id: "glass", label: "Glass" },
  { id: "metal", label: "Aluminium/metall" },
  { id: "ewaste", label: "Elektronikk / farlig avfall" },
];

const MATERIAL_LABEL = Object.fromEntries(MATERIALS.map((m) => [m.id, m.label]));

const TRAINER_ITEMS = [
  {
    id: "water-bottle",
    title: "Plastflaske for vann",
    desc: "Du vil ikke kaste den, men det er uklart hvor den skal.",
    material: "pet",
    advice: "Tas ofte imot som plast; sørg for at den er tom og gjerne klemt flat.",
  },
  {
    id: "cap",
    title: "Kork fra flaske",
    desc: "En liten ting som lett forsvinner i sorteringen.",
    material: "pp",
    advice: "Tas ofte imot separat fra flasken; lever gjerne sammen dersom det er slik på ditt mottak.",
  },
  {
    id: "bag",
    title: "Butikkpose",
    desc: "Tynn plast — den vanligste engangsfølgesvennen.",
    material: "hdpe",
    advice: "Leveres ren og tørr dersom plastfolie tas imot.",
  },
  {
    id: "food-box",
    title: "Plastboks fra mat",
    desc: "Matrester forstyrrer gjenvinningen mer enn man tror.",
    material: "pp",
    advice: "Skyll bort matrester, ellers kan gjenvinning bli umulig.",
  },
  {
    id: "yogurt",
    title: "Yoghurtbeger",
    desc: "En liten ting — men millioner hver dag.",
    material: "pp",
    advice: "Lever ren; skill folie/lokk hvis mulig.",
  },
  {
    id: "can",
    title: "Aluminiumsboks",
    desc: "Metall er verdifullt: det blir ofte faktisk gjenvunnet.",
    material: "metal",
    materialLabel: "Aluminium/metall",
    advice: "Metall gjenvinnes godt; boksen er best å klemme flat.",
  },
  {
    id: "glass-bottle",
    title: "Glassflaske",
    desc: "Tung, men nesten «evig» i gjenvinning — når den er ren.",
    material: "glass",
    materialLabel: "Glass",
    advice: "Lever uten rester; lokket leveres separat som metall/plast.",
  },
  {
    id: "cardboard",
    title: "Pappeske",
    desc: "Tørr papp er en av de enkleste strømmer.",
    material: "paper",
    materialLabel: "Papir/kartong",
    advice: "Lever tørr og ren, uten fettflekker.",
  },
  {
    id: "receipt",
    title: "Butikkkvittering",
    desc: "Tynn termopapir — et «spesialtilfelle».",
    material: "paper",
    materialLabel: "Papir/kartong (spesialtilfelle)",
    advice: "Det er ofte termopapir; hvis det finnes egen innsamling, lever dit, ellers i restavfall (avhenger av lokale regler).",
  },
  {
    id: "coffee-cup",
    title: "Engangskopp for kaffe",
    desc: "Ser ut som papir, men kan ha plast på innsiden.",
    material: "paper",
    materialLabel: "Papir/kartong (spesialtilfelle)",
    advice: "Ofte er det et plastlag inni; gjenvinning avhenger av infrastrukturen — prøv å unngå engangs der det går.",
  },
  {
    id: "battery",
    title: "Batteri",
    desc: "Lite, men potensielt farlig.",
    material: "ewaste",
    materialLabel: "Elektronikk / farlig avfall",
    advice: "Aldri kast i restavfall; lever til egne mottakspunkter.",
  },
  {
    id: "headphones",
    title: "Ødelagte hodetelefoner",
    desc: "Inni finnes verdifulle materialer — og farlige komponenter.",
    material: "ewaste",
    materialLabel: "Elektronikk / farlig avfall",
    advice: "Lever som elektronisk avfall: der finnes verdifulle materialer og farlige komponenter.",
  },
];

function initTrainer(dom) {
  if (
    !dom.trainerProgress ||
    !dom.trainerStreak ||
    !dom.trainerBest ||
    !dom.trainerCard ||
    !dom.trainerTitle ||
    !dom.trainerDesc ||
    !dom.trainerOptions ||
    !dom.trainerFeedback ||
    !dom.trainerStatus ||
    !dom.trainerCorrect ||
    !dom.trainerAdvice ||
    !dom.trainerNext ||
    !dom.trainerReset ||
    !dom.trainerResult ||
    !dom.trainerFinal ||
    !dom.trainerTips ||
    !dom.trainerRestart ||
    !dom.trainerNote
  ) {
    return;
  }

  const state = {
    order: [],
    index: 0,
    score: 0,
    streak: 0,
    answered: false,
    wrongTopics: new Set(),
    wrongSpecial: false,
  };

  const setNote = (text) => {
    dom.trainerNote.textContent = text || "";
  };

  const readBest = () => clamp(safeInt(localStorage.getItem(TRAINER_STORAGE_KEY), 0), 0, TRAINER_ITEMS.length);
  const writeBest = (value) => localStorage.setItem(TRAINER_STORAGE_KEY, String(clamp(value, 0, TRAINER_ITEMS.length)));

  const getItemById = (id) => TRAINER_ITEMS.find((it) => it.id === id);

  const clearOptions = () => {
    dom.trainerOptions.innerHTML = "";
  };

  const renderOptions = () => {
    clearOptions();
    for (const m of MATERIALS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-ghost trainer-option";
      btn.dataset.material = m.id;
      btn.textContent = m.label;
      dom.trainerOptions.appendChild(btn);
    }
  };

  const showFinal = () => {
    const best = readBest();
    if (state.score > best) writeBest(state.score);
    dom.trainerBest.textContent = String(Math.max(best, state.score));

    dom.trainerCard.hidden = true;
    dom.trainerResult.hidden = false;
    dom.trainerFinal.textContent = `Resultat: ${state.score}/${TRAINER_ITEMS.length}`;

    const tips = [];
    if (state.wrongSpecial) {
      tips.push("Sjekk reglene for mottaket: «spesialtilfeller» kan ikke alltid gå i vanlig beholder.");
    }
    if (state.wrongTopics.has("plastics")) {
      tips.push("Plast bør leveres ren og tørr: matrester og smuss «ødelegger» ofte gjenvinningen.");
    }
    if (state.wrongTopics.has("ewaste")) {
      tips.push("Elektronikk og batterier leveres separat: det er tryggere og gir verdifulle materialer tilbake.");
    }
    if (state.wrongTopics.has("paper")) {
      tips.push("Papir og papp leveres tørt: vått/fett materiale tas ofte ikke imot.");
    }
    if (state.wrongTopics.has("glass")) {
      tips.push("Glass leveres uten rester: lokk går ofte i en egen strøm (metall/plast).");
    }
    if (state.wrongTopics.has("metal")) {
      tips.push("Metall er best å levere klemt flat: det sparer plass og gjør logistikken enklere.");
    }
    if (tips.length < 3) tips.push("Er du i tvil — sjekk merking og lokale regler.");

    dom.trainerTips.innerHTML = "";
    for (const t of tips.slice(0, 3)) {
      const li = document.createElement("li");
      li.textContent = t;
      dom.trainerTips.appendChild(li);
    }

    dom.trainerRestart.focus?.();
  };

  const showQuestion = () => {
    if (state.index >= state.order.length) return showFinal();

    const best = readBest();
    dom.trainerBest.textContent = String(best);
    dom.trainerStreak.textContent = String(state.streak);
    dom.trainerProgress.textContent = `Spørsmål ${state.index + 1} av ${TRAINER_ITEMS.length}`;

    const item = getItemById(state.order[state.index]);
    if (!item) return showFinal();

    dom.trainerTitle.textContent = item.title;
    dom.trainerDesc.textContent = item.desc;

    state.answered = false;
    setNote("");
    renderOptions();

    dom.trainerFeedback.hidden = true;
    dom.trainerStatus.classList.remove("is-correct", "is-wrong");
    dom.trainerStatus.textContent = "";
    dom.trainerCorrect.textContent = "";
    dom.trainerAdvice.textContent = "";
  };

  const choose = (materialId) => {
    if (state.answered) return;
    const item = getItemById(state.order[state.index]);
    if (!item) return;

    state.answered = true;
    const correct = item.material;
    const isCorrect = materialId === correct;

    if (isCorrect) {
      state.score += 1;
      state.streak += 1;
      dom.trainerStatus.textContent = "Riktig!";
      dom.trainerStatus.classList.add("is-correct");
    } else {
      state.streak = 0;
      dom.trainerStatus.textContent = "Feil";
      dom.trainerStatus.classList.add("is-wrong");

      if (["pet", "pp", "hdpe"].includes(correct)) state.wrongTopics.add("plastics");
      if (correct === "ewaste") state.wrongTopics.add("ewaste");
      if (correct === "paper") state.wrongTopics.add("paper");
      if (correct === "glass") state.wrongTopics.add("glass");
      if (correct === "metal") state.wrongTopics.add("metal");

      if ((item.materialLabel || "").includes("spesialtilfelle")) state.wrongSpecial = true;
    }

    dom.trainerStreak.textContent = String(state.streak);
    dom.trainerFeedback.hidden = false;

    const correctLabel = item.materialLabel || MATERIAL_LABEL[correct] || correct;
    dom.trainerCorrect.textContent = correctLabel;
    dom.trainerAdvice.textContent = item.advice;
  };

  const next = () => {
    if (!state.answered) return setNote("Velg et alternativ først.");
    state.index += 1;
    showQuestion();
  };

  const reset = () => {
    state.order = shuffle(TRAINER_ITEMS.map((it) => it.id));
    state.index = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;
    state.wrongTopics = new Set();
    state.wrongSpecial = false;
    dom.trainerCard.hidden = false;
    dom.trainerResult.hidden = true;
    showQuestion();
  };

  dom.trainerOptions.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("button");
    if (!btn) return;
    const materialId = btn.dataset.material;
    if (!materialId) return;
    choose(materialId);
  });

  dom.trainerNext.addEventListener("click", next);
  dom.trainerReset.addEventListener("click", reset);
  dom.trainerRestart.addEventListener("click", reset);

  reset();
}

// ---------------------------------------------------------------------------

initReveal();

const dom = {
  labTabPuzzle: document.getElementById("labTabPuzzle"),
  labTabTrainer: document.getElementById("labTabTrainer"),
  labPuzzle: document.getElementById("labPuzzle"),
  labTrainer: document.getElementById("labTrainer"),

  puzzleBest: document.getElementById("puzzleBest"),
  puzzleList: document.getElementById("puzzleList"),
  puzzleCheck: document.getElementById("puzzleCheck"),
  puzzleHint: document.getElementById("puzzleHint"),
  puzzleReset: document.getElementById("puzzleReset"),
  puzzleResult: document.getElementById("puzzleResult"),
  puzzleScore: document.getElementById("puzzleScore"),
  puzzleNote: document.getElementById("puzzleNote"),

  trainerProgress: document.getElementById("trainerProgress"),
  trainerStreak: document.getElementById("trainerStreak"),
  trainerBest: document.getElementById("trainerBest"),
  trainerCard: document.getElementById("trainerCard"),
  trainerTitle: document.getElementById("trainerTitle"),
  trainerDesc: document.getElementById("trainerDesc"),
  trainerOptions: document.getElementById("trainerOptions"),
  trainerFeedback: document.getElementById("trainerFeedback"),
  trainerStatus: document.getElementById("trainerStatus"),
  trainerCorrect: document.getElementById("trainerCorrect"),
  trainerAdvice: document.getElementById("trainerAdvice"),
  trainerNext: document.getElementById("trainerNext"),
  trainerReset: document.getElementById("trainerReset"),
  trainerResult: document.getElementById("trainerResult"),
  trainerFinal: document.getElementById("trainerFinal"),
  trainerTips: document.getElementById("trainerTips"),
  trainerRestart: document.getElementById("trainerRestart"),
  trainerNote: document.getElementById("trainerNote"),
};

initLabTabs(dom);
initPuzzle(dom);
initTrainer(dom);
