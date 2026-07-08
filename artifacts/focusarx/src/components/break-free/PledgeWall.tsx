import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetBreakFreePledgesQueryKey,
  getGetBreakFreePledgesQueryOptions,
  usePostBreakFreePledge,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import { useToast } from "@/components/Toast";
import { breakFreeErrorMessage } from "@/lib/break-free-errors";

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
  const { toast } = useToast();
  const [msg, setMsg] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery(getGetBreakFreePledgesQueryOptions());
  const pledges = data?.pledges ?? [];

  const postMutation = usePostBreakFreePledge({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetBreakFreePledgesQueryKey() });
        setMsg("");
        toast("Pledge posted ✓", "success");
      },
      onError: (err) => toast(breakFreeErrorMessage(err, "Could not post pledge"), "error"),
    },
  });

  function handleSubmit() {
    const clean = sanitize(msg.trim()).slice(0, 100);
    if (!clean) return;
    postMutation.mutate({ data: { message: clean } });
  }

  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl border border-[rgba(124,58,237,0.15)] bg-[#0d0f1c] overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-[rgba(124,58,237,0.1)]">
          <p className="text-xs font-semibold text-[#A78BFA]">Anonymous Pledge Wall</p>
          <p className="text-[11px] text-[#4B5563] mt-0.5">No account needed. Your words help someone else.</p>
        </div>

        {/* Post form */}
        <div className="flex gap-2 p-4 border-b border-[rgba(124,58,237,0.1)]">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value.slice(0, 100))}
            placeholder="Write a pledge or message of strength…"
            className="flex-1 min-w-0 rounded-xl border border-[rgba(124,58,237,0.2)] bg-[#070810] px-3 py-2 text-xs text-[#E2E8F0] placeholder-[#4B5563] outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!msg.trim() || postMutation.isPending}
            className="flex items-center gap-1.5 rounded-xl border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-3 py-2 text-xs font-semibold text-[#A78BFA] hover:bg-[rgba(124,58,237,0.2)] transition-colors disabled:opacity-40"
          >
            <Send size={12} />
            Post
          </button>
        </div>
        <p className="text-right text-[9px] text-[#3a3d4a] px-4 py-1">{msg.length}/100</p>

        {/* Pledge list */}
        <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-2">
          {isLoading && (
            <div className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.2)] border-t-[#7C3AED]" />
            </div>
          )}
          {isError && !isLoading && (
            <div className="text-center py-6 space-y-2">
              <p className="text-xs text-[#A78BFA]">{breakFreeErrorMessage(error, "Could not load pledges")}</p>
              <button
                onClick={() => refetch()}
                className="text-[10px] text-[#7C3AED] underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && pledges.length === 0 && (
            <p className="text-center text-xs text-[#3a3d4a] py-6">
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
                className="rounded-xl border border-[rgba(124,58,237,0.1)] bg-[#070810] px-3 py-2.5"
              >
                <p className="text-xs text-[#E2E8F0] leading-relaxed">"{p.message}"</p>
                <p className="text-[9px] text-[#3a3d4a] mt-1">{relativeTime(p.postedAt)}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
