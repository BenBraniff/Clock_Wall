import { useEffect, useMemo, useState } from "react";
import * as Astronomy from "astronomy-engine";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import * as SunCalc from "suncalc";
import "./App.css";

const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, options).format(date);

const toDateTimeLocalValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
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

function SeasonalAnalemmaPanel({
  now,
  location,
}: {
  now: Date;
  location: (typeof locations)[number];
}) {
  const dayOfYear = getDayOfYearInTimeZone(now, location.timeZone);
  const analemmaPath = getAnalemmaPath();
  const currentAnalemmaPoint = mapAnalemmaPoint(
    getAnalemmaPoint(dayOfYear),
  );
  const zodiac = getZodiacPosition(dayOfYear);
  return (
    <article
      className="chart-card analemma-panel"
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
          DAY {dayOfYear}
        </text>
      </svg>
      <div className="path-caption">
        <span>Current point</span>
        <strong>{getAnalemmaPoint(dayOfYear).equationOfTime.toFixed(1)} min EoT</strong>
        <small>Equation of Time vs solar declination</small>
      </div>
    </article>
  );
}

function SolarAnglesPanel({
  now,
  location,
}: {
  now: Date;
  location: (typeof locations)[number];
}) {
  const { latitudeValue, longitudeValue, timeZone } = location;
  const currentPosition = SunCalc.getPosition(now, latitudeValue, longitudeValue);
  const elevation = currentPosition.altitude;
  const azimuth = (currentPosition.azimuth * (180 / Math.PI) + 540) % 360;
  const zenith = 90 - elevation;
  const sunTimes = SunCalc.getTimes(
    now,
    latitudeValue,
    longitudeValue,
    0,
    getTimeZoneOffsetMinutes(now, timeZone),
  );
  const sunrise = sunTimes.sunrise?.getTime() ?? Number.NaN;
  const sunset = sunTimes.sunset?.getTime() ?? Number.NaN;
  const hasDaylight =
    Number.isFinite(sunrise) && Number.isFinite(sunset) && sunset > sunrise;
  const nowMs = now.getTime();
  const isSunAboveHorizon =
    hasDaylight && nowMs >= sunrise && nowMs <= sunset;
  const sampleTimes = hasDaylight
    ? Array.from({ length: 49 }, (_, index) =>
        sunrise + ((sunset - sunrise) * index) / 48,
      )
    : [];
  if (isSunAboveHorizon) sampleTimes.push(nowMs);
  sampleTimes.sort((first, second) => first - second);

  const toChartPoint = (time: number) => {
    const position = SunCalc.getPosition(
      new Date(time),
      latitudeValue,
      longitudeValue,
    );
    const altitude = position.altitude;
    return {
      x: 25 + ((time - sunrise) / (sunset - sunrise)) * 290,
      y: 118 - ((altitude + 10) / 100) * 100,
    };
  };
  const path = sampleTimes
    .map((time, index) => {
      const point = toChartPoint(time);
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
  const currentPoint = isSunAboveHorizon ? toChartPoint(nowMs) : null;

  return (
    <article
      className="chart-card solar-angles-panel"
      aria-label="Solar azimuth, elevation, and zenith angles"
    >
      <p className="diagram-title">
        SOLAR ANGLES
        <span>{location.name.toUpperCase()}</span>
      </p>
      <svg className="solar-angles-chart" viewBox="0 0 340 150" role="img">
        <path className="solar-angle-grid" d="M25 18H315M25 63H315M25 108H315" />
        <path className="solar-angle-grid" d="M25 18V118M170 18V118M315 18V118" />
        <path className="solar-angle-horizon" d="M25 108H315" />
        {path ? (
          <path className="solar-angle-curve" d={path} />
        ) : (
          <text className="solar-angle-empty" x="170" y="72" textAnchor="middle">
            NO SUNRISE / SUNSET TODAY
          </text>
        )}
        {currentPoint && (
          <circle
            className="sun-marker solar-angle-marker"
            cx={currentPoint.x}
            cy={currentPoint.y}
            r="5"
          />
        )}
        <text x="5" y="21">90°</text>
        <text x="5" y="66">45°</text>
        <text x="9" y="111">0°</text>
        <text x="25" y="137" textAnchor="start">RISE</text>
        <text x="170" y="137" textAnchor="middle">SOLAR NOON</text>
        <text x="315" y="137" textAnchor="end">SET</text>
      </svg>
      <div className="solar-angle-readings">
        <div>
          <span>AZIMUTH <small>FROM NORTH</small></span>
          <strong>{azimuth.toFixed(1)}°</strong>
        </div>
        <div>
          <span>ELEVATION</span>
          <strong>{elevation.toFixed(1)}°</strong>
        </div>
        <div>
          <span>ZENITH</span>
          <strong>{zenith.toFixed(1)}°</strong>
        </div>
      </div>
    </article>
  );
}

const planets = [
  { name: "Mercury", body: Astronomy.Body.Mercury, color: "#e0c3a5" },
  { name: "Venus", body: Astronomy.Body.Venus, color: "#ffe08f" },
  { name: "Earth", body: Astronomy.Body.Earth, color: "#72c5ff" },
  { name: "Mars", body: Astronomy.Body.Mars, color: "#ff8068" },
  { name: "Jupiter", body: Astronomy.Body.Jupiter, color: "#ffc08b" },
  { name: "Saturn", body: Astronomy.Body.Saturn, color: "#ffe07d" },
  { name: "Uranus", body: Astronomy.Body.Uranus, color: "#7fe6e2" },
  { name: "Neptune", body: Astronomy.Body.Neptune, color: "#8eaaff" },
] as const;

const eclipticRotation = Astronomy.Rotation_EQJ_ECL();
const orbitSampleCount = 96;

const getPlanetVector = (body: Astronomy.Body, date: Date) =>
  Astronomy.RotateVector(
    eclipticRotation,
    Astronomy.HelioVector(body, date),
  );

const getOrbitRadius = (distance: number) =>
  24 + Math.pow(distance / 30.05, 0.62) * 142;

const projectPlanetVector = (
  vector: Astronomy.Vector,
  view: "top-down" | "isometric",
) => {
  const distance = vector.Length();
  const radius = getOrbitRadius(distance);
  if (view === "isometric") {
    return {
      x: 360 + ((vector.x - vector.y) / distance) * Math.sqrt(3 / 2) * radius,
      y:
        190 -
        (((vector.x + vector.y) / distance) * 0.5 -
          vector.z / distance) *
          radius,
    };
  }
  const horizontalDistance = Math.hypot(vector.x, vector.y);
  return {
    x: 360 + (vector.x / horizontalDistance) * radius,
    y: 190 - (vector.y / horizontalDistance) * radius,
  };
};

function PlanetaryPositionsPanel({
  now,
  timeInput,
  timeIsLive,
  onTimeChange,
  onNow,
}: {
  now: Date;
  timeInput: string;
  timeIsLive: boolean;
  onTimeChange: (value: string) => void;
  onNow: () => void;
}) {
  const [view, setView] = useState<"top-down" | "isometric">("top-down");
  const positions = useMemo(
    () =>
      planets.map((planet) => {
        const vector = getPlanetVector(planet.body, now);
        const longitude =
          ((Math.atan2(vector.y, vector.x) * (180 / Math.PI) + 360) % 360);
        return {
          ...planet,
          vector,
          distance: vector.Length(),
          longitude,
        };
      }),
    [now],
  );
  const trajectories = useMemo(
    () =>
      planets.map((planet, planetIndex) => {
        const periodDays = Astronomy.PlanetOrbitalPeriod(planet.body);
        const path = Array.from({ length: orbitSampleCount + 1 }, (_, index) => {
          const midpoint = orbitSampleCount / 2;
          if (index === midpoint) return positions[planetIndex].vector;
          const dayOffset = ((index - midpoint) / orbitSampleCount) * periodDays;
          const sampleDate = new Date(now.getTime() + dayOffset * 86400000);
          return getPlanetVector(planet.body, sampleDate);
        });
        return {
          name: planet.name,
          path: path
            .map((vector, index) => {
              const point = projectPlanetVector(vector, view);
              return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
            })
            .join(" "),
        };
      }),
    [now, positions, view],
  );
  const center = { x: 360, y: 190 };
  const formattedSimulationTime = formatDate(now, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <article className="chart-card planetary-chart">
      <div className="planetary-chart-heading">
        <div className="planetary-chart-title">
          <p className="diagram-title">HELIOCENTRIC POSITIONS <span>ECLIPTIC PLANE</span></p>
          <button
            className="planet-view-button"
            aria-label={`Show ${view === "top-down" ? "isometric" : "top-down"} view`}
            onClick={() =>
              setView((current) =>
                current === "top-down" ? "isometric" : "top-down",
              )
            }
            type="button"
          >
            {view === "top-down" ? "ISOMETRIC VIEW" : "TOP-DOWN VIEW"}
          </button>
        </div>
        <div className="planetary-time-control">
          <button
            className={`planet-now-button ${timeIsLive ? "active" : ""}`}
            onClick={onNow}
            type="button"
          >
            <span className="live-dot" /> NOW
          </button>
          <input
            aria-label="Planet simulation date and time"
            type="datetime-local"
            value={timeInput}
            onChange={(event) => onTimeChange(event.target.value)}
          />
        </div>
      </div>
      <svg
        className="planetary-orbit-chart"
        viewBox="0 0 720 380"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`Heliocentric positions of the eight planets at ${formattedSimulationTime}`}
      >
        <path
          className="planetary-crosshair"
          d={
            view === "isometric"
              ? "M204 280L516 100M204 100L516 280"
              : "M194 190H526M360 24V356"
          }
        />
        {trajectories.map((trajectory) => (
          <path
            key={trajectory.name}
            className="planetary-orbit"
            d={trajectory.path}
          />
        ))}
        <circle className="planetary-sun-glow" cx={center.x} cy={center.y} r="14" />
        <circle className="planetary-sun" cx={center.x} cy={center.y} r="5" />
        {positions.map((planet) => {
          const point = projectPlanetVector(planet.vector, view);
          return (
            <circle
              key={planet.name}
              className="planetary-marker"
              cx={point.x}
              cy={point.y}
              r={planet.name === "Jupiter" ? 6 : planet.name === "Saturn" ? 5.5 : 5}
              fill={planet.color}
            >
              <title>
                {planet.name} · {planet.distance.toFixed(3)} AU · {planet.longitude.toFixed(1)}°
              </title>
            </circle>
          );
        })}
        <text className="planetary-axis-label" x="360" y="370" textAnchor="middle">
          {view === "isometric" ? "ISOMETRIC" : "TOP-DOWN"} VIEW · RADIAL SPACING COMPRESSED FOR LEGIBILITY
        </text>
      </svg>
      <div className="planet-position-list">
        <table className="planet-position-table">
          <thead>
            <tr>
              <th scope="col">PLANET</th>
              <th scope="col">DISTANCE (AU)</th>
              <th scope="col">ECLIPTIC LONGITUDE</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((planet) => (
              <tr key={planet.name}>
                <th scope="row">
                  <span className="planet-position-name">
                    <i style={{ backgroundColor: planet.color }} />
                    {planet.name}
                  </span>
                </th>
                <td>{planet.distance.toFixed(3)}</td>
                <td>{planet.longitude.toFixed(1)}°</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="planetary-caption">
        Positions calculated with Astronomy Engine · Sun-centered vectors in astronomical units
      </div>
    </article>
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

const continentOutlines: [number, number][][] = [
  [
    [-168, 65], [-154, 71], [-143, 69], [-132, 57], [-124, 50],
    [-128, 41], [-122, 33], [-115, 29], [-106, 23], [-98, 17],
    [-90, 19], [-85, 10], [-78, 8], [-76, 18], [-81, 25],
    [-80, 32], [-74, 40], [-67, 45], [-58, 52], [-63, 59],
    [-82, 67], [-105, 73], [-130, 72], [-148, 70],
  ],
  [
    [-80, 9], [-71, 12], [-61, 8], [-50, 2], [-44, -7],
    [-49, -17], [-54, -27], [-62, -39], [-69, -55], [-76, -43],
    [-78, -25], [-81, -7],
  ],
  [
    [-11, 36], [-8, 44], [-2, 50], [8, 55], [18, 60],
    [31, 69], [47, 70], [60, 65], [76, 70], [91, 73],
    [111, 69], [128, 60], [143, 55], [155, 48], [145, 41],
    [130, 43], [122, 34], [117, 25], [108, 21], [103, 10],
    [95, 6], [91, 20], [81, 8], [75, 9], [69, 23],
    [57, 25], [51, 37], [42, 42], [35, 36], [28, 40],
    [20, 36], [13, 42], [4, 43], [-2, 36],
  ],
  [
    [-17, 35], [-5, 37], [10, 34], [25, 32], [34, 22],
    [43, 12], [50, 2], [42, -12], [38, -20], [31, -32],
    [19, -35], [12, -25], [4, -18], [-1, -7], [-8, 5],
    [-15, 15],
  ],
  [
    [112, -11], [129, -12], [140, -17], [153, -27], [151, -39],
    [140, -43], [128, -36], [116, -31], [113, -22],
  ],
  [
    [-52, 59], [-43, 60], [-34, 68], [-40, 82], [-53, 84],
    [-61, 75],
  ],
  [
    [130, 32], [136, 35], [141, 41], [145, 44], [142, 35],
    [137, 31],
  ],
  [
    [47, -13], [50, -16], [49, -25], [45, -24],
  ],
];

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the Earth texture");

  context.fillStyle = "#12334a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const oceanGradient = context.createLinearGradient(0, 0, 0, canvas.height);
  oceanGradient.addColorStop(0, "#1b4960");
  oceanGradient.addColorStop(0.5, "#102e45");
  oceanGradient.addColorStop(1, "#173b50");
  context.fillStyle = oceanGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  continentOutlines.forEach((outline, index) => {
    context.beginPath();
    outline.forEach(([longitude, latitude], pointIndex) => {
      const x = ((longitude + 180) / 360) * canvas.width;
      const y = ((90 - latitude) / 180) * canvas.height;
      if (pointIndex === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fillStyle = index % 2 === 0 ? "#718b56" : "#7f925b";
    context.fill();
    context.strokeStyle = "#a3ad78";
    context.lineWidth = 2;
    context.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function EarthView() {
  const texture = useMemo(() => createEarthTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <section className="earth-page">
      <div className="earth-page-heading">
        <div>
          <p className="kicker">INTERACTIVE GLOBE / EARTH</p>
          <h1>
            Earth
            <br />
            <em>view.</em>
          </h1>
        </div>
        <p className="earth-intro">
          Explore a hand-drawn globe. Drag to rotate, right-drag to move, and
          scroll to zoom.
        </p>
      </div>
      <div className="earth-canvas-frame">
        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
          role="img"
          aria-label="Interactive three-dimensional Earth globe"
        >
          <color attach="background" args={["#000000"]} />
          <ambientLight intensity={1.15} />
          <directionalLight position={[-3, 2, 4]} intensity={2.2} />
          <mesh rotation={[0.12, -0.5, 0]}>
            <sphereGeometry args={[1.45, 96, 64]} />
            <meshStandardMaterial map={texture} roughness={0.92} />
          </mesh>
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            enablePan
            minDistance={2.1}
            maxDistance={7}
          />
        </Canvas>
      </div>
      <p className="earth-caption">3D EARTH / DRAG TO EXPLORE</p>
    </section>
  );
}

function App() {
  const [now, setNow] = useState(() => new Date());
  const [timeInput, setTimeInput] = useState(() => toDateTimeLocalValue(new Date()));
  const [timeIsLive, setTimeIsLive] = useState(true);
  const [placeInput, setPlaceInput] = useState("Detecting location...");
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState<"clock" | "planets" | "earth">("clock");
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
  const solarNoon = SunCalc.getTimes(
    now,
    location.latitudeValue,
    location.longitudeValue,
    0,
    getTimeZoneOffsetMinutes(now, location.timeZone),
  ).solarNoon;
  const solarAltitude = `${Math.round(
    SunCalc.getPosition(
      solarNoon,
      location.latitudeValue,
      location.longitudeValue,
    ).altitude,
  )}°`;
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
    <main className="min-h-screen bg-[#050505] px-4 py-5 text-white sm:px-8 lg:px-12">
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
              Planetary positions
            </button>
            <button
              className={page === "earth" ? "active" : ""}
              onClick={() => {
                setPage("earth");
                setMenuOpen(false);
              }}
              type="button"
            >
              Earth view
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
            <section className="charts-grid" aria-label="Solar and climate charts">
              <SeasonalAnalemmaPanel now={now} location={location} />
              <TemperatureHistoryPanel location={location} dateKey={solarDateKey} />
              <SolarAnglesPanel now={now} location={location} />
            </section>
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
      ) : page === "planets" ? (
        <div className="mx-auto max-w-7xl py-16">
          <section className="planets-page">
            <p className="kicker">LIVE EPHEMERIS / SOLAR SYSTEM</p>
            <h1>
              Planetary
              <br />
              <em>positions.</em>
            </h1>
            <p className="planets-intro">
              Track the eight planets around the Sun. Choose a moment to inspect
              their positions, heliocentric distances, and ecliptic longitudes.
            </p>
            <PlanetaryPositionsPanel
              now={now}
              timeInput={timeInput}
              timeIsLive={timeIsLive}
              onTimeChange={(value) => {
                setTimeInput(value);
                setTimeIsLive(false);
                const selectedDate = new Date(value);
                if (!Number.isNaN(selectedDate.getTime())) setNow(selectedDate);
              }}
              onNow={() => {
                const liveDate = new Date();
                setNow(liveDate);
                setTimeInput(toDateTimeLocalValue(liveDate));
                setTimeIsLive(true);
              }}
            />
          </section>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl py-16">
          <EarthView />
        </div>
      )}
    </main>
  );
}

export default App;
