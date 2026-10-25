/** Start background work even when no browser has opened the workspace. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initialize } = await import("./server/store");
    const { startScheduler } = await import("./server/backups");
    await initialize();
    startScheduler();
  }
}
