export const getAnalemmaPoint = (dayOfYear: number) => {
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

export const mapAnalemmaPoint = (
  point: ReturnType<typeof getAnalemmaPoint>,
) => ({
  x: 170 + (point.equationOfTime / 18) * 145,
  y: 80 - (point.declination / 25) * 62,
});

export const getAnalemmaPath = () =>
  Array.from({ length: 365 }, (_, index) =>
    mapAnalemmaPoint(getAnalemmaPoint(index + 1)),
  )
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");

export const getMoonPhase = (date: Date) => {
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

const getSolarLongitude = (dayOfYear: number) =>
  ((dayOfYear - 80) * (360 / 365) + 360) % 360;

export const getZodiacPosition = (dayOfYear: number) => {
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
