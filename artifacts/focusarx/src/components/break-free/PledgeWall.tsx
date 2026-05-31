import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetBreakFreePledgesQueryKey,
  getGetBreakFreePledgesQueryOptions,
  usePostBreakFreePledge,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";

const OFFENSIVE = ["fuck", "shit", "ass", "bitch", "cunt", "nigger", "nigga", "faggot", "retard", "whore", "slut", "dick", "cock", "pussy", "bastard"];

function sanitize(msg: string): string {
  let out = msg;
  for (const w of OFFENSIVE) {
    out = out.replace(new RegExp(`\\b${w}\\b`, "gi"), "***");
  }
  return out;
}

function relativeTime(date: string | Date) {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PledgeWall() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");

  const { data, isLoading } = useQuery(getGetBreakFreePledgesQueryOptions());
  const pledges = data?.pledges ?? [];

  const postMutation = usePostBreakFreePledge({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetBreakFreePledgesQueryKey() });
      setMsg("");
    },
  });

  function handleSubmit() {
    const clean = sanitize(msg.trim()).slice(0, 100);
    if (!clean) return;
    postMutation.mutate({ data: { message: clean } });
  }

  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl border border-teal-900/25 bg-[#061212] overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-teal-900/20">
          <p className="text-xs font-semibold text-teal-300">Anonymous Pledge Wall</p>
          <p className="text-[11px] text-teal-700 mt-0.5">No account needed. Your words help someone else.</p>
        </div>

        {/* Post form */}
        <div className="flex gap-2 p-4 border-b border-teal-900/20">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value.slice(0, 100))}
            placeholder="Write a pledge or message of strength…"
            className="flex-1 min-w-0 rounded-xl border border-teal-900/30 bg-[#030e0e] px-3 py-2 text-xs text-teal-100 placeholder-[#2a4040] outline-none focus:border-teal-600/50 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!msg.trim() || postMutation.isPending}
            className="flex items-center gap-1.5 rounded-xl border border-teal-600/30 bg-teal-900/30 px-3 py-2 text-xs font-semibold text-teal-300 hover:bg-teal-900/50 transition-colors disabled:opacity-40"
          >
            <Send size={12} />
            Post
          </button>
        </div>
        <p className="text-right text-[9px] text-[#1a3030] px-4 py-1">{msg.length}/100</p>

        {/* Pledge list */}
        <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-2">
          {isLoading && (
            <div className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-900 border-t-teal-500" />
            </div>
          )}
          {!isLoading && pledges.length === 0 && (
            <p className="text-center text-xs text-[#1a3030] py-6">
              Be the first to post a pledge. ✨
            </p>
          )}
          <AnimatePresence initial={false}>
            {pledges.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border border-teal-900/20 bg-[#030e0e] px-3 py-2.5"
              >
                <p className="text-xs text-teal-200 leading-relaxed">"{p.message}"</p>
                <p className="text-[9px] text-[#1a3030] mt-1">{relativeTime(p.postedAt)}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
