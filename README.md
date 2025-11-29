# Simple Volleyball Scout PWA

Setup rapido per pubblicare l'app su GitHub Pages.

- `npm install` per scaricare le dipendenze locali.
- `npm run build:web` genera gli asset statici in `docs/`.
- Abilita GitHub Pages dalle impostazioni del repo scegliendo la sorgente `main` e la cartella `docs`.
- (Opzionale) `npm run serve` per testare localmente la build da `docs/`.

Il manifest e il service worker usano percorsi relativi, quindi l'app funziona correttamente anche servita in sottocartelle (es. `https://<utente>.github.io/<repo>/`).
