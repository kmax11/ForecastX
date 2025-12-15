# Weather App (React + Vite + Tailwind)

Current weather powered by Open‑Meteo. Search by city/address to see temperature, wind, and conditions — no signup or API key required.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure (optional):

- No API key needed. The app uses Open‑Meteo.
- Default search is Berlin. You can type any city or address (geocoding via Open‑Meteo) and it will fetch the matching coordinates.

3. Run locally:

```bash
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

## Notes

- Uses async/await with a small debounce on searches and caching to avoid spamming the API.
- Weather codes are mapped to human‑readable descriptions.
- Tailwind classes power the responsive layout and card styling.
