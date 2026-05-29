"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { STORAGE_KEYS } from "@/lib/constants";
import { generateId } from "@/lib/timerUtils";
import { getToken } from "@/lib/auth";
import type { Task } from "@/types/timer";

function authHeaders() {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function useTasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>(STORAGE_KEYS.tasks, []);
  const [synced, setSynced] = useState(false);

  // On mount: if authenticated, load tasks from the server and merge into local state
  useEffect(() => {
    const token = getToken();
    if (!token || synced) return;
    fetch("/api/tasks", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((d: { tasks?: Array<{ id: string; text: string; completed: boolean; estimatedMinutes: number | null; order: number }> } | null) => {
        if (!d?.tasks) return;
        const serverTasks: Task[] = d.tasks.map(t => ({
          id: t.id,
          title: t.text,
          estimatedPomodoros: t.estimatedMinutes ? Math.max(1, Math.round(t.estimatedMinutes / 25)) : 1,
          completedPomodoros: 0,
          done: t.completed,
          createdAt: new Date().toISOString(),
        }));
        setTasks(serverTasks);
        setSynced(true);
      })
      .catch(() => { setSynced(true); });
  }, [synced, setTasks]);

  const addTask = useCallback(
    async (title: string, estimatedPomodoros = 1) => {
      const localId = generateId();
      const task: Task = {
        id: localId,
        title,
        estimatedPomodoros,
        completedPomodoros: 0,
        done: false,
        createdAt: new Date().toISOString(),
      };

      const token = getToken();
      if (token) {
        try {
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ text: title, order: 0 }),
          });
          if (res.ok) {
            const data = await res.json() as { task?: { id: string } };
            if (data.task?.id) task.id = data.task.id;
          }
        } catch { }
      }

      setTasks((prev) => [...prev, task]);
      return task;
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

  return { tasks, activeTasks, completedTasks, addTask, incrementPomodoro, toggleDone, removeTask };
}
