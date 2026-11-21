# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/luckyind2020/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/luckyind2020/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast, dependency-free CSV reader that returns csv-reader 1.0.0's exact answers for broken CSV files.

`solve.js` reads `{text, header}` and answers `{columns, rows, errors}` with the reference reader's exact semantics — BOM dropped, LF/CRLF records, stray CRs dropped, quoted fields with doubled quotes and folded line breaks, unterminated quotes re-read as unquoted, short rows padded and long rows cut to the first record's width — but it scans with bulk string searches (`indexOf` + `slice`) instead of a character at a time, so it runs several times faster than the house baseline. `main.ts` drives it over every case in `/input/cases.json` and writes `/output/answers.json`.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=4ha9jy2z&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
