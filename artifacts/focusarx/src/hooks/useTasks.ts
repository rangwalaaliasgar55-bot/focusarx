"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { STORAGE_KEYS } from "@/lib/constants";
import { generateId } from "@/lib/timerUtils";
import { getToken } from "@/lib/auth";
import { trackSiteEvent } from "@/lib/site-analytics";
import type { Task } from "@/types/timer";

function authHeaders() {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function useTasks() {
  const refreshTasks = async () => {};
  const [tasks, setTasks] = useLocalStorage<Task[]>(STORAGE_KEYS.tasks, []);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token || synced) return;
    fetch("/api/tasks", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((d: { tasks?: Array<{ id: string; text: string; completed: boolean; estimatedMinutes: number | null; order: number; priority?: any; category?: string }> } | null) => {
        if (!d?.tasks) return;
        const serverTasks: Task[] = d.tasks.map(t => ({
          id: t.id,
          title: t.text,
          estimatedPomodoros: t.estimatedMinutes ? Math.max(1, Math.round(t.estimatedMinutes / 25)) : 1,
          completedPomodoros: 0,
          done: t.completed,
          createdAt: new Date().toISOString(),
          priority: t.priority ?? "medium",
          category: t.category ?? "Default",
        }));
        setTasks(serverTasks);
        setSynced(true);
      })
      .catch(() => { setSynced(true); });
  }, [synced, setTasks]);

  const addTask = useCallback(
    async (title: string, estimatedPomodoros = 1, priority: "low" | "medium" | "high" = "medium", category = "Default") => {
      const localId = generateId();
      const task: Task = {
        id: localId,
        title,
        estimatedPomodoros,
        completedPomodoros: 0,
        done: false,
        createdAt: new Date().toISOString(),
        priority,
        category,
      };

      setTasks((prev) => [...prev, task]);
      trackSiteEvent("task_created", { title: title.slice(0, 80), priority, category });

      const token = getToken();
      if (token) {
        try {
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ text: title, order: 0, priority, category }),
          });
          if (res.ok) {
            const data = await res.json() as { task?: { id: string } };
            if (data.task?.id) {
              setTasks((prev) => prev.map(t => t.id === localId ? { ...t, id: data.task!.id! } : t));
            }
          }
        } catch { }
      }

      return task;
    },
    [setTasks]
  );

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
      const token = getToken();
      if (token) {
        try {
          await fetch(`/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify(updates),
          });
        } catch {}
      }
    },
    [setTasks]
  );

  const incrementPomodoro = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, completedPomodoros: t.completedPomodoros + 1 }
            : t
        )
      );
    },
    [setTasks]
  );

  const toggleDone = useCallback(
    (taskId: string) => {
      setTasks((prev) => {
        const updated = prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
        const task = updated.find(t => t.id === taskId);
        const token = getToken();
        if (token && task) {
          fetch(`/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ completed: task.done }),
          }).catch(() => {});
        }
        return updated;
      });
    },
    [setTasks]
  );

  const removeTask = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      const token = getToken();
      if (token) {
        fetch(`/api/tasks/${taskId}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
      }
    },
    [setTasks]
  );

  const activeTasks = tasks.filter((t) => !t.done);
  const completedTasks = tasks.filter((t) => t.done);

  return { tasks, activeTasks, completedTasks, addTask, updateTask, incrementPomodoro, toggleDone, removeTask, refreshTasks };
}
