import { useCallback, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_LABELS, type PanelId } from "@/lib/panelLayout";

/**
 * One movable panel of the focus workspace.
 *
 * Everything here exists twice on purpose: a grip for a mouse or a thumb, and
 * two buttons for a keyboard or a screen reader. Dragging is not an accessible
 * interaction on its own — it has no keyboard equivalent, it cannot be
 * described to assistive technology, and it is unusable with a switch — so the
 * buttons are not a fallback, they are the primary contract, and the grip is the
 * shortcut. Moves are announced in a polite live region, because a reordered
 * layout with no announcement is a page that silently rearranged itself.
 *
 * Panels are positioned with flex `order` rather than by moving DOM nodes: the
 * reading order in the markup stays the order the app was designed to be read
 * in, and a reordered page never changes what a crawler or a screen reader
 * reads first.
 */
interface MovablePanelProps {
  id: PanelId;
  /**
   * `data-region` value for the same element, so the layout tests and the
   * stylesheet keep addressing "the timer region" rather than "the wrapper
   * around the timer region". The panel *is* the region once it can move.
   */
  region?: string;
  /** Position in the current arrangement, 0-based. */
  index: number;
  count: number;
  /** Only while the workspace is in arrange mode do the controls render. */
  arranging: boolean;
  onMove: (id: PanelId, delta: number) => void;
  onDrop: (id: PanelId, targetId: PanelId) => void;
  className?: string;
  children: ReactNode;
}

export function MovablePanel({ id, region, index, count, arranging, onMove, onDrop, className, children }: MovablePanelProps) {
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const label = PANEL_LABELS[id];

  const move = useCallback(
    (delta: number) => {
      const to = Math.min(count - 1, Math.max(0, index + delta));
      if (to === index) return;
      onMove(id, delta);
      setAnnouncement(`${label} moved to position ${to + 1} of ${count}`);
    },
    [id, label, onMove, index, count],
  );

  /**
   * The drag path. Pointer events rather than HTML5 drag-and-drop, because the
   * latter does not fire on touch: the same grip has to work under a thumb.
   */
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const host = under?.closest?.("[data-panel]") as HTMLElement | null;
    const target = host?.dataset.panel as PanelId | undefined;
    if (target && target !== id) onDrop(id, target);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragging(false);
    setAnnouncement("");
  };

  return (
    <div
      data-panel={id}
      data-region={region}
      data-panel-order={index}
      style={{ order: index }}
      className={cn(
        "relative",
        dragging && "outline outline-2 outline-offset-2 outline-[var(--brand-400)]",
        className,
      )}
    >
      {arranging && (
        <div
          className="absolute right-2 top-2 z-[var(--z-nav)] flex items-center gap-0.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface-1)] p-1 print:hidden"
          role="group"
          aria-label={`Arrange ${label}`}
        >
          <div
            role="img"
            aria-label={`Drag ${label} to move it`}
            className="grid min-h-[44px] min-w-[44px] cursor-grab touch-none place-items-center rounded-full text-[var(--foreground-subtle)] lg:min-h-[28px] lg:min-w-[28px]"
            onPointerDown={startDrag}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <GripVertical size={16} aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={index === 0}
            aria-label={`Move ${label} earlier`}
            className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-40 lg:min-h-[28px] lg:min-w-[28px]"
          >
            <ChevronUp size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={index === count - 1}
            aria-label={`Move ${label} later`}
            className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-40 lg:min-h-[28px] lg:min-w-[28px]"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      {children}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
