import { useEffect, useMemo, useState } from "react";

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const ICON_BASE = "https://openweathermap.org/img/wn/";

const initialCity = "London";

function formatTemperature(value) {
  return `${Math.round(value)}°C`;
}

function formatHumidity(value) {
  return `${Math.round(value)}%`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function fetchWeather(city) {
  if (!API_KEY) {
    throw new Error("Missing API key. Add VITE_OPENWEATHER_API_KEY to .env");
  }
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", city);
  url.searchParams.set("appid", API_KEY);
  url.searchParams.set("units", "metric");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const message = res.status === 404 ? "City not found" : "Unable to fetch weather";
    throw new Error(message);
  }
  const data = await res.json();
  return {
    city: `${data.name}, ${data.sys.country}`,
    temp: data.main.temp,
    humidity: data.main.humidity,
    description: data.weather?.[0]?.description ?? "-",
    icon: data.weather?.[0]?.icon ?? "",
  };
}

export default function App() {
  const [query, setQuery] = useState(initialCity);
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Type a city to get started.");

  const hasKey = useMemo(() => Boolean(API_KEY), []);
  const chanceBars = useMemo(() => {
    if (!weather) return [];
    const base = clamp(weather.humidity ?? 40, 5, 95);
    return [
      { label: "09 am", value: clamp(base * 0.65, 5, 95) },
      { label: "12 pm", value: clamp(base * 0.8, 5, 95) },
      { label: "03 pm", value: clamp(base * 1.05, 5, 100) },
      { label: "06 pm", value: clamp(base * 0.9, 5, 95) },
      { label: "09 pm", value: clamp(base * 0.6, 5, 90) },
    ];
  }, [weather]);

  const miniForecast = useMemo(() => {
    if (!weather) return [];
    const t = Math.round(weather.temp);
    return [
      { day: "Today", high: t + 1, low: t - 1, desc: weather.description },
      { day: "Tomorrow", high: t + 2, low: t - 2, desc: "Similar conditions" },
      { day: "Day 3", high: t - 1, low: t - 3, desc: "Watch for changes" },
    ];
  }, [weather]);

  useEffect(() => {
    if (!query.trim()) {
      setWeather(null);
      setStatus("idle");
      setMessage("Type a city to search.");
      return;
    }

    setStatus("loading");
    setMessage("Fetching weather...");

    const handle = setTimeout(async () => {
      try {
        const data = await fetchWeather(query.trim());
        setWeather(data);
        setStatus("success");
        setMessage(`Showing weather for ${data.city}.`);
      } catch (error) {
        setWeather(null);
        setStatus("error");
        setMessage(error.message);
      }
    }, 450);

    return () => clearTimeout(handle);
  }, [query]);

  const iconUrl = weather?.icon ? `${ICON_BASE}${weather.icon}@2x.png` : "";

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-2 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Weather</p>
          <h1 className="text-3xl font-semibold">City Conditions</h1>
          <p className="text-sm text-slate-500">Live data powered by OpenWeatherMap</p>
        </header>

        {!hasKey && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Add your API key in a `.env` file as `VITE_OPENWEATHER_API_KEY=YOUR_KEY` and restart the dev server.
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery((prev) => prev.trim());
            }}
          >
            <label className="sr-only" htmlFor="city-input">
              Search city
            </label>
            <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-slate-500">🔍</span>
              <input
                id="city-input"
                className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none"
                placeholder="Search city..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Search
            </button>
          </form>

          <p
            className={`mt-2 text-sm ${
              status === "loading" ? "text-slate-600" : status === "error" ? "text-rose-600" : "text-slate-500"
            }`}
            aria-live="polite"
            aria-atomic="true"
          >
            {message}
          </p>
        </div>

        {weather && (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Current location</p>
                <h2 className="text-2xl font-semibold">{weather.city}</h2>
                <p className="text-sm capitalize text-slate-500">{weather.description}</p>
              </div>
              <div className="flex items-center gap-3">
                {iconUrl ? (
                  <img src={iconUrl} alt={weather.description} className="h-16 w-16" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-slate-100" />
                )}
                <div className="text-5xl font-semibold leading-none text-slate-900">
                  {formatTemperature(weather.temp)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Highlight label="Temperature" value={formatTemperature(weather.temp)} />
              <Highlight label="Humidity" value={formatHumidity(weather.humidity)} />
              <Highlight label="Feels like" value={formatTemperature(weather.temp)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <h3 className="font-semibold text-slate-800">Chance of rain (est.)</h3>
                <span>Based on humidity</span>
              </div>
              <div className="space-y-2">
                {chanceBars.map((bar) => (
                  <div key={bar.label} className="space-y-1 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>{bar.label}</span>
                      <span>{Math.round(bar.value)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{ width: `${bar.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Highlight({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900 capitalize">{value}</p>
    </div>
  );
}
