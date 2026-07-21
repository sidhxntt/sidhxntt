"use client";

export const FALLBACK = { lat: 12.97, lon: 77.59, city: "Bangalore" };

const WMO: [number[], string, string][] = [
  [[0], "☀️", "Clear"],
  [[1, 2], "🌤️", "Partly Cloudy"],
  [[3], "☁️", "Cloudy"],
  [[45, 48], "🌫️", "Fog"],
  [[51, 53, 55, 56, 57], "🌦️", "Drizzle"],
  [[61, 63, 65, 66, 67], "🌧️", "Rain"],
  [[71, 73, 75, 77, 85, 86], "🌨️", "Snow"],
  [[80, 81, 82], "🌧️", "Showers"],
  [[95, 96, 99], "⛈️", "Thunderstorm"],
];

export function describeWeather(code: number): { icon: string; label: string } {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { icon: hit[1], label: hit[2] } : { icon: "🌡️", label: "Weather" };
}

export type HourlyEntry = { time: string; temp: number; code: number };
export type DailyEntry = { date: string; code: number; high: number; low: number };

export type WeatherData = {
  city: string;
  temp: number;
  code: number;
  high: number;
  low: number;
  hourly: HourlyEntry[];
  daily: DailyEntry[];
};

// ── Tiny module cache (last coords + result, 10 min TTL) ──────────────

const CACHE_TTL = 10 * 60 * 1000;
let cache: { key: string; data: WeatherData; at: number } | null = null;

function cacheKey(coords: { lat: number; lon: number } | null): string {
  return coords ? `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}` : "fallback";
}

export async function fetchWeather(
  coords: { lat: number; lon: number } | null,
): Promise<WeatherData> {
  const key = cacheKey(coords);
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL) {
    return cache.data;
  }

  const { lat, lon } = coords ?? FALLBACK;

  const [forecastRes, geoRes] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`,
    ),
    coords
      ? fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!forecastRes.ok) throw new Error("Weather request failed");
  const forecast = await forecastRes.json();

  let city = FALLBACK.city;
  if (geoRes?.ok) {
    try {
      const geo = await geoRes.json();
      city = geo.city || geo.locality || geo.principalSubdivision || city;
    } catch {
      // keep fallback city
    }
  }

  // Hourly: entries from now onward, 12 of them (one per hour).
  const hourly: HourlyEntry[] = [];
  const now = Date.now();
  const hTimes: string[] = forecast.hourly.time;
  const hTemps: number[] = forecast.hourly.temperature_2m;
  const hCodes: number[] = forecast.hourly.weather_code;
  for (let i = 0; i < hTimes.length && hourly.length < 12; i++) {
    if (new Date(hTimes[i]).getTime() >= now - 30 * 60 * 1000) {
      hourly.push({ time: hTimes[i], temp: Math.round(hTemps[i]), code: hCodes[i] });
    }
  }

  const daily: DailyEntry[] = (forecast.daily.time as string[]).map((date, i) => ({
    date,
    code: forecast.daily.weather_code[i],
    high: Math.round(forecast.daily.temperature_2m_max[i]),
    low: Math.round(forecast.daily.temperature_2m_min[i]),
  }));

  const data: WeatherData = {
    city,
    temp: Math.round(forecast.current.temperature_2m),
    code: forecast.current.weather_code,
    high: daily[0]?.high ?? Math.round(forecast.current.temperature_2m),
    low: daily[0]?.low ?? Math.round(forecast.current.temperature_2m),
    hourly,
    daily,
  };

  cache = { key, data, at: Date.now() };
  return data;
}
