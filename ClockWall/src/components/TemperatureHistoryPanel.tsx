import { useEffect, useState } from "react";
import type { Location, TemperaturePoint, TemperatureSeries } from "../types";
import { getDayNumber } from "../utils/time";

const smoothTemperatures = (points: TemperaturePoint[]) =>
  points.map((point, index) => {
    const window = points.slice(Math.max(0, index - 3), index + 4);
    return {
      ...point,
      temperature:
        window.reduce((sum, item) => sum + item.temperature, 0) / window.length,
    };
  });

const fetchTemperatureHistory = async (
  location: Location,
  dateKey: string,
) => {
  const currentYear = Number(dateKey.slice(0, 4));
  const years = [currentYear - 2, currentYear - 1, currentYear];
  const results = await Promise.all(
    years.map(async (year) => {
      const endDate = year === currentYear ? dateKey : `${year}-12-31`;
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

export function TemperatureHistoryPanel({
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
                <line
                  className="temperature-grid"
                  x1={x}
                  y1={chart.top}
                  x2={x}
                  y2={chart.bottom}
                />
                <text
                  className="temperature-axis-label"
                  x={x}
                  y="244"
                  textAnchor="middle"
                >
                  {label}
                </text>
              </g>
            );
          })}
          {[minimum, minimum + range / 2, maximum].map((value) => {
            const y = yForTemperature(value);
            return (
              <g key={value}>
                <line
                  className="temperature-grid horizontal"
                  x1={chart.left}
                  y1={y}
                  x2={chart.right}
                  y2={y}
                />
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
        <small>
          {currentPoint ? `CURRENT THROUGH ${currentPoint.date}` : "JAN — DEC"}
        </small>
      </div>
    </article>
  );
}
