# Release Process

Regola operativa per ogni modifica/fix/feature:

1. Aggiornare `version.config.json` aumentando `baseVersion` di `0.0.1`.
2. Eseguire `npm run version:sync`.
3. Verificare che siano aggiornati:
   - `version.json`
   - `js/app-version.js`

Note:
- Questa procedura vale sempre quando il programma viene aggiornato.
- Il formato versione finale resta: `baseVersion+commitCount.commitHash`.
