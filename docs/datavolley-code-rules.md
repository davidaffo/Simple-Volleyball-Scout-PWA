# DataVolley Code Rules


Questo file raccoglie le regole operative del codice DataVolley per la modalita di inserimento scout via codici.
Qui dentro distinguo:
- regole esplicitamente confermate dal manuale
- regole desunte dagli esempi del manuale e dal CSV ufficiale allegato

## Struttura generale

Il manuale dice che i codici scout sono divisi in 4 macro parti:

1. `Main Code`
2. `Advanced Code`
3. `Extended Code`
4. `Custom Characters`

Il `Main Code` e sempre obbligatorio.
Le altre parti sono opzionali e servono a specificare meglio il colpo.

Il manuale dice anche che il codice e `positional`, cioe il significato di ogni carattere dipende dalla posizione in cui compare.

## Sintassi base del singolo colpo

Forma generale del main code:

```text
[team?][player][skill][type][evaluation]
```

Note:
- `team` e obbligatorio solo per la squadra ospite/avversaria.
- per la squadra di casa `*` viene aggiunto automaticamente dal programma in normalizzazione.
- il codice di un colpo va scritto tutto attaccato, senza spazi.
- lo spazio separa un colpo dal successivo.

Esempi dal manuale:

```text
5SQ=
a7AT#
```

Interpretazione:
- `5SQ=` = squadra di casa, giocatrice 5, serve, tipo Q, valutazione `=`
- `a7AT#` = squadra ospite, giocatrice 7, attack, tipo T, valutazione `#`

## 1. Team

Prefisso squadra:

- `*` = squadra di casa / internal team
- `a` = squadra ospite / away team

Regola operativa:
- se il colpo e della squadra di casa non serve digitare `*`, il programma lo aggiunge.
- se il colpo e della squadra ospite va digitato `a`.

## 2. Numero giocatrice

Il numero maglia e il primo vero numero del codice.

Regole:
- numeri consentiti: `0..99`
- non serve lo zero iniziale per i numeri a una cifra quando si digita il codice
- nel codice normalizzato possono comparire due cifre

Esempi:
- `5SQ=` = giocatrice 5
- `a5` = giocatrice 5 della squadra ospite
- nel CSV normalizzato si trovano anche `*06...`, `a13...`, `a16...`

## 3. Skill principali

Tabella dal manuale:

- `S` = Serve
- `R` = Reception
- `A` = Attack
- `B` = Block
- `D` = Dig
- `E` = Set
- `F` = Free ball

## 4. Type of hit

Caratteri base:

- `H` = High
- `M` = Medium
- `Q` = Quick
- `T` = Tense
- `U` = Super
- `N` = Fast
- `O` = Other

Il significato cambia in base alla skill.

### Serve

- `H` = floating serve
- `M` = jump float serve
- `Q` = jump serve
- `T/U/N/O` = non usati nello scouting standard

### Reception

- `H` = su floating serve
- `M` = su jump float serve
- `Q` = su jump serve
- `T/U/N/O` = non usati nello scouting standard

### Attack

- `H` = high ball
- `M` = half ball
- `Q` = quick ball
- `T` = head ball
- `U` = super ball
- `N` = fast ball
- `O` = other/custom

### Block

- `H` = block su high ball
- `M` = block su half ball
- `Q` = block su quick attack
- `T` = block su tense attack
- `U` = block su super ball
- `N` = block su fast ball
- `O` = block su other type

### Regole derivate dal manuale

Il manuale dice esplicitamente:
- per `block`, `reception` e `defence` il `type` e uguale al tipo della skill immediatamente precedente
- per `set` il `type` varia secondo l'attacco che segue

Questa regola spiega perche in CSV troviamo:
- `RM` = reception di una jump-float serve
- `DH` = dig su high ball
- `BH` = block su high ball
- `EH` o `ET` = set collegato al tipo di attacco successivo

## 5. Evaluation

Valori base:

- `=` = errore
- `/` = very poor / blocked / invasion a seconda della skill
- `-` = poor
- `!` = good / covered / insufficient / custom a seconda della skill
- `+` = positive
- `#` = point / perfect

### Serve

- `=` = errore al servizio
- `/` = ricezione avversaria molto povera
- `-` = ricezione avversaria positiva o perfetta
- `!` = ricezione avversaria buona
- `+` = ricezione avversaria povera
- `#` = punto diretto o rally chiuso subito

### Reception

- `=` = errore
- `/` = very poor
- `-` = poor
- `!` = good
- `+` = positive
- `#` = perfect

### Attack

- `=` = errore
- `/` = murata punto
- `-` = poor, facilmente difesa
- `!` = murata ma coperta
- `+` = positiva, difesa con difficolta
- `#` = punto

### Block

- `=` = errore
- `/` = invasion / net / antenna / foot fault
- `-` = poor
- `!` = covered by opponent
- `+` = consente una difesa positiva
- `#` = punto

### Dig

- `=` = errore
- `/` = very poor
- `-` = poor
- `!` = positive cover
- `+` = positive
- `#` = perfect

### Set

- `=` = errore
- `/` = very poor
- `-` = poor
- `!` = personalizzabile dall'utente
- `+` = attacco seguente contro block 2 o 3
- `#` = attacco seguente senza block o block a 1

### Free ball

- `=` = errore
- `/` = very poor
- `-` = poor
- `!` = sufficient
- `+` = positive
- `#` = perfect

## Sintassi pratica del codice normale

Forma minima completa:

```text
[team?][shirt][skill][type][eval]
```

Esempi:

- `6SH+`
- `a4SQ`
- `14AT#`
- `8R/`
- `4B#`

Il manuale fa notare che il programma puo abbreviare usando i default di:
- skill
- type
- evaluation

Esempi espliciti dal manuale:

- se il default e `Attack High +`
  - digitare `7` puo bastare per un `7AH+`
  - digitare `7#` puo diventare `7AH#`
  - digitare `7Q` puo diventare `7AQ+`

## Spaziatura e inserimento nella scouting bar

Regole del manuale:

- un singolo colpo si scrive senza spazi
- tra un colpo e il successivo si mette uno spazio

Esempio:

```text
5SH+16 a6AV#41A
```

## Enter vs End Rally

Dal manuale:

- `Enter`
  - salva e normalizza nella lista codici
  - non assegna il punto
  - non ruota

- `End Rally`
  - salva e normalizza
  - assegna il punto
  - aggiorna servizio e rotazione quando necessario
  - puo inserire automaticamente il prossimo servizio

## Normalizzazione

Il manuale definisce la normalizzazione come il processo che trasforma cio che l'utente digita in stringhe standard riconosciute dal programma.

Punti chiave:
- avviene quando premi `End Rally`
- i `compound codes` vengono sempre trasformati in due codici separati con effetti complementari
- il codice normalizzato contiene:
  - parte principale
  - eventuale parte advanced
  - eventuale parte extended
  - eventuale parte custom

Colori citati nel manuale:
- nero su bianco = codice normalizzato
- blu = extended features
- grigio = personalized code
- arancione = codici automatici inseriti dal programma

## Codici automatici del programma

Dal manuale:

- `*zn`
- `azn`
  - posizione del setter per squadra di casa / ospite
  - `n` e la posizione del setter da `1` a `6`

- `*p`
- `ap`
  - assegnazione del punto a casa / ospite
  - servono anche per seguire il punteggio nella lista

- `*P`
- `aP`
  - cambio del setter in campo

- `*c`
- `ac`
  - sostituzioni giocatrici
  - seguite da uscita/entrata

- `*$$&`
- `a$$&`
  - codici verdi di punto assegnato in modo indefinito
  - non modificabili

Esempi reali dal CSV:
- `*p01:00`
- `ap 02:02`
- `*z6`
- `az4`
- `*$$&H#`
- `a$$&H=`

## Comandi collegati allo scout

Dal manuale:

- `LINEUP` = formazione iniziale set
- `INV` = inversione lati sullo schermo
- `ROT` = disposizione orizzontale/verticale
- `UPDATE` = ricalcolo dati dopo modifiche
- `VER` = verifica congruita dei codici
- `STOP` = pausa timecode scout
- `END` = salva ed esce
- `P` / `aP` = nuovo setter in campo
- `S` / `aS` = servizio iniziale set
- `T` / `aT` = timeout
- `C` / `aC` = cambio giocatrici

Esempi:
- `P5`
- `aP5`
- `C6.7`
- `C6.7 3.2`

## Compound codes

Il manuale li definisce come un modo abbreviato per inserire due codici correlati.

Esempio esplicito:

Codici completi:

```text
5SQ+15 a3RQ-15
```

Forma compound:

```text
5SQ1.3-5
```

Regole confermate dal manuale:
- il punto `.` sostituisce lo spazio tra due skill correlate
- nel secondo codice possono essere omesse le parti deducibili dal primo
- in compound serve-ricezione:
  - si toglie `a` dal secondo codice
  - si toglie `R` dal secondo codice
  - si toglie il tipo ricezione se e implicito dal servizio
  - si scrive una sola volta la zona di arrivo del servizio / partenza della ricezione
  - il valore del servizio puo essere implicito da quello della ricezione

Secondo esempio del manuale:

```text
5S1.2#7
```

se i default coprono parte del tipo.

## Esempi ufficiali del manuale

### Livello basso

Input:

```text
8R# 4+ 14# end rally left
6S# end rally left
6S- end rally right
8R/ end rally right
6R+ 4- 4B# end rally left
```

Normalizzato:

```text
*08RAH#
*04AH+
*14AH#
*p01:00
*z6

*06SH#
*p02:00

*06SH-
ap 02:01
az4

*08RH/
ap 02:02

*06RH+
*04AH-
*04BH#
*p03:02
*z5
```

Osservazioni:
- in low specificity il programma inserisce automaticamente `type` default
- dopo end rally appaiono punto e rotazione

### Livello medio

Esempio:

```text
a4SQ.8# 4Q a3- 14T#
```

Normalizzato:

```text
a04SQ
*08RQ#
*04AQ+
a03AH-
*14AT#
*p01:00
*z6
```

Questo conferma:
- compound serve/ricezione
- omissione di parti deducibili
- tipo attacco abbreviato inseribile direttamente (`Q`, `T`)

### Livello alto

Esempio:

```text
a4SQ1.8#6 4C1+5 a3G4-1 14W4#5
```

Qui il manuale conferma l'uso di:
- zone di partenza e arrivo
- combinazioni attacco predefinite/personalizzate
- codici tecnici avanzati oltre al main code

## Zone e direzioni

Dal manuale:
- ogni direzione e definita da due caratteri: zona di partenza e zona di arrivo
- per il servizio la zona di partenza usa 5 valori del fondo campo:
  - `1`
  - `9`
  - `6`
  - `7`
  - `5`

Significato serve start zone:
- `1` = da zona 1
- `9` = tra zona 1 e 6
- `6` = da zona 6
- `7` = tra zona 6 e 5
- `5` = da zona 5

Il manuale conferma anche:
- la traiettoria puo essere raffinata con coordinate precise e sub-zone nel modify wizard
- per attacco e servizio si possono anche disegnare traiettorie a 2 o 3 punti

## Setter calls

Il manuale cita esplicitamente i `setter calls`, per esempio:

```text
K1
```

Regola:
- se digiti `K1` durante la ricezione collegata, il programma lo assegna automaticamente al set e al setter

Nel CSV si vedono esempi come:
- `K1`
- `KE`

Il significato completo di tutte le varianti delle chiamate non e descritto in chiaro nel testo estratto, ma l'esistenza e la posizione nel flusso sono confermate.

## Extended code

Il testo estratto del manuale non elenca in una tabella testuale completa tutti i simboli dell'extended code, ma gli esempi ufficiali confermano almeno queste famiglie:

- sub-zone finali:
  - esempi testuali: `A`, `B`, `C`
- numero di giocatrici a muro:
  - esempio: `2`
- tipo di attacco specifico:
  - esempio manuale: soft spike / top spin
  - esempio manuale: hard spike
- modo in cui il punto e stato fatto:
  - esempio manuale: direct on floor = `X`
  - esempi testo: block out side, block out long, block on floor, direct on floor
- ricezione con numero di ricevitrici e lato:
  - esempio manuale: `L` e `1`

Quindi, dall'insieme manuale + CSV, l'extended code serve almeno per:
- sottocella/cono/sub-zone
- tipo di colpo piu fine
- numero muro
- modalita punto
- dettagli ricezione

## Cose visibili nel CSV e coerenti col manuale

Dal CSV ufficiale:

- `code` e la stringa DataVolley completa
- `skill`, `skill_type`, `evaluation_code`, `evaluation` esplicitano il parsing del main code
- `attack_code`, `set_code`, `set_type`, `skill_subtype`, `num_players`, `special_code` mostrano la parte advanced/extended
- `start_zone`, `end_zone`, `end_subzone`, `end_cone` corrispondono alla parte direzionale

Esempi utili:

- `*06SM#~~~18C`
  - serve
  - tipo `M`
  - valutazione `#`
  - start/end zone e coordinate nei campi derivati

- `a10EH#KEF`
  - set
  - tipo `H`
  - valutazione `#`
  - `KE` nel campo `set_code`
  - `F` in `set_type`

- `a13AH+VV~76~H`
  - attack
  - tipo `H`
  - valutazione `+`
  - `VV` in `attack_code`
  - dettagli direzionali e subtype separati

- `a16AH#V8~96~H2O`
  - attack point
  - `V8` attack code
  - `H` skill subtype
  - `2` num_players_numeric
  - `O` special_code

## Regole operative per leggere i codici

Ordine sicuro:

1. prefisso squadra opzionale
2. numero maglia
3. skill base
4. tipo
5. valutazione
6. eventuale parte advanced
7. eventuale parte extended
8. eventuale parte custom

Quando si leggono codici reali:
- prima si deve sempre parsare il `main code`
- tutto quello che segue va interpretato solo nel contesto della skill
- per molti dettagli fini conviene appoggiarsi alle colonne derivate del CSV ufficiale

## Limiti attuali di questa ricostruzione

Anche dopo la lettura del manuale, il testo estratto non contiene una tabella testuale completa per:
- tutti i valori possibili di `advanced code`
- tutti i simboli di `extended code`
- tutte le varianti di `special_code`
- l'intera codifica di combinazioni attacco e setter calls

Queste esistono chiaramente nel software e compaiono negli esempi, ma nel PDF testuale sono mostrate soprattutto tramite immagini, wizard e figure.

Quindi:
- la grammatica del `main code` qui sopra e confermata
- i `compound codes` sono confermati
- i `codici automatici` sono confermati
- la parte `advanced/extended` e confermata come concetto e in parte ricostruita dagli esempi
- per una mappa totale simbolo -> significato servirebbe continuare a campionare da CSV reali o fare OCR delle tabelle/figure del manuale

## Regola pratica finale

Per uso implementativo conviene parsare i codici in questo modo:

```text
[team?][player][skill][type][evaluation][tail...]
```

dove:
- `team/player/skill/type/evaluation` sono rigidamente posizionali
- `tail` va interpretato in base alla skill e, se disponibile, confrontato con i campi CSV derivati:
  - `attack_code`
  - `set_code`
  - `set_type`
  - `skill_subtype`
  - `num_players`
  - `special_code`
  - `start_zone`
  - `end_zone`
  - `end_subzone`

## TODO per completare la specifica

1. Campionare piu file CSV/DataVolley ufficiali.
2. Costruire una tabella `tail pattern -> meaning` per skill.
3. Fare OCR mirato delle figure del manuale che mostrano le tabelle non estratte come testo.
4. Costruire casi test:
   - single code
   - compound serve/reception
   - attack con block info
   - set con call
   - point automatic codes
