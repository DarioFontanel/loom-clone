# loom-clone

[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white)](https://vite.dev/)

**loom-clone** è una web app che ti permette di registrare schermo e webcam insieme, regolare la bolla della camera, tagliare inizio e fine ed esportare un MP4 — tutto in locale, senza account e senza backend. A differenza di Loom, la bolla non viene impressa nel video al momento della registrazione: posizione, forma, dimensione, zoom e pan restano modificabili **dopo** lo stop, perché la composizione avviene solo all'export.

---

## Prerequisiti

- **Node 20 o superiore** — verifica con `node -v`. Vite 8 e TypeScript 6 non partono su versioni precedenti.
- **Chrome o un browser Chromium** (Edge, Brave, Arc). La registrazione usa `getDisplayMedia`, l'export usa WebCodecs: nessuno dei due funziona su Safari o Firefox, e su quei browser l'app si apre ma non registra.
- **Una webcam e un microfono**, se vuoi usare le modalità con camera. La modalità solo schermo non li richiede.

Non serve altro: niente account, niente chiavi API, nessun file `.env`, nessun servizio esterno.

---

## Installazione

1. `git clone https://github.com/DarioFontanel/loom-clone.git` — scarica il progetto.
2. `cd loom-clone` — entra nella cartella.
3. `npm install` — installa le dipendenze (React, Vite, Tailwind, zustand, Mediabunny).
4. `npm run dev` — avvia Vite in sviluppo su <http://localhost:5173>.

Verifica: apri l'URL in Chrome, premi **Registra**, concedi i permessi di schermo e microfono — dopo il countdown parte la cattura. Se fermi la registrazione e l'export produce un MP4 riproducibile, l'installazione è a posto.

Se il browser non chiede i permessi, controlla di essere su `localhost` e non su un IP di rete: camera e microfono sono accessibili solo da un'origine sicura, cioè `localhost` o HTTPS.

---

## Comandi disponibili

- `npm run build` — compila i tipi con `tsc -b` e produce il bundle di produzione in `dist/`.
- `npm run preview` — serve `dist/` in locale, per provare la build prima di pubblicarla.
- `npm run lint` — esegue oxlint sul sorgente.

La build è statica: `dist/` può essere servita da qualsiasi hosting di file (Vercel, Netlify, GitHub Pages, un bucket). L'unico requisito è **HTTPS**, altrimenti il browser nega l'accesso a camera, microfono e cattura schermo.

---

## Funzionalità

- **Tre modalità** — schermo + camera, solo schermo, solo camera.
- **Bolla camera** — trascinabile, tre preset di dimensione più resize libero, cerchio o rettangolo, specchio.
- **Inquadratura** — zoom da 1× a 3× e pan, applicati al ritaglio del feed webcam.
- **Audio** — solo microfono, con selettore del dispositivo, indicatore di livello e mute.
- **Editing** — taglio di inizio e fine.
- **Export** — MP4 H.264 + AAC, 30 fps, altezza fino a 1080p.
- **Libreria** — le registrazioni della sessione corrente, in memoria: chiudendo la scheda si perdono.

---

## Struttura del progetto

```
src/
  types.ts                  modello dati: CameraLayout, Recording
  store.ts                  stato applicativo (zustand)
  lib/
    geometry.ts             composizione — unica fonte di verità
    recorder.ts             cattura, due MediaRecorder, misura dello sfasamento
    export.ts               rendering e muxing MP4 via Mediabunny
    useDualPlayer.ts        riproduzione sincronizzata delle due tracce
    useDevices.ts           dispositivi e livello microfono
  components/
    HomeScreen · RecordingScreen · EditorScreen
    CompositeStage          canvas + livello interattivo della bolla
    CameraPanel · TrimBar · LibraryGrid · ModeSelector · ui
```

---

Designed by **[Dario Fontanel, PhD](https://dariofontanel.com/)**

*Aiuto PMI italiane ad integrare l'intelligenza artificiale per automatizzare i lavori ripetitivi, abbattere i costi e guadagnare tempo per crescere.*

[![Sito](https://img.shields.io/badge/Sito-dariofontanel.com-4285F4?style=flat&logo=googlechrome&logoColor=white)](https://dariofontanel.com/)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=flat&logo=youtube&logoColor=white)](https://www.youtube.com/@dariofontanel)
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=flat&logo=instagram&logoColor=white)](https://www.instagram.com/dariofontanel.ai/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0yMC40NDcgMjAuNDUyaC0zLjU1NHYtNS41NjljMC0xLjMyOC0uMDI3LTMuMDM3LTEuODUyLTMuMDM3LTEuODUzIDAtMi4xMzYgMS40NDUtMi4xMzYgMi45Mzl2NS42NjdIOS4zNTFWOWgzLjQxNHYxLjU2MWguMDQ2Yy40NzctLjkgMS42MzctMS44NSAzLjM3LTEuODUgMy42MDEgMCA0LjI2NyAyLjM3IDQuMjY3IDUuNDU1djYuMjg2ek01LjMzNyA3LjQzM2MtMS4xNDQgMC0yLjA2My0uOTI2LTIuMDYzLTIuMDY1IDAtMS4xMzguOTItMi4wNjMgMi4wNjMtMi4wNjMgMS4xNCAwIDIuMDY0LjkyNSAyLjA2NCAyLjA2MyAwIDEuMTM5LS45MjUgMi4wNjUtMi4wNjQgMi4wNjV6bTEuNzgyIDEzLjAxOUgzLjU1NVY5aDMuNTY0djExLjQ1MnpNMjIuMjI1IDBIMS43NzFDLjc5MiAwIDAgLjc3NCAwIDEuNzI5djIwLjU0MkMwIDIzLjIyNy43OTIgMjQgMS43NzEgMjRoMjAuNDUxQzIzLjIgMjQgMjQgMjMuMjI3IDI0IDIyLjI3MVYxLjcyOUMyNCAuNzc0IDIzLjIgMCAyMi4yMjUgMHoiLz48L3N2Zz4%3D)](https://www.linkedin.com/in/dario-fontanel/)
[![TikTok](https://img.shields.io/badge/TikTok-000000?style=flat&logo=tiktok&logoColor=white)](https://www.tiktok.com/@dario.fontanel)
[![AI Academy](https://img.shields.io/badge/AI_Academy-E7514F?style=flat&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAzIDEgOWwxMSA2IDktNC45MVYxN2gyVjlMMTIgM3pNNSAxMy4xOFYxN2MwIDEuNjYgMy4xMyAzIDcgM3M3LTEuMzQgNy0zdi0zLjgybC03IDMuODItNy0zLjgyeiIvPjwvc3ZnPg%3D%3D)](https://www.skool.com/ai-academy-2306)

Licenza MIT — vedi [LICENSE](LICENSE).
