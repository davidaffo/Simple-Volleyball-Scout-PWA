# Simple Volleyball Scout PWA

Applicazione PWA per lo scouting della pallavolo, utilizzabile offline, con flusso di inserimento eventi in tempo reale e strumenti di analisi (anche su video). Ottimizzata anche per l'uso da smartphone.

## Panoramica
- Scout live con gestione rotazioni, formazioni, liberi e flusso automatico dei fondamentali.
- Log eventi dettagliato con filtri, selezione multipla e modifiche rapide.
- Analisi statistiche per fondamentali, rotazioni e distribuzione alzate.
- Analisi video con sincronizzazione tempi, play-by-play e correzioni.
- Supporto a due squadre, con tracciamento separato e collegamenti tra eventi correlati.

## Funzionalità principali
### Impostazioni partita
- Configurazione gara (avversario, categoria, data, note e tipo partita).
- Gestione squadre e roster con numeri, ruoli, capitani e liberi.
- Parametri di rotazione, autoposizionamento e flusso delle skill.
- Database giocatori unificato.

### Scout live
- Inserimento eventi per giocatrice e fondamentale con codici standard.
- Gestione punteggi, timeout, sostituzioni e rotazioni automatiche.
- Modalità flusso automatico e forzatura della skill successiva.
- Traiettorie per attacco e battuta (opzionali).

### Log eventi
- Colonne complete con ID, tempo, squadra, giocatrice, fondamentale e dettagli tecnici.
- Colonna link per visualizzare eventi collegati.
- Selezione multipla, modifiche in linea e operazioni di bulk edit.

### Analisi
- Tabelle e filtri per fondamentale, giocatrice, set e rotazione.
- Metriche di efficienza, positivi/negativi e distribuzione.

### Analisi video
- Sincronizzazione con file locale o YouTube.
- Scorciatoie per navigazione rapida e frame-by-frame.
- Play-by-play basato sulla durata delle skill.
- Offset temporali e unificazione tempi tra eventi collegati.

## Requisiti
- Browser moderno con supporto PWA.
- Per i video: file locale o URL YouTube.

## Note
- I dati sono salvati in locale e possono essere esportati e importati in file JSON.
- L'app può funzionare senza connessione dopo il primo caricamento.
