# Manuale · Simple Volleyball Scout PWA

Una guida pensata per chi deve usarlo davvero in palestra o in partita, non per chi deve leggere documentazione tecnica.

Questo manuale spiega come usare l'app nel modo in cui la usi davvero: prepari il match, sistemi la formazione, scouti il rally, correggi se serve e poi vai in analisi.

Qui sotto trovi solo la guida testuale. Gli esempi visuali li puoi sostituire direttamente con gli screenshot che preferisci.

## 1. Cos'è e cosa fa

Simple Volleyball Scout PWA serve per registrare quello che succede in campo e trasformarlo subito in dati utili. Lo usi durante la partita per inserire gli eventi, e dopo per rileggere tutto in forma di tabellino, grafici, video e confronti.

In pratica fa tre lavori insieme:

- ti aiuta a scoutare in modo rapido e coerente
- tiene insieme punteggio, rotazione, set, liberi e flusso del rally
- ti permette di rileggere il match in modo utile per allenamento e analisi

## 2. Prima di iniziare

La regola semplice è questa: prima prepari il contesto, poi inizi a scoutare. Se parti senza match o con il roster sbagliato, ti ritrovi nomi, numeri e analisi sporche.

### Passi consigliati

1. **Crea o carica il match.**  
   È il contenitore in cui finiranno eventi, punteggio, set, video e analisi.

2. **Seleziona squadra nostra e avversaria.**  
   Se usi una sola squadra, il flusso si semplifica. Se usi entrambe, il software tiene separati i due scope.

3. **Controlla il roster.**  
   Numeri, liberi, capitana e ruoli devono essere giusti prima di partire.

4. **Sistema le opzioni di scout.**  
   Rotazione automatica, auto-posizionamento, traiettorie, tipo alzata e flusso automatico.

> Consiglio pratico: se devi cambiare numeri, nomi o liberi, fallo qui prima di iniziare. Durante la partita usa la modifica live solo per correzioni reali, non per costruire il roster da zero.

## 3. Scout live

Questa è la schermata di lavoro vera. Va letta in tre blocchi: controllo match a sinistra, campo al centro, log a destra.

### 3.1 Come si inserisce un'azione

Il modo più semplice è sempre questo: scegli la giocatrice, scegli il fondamentale, poi scegli il voto.

- Se lavori in manuale, decidi tu ogni volta il fondamentale.
- Se lavori con flusso automatico, l'app ti propone solo quello coerente con il rally.
- Se usi traiettorie o tipo alzata, il programma ti chiede i passaggi extra prima di chiudere l'evento.

### 3.2 Errori, punti e correzioni

Punto, errore e freeball non sono scorciatoie secondarie: cambiano il flusso del rally. Per questo vanno usati quando vuoi dire al programma chi ha vinto lo scambio o come è cambiato il possesso palla.

Se sbagli un inserimento, il log è il primo posto dove correggere. L'idea giusta è: il log è la fonte vera, le analisi vengono dopo.

### 3.3 Rotazione, formazione e libero

L'app tiene separate tre cose che sembrano uguali ma non lo sono:

- la rotazione reale regolamentare
- la disposizione grafica di fase, cioè come vuoi vedere il campo
- i casi speciali come libero e P1 americana

Questo è importante perché una squadra può stare in ricezione con una certa disposizione grafica, ma la rotazione di base deve restare corretta per il cambio palla successivo.

## 4. Match e squadre

Qui rientrano tutte le operazioni che non sono inserimento del rally, ma servono a tenere pulito l'archivio.

- creare un match nuovo
- caricare un match già esistente
- associare le squadre giuste
- correggere il roster senza sporcare il match

La cosa importante da ricordare è questa: il match salva non solo gli eventi, ma anche il contesto. Quindi quando riapri un match dovresti ritrovare punteggio, set, rotazione, squadre e stato operativo.

> Buona pratica: se devi fare un test, crea un match dedicato. Non riusare un match vecchio pensando di “ripulirlo dopo”, perché poi ti ritrovi statistiche sporche o riferimenti video sbagliati.

## 5. Analisi

Tutto quello che hai inserito in scout live viene riletto qui. Il concetto da tenere a mente è semplice: l'analisi non inventa nulla, riassume e filtra quello che è nel log.

### 5.1 Come leggerla bene

- Il tabellino è il punto di partenza.
- I filtri servono a restringere il contesto: set, giocatrice, valutazione, zona, tipo attacco.
- La vista giocatrici serve per entrare nel dettaglio di una singola atleta o confrontarne due.
- La sezione video serve per tornare dal numero all'azione vera.

## 6. Video e codici DataVolley

In questa app il video e i codici DataVolley non sono due mondi separati. Sono solo due modi diversi di arrivare allo stesso evento.

### 6.1 Quando usare il video

- quando devi rifinire timestamp e traiettorie
- quando vuoi filtrare eventi e rivederli in sequenza
- quando devi correggere un dettaglio tecnico che dal solo log non basta

### 6.2 Quando usare i codici DataVolley

Se sei veloce con la tastiera, la barra DataVolley ti permette di inserire token e far aggiornare subito il flusso grafico. Se preferisci la UI classica, puoi continuare a usare solo il campo e il log.

Le due modalità devono essere pensate come intercambiabili: stesso evento finale, due modi diversi per arrivarci.

## 7. Backup, import ed export

Qui la regola pratica è semplice: esporta spesso, soprattutto prima di aggiornare l'app o di importare dati grossi.

- **Esporta match** se vuoi salvare solo una partita.
- **Esporta database completo** se vuoi avere un backup vero di tutto.
- **Importa match** se devi aggiungere una partita senza toccare il resto.
- **Importa database** solo se vuoi sostituire o ripristinare l'intero archivio.
- **Esporta DataVolley** se devi portare i dati fuori dal formato nativo dell'app.

> Importante: se qualcosa che vedi nel log non coincide con l'analisi, il riferimento corretto resta il log. L'analisi deve sempre essere una lettura coerente di quei dati, non una copia separata.
