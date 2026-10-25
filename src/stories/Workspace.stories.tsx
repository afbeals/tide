import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Tide } from "../components/Tide";
import { demoDay, resetWorkspace } from "./fixtures";
const page = (section: string, more: Record<string, string> = {}) => ({
  fullscreen: true,
  nextjs: {
    appDirectory: true,
    navigation: {
      pathname: "/",
      query: { section, person: "alex", day: demoDay, ...more },
    },
  },
});
const meta = {
  title: "Screens/Workspace",
  component: Tide,
  parameters: page("today"),
  tags: ["autodocs"],
} satisfies Meta<typeof Tide>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Today: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("heading", {
        name: "Today",
      }),
    ).toBeVisible();
  },
};
export const TodayLightCompact: Story = {
  globals: { theme: "light", density: "compact" },
};
export const AllPeople: Story = {
  parameters: page("today", { person: "all" }),
};
export const Upcoming: Story = { parameters: page("upcoming") };
export const Inbox: Story = { parameters: page("inbox") };
export const AllTasks: Story = { parameters: page("all") };
export const Board: Story = { parameters: page("all", { view: "board" }) };
export const Timeline: Story = {
  parameters: page("today", { view: "timeline" }),
};
export const Someday: Story = { parameters: page("someday") };
export const Projects: Story = { parameters: page("projects") };
export const ProjectDetails: Story = {
  parameters: page("projects", { project: "team" }),
};
export const SavedViews: Story = { parameters: page("saved") };
export const Routines: Story = { parameters: page("routines") };
export const ReferenceLibrary: Story = { parameters: page("library") };
export const Outings: Story = { parameters: page("outings") };
export const ManualItinerary: Story = {
  parameters: page("outings", { task: "outing" }),
};
export const History: Story = { parameters: page("history") };
export const Trash: Story = { parameters: page("trash") };
export const Settings: Story = { parameters: page("settings") };
export const Backups: Story = { parameters: page("backups") };
export const TaskInspector: Story = {
  parameters: page("today", { task: "presentation" }),
};
export const AwayTask: Story = { parameters: page("today", { task: "walk" }) };
export const EmptyWorkspace: Story = {
  beforeEach: () => resetWorkspace({ empty: true }),
};
