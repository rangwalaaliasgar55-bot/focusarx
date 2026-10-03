import { useCallback, useState } from "react";
import {
  DEFAULT_PANEL_ORDER,
  movePanel,
  readPanelOrder,
  reorderPanel,
  writePanelOrder,
  type PanelId,
} from "@/lib/panelLayout";

/**
 * The workspace arrangement, as React state over a storage key.
 *
 * A preference, not a source of truth: the page decides which panels exist, the
 * hook only decides what order the user put them in. Every write goes through
 * `writePanelOrder`, so a stale or hand-edited stored value is normalised before
 * it ever reaches a render.
 */
export function usePanelOrder() {
  const [order, setOrder] = useState<PanelId[]>(() => readPanelOrder());

  const move = useCallback((id: PanelId, delta: number) => {
    setOrder((prev) => writePanelOrder(movePanel(prev, id, delta)));
  }, []);

  const drop = useCallback((id: PanelId, targetId: PanelId) => {
    setOrder((prev) => writePanelOrder(reorderPanel(prev, id, targetId)));
  }, []);

  const reset = useCallback(() => {
    setOrder(writePanelOrder(DEFAULT_PANEL_ORDER));
  }, []);

  return { order, move, drop, reset };
}
