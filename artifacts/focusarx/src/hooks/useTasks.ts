
import { useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generateId } from "@/lib/timerUtils";
import { apiJson, apiFetch } from "@/lib/api";
import { trackSiteEvent } from "@/lib/site-analytics";
import type { Task } from "@/types/timer";

type ServerTask = {
  id: string;
  text: string;
  completed: boolean;
  estimatedMinutes: number | null;
  priority?: Task["priority"];
  category?: string;
  dueDate?: string | null;
  tags?: string[];
  createdAt?: string;
};
type TaskUpdate = Partial<Task> & { completed?: boolean };
type NewTaskOptions = {
  estimatedMinutes?: number | null;
  priority?: Task["priority"];
  category?: string;
  dueDate?: string | null;
  tags?: string[];
};
const key = ["tasks"] as const;
const toTask = (task: ServerTask): Task => ({
  id: task.id,
  title: task.text,
  done: task.completed,
  estimatedPomodoros: task.estimatedMinutes ? Math.max(1, Math.round(task.estimatedMinutes / 25)) : 1,
  completedPomodoros: 0,
  createdAt: task.createdAt ?? new Date().toISOString(),
  priority: task.priority ?? "medium",
  category: task.category ?? "Default",
  estimatedMinutes: task.estimatedMinutes,
  dueDate: task.dueDate ?? null,
  tags: task.tags ?? [],
});
const refreshEvery = typeof document === "undefined" || document.visibilityState === "visible" ? 20_000 : false;

/** Shared task cache: every screen observes the same optimistic task state. */
export function useTasks() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await apiJson<{ tasks: ServerTask[] }>("/api/tasks")).tasks.map(toTask),
    refetchInterval: refreshEvery,
  });
  const tasks = useMemo(() => query.data ?? [], [query.data]);
  const invalidateRelated = useCallback(() => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    void qc.invalidateQueries({ queryKey: ["analytics"] });
    void qc.invalidateQueries({ queryKey: ["wallet"] });
  }, [qc]);

  const add = useMutation({
    mutationFn: ({ title, ...options }: { title: string } & NewTaskOptions) => apiJson<{ task: ServerTask }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ text: title, order: 0, priority: options.priority ?? "medium", category: options.category ?? "General", estimatedMinutes: options.estimatedMinutes ?? undefined, dueDate: options.dueDate ?? undefined, tags: options.tags ?? [] }),
    }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key }); const previous = qc.getQueryData<Task[]>(key) ?? [];
      const estimate = input.estimatedMinutes ?? 25;
      const optimistic: Task = { id: `pending-${generateId()}`, title: input.title, done: false, estimatedPomodoros: Math.max(1, Math.round(estimate / 25)), completedPomodoros: 0, createdAt: new Date().toISOString(), priority: input.priority ?? "medium", category: input.category ?? "General", estimatedMinutes: input.estimatedMinutes ?? null, dueDate: input.dueDate ?? null, tags: input.tags ?? [] };
      qc.setQueryData<Task[]>(key, [...previous, optimistic]); return { previous, optimistic };
    },
    onError: (_e, _v, context) => qc.setQueryData(key, context?.previous),
    onSuccess: (data, _v, context) => qc.setQueryData<Task[]>(key, old => (old ?? []).map(task => task.id === context?.optimistic.id ? toTask(data.task) : task)),
    onSettled: invalidateRelated,
  });
  const change = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TaskUpdate }) => apiFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
    onMutate: async ({ id, updates }) => { await qc.cancelQueries({ queryKey: key }); const previous = qc.getQueryData<Task[]>(key) ?? []; qc.setQueryData<Task[]>(key, old => (old ?? []).map(task => task.id === id ? { ...task, ...updates } : task)); return { previous }; },
    onError: (_e, _v, context) => qc.setQueryData(key, context?.previous), onSettled: invalidateRelated,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/tasks/${id}`, { method: "DELETE" }),
    onMutate: async id => { await qc.cancelQueries({ queryKey: key }); const previous = qc.getQueryData<Task[]>(key) ?? []; qc.setQueryData<Task[]>(key, old => (old ?? []).filter(task => task.id !== id)); return { previous }; },
    onError: (_e, _v, context) => qc.setQueryData(key, context?.previous), onSettled: invalidateRelated,
  });
  const addTask = useCallback(async (title: string, options: NewTaskOptions = {}) => {
    const priority = options.priority ?? "medium";
    const category = options.category ?? "General";
    trackSiteEvent("task_created", { title: title.slice(0, 80), priority, category, estimatedMinutes: options.estimatedMinutes ?? null, hasDueDate: Boolean(options.dueDate) });
    return add.mutateAsync({ title, ...options, priority, category });
  }, [add]);
  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => change.mutateAsync({ id, updates }), [change]);
  const toggleDone = useCallback((id: string) => { const task = tasks.find(t => t.id === id); if (task) change.mutate({ id, updates: { done: !task.done, completed: !task.done } }); }, [tasks, change]);
  return { tasks, activeTasks: tasks.filter(t => !t.done), completedTasks: tasks.filter(t => t.done), addTask, updateTask, incrementPomodoro: (id: string) => change.mutate({ id, updates: { completedPomodoros: (tasks.find(t => t.id === id)?.completedPomodoros ?? 0) + 1 } }), toggleDone, removeTask: (id: string) => remove.mutate(id), refreshTasks: query.refetch, isLoading: query.isLoading, isError: query.isError };
}
