import { useCallback, useEffect, useMemo, useState } from "react";
import * as SunCalc from "suncalc";
import { locations } from "../data/locations";
import { getMoonPhase, getZodiacPosition } from "../utils/astronomy";
import {
  fromDateTimeLocalValue,
  formatDate,
  getDateKeyInTimeZone,
  getDayOfYearInTimeZone,
  getTimeZoneOffsetMinutes,
  getYearProgressInTimeZone,
  toDateTimeLocalValue,
} from "../utils/time";

export function useClockData() {
  const [now, setNow] = useState(() => new Date());
  const [location, setLocation] = useState(locations[0]);
  const [manualTimeInput, setManualTimeInput] = useState(() =>
    toDateTimeLocalValue(now, location.timeZone),
  );
  const [timeError, setTimeError] = useState<string | null>(null);
  const [timeIsLive, setTimeIsLive] = useState(true);
  const [placeInput, setPlaceInput] = useState("Detecting location...");

  const applyCurrentLocation = useCallback(
    (coords: { latitude: number; longitude: number }) => {
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
        .then(
          (data: {
            city?: string;
            locality?: string;
            principalSubdivision?: string;
            countryName?: string;
          }) => {
            const city = data.city || data.locality;
            const region = data.principalSubdivision;
            const label = [city, region, data.countryName]
              .filter(Boolean)
              .join(", ");
            if (label) {
              setLocation((current) => ({ ...current, name: label }));
              setPlaceInput(label);
            }
          },
        )
        .catch(() => undefined);
    },
    [],
  );

  const activateCurrentLocation = () => {
    setTimeError(null);
    setPlaceInput("Locating...");
    if (!navigator.geolocation) {
      setPlaceInput(locations[0].name);
      setLocation(locations[0]);
      setManualTimeInput(toDateTimeLocalValue(now, locations[0].timeZone));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => applyCurrentLocation(coords),
      () => {
        setPlaceInput(locations[0].name);
        setLocation(locations[0]);
        setManualTimeInput(toDateTimeLocalValue(now, locations[0].timeZone));
      },
    );
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (timeIsLive) {
        const liveDate = new Date();
        setNow(liveDate);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [location.timeZone, timeIsLive]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => applyCurrentLocation(coords),
        () => {
          setPlaceInput(locations[0].name);
        },
      );
    }
  }, [applyCurrentLocation]);

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
      .then(
        (data: {
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
            solarNoon: formatMinutes(
              Math.round((sunriseMinutes + sunsetMinutes) / 2),
            ),
            daylight: `${Math.floor(daylightMinutes / 60)}h ${String(daylightMinutes % 60).padStart(2, "0")}m`,
            daylightChange,
          }));
        },
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, [
    location.latitudeValue,
    location.longitudeValue,
    location.timeZone,
    solarDateKey,
  ]);

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

  const setTimeFromInput = (value: string) => {
    setManualTimeInput(value);
    setTimeIsLive(false);
    if (!value) {
      setTimeError(null);
      return;
    }
    const selectedDate = fromDateTimeLocalValue(value, location.timeZone);
    if (!selectedDate) {
      setTimeError(
        "This local time is invalid or skipped by a daylight-saving change.",
      );
      return;
    }
    setTimeError(null);
    setNow(selectedDate);
  };

  const startTimeEditing = () => {
    setManualTimeInput(toDateTimeLocalValue(now, location.timeZone));
    setTimeError(null);
    setTimeIsLive(false);
  };

  const setNowToLive = () => {
    const liveDate = new Date();
    setNow(liveDate);
    setManualTimeInput(toDateTimeLocalValue(liveDate, location.timeZone));
    setTimeError(null);
    setTimeIsLive(true);
  };

  const selectPlace = (selectedName: string) => {
    setPlaceInput(selectedName);
    if (selectedName === "Current position") {
      activateCurrentLocation();
      return;
    }
    const selected = locations.find((item) => item.name === selectedName);
    if (selected) {
      setLocation(selected);
      setManualTimeInput(toDateTimeLocalValue(now, selected.timeZone));
      setTimeError(null);
    }
  };

  const timeInput = timeIsLive
    ? toDateTimeLocalValue(now, location.timeZone)
    : manualTimeInput;

  return {
    now,
    timeInput,
    timeError,
    timeIsLive,
    placeInput,
    location,
    solarDateKey,
    moon,
    yearProgress,
    zodiac,
    solarAltitude,
    localTime,
    locationZone,
    setTimeFromInput,
    startTimeEditing,
    setNowToLive,
    selectPlace,
    activateCurrentLocation,
  };
}
