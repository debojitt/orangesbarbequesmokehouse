import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, RotateCw, Home, Volume2, VolumeX, Sparkles, Gauge } from "lucide-react";
import SmokehouseSprint from "@/components/game/SmokehouseSprint";
import {
  REWARD_TIERS,
  fetchLeaderboard,
  getStoredHighScore,
  setStoredHighScore,
  getStoredName,
  setStoredName,
  submitScore,
  tiersUnlockedFor,
  nextTierFor,
  unlockRewardsForCustomer,
} from "@/lib/game-rewards";
import { useCustomer } from "@/contexts/CustomerContext";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";

type Phase = "menu" | "playing" | "gameover";
type Tab = "game" | "leaderboard" | "rewards";

interface ScoreRow { display_name: string; score: number; created_at: string }

const GamePage = () => {
  const { customer } = useCustomer();
  const [phase, setPhase] = useState<Phase>("menu");
  const [tab, setTab] = useState<Tab>("game");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("bbq_game_sound") !== "off");
  const [best, setBest] = useState(getStoredHighScore());
  const [name, setName] = useState(getStoredName() || customer?.name || "");
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [scope, setScope] = useState<"all" | "week">("all");
  const submittedRef = useRef(false);
  const rewardShownRef = useRef<Set<number>>(new Set());

  const loadBoard = useCallback(async () => {
    const rows = await fetchLeaderboard(scope);
    setScores(rows as ScoreRow[]);
  }, [scope]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const startGame = () => {
    if (!name.trim()) {
      const n = prompt("What name should we show on the leaderboard?")?.trim();
      if (!n) return;
      setName(n); setStoredName(n);
    }
    submittedRef.current = false;
    rewardShownRef.current = new Set();
    setScore(0);
    setLevel(1);
    setPhase("playing");
    setTab("game");
    haptic("selection");
  };

  const handleGameOver = async (finalScore: number) => {
    setPhase("gameover");
    haptic("error");
    if (finalScore > best) {
      setBest(finalScore);
      setStoredHighScore(finalScore);
    }
    if (!submittedRef.current) {
      submittedRef.current = true;
      try {
        await submitScore(name || "Guest", finalScore, customer?.id ?? null);
        if (customer?.id) {
          const tiers = await unlockRewardsForCustomer(customer.id, finalScore);
          tiers.forEach((t) => toast.success(`${t.emoji} Reward unlocked: ${t.label}!`));
        }
        loadBoard();
      } catch { /* ignore */ }
    }
  };

  const handleScoreChange = (s: number) => {
    setScore(s);
    // Announce mid-game tier crossings
    REWARD_TIERS.forEach((t) => {
      if (s >= t.threshold && !rewardShownRef.current.has(t.threshold)) {
        rewardShownRef.current.add(t.threshold);
        toast.success(`${t.emoji} ${t.label} unlocked at ${t.threshold}!`);
        haptic("success");
      }
    });
  };

  const next = nextTierFor(score);
  const unlocked = tiersUnlockedFor(Math.max(score, best));
  const difficultyLabel = level < 3 ? "Easy" : level < 6 ? "Spicy" : level < 9 ? "Blazing" : "Inferno";
  const tierProgress = next
    ? Math.min(100, (score / next.threshold) * 100)
    : 100;

  const toggleSound = () => {
    const enabled = !soundEnabled;
    setSoundEnabled(enabled);
    localStorage.setItem("bbq_game_sound", enabled ? "on" : "off");
    haptic("selection");
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-[#160d1d] text-white"
      style={{ height: "100dvh" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-fuchsia-700/20 blur-3xl" />
      </div>
      {/* header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-xl flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Link to="/" onClick={() => haptic("selection")} aria-label="Back to main menu" className="ios-press -ml-1 rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-300">Orange's</p>
          <h1 className="font-display text-lg font-black tracking-wider text-white">SMOKEHOUSE SPRINT</h1>
        </div>
        <button
          onClick={toggleSound}
          aria-label={soundEnabled ? "Mute game sounds" : "Enable game sounds"}
          className="ios-press rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
        >
          {soundEnabled ? <Volume2 className="h-5 w-5 text-orange-300" /> : <VolumeX className="h-5 w-5 text-white/60" />}
        </button>
      </header>

      {/* tabs */}
      <div className="relative z-10 flex gap-1 px-4 pt-3 flex-shrink-0">
        {(["game", "leaderboard", "rewards"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); haptic("selection"); if (t === "leaderboard") loadBoard(); }}
            className={`flex-1 rounded-xl border py-2.5 text-xs font-bold capitalize transition-all duration-300 ios-press ${
              tab === t
                ? "border-orange-300/50 bg-gradient-to-r from-orange-500 to-amber-400 text-[#2a1210] shadow-[0_0_24px_rgba(249,115,22,.28)]"
                : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
            }`}
          >
            {t === "leaderboard" ? "🏆 Leaders" : t === "rewards" ? "🎁 Rewards" : "🎮 Play"}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
        {tab === "game" && (
          <div className="absolute inset-0 flex flex-col">
            {/* score bar */}
            <div className="flex flex-shrink-0 items-center gap-2 px-4 py-2.5 text-xs">
              <div className="min-w-[92px] rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-white/45">Score</span>
                <b className="font-mono text-xl leading-none text-white">{score}</b>
              </div>
              <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold text-orange-200">
                    <Gauge className="h-3 w-3" /> Lv. {level} · {difficultyLabel}
                  </span>
                  <span className="text-white/45">Best {best}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-300 transition-[width] duration-300"
                    style={{ width: `${tierProgress}%` }}
                  />
                </div>
              </div>
            </div>
            {/* canvas */}
            <div className="relative mx-3 mb-3 flex-1 min-h-0 overflow-hidden rounded-[24px] border border-orange-300/30 bg-[#281146] shadow-[0_18px_55px_rgba(0,0,0,.5),inset_0_0_0_1px_rgba(255,255,255,.08)]">
              <SmokehouseSprint
                running={phase === "playing"}
                soundEnabled={soundEnabled}
                onGameOver={handleGameOver}
                onScoreChange={handleScoreChange}
                onLevelChange={setLevel}
              />
              {phase === "playing" && (
                <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 text-[10px] font-bold text-white/65">
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 backdrop-blur-md">↑ / TAP JUMP</span>
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 backdrop-blur-md">↓ DUCK</span>
                </div>
              )}
              {phase !== "playing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#120915]/55 p-4 backdrop-blur-[3px]">
                  <div className="ios-spring-in w-full max-w-sm overflow-hidden rounded-[28px] border border-white/15 bg-[#251429]/90 p-6 text-center shadow-2xl backdrop-blur-xl">
                    {phase === "menu" ? (
                      <>
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 text-3xl shadow-[0_0_28px_rgba(249,115,22,.45)]">👨‍🍳</div>
                        <p className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.25em] text-orange-300">
                          <Sparkles className="h-3 w-3" /> The dinner rush begins
                        </p>
                        <h2 className="font-display mb-2 text-3xl font-black text-white">Ready, Chef?</h2>
                        <p className="mb-4 text-xs leading-relaxed text-white/60">
                          Jump flames and crates, duck under hot trays, and collect coins. The kitchen gets faster every level.
                        </p>
                        <div className="mb-4 grid grid-cols-3 gap-2 text-[10px]">
                          <div className="rounded-xl border border-white/10 bg-white/5 p-2"><b className="block text-base">🔥</b>Jump</div>
                          <div className="rounded-xl border border-white/10 bg-white/5 p-2"><b className="block text-base">🍽️</b>Duck</div>
                          <div className="rounded-xl border border-white/10 bg-white/5 p-2"><b className="block text-base">🪙</b>Collect</div>
                        </div>
                        <button onClick={startGame} className="premium-shine ios-press flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-3.5 font-black text-[#2a1210] shadow-[0_10px_30px_rgba(249,115,22,.35)]">
                          <Play className="w-4 h-4 fill-current" /> START THE RUSH
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.28em] text-orange-300">Rush complete</p>
                        <h2 className="font-display mb-1 text-3xl font-black text-white">Kitchen Closed!</h2>
                        <p className="my-2 bg-gradient-to-b from-yellow-200 to-orange-400 bg-clip-text text-6xl font-black text-transparent">{score}</p>
                        <p className="mb-4 text-xs text-white/55">
                          Best: {best} {score >= best && score > 0 && "· 🎉 New high score!"}
                        </p>
                        {unlocked.length > 0 && (
                          <div className="bg-orange-100/60 border border-orange-200 rounded-xl p-2 mb-3 text-left">
                            <p className="text-[11px] font-semibold text-orange-800 mb-1">Rewards unlocked:</p>
                            {unlocked.map((r) => (
                              <p key={r.threshold} className="text-xs text-orange-900">
                                {r.emoji} {r.label}
                              </p>
                            ))}
                            {!customer?.id && (
                              <p className="text-[10px] text-orange-700 mt-1">
                                Sign up on Loyalty page to save rewards!
                              </p>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={startGame} className="ios-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-3 font-bold text-[#2a1210]">
                            <RotateCw className="w-4 h-4" /> Play Again
                          </button>
                          <button onClick={() => setPhase("menu")} className="ios-press flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-3 font-bold text-white hover:bg-white/10">
                            <Home className="w-4 h-4" /> Menu
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "leaderboard" && (
          <div className="absolute inset-0 overflow-y-auto px-4 pb-6">
            <div className="flex gap-1 mb-3">
              {(["all", "week"] as const).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setScope(sc)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium ios-press ${
                    scope === sc ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {sc === "all" ? "All Time" : "This Week"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {scores.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No scores yet — be first!</p>
              )}
              {scores.map((s, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ios-card ${i < 3 ? "border-orange-300" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === 0 ? "bg-yellow-400 text-white" :
                      i === 1 ? "bg-gray-300 text-white" :
                      i === 2 ? "bg-orange-400 text-white" :
                      "bg-secondary text-muted-foreground"
                    }`}>
                      {i === 0 ? "👑" : i + 1}
                    </span>
                    <span className="font-medium text-sm truncate">{s.display_name}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-primary">{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "rewards" && (
          <div className="absolute inset-0 overflow-y-auto px-4 pb-6">
            <p className="text-xs text-muted-foreground mb-3">
              Beat these scores to unlock free food & drinks. Show the reward at the counter.
            </p>
            <div className="space-y-2">
              {REWARD_TIERS.map((t) => {
                const done = best >= t.threshold;
                return (
                  <div key={t.threshold} className={`ios-card p-3 flex items-center gap-3 ${done ? "border-orange-400 bg-orange-50" : ""}`}>
                    <div className="text-3xl">{t.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${done ? "text-orange-900" : "text-foreground"}`}>{t.label}</p>
                      <p className="text-xs text-muted-foreground">Score {t.threshold}+</p>
                    </div>
                    {done ? (
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">UNLOCKED</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{Math.max(0, t.threshold - best)} to go</span>
                    )}
                  </div>
                );
              })}
            </div>
            {!customer?.id && (
              <div className="mt-4 p-3 rounded-xl bg-orange-100/60 border border-orange-200 text-xs text-orange-900">
                💡 Sign up on the <Link to="/loyalty" className="font-bold underline">Loyalty</Link> page so your unlocked rewards are saved to your phone number and can be claimed at the counter.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePage;
