import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { http, HttpResponse } from "msw";
import { OutingView, TaskLocation } from "../components/Travel";
import { WorkspaceProvider, useWorkspace } from "../components/workspace";
import { recordsOf } from "../lib/types";
import type { Outing, Task } from "../lib/types";
import {
  demoDay,
  editMockWorkspace,
  exampleTask,
  getMockWorkspace,
  patchMockTask,
  record,
} from "./fixtures";

function Content({
  screen,
  onSaved,
  onOpen,
  onEdit,
}: {
  screen: "task" | "outing";
  onSaved: (v: Partial<Task>) => void;
  onOpen: (id: string) => void;
  onEdit: () => void;
}) {
  const { workspace } = useWorkspace();
  return screen === "task" ? (
    <TaskLocation
      task={recordsOf<Task>(workspace.records, "task").find(
        (r) => r.id === "walk",
      )!}
      onSaved={onSaved}
    />
  ) : (
    <OutingView
      outing={recordsOf<Outing>(workspace.records, "outing").find(
        (r) => r.id === "outing",
      )!}
      onOpen={onOpen}
      onEdit={onEdit}
    />
  );
}
function Travel(props: ComponentProps<typeof Content>) {
  return (
    <WorkspaceProvider>
      <Content {...props} />
    </WorkspaceProvider>
  );
}
const meta = {
  title: "Travel/Estimates and outings",
  component: Travel,
  args: { screen: "task", onSaved: fn(), onOpen: fn(), onEdit: fn() },
  tags: ["autodocs"],
} satisfies Meta<typeof Travel>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = () => within(document.body);
const calls = fn();
const provider = http.post("/api/provider", async ({ request }) => {
  const payload = (await request.json()) as { action: string };
  calls(payload);
  const checkedAt = "2026-10-24T12:00:00Z";
  if (payload.action === "weather")
    return HttpResponse.json({
      checkedAt,
      forecast: {
        daily: {
          time: [demoDay, "2026-10-25", "2026-10-26"],
          temperature_2m_max: [19, 21, 22],
          temperature_2m_min: [12, 13, 14],
          precipitation_probability_max: [85, 30, 10],
          weather_code: [61, 2, 0],
        },
      },
    });
  if (payload.action === "place-details")
    return HttpResponse.json({
      checkedAt,
      regularOpeningHours: {
        weekdayDescriptions: ["Saturday: 9:00 AM–6:00 PM"],
      },
      currentOpeningHours: { openNow: true },
    });
  return HttpResponse.json({
    checkedAt,
    approximate: true,
    routes: [{ duration: "1020s", distanceMeters: 1400 }],
  });
});
export const RouteEstimate: Story = {
  parameters: { msw: { handlers: [provider] } },
  beforeEach: () =>
    patchMockTask("walk", {
      origin: "Home",
      arrival: "2026-10-24T18:00:00Z",
      prepMinutes: 5,
      arrivalMinutes: 10,
    }),
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByRole("button", { name: "Check route" }),
    );
    await expect(
      await body().findByText("Arrival planning is approximate.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(body().getByText(/Leave by approximately/)).toBeVisible();
    await expect(calls).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "route",
        origin: "San Francisco, CA",
        destination: "Golden Gate Park",
        arrival: "2026-10-24T18:00:00Z",
      }),
    );
    await userEvent.click(
      body().getByRole("button", { name: "Use this estimate in my plan" }),
    );
    await expect(args.onSaved).toHaveBeenCalledWith({ travelMinutes: 17 });
  },
};
export const RainyForecast: Story = {
  parameters: { msw: { handlers: [provider] } },
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Check weather" }),
    );
    await expect(
      await body().findByText("85% chance of precipitation"),
    ).toBeVisible();
    await expect(
      body().getByRole("button", { name: "Move to 2026-10-26" }),
    ).toBeEnabled();
    await expect(calls).toHaveBeenCalledWith({
      action: "weather",
      latitude: exampleTask("walk").data.latitude,
      longitude: exampleTask("walk").data.longitude,
      day: demoDay,
    });
    await expect(
      body().getByRole("link", { name: "Weather by Open-Meteo" }),
    ).toHaveAttribute("href", "https://open-meteo.com/");
  },
};
export const WeatherRescheduleConsent: Story = {
  parameters: { msw: { handlers: [provider] } },
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByRole("button", { name: "Check weather" }),
    );
    const move = await body().findByRole("button", {
      name: "Move to 2026-10-26",
    });
    const previous = window.confirm;
    try {
      window.confirm = () => false;
      await userEvent.click(move);
      await expect(args.onSaved).not.toHaveBeenCalled();
      window.confirm = () => true;
      await userEvent.click(move);
      await expect(args.onSaved).toHaveBeenCalledWith({
        plannedDay: "2026-10-26",
        scheduledStart: "",
        scheduledEnd: "",
      });
    } finally {
      window.confirm = previous;
    }
  },
};
export const CurrentLocationAndDenial: Story = {
  play: async ({ args }) => {
    const button = await body().findByRole("button", {
      name: "Use current starting location",
    });
    const previous = navigator.geolocation.getCurrentPosition;
    try {
      navigator.geolocation.getCurrentPosition = (accept) =>
        accept({
          coords: { latitude: 37.77, longitude: -122.41 },
        } as GeolocationPosition);
      await userEvent.click(button);
      await expect(args.onSaved).toHaveBeenCalledWith({
        origin: "37.77,-122.41",
      });
      navigator.geolocation.getCurrentPosition = (_accept, reject) =>
        reject?.({ code: 1 } as GeolocationPositionError);
      await userEvent.click(button);
      await expect(await body().findByRole("alert")).toHaveTextContent(
        "Location permission was declined",
      );
      await expect(
        body().getByRole("link", { name: "Directions" }),
      ).toBeVisible();
    } finally {
      navigator.geolocation.getCurrentPosition = previous;
    }
  },
};
export const OpeningHours: Story = {
  parameters: { msw: { handlers: [provider] } },
  beforeEach: () => {
    editMockWorkspace((w) =>
      w.records.push(
        record("place", "park", {
          name: "Park",
          address: "Golden Gate Park",
          placeId: "google-park",
          latitude: 37.7,
          longitude: -122.4,
        }),
      ),
    );
    patchMockTask("walk", { placeId: "park" });
  },
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Check opening hours" }),
    );
    await expect(await body().findByText("Open now")).toBeVisible();
    await expect(body().getByText("Saturday: 9:00 AM–6:00 PM")).toBeVisible();
    await expect(calls).toHaveBeenCalledWith({
      action: "place-details",
      id: "google-park",
    });
  },
};
function twoStops() {
  patchMockTask("presentation", {
    context: "Away from home",
    destination: "Library",
    estimate: 20,
    fixed: true,
    scheduledStart: "2026-10-24T16:00:00Z",
    scheduledEnd: "2026-10-24T16:20:00Z",
  });
  editMockWorkspace((w) => {
    const o = w.records.find((r) => r.id === "outing")!;
    o.data = {
      ...o.data,
      taskIds: ["walk", "presentation"],
      departure: "2026-10-24T16:00:00Z",
      returnTrip: true,
    };
  });
}
export const OutingRouteLegsAndConflict: Story = {
  args: { screen: "outing" },
  beforeEach: twoStops,
  parameters: { msw: { handlers: [provider] } },
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Estimate outing" }),
    );
    await expect(
      await body().findByText(/Travel conflicts with fixed appointment/),
    ).toBeVisible();
    await expect(body().getByText(/Approximately/)).toHaveTextContent("1h 41m");
    await expect(
      calls.mock.calls.map((c) => [c[0].origin, c[0].destination]),
    ).toEqual([
      ["San Francisco, CA", "Golden Gate Park"],
      ["Golden Gate Park", "Library"],
      ["Library", "San Francisco, CA"],
    ]);
    await expect(
      body().getByRole("link", { name: "Open in Google Maps" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("waypoints=Golden%20Gate%20Park%7CLibrary"),
    );
  },
};
export const ManualEstimateAndMapFallback: Story = {
  args: { screen: "outing" },
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByRole("button", { name: "Estimate outing" }),
    );
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "manual travel estimate",
    );
    await userEvent.click(
      body().getByRole("button", { name: "Use manual estimates" }),
    );
    await expect(body().getByText(/Approximately/)).toHaveTextContent("45 min");
    await userEvent.click(body().getByRole("button", { name: "Map" }));
    await expect(
      body().getByRole("heading", { name: "Your stops, in one place" }),
    ).toBeVisible();
    await userEvent.click(body().getByRole("button", { name: "Itinerary" }));
    await expect(
      body().queryByRole("heading", { name: "Your stops, in one place" }),
    ).not.toBeInTheDocument();
    await userEvent.click(body().getByRole("button", { name: "Edit outing" }));
    await expect(args.onEdit).toHaveBeenCalled();
  },
};
export const ReorderAndPack: Story = {
  args: { screen: "outing" },
  beforeEach: twoStops,
  play: async () => {
    await userEvent.click(
      (await body().findAllByRole("button", { name: "Move stop down" }))[0],
    );
    await waitFor(() =>
      expect(
        getMockWorkspace().records.find((r) => r.id === "outing")?.data.taskIds,
      ).toEqual(["presentation", "walk"]),
    );
    await userEvent.click(
      body().getAllByRole("button", { name: "Move stop up" })[1],
    );
    await waitFor(() =>
      expect(
        getMockWorkspace().records.find((r) => r.id === "outing")?.data.taskIds,
      ).toEqual(["walk", "presentation"]),
    );
    await userEvent.click(body().getByRole("checkbox", { name: "Water" }));
    await waitFor(() =>
      expect(
        getMockWorkspace().records.find((r) => r.id === "outing")?.data.bring,
      ).toEqual([expect.objectContaining({ done: true })]),
    );
  },
};
