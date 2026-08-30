/**
 * AITaskDecomposer — Break large tasks into actionable subtasks using AI
 * 
 * Blueprint: Weeks 5-6 AI Intelligence
 * Uses Gemini primary + Groq fallback via aiProvider.ts
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, Plus, CheckCircle2 } from 'lucide-react';
import { getToken } from '@/lib/auth';
import { useTasks } from '@/hooks/useTasks';

interface SubTask {
  title: string;
  estimatedMinutes: number;
  description: string;
  completed: boolean;
}

export default function AITaskDecomposer() {
  const [task, setTask] = useState('');
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedToBoard, setAddedToBoard] = useState(false);
  const { refreshTasks } = useTasks();

  const decompose = useCallback(async () => {
    if (!task.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setSubtasks([]);
    setAddedToBoard(false);

    const token = getToken();
    if (!token) {
      setError('Please sign in to use AI task decomposition.');
      setIsLoading(false);
      return;
    }

    const params = new URLSearchParams({ task: task.trim() });

    try {
      const eventSource = new EventSource(`/api/ai/tasks/decompose/stream?${params}&token=${token}`);
      let fullText = '';
      const parsed: SubTask[] = [];

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'token':
            fullText += data.content;
            // Try to parse numbered items as they come in
            const matches = fullText.matchAll(/(\d+)\.\s+\*\*(.+?)\*\*\s*(?:\((\d+)[-\s]?(?:min|mins|minutes?)\))?\s*[-:]?\s*(.*?)(?=\n\d+\.|$)/g);
            const newSubtasks: SubTask[] = [];
            for (const match of matches) {
              newSubtasks.push({
                title: match[2].trim(),
                estimatedMinutes: parseInt(match[3]) || 25,
                description: match[4]?.trim() || '',
                completed: false,
              });
            }
            if (newSubtasks.length > 0) {
              setSubtasks(newSubtasks);
            }
            break;
          case 'done':
            eventSource.close();
            setIsLoading(false);
            break;
          case 'error':
            setError(data.content);
            eventSource.close();
            setIsLoading(false);
            break;
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Fallback to regular API
        fetch(`/api/ai/coach?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.json())
          .then(data => {
            if (data.reply) {
              // Parse the response
              const matches = data.reply.matchAll(/(\d+)\.\s+\*\*(.+?)\*\*\s*(?:\((\d+)[-\s]?(?:min|mins|minutes?)\))?\s*[-:]?\s*(.*?)(?=\n\d+\.|$)/g);
              const parsed: SubTask[] = [];
              for (const match of matches) {
                parsed.push({
                  title: match[2].trim(),
                  estimatedMinutes: parseInt(match[3]) || 25,
                  description: match[4]?.trim() || '',
                  completed: false,
                });
              }
              setSubtasks(parsed);
            } else {
              setError(data.error || 'Failed to decompose task');
            }
            setIsLoading(false);
          })
          .catch(() => {
            setError('Connection failed. Please try again.');
            setIsLoading(false);
          });
      };
    } catch {
      setError('Failed to connect to AI.');
      setIsLoading(false);
    }
  }, [task]);

  const toggleSubtask = useCallback((index: number) => {
    setSubtasks(prev => prev.map((s, i) => 
      i === index ? { ...s, completed: !s.completed } : s
    ));
  }, []);

  const addAllToBoard = useCallback(async () => {
    const token = getToken();
    if (!token || subtasks.length === 0) return;

    try {
      for (const sub of subtasks) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: sub.title,
            description: sub.description,
            estimatedPomodoros: Math.ceil(sub.estimatedMinutes / 25),
          }),
        });
      }
      await refreshTasks();
      setAddedToBoard(true);
    } catch {
      setError('Failed to add tasks to board');
    }
  }, [subtasks, refreshTasks]);

  const totalMinutes = subtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-lg font-black text-[var(--palette-white)] flex items-center justify-center gap-2">
          <Sparkles size={16} className="text-[var(--brand-400)]" />
          AI Task Decomposer
        </h3>
        <p className="text-xs text-[var(--palette-zinc-500)] mt-1">
          Break big tasks into small, actionable steps
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/80 p-5 space-y-4">
        <input
          type="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && decompose()}
          placeholder="e.g., Build a landing page for my product..."
          className="w-full rounded-xl border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-800)] px-4 py-2.5 text-sm text-[var(--palette-white)] placeholder:text-[var(--palette-zinc-600)] focus:outline-none focus:border-[var(--brand-400)]/50"
        />

        <button
          onClick={decompose}
          disabled={!task.trim() || isLoading}
          className="w-full rounded-xl border border-[var(--brand-400)]/40 bg-[var(--rgba-124-58-237-0_15)] px-4 py-2.5 text-xs font-bold text-[var(--brand-400)] transition-all hover:bg-[var(--rgba-124-58-237-0_25)] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <><RefreshCw size={12} className="animate-spin" /> Decomposing...</>
          ) : (
            <><Sparkles size={12} /> Break It Down</>
          )}
        </button>
      </div>

      {/* Subtasks */}
      <AnimatePresence>
        {subtasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-2"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--palette-zinc-500)]">
                {subtasks.length} subtasks · ~{totalMinutes} min total
              </span>
              <span className="text-[var(--palette-zinc-600)]">
                {subtasks.filter(s => s.completed).length}/{subtasks.length} done
              </span>
            </div>

            {subtasks.map((sub, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-all cursor-pointer ${
                  sub.completed
                    ? 'border-[var(--palette-emerald-500)]/20 bg-[var(--palette-emerald-500)]/5'
                    : 'border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/60 hover:border-[var(--palette-zinc-700)]'
                }`}
                onClick={() => toggleSubtask(i)}
              >
                <CheckCircle2
                  size={16}
                  className={`mt-0.5 flex-shrink-0 transition-colors ${
                    sub.completed ? 'text-[var(--palette-emerald-400)]' : 'text-[var(--palette-zinc-600)]'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${sub.completed ? 'text-[var(--palette-zinc-500)] line-through' : 'text-[var(--palette-zinc-200)]'}`}>
                    {sub.title}
                  </p>
                  {sub.description && (
                    <p className="text-[10px] text-[var(--palette-zinc-500)] mt-0.5">{sub.description}</p>
                  )}
                </div>
                <span className="text-[10px] text-[var(--palette-zinc-600)] flex-shrink-0">
                  {sub.estimatedMinutes}m
                </span>
              </motion.div>
            ))}

            {!addedToBoard && (
              <button
                onClick={addAllToBoard}
                className="w-full mt-3 rounded-xl border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 px-4 py-2.5 text-xs font-bold text-[var(--palette-emerald-300)] transition-all hover:bg-[var(--palette-emerald-500)]/20 flex items-center justify-center gap-2"
              >
                <Plus size={12} /> Add All to Task Board
              </button>
            )}

            {addedToBoard && (
              <div className="mt-3 rounded-xl border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 p-3 text-center text-xs font-bold text-[var(--palette-emerald-300)]">
                ✅ All {subtasks.length} subtasks added to your board!
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mt-4 rounded-xl border border-[var(--palette-red-500)]/30 bg-[var(--palette-red-500)]/10 p-3 text-xs text-[var(--palette-red-400)]">
          {error}
        </div>
      )}
    </div>
  );
}
