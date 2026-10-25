"use client";

import type { ReactNode } from "react";
import { cloneElement, isValidElement, useId, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import type { CheckItem } from "@/lib/types";

export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const opener = useRef(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement | null),
  );
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "modal-wide" : ""}`}
          {...(!description ? { "aria-describedby": undefined } : {})}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            else document.querySelector<HTMLElement>(".topbar button")?.focus();
          }}
        >
          <header className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description>{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </header>
          <div
            className="modal-body"
            role="region"
            aria-label={`${title} content`}
            tabIndex={0}
          >
            {children}
          </div>
          {footer && <footer className="modal-footer">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const native =
    isValidElement<{ id?: string; "aria-labelledby"?: string }>(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type);
  const controlId = native ? children.props.id || `${id}-control` : undefined;
  const control = native
    ? cloneElement(children, { id: controlId, "aria-labelledby": id })
    : children;
  return (
    <label className="field" htmlFor={controlId}>
      <span id={id}>{label}</span>
      {control}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">◌</div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Checklist({
  items,
  onChange,
}: {
  items: CheckItem[];
  onChange: (items: CheckItem[]) => void;
}) {
  return (
    <div className="checklist">
      {items.map((item, i) => (
        <div className="checklist-row" key={item.id}>
          <input
            type="checkbox"
            aria-label={`Complete ${item.text}`}
            checked={item.done}
            onChange={(e) =>
              onChange(
                items.map((c) =>
                  c.id === item.id ? { ...c, done: e.target.checked } : c,
                ),
              )
            }
          />
          <input
            aria-label="Checklist item"
            value={item.text}
            onChange={(e) =>
              onChange(
                items.map((c) =>
                  c.id === item.id ? { ...c, text: e.target.value } : c,
                ),
              )
            }
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Move item up"
            disabled={i === 0}
            onClick={() => {
              const next = [...items];
              [next[i - 1], next[i]] = [next[i], next[i - 1]];
              onChange(next);
            }}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Move item down"
            disabled={i === items.length - 1}
            onClick={() => {
              const next = [...items];
              [next[i + 1], next[i]] = [next[i], next[i + 1]];
              onChange(next);
            }}
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Remove item"
            onClick={() => onChange(items.filter((c) => c.id !== item.id))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        onClick={() =>
          onChange([
            ...items,
            { id: crypto.randomUUID(), text: "", done: false },
          ])
        }
      >
        <Plus size={14} /> Add checklist item
      </button>
    </div>
  );
}
export function Minutes({ value }: { value: number }) {
  return (
    <>
      {value >= 60
        ? `${Math.floor(value / 60)}h ${Math.round(value % 60) ? `${Math.round(value % 60)}m` : ""}`
        : `${Math.round(value)} min`}
    </>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`badge status-${status.replaceAll(/[^a-z]/gi, "").toLowerCase()}`}
    >
      {status}
    </span>
  );
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div className="error-message" role="alert">
      {error}
    </div>
  ) : null;
}
