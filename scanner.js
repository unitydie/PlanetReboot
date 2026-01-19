import "./ui.js";

const STORAGE_KEY = "ecoScanner.v1";
const reduceMotion =
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const TOTAL = 12;
const SCAN_MS = 780;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fmtSignedInt(value) {
  const v = Math.round(Number(value) || 0);
  if (v === 0) return "0";
  return v > 0 ? `+${v}` : `${v}`;
}

function fmtSigned1(value) {
  const v = Number(value) || 0;
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return "0.0";
  return rounded > 0 ? `+${rounded.toFixed(1)}` : `${rounded.toFixed(1)}`;
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

function animateNumber(
  el,
  from,
  to,
  { duration = 520, decimals = 0, signed = false } = {}
) {
  if (!el) return;
  const f = Number(from) || 0;
  const t = Number(to) || 0;

  const renderValue = (v) => {
    if (decimals === 1) el.textContent = signed ? fmtSigned1(v) : v.toFixed(1);
    else el.textContent = signed ? fmtSignedInt(v) : String(Math.round(v));
  };

  if (reduceMotion) return renderValue(t);

  const start = performance.now();
  const span = Math.max(180, duration);
  const step = (now) => {
    const p = clamp((now - start) / span, 0, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    renderValue(f + (t - f) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Impact-verdier er symbolske (ikke presise beregninger).
const PRODUCTS = [
  {
    id: "bottle",
    title: "Flaske",
    situation: "En flergangsflaske lekker fra lokket.",
    actions: [
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -14, resources: -12, years: +1.2 },
        tagline: "En rask reparasjon — lang levetid.",
        explain:
          "Å bytte pakning/lokk er enklere enn å kjøpe en ny flaske og skape mer emballasje.",
        now: "Du bytter lokket — flasken er med deg hver dag igjen.",
        future:
          "Om 5 år har du mindre engangs fordi du har blitt vant til å reparere.",
      },
      {
        id: "reuse",
        label: "Gjenbruke",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -10, resources: -9, years: +0.9 },
        tagline: "Den reneste logikken: bruke den lenger.",
        explain:
          "Å forlenge levetiden reduserer behovet for å produsere nytt og sparer ressurser.",
        now: "Du fortsetter å bruke flasken og kjøper sjeldnere engangsflasker.",
        future: "Om 5 år blir flergangsløsninger også normen rundt deg.",
      },
      {
        id: "used",
        label: "Kjøpe/selge brukt",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -4, resources: -3, years: +0.4 },
        tagline: "Fungerer når det faktisk erstatter et nykjøp.",
        explain:
          "Bruktmarkedet hjelper, men det bør ikke bli et «kjøp for å kjøpe».",
        now: "Du gir den videre til noen som faktisk kommer til å bruke den.",
        future: "Om 5 år blir bytte og brukt mer vanlig når flere stoler på det.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -6, resources: -5, years: +0.4 },
        tagline: "Materialet kan tilbake i kretsløpet — men det koster energi.",
        explain:
          "Resirkulering hjelper når tingen ikke kan brukes videre. Nøkkelen er en ren fraksjon.",
        now: "Du leverer inn materialet separat og øker sjansen for gjenvinning.",
        future:
          "Om 5 år fungerer resirkulering bedre der folk sorterer jevnt og riktig.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +12, resources: +11, years: -1.0 },
        tagline: "Ressursen går tapt, og avtrykket blir igjen.",
        explain:
          "Blandet avfall blir sjelden en ressurs. Ofte ender det på deponi eller i forbrenning.",
        now: "Tingen forsvinner, men blir værende lenge i avfallssystemet.",
        future: "Om 5 år koster det mer: i tid, penger og ressurser.",
      },
    ],
  },
  {
    id: "phone",
    title: "Telefon",
    situation: "Telefonen har blitt treg, men skjermen er hel.",
    actions: [
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -26, resources: -24, years: +1.8 },
        tagline: "Å forlenge livet til elektronikk betyr mye.",
        explain:
          "Å bytte batteri/minne kan gi enheten flere år og reduserer behovet for nye materialer.",
        now: "Du bytter batteri — telefonen føles rask igjen.",
        future: "Om 5 år blir reparasjon mer tilgjengelig, og enheter mer reparerbare.",
      },
      {
        id: "used",
        label: "Kjøpe/selge brukt",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -20, resources: -18, years: +1.2 },
        tagline: "Én enhet dekker behovet til enda én person.",
        explain:
          "Bruktmarkedet reduserer etterspørselen etter nye enheter og fordeler ressurser mer effektivt.",
        now: "Du gir den videre — den fortsetter å fungere, i stedet for å bli avfall.",
        future: "Om 5 år blir garanti og kvalitet på brukt mer standard.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -10, resources: -12, years: +0.5 },
        tagline: "Du får metaller tilbake og reduserer toksisk risiko.",
        explain:
          "Elektronikk bør samles inn separat: færre giftstoffer og flere materialer kommer tilbake.",
        now: "Du leverer den som e-avfall, ikke i restavfall.",
        future: "Om 5 år fungerer elektronikkgjenvinning bedre der innsamling er stabil.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +24, resources: +26, years: -1.8 },
        tagline: "Verdifulle materialer går tapt, og toksisiteten øker.",
        explain:
          "Elektronikk skal ikke i restavfall: det er ressurs-tap og risiko for forurensning.",
        now: "Telefonen blir avfall — en miljømessig tapspost.",
        future: "Om 5 år øker knappheten på materialer hvis kretsløpet ikke lukkes.",
      },
    ],
  },
  {
    id: "headphones",
    title: "Hodetelefoner",
    situation: "En kanal skurrer, og lyden har blitt lavere.",
    actions: [
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -14, resources: -13, years: +1.3 },
        tagline: "Liten reparasjon = stor effekt i sum.",
        explain:
          "Kabel/kontakt kan ofte fikses raskt. Det forlenger levetiden og reduserer behovet for nytt.",
        now: "Du fikser kabel/kontakt — lyden kommer tilbake.",
        future: "Om 5 år blir «reparere» mer vanlig enn «erstatte».",
      },
      {
        id: "used",
        label: "Kjøpe/selge brukt",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -6, resources: -5, years: +0.5 },
        tagline: "Fungerer hvis tingen faktisk kan settes i stand.",
        explain:
          "Bruktmarkedet hjelper når tilstanden beskrives ærlig — ellers flytter avfallet bare adresse.",
        now: "Du gir dem til noen som kan reparere og bruke dem videre.",
        future: "Om 5 år blir refurbished mer vanlig også for tilbehør.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -6, resources: -7, years: +0.4 },
        tagline: "Bedre enn restavfall: mindre toksisk risiko.",
        explain:
          "Elektronikk må i en egen strøm, ellers går materialer tapt i sorteringen.",
        now: "Du leverer dem som e-avfall og får tilbake noe av materialet.",
        future: "Om 5 år blir gjenvinning mer effektiv når innsamling blir vanlig.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +12, resources: +13, years: -1.1 },
        tagline: "Småelektronikk «forsvinner» i avfallet.",
        explain:
          "Den er vanskelig å plukke ut i sorteringen. Materialer går tapt, og toksisitet øker.",
        now: "De går i restavfall og blir problematisk avfall.",
        future: "Om 5 år blir det mer elektronikkavfall hvis innsamling ikke blir en vane.",
      },
    ],
  },
  {
    id: "laptop",
    title: "Bærbar PC",
    situation: "Den bærbare har blitt treg, men fungerer fortsatt.",
    actions: [
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -28, resources: -26, years: +2.0 },
        tagline: "Oppgradering i stedet for kjøp er et sterkt valg.",
        explain:
          "SSD/RAM kan ofte gi enheten flere år. Det sparer utslipp fra ny produksjon.",
        now: "Du oppgraderer maskinvaren — PC-en fungerer igjen.",
        future: "Om 5 år blir oppgradering like vanlig som bilservice.",
      },
      {
        id: "used",
        label: "Kjøpe/selge brukt",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -20, resources: -18, years: +1.3 },
        tagline: "Dekker behov uten ny produksjon.",
        explain:
          "Brukt elektronikk er et «andre liv» for materialer som allerede er utvunnet og satt sammen.",
        now: "Du gir den videre til noen som klarer seg med grunnleggende ytelse.",
        future: "Om 5 år blir det enklere og tryggere å gi teknologi videre.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -12, resources: -14, years: +0.6 },
        tagline: "Du henter ut metaller og reduserer toksisk risiko.",
        explain:
          "Lever elektronikk separat slik at materialer kan komme tilbake i kretsløpet.",
        now: "Du leverer den som e-avfall.",
        future:
          "Om 5 år blir elektronikkgjenvinning mer presis der innsamlingen er ren og jevn.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +26, resources: +28, years: -2.0 },
        tagline: "Sjeldne materialer går tapt, og toksisk risiko øker.",
        explain: "Å kaste elektronikk betyr tapt ressurs og mer forurensning.",
        now: "Den blir avfall, og en ny krever nye ressurser og ny produksjon.",
        future: "Om 5 år forsterkes ressursmangel hvis teknologi ikke går i sirkel.",
      },
    ],
  },
  {
    id: "sneakers",
    title: "Joggesko",
    situation: "Sålen har løsnet.",
    actions: [
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -18, resources: -16, years: +1.5 },
        tagline: "Forlenger livet til noe som ofte er vanskelig å resirkulere.",
        explain:
          "Sko består ofte av flere materialer. Reparasjon er nesten alltid bedre enn å prøve å gjenvinne.",
        now: "Du limer sålen — skoene lever videre.",
        future:
          "Om 5 år gjør verksteder i nabolaget reparasjon enklere enn nykjøp.",
      },
      {
        id: "used",
        label: "Kjøpe/selge brukt",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -6, resources: -5, years: +0.6 },
        tagline: "Bra hvis de er i god stand og faktisk blir brukt.",
        explain:
          "Second hand fungerer når det erstatter ny produksjon, ikke når det bare legger til ekstra ting.",
        now: "Du gir dem videre hvis de faktisk kan brukes — ikke til lagring.",
        future: "Om 5 år blir brukt sko vanligere med vask og oppfriskning.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -2, resources: -2, years: +0.2 },
        tagline: "Vanskelig pga. materialblanding, men noen ganger mulig.",
        explain:
          "Komposittprodukter gjenvinnes begrenset. Først: forleng levetiden.",
        now: "Du finner et mottak som faktisk tar imot sko.",
        future: "Om 5 år kan komposittgjenvinning bli bedre med infrastruktur.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +16, resources: +15, years: -1.3 },
        tagline: "Komposittavfall blir liggende lenge.",
        explain:
          "Sko på deponi blir avfall i lang tid. Et nytt par betyr nye ressurser og ny produksjon.",
        now: "De blir avfall, og du kjøper nytt.",
        future: "Om 5 år øker mengden skoavfall hvis vi ikke endrer vanene.",
      },
    ],
  },
  {
    id: "jeans",
    title: "Jeans",
    situation: "Det har kommet et hull på kneet.",
    actions: [
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -20, resources: -18, years: +1.6 },
        tagline: "Denim er ressurskrevende: reparasjon gir stor effekt.",
        explain:
          "Å lage jeans krever vann og energi. Reparasjon bevarer det som allerede er brukt.",
        now: "Du stopper/lapper — jeansen fortsetter å brukes.",
        future:
          "Om 5 år blir reparasjon en del av stilen, ikke noe å skamme seg over.",
      },
      {
        id: "used",
        label: "Kjøpe/selge brukt",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -16, resources: -14, years: +1.0 },
        tagline: "Ny eier i stedet for nye ting.",
        explain:
          "Kjøp og salg brukt reduserer presset på produksjon og avfall.",
        now: "Du selger/kjøper brukt — mindre ny produksjon.",
        future: "Om 5 år blir bruktmarkedet like vanlig som nettbutikker.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -4, resources: -3, years: +0.3 },
        tagline: "Tekstil er vanskelig å gjenvinne, men bedre enn deponi.",
        explain:
          "Først reparasjon/bruktsalg. Gjenvinning når plagget ikke kan reddes.",
        now: "Du leverer tekstil separat — hvis det finnes innsamling.",
        future:
          "Om 5 år finnes det flere tjenester som faktisk gjenvinner tekstil.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +18, resources: +17, years: -1.2 },
        tagline: "Tekstil er en stor avfallsstrøm.",
        explain:
          "Å kaste øker behovet for ny produksjon og presset på deponier.",
        now: "Jeansen blir avfall, og kretsløpet starter på nytt med nye ressurser.",
        future:
          "Om 5 år bruker byer mer på avfall hvis tekstil ikke går i kretsløpet.",
      },
    ],
  },
  {
    id: "chair",
    title: "Stol",
    situation: "Stolen knirker og er ustø.",
    actions: [
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -16, resources: -14, years: +1.5 },
        tagline: "Møbler er laget for lang levetid — hvis de vedlikeholdes.",
        explain:
          "Et par skruer og litt lim kan gi flere år. Det er billigere og renere enn ny stol.",
        now: "Du strammer festene — stolen står stødig igjen.",
        future: "Om 5 år blir møbelreparasjon normalt igjen.",
      },
      {
        id: "used",
        label: "Kjøpe/selge brukt",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -12, resources: -10, years: +1.0 },
        tagline: "Bruktmarkedet for møbler fungerer veldig godt.",
        explain:
          "Å gi møbler videre reduserer behovet for nye plater, metall og emballasje.",
        now: "Den flytter til ny eier i stedet for deponi.",
        future: "Om 5 år går mer interiør i sirkel: færre «engangs-interiør».",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -2, resources: -2, years: +0.2 },
        tagline: "Avhenger av materialer og overflater.",
        explain:
          "Lakk/lim gjør gjenvinning vanskelig. Best: reparere/selge brukt, så demontere i fraksjoner.",
        now: "Du demonterer og leverer det som tas imot.",
        future: "Om 5 år blir demontering enklere med mer standardisering.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +14, resources: +13, years: -1.1 },
        tagline: "Store gjenstander er dyrt avfall for byen og miljøet.",
        explain:
          "Stort avfall tar plass og sorteres sjelden. Det mest verdifulle er å forlenge møblers liv.",
        now: "Den havner på fyllingen, og du kjøper ny — dobbelt avtrykk.",
        future:
          "Om 5 år bruker byer mer på bortkjøring hvis vi kaster mer møbler.",
      },
    ],
  },
  {
    id: "container",
    title: "Matboks",
    situation: "Matboksen har blitt matt og ripete, men lokket sitter.",
    actions: [
      {
        id: "reuse",
        label: "Gjenbruke",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -12, resources: -10, years: +1.0 },
        tagline: "Flergangsløsninger reduserer engangsemballasje.",
        explain:
          "Hver gang du bruker boksen igjen, trengs færre engangsposer og take-away-bokser.",
        now: "Du bruker den til tørrvarer eller oppbevaring.",
        future: "Om 5 år er flergangsbokser en basisvane.",
      },
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -8, resources: -7, years: +0.8 },
        tagline: "Noen ganger holder det å bytte lokk/pakning.",
        explain: "En liten del kan forlenge levetiden i måneder.",
        now: "Du finner et lokk som passer — boksen er tett igjen.",
        future:
          "Om 5 år er reservedeler enklere å få tak i enn en helt ny ting.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -3, resources: -3, years: +0.2 },
        tagline: "Fungerer hvis plasttypen tas imot etter merking.",
        explain:
          "Ikke all plast gjenvinnes likt. Å levere riktig er bedre enn restavfall.",
        now: "Du sjekker merkingen og leverer i riktig fraksjon.",
        future: "Om 5 år blir gjenvinning enklere hvis emballasje standardiseres.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +10, resources: +9, years: -0.8 },
        tagline: "Tingen kan fortsatt brukes, men blir avfall.",
        explain:
          "Å kaste «levende» ting øker ny produksjon og plaststrømmen.",
        now: "Den blir avfall, og du kjøper ny.",
        future: "Om 5 år blir engangsløsninger dyrere når avfallskostnader øker.",
      },
    ],
  },
  {
    id: "toy",
    title: "Leke",
    situation: "Du er lei av leken, men den er hel.",
    actions: [
      {
        id: "used",
        label: "Gi bort / brukt",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -14, resources: -12, years: +1.2 },
        tagline: "Ting får leve i sirkel, ikke i en linje.",
        explain: "Å gi bort og bytte reduserer nye kjøp og emballasje.",
        now: "Leken gleder et annet barn, og dere får mindre unødvendig.",
        future: "Om 5 år blir bytte en del av nabolag og lokalsamfunn.",
      },
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -8, resources: -7, years: +0.9 },
        tagline: "En liten skade er ikke grunn til å kaste.",
        explain:
          "Reparasjon er ofte raskere enn å velge en ny ting, og reduserer behovet for produksjon.",
        now: "Du limer en del — leken er i bruk igjen.",
        future: "Om 5 år blir reparasjon av småting mer tilgjengelig nær hjemmet.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -2, resources: -2, years: +0.2 },
        tagline: "Vanskelig pga. materialblanding, men bedre enn deponi.",
        explain:
          "Hvis det finnes innsamling for leker/plast, kan noe av materialet reddes.",
        now: "Du finner et mottak som faktisk tar imot slike ting.",
        future: "Om 5 år blir komposittgjenvinning bedre der innsamling er blitt en vane.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +12, resources: +11, years: -0.9 },
        tagline: "Komplekse materialer blir ofte problemavfall.",
        explain: "De forsvinner i restavfall og kan forurense over tid.",
        now: "Leken blir avfall og blir liggende lenge.",
        future: "Om 5 år vokser avfallsbergene hvis ting ikke går i sirkel.",
      },
    ],
  },
  {
    id: "book",
    title: "Bok",
    situation: "Boken er lest og i god stand.",
    actions: [
      {
        id: "used",
        label: "Gi bort / brukt",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -10, resources: -12, years: +1.1 },
        tagline: "Én bok — mange lesere.",
        explain:
          "Å gi bøker videre reduserer behovet for nye opplag og kutter papir- og energibruk.",
        now: "Du gir den videre — den fortsetter å være i bruk.",
        future: "Om 5 år blir bokbytte mer populært, og bibliotek igjen på moten.",
      },
      {
        id: "reuse",
        label: "Bruke videre",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -6, resources: -7, years: +0.7 },
        tagline: "Lang levetid er også sirkularitet.",
        explain: "Når noe fortsatt er nyttig, blir det i omløp og reduserer nye kjøp.",
        now: "Den blir et oppslagsverk eller en «andre runde» senere.",
        future: "Om 5 år velger du oftere ting som varer lenge.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -5, resources: -8, years: +0.4 },
        tagline: "Papir gjenvinnes godt i en ren strøm.",
        explain: "Papir er en tydelig sirkel. Viktigst er at det er tørt og rent.",
        now: "Du leverer papir separat og sender materialet tilbake i kretsløpet.",
        future: "Om 5 år er papirgjenvinning fortsatt en av de mest effektive sirklene.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +8, resources: +10, years: -0.8 },
        tagline: "Materialet går tapt uten grunn.",
        explain: "Bøker kan lett gis bort eller gjenvinnes. Å kaste er tapt verdi.",
        now: "Den havner i avfallet og mister sjansen til å bli ressurs igjen.",
        future: "Om 5 år brukes mer papir fordi returgraden er lavere enn den kunne vært.",
      },
    ],
  },
  {
    id: "bag",
    title: "Pose / handlenett",
    situation: "Hanken på handlenettet røk, men stoffet er helt.",
    actions: [
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -12, resources: -10, years: +1.3 },
        tagline: "Et sting i stedet for et kjøp — og den fungerer igjen.",
        explain:
          "Å fikse det forlenger levetiden og reduserer behovet for nye bagger og emballasje.",
        now: "Du syr hanken — handlenettet er med deg igjen.",
        future: "Om 5 år varer ting lenger fordi du ikke gir opp ved første skade.",
      },
      {
        id: "reuse",
        label: "Gjenbruke",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 2, waste: 0 },
        impact: { co2: -9, resources: -8, years: +0.9 },
        tagline: "Én ting kan erstatte dusinvis av engangsposer.",
        explain: "Gjenbruk reduserer strømmen av «pose-avfall».",
        now: "Du tar med handlenettet i butikken — mindre engangs i kurven.",
        future: "Om 5 år vinner flergangsløsninger både på pris og avtrykk.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -2, resources: -2, years: +0.2 },
        tagline: "Avhenger av materiale og infrastruktur.",
        explain:
          "Blandede tekstiler og detaljer gjør gjenvinning vanskelig. Best først: reparere/gjenbruke.",
        now: "Du leverer inn som tekstil (hvis det finnes innsamling).",
        future: "Om 5 år blir tekstilgjenvinning mer presis der innsamlingen er jevn.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +10, resources: +9, years: -0.9 },
        tagline: "Materialer går tapt av bekvemmelighet.",
        explain:
          "Når vi kaster «levende» ting, må produksjonen hente inn nye ressurser.",
        now: "Det blir avfall, og et nytt tar plassen.",
        future: "Om 5 år øker tekstilavfallet fordi ting lever kortere.",
      },
    ],
  },
  {
    id: "tshirt",
    title: "T-skjorte",
    situation: "T-skjorten har strukket seg, men stoffet er helt.",
    actions: [
      {
        id: "repair",
        label: "Reparere",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -16, resources: -14, years: +1.4 },
        tagline: "Sy om/lappe — og den føles relevant igjen.",
        explain:
          "Reparasjon sparer vann og energi som allerede er brukt til å produsere stoffet.",
        now: "Du syr om eller gjør en liten upcycle — den er i bruk igjen.",
        future: "Om 5 år er reparasjon helt vanlig, som å vaske klær.",
      },
      {
        id: "used",
        label: "Kjøpe/selge brukt",
        kind: "circular",
        badge: "Sirkulært valg",
        points: { circular: 3, waste: 0 },
        impact: { co2: -18, resources: -16, years: +1.2 },
        tagline: "Én ting — to liv.",
        explain: "Å gi klær videre reduserer behovet for ny produksjon og emballasje.",
        now: "Du gir den videre — og den fortsetter å brukes.",
        future: "Om 5 år blir brukt førstevalget for basisplagg.",
      },
      {
        id: "recycle",
        label: "Resirkulere",
        kind: "risky",
        badge: "Risikabelt valg",
        points: { circular: 1, waste: 1 },
        impact: { co2: -4, resources: -3, years: +0.3 },
        tagline: "Tekstil er vanskelig å gjenvinne — men bedre enn deponi.",
        explain:
          "Stoffblanding og detaljer betyr mye. Best: forleng livet først, lever inn etterpå.",
        now: "Du leverer tekstil separat — gjenvinning avhenger av infrastruktur.",
        future: "Om 5 år finnes tjenester som lukker tekstilkretsløpet bedre.",
      },
      {
        id: "throw",
        label: "Kaste",
        kind: "wasteful",
        badge: "Sløsende valg",
        points: { circular: 0, waste: 3 },
        impact: { co2: +15, resources: +14, years: -1.1 },
        tagline: "Et helt plagg blir avfall «av vane».",
        explain:
          "Tekstil på deponi skaper utslipp, og ny garderobe krever vann og energi på nytt.",
        now: "Den forsvinner fra skapet, men blir igjen som avfall.",
        future: "Om 5 år øker avfallsstrømmen hvis kretsløpet ikke lukkes.",
      },
    ],
  },
];

// --- DOM ----------------------------------------------------------------------
const dom = {
  stepText: document.getElementById("stepText"),
  circularPoints: document.getElementById("circularPoints"),
  wastePoints: document.getElementById("wastePoints"),
  progressFill: document.getElementById("progressFill"),

  carousel: document.getElementById("carousel"),
  btnPrev: document.getElementById("btnPrev"),
  btnNextNav: document.getElementById("btnNextNav"),

  card: document.getElementById("card"),
  productTitle: document.getElementById("productTitle"),
  productSituation: document.getElementById("productSituation"),
  choiceButtons: document.getElementById("choiceButtons"),

  result: document.getElementById("result"),
  resultBadge: document.getElementById("resultBadge"),
  resultTagline: document.getElementById("resultTagline"),
  impactCo2: document.getElementById("impactCo2"),
  impactResources: document.getElementById("impactResources"),
  impactYears: document.getElementById("impactYears"),
  resultMore: document.getElementById("resultMore"),
  resultExplain: document.getElementById("resultExplain"),
  tabNow: document.getElementById("tabNow"),
  tabFuture: document.getElementById("tabFuture"),
  storyText: document.getElementById("storyText"),
  btnNext: document.getElementById("btnNext"),

  btnReset: document.getElementById("btnReset"),

  final: document.getElementById("final"),
  finalRank: document.getElementById("finalRank"),
  finalSummary: document.getElementById("finalSummary"),
  finalCo2: document.getElementById("finalCo2"),
  finalResources: document.getElementById("finalResources"),
  finalYears: document.getElementById("finalYears"),
  finalTips: document.getElementById("finalTips"),
  btnDownload: document.getElementById("btnDownload"),
  btnResetFinal: document.getElementById("btnResetFinal"),
};

function getDefaultState() {
  return {
    index: 0,
    answers: new Array(PRODUCTS.length).fill(null),
    storyTab: "now",
  };
}

function computeUnlocked(answers) {
  for (let i = 0; i < answers.length; i += 1) if (!answers[i]) return i;
  return answers.length;
}

function derive(answers) {
  let circularPoints = 0;
  let wastePoints = 0;
  const totals = { co2: 0, resources: 0, years: 0 };
  const counts = { repair: 0, reuse: 0, used: 0, recycle: 0, throw: 0 };

  for (let i = 0; i < answers.length; i += 1) {
    const actionId = answers[i];
    if (!actionId) continue;
    const product = PRODUCTS[i];
    const action = product?.actions?.find((a) => a.id === actionId);
    if (!action) continue;

    circularPoints += Number(action.points?.circular ?? 0) || 0;
    wastePoints += Number(action.points?.waste ?? 0) || 0;

    totals.co2 += Number(action.impact?.co2 ?? 0) || 0;
    totals.resources += Number(action.impact?.resources ?? 0) || 0;
    totals.years += Number(action.impact?.years ?? 0) || 0;

    if (counts[actionId] != null) counts[actionId] += 1;
  }

  return { circularPoints, wastePoints, totals, counts, unlocked: computeUnlocked(answers) };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const data = safeParseJSON(raw);
  const base = getDefaultState();
  if (!data || typeof data !== "object") return base;

  const answersRaw = Array.isArray(data.answers) ? data.answers : base.answers;
  const answers = new Array(PRODUCTS.length).fill(null);
  for (let i = 0; i < answers.length; i += 1) {
    const v = answersRaw[i];
    answers[i] = typeof v === "string" ? v : null;
  }

  const unlocked = computeUnlocked(answers);
  const idx = clamp(Number(data.index) || 0, 0, PRODUCTS.length);
  const safeIndex = idx > unlocked ? unlocked : idx;

  return {
    index: safeIndex,
    answers,
    storyTab: data.storyTab === "future" ? "future" : "now",
  };
}

let state = loadState();
let derived = derive(state.answers);
let locked = false;

let lastScores = { circular: derived.circularPoints, waste: derived.wastePoints };
let lastImpact = { co2: 0, resources: 0, years: 0 };

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      index: state.index,
      answers: state.answers,
      storyTab: state.storyTab,
      savedAt: Date.now(),
    })
  );
}

function badgeClass(kind) {
  if (kind === "circular") return "badge badge--circular";
  if (kind === "risky") return "badge badge--risky";
  return "badge badge--wasteful";
}

function setValueSignClass(el, goodWhen) {
  if (!el) return;
  el.classList.remove("is-good", "is-bad");
  const v = Number(el.dataset.value || 0);
  if (goodWhen === "negative") el.classList.add(v <= 0 ? "is-good" : "is-bad");
  else el.classList.add(v >= 0 ? "is-good" : "is-bad");
}

function renderStory() {
  if (state.index >= PRODUCTS.length) return;
  const product = PRODUCTS[state.index];
  const actionId = state.answers[state.index];
  const action = actionId ? product.actions.find((a) => a.id === actionId) : null;
  if (!action) return;

  dom.tabNow?.classList.toggle("is-active", state.storyTab === "now");
  dom.tabNow?.setAttribute("aria-selected", state.storyTab === "now" ? "true" : "false");
  dom.tabFuture?.classList.toggle("is-active", state.storyTab === "future");
  dom.tabFuture?.setAttribute("aria-selected", state.storyTab === "future" ? "true" : "false");
  if (dom.storyText) dom.storyText.textContent = state.storyTab === "future" ? action.future : action.now;
}

function runScan(done) {
  if (!done) return;
  if (reduceMotion || !dom.card) return done();
  dom.card.classList.add("is-scanning");
  window.setTimeout(() => {
    dom.card.classList.remove("is-scanning");
    done();
  }, SCAN_MS + 80);
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state = getDefaultState();
  derived = derive(state.answers);
  locked = false;
  lastScores = { circular: 0, waste: 0 };
  lastImpact = { co2: 0, resources: 0, years: 0 };
  render(true);
}

function setIndex(nextIndex) {
  const maxAllowed =
    derived.unlocked === PRODUCTS.length ? PRODUCTS.length : Math.min(PRODUCTS.length - 1, derived.unlocked);
  const idx = clamp(nextIndex, 0, maxAllowed);
  if (idx === state.index) return;
  state.index = idx;
  state.storyTab = "now";
  saveState();
  render(true);
}

function goPrev() {
  if (locked) return;
  if (state.index === PRODUCTS.length) return setIndex(PRODUCTS.length - 1);
  setIndex(state.index - 1);
}

function goNext() {
  if (locked) return;
  if (state.index === PRODUCTS.length) return;

  const answered = Boolean(state.answers[state.index]);
  if (!answered) return;

  const isLast = state.index === PRODUCTS.length - 1;
  if (isLast && derived.unlocked === PRODUCTS.length) {
    state.index = PRODUCTS.length;
    saveState();
    render(true);
    return;
  }

  setIndex(state.index + 1);
}

function chooseAction(actionId) {
  if (locked) return;
  if (state.index >= PRODUCTS.length) return;

  const product = PRODUCTS[state.index];
  const action = product.actions.find((a) => a.id === actionId);
  if (!action) return;

  locked = true;
  runScan(() => {
    state.answers[state.index] = actionId;
    state.storyTab = "now";
    saveState();
    derived = derive(state.answers);
    render(false, { scanJustRan: true });
    locked = false;
  });
}

function renderFinal() {
  const net = derived.circularPoints - derived.wastePoints;
  const rank =
    net <= 6
      ? "Nybegynner"
      : net <= 16
        ? "Omstiller"
        : net <= 26
          ? "Sirkulær tenker"
          : "Systemendrer";

  if (dom.finalRank) dom.finalRank.textContent = rank;
  if (dom.finalSummary) {
    dom.finalSummary.textContent = `Sirkulærpoeng: ${derived.circularPoints} · Avfallspoeng: ${derived.wastePoints}. Velg én ting du vil gjøre litt bedre neste gang.`;
  }

  if (dom.finalCo2) dom.finalCo2.textContent = fmtSignedInt(derived.totals.co2);
  if (dom.finalResources) dom.finalResources.textContent = fmtSignedInt(derived.totals.resources);
  if (dom.finalYears) dom.finalYears.textContent = fmtSigned1(derived.totals.years);

  const tips = [];
  const c = derived.counts;
  if (c.throw >= 3) tips.push("Bytt ut ett «kaste» med «gi bort/reparere» — det er den raskeste spaken.");
  if (c.recycle > c.repair + c.reuse) tips.push("Beveg deg oppover: reparere/gjenbruke → brukt → resirkulere.");
  if (c.used === 0) tips.push("Prøv brukt i én kategori: ofte god balanse mellom pris og avtrykk.");
  if (tips.length < 3) tips.push("Lag en «standardløsning» for sortering hjemme: pose/boks, så du slipper å tenke hver gang.");
  if (tips.length < 3) tips.push("Velg ting som kan repareres: reparasjon reduserer avtrykket mer enn man tror.");
  while (tips.length > 3) tips.pop();

  if (dom.finalTips) {
    dom.finalTips.innerHTML = "";
    for (const t of tips) {
      const li = document.createElement("li");
      li.textContent = t;
      dom.finalTips.appendChild(li);
    }
  }
}

function buildPlanText() {
  const lines = [];
  lines.push("Eco Scanner — min plan");
  lines.push(`Dato: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push(`Sirkulærpoeng: ${derived.circularPoints}`);
  lines.push(`Avfallspoeng: ${derived.wastePoints}`);
  lines.push("");
  lines.push("Påvirkning (symbolsk):");
  lines.push(`- CO₂: ${fmtSignedInt(derived.totals.co2)}`);
  lines.push(`- Ressurser: ${fmtSignedInt(derived.totals.resources)}`);
  lines.push(`- År igjen: ${fmtSigned1(derived.totals.years)}`);
  lines.push("");
  lines.push("Valg:");
  for (let i = 0; i < PRODUCTS.length; i += 1) {
    const p = PRODUCTS[i];
    const actionId = state.answers[i];
    const a = p.actions.find((x) => x.id === actionId);
    lines.push(`${i + 1}. ${p.title}: ${a ? a.label : "—"}`);
  }
  lines.push("");
  lines.push("Merk: tallene er symbolske og brukes for læring, ikke som nøyaktige beregninger.");
  return lines.join("\n");
}

function render(animateEnter = false, { scanJustRan = false } = {}) {
  derived = derive(state.answers);

  const canFinish = derived.unlocked === PRODUCTS.length;
  const isFinal = canFinish && state.index === PRODUCTS.length;

  if (dom.final) dom.final.hidden = !isFinal;
  if (dom.carousel) dom.carousel.hidden = isFinal;

  if (dom.stepText) dom.stepText.textContent = isFinal ? "Resultat" : `${state.index + 1} av ${PRODUCTS.length}`;
  if (dom.progressFill) dom.progressFill.style.width = `${(derived.unlocked / PRODUCTS.length) * 100}%`;

  animateNumber(dom.circularPoints, lastScores.circular, derived.circularPoints, { duration: 520 });
  animateNumber(dom.wastePoints, lastScores.waste, derived.wastePoints, { duration: 520 });
  lastScores = { circular: derived.circularPoints, waste: derived.wastePoints };

  if (isFinal) {
    renderFinal();
    dom.btnPrev && (dom.btnPrev.disabled = derived.unlocked === 0);
    dom.btnNextNav && (dom.btnNextNav.disabled = true);
    return;
  }

  const product = PRODUCTS[state.index];
  if (!product) return;

  if (dom.productTitle) dom.productTitle.textContent = product.title;
  if (dom.productSituation) dom.productSituation.textContent = product.situation;

  if (dom.card && animateEnter) {
    dom.card.classList.remove("is-enter");
    // eslint-disable-next-line no-unused-expressions
    dom.card.offsetHeight;
    dom.card.classList.add("is-enter");
  }

  const actionId = state.answers[state.index];
  const action = actionId ? product.actions.find((a) => a.id === actionId) : null;

  if (dom.choiceButtons) {
    dom.choiceButtons.innerHTML = "";
    for (const a of product.actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `choice-btn${a.id === actionId ? " is-active" : ""}`;
      btn.dataset.action = a.id;
      btn.textContent = a.label;
      btn.disabled = locked;
      dom.choiceButtons.appendChild(btn);
    }
  }

  if (dom.result) dom.result.hidden = !action;

  if (action) {
    if (dom.resultBadge) {
      dom.resultBadge.className = badgeClass(action.kind);
      dom.resultBadge.textContent = action.badge;
    }
    if (dom.resultTagline) dom.resultTagline.textContent = action.tagline;
    if (dom.resultExplain) dom.resultExplain.textContent = action.explain;

    const nextImpact = action.impact ?? { co2: 0, resources: 0, years: 0 };
    const dur = scanJustRan ? 620 : 420;

    if (dom.impactCo2) dom.impactCo2.dataset.value = String(nextImpact.co2);
    if (dom.impactResources) dom.impactResources.dataset.value = String(nextImpact.resources);
    if (dom.impactYears) dom.impactYears.dataset.value = String(nextImpact.years);

    animateNumber(dom.impactCo2, lastImpact.co2, nextImpact.co2, { duration: dur, signed: true });
    animateNumber(dom.impactResources, lastImpact.resources, nextImpact.resources, { duration: dur, signed: true });
    animateNumber(dom.impactYears, lastImpact.years, nextImpact.years, { duration: dur, signed: true, decimals: 1 });
    lastImpact = { co2: nextImpact.co2, resources: nextImpact.resources, years: nextImpact.years };

    setValueSignClass(dom.impactCo2, "negative");
    setValueSignClass(dom.impactResources, "negative");
    setValueSignClass(dom.impactYears, "positive");

    renderStory();
  } else {
    lastImpact = { co2: 0, resources: 0, years: 0 };
  }

  const canGoLeft = state.index > 0;
  const canGoRight = Boolean(actionId) && (state.index < PRODUCTS.length - 1 || canFinish);
  if (dom.btnPrev) dom.btnPrev.disabled = !canGoLeft;
  if (dom.btnNextNav) dom.btnNextNav.disabled = !canGoRight;

  if (dom.btnNext) {
    dom.btnNext.textContent = state.index === PRODUCTS.length - 1 && canFinish ? "Resultat" : "Neste";
    dom.btnNext.disabled = !actionId;
  }
}

// --- Events -------------------------------------------------------------------
dom.choiceButtons?.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  const actionId = btn?.dataset?.action;
  if (!actionId) return;
  chooseAction(actionId);
});

dom.btnPrev?.addEventListener("click", goPrev);
dom.btnNextNav?.addEventListener("click", goNext);
dom.btnNext?.addEventListener("click", goNext);

dom.tabNow?.addEventListener("click", () => {
  state.storyTab = "now";
  saveState();
  renderStory();
});
dom.tabFuture?.addEventListener("click", () => {
  state.storyTab = "future";
  saveState();
  renderStory();
});

dom.btnReset?.addEventListener("click", resetAll);
dom.btnResetFinal?.addEventListener("click", resetAll);

dom.btnDownload?.addEventListener("click", () => {
  if (derived.unlocked !== PRODUCTS.length) return;
  renderFinal();
  const stamp = new Date().toISOString().slice(0, 10);
  downloadTextFile(buildPlanText(), `eco-scanner-plan-${stamp}.txt`);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    goPrev();
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    goNext();
  }
});

let swipe = { active: false, x: 0, y: 0, id: -1 };

dom.card?.addEventListener("pointerdown", (e) => {
  if (locked) return;
  const interactive = e.target?.closest?.("button, a, input, textarea, select, label");
  if (interactive) return;
  swipe = { active: true, x: e.clientX, y: e.clientY, id: e.pointerId };
  dom.card.setPointerCapture?.(e.pointerId);
});

dom.card?.addEventListener("pointerup", (e) => {
  if (!swipe.active || swipe.id !== e.pointerId) return;
  swipe.active = false;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
  if (dx > 0) goPrev();
  else goNext();
});

dom.card?.addEventListener("pointercancel", () => {
  swipe.active = false;
});

render(true);
