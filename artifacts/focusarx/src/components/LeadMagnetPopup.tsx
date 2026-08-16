import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Mail, ArrowRight } from "lucide-react";

export function LeadMagnetPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const closed = sessionStorage.getItem("focusarx-magnet-closed");
    const registered = localStorage.getItem("focusarx-auth-token");
    if (!closed && !registered) {
      const timer = setTimeout(() => setShow(true), 15000); // Show after 15s
      return () => clearTimeout(timer);
    }
  }, []);

  const close = () => {
    sessionStorage.setItem("focusarx-magnet-closed", "true");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 px-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-8 shadow-2xl"
          >
             <button onClick={close} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
             </button>

             <div className="text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
                   <Sparkles size={32} />
                </div>
                <h2 className="text-2xl font-black text-white sm:text-3xl mb-4">Level Up Your Focus</h2>
                <p className="text-sm text-zinc-400 leading-relaxed mb-8">
                   Get our weekly "Neural Flow" newsletter. We break down the latest neuroscience research into 5-minute actionable focus protocols.
                </p>

                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); close(); }}>
                   <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input 
                        required
                        type="email" 
                        placeholder="your@email.com" 
                        className="w-full rounded-2xl border border-white/5 bg-white/[0.02] py-4 pl-12 pr-4 text-sm text-white focus:border-purple-500 outline-none transition-all"
                      />
                   </div>
                   <button className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-black text-black hover:bg-zinc-200 transition-transform hover:scale-[1.02]">
                      Get Free Protocol <ArrowRight size={16} />
                   </button>
                </form>
                <p className="mt-4 text-[10px] text-zinc-600 uppercase tracking-widest">Join 12,000+ top-tier learners</p>
             </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
