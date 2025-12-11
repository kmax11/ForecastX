# Weather App (React + Vite + Tailwind)

Live city weather powered by OpenWeatherMap. Search any city to see temperature, humidity, and conditions with an icon.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your API key:

- Copy `.env.example` to `.env` and set `VITE_OPENWEATHER_API_KEY` to your OpenWeatherMap key.

3. Run locally:

```bash
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

## Notes

- Uses async/await with a small debounce on search input.
- Icons come directly from OpenWeatherMap (`openweathermap.org/img/wn`).
- Tailwind classes power the responsive layout and glassmorphic card styling.
