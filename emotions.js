const reduceMotion =
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const EMO_PLAN_KEY = "ecoSpectrum.plan.v1";
const EMO_LAST_KEY = "ecoSpectrum.lastEmotion.v1";
const EMO_PLAN_MAX = 7;

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

function normalizePlan(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of arr) {
    const t = String(item ?? "").trim();
    if (!t) continue;
    if (out.includes(t)) continue;
    out.push(t);
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

const emotionsData = {
  anxiety: {
    title: "Uro",
    validationLine: "Det er helt normalt å kjenne uro når verden føles for stor.",
    copingTips: [
      "Smalne fokus: velg én handling, ikke ti.",
      "Skill mellom det du kan kontrollere og det du ikke kan.",
      "Uro blir mindre når det finnes en plan.",
    ],
    actionsToday: [
      "Ta med en flergangsflaske/kopp.",
      "Si nei til pose: bruk handlenett eller bær i hånden.",
      "Del opp avfallet hjemme i minst to kategorier.",
      "Slå av unødvendig lys/ladere i dag.",
      "Velg én ting og bestem: selg/gis bort, ikke kast.",
      "Ta et bilde av nærmeste batteri-innsamling, så du ikke glemmer.",
    ],
    actionsWeek: [
      "Samle batterier/pærer og lever dem inn.",
      "En uke uten engangsflasker — bruk egen beholder.",
      "Lag ett måltid slik at du bruker opp restene.",
      "Reparer en ting (knapp, glidelås, kabel) i stedet for å bytte.",
      "Prøv å kjøpe én ting brukt i stedet for ny.",
      "Velg et produkt uten unødvendig emballasje minst tre ganger.",
    ],
  },
  anger: {
    title: "Sinne",
    validationLine: "Sinne er energi. Den kan rettes mot handling.",
    copingTips: [
      "Gjør følelsen til ett konkret steg: «hva kan jeg gjøre akkurat nå?»",
      "Velg handlinger som endrer systemet, ikke bare deg.",
      "Hold tempoet: litt og jevnlig slår å brenne ut på én dag.",
    ],
    actionsToday: [
      "Dropp den mest meningsløse engangs-tingen i dag.",
      "Spør på kafé: «kan jeg få i min egen kopp?»",
      "Del en post/story med én fakta og ett tips.",
      "Støtt et lokalt initiativ/petisjon for kildesortering (hvis det finnes).",
      "Plukk søppel i 5 minutter nær hjemmet (trygt).",
      "Del et mottakspunkt for avfall/ting med en venn.",
    ],
    actionsWeek: [
      "Arranger et mini-bytte av ting med venner.",
      "Finn et verksted/repair cafe i byen.",
      "Gi bort klær til gjenbruk eller materialgjenvinning.",
      "Halver leveranser med mye emballasje.",
      "Skriv til en butikk/kafé og be om kildesortering.",
      "Prøv en uke uten engangs-kaffe.",
    ],
  },
  fatigue: {
    title: "Utmattelse",
    validationLine: "Utmattelse er et signal om å senke belastningen, ikke å gi opp.",
    copingTips: [
      "Velg den letteste handlingen — det teller også.",
      "Ikke sammenlign deg med perfekte bilder.",
      "Hvile er en del av bærekraft.",
    ],
    actionsToday: [
      "Ta ett enkelt steg: nett/flaske/boks.",
      "Ikke kjøp noe ekstra «på følelser» i dag.",
      "Sorter én kategori: bare papir eller bare plast.",
      "Velg større pakning i stedet for flere små.",
      "Bruk det du allerede har hjemme i stedet for å kjøpe nytt.",
      "Sett en påminnelse om batterier/elektronikk til helgen.",
    ],
    actionsWeek: [
      "Kjøp brukt eller bytt én gang i stedet for ny.",
      "Gå gjennom en hylle og gi bort det du ikke trenger.",
      "Lag en «dag uten levering».",
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
      "Gjør det enkelt: legg nett/flaske klart på forhånd.",
      "Marker fremgang — motivasjon liker synlige resultater.",
    ],
    actionsToday: [
      "Lag et mini-kit: handlenett + flaske + matboks.",
      "Sorter og gjør klar resirkulerbart.",
      "Velg reparasjon i stedet for å kjøpe nytt (hvis mulig).",
      "Kjøp én ting brukt.",
      "Kutt emballasje: velg løsvekt/refill/større pakning.",
      "Fortell én person om en sirkulær idé.",
    ],
    actionsWeek: [
      "Gjør en utfordring: 7 dager med flergangsflaske.",
      "Lever inn elektronikk/batterier.",
      "Finn og prøv en repair-/serviceløsning for én ting.",
      "Lag handleliste for å unngå ekstra kjøp.",
      "Arranger bytte av klær eller ting.",
      "Lag en enkel «upcycle» (gjør om noe i stedet for å kaste).",
    ],
  },
  apathy: {
    title: "Likegyldighet",
    validationLine: "Likegyldighet dukker ofte opp når temaet føles for fjernt.",
    copingTips: [
      "Gjør noe som også lønner seg for deg: sparer penger/tid.",
      "Start med én gjenstand — ikke med hele verden.",
      "Noen ganger kommer interessen etter det første enkle steget.",
    ],
    actionsToday: [
      "Ta med handlenett — det er bare mer praktisk.",
      "Kjøp drikke i større pakning i stedet for små.",
      "Ikke ta engangsbestikk/servietter «for sikkerhets skyld».",
      "Gi bort én ting til brukt i stedet for å kaste.",
      "Velg varer med mindre emballasje.",
      "Åpne kartet: hvor er nærmeste sted for batteriinnsamling?",
    ],
    actionsWeek: [
      "Prøv å kjøpe brukt én gang — for å spare penger.",
      "Gjør en liten rydderunde: hva kan selges/gis bort?",
      "Kutt engangs-kaffe minst to ganger.",
      "Lever resirkulerbart i én tur.",
      "Finn et reparasjonstilbud for telefon/hodetelefoner.",
      "Prøv én vane fra listen og vurder om det ble enklere.",
    ],
  },
};

initReveal();

const dom = {
  emotionGrid: document.getElementById("emotionGrid"),
  emotionResponse: document.getElementById("emotionResponse"),
  emotionValidation: document.getElementById("emotionValidation"),
  emotionTips: document.getElementById("emotionTips"),
  emotionToday: document.getElementById("emotionToday"),
  emotionWeek: document.getElementById("emotionWeek"),
  emotionReroll: document.getElementById("emotionReroll"),
  emotionSave: document.getElementById("emotionSave"),
  emotionPlanList: document.getElementById("emotionPlanList"),
  emotionPlanClear: document.getElementById("emotionPlanClear"),
  emotionPlanDownload: document.getElementById("emotionPlanDownload"),
  emotionNote: document.getElementById("emotionNote"),
};

if (!dom.emotionGrid || !dom.emotionResponse) {
  throw new Error("Økospektrum: mangler nødvendige DOM-elementer.");
}

const buttons = [
  ...dom.emotionGrid.querySelectorAll("button[data-emotion]"),
];

const state = {
  selected: null,
  today: "",
  week: "",
  plan: normalizePlan(safeParseJSON(localStorage.getItem(EMO_PLAN_KEY))),
};

function setNote(text) {
  if (!dom.emotionNote) return;
  dom.emotionNote.textContent = text || "";
}

function persistPlan() {
  localStorage.setItem(EMO_PLAN_KEY, JSON.stringify(state.plan));
}

function renderPlan() {
  if (!dom.emotionPlanList) return;
  dom.emotionPlanList.innerHTML = "";

  if (!state.plan.length) {
    const li = document.createElement("li");
    li.className = "emotion-plan-item emotion-plan-item--empty";
    li.textContent = "Tomt foreløpig. Lagre en handling, så dukker den opp her.";
    dom.emotionPlanList.appendChild(li);
    return;
  }

  for (const text of state.plan) {
    const li = document.createElement("li");
    li.className = "emotion-plan-item";
    li.textContent = text;
    dom.emotionPlanList.appendChild(li);
  }
}

function animateResponse() {
  if (reduceMotion || !dom.emotionResponse) return;
  dom.emotionResponse.classList.remove("is-enter");
  void dom.emotionResponse.offsetHeight;
  dom.emotionResponse.classList.add("is-enter");
}

function renderResponse() {
  if (!state.selected) return;
  const data = emotionsData[state.selected];
  if (!data) return;

  if (dom.emotionValidation) dom.emotionValidation.textContent = data.validationLine;
  if (dom.emotionTips) {
    dom.emotionTips.innerHTML = "";
    for (const tip of data.copingTips) {
      const li = document.createElement("li");
      li.textContent = tip;
      dom.emotionTips.appendChild(li);
    }
  }

  if (dom.emotionToday) dom.emotionToday.textContent = state.today || "—";
  if (dom.emotionWeek) dom.emotionWeek.textContent = state.week || "—";

  dom.emotionResponse.hidden = false;
  animateResponse();
}

function rerollActions() {
  if (!state.selected) return;
  const data = emotionsData[state.selected];
  if (!data) return;
  state.today = pickDifferent(data.actionsToday, state.today);
  state.week = pickDifferent(data.actionsWeek, state.week);
  renderResponse();
}

function setSelected(emotionKey, { persist = true } = {}) {
  if (!emotionsData[emotionKey]) return;
  state.selected = emotionKey;
  if (persist) localStorage.setItem(EMO_LAST_KEY, emotionKey);

  for (const btn of buttons) {
    const isActive = btn.dataset.emotion === emotionKey;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  }

  setNote("");
  rerollActions();
}

dom.emotionGrid.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("button[data-emotion]");
  const key = btn?.dataset?.emotion;
  if (!key) return;
  setSelected(key);
});

dom.emotionReroll?.addEventListener("click", () => {
  if (!state.selected) return setNote("Velg en følelse først.");
  setNote("");
  rerollActions();
});

dom.emotionSave?.addEventListener("click", () => {
  if (!state.selected) return setNote("Velg en følelse først.");
  if (!state.today || !state.week) rerollActions();

  const title = emotionsData[state.selected]?.title ?? "Følelse";
  const itemsToAdd = [
    `${title} — I dag: ${state.today}`,
    `${title} — For uken: ${state.week}`,
  ];

  state.plan = normalizePlan([...itemsToAdd, ...state.plan]);
  persistPlan();
  renderPlan();
  setNote("Lagt til i planen.");
});

dom.emotionPlanClear?.addEventListener("click", () => {
  state.plan = [];
  persistPlan();
  renderPlan();
  setNote("Planen er tømt.");
});

dom.emotionPlanDownload?.addEventListener("click", () => {
  if (!state.plan.length) return setNote("Planen er tom. Legg til handlinger først.");
  setNote("");
  const stamp = new Date().toISOString().slice(0, 10);
  const lines = [
    "Min plan — Planet Reboot",
    "",
    ...state.plan.map((t, i) => `${i + 1}. ${t}`),
    "",
  ];
  downloadTextFile(lines.join("\n"), `plan-${stamp}.txt`);
});

renderPlan();

const last = String(localStorage.getItem(EMO_LAST_KEY) ?? "").trim();
if (last && emotionsData[last]) setSelected(last, { persist: false });

