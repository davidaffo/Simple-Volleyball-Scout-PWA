# Manuale · Simple Volleyball Scout PWA

## Cos'è e cosa fa

Simple Volleyball Scout PWA è un'applicazione gratuita e open source per la rilevazione statistica delle partite di pallavolo. L'obiettivo è offrire le stesse funzionalità dei software professionali del settore, cercando di avvicinarsi il più possibile ai loro standard e formati.

Supporta la rilevazione sia in diretta che da video, utilizzabile tramite interfaccia grafica o tramite i codici standard inseriti da tastiera. I dati raccolti possono essere analizzati attraverso un'interfaccia dedicata, con supporto anche per i formati standard di altri programmi. È inoltre disponibile la funzionalità di sincronizzazione e analisi video.

L'applicazione è una PWA (Progressive Web App): funziona direttamente nel browser ed è ottimizzata per desktop, smartphone e tablet. Nonostante si basi su tecnologie web, opera completamente offline e tutti i dati vengono salvati esclusivamente sul dispositivo dell'utente, senza alcun server esterno.

---

## Match e squadre

### Gestione match

La prima schermata che si presenta è l'interfaccia di impostazione partita. Da qui puoi creare una nuova partita oppure modificare quella corrente.

Cliccando su **Gestione Match** si apre l'interfaccia delle partite. Al centro sono elencate tutte le partite già scoutizzate: cliccando su una e premendo *Carica Match* la si carica. In alternativa si crea una nuova partita premendo *Nuovo Match*.

Da questa schermata puoi modificare tutte le informazioni di base: avversario, categoria, data, amichevole e così via. Il nome dell'avversario è modificabile solo in modalità singola squadra; in modalità doppia squadra non è modificabile.

Altre operazioni disponibili:

- **Elimina match** — elimina la partita selezionata
- **Esporta / importa match da file** — permette l'importazione e l'esportazione delle partite tramite file
- **Esporta l'intero database** — esporta tutti i dati dell'applicazione in un singolo file
- **Reset match** — riporta a zero tutte le statistiche del match corrente, cancellando qualunque dato preso

> Nel programma trovi una squadra di test che puoi utilizzare liberamente per fare pratica con il programma.

### Selezione delle squadre

Dalla schermata di impostazione puoi selezionare le squadre tramite menu a tendina. Ci sono due modalità:

- **Modalità doppia squadra** (default): si scoutizzano contemporaneamente entrambe le squadre
- **Modalità singola squadra**: si scoutizza solo la propria squadra, togliendo la spunta da squadra avversaria.

Con il tasto **Gestione squadre**, puoi visualizzare e modificare tutte le squadre create, oltre a poterne creare di nuove. Hai anche opzioni per l'importazione e l'esportazione tramite file.

### Modifica di una squadra
Premendo il tasto **Gestione squadra**, puoi aprire la finestra di modifica squadra.
Da questa finestra puoi modificare il nome della squadra e le informazioni secondarie. Per le giocatrici hai due opzioni: modificarle a mano una per una oppure aggiungerle da un elenco.

Puoi anche:

- Indicare i **liberi** tramite l'apposita spunta
- Selezionare la **capitana**
- Togliere dalla rosa della partita le giocatrici non convocate, senza rimuoverle definitivamente dalla squadra

Sul lato destro c'è la **formazione di default**: la rotazione con cui la squadra viene schierata all'inizio di ogni partita. Puoi trascinare le giocatrici nelle posizioni che vuoi. Il menu a tendina serve per scegliere chi è il palleggiatore: il programma assegna automaticamente i ruoli a tutte le altre giocatrici in base alla sua posizione, seguendo l'ordine classico (palleggio → 1° schiacciatore → 2° centrale → opposto → 2° schiacciatore → 1° centrale). Per ruotare la squadra usa i tasti appositi, che spostano effettivamente il palleggiatore. Una volta finite le modifiche, premi **Salva**.

### Impostazioni scout

Dalla schermata di impostazione puoi configurare le regole e le modalità di scouting separatamente per le due squadre:

- Attivare o disattivare i fondamentali da rilevare
- Scegliere i codici da utilizzare per ogni fondamentale
- Decidere cosa consideri positivo, neutro o negativo per il calcolo delle efficienze
- Decidere cosa dà punto alla tua squadra, cosa dà punto all'avversaria e cosa non dà punto
- Ripristinare in qualsiasi momento tutte le valutazioni di default

Non ci sono limiti alla personalizzazione delle impostazioni, tuttavia alcune modifiche potrebbero interferire con i comportamenti automatici del programma.

---

## Scout live

### Preparazione del set

Quando tutto è pronto puoi spostarti alla schermata Scout Live. La prima cosa che si presenta è la preparazione del set: le due formazioni sono già preimpostate con le rotazioni di default che hai configurato nella gestione squadra.

Da qui puoi modificarle come vuoi, seguendo le stesse regole già viste: ruotare la squadra con i tasti appositi senza modificare i ruoli, oppure sovrascrivere i ruoli cambiando la posizione del palleggiatore. C'è anche un tasto per ripristinare la formazione di default.

Puoi scegliere chi parte nel campo vicino e chi ha la prima battuta, poi premi **Avvia Set**.

### La schermata di rilevazione

La schermata è divisa in tre blocchi:

- **Sinistra**: impostazioni delle due squadre, set corrente, punteggi, tasto per passare al set successivo e tasto pausa/termina.
- **Centro**: il campo di gioco dove si può fare la rilevazione tramite interfaccia grafica.
- **Destra**: le traiettorie di battuta della giocatrice in servizio, il log degli eventi e il tasto per annullare l'ultimo evento. È anche presente la schermata di inserimento dei codici da tastiera, se si preferisce lavorare con quelli. Entrambe le funzionalità sono sempre disponibili e intercambiabili senza alcuna impostazione aggiuntiva.

Il punteggio si aggiorna automaticamente in base ai fondamentali inseriti. I tasti manuali di punteggio servono solo per correggere eventuali discrepanze se sei rimasto indietro.

Il campo è diviso in: campo lontano in alto (squadra avversaria, riquadro rosso), rete con comandi per entrambe le squadre, e campo vicino in basso (la tua squadra, riquadro blu). Sopra e sotto ogni squadra c'è la **barra di controllo**, da cui puoi:

- Controllare manualmente la rotazione e la posizione del palleggiatore
- Dare punto, errore o freeball per casi speciali non coperti da una valutazione
- Gestire i liberi — trascinandoli in campo oppure con la sostituzione automatica sul ruolo del centrale
- Cambiare il libero in campo
- Forzare un determinato fondamentale in modalità flusso automatico
- Chiamare i timeout

### Opzioni generali

Nella schermata di rilevazione ci sono alcune impostazioni globali:

- **Rotazione automatica**: i giocatori ruotano automaticamente sul cambio palla
- **Scambio posizioni per ruolo**: il programma posiziona i giocatori in base al ruolo, non solo alla posizione fisica — ad esempio i martelli in posto 4, l'opposto in posto 2
- **Flusso di gioco automatico**: il programma predice automaticamente il prossimo fondamentale seguendo il flusso del rally (modalità consigliata)
- **Scout da video**: apre il video da cui prendere lo scout
- **Cambia campo**: inverte la posizione delle due squadre

Alcune impostazioni si possono configurare separatamente per le due squadre:

- **P1 americana**: l'opposto attacca in posto 2 anziché in posto 4 sulla P1
- Rilevazione della **traiettoria degli attacchi**
- Rilevazione del **tipo di alzata**
- Rilevazione delle **traiettorie di battuta**
- Visualizzazione delle **traiettorie del battitore** corrente nella colonna destra

TODO SONO ARRIVATO QUI

### Inserimento in modalità flusso automatico

In modalità automatica il programma ti dice automaticamente cosa andare a valutare seguendo il flusso di gioco, questa è la modalità d'utlizzo consigliata.

Esempio di flusso completo partendo dalla battuta:

1. **Tipo di battuta** → si seleziona tramite clic o codice da tastiera (indicato tra parentesi sul tasto)
2. **Traiettoria di battuta** → si clicca la zona di partenza e poi la zona di arrivo
3. **Ricezione avversaria** → si valuta, oppure si preme doppio meno per ace diretto
4. **Alzata avversaria** → si valuta
5. **Tipo di alzata** (se attivo) → si sceglie il tipo
6. **Attacco** → si seleziona l'attaccante, si inserisce la traiettoria e si valuta

Il flusso si adatta all'esito di ogni azione: ace → torna alla battuta; errore avversario → passa la battuta all'avversario; punto in cambio palla → la squadra ruota e la battuta passa all'avversario.

### Inserimento in modalità manuale

Se disattivi il flusso automatico, per ogni giocatrice scegli tu il fondamentale da valutare. Il programma ti chiederà comunque tipo di alzata, traiettoria e valutazione prima di chiudere l'evento. Questa modalità è più lenta ed è generalmente sconsigliata.

### Traiettoria degli attacchi

Il programma supporta due modalità:

- **Direzione semplificata** (default): il punto di partenza viene inferito automaticamente dalla posizione del giocatore in campo; devi cliccare solo il punto di arrivo
- **Modalità manuale**: clicca e tieni premuto sul punto di partenza, poi trascina fino al punto di arrivo

Puoi anche scegliere di non inserire la traiettoria premendo ESC o cliccando sulla X: il programma registra comunque la valutazione. Questo è utile quando l'attaccante attacca in rete o viene murato.

### Gestione del muro

In modalità automatica il muro si valuta solo se c'è stato effettivamente un tocco. Per segnalarlo, premi il tasto **/** (slash) durante la valutazione dell'attacco: si apre la valutazione del muro avversario, da cui il programma inferisce automaticamente la valutazione dell'attacco (ad esempio muro+ → attacco-).

Puoi aggiungere dati aggiuntivi all'ultimo attacco tramite i tasti centrali:

- **Base del centrale**
- **Tipo di attacco** (regolare, pallonetto, piazzata, ecc.)
- **Numero di giocatori a muro**

Tutti questi tasti hanno codici da tastiera indicati tra parentesi.

### Rotazione, formazione e sostituzioni

Il programma tiene separate tre cose che sembrano uguali ma non lo sono: la rotazione regolamentare, la disposizione grafica in campo e i casi speciali come libero e P1 americana. Una squadra può stare in ricezione con una certa disposizione grafica, ma la rotazione di base deve restare corretta per il cambio palla successivo.

Per effettuare una **sostituzione**, premi il tasto Formazione della squadra corrispondente, trascina la giocatrice in panchina al posto di quella in campo, poi scegli:

- **Tasto rosso** (*Effettua Sostituzione*): conteggia il cambio nel totale delle sostituzioni
- **Tasto blu** (*Sovrascrivi Formazione*): corregge la formazione senza conteggiare un cambio, per quando hai inserito la formazione sbagliata

È disponibile anche la **modalità numerica** per inserire il numero di maglia direttamente da tastiera, utile per gli inserimenti più veloci.

### Correzioni e annullamenti

- **Annulla**: il tasto nel log annulla l'ultimo evento; funziona su più eventi in catena, puoi annullarne quanti ne vuoi
- **Modifica**: fai doppio clic su un campo nel log per correggere una valutazione, aggiungere una traiettoria mancante o modificare qualsiasi altro dato
- **Elimina**: puoi eliminare direttamente un fondamentale dal log

### Fine set

Quando il set è terminato, premi **Set Successivo**: si apre di nuovo la schermata di preparazione, dove puoi modificare le formazioni, cambiare campo e scegliere chi batte. Cambio campo e battuta iniziale vengono inferiti automaticamente ma sono sempre modificabili.

### Modalità singola squadra

Quando la squadra avversaria è disattivata il comportamento è quasi identico, con alcune differenze:

- La ricezione avversaria non viene valutata: dopo la battuta si passa direttamente alla valutazione della battuta stessa
- Lo slash sull'attacco vale come attacco murato con punto avversario, non apre la valutazione del muro
- Il tasto Muro permette di valutare il muro della propria squadra quando si difende
- Il flusso rimane sempre sulla propria squadra, salvo errori

### Modalità mobile

La modalità mobile si attiva automaticamente quando il programma rileva uno schermo piccolo. In questa modalità:

- Le colonne laterali sono nascoste di default e richiamabili tramite tasti dedicati
- Viene visualizzato un solo campo alla volta, quello della squadra attiva nel flusso corrente
- Le valutazioni non appaiono direttamente sulle giocatrici: cliccando sul tasto del fondamentale si apre un pop-up con i voti da inserire
- La navigazione tra schermate avviene con uno swipe verso il basso nella parte alta dello schermo

---

## Analisi

Cliccando sul tasto **Analisi** puoi vedere in tempo reale i dati di tutta la partita. Sono disponibili:

- **Tabellino** con le varie opzioni di visualizzazione
- **Distribuzione d'alzata**
- **Traiettorie di attacco** di entrambe le squadre
- **Traiettorie di battuta**
- **Analisi della singola giocatrice**

I filtri servono a restringere il contesto: set, giocatrice, valutazione, zona, tipo attacco. L'analisi non inventa nulla: riassume e filtra quello che è nel log. Se qualcosa che vedi nel log non coincide con l'analisi, il riferimento corretto è sempre il log.

> Il dettaglio completo delle funzionalità di analisi è trattato in un documento separato.

---

## Video e codici DataVolley

Il video e i codici DataVolley non sono due mondi separati: sono due modi diversi di arrivare allo stesso evento.

Usa il **video** quando devi rifinire timestamp e traiettorie, quando vuoi filtrare eventi e rivederli in sequenza, o quando devi correggere un dettaglio tecnico che dal solo log non si riesce a verificare.

Usa i **codici DataVolley** se sei veloce con la tastiera: la barra DataVolley ti permette di inserire i token e far aggiornare subito il flusso grafico. Se preferisci l'interfaccia classica, puoi continuare a usare solo il campo e il log. Le due modalità sono intercambiabili: stesso evento finale, due modi diversi per arrivarci.

---

## Backup, import ed export

Esporta spesso, soprattutto prima di aggiornare l'app o di importare dati grossi.

- **Esporta match** → per salvare una singola partita su file
- **Esporta database completo** → giocatrici, squadre e tutti i match in un unico backup
- **Importa match** → per aggiungere una partita senza toccare il resto
- **Importa database** → solo per sostituire o ripristinare l'intero archivio
- **Esporta DataVolley** → per portare i dati in formato compatibile con altri programmi
