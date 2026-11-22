import { locations } from "../data/locations";

export function TimePlaceBar({
  timeInput,
  timeError,
  timeIsLive,
  placeInput,
  isCurrentLocation,
  localTime,
  locationZone,
  timeZone,
  onNow,
  onStartTimeEdit,
  onTimeInput,
  onPlaceInput,
  onActivateCurrentLocation,
}: {
  timeInput: string;
  timeError: string | null;
  timeIsLive: boolean;
  placeInput: string;
  isCurrentLocation: boolean;
  localTime: string;
  locationZone: string | undefined;
  timeZone: string;
  onNow: () => void;
  onStartTimeEdit: () => void;
  onTimeInput: (value: string) => void;
  onPlaceInput: (value: string) => void;
  onActivateCurrentLocation: () => void;
}) {
  return (
    <section
      className="time-place-bar mx-auto max-w-7xl"
      aria-label="Time and location"
    >
      <button
        className={`now-button ${timeIsLive ? "active" : ""}`}
        type="button"
        onClick={onNow}
      >
        <span className="live-dot" />
        NOW
      </button>
      <label className="search-field time-field">
        <span>TIME / {locationZone ?? timeZone}</span>
        {timeIsLive ? (
          <input
            aria-label="Live time"
            type="text"
            readOnly
            value={`${localTime} · ${locationZone ?? timeZone}`}
            onFocus={onStartTimeEdit}
          />
        ) : (
          <input
            aria-label="Time"
            type="datetime-local"
            value={timeInput}
            aria-invalid={Boolean(timeError)}
            aria-describedby={timeError ? "time-input-error" : undefined}
            onChange={(event) => onTimeInput(event.target.value)}
          />
        )}
        {timeError && (
          <span className="time-error" id="time-input-error" role="alert">
            {timeError}
          </span>
        )}
      </label>
      <label className="search-field place-field">
        <span>PLACE</span>
        <select
          aria-label="Place"
          value={placeInput}
          onChange={(event) => onPlaceInput(event.target.value)}
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
        className={`here-button ${isCurrentLocation ? "active" : ""}`}
        type="button"
        aria-pressed={isCurrentLocation}
        onClick={onActivateCurrentLocation}
      >
        <span className="crosshair" aria-hidden="true">
          ⌖
        </span>
        HERE
      </button>
    </section>
  );
}
