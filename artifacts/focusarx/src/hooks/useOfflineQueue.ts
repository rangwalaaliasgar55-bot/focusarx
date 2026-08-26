"use client";

import { useCallback, useEffect, useState } from "react";

type QueuedItem = {
  id: string;
  idempotencyKey: string;
  payload: any;
  createdAt: number;
  attempts: number;
};

const QUEUE_KEY = "focusarx-offline-queue";
const MAX_ATTEMPTS = 5;

function loadQueue(): QueuedItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedItem[];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

/**
 * Offline retry queue for completed sessions.
 * - Persists to localStorage
 * - Retries on reconnect
 * - Uses idempotencyKey to prevent duplicates
 * - Clear sync status UI
 */
export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedItem[]>(() => (typeof window !== "undefined" ? loadQueue() : []));
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    setQueue(loadQueue());
  }, []);

  const enqueue = useCallback((payload: any, idempotencyKey?: string) => {
    const key = idempotencyKey || `completion_${payload.sessionId || Date.now()}_${Math.random().toString(36).slice(2)}`;
    const item: QueuedItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      idempotencyKey: key,
      payload: { ...payload, idempotencyKey: key },
      createdAt: Date.now(),
      attempts: 0,
    };
    const next = [...loadQueue(), item];
    saveQueue(next);
    setQueue(next);
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    const next = loadQueue().filter((i) => i.id !== id);
    saveQueue(next);
    setQueue(next);
  }, []);

  const processQueue = useCallback(async () => {
    const current = loadQueue();
    if (current.length === 0 || syncing) return;
    if (!navigator.onLine) return;

    setSyncing(true);
    const remaining: QueuedItem[] = [];

    for (const item of current) {
      if (item.attempts >= MAX_ATTEMPTS) {
        // Drop after max attempts but keep for debugging? For now drop
        continue;
      }
      try {
        const token = localStorage.getItem("focusarx-auth-token");
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(item.payload),
        });
        if (res.ok || res.status === 409) {
          // 409 = duplicate (idempotency hit) -> treat as success
          continue;
        } else {
          // Retry later
          remaining.push({ ...item, attempts: item.attempts + 1 });
        }
      } catch {
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    }

    saveQueue(remaining);
    setQueue(remaining);
    setSyncing(false);
  }, [syncing]);

  // Auto-process on online event and on mount
  useEffect(() => {
    const handleOnline = () => void processQueue();
    window.addEventListener("online", handleOnline);
    // Try once on mount
    void processQueue();
    // Periodic retry every 30s
    const id = setInterval(() => void processQueue(), 30000);
    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(id);
    };
  }, [processQueue]);

  return {
    queue,
    queueCount: queue.length,
    syncing,
    enqueue,
    remove,
    processQueue,
    refresh,
    hasPending: queue.length > 0,
  };
}
