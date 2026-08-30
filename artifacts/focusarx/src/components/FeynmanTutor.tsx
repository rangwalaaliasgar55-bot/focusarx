/**
 * FeynmanTutor — Interactive AI-powered Feynman technique tutor
 * 
 * Users enter a topic and level, then get an AI-generated explanation
 * that follows the Feynman method: simple language, analogies, no jargon.
 * 
 * Blueprint: Weeks 5-6 AI Intelligence
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, RefreshCw, Copy, Check, BookOpen } from 'lucide-react';
import { getToken } from '@/lib/auth';

type ComplexityLevel = 'child' | 'teen' | 'adult';

const LEVELS: { value: ComplexityLevel; label: string; desc: string }[] = [
  { value: 'child', label: '👶 Like I\'m 12', desc: 'Simplest terms, everyday analogies' },
  { value: 'teen', label: '🧑 Like I\'m 16', desc: 'Clear explanations with some detail' },
  { value: 'adult', label: '🎓 Clear & Concise', desc: 'No jargon, practical understanding' },
];

const EXAMPLE_TOPICS = [
  'Quantum Computing',
  'How GPS Works',
  'Machine Learning',
  'Blockchain',
  'Photosynthesis',
  'Supply and Demand',
  'Neural Networks',
  'How Vaccines Work',
];

interface FeynmanResponse {
  whatItIs: string;
  whyItMatters: string;
  howItWorks: string;
  analogy: string;
}

export default function FeynmanTutor() {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<ComplexityLevel>('teen');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const explain = useCallback(async () => {
    if (!topic.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setResponse('');

    const token = getToken();
    if (!token) {
      setError('Please sign in to use the Feynman tutor.');
      setIsLoading(false);
      return;
    }

    const params = new URLSearchParams({ topic: topic.trim(), level });
    
    try {
      // Use SSE streaming for real-time response
      const eventSource = new EventSource(`/api/ai/feynman/stream?${params}&token=${token}`);
      let fullText = '';

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'token':
            fullText += data.content;
            setResponse(fullText);
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
        // Fallback to regular API if SSE fails
        eventSource.close();
        fetch(`/api/ai/coach?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.json())
          .then(data => {
            if (data.reply) {
              setResponse(data.reply);
            } else {
              setError(data.error || 'Failed to get explanation');
            }
            setIsLoading(false);
          })
          .catch(() => {
            setError('Connection failed. Please try again.');
            setIsLoading(false);
          });
      };
    } catch {
      setError('Failed to connect to AI tutor.');
      setIsLoading(false);
    }
  }, [topic, level]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [response]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-emerald-500)]/30 bg-[var(--palette-emerald-500)]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--palette-emerald-300)] mb-4">
          <Brain size={12} /> AI Feynman Tutor
        </div>
        <h2 className="text-2xl font-black text-[var(--palette-white)]">
          Understand Anything
        </h2>
        <p className="text-sm text-[var(--palette-zinc-500)] mt-1">
          Enter any topic — get a crystal-clear explanation
        </p>
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/80 p-6 space-y-4">
        <div>
          <label className="text-xs font-bold text-[var(--palette-zinc-400)] uppercase tracking-wider mb-2 block">
            Topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && explain()}
            placeholder="e.g., Quantum Computing, How GPS Works..."
            className="w-full rounded-xl border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-800)] px-4 py-3 text-sm text-[var(--palette-white)] placeholder:text-[var(--palette-zinc-600)] focus:outline-none focus:border-[var(--palette-emerald-500)]/50"
          />
        </div>

        {/* Complexity Level */}
        <div>
          <label className="text-xs font-bold text-[var(--palette-zinc-400)] uppercase tracking-wider mb-2 block">
            Explain it like I'm...
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                onClick={() => setLevel(l.value)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
                  level === l.value
                    ? 'border-[var(--palette-emerald-500)]/50 bg-[var(--palette-emerald-500)]/15 text-[var(--palette-emerald-300)]'
                    : 'border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-800)]/50 text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)]'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Example topics */}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_TOPICS.slice(0, 5).map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className="rounded-full border border-[var(--palette-zinc-700)]/50 bg-[var(--palette-zinc-800)]/40 px-2.5 py-1 text-[10px] text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] transition-colors"
            >
              {t}
            </button>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={explain}
          disabled={!topic.trim() || isLoading}
          className="w-full rounded-xl border border-[var(--palette-emerald-500)]/40 bg-[var(--palette-emerald-500)]/15 px-4 py-3 text-sm font-bold text-[var(--palette-emerald-300)] transition-all hover:bg-[var(--palette-emerald-500)]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Explaining...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Explain with Feynman Method
            </>
          )}
        </button>
      </div>

      {/* Response */}
      <AnimatePresence>
        {(response || isLoading) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-6 rounded-2xl border border-[var(--palette-emerald-500)]/20 bg-[var(--palette-emerald-500)]/5 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--palette-emerald-400)]">
                <BookOpen size={14} />
                Explanation
              </div>
              {response && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 rounded-lg border border-[var(--palette-zinc-700)] px-2 py-1 text-[10px] text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)]"
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            
            <div className="text-sm text-[var(--palette-zinc-300)] leading-relaxed whitespace-pre-wrap">
              {response}
              {isLoading && (
                <span className="inline-block w-2 h-4 ml-1 bg-[var(--palette-emerald-400)] animate-pulse" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl border border-[var(--palette-red-500)]/30 bg-[var(--palette-red-500)]/10 p-4 text-sm text-[var(--palette-red-400)]">
          {error}
        </div>
      )}
    </div>
  );
}
