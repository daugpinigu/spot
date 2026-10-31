# Spot portfelis

Asmeninis spot poziciju puslapis (pakeicia Google Sheets "Spot" lentele).
Puslapis: https://daugpinigu.github.io/spot/

## Kas cia yra

- `index.html` - visas puslapis (vanilla JS, be build'o). Gyvos kainos, KPI, pyragas, poziciju lentele, redagavimas.
- `data/positions.json` - pozicijos + inasai. Vienintelis duomenu saltinis. Kiekvienas issaugojimas is puslapio = commit'as i si faila.
- `api/quotes.js` - Vercel serverless funkcija (projektas `spot-api`): Yahoo Finance v8 chart proxy su CORS.
  `GET /api/quotes?symbols=TSLA,AMZ3.L` -> `{ quotes: { TSLA: { price, prevClose, changePct, currency, exchange, name, time, ext } }, errors: {} }`
- `robots.txt` + `<meta name="robots" content="noindex">` - puslapis neindeksuojamas, bet URL vis tiek viesas (public repo).

## Kainos

- Akcijos / ETP: Yahoo Finance per `spot-api` (US - realtime, LSE/Xetra - pagal birzos delay). Simbolis lauke `yahoo` (US = tickeris, LSE = `.L`, Xetra = `.DE`). `ext` = pre/after-market paskutinis 15 min baras.
- Crypto: CoinGecko `simple/price` tiesiai is narsykles (CORS leidziamas, ~1 min atnaujinimas). Id lauke `coingecko`.
- Puslapis atnaujina kainas kas 30 s (kai tab'as matomas). Vercel CDN cache'ina atsakyma 15 s.

## Redagavimas (pirkimas, inasas, keitimas)

Rasymui i repo reikia GitHub fine-grained token (viena karta kiekviename irenginyje, saugomas tik localStorage):

1. https://github.com/settings/personal-access-tokens/new
2. Repository access -> Only select repositories -> `daugpinigu/spot`
3. Permissions -> Repository permissions -> Contents -> Read and write
4. Generate, nukopijuoti, puslapyje spausti ⚙ ir ikleti.

Veiksmai (mygtukas "Redaguoti"): pirkimas / nauja pozicija (esamam tickeriui prideda vnt ir suma, avg persiskaiciuoja; pagal nutylejima suma nuskaitoma is Cash), inasas (prideda prie "Investuota suma" ir prie Cash), eilutes redagavimas, pasalinimas, inasu sarasas.

## Duomenu modelis

```json
{
  "quotesApi": "https://spot-api.vercel.app/api/quotes",
  "deposits": [ { "id": "d1", "date": "2026-10-31", "amount": 59419, "note": "..." } ],
  "positions": [
    { "id": "tsla", "ticker": "TSLA", "name": "Tesla", "type": "stock", "units": 52, "cost": 14079.07, "yahoo": "TSLA", "note": "", "flag": false },
    { "id": "btc", "ticker": "BTC", "type": "crypto", "units": 0.0553, "cost": 1845.35, "coingecko": "bitcoin" },
    { "id": "cash", "ticker": "Cash", "type": "cash", "value": 5957.6 }
  ]
}
```

`type`: `stock` | `etf` | `crypto` | `cash`. `cost` = investuota suma i pozicija ($), avg = cost / units. `cash` tipo eilutes turi fiksuota `value`. `lastPrice` / `lastPriceAt` - paskutine zinoma kaina, irasoma issaugojimo momentu (fallback, kai API neatsako).

## Lokaliai

```
python3 -m http.server 8787   # http://localhost:8787
```

API deploy (iš repo root, Vercel CLI prisijunges): `npx vercel deploy --prod --yes`.
