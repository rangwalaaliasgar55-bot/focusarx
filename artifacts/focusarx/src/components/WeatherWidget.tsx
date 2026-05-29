import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, RefreshCw } from "lucide-react";

const CITY_KEY = "focusarx-weather-city";

type WeatherState = "clear_skies" | "flow_state_incoming" | "partly_cloudy" | "fog" | "storm_warning";

type Forecast = {
  state: WeatherState;
  emoji: string;
  label: string;
  tagline: string;
  recommendedSessionMin: number;
  recommendedBlocks: number;
  color: string;
};

type FocusData = {
  forecast: Forecast;
  score: number;
  readinessScore: number;
  currentStreak: number;
};

type RealWeather = {
  temp: number;
  feelsLike: number;
  condition: string;
  icon: string;
  city: string;
  windKph: number;
};

function weatherCodeToInfo(code: number): { icon: string; condition: string } {
  if (code === 0) return { icon: "☀️", condition: "Clear sky" };
  if (code <= 3) return { icon: "⛅", condition: "Partly cloudy" };
  if (code <= 48) return { icon: "🌫️", condition: "Foggy" };
  if (code <= 57) return { icon: "🌦️", condition: "Drizzle" };
  if (code <= 67) return { icon: "🌧️", condition: "Rain" };
  if (code <= 77) return { icon: "🌨️", condition: "Snow" };
  if (code <= 82) return { icon: "🌦️", condition: "Rain showers" };
  if (code <= 86) return { icon: "🌨️", condition: "Snow showers" };
  return { icon: "⛈️", condition: "Thunderstorm" };
}

async function fetchWeatherForCity(city: string): Promise<RealWeather | null> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json() as { results?: Array<{ latitude: number; longitude: number; name: string }> };
    const loc = geoData.results?.[0];
    if (!loc) return null;

    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&wind_speed_unit=mph&temperature_unit=celsius`
    );
    const wxData = await wxRes.json() as {
      current?: {
        temperature_2m: number;
        apparent_temperature: number;
        weather_code: number;
        wind_speed_10m: number;
      };
    };
    const cur = wxData.current;
    if (!cur) return null;

    const { icon, condition } = weatherCodeToInfo(cur.weather_code);
    return {
      temp: Math.round(cur.temperature_2m),
      feelsLike: Math.round(cur.apparent_temperature),
      condition,
      icon,
      city: loc.name,
      windKph: Math.round(cur.wind_speed_10m),
    };
  } catch {
    return null;
  }
}

function WeatherCanvas({ state, color }: { state: WeatherState; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    particlesRef.current = Array.from({ length: state === "storm_warning" ? 80 : state === "fog" ? 30 : 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: state === "storm_warning" ? -1.5 - Math.random() * 2 : (Math.random() - 0.5) * 0.3,
      vy: state === "storm_warning" ? 2 + Math.random() * 3 : state === "fog" ? 0.1 : 0.3 + Math.random() * 0.4,
      size: state === "storm_warning" ? 1.5 : state === "fog" ? 8 + Math.random() * 12 : 2 + Math.random() * 3,
      opacity: state === "fog" ? 0.03 + Math.random() * 0.05 : 0.4 + Math.random() * 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particlesRef.current) {
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = state === "storm_warning" ? "#60A5FA" :
          state === "flow_state_incoming" ? color :
          state === "clear_skies" ? "#FCD34D" : "#94A3B8";
        if (state === "fog") {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (state === "storm_warning") {
          ctx.fillRect(p.x, p.y, 1, p.size * 4);
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y > H + 10) p.y = -10;
      }
      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [state, color]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={160}
      className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
    />
  );
}

function LocationPrompt({ onSave }: { onSave: (city: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) { setError("Please enter a city name"); return; }
    onSave(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[var(--card)] p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={14} className="text-[#7C3AED]" />
        <p className="text-xs font-semibold text-[#E2E8F0]">Where are you located?</p>
      </div>
      <p className="text-[11px] text-[#4B5563] mb-4">
        Enter your city to show real weather conditions alongside your focus forecast.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setError(""); }}
          placeholder="e.g. London, New York, Mumbai…"
          className="flex-1 rounded-xl border border-[rgba(124,58,237,0.25)] bg-[rgba(124,58,237,0.05)] px-3 py-2 text-xs text-[#E2E8F0] placeholder-[#3a3d4a] outline-none focus:border-[#7C3AED] transition-colors"
        />
        <button
          type="submit"
          className="rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D28D9] transition-colors"
        >
          Save
        </button>
      </form>
      {error && <p className="mt-2 text-[10px] text-rose-400">{error}</p>}
    </motion.div>
  );
}

export default function WeatherWidget() {
  const { status } = useAuth();
  const [focusData, setFocusData] = useState<FocusData | null>(null);
  const [realWeather, setRealWeather] = useState<RealWeather | null>(null);
  const [city, setCity] = useState<string | null>(() => localStorage.getItem(CITY_KEY));
  const [loadingFocus, setLoadingFocus] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState(false);
  const [meetings, setMeetings] = useState(0);
  const [editingCity, setEditingCity] = useState(false);

  const token = () => localStorage.getItem("focusarx-auth-token");

  const loadFocus = (m = meetings) => {
    setLoadingFocus(true);
    fetch(`/api/focus-weather?meetings=${m}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then((d: FocusData) => setFocusData(d))
      .catch(() => {})
      .finally(() => setLoadingFocus(false));
  };

  const loadWeather = async (cityName: string) => {
    setLoadingWeather(true);
    setWeatherError(false);
    const result = await fetchWeatherForCity(cityName);
    setLoadingWeather(false);
    if (!result) {
      setWeatherError(true);
    } else {
      setRealWeather(result);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoadingFocus(false); return; }
    loadFocus();
  }, [status]);

  useEffect(() => {
    if (city) loadWeather(city);
  }, [city]);

  const handleSaveCity = (newCity: string) => {
    localStorage.setItem(CITY_KEY, newCity);
    setCity(newCity);
    setEditingCity(false);
  };

  const handleClearCity = () => {
    localStorage.removeItem(CITY_KEY);
    setCity(null);
    setRealWeather(null);
    setWeatherError(false);
  };

  if (status === "unauthenticated") return null;

  if (!city || editingCity) {
    return (
      <div className="space-y-3">
        {editingCity && (
          <div className="flex justify-end">
            <button onClick={() => setEditingCity(false)} className="text-[10px] text-[#4B5563] hover:text-[#94A3B8] flex items-center gap-1">
              <X size={10} /> Cancel
            </button>
          </div>
        )}
        <LocationPrompt onSave={handleSaveCity} />
        {!editingCity && loadingFocus && (
          <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 h-[80px] flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
          </div>
        )}
      </div>
    );
  }

  if (loadingFocus) {
    return (
      <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 h-[160px] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
      </div>
    );
  }

  if (!focusData) return null;

  const { forecast } = focusData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl border overflow-hidden"
      style={{
        borderColor: `${forecast.color}33`,
        background: `linear-gradient(135deg, ${forecast.color}0D 0%, transparent 60%)`,
        minHeight: 160,
      }}
    >
      <WeatherCanvas state={forecast.state} color={forecast.color} />

      <div className="relative z-10 p-5 space-y-3">
        {/* Focus Forecast row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{forecast.emoji}</span>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#4B5563]">Focus Forecast</p>
                <p className="text-base font-bold" style={{ color: forecast.color }}>{forecast.label}</p>
              </div>
            </div>
            <p className="text-xs text-[#94A3B8]">{forecast.tagline}</p>
            <div className="flex gap-3 mt-1.5">
              <span className="text-[10px] text-[#4B5563]">
                Rec: <span className="font-semibold text-[#E2E8F0]">{forecast.recommendedSessionMin}m blocks</span>
              </span>
              <span className="text-[10px] text-[#4B5563]">
                × <span className="font-semibold text-[#E2E8F0]">{forecast.recommendedBlocks}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div
              className="rounded-xl px-3 py-1 text-xs font-bold"
              style={{ background: `${forecast.color}1A`, color: forecast.color }}
            >
              Score {focusData.score}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[#4B5563]">Meetings:</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => { setMeetings(n); loadFocus(n); }}
                    className={`w-5 h-5 rounded text-[9px] font-bold transition-all ${meetings === n ? "text-white" : "text-[#4B5563]"}`}
                    style={meetings === n ? { background: forecast.color } : { background: "rgba(124,58,237,0.08)" }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5" />

        {/* Real weather row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={10} className="text-[#4B5563] shrink-0" />
            <span className="text-[10px] text-[#4B5563]">{realWeather?.city ?? city}</span>
          </div>

          <div className="flex items-center gap-3">
            {loadingWeather && (
              <div className="h-4 w-4 animate-spin rounded-full border border-[rgba(124,58,237,0.3)] border-t-[#7C3AED]" />
            )}
            {!loadingWeather && weatherError && (
              <span className="text-[10px] text-rose-400">City not found</span>
            )}
            {!loadingWeather && realWeather && (
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{realWeather.icon}</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#E2E8F0]">{realWeather.temp}°C</p>
                  <p className="text-[9px] text-[#4B5563]">{realWeather.condition}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => city && loadWeather(city)}
                className="rounded-lg p-1 text-[#4B5563] hover:text-[#94A3B8] transition-colors"
                title="Refresh weather"
              >
                <RefreshCw size={10} />
              </button>
              <button
                onClick={() => setEditingCity(true)}
                className="text-[9px] text-[#4B5563] hover:text-[#A78BFA] transition-colors underline underline-offset-2"
              >
                Change city
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
