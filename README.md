# Simple Volleyball Scout PWA

Setup rapido per pubblicare l'app su GitHub Pages direttamente dalla root del branch.

- `npm install` per scaricare le dipendenze locali.
- `npm run serve` per un server locale da `./` su `http://localhost:3000`.
- (Opzionale) `npm run tunnel` per esporre il server locale via Cloudflare Tunnel (richiede `cloudflared`).
- In GitHub Pages scegli la sorgente `main` e la root del branch.

Il manifest e il service worker usano percorsi relativi, quindi l'app funziona correttamente anche servita in sottocartelle (es. `https://<utente>.github.io/<repo>/`).
