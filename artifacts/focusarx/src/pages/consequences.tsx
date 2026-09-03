import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { Sword, Heart, Megaphone, Snowflake, CheckCircle, XCircle, Plus } from "lucide-react";

type Contract = {
  id: string;
  weekStart: string;
  contractType: string;
  targetMinutes: number;
  charityName: string | null;
  charityAmount: number | null;
  achieved: boolean;
  consequenceTriggered: boolean;
  createdAt: string;
};

type ConsequencesData = {
  contracts: Contract[];
  currentContract: Contract | null;
  weekMinutes: number;
  weekStart: string;
  freezeTokens: number;
};

const CONTRACT_TYPES = [
  {
    id: "charity",
    icon: Heart,
    label: "Charity Pledge",
    desc: "Miss your goal → donate to a cause",
    color: "var(--color-error)",
  },
  {
    id: "shame",
    icon: Megaphone,
    label: "Public Accountability",
    desc: "Miss your goal → face a public reminder",
    color: "var(--palette-f97316)",
  },
];

function ContractCard({ contract, weekMinutes }: { contract: Contract; weekMinutes: number }) {
  const pct = Math.min(100, (weekMinutes / contract.targetMinutes) * 100);
  const isCurrentWeek = contract.weekStart === new Date(
    new Date(Date.now() - ((new Date().getDay() + 6) % 7) * 86400000).toISOString().split("T")[0]!
  ).toISOString().split("T")[0];

  const ContractIcon = contract.contractType === "charity" ? Heart : contract.contractType === "shame" ? Megaphone : Snowflake;
  const iconColor = contract.contractType === "charity" ? "var(--color-error)" : contract.contractType === "shame" ? "var(--palette-f97316)" : "var(--info)";

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${iconColor} 9%, transparent)` }}>
            <ContractIcon size={16} style={{ color: iconColor }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {contract.contractType === "charity" ? "Charity Pledge" : contract.contractType === "shame" ? "Public Accountability" : "Streak Freeze"}
            </p>
            <p className="text-[10px] text-[var(--foreground-subtle)]">Week of {contract.weekStart}</p>
          </div>
        </div>
        {contract.achieved ? (
          <span className="flex items-center gap-1 rounded-full bg-[var(--rgba-74-222-128-0_1)] border border-[var(--rgba-74-222-128-0_2)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--palette-4ade80)]">
            <CheckCircle size={10} /> Achieved
          </span>
        ) : contract.consequenceTriggered ? (
          <span className="flex items-center gap-1 rounded-full bg-[var(--rgba-239-68-68-0_1)] border border-[var(--rgba-239-68-68-0_2)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--palette-red-400)]">
            <XCircle size={10} /> Consequence
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-[var(--foreground-muted)]">Target: {contract.targetMinutes}m focus</span>
        {isCurrentWeek && <span className="text-[var(--brand-400)]">{weekMinutes}m so far</span>}
      </div>

      {isCurrentWeek && (
        <div className="h-1.5 rounded-full bg-[var(--rgba-124-58-237-0_1)] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      )}

      {contract.contractType === "charity" && contract.charityName && (
        <p className="mt-2 text-[11px] text-[var(--foreground-subtle)]">
          Cause: {contract.charityName}{contract.charityAmount ? ` — $${contract.charityAmount}` : ""}
        </p>
      )}
    </div>
  );
}

export default function ConsequencesPage() {
  const { status } = useAuth();
  const [data, setData] = useState<ConsequencesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [contractType, setContractType] = useState("charity");
  const [targetMinutes, setTargetMinutes] = useState(120);
  const [charityName, setCharityName] = useState("");
  const [charityAmount, setCharityAmount] = useState(10);
  const [saving, setSaving] = useState(false);
  const [usingFreeze, setUsingFreeze] = useState(false);
  const [shameDismissed, setShameDismissed] = useState(false);

  const token = () => localStorage.getItem("focusarx-auth-token");

  const load = () => {
    fetch("/api/consequences", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d: ConsequencesData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    load();
  }, [status]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/consequences", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contractType,
          targetMinutes,
          charityName: contractType === "charity" ? charityName : undefined,
          charityAmount: contractType === "charity" ? charityAmount : undefined,
        }),
      });
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const useFreeze = async () => {
    setUsingFreeze(true);
    try {
      await fetch("/api/consequences/use-freeze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      load();
    } finally {
      setUsingFreeze(false);
    }
  };

  const cc = data?.currentContract;
  const weekFailed = cc && !cc.achieved && new Date().getDay() === 0;
  const showShamePrompt = weekFailed && cc?.contractType === "shame" && !shameDismissed;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <main className="relative z-[var(--z-content)] mx-auto max-w-2xl px-4 py-10">
        <PageTransition>
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">Accountability</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
              <Sword size={22} className="text-[var(--brand-400)]" /> Consequence Engine
            </h1>
            <p className="mt-1 text-sm text-[var(--foreground-subtle)]">Set real stakes. Most apps reward focus — this one holds you accountable.</p>
          </header>

          {/* Shame prompt */}
          <AnimatePresence>
            {showShamePrompt && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 rounded-2xl border border-[var(--rgba-249-115-22-0_4)] bg-[var(--rgba-249-115-22-0_08)] p-5"
              >
                <p className="text-sm font-bold text-[var(--palette-orange-400)] mb-2">📣 You didn't hit your focus goal this week.</p>
                <div className="rounded-xl bg-[var(--rgba-0-0-0-0_3)] p-3 text-xs text-[var(--foreground-muted)] font-mono mb-3">
                  "I didn't hit my focus goals this week. Back at it Monday. — sent from FocusArx"
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-xl bg-[var(--palette-orange-500)] py-2 text-xs font-semibold text-[var(--palette-white)]">Share it</button>
                  <button onClick={() => setShameDismissed(true)} className="flex-1 rounded-xl border border-[var(--rgba-124-58-237-0_3)] py-2 text-xs font-semibold text-[var(--foreground-muted)]">Skip</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rgba-124-58-237-0_3)] border-t-[var(--brand-600)]" />
            </div>
          )}

          {!loading && status === "unauthenticated" && (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-8 text-center">
              <p className="text-[var(--foreground-muted)] text-sm">Sign in to set consequence contracts.</p>
            </div>
          )}

          {!loading && status === "authenticated" && data && (
            <div className="space-y-6">
              {/* Freeze tokens */}
              <div className="rounded-2xl border border-[var(--rgba-96-165-250-0_2)] bg-[var(--rgba-96-165-250-0_05)] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--rgba-96-165-250-0_12)] flex items-center justify-center">
                    <Snowflake size={18} className="text-[var(--info)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">Freeze Tokens</p>
                    <p className="text-[10px] text-[var(--foreground-subtle)]">Protect a missed day. 1 token per 5-day streak.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {Array.from({ length: Math.max(3, (data.freezeTokens ?? 0) + 1) }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center text-[10px] ${i < (data.freezeTokens ?? 0) ? "border-[var(--info)] bg-[var(--rgba-96-165-250-0_15)] text-[var(--info)]" : "border-[var(--rgba-124-58-237-0_15)] text-[var(--foreground-subtle)]"}`}
                      >
                        {i < (data.freezeTokens ?? 0) ? "❄" : "·"}
                      </div>
                    ))}
                  </div>
                  {(data.freezeTokens ?? 0) > 0 && (
                    <button
                      onClick={() => void useFreeze()}
                      disabled={usingFreeze}
                      className="rounded-lg border border-[var(--rgba-96-165-250-0_3)] px-3 py-1 text-[10px] font-semibold text-[var(--info)] hover:bg-[var(--rgba-96-165-250-0_1)]"
                    >
                      Use
                    </button>
                  )}
                </div>
              </div>

              {/* Current week contract */}
              {cc ? (
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">This Week's Contract</h2>
                  <ContractCard contract={cc} weekMinutes={data.weekMinutes} />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--rgba-124-58-237-0_25)] p-8 text-center">
                  <Sword size={40} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
                  <p className="text-sm font-semibold text-[var(--foreground-muted)]">No contract this week</p>
                  <p className="text-xs text-[var(--foreground-subtle)] mt-1">Set stakes to hold yourself accountable.</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--brand-600)] px-6 text-sm font-semibold text-[var(--neutral-0)] shadow-[var(--shadow-violet-sm)] transition-[background-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--brand-500)] hover:shadow-[var(--shadow-violet-md)] active:scale-[0.98]"
                  >
                    <Plus size={14} /> Set Contract
                  </button>
                </div>
              )}

              {!cc && !showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="hidden"
                />
              )}

              {/* Contract form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--card)] p-6 backdrop-blur-xl"
                  >
                    <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">New Contract</h3>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {CONTRACT_TYPES.map((ct) => {
                        const Icon = ct.icon;
                        return (
                          <button
                            key={ct.id}
                            onClick={() => setContractType(ct.id)}
                            className={`rounded-xl p-3 text-left border transition-all ${contractType === ct.id ? `border-[${ct.color}] bg-[color-mix(in srgb, ${ct.color} 9%, transparent)]` : "border-[var(--rgba-124-58-237-0_15)] bg-[var(--rgba-124-58-237-0_05)]"}`}
                            style={contractType === ct.id ? { borderColor: ct.color, background: `color-mix(in srgb, ${ct.color} 9%, transparent)` } : {}}
                          >
                            <Icon size={16} style={{ color: ct.color }} className="mb-1.5" />
                            <p className="text-xs font-semibold text-[var(--foreground)]">{ct.label}</p>
                            <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{ct.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-3 mb-5">
                      <div>
                        <label className="text-xs text-[var(--foreground-muted)] mb-1.5 block">Weekly focus target (minutes)</label>
                        <input
                          type="number"
                          value={targetMinutes}
                          onChange={(e) => setTargetMinutes(Number(e.target.value))}
                          min={30}
                          max={1200}
                          className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_05)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand-600)]"
                        />
                      </div>

                      {contractType === "charity" && (
                        <>
                          <div>
                            <label className="text-xs text-[var(--foreground-muted)] mb-1.5 block">Charity / cause name</label>
                            <input
                              value={charityName}
                              onChange={(e) => setCharityName(e.target.value)}
                              placeholder="e.g. Red Cross, local shelter…"
                              className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_05)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--brand-600)]"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[var(--foreground-muted)] mb-1.5 block">Pledge amount ($)</label>
                            <input
                              type="number"
                              value={charityAmount}
                              onChange={(e) => setCharityAmount(Number(e.target.value))}
                              min={1}
                              className="w-full rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_05)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand-600)]"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => void save()}
                        disabled={saving}
                        className="flex-1 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-500)] py-2.5 text-sm font-semibold text-[var(--palette-white)] disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Commit to Contract"}
                      </button>
                      <button
                        onClick={() => setShowForm(false)}
                        className="rounded-xl border border-[var(--rgba-124-58-237-0_2)] px-4 py-2.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {cc && (
                <button
                  onClick={() => setShowForm((v) => !v)}
                  className="flex items-center gap-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)]"
                >
                  <Plus size={12} /> Set new contract
                </button>
              )}

              {/* History */}
              {data.contracts.length > 1 && (
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Contract History</h2>
                  <div className="space-y-3">
                    {data.contracts
                      .filter((c) => c.id !== cc?.id)
                      .slice(0, 8)
                      .map((c) => (
                        <ContractCard key={c.id} contract={c} weekMinutes={0} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
