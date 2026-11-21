import { useEffect, useMemo, useState } from "react";
import "./App.css";

const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, options).format(date);

const toDateTimeLocalValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getMinutesInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const second = Number(
    parts.find((part) => part.type === "second")?.value ?? 0,
  );
  return hour * 60 + minute + second / 60;
};

const getDayOfYearInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone,
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return Math.floor(
    (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000,
  );
};

const getDateKeyInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
};

const getDatePartsInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone,
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
};

const getAnalemmaPoint = (dayOfYear: number) => {
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    (0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma)) *
    (180 / Math.PI);
  return { equationOfTime, declination };
};

const mapAnalemmaPoint = (point: ReturnType<typeof getAnalemmaPoint>) => ({
  x: 170 + (point.equationOfTime / 18) * 145,
  y: 80 - (point.declination / 25) * 62,
});

const getAnalemmaPath = () =>
  Array.from({ length: 365 }, (_, index) =>
    mapAnalemmaPoint(getAnalemmaPoint(index + 1)),
  )
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");

const getMoonPhase = (date: Date) => {
  const knownNewMoon = new Date("2000-01-06T18:14:00Z").getTime();
  const lunarMonth = 29.530588853 * 86400000;
  const age =
    (((date.getTime() - knownNewMoon) % lunarMonth) + lunarMonth) % lunarMonth;
  const phase = age / lunarMonth;
  if (phase < 0.03 || phase > 0.97) return { name: "New moon", icon: "●", age };
  if (phase < 0.24) return { name: "Waxing crescent", icon: "◐", age };
  if (phase < 0.27) return { name: "First quarter", icon: "◑", age };
  if (phase < 0.49) return { name: "Waxing gibbous", icon: "◕", age };
  if (phase < 0.53) return { name: "Full moon", icon: "○", age };
  if (phase < 0.74) return { name: "Waning gibbous", icon: "◖", age };
  if (phase < 0.77) return { name: "Last quarter", icon: "◒", age };
  return { name: "Waning crescent", icon: "◓", age };
};

const getYearProgressInTimeZone = (date: Date, timeZone: string) => {
  const { year } = getDatePartsInTimeZone(date, timeZone);
  const dayOfYear = getDayOfYearInTimeZone(date, timeZone);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInYear = leapYear ? 366 : 365;
  return {
    progress: Math.round((dayOfYear / daysInYear) * 100),
    daysRemain: daysInYear - dayOfYear,
  };
};

const getSolarLongitude = (dayOfYear: number) => {
  const longitude = ((dayOfYear - 80) * (360 / 365) + 360) % 360;
  return longitude;
};

const getZodiacPosition = (dayOfYear: number) => {
  const signs = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
  ];
  const longitude = getSolarLongitude(dayOfYear);
  const index = Math.floor(longitude / 30);
  const degrees = longitude - index * 30;
  const wholeDegrees = Math.floor(degrees);
  const minutes = Math.round((degrees - wholeDegrees) * 60);
  return {
    sign: signs[index],
    position: `${wholeDegrees}° ${String(minutes).padStart(2, "0")}′`,
    longitude,
  };
};

const getSolarAltitude = (latitude: number, dayOfYear: number) => {
  const declination = getAnalemmaPoint(dayOfYear).declination;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const declinationRadians = (declination * Math.PI) / 180;
  const altitude =
    (Math.asin(
      Math.sin(latitudeRadians) * Math.sin(declinationRadians) +
        Math.cos(latitudeRadians) * Math.cos(declinationRadians),
    ) *
      180) /
    Math.PI;
  const wholeDegrees = Math.max(0, Math.round(altitude));
  return `${wholeDegrees}°`;
};

const formatSignedDuration = (minutes: number) => {
  if (minutes === 0) return "No change";
  const absolute = Math.abs(minutes);
  const sign = minutes > 0 ? "+" : "-";
  return `${sign}${Math.floor(absolute / 60) ? `${Math.floor(absolute / 60)}h ` : ""}${absolute % 60}m`;
};

type Location = {
  name: string;
  latitude: string;
  longitude: string;
  latitudeValue: number;
  longitudeValue: number;
  sunrise: string;
  sunset: string;
  solarNoon: string;
  daylight: string;
  timeZone: string;
  daylightChange?: number;
};

const locations: Location[] = [
  {
    name: "New York, NY",
    latitude: "40° 42′ 46″ N",
    longitude: "74° 00′ 21″ W",
    latitudeValue: 40.7128,
    longitudeValue: -74.006,
    sunrise: "06:24",
    sunset: "19:18",
    solarNoon: "13:04",
    daylight: "12h 54m",
    timeZone: "America/New_York",
  },
  {
    name: "London, UK",
    latitude: "51° 30′ 26″ N",
    longitude: "00° 07′ 39″ W",
    latitudeValue: 51.5074,
    longitudeValue: -0.1278,
    sunrise: "06:17",
    sunset: "19:32",
    solarNoon: "12:54",
    daylight: "13h 15m",
    timeZone: "Europe/London",
  },
  {
    name: "Tokyo, Japan",
    latitude: "35° 41′ 23″ N",
    longitude: "139° 41′ 30″ E",
    latitudeValue: 35.6762,
    longitudeValue: 139.6503,
    sunrise: "05:18",
    sunset: "18:01",
    solarNoon: "11:40",
    daylight: "12h 43m",
    timeZone: "Asia/Tokyo",
  },
  {
    name: "Sydney, Australia",
    latitude: "33° 52′ 04″ S",
    longitude: "151° 12′ 26″ E",
    latitudeValue: -33.8688,
    longitudeValue: 151.2093,
    sunrise: "05:59",
    sunset: "17:37",
    solarNoon: "11:48",
    daylight: "11h 38m",
    timeZone: "Australia/Sydney",
  },
];

type TemperaturePoint = { date: string; temperature: number };
type TemperatureSeries = { year: number; points: TemperaturePoint[] };

const getDayNumber = (date: string) => {
  const value = new Date(`${date}T12:00:00Z`);
  return Math.floor(
    (Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) -
      Date.UTC(value.getUTCFullYear(), 0, 1)) /
      86400000,
  );
};

const smoothTemperatures = (points: TemperaturePoint[]) =>
  points.map((point, index) => {
    const window = points.slice(Math.max(0, index - 3), index + 4);
    return {
      ...point,
      temperature:
        window.reduce((sum, item) => sum + item.temperature, 0) / window.length,
    };
  });

const fetchTemperatureHistory = async (location: Location, dateKey: string) => {
  const currentYear = Number(dateKey.slice(0, 4));
  const today = dateKey;
  const years = [currentYear - 2, currentYear - 1, currentYear];
  const results = await Promise.all(
    years.map(async (year) => {
      const endDate = year === currentYear ? today : `${year}-12-31`;
      const params = new URLSearchParams({
        latitude: String(location.latitudeValue),
        longitude: String(location.longitudeValue),
        start_date: `${year}-01-01`,
        end_date: endDate,
        daily: "temperature_2m_mean",
        temperature_unit: "fahrenheit",
        timezone: "auto",
      });
      const response = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?${params}`,
      );
      if (!response.ok) throw new Error("Temperature history unavailable");
      const data = (await response.json()) as {
        daily?: { time?: string[]; temperature_2m_mean?: (number | null)[] };
      };
      const dates = data.daily?.time ?? [];
      const temperatures = data.daily?.temperature_2m_mean ?? [];
      return {
        year,
        points: smoothTemperatures(
          dates.flatMap((date, index) => {
            const temperature = temperatures[index];
            return temperature == null ? [] : [{ date, temperature }];
          }),
        ),
      };
    }),
  );
  return results;
};

function TemperatureHistoryPanel({
  location,
  dateKey,
}: {
  location: Location;
  dateKey: string;
}) {
  const [series, setSeries] = useState<TemperatureSeries[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const currentYear = Number(dateKey.slice(0, 4));

  useEffect(() => {
    const controller = new AbortController();
    fetchTemperatureHistory(location, dateKey)
      .then((history) => {
        if (!controller.signal.aborted) {
          setSeries(history);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [location, dateKey]);

  const chart = { left: 42, right: 708, top: 22, bottom: 218 };
  const values = series.flatMap((item) =>
    item.points.map((point) => point.temperature),
  );
  const minimum = values.length ? Math.floor(Math.min(...values) / 5) * 5 : 0;
  const maximum = values.length ? Math.ceil(Math.max(...values) / 5) * 5 : 80;
  const range = Math.max(10, maximum - minimum);
  const xForDate = (date: string) =>
    chart.left + (getDayNumber(date) / 365) * (chart.right - chart.left);
  const yForTemperature = (temperature: number) =>
    chart.bottom -
    ((temperature - minimum) / range) * (chart.bottom - chart.top);
  const pathForSeries = (item: TemperatureSeries) =>
    item.points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${xForDate(point.date).toFixed(1)} ${yForTemperature(point.temperature).toFixed(1)}`,
      )
      .join(" ");
  const currentSeries = series.find((item) => item.year === currentYear);
  const currentPoint = currentSeries?.points.at(-1);
  const monthLabels = [
    ["JAN", 0],
    ["FEB", 31],
    ["MAR", 59],
    ["APR", 90],
    ["MAY", 120],
    ["JUN", 151],
    ["JUL", 181],
    ["AUG", 212],
    ["SEP", 243],
    ["OCT", 273],
    ["NOV", 304],
    ["DEC", 334],
  ] as const;

  return (
    <article className="temperature-panel">
      <div className="temperature-heading">
        <div>
          <p className="card-label">DAILY AVERAGE TEMPERATURE</p>
          <h2>{location.name}</h2>
        </div>
        <div className="temperature-legend" aria-label="Chart legend">
          {series.map((item, index) => (
            <span key={item.year} className={index === 2 ? "current" : ""}>
              <i /> {item.year}
            </span>
          ))}
        </div>
      </div>
      {status === "loading" && (
        <p className="temperature-status">LOADING CLIMATE RECORD</p>
      )}
      {status === "error" && (
        <p className="temperature-status">
          TEMPERATURE HISTORY IS CURRENTLY UNAVAILABLE
        </p>
      )}
      {status === "ready" && (
        <svg
          className="temperature-chart"
          viewBox="0 0 750 270"
          role="img"
          aria-label={`Daily average temperature history for ${location.name}`}
        >
          {monthLabels.map(([label, day]) => {
            const x = chart.left + (day / 365) * (chart.right - chart.left);
            return (
              <g key={label}>
                <line className="temperature-grid" x1={x} y1={chart.top} x2={x} y2={chart.bottom} />
                <text className="temperature-axis-label" x={x} y="244" textAnchor="middle">
                  {label}
                </text>
              </g>
            );
          })}
          {[minimum, minimum + range / 2, maximum].map((value) => {
            const y = yForTemperature(value);
            return (
              <g key={value}>
                <line className="temperature-grid horizontal" x1={chart.left} y1={y} x2={chart.right} y2={y} />
                <text className="temperature-axis-label" x="3" y={y + 3}>
                  {Math.round(value)}°
                </text>
              </g>
            );
          })}
          {series.map((item, index) => (
            <path
              key={item.year}
              className={`temperature-line ${index === 2 ? "current" : "historical"}`}
              d={pathForSeries(item)}
            />
          ))}
          {currentPoint && (
            <circle
              className="temperature-current-point"
              cx={xForDate(currentPoint.date)}
              cy={yForTemperature(currentPoint.temperature)}
              r="5"
            />
          )}
        </svg>
      )}
      <div className="temperature-caption">
        <span>7-DAY MOVING AVERAGE</span>
        <small>{currentPoint ? `CURRENT THROUGH ${currentPoint.date}` : "JAN — DEC"}</small>
      </div>
    </article>
  );
}

function MetricCard({
  eyebrow,
  value,
  detail,
  className = "",
}: {
  eyebrow: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <article className={`metric-card ${className}`}>
      <p className="card-label">{eyebrow}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </article>
  );
}

function SolarPath({
  now,
  location,
}: {
  now: Date;
  location: (typeof locations)[number];
}) {
  const [sunriseHour, sunriseMinute] = location.sunrise.split(":").map(Number);
  const [sunsetHour, sunsetMinute] = location.sunset.split(":").map(Number);
  const minutes = getMinutesInTimeZone(now, location.timeZone);
  const sunrise = sunriseHour * 60 + sunriseMinute;
  const sunset = sunsetHour * 60 + sunsetMinute;
  const progress = Math.max(
    0,
    Math.min(1, (minutes - sunrise) / (sunset - sunrise)),
  );
  const sunX = 26 + progress * 288;
  const sunY = 118 - Math.sin(progress * Math.PI) * 79;
  const analemmaPath = getAnalemmaPath();
  const currentAnalemmaPoint = mapAnalemmaPoint(
    getAnalemmaPoint(getDayOfYearInTimeZone(now, location.timeZone)),
  );
  const dayOfYear = getDayOfYearInTimeZone(now, location.timeZone);
  const zodiac = getZodiacPosition(dayOfYear);
  const altitude = getSolarAltitude(location.latitudeValue, dayOfYear);
  const dateAltitude =
    minutes >= sunrise && minutes <= sunset
      ? `${Math.round(Math.max(0, Math.sin(progress * Math.PI) * Number(altitude.replace("°", ""))))}°`
      : "Below horizon";
  return (
    <>
      <div className="solar-path" aria-label="Sun position across today's sky">
        <p className="diagram-title">
          TODAY'S SUN PATH{" "}
          <span>
            {location.sunrise} — {location.sunset}
          </span>
        </p>
        <svg viewBox="0 0 340 150" role="img">
          <path className="horizon" d="M20 118H320" />
          <path className="sun-curve" d="M26 118C87 8 253 8 314 118" />
          <circle className="sun-marker" cx={sunX} cy={sunY} r="7" />
          <text x="20" y="137">
            SUNRISE
          </text>
          <text x="280" y="137">
            SUNSET
          </text>
          <text x="154" y="28">
            SOLAR NOON
          </text>
        </svg>
        <div className="path-caption">
          <span>Altitude now</span>
          <strong>{dateAltitude}</strong>
          <small>Location-based solar elevation</small>
        </div>
      </div>
      <div
        className="solar-path lemniscate-panel"
        aria-label="Sun position on the seasonal lemniscate path"
      >
        <p className="diagram-title">
          SEASONAL LEMNISCATE <span>{zodiac.position} {zodiac.sign.toUpperCase()}</span>
        </p>
        <svg className="analemma-chart" viewBox="0 0 340 150" role="img">
          <path
            className="analemma-grid"
            d="M25 18H315M25 80H315M25 142H315M25 18V142M170 18V142M315 18V142"
          />
          <path className="analemma-axis" d="M25 80H315" />
          <path className="analemma-path" d={analemmaPath} />
          <circle
            className="sun-marker analemma-marker"
            cx={currentAnalemmaPoint.x}
            cy={currentAnalemmaPoint.y}
            r="5"
          />
          <text className="analemma-label" x="25" y="148">
            −18 min
          </text>
          <text className="analemma-label" x="158" y="148">
            0
          </text>
          <text className="analemma-label" x="287" y="148">
            +18 min
          </text>
          <text className="analemma-label" x="7" y="21">
            +25°
          </text>
          <text className="analemma-label" x="10" y="84">
            0°
          </text>
          <text className="analemma-label" x="7" y="140">
            −25°
          </text>
          <text className="analemma-label" x="111" y="12">
            DECLINATION / EOT
          </text>
          <text
            className="analemma-label"
            x={currentAnalemmaPoint.x + 7}
            y={currentAnalemmaPoint.y - 7}
          >
            DAY {getDayOfYearInTimeZone(now, location.timeZone)}
          </text>
        </svg>
        <div className="path-caption">
          <span>Current point</span>
          <strong>
            {getAnalemmaPoint(
              getDayOfYearInTimeZone(now, location.timeZone),
            ).equationOfTime.toFixed(1)}{" "}
            min EoT
          </strong>
          <small>Equation of Time vs solar declination</small>
        </div>
      </div>
    </>
  );
}

function MoonDiagram({ phase }: { phase: number }) {
  const litStart = phase < 0.5 ? 0 : 1;
  return (
    <div className="moon-diagram" aria-label="Upright moon phase diagram">
      <svg viewBox="0 0 90 90" role="img">
        <circle className="moon-disc" cx="45" cy="45" r="31" />
        <path
          className="moon-shadow"
          d={
            litStart
              ? "M45 14a31 31 0 0 0 0 62c-17-8-17-54 0-62Z"
              : "M45 14a31 31 0 0 1 0 62c17-8 17-54 0-62Z"
          }
        />
      </svg>
    </div>
  );
}

function App() {
  const [now, setNow] = useState(() => new Date());
  const [timeInput, setTimeInput] = useState(() => toDateTimeLocalValue(new Date()));
  const [timeIsLive, setTimeIsLive] = useState(true);
  const [placeInput, setPlaceInput] = useState("Detecting location...");
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState<"clock" | "planets">("clock");
  const [location, setLocation] = useState(locations[0]);

  const applyCurrentLocation = (coords: { latitude: number; longitude: number }) => {
    setLocation({
      ...locations[0],
      name: "Locating...",
      latitudeValue: coords.latitude,
      longitudeValue: coords.longitude,
      latitude: `${Math.abs(coords.latitude).toFixed(4)}° ${coords.latitude >= 0 ? "N" : "S"}`,
      longitude: `${Math.abs(coords.longitude).toFixed(4)}° ${coords.longitude >= 0 ? "E" : "W"}`,
    });
    setPlaceInput("Current position");

    void fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`,
    )
      .then((response) => response.json())
      .then((data: { city?: string; locality?: string; principalSubdivision?: string; countryName?: string }) => {
        const city = data.city || data.locality;
        const region = data.principalSubdivision;
        const label = [city, region, data.countryName].filter(Boolean).join(", ");
        if (label) {
          setLocation((current) => ({ ...current, name: label }));
          setPlaceInput(label);
        }
      })
      .catch(() => undefined);
  };

  const activateCurrentLocation = () => {
    setPlaceInput("Locating...");
    if (!navigator.geolocation) {
      setPlaceInput(locations[0].name);
      setLocation(locations[0]);
      return;
    }
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => applyCurrentLocation(coords),
      () => {
        setPlaceInput(locations[0].name);
      },
    );
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (timeIsLive) {
        const liveDate = new Date();
        setNow(liveDate);
        setTimeInput(toDateTimeLocalValue(liveDate));
      }
    }, 1000);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => applyCurrentLocation(coords),
        () => {
          setPlaceInput(locations[0].name);
        },
      );
    }
    return () => window.clearInterval(timer);
  }, [timeIsLive]);

  const solarDateKey = getDateKeyInTimeZone(now, location.timeZone);

  useEffect(() => {
    const controller = new AbortController();
    const selectedDate = new Date(`${solarDateKey}T12:00:00Z`);
    selectedDate.setUTCDate(selectedDate.getUTCDate() - 1);
    const previousDateKey = selectedDate.toISOString().slice(0, 10);
    const params = new URLSearchParams({
      latitude: String(location.latitudeValue),
      longitude: String(location.longitudeValue),
      daily: "sunrise,sunset",
      timezone: "auto",
      start_date: previousDateKey,
      end_date: solarDateKey,
    });
    const todayKey = getDateKeyInTimeZone(new Date(), location.timeZone);
    const solarApi =
      solarDateKey < todayKey
        ? "https://archive-api.open-meteo.com/v1/archive"
        : "https://api.open-meteo.com/v1/forecast";
    void fetch(`${solarApi}?${params}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Solar data unavailable");
        return response.json();
      })
      .then((data: {
        daily?: { sunrise?: string[]; sunset?: string[] };
        timezone?: string;
      }) => {
        const sunriseValues = data.daily?.sunrise ?? [];
        const sunsetValues = data.daily?.sunset ?? [];
        const sunriseIso = sunriseValues.at(-1);
        const sunsetIso = sunsetValues.at(-1);
        if (!sunriseIso || !sunsetIso) return;
        if (data.timezone) {
          setLocation((current) => ({
            ...current,
            timeZone: data.timezone as string,
          }));
        }
        const getTimeParts = (iso: string) => {
          const match = iso.match(/T(\d{2}):(\d{2})/);
          if (!match) return null;
          return Number(match[1]) * 60 + Number(match[2]);
        };
        const formatMinutes = (minutes: number) => {
          const normalized = ((minutes % 1440) + 1440) % 1440;
          return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
        };
        const sunriseMinutes = getTimeParts(sunriseIso);
        const sunsetMinutes = getTimeParts(sunsetIso);
        if (sunriseMinutes == null || sunsetMinutes == null) return;
        let daylightMinutes = sunsetMinutes - sunriseMinutes;
        if (daylightMinutes < 0) daylightMinutes += 1440;
        let daylightChange = 0;
        const previousSunrise = getTimeParts(sunriseValues[0] ?? "");
        const previousSunset = getTimeParts(sunsetValues[0] ?? "");
        if (previousSunrise != null && previousSunset != null) {
          let previousDaylight = previousSunset - previousSunrise;
          if (previousDaylight < 0) previousDaylight += 1440;
          daylightChange = daylightMinutes - previousDaylight;
        }
        setLocation((current) => ({
          ...current,
          sunrise: formatMinutes(sunriseMinutes),
          sunset: formatMinutes(sunsetMinutes),
          solarNoon: formatMinutes(Math.round((sunriseMinutes + sunsetMinutes) / 2)),
          daylight: `${Math.floor(daylightMinutes / 60)}h ${String(daylightMinutes % 60).padStart(2, "0")}m`,
          daylightChange,
        }));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [location.latitudeValue, location.longitudeValue, location.timeZone, solarDateKey]);

  const moon = useMemo(() => getMoonPhase(now), [now]);
  const yearProgress = getYearProgressInTimeZone(now, location.timeZone);
  const dayOfYear = getDayOfYearInTimeZone(now, location.timeZone);
  const zodiac = getZodiacPosition(dayOfYear);
  const solarAltitude = getSolarAltitude(location.latitudeValue, dayOfYear);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const localTime = formatDate(now, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: location.timeZone,
  });
  const locationZone = formatDate(now, {
    timeZone: location.timeZone,
    timeZoneName: "short",
  })
    .split(" ")
    .pop();

  return (
    <main className="min-h-screen bg-[#080a0f] px-4 py-5 text-white sm:px-8 lg:px-12">
      <header className="site-header mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-5">
        <button
          className="brand"
          onClick={() => {
            setPage("clock");
            setMenuOpen(false);
          }}
          type="button"
        >
          <span className="brand-mark">◒</span> ClockWall
        </button>
        <div className="header-meta">
          <span className="status-dot" /> NIGHT MODE{" "}
          <span className="hidden sm:inline">/ {location.name}</span>
        </div>
        <button
          className="menu-button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        {menuOpen && (
          <nav className="menu-panel">
            <button
              className={page === "clock" ? "active" : ""}
              onClick={() => {
                setPage("clock");
                setMenuOpen(false);
              }}
              type="button"
            >
              ClockWall
            </button>
            <button
              className={page === "planets" ? "active" : ""}
              onClick={() => {
                setPage("planets");
                setMenuOpen(false);
              }}
              type="button"
            >
              Planetary positions <span>SOON</span>
            </button>
          </nav>
        )}
      </header>

      {page === "clock" && (
        <section
          className="time-place-bar mx-auto max-w-7xl"
          aria-label="Time and location"
        >
          <button
            className={`now-button ${timeIsLive ? "active" : ""}`}
            type="button"
            onClick={() => {
              const liveDate = new Date();
              setNow(liveDate);
              setTimeInput(toDateTimeLocalValue(liveDate));
              setTimeIsLive(true);
            }}
          >
            <span className="live-dot" />
            NOW
          </button>
          <label className="search-field time-field">
            <span>TIME</span>
            {timeIsLive ? (
              <input
                aria-label="Live time"
                type="text"
                readOnly
                value={`${localTime} · ${locationZone}`}
                onFocus={() => {
                  setTimeIsLive(false);
                  setTimeInput(toDateTimeLocalValue(now));
                }}
              />
            ) : (
              <input
                aria-label="Time"
                type="datetime-local"
                value={timeInput}
                onChange={(event) => {
                  setTimeInput(event.target.value);
                  setTimeIsLive(false);
                  const selected = new Date(event.target.value);
                  if (!Number.isNaN(selected.getTime())) setNow(selected);
                }}
              />
            )}
          </label>
          <label className="search-field place-field">
            <span>PLACE</span>
            <select
              aria-label="Place"
              value={placeInput}
              onChange={(event) => {
                const selectedName = event.target.value;
                setPlaceInput(selectedName);
                if (selectedName === "Current position") {
                  activateCurrentLocation();
                  return;
                }
                const selected = locations.find(
                  (item) => item.name === selectedName,
                );
                if (selected) setLocation(selected);
              }}
            >
              <option value="Current position">Current position</option>
              {placeInput === "Locating..." && (
                <option value="Locating...">Locating...</option>
              )}
              {placeInput !== "Current position" &&
                placeInput !== "Locating..." &&
                !locations.some((item) => item.name === placeInput) && (
                <option value={placeInput}>{placeInput}</option>
              )}
              {locations.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="here-button"
            type="button"
            onClick={activateCurrentLocation}
          >
            <span className="crosshair" aria-hidden="true">
              ⌖
            </span>
            HERE
          </button>
        </section>
      )}

      {page === "clock" ? (
        <div className="mx-auto max-w-7xl py-8 sm:py-12">
          <section className="dashboard-grid">
            <SolarPath now={now} location={location} />
            <TemperatureHistoryPanel location={location} dateKey={solarDateKey} />
            <article className="metric-card solar-times-card">
              <p className="card-label">DAYLIGHT WINDOW</p>
              <div className="solar-times">
                <div>
                  <span>SUNRISE</span>
                  <strong className="sunrise-time">{location.sunrise}</strong>
                </div>
                <div>
                  <span>SUNSET</span>
                  <strong className="sunset-time">{location.sunset}</strong>
                </div>
              </div>
              <p className="metric-detail">
                {formatDate(tomorrow, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: location.timeZone,
                })}{" "}
                · {location.daylight} of daylight
              </p>
            </article>
            <article className="metric-card moon-card">
              <p className="card-label">MOON PHASE</p>
              <MoonDiagram phase={moon.age / (29.530588853 * 86400000)} />
              <p className="metric-detail">
                {moon.name} · {Math.floor(moon.age / 86400000)} days old
              </p>
            </article>
            <MetricCard
              eyebrow="SEASONAL POSITION"
              value={zodiac.sign}
              detail={`Sun is ${zodiac.position} along the ecliptic`}
            />
            <MetricCard
              eyebrow="YEAR IN PROGRESS"
              value={`${yearProgress.progress}%`}
              detail={`${yearProgress.daysRemain} days remain`}
              className="progress-card"
            />
            <MetricCard
              eyebrow="SOLAR NOON"
              value={location.solarNoon}
              detail={`Altitude ${solarAltitude} · ${locationZone}`}
            />
            <MetricCard
              eyebrow="DAYLIGHT"
              value={location.daylight}
              detail={`${formatSignedDuration(location.daylightChange ?? 0)} from yesterday`}
            />
          </section>
          <footer className="dashboard-footer">
            <span>
              OBSERVATORY /{" "}
              {formatDate(now, {
                month: "numeric",
                day: "numeric",
                year: "numeric",
                timeZoneName: "short",
                timeZone: location.timeZone,
              })}
            </span>
            <span>UPDATED EVERY SECOND</span>
            <span>{location.name.toUpperCase()}</span>
          </footer>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl py-16">
          <section className="planets-page">
            <p className="kicker">FUTURE MODULE / EPHEMERIS</p>
            <h1>
              Planetary
              <br />
              <em>positions.</em>
            </h1>
            <p className="planets-intro">
              A live sky map for the bodies that shape our calendar. This view
              is being prepared for solar system and planetary tracking.
            </p>
            <div className="planet-orbit">
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
              <span className="planet sun" />
              <span className="planet earth" />
              <span className="planet mars" />
            </div>
            <div className="coming-soon">
              <span>COMING SOON</span>
              <strong>Solar system scope</strong>
              <small>
                Planet coordinates · retrograde motion · conjunctions
              </small>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
