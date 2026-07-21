import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2026-07-20T12:00:00Z").getTime();
const HOUR = 3_600_000;

const iso = (t: number) => new Date(t).toISOString();

/** A minimal open-meteo payload: 24 hourly entries starting 2h in the past. */
function forecastPayload() {
  const times: string[] = [];
  const temps: number[] = [];
  const codes: number[] = [];
  for (let i = -2; i < 22; i++) {
    times.push(iso(NOW + i * HOUR));
    temps.push(20 + i + 0.4);
    codes.push(1);
  }
  return {
    current: { temperature_2m: 21.6, weather_code: 2 },
    hourly: { time: times, temperature_2m: temps, weather_code: codes },
    daily: {
      time: ["2026-07-20", "2026-07-21", "2026-07-22"],
      weather_code: [2, 61, 95],
      temperature_2m_max: [30.4, 28.6, 25.1],
      temperature_2m_min: [21.5, 20.4, 18.9],
    },
  };
}

const ok = (body: unknown) => ({ ok: true, json: async () => body });

type Weather = typeof import("@/lib/weather");
let weather: Weather;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.resetModules(); // fresh module cache (10-minute TTL lives at module scope)
  weather = await import("@/lib/weather");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("describeWeather", () => {
  it.each([
    [0, "☀️", "Clear"],
    [1, "🌤️", "Partly Cloudy"],
    [2, "🌤️", "Partly Cloudy"],
    [3, "☁️", "Cloudy"],
    [45, "🌫️", "Fog"],
    [48, "🌫️", "Fog"],
    [51, "🌦️", "Drizzle"],
    [57, "🌦️", "Drizzle"],
    [61, "🌧️", "Rain"],
    [67, "🌧️", "Rain"],
    [71, "🌨️", "Snow"],
    [86, "🌨️", "Snow"],
    [80, "🌧️", "Showers"],
    [82, "🌧️", "Showers"],
    [95, "⛈️", "Thunderstorm"],
    [99, "⛈️", "Thunderstorm"],
  ])("code %i → %s %s", (code, icon, label) => {
    expect(weather.describeWeather(code)).toEqual({ icon, label });
  });

  it("unknown codes get the generic fallback", () => {
    expect(weather.describeWeather(42)).toEqual({ icon: "🌡️", label: "Weather" });
    expect(weather.describeWeather(-1)).toEqual({ icon: "🌡️", label: "Weather" });
  });
});

describe("fetchWeather", () => {
  it("maps the forecast + reverse-geocode response", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("open-meteo")
        ? ok(forecastPayload())
        : ok({ city: "Berlin", locality: "Mitte" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await weather.fetchWeather({ lat: 52.52, lon: 13.405 });

    expect(data.city).toBe("Berlin");
    expect(data.temp).toBe(22); // 21.6 rounded
    expect(data.code).toBe(2);
    expect(data.high).toBe(30); // daily[0] rounded
    expect(data.low).toBe(22); // 21.5 rounds to 22
    expect(data.daily).toHaveLength(3);
    expect(data.daily[1]).toEqual({ date: "2026-07-21", code: 61, high: 29, low: 20 });
    // requested coords are embedded in the forecast URL
    expect(fetchMock.mock.calls[0][0]).toContain("latitude=52.52&longitude=13.405");
  });

  it("keeps 12 hourly entries, dropping hours more than 30 min in the past", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.includes("open-meteo") ? ok(forecastPayload()) : ok({}))),
    );

    const data = await weather.fetchWeather({ lat: 1, lon: 2 });

    expect(data.hourly).toHaveLength(12);
    // the -2h and -1h entries are gone; the "now" hour survives
    expect(data.hourly[0].time).toBe(iso(NOW));
    expect(data.hourly[0].temp).toBe(20); // 20.4 rounded
    expect(data.hourly[11].time).toBe(iso(NOW + 11 * HOUR));
  });

  it("uses the fallback location and skips geocoding when coords are null", async () => {
    const fetchMock = vi.fn(async (_url: string) => ok(forecastPayload()));
    vi.stubGlobal("fetch", fetchMock);

    const data = await weather.fetchWeather(null);

    expect(data.city).toBe(weather.FALLBACK.city);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no reverse-geocode call
    expect(fetchMock.mock.calls[0][0]).toContain(`latitude=${weather.FALLBACK.lat}`);
  });

  it("falls back to the default city when reverse geocoding rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("open-meteo")) return ok(forecastPayload());
        throw new Error("network down");
      }),
    );

    const data = await weather.fetchWeather({ lat: 10, lon: 20 });
    expect(data.city).toBe(weather.FALLBACK.city);
  });

  it("falls back to the default city when the geo body is unparseable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("open-meteo")
          ? ok(forecastPayload())
          : { ok: true, json: async () => Promise.reject(new Error("bad json")) },
      ),
    );

    const data = await weather.fetchWeather({ lat: 10, lon: 20 });
    expect(data.city).toBe(weather.FALLBACK.city);
  });

  it("prefers city, then locality, then principalSubdivision", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("open-meteo")
          ? ok(forecastPayload())
          : ok({ city: "", locality: "Shibuya", principalSubdivision: "Tokyo" }),
      ),
    );

    const data = await weather.fetchWeather({ lat: 35, lon: 139 });
    expect(data.city).toBe("Shibuya");
  });

  it("throws when the forecast request is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    await expect(weather.fetchWeather(null)).rejects.toThrow("Weather request failed");
  });

  it("propagates a forecast network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("timeout"))));
    await expect(weather.fetchWeather(null)).rejects.toThrow("timeout");
  });

  it("caches by coordinates for 10 minutes", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("open-meteo") ? ok(forecastPayload()) : ok({ city: "Berlin" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await weather.fetchWeather({ lat: 52.52, lon: 13.405 });
    const callsAfterFirst = fetchMock.mock.calls.length;
    const second = await weather.fetchWeather({ lat: 52.52, lon: 13.405 });

    expect(second).toBe(first); // same object, straight from cache
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);

    // different coords bypass the cache
    await weather.fetchWeather({ lat: 48.85, lon: 2.35 });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it("refetches once the TTL expires", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("open-meteo") ? ok(forecastPayload()) : ok({ city: "Berlin" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await weather.fetchWeather(null);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(NOW + 11 * 60 * 1000); // past the 10-minute TTL
    await weather.fetchWeather(null);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
