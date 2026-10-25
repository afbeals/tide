"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Entity, Workspace, Kind } from "@/lib/types";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public current?: Entity,
  ) {
    super(message);
  }
}
let currentGeneration = "initial";
export async function request<T = unknown>(
  url: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch("/api/" + url, {
    method: body === undefined ? "GET" : method,
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-Tide-Generation": currentGeneration,
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error || "Request failed",
      response.status,
      data.current,
    );
  if (url === "workspace") currentGeneration = data.generation;
  return data as T;
}
type Context = {
  workspace: Workspace;
  refresh: () => Promise<void>;
  save: <T>(
    kind: Kind,
    data: T,
    entity?: Entity<T>,
    scopeFrom?: string,
  ) => Promise<Entity<T>>;
  remove: (e: Entity) => Promise<void>;
  notify: (text: string) => void;
  notice: string;
  pending: number;
  saveStatus: string;
  online: boolean;
  mutate: <T>(url: string, body: unknown) => Promise<T>;
};
const WorkspaceContext = createContext<Context | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace is not available");
  return context;
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <WorkspaceLoader>{children}</WorkspaceLoader>
    </QueryClientProvider>
  );
}
function WorkspaceLoader({ children }: { children: React.ReactNode }) {
  const query = useQuery({
    queryKey: ["workspace"],
    queryFn: () => request<Workspace>("workspace"),
    refetchInterval: () =>
      typeof document === "undefined" || document.visibilityState === "visible"
        ? 15000
        : false,
  });
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(0);
  const [saveStatus, setSaveStatus] = useState("Connected");
  const refresh = useCallback(async () => {
    await client.invalidateQueries({ queryKey: ["workspace"] });
  }, [client]);
  const mutate = useCallback(
    async <T,>(url: string, body: unknown) => {
      setPending((n) => n + 1);
      try {
        const result = await request<T>(url, body);
        await refresh();
        setSaveStatus("Saved");
        return result;
      } catch (error) {
        setSaveStatus("Unsaved changes");
        await refresh();
        throw error;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [refresh],
  );
  const save = useCallback(
    async <T,>(kind: Kind, data: T, entity?: Entity<T>, scopeFrom?: string) => {
      setPending((n) => n + 1);
      try {
        const result = await request<Entity<T>>(
          entity ? `records/${entity.id}` : "records",
          { kind, data, version: entity?.version, scopeFrom },
          entity ? "PATCH" : "POST",
        );
        await refresh();
        setNotice("Saved");
        setSaveStatus("Saved");
        return result;
      } catch (error) {
        setSaveStatus("Unsaved changes");
        await refresh();
        throw error;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [refresh],
  );
  const remove = useCallback(
    async (entity: Entity) => {
      await request(
        `records/${entity.id}`,
        { version: entity.version },
        "DELETE",
      );
      await refresh();
      setNotice("Deleted");
    },
    [refresh],
  );
  if (!query.data)
    return (
      <div className="boot">
        <span className="brand-sun">☀</span>
        <h1>Tide</h1>
        <p>
          {query.isError
            ? "Couldn’t reach your workspace. Check the server and retry."
            : "Making room for your day…"}
        </p>
        {query.isError && (
          <button onClick={() => query.refetch()}>Retry connection</button>
        )}
      </div>
    );
  return (
    <WorkspaceContext.Provider
      value={{
        workspace: query.data,
        refresh,
        save,
        remove,
        notify: setNotice,
        notice,
        pending,
        saveStatus,
        online: !query.isError,
        mutate,
      }}
    >
      {children}
      {query.isError && (
        <div className="connection-banner" role="alert">
          Server disconnected · Device drafts are preserved.{" "}
          <button onClick={() => query.refetch()}>Retry connection</button>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
