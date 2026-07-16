import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, RotateCw, Home } from "lucide-react";
import BBQRunner from "@/components/game/BBQRunner";
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

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden" style={{ height: "100dvh" }}>
      {/* header */}
      <header className="flex items-center justify-between px-4 py-3 glass-panel-strong flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Link to="/" onClick={() => haptic("selection")} className="ios-press p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-lg gold-text font-bold tracking-wider">BBQ RUNNER</h1>
        <div className="text-xs text-muted-foreground w-8 text-right">🏆 {best}</div>
      </header>

      {/* tabs */}
      <div className="flex gap-1 px-4 pt-2 flex-shrink-0">
        {(["game", "leaderboard", "rewards"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); haptic("selection"); if (t === "leaderboard") loadBoard(); }}
            className={`flex-1 py-2 rounded-xl text-xs font-medium capitalize ios-press ${
              tab === t ? "gold-gradient text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {t === "leaderboard" ? "🏆 Leaders" : t === "rewards" ? "🎁 Rewards" : "🎮 Play"}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {tab === "game" && (
          <div className="absolute inset-0 flex flex-col">
            {/* score bar */}
            <div className="px-4 py-2 flex items-center justify-between text-xs flex-shrink-0">
              <span className="font-mono text-foreground">Score <b className="text-lg">{score}</b></span>
              {next && (
                <span className="text-muted-foreground">
                  Next: {next.emoji} {next.label} @ {next.threshold}
                </span>
              )}
            </div>
            {/* canvas */}
            <div className="flex-1 min-h-0 mx-3 mb-3 rounded-2xl overflow-hidden border border-border shadow-inner bg-orange-50 relative">
              <BBQRunner
                running={phase === "playing"}
                onGameOver={handleGameOver}
                onScoreChange={handleScoreChange}
              />
              {phase !== "playing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                  <div className="glass-panel-strong rounded-3xl p-6 max-w-xs w-full text-center ios-spring-in">
                    {phase === "menu" ? (
                      <>
                        <h2 className="font-display text-2xl gold-text mb-1">Ready, Chef?</h2>
                        <p className="text-xs text-muted-foreground mb-4">
                          Tap to jump • swipe down to duck. Avoid fire, chilli and grills. Grab ₹ coins!
                        </p>
                        <button onClick={startGame} className="w-full py-3 gold-gradient text-primary-foreground rounded-2xl font-semibold flex items-center justify-center gap-2 ios-press premium-shine">
                          <Play className="w-4 h-4" /> Start
                        </button>
                      </>
                    ) : (
                      <>
                        <h2 className="font-display text-2xl gold-text mb-1">Game Over</h2>
                        <p className="text-4xl font-bold text-foreground my-2">{score}</p>
                        <p className="text-xs text-muted-foreground mb-4">
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
                          <button onClick={startGame} className="flex-1 py-2.5 gold-gradient text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-1.5 ios-press">
                            <RotateCw className="w-4 h-4" /> Play Again
                          </button>
                          <button onClick={() => setPhase("menu")} className="flex-1 py-2.5 bg-secondary text-foreground rounded-xl font-semibold flex items-center justify-center gap-1.5 ios-press">
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
