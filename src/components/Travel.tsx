"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  MapPin,
  Navigation,
  CloudSun,
  ExternalLink,
} from "lucide-react";
import { request, useWorkspace } from "./workspace";
import { Minutes, ErrorMessage } from "./ui";
import { PlaceSearch } from "./EntityEditor";
import { TaskRow } from "./TaskViews";
import { workspaceDay } from "@/lib/domain";
import { recordsOf } from "@/lib/types";
import type { Entity, Task, Place, Outing, Settings } from "@/lib/types";
interface RouteResult {
  routes: {
    duration: string;
    distanceMeters: number;
    polyline?: { encodedPolyline: string };
  }[];
  checkedAt: string;
  approximate: boolean;
}
interface WeatherResult {
  forecast: {
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
      weather_code: number[];
    };
  };
  checkedAt: string;
}
export function TaskLocation({
  task,
  onSaved,
}: {
  task: Entity<Task>;
  onSaved: (v: Partial<Task>) => void;
}) {
  const { workspace } = useWorkspace();
  const cfg = recordsOf<Settings>(workspace.records, "settings")[0].data;
  const today = workspaceDay(cfg);
  const [hours, setHours] = useState<{
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    currentOpeningHours?: { openNow?: boolean };
    checkedAt: string;
  } | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [forecast, setForecast] = useState<WeatherResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const places = recordsOf<Place>(workspace.records, "place");
  const t = task.data;
  const saved =
    places.find((p) => p.id === t.placeId) ||
    places.find(
      (p) =>
        p.data.name.toLowerCase() ===
        (t.context === "At home" ? "home" : t.destination).toLowerCase(),
    );
  const destination = t.destination || saved?.data.address || "";
  const origin =
    places.find((p) => p.data.name.toLowerCase() === t.origin.toLowerCase())
      ?.data.address || t.origin;
  async function getRoute() {
    setBusy("route");
    setError("");
    try {
      setRoute(
        await request<RouteResult>("provider", {
          action: "route",
          origin,
          destination,
          travelMode: t.travelMode,
          departure: t.departure || t.scheduledStart,
          arrival: t.arrival || t.scheduledStart,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Route unavailable");
    } finally {
      setBusy("");
    }
  }
  async function getWeather() {
    setBusy("weather");
    setError("");
    try {
      const latitude = t.latitude ?? saved?.data.latitude;
      const longitude = t.longitude ?? saved?.data.longitude;
      if (latitude == null || longitude == null)
        throw new Error(
          "Add coordinates to the task or saved place to retrieve its forecast.",
        );
      setForecast(
        await request<WeatherResult>("provider", {
          action: "weather",
          latitude,
          longitude,
          day: t.plannedDay || today,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Weather unavailable");
    } finally {
      setBusy("");
    }
  }
  const estimate = route
    ? Math.ceil(Number.parseInt(route.routes[0].duration) / 60)
    : t.travelMinutes;
  const arrival = t.arrival || t.scheduledStart;
  const leaveBy =
    arrival && estimate
      ? new Date(
          Date.parse(arrival) -
            (estimate + t.arrivalMinutes + t.prepMinutes) * 60000,
        )
      : null;
  const index =
    forecast?.forecast.daily.time.indexOf(t.plannedDay || today) ?? -1;
  const betterDay = forecast?.forecast.daily.time
    .map((day, i) => ({
      day,
      rain: forecast.forecast.daily.precipitation_probability_max[i],
    }))
    .filter((d) => d.day > (t.plannedDay || today) && d.rain < 40)
    .sort((a, b) => a.rain - b.rain)[0]?.day;
  return (
    <section className="inspector-section travel-section">
      <h3>
        <MapPin size={15} />
        {t.context === "At home" ? "Home outdoors" : "Destination & travel"}
      </h3>
      <p>{destination || "Choose a destination or saved place."}</p>
      <ErrorMessage error={error} />
      {saved?.data.placeId && (
        <>
          <button
            disabled={!!busy}
            onClick={async () => {
              setBusy("hours");
              setError("");
              try {
                setHours(
                  await request("provider", {
                    action: "place-details",
                    id: saved.data.placeId,
                  }),
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Opening hours unavailable",
                );
              } finally {
                setBusy("");
              }
            }}
          >
            Check opening hours
          </button>
          {hours && (
            <div className="context-card">
              <strong>
                {hours.currentOpeningHours?.openNow === undefined
                  ? "Opening hours"
                  : hours.currentOpeningHours.openNow
                    ? "Open now"
                    : "Closed now"}
              </strong>
              {hours.regularOpeningHours?.weekdayDescriptions?.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <small>
                Checked {new Date(hours.checkedAt).toLocaleString()} · Confirm
                with the destination before travel.
              </small>
            </div>
          )}
        </>
      )}
      {t.context === "Away from home" && (
        <>
          <p className="muted">
            From {origin || "a starting address"} · {t.travelMode.toLowerCase()}
          </p>
          <div className="button-row">
            <button disabled={!!busy} onClick={() => void getRoute()}>
              <Navigation size={14} />
              {busy === "route" ? "Checking…" : "Check route"}
            </button>
            <a
              className="button"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${{ DRIVE: "driving", WALK: "walking", BICYCLE: "bicycling", TRANSIT: "transit" }[t.travelMode] || "driving"}`}
            >
              Directions <ExternalLink size={13} />
            </a>
          </div>
          {estimate > 0 && (
            <div className="context-card">
              <strong>
                ≈<Minutes value={estimate} /> travel
              </strong>
              {leaveBy && (
                <p>
                  Leave by approximately{" "}
                  {leaveBy.toLocaleTimeString([], {
                    timeZone: cfg.timezone,
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {route && (
                <>
                  <small>
                    Checked {new Date(route.checkedAt).toLocaleTimeString()} ·{" "}
                    {route.approximate
                      ? "Arrival planning is approximate."
                      : "Duration is an estimate."}
                  </small>
                  <button
                    className="text-button"
                    onClick={() => onSaved({ travelMinutes: estimate })}
                  >
                    Use this estimate in my plan
                  </button>
                </>
              )}
            </div>
          )}
          <button
            className="text-button"
            onClick={() => {
              if (!window.isSecureContext) {
                setError(
                  "Current location requires a secure connection. Choose Home, Work, or enter an address.",
                );
                return;
              }
              navigator.geolocation?.getCurrentPosition(
                (p) =>
                  onSaved({
                    origin: `${p.coords.latitude},${p.coords.longitude}`,
                  }),
                () =>
                  setError(
                    "Location permission was declined or unavailable. Choose a saved place or manual address.",
                  ),
              );
            }}
          >
            Use current starting location
          </button>
        </>
      )}
      {t.outdoor && (
        <>
          <button disabled={!!busy} onClick={() => void getWeather()}>
            <CloudSun size={14} />
            {busy === "weather" ? "Checking…" : "Check weather"}
          </button>
          {forecast && index >= 0 && (
            <div className="weather-card">
              <CloudSun size={28} />
              <strong>
                {forecast.forecast.daily.temperature_2m_max[index]}° /{" "}
                {forecast.forecast.daily.temperature_2m_min[index]}°
              </strong>
              <p>
                {forecast.forecast.daily.precipitation_probability_max[index]}%
                chance of precipitation
              </p>
              <small>
                Forecast for {t.plannedDay} · Checked{" "}
                {new Date(forecast.checkedAt).toLocaleTimeString()}
              </small>
              {forecast.forecast.daily.precipitation_probability_max[index] >
                60 && (
                <p>
                  Another day may be more comfortable.{" "}
                  {betterDay && (
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Move this task to ${betterDay}? Its scheduled time will be cleared.`,
                          )
                        )
                          onSaved({
                            plannedDay: betterDay,
                            scheduledStart: "",
                            scheduledEnd: "",
                          });
                      }}
                    >
                      Move to {betterDay}
                    </button>
                  )}
                </p>
              )}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
              >
                Weather by Open-Meteo
              </a>
            </div>
          )}
        </>
      )}
      {!destination && (
        <PlaceSearch
          onChoose={(p) =>
            onSaved({
              destination: p.formattedAddress,
              latitude: p.location?.latitude ?? null,
              longitude: p.location?.longitude ?? null,
            })
          }
        />
      )}
    </section>
  );
}
interface MapMarker {
  setMap: (map: unknown) => void;
  addListener: (event: string, fn: () => void) => void;
}
interface MapsApi {
  Map: new (
    node: HTMLElement,
    opts: Record<string, unknown>,
  ) => { fitBounds: (b: unknown) => void; setZoom: (zoom: number) => void };
  Marker: new (opts: Record<string, unknown>) => MapMarker;
  LatLngBounds: new () => { extend: (p: { lat: number; lng: number }) => void };
}
let mapPromise: Promise<MapsApi> | undefined;
function loadMaps(key: string) {
  if (!mapPromise)
    mapPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
      script.async = true;
      script.onload = () =>
        resolve(
          (window as unknown as { google: { maps: MapsApi } }).google.maps,
        );
      script.onerror = () =>
        reject(new Error("Map could not load. Use the itinerary list."));
      document.head.appendChild(script);
    });
  return mapPromise;
}
function GoogleMap({
  tasks,
  selected,
  onOpen,
}: {
  tasks: Entity<Task>[];
  selected: string;
  onOpen: (id: string) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const { workspace } = useWorkspace();
  useEffect(() => {
    if (!key || !node.current) return;
    let disposed = false;
    const markers: MapMarker[] = [];
    loadMaps(key)
      .then((maps) => {
        if (disposed || !node.current) return;
        const map = new maps.Map(node.current, {
          center: { lat: 37.77, lng: -122.42 },
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const bounds = new maps.LatLngBounds();
        let count = 0;
        tasks.forEach((t, index) => {
          const place = recordsOf<Place>(workspace.records, "place").find(
            (p) => p.id === t.data.placeId,
          );
          const lat = t.data.latitude ?? place?.data.latitude;
          const lng = t.data.longitude ?? place?.data.longitude;
          if (lat == null || lng == null) return;
          const position = { lat, lng };
          bounds.extend(position);
          count++;
          const marker = new maps.Marker({
            map,
            position,
            label: String(index + 1),
            title: t.data.title,
            opacity: selected && selected !== t.id?.toString() ? 0.55 : 1,
          });
          marker.addListener("click", () => onOpen(t.id));
          markers.push(marker);
        });
        if (count > 0) {
          map.fitBounds(bounds);
          if (count === 1) map.setZoom(14);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      disposed = true;
      markers.forEach((m) => m.setMap(null));
    };
  }, [key, tasks, selected, onOpen, workspace.records]);
  return key ? (
    <>
      <div className="google-map" ref={node} />
      <ErrorMessage error={error} />
    </>
  ) : (
    <div className="map-placeholder">
      <MapPin size={35} />
      <h3>Your stops, in one place</h3>
      <p>
        Configure the browser Google Maps key to show the map. Your itinerary
        and directions remain available below.
      </p>
    </div>
  );
}
export function OutingView({
  outing,
  onOpen,
  onEdit,
}: {
  outing: Entity<Outing>;
  onOpen: (id: string) => void;
  onEdit: () => void;
}) {
  const { workspace, save, notify } = useWorkspace();
  const [view, setView] = useState(
    () =>
      sessionStorage.getItem(`tide:outing:${outing.id}:view`) || "itinerary",
  );
  useEffect(() => {
    sessionStorage.setItem(`tide:outing:${outing.id}:view`, view);
  }, [view, outing.id]);
  const [selected, setSelected] = useState(
    () => sessionStorage.getItem(`tide:outing:${outing.id}:selected`) || "",
  );
  useEffect(() => {
    sessionStorage.setItem(`tide:outing:${outing.id}:selected`, selected);
  }, [selected, outing.id]);
  const [summary, setSummary] = useState<{
    minutes: number;
    checked: string;
    manual?: boolean;
    legs?: {
      id: string;
      travel: number;
      arrives: string;
      leaves: string;
      conflict: boolean;
    }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const taskMap = recordsOf<Task>(workspace.records, "task");
  const tasks = outing.data.taskIds
    .map((id) => taskMap.find((t) => t.id === id))
    .filter((t): t is Entity<Task> => !!t);
  const places = recordsOf<Place>(workspace.records, "place");
  const resolve = (v: string) =>
    places.find((p) => p.data.name.toLowerCase() === v.toLowerCase())?.data
      .address || v;
  const destination = (t: Entity<Task>) =>
    t.data.destination ||
    places.find((p) => p.id === t.data.placeId)?.data.address ||
    "";
  async function reorder(index: number, delta: number) {
    const ids = [...outing.data.taskIds];
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    try {
      await save("outing", { ...outing.data, taskIds: ids }, outing);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not reorder");
    }
  }
  async function estimate(now: number) {
    setBusy(true);
    setError("");
    try {
      let minutes = 0;
      let origin = resolve(outing.data.origin);
      let cursor = outing.data.departure
        ? Date.parse(outing.data.departure)
        : now;
      const legs = [];
      for (const [index, t] of tasks.entries()) {
        const dest = destination(t);
        const result = await request<RouteResult>("provider", {
          action: "route",
          origin,
          destination: dest,
          travelMode: outing.data.travelMode,
          departure: new Date(cursor).toISOString(),
          arrival:
            index === 0 && !outing.data.departure
              ? outing.data.arrival || undefined
              : undefined,
        });
        const travel = Math.ceil(
          Number.parseInt(result.routes[0].duration) / 60,
        );
        const arrivals =
          index === 0 && outing.data.arrival && !outing.data.departure
            ? Date.parse(outing.data.arrival)
            : cursor +
              (travel + t.data.prepMinutes + t.data.arrivalMinutes) * 60000;
        const taskMinutes =
          t.data.scheduledStart && t.data.scheduledEnd
            ? (Date.parse(t.data.scheduledEnd) -
                Date.parse(t.data.scheduledStart)) /
              60000
            : t.data.estimate;
        const begins = Math.max(
          arrivals,
          t.data.fixed && t.data.scheduledStart
            ? Date.parse(t.data.scheduledStart)
            : arrivals,
        );
        const leaves = begins + taskMinutes * 60000;
        legs.push({
          id: t.id,
          travel,
          arrives: new Date(arrivals).toISOString(),
          leaves: new Date(leaves).toISOString(),
          conflict:
            !!t.data.fixed &&
            !!t.data.scheduledStart &&
            arrivals > Date.parse(t.data.scheduledStart),
        });
        minutes +=
          travel +
          t.data.prepMinutes +
          t.data.arrivalMinutes +
          taskMinutes +
          Math.max(0, (begins - arrivals) / 60000);
        cursor = leaves;
        origin = dest;
      }
      if (outing.data.returnTrip) {
        const result = await request<RouteResult>("provider", {
          action: "route",
          origin,
          destination: resolve(outing.data.returnAddress || outing.data.origin),
          travelMode: outing.data.travelMode,
          departure: new Date(cursor).toISOString(),
        });
        minutes += Math.ceil(Number.parseInt(result.routes[0].duration) / 60);
      }
      setSummary({ minutes, legs, checked: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Route unavailable");
    } finally {
      setBusy(false);
    }
  }
  const dirs = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(resolve(outing.data.origin))}&destination=${encodeURIComponent(outing.data.returnTrip ? resolve(outing.data.returnAddress || outing.data.origin) : tasks.length ? destination(tasks[tasks.length - 1]) : "")}&waypoints=${encodeURIComponent((outing.data.returnTrip ? tasks : tasks.slice(0, -1)).map(destination).join("|"))}&travelmode=${{ DRIVE: "driving", WALK: "walking", BICYCLE: "bicycling", TRANSIT: "transit" }[outing.data.travelMode] || "driving"}`;
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Away from home · Outing</span>
          <h2>{outing.data.title}</h2>
          <p className="muted">
            From {outing.data.origin} · {tasks.length} stops · Order is yours to
            choose
          </p>
        </div>
        <button onClick={onEdit}>Edit outing</button>
      </div>
      <div className="button-row">
        <div className="segmented">
          <button
            className={view === "itinerary" ? "active" : ""}
            onClick={() => setView("itinerary")}
          >
            Itinerary
          </button>
          <button
            className={view === "map" ? "active" : ""}
            onClick={() => setView("map")}
          >
            Map
          </button>
        </div>
        <button disabled={busy} onClick={() => void estimate(Date.now())}>
          {busy ? "Checking routes…" : "Estimate outing"}
        </button>
        <button
          onClick={() =>
            setSummary({
              minutes:
                tasks.reduce(
                  (n, t) =>
                    n +
                    t.data.estimate +
                    t.data.prepMinutes +
                    t.data.arrivalMinutes +
                    t.data.travelMinutes,
                  0,
                ) +
                (outing.data.returnTrip
                  ? tasks.at(-1)?.data.returnMinutes || 0
                  : 0),
              checked: new Date().toISOString(),
              manual: true,
            })
          }
        >
          Use manual estimates
        </button>
        <a className="button" href={dirs} target="_blank" rel="noreferrer">
          Open in Google Maps <ExternalLink size={13} />
        </a>
      </div>
      <ErrorMessage error={error} />
      {summary && (
        <div className="context-card">
          <strong>
            Approximately <Minutes value={summary.minutes} />
          </strong>
          <span>
            {" "}
            including tasks, travel, and buffers{" "}
            {summary.manual ? "· Manual estimates" : ""} · Checked{" "}
            {new Date(summary.checked).toLocaleTimeString()}
          </span>
        </div>
      )}
      {view === "map" && (
        <GoogleMap
          tasks={tasks}
          selected={selected}
          onOpen={(id) => {
            setSelected(id);
            onOpen(id);
          }}
        />
      )}
      <div className="itinerary">
        {tasks.map((t, i) => (
          <div
            className={`itinerary-stop ${selected === t.id ? "selected" : ""}`}
            key={t.id}
          >
            <span className="stop-number">{i + 1}</span>
            <div>
              <TaskRow
                task={t}
                onOpen={(id) => {
                  setSelected(id);
                  onOpen(id);
                }}
              />
              <p className="muted">
                {destination(t) || "Choose a destination in task details"}
                {summary?.legs
                  ?.filter((leg) => leg.id === t.id)
                  .map((leg) => (
                    <span key={leg.id}>
                      <br />≈{leg.travel} min travel · Arrive{" "}
                      {new Date(leg.arrives).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · Finish{" "}
                      {new Date(leg.leaves).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {leg.conflict && (
                        <strong className="overdue">
                          {" "}
                          · Travel conflicts with fixed appointment
                        </strong>
                      )}
                    </span>
                  ))}
              </p>
            </div>
            <div className="stack">
              <button
                className="icon-button"
                aria-label="Move stop up"
                disabled={i === 0}
                onClick={() => void reorder(i, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="icon-button"
                aria-label="Move stop down"
                disabled={i === tasks.length - 1}
                onClick={() => void reorder(i, 1)}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {outing.data.bring.length > 0 && (
        <div className="context-card">
          <h3>Bring this</h3>
          {outing.data.bring.map((c) => (
            <label className="check-label" key={c.id}>
              <input
                type="checkbox"
                checked={c.done}
                onChange={async (e) => {
                  try {
                    await save(
                      "outing",
                      {
                        ...outing.data,
                        bring: outing.data.bring.map((x) =>
                          x.id === c.id ? { ...x, done: e.target.checked } : x,
                        ),
                      },
                      outing,
                    );
                  } catch (err) {
                    notify(
                      err instanceof Error
                        ? err.message
                        : "Could not save checklist",
                    );
                  }
                }}
              />
              {c.text}
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
