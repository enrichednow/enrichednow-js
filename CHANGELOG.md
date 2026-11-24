# Changelog

What changed in each version of the package. Versions before 0.4.0 are in the API's changelog,
<https://docs.enrichednow.com/changelog/>.

## 0.4.0 (not released yet)

Formulas: ready-made workflows that turn a few parameters into a finished list of rows.

- `client.formulas`: `list` (`query` in your own words, best matches first; each formula's `basics`, the questions it
  asks), `get`, `estimate` (free; parameters that cannot run come back `valid: false` with what to
  change) and `run` (`preview`, `unitCap`, `rowCap`, `wait`, and an `Idempotency-Key` on every start, as on a scraper
  run).
- `client.formulaRuns`: `list`, `get`, `wait` (each look held by the API for up to a minute), `rows` across pages
  (`fields`, `minScore`, `view: 'company'`), `export` and `exportAll` as CSV or NDJSON, `cancel`.
- `client.runFormula()`: starts a run, waits for it and returns `{ run, rows, export }`; `FormulaRunFailedError` when
  the run fails.
- `client.savedFormulas`: `create` (with a schedule), `list`, `get`, `update` (`null` removes the schedule or the
  monthly cap), `archive`, `duplicate`, `run`, `pause`, `resume`, `resetSeen`, `rows` since a time, `export`,
  `exportAll`, `snapshots`, `limits`.
- `client.suppressions` (`list`, `add`, `upload` a CSV file, `delete`), `client.attestations.list()` and
  `client.formulaRows.feedback()`.
- Each formula's parameters as a type: `run('job-order-hunter', params)` checks `params` against
  `JobOrderHunterParams`; any other id takes any object.
- New errors: `PlanLimitReachedError` (403), `AttestationRequiredError`, `FormulaUnavailableError`,
  `RequirementMissingError` and `SavedFormulaArchivedError` (409, each a `ConflictError`). `LimitReachedError` also
  names a saved formula's monthly cap (`savedFormulaId`); `ValidationError.minUnitCap` for `unit_cap_too_low`.
