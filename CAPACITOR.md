# Conversione con Capacitor

I passaggi per impacchettare la PWA come app Android.

## Preparazione
- Installa le dipendenze: `npm install` (richiede rete).
- Aggiorna gli asset: `npm run build:web` copia i file in `www/`, cartella usata da Capacitor.
- (Opzionale) se la cartella `android/` esistente non ti serve, eliminala prima di aggiungere la piattaforma per evitare conflitti.

## Aggiungere/aggiornare Android
- Prima aggiunta: `npm run cap:init` (costruisce `www/` e fa `npx cap sync android`).
- Dopo modifiche web: `npm run cap:sync` (ricostruisce e sincronizza asset/config sul progetto Android).
- Aprire in Android Studio: `npm run cap:open`.
- Eseguire su device/emulatore: `npm run cap:run`.

## Note utili
- L'`appId` è `it.davidaffo.simplevolleyscout` (configurabile in `capacitor.config.json`).
- Il service worker viene ignorato in app native perché lo schema `capacitor://` non lo supporta; resta attivo nella PWA web.
- Icone: l'icona sorgente è `icons/icon-1024.png`. Dopo un `cap add android`, genera le icone native con `cd android && npx @capacitor/assets --logo ../icons/icon-1024.png` (crea mipmap/splash in `android/app/src/main/res`).
- Mantieni `www/` e `node_modules/` fuori dal controllo versione (`.gitignore` già aggiornato).
- Se hai già un progetto Android personalizzato, confronta/integra i file generati da Capacitor invece di sovrascriverli.
