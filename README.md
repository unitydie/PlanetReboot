# Planet Reboot

Et interaktivt, statisk webprosjekt om sirkulær økonomi: avfall vs. resirkulering — planetens tilstand og framtid.

## Teknologi (hva og hvorfor)

- **Three.js (ES Modules)**: WebGL‑motoren som renderer scenen (planet, lys, kamera, bakgrunn).
- **GLTF/GLB + `GLTFLoader`**: Laster 3D‑modellene fra `assets/models/*.glb` (planet, avfallstyper, satellitt).
- **`OrbitControls`**: Kamera‑kontroll (rotasjon/zoom) med begrensninger for en behagelig opplevelse.
- **`Raycaster`**: Treffer 3D‑objekter med musepekeren (plassere avfall på planeten / resirkulere ved klikk).
- **`InstancedMesh`**: Effektiv rendering av mange avfallsobjekter (hundrevis av instanser med god ytelse).
- **`BufferGeometryUtils`**: Slår sammen geometri ved behov for å holde modellen lett å tegne.
- **Starfield via `THREE.Points`**: Stjernebakgrunn laget som punkt-sky (lavt kostnadsnivå, stor dybdefølelse).
- **Renderer‑innstillinger**: sRGB/tone mapping/eksponering for mer naturlige materialer og kontrast.
- **Lottie (`dotlottie-wc`)**: Kort resirkulerings‑animasjon som vises der avfallet blir fjernet.
- **`localStorage`**: Lagrer framdrift og tilstand (f.eks. planethelse/år igjen, Eco Scanner‑progresjon, best‑score).
- **IntersectionObserver**: “Scroll‑reveal” på innholdssider (seksjoner dukker opp mykt ved scrolling).
- **Vanilla HTML/CSS/JS**: Ingen UI‑rammeverk; alt er bygget med standard webteknologi.

## Prosjektstruktur

- `index.html` — Hjem: WebGL‑scene + HUD + sidepanel.
- `app.js` — Three.js‑scenen, simuleringen, klikk/raycast, instancing, stjernebakgrunn, UI‑tilstand.
- `styles.css` — Felles design (glass‑kort, typografi, responsiv layout, animasjoner).
- `ui.js` — Hover/fokus‑effekter for menyer (lys + “tastet” tekst).
- `assets/models/planet.glb` — Planetmodell.
- `assets/models/trash.glb`, `assets/models/bottle.glb`, `assets/models/garbage.glb` — Avfallsmodeller.
- `assets/models/sputnik.glb` — Satellittmodell for “Kosmos”-modus.
- `scanner.html` / `scanner.js` — **Eco Scanner** (kort‑karusell med valg og symbolsk “impact”).
- `myth.html` / `myth.js` — **Myte / Sant** (quiz med forklaringer og best‑score).
- `lab.html` / `lab.js` — **Laboratorium** (puzzle + material‑detektiv).
- `emotions.html` / `emotions.js` — **Økospektrum av følelser** (støtte‑panel + “Min plan”).
- `greenwash.html` / `greenwash.js` — **Mini‑detektiv: grønnvasking** (8 runder + topp “røde flagg”).
- `about.html` — **Om prosjektet** (idé/mening/mål i tekstform, uten mekanikkbeskrivelser).

## Skjermer og innhold (kort)

- **Hjem (index)**: Interaktiv planet med målere (planethelse/år igjen) og en minimalistisk UI.
  - **Kosmos**: Visning med satellitter og enkel informasjons‑panel.
  - **Forespørsel**: Et skjema for å lage en ferdig henvendelse om henting og resirkulering.
- **Eco Scanner**: 12 produkter der du velger “livsløp” og ser en symbolsk effekt på CO₂/ressurser/tid.
- **Myte / Sant**: 10 utsagn om avfall, sortering og vaner med forklaringer etter hvert svar.
- **Laboratorium**: To lærings‑interaktiver: rekkefølge‑puzzle for sirkularitet + material‑quiz.
- **Økospektrum av følelser**: Velg en følelse, få små handlinger, og lagre en personlig plan.
- **Mini‑detektiv: grønnvasking**: Velg den mest mistenkelige reklamefrasen og lær “hva du bør sjekke”.
- **Om prosjektet**: Bakgrunn, idé og mål med prosjektet.

## Kjøring lokalt

1) Åpne mappen i VS Code.
2) Kjør en statisk server (f.eks. Live Server) og åpne `index.html`.

## Publisering (GitHub Pages)

- Prosjektet er laget for statisk hosting.
- 3D‑ressurser lastes relativt til modulfilene (robust for `https://<user>.github.io/<repo>/`).

