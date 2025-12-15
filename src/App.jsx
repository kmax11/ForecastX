import { useEffect, useMemo, useState } from "react";

// Open-Meteo requires no API key. We'll query by latitude/longitude.
// Simple caches to reduce API calls (TTL: 10 minutes). Weather and geocode results are persisted to localStorage.
const CACHE_TTL_MS = 10 * 60 * 1000;
// Minimum gap between network calls per coordinate to avoid hammering the API
const MIN_REQUEST_INTERVAL_MS = 15 * 1000;
const STORAGE_VERSION = "v1"; // bump to invalidate old cache shape
const weatherCache = loadCacheFromStorage("weatherCache"); // key: `${lat},${lon}`, value: { data, ts }
const requestLog = new Map(); // key: `${lat},${lon}`, value: last request timestamp
const geocodeCache = loadCacheFromStorage("geocodeCache"); // key: query(lowercase), value: { data, ts }

const initialCoords = { lat: 52.52, lon: 13.41 }; // Berlin

function loadCacheFromStorage(name) {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(`${STORAGE_VERSION}:${name}`);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    const map = new Map();
    parsed.forEach(([k, v]) => {
      if (v?.ts && Date.now() - v.ts < CACHE_TTL_MS * 2) {
        map.set(k, v);
      }
    });
    return map;
  } catch (err) {
    return new Map();
  }
}

function persistCache(map, name, maxEntries = 12) {
  if (typeof window === "undefined") return;
  const entries = Array.from(map.entries())
    .sort((a, b) => (b[1]?.ts ?? 0) - (a[1]?.ts ?? 0))
    .slice(0, maxEntries);
  try {
    localStorage.setItem(`${STORAGE_VERSION}:${name}`, JSON.stringify(entries));
  } catch (err) {
    // Ignore storage errors (quota, private mode)
  }
}

function formatTemperature(value) {
  return `${Math.round(value)}°C`;
}

function formatHumidity(value) {
  return `${Math.round(value)}%`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function fetchCoordsByName(name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a city or address to search.");
  const key = trimmed.toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(url.toString(), { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Geocoding timed out. Please try again.");
    }
    throw new Error("Network error while searching for that place.");
  }
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error("Unable to search for that place.");
  }
  const data = await res.json();
  const first = data.results?.[0];
  if (!first) {
    throw new Error("No matches found. Try another place or add more detail.");
  }

  const normalized = {
    lat: first.latitude,
    lon: first.longitude,
    label: `${first.name}${first.admin1 ? `, ${first.admin1}` : ""}, ${first.country_code}`,
  };
  geocodeCache.set(key, { data: normalized, ts: Date.now() });
  persistCache(geocodeCache, "geocodeCache");
  return normalized;
}

async function fetchWeatherByCoords(lat, lon) {
  const key = `${lat},${lon}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const now = Date.now();
  const lastRequest = requestLog.get(key) ?? 0;
  const elapsed = now - lastRequest;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const waitSeconds = Math.ceil((MIN_REQUEST_INTERVAL_MS - elapsed) / 1000);
    throw new Error(`Please wait ~${waitSeconds}s before retrying this location.`);
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current_weather", "true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(url.toString(), { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error("Network error while fetching weather.");
  }
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error("Unable to fetch weather");
  }
  const data = await res.json();
  const cw = data.current_weather || {};
  const normalized = {
    location: { lat: data.latitude, lon: data.longitude },
    temp: cw.temperature,
    windspeed: cw.windspeed,
    winddirection: cw.winddirection,
    weathercode: cw.weathercode,
    time: cw.time,
    humidity: data.hourly?.relativehumidity_2m?.[0] ?? null, // may be null if not requested
    description: mapWeatherCode(cw.weathercode),
  };
  weatherCache.set(key, { data: normalized, ts: Date.now() });
  persistCache(weatherCache, "weatherCache");
  requestLog.set(key, Date.now());
  return normalized;
}

function mapWeatherCode(code) {
  const table = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return table[code] ?? "-";
}

export default function App() {
  const [query, setQuery] = useState("Berlin");
  const [lat, setLat] = useState(initialCoords.lat);
  const [lon, setLon] = useState(initialCoords.lon);
  const [locationLabel, setLocationLabel] = useState("Berlin, DE");
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Search a city or address to get started.");

  const chanceBars = useMemo(() => {
    if (!weather) return [];
    const base = clamp((weather.humidity ?? 40), 5, 95);
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
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setWeather(null);
      setStatus("idle");
      setMessage("Enter a valid place.");
      return;
    }

    setStatus("loading");
    setMessage("Fetching weather...");

    const handle = setTimeout(async () => {
      try {
        const data = await fetchWeatherByCoords(lat, lon);
        setWeather(data);
        setStatus("success");
        setMessage(
          locationLabel ? `Showing weather for ${locationLabel}.` : `Showing weather for lat ${lat}, lon ${lon}.`
        );
      } catch (error) {
        setWeather(null);
        setStatus("error");
        setMessage(error.message);
      }
    }, 450);

    return () => clearTimeout(handle);
  }, [lat, lon, locationLabel]);

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-2 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Weather</p>
          <h1 className="text-3xl font-semibold">Current Conditions</h1>
          <p className="text-sm text-slate-500">Live data powered by Open‑Meteo</p>
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              setStatus("loading");
              setMessage("Searching location...");
              try {
                const result = await fetchCoordsByName(query);
                setLat(result.lat);
                setLon(result.lon);
                setLocationLabel(result.label);
              } catch (error) {
                setStatus("error");
                setMessage(error.message);
              }
            }}
          >
            <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-slate-500">🔍</span>
              <input
                className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none"
                placeholder="Search city or address (e.g., Paris)"
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
                <h2 className="text-2xl font-semibold">
                  {locationLabel || `lat ${weather.location.lat}, lon ${weather.location.lon}`}
                </h2>
                <p className="text-sm capitalize text-slate-500">{weather.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-5xl font-semibold leading-none text-slate-900">
                  {formatTemperature(weather.temp)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Highlight label="Temperature" value={formatTemperature(weather.temp)} />
              {weather.humidity != null && (
                <Highlight label="Humidity" value={formatHumidity(weather.humidity)} />
              )}
              <Highlight label="Wind" value={`${Math.round(weather.windspeed)} km/h`} />
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
