import * as SunCalc from "suncalc";
import type { Location } from "../types";
import {
  getAnalemmaPath,
  getAnalemmaPoint,
  getZodiacPosition,
  mapAnalemmaPoint,
} from "../utils/astronomy";
import {
  getDayOfYearInTimeZone,
  getTimeZoneOffsetMinutes,
} from "../utils/time";

export function MetricCard({
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

export function SeasonalAnalemmaPanel({
  now,
  location,
}: {
  now: Date;
  location: Location;
}) {
  const dayOfYear = getDayOfYearInTimeZone(now, location.timeZone);
  const analemmaPath = getAnalemmaPath();
  const currentAnalemmaPoint = mapAnalemmaPoint(getAnalemmaPoint(dayOfYear));
  const zodiac = getZodiacPosition(dayOfYear);
  return (
    <article
      className="chart-card analemma-panel"
      aria-label="Sun position on the seasonal lemniscate path"
    >
      <p className="diagram-title">
        SEASONAL LEMNISCATE{" "}
        <span>
          {zodiac.position} {zodiac.sign.toUpperCase()}
        </span>
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
        <strong>
          {getAnalemmaPoint(dayOfYear).equationOfTime.toFixed(1)} min EoT
        </strong>
        <small>Equation of Time vs solar declination</small>
      </div>
    </article>
  );
}

export function SolarAnglesPanel({
  now,
  location,
}: {
  now: Date;
  location: Location;
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
    return {
      x: 25 + ((time - sunrise) / (sunset - sunrise)) * 290,
      y: 118 - ((position.altitude + 10) / 100) * 100,
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

export function MoonDiagram({ phase }: { phase: number }) {
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

