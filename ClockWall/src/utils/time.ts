export const formatDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
) => new Intl.DateTimeFormat(undefined, options).format(date);

export const toDateTimeLocalValue = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((item) => item.type === type);
    if (!part) throw new Error(`Missing ${type} date part`);
    return part.value;
  };
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
};

export const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
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

export const fromDateTimeLocalValue = (value: string, timeZone: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const localTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let timestamp = localTime;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffsetMinutes(new Date(timestamp), timeZone);
    const adjustedTimestamp = localTime - offset * 60000;
    if (adjustedTimestamp === timestamp) break;
    timestamp = adjustedTimestamp;
  }

  const date = new Date(timestamp);
  return toDateTimeLocalValue(date, timeZone) === value ? date : null;
};

export const getDayOfYearInTimeZone = (date: Date, timeZone: string) => {
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

export const getDateKeyInTimeZone = (date: Date, timeZone: string) => {
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

export const getYearProgressInTimeZone = (date: Date, timeZone: string) => {
  const { year } = getDatePartsInTimeZone(date, timeZone);
  const dayOfYear = getDayOfYearInTimeZone(date, timeZone);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInYear = leapYear ? 366 : 365;
  return {
    progress: Math.round((dayOfYear / daysInYear) * 100),
    daysRemain: daysInYear - dayOfYear,
  };
};

export const formatSignedDuration = (minutes: number) => {
  if (minutes === 0) return "No change";
  const absolute = Math.abs(minutes);
  const sign = minutes > 0 ? "+" : "-";
  return `${sign}${Math.floor(absolute / 60) ? `${Math.floor(absolute / 60)}h ` : ""}${absolute % 60}m`;
};

export const getDayNumber = (date: string) => {
  const value = new Date(`${date}T12:00:00Z`);
  return Math.floor(
    (Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) -
      Date.UTC(value.getUTCFullYear(), 0, 1)) /
      86400000,
  );
};
