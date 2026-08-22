import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Clock } from "lucide-react";

export default function DemoVideoSection() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="w-full max-w-2xl mx-auto px-4 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
      >
        {/* Section header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-[var(--rgba-255-255-255-0_04)]" />
          <div className="flex items-center gap-2">
            <Play size={12} className="text-[var(--brand-600)]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
              See how it works
            </p>
          </div>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[var(--rgba-255-255-255-0_04)]" />
        </div>

        <h3 className="text-center text-base font-bold text-[var(--foreground)] mb-1">
          Watch a quick demo
        </h3>
        <p className="text-center text-xs text-[var(--foreground-subtle)] mb-4 flex items-center justify-center gap-1.5">
          <Clock size={11} />
          Under 2 minutes — everything you need to know
        </p>

        {/* Video embed */}
        <div className="relative rounded-2xl overflow-hidden border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_04)] shadow-[0_0_40px_var(--rgba-124-58-237-0_08)]">
          {!playing ? (
            /* Thumbnail / play gate */
            <div className="relative aspect-video flex items-center justify-center group cursor-pointer" onClick={() => setPlaying(true)}>
              {/* Gradient placeholder thumbnail */}
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--rgba-8-9-20-0_95)] via-[var(--rgba-12-13-28-0_98)] to-[var(--rgba-6-7-18-0_99)]" />
              <div className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: "radial-gradient(ellipse 60% 50% at 50% 50%, var(--rgba-124-58-237-0_35) 0%, transparent 100%)"
                }}
              />

              {/* Decorative grid */}
              <div className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: "linear-gradient(var(--rgba-124-58-237-0_8) 1px, transparent 1px), linear-gradient(90deg, var(--rgba-124-58-237-0_8) 1px, transparent 1px)",
                  backgroundSize: "40px 40px"
                }}
              />

              {/* Play button */}
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="relative z-[var(--z-content)] flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-[var(--brand-600)] to-[var(--palette-4f46e5)] shadow-[0_0_32px_var(--rgba-124-58-237-0_5)] group-hover:shadow-[0_0_48px_var(--rgba-124-58-237-0_7)] transition-shadow"
              >
                <Play size={24} className="text-[var(--palette-white)] ml-1" fill="var(--palette-white)" />
              </motion.div>

              {/* Label */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-xs font-medium text-[var(--foreground-subtle)]">FocusArx — Feature Walkthrough</p>
              </div>
            </div>
          ) : (
            /* YouTube embed — swap VIDEO_ID for the real one when ready */
            <div className="aspect-video">
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1&color=white"
                title="FocusArx Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[var(--palette-2e3142)] mt-3">
          Replace the YouTube link in{" "}
          <code className="text-[var(--foreground-subtle)] font-mono">DemoVideoSection.tsx</code>
          {" "}when your real demo is ready.
        </p>
      </motion.div>
    </section>
  );
}
