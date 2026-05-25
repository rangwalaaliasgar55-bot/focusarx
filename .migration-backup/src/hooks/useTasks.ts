"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { STORAGE_KEYS } from "@/lib/constants";
import { generateId } from "@/lib/timerUtils";
import type { Task } from "@/types/timer";

export function useTasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>(STORAGE_KEYS.tasks, []);

  const addTask = useCallback(
    (title: string, estimatedPomodoros = 1) => {
      const task: Task = {
        id: generateId(),
        title,
        estimatedPomodoros,
        completedPomodoros: 0,
        done: false,
        createdAt: new Date().toISOString(),
      };
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
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
      );
    },
    [setTasks]
  );

  const removeTask = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    },
    [setTasks]
  );

  const activeTasks = tasks.filter((t) => !t.done);
  const completedTasks = tasks.filter((t) => t.done);

  return { tasks, activeTasks, completedTasks, addTask, incrementPomodoro, toggleDone, removeTask };
}
