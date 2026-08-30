/**
 * YouTube Focus Timer - Play channel videos during focus sessions
 * 
 * Blueprint: Weeks 7-8 3D Gamification
 * 
 * Embeds YouTube videos from the FocusArx channel as background
 * during focus sessions. Users can toggle audio on/off.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Youtube, X, ExternalLink } from "lucide-react";

interface YouTubeFocusTimerProps {
  isActive: boolean;
  sessionDuration: number;
}

// Curated list of focus/study videos from the channel
const FOCUS_VIDEOS = [
  { id: "jfKfPfPxWh8", title: "Lofi Hip Hop Radio - Beats to Relax/Study to", channel: "Lofi Girl" },
  { id: "5qap5aO4i9A", title: "Chill Study Beats", channel: "The Jazz Hop Café" },
  { id: "DWcJFNfaw9c", title: "Peaceful Piano", channel: "Lofi Girl" },
  { id: "lTRiuFIWV54", title: "Deep Focus Music", channel: "Greenred Productions" },
  { id: "eKFTSSKCzWA", title: "Coding Music", channel: "Work With Me" },
];

export default function YouTubeFocusTimer({ isActive, sessionDuration }: YouTubeFocusTimerProps) {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentVideo = FOCUS_VIDEOS[currentVideoIndex];

  // Auto-pause when session ends
  useEffect(() => {
    if (!isActive) {
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const nextVideo = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % FOCUS_VIDEOS.length);
    setIsPlaying(true);
  };

  const closePlayer = () => {
    setIsPlaying(false);
    setShowControls(false);
  };

  if (!showControls && !isPlaying) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setShowControls(true)}
        className="flex items-center gap-2 rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] px-3 py-2 text-xs font-bold text-[var(--foreground-muted)] transition-all hover:border-[var(--brand-400)]/30 hover:bg-[var(--brand-soft)]"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Youtube size={14} className="text-[var(--brand-400)]" />
        Play Focus Music
      </motion.button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--forge-border)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Youtube size={16} className="text-[var(--brand-400)]" />
          <h3 className="text-sm font-bold">Focus Music</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="rounded-lg p-1.5 text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            onClick={closePlayer}
            className="rounded-lg p-1.5 text-[var(--foreground-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Video Player */}
      <div className="relative aspect-video w-full bg-black">
        {isPlaying ? (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${currentVideo.id}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${currentVideo.id}&controls=0&showinfo=0&rel=0&modestbranding=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <button
              onClick={togglePlay}
              className="flex items-center gap-2 rounded-full bg-[var(--brand-600)] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[var(--brand-500)]"
            >
              <Play size={16} />
              Play
            </button>
          </div>
        )}
      </div>

      {/* Video Info & Controls */}
      <div className="border-t border-[var(--forge-border)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">{currentVideo.title}</p>
            <p className="text-[10px] text-[var(--foreground-subtle)]">{currentVideo.channel}</p>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <button
              onClick={nextVideo}
              className="rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-bold transition-colors hover:bg-[var(--surface-3)]"
            >
              Next
            </button>
            <a
              href={`https://www.youtube.com/watch?v=${currentVideo.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-[10px] font-bold text-[var(--brand-400)] transition-colors hover:bg-[var(--brand-soft)]/80"
            >
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
