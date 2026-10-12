import OnlineArcade from "@/components/game/OnlineArcade";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Play, RotateCw, Home, Volume2, VolumeX, Sparkles, Mountain, Pause, Hand, CircleDot,
} from "lucide-react";
import PotOfGlory from "@/components/game/PotOfGlory";
import BounceBall from "@/components/game/BounceBall";
import SnakeGame from "@/components/game/SnakeGame";
import SpaceDefender from "@/components/game/SpaceDefender";
import BrickBreaker from "@/components/game/BrickBreaker";
import HungryCritters from "@/components/game/HungryCritters";
import SmokehouseRush3D from "@/components/game/SmokehouseRush3D";
import FlyingDrumstick from "@/components/game/FlyingDrumstick";
import {
  GameId,
  fetchLeaderboard,
  getStoredHighScore,
  setStoredHighScore,
  getStoredName,
  setStoredName,
  submitScore,
  unlockRewardsForCustomer,
  hasSeenClimbTutorial,
  markClimbTutorialSeen,
  tiersForGame,
} from "@/lib/game-rewards";
import { useCustomer } from "@/contexts/CustomerContext";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";

type Phase = "select" | "tutorial" | "playing" | "gameover";
type Tab = "game" | "leaderboard" | "rewards";
interface ScoreRow { display_name: string; score: number; created_at: string }

const GAME_META: Record<GameId, { title: string; emoji: string; tag: string; accent: string }> = {
  climb: { title: "Pot of Glory", emoji: "🍲", tag: "🧗", accent: "text-orange-200" },
  bounce: { title: "Meatball Bounce", emoji: "🔴", tag: "🔴", accent: "text-cyan-200" },
  snake: { title: "Kitchen Snake", emoji: "🐍", tag: "🐍", accent: "text-lime-200" },
  space: { title: "Space Defender", emoji: "🚀", tag: "🚀", accent: "text-blue-200" },
  breakout: { title: "Brick Breaker", emoji: "🧱", tag: "🧱", accent: "text-pink-200" },
  hungry: { title: "Hungry Critters", emoji: "🍖", tag: "🍖", accent: "text-amber-200" },
  rush3d: { title: "Kitchen Rush 3D", emoji: "🏎️", tag: "🏎️", accent: "text-violet-200" },
  skyfry: { title: "Sky Fry", emoji: "🍗", tag: "🍗", accent: "text-sky-200" },
};

const GamePage = () => {
  const { customer } = useCustomer();
  const [phase, setPhase] = useState<Phase>("select");
  const [tab, setTab] = useState<Tab>("game");
  const [activeGame, setActiveGame] = useState<GameId>("climb");
  const [score, setScore] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("bbq_game_sound") !== "off");
  const [bestClimb, setBestClimb] = useState(getStoredHighScore("climb"));
  const [bestBounce, setBestBounce] = useState(getStoredHighScore("bounce"));
  const [bestSnake, setBestSnake] = useState(getStoredHighScore("snake"));
  const [bestSpace, setBestSpace] = useState(getStoredHighScore("space"));
  const [bestBreakout, setBestBreakout] = useState(getStoredHighScore("breakout"));
  const [bestHungry, setBestHungry] = useState(getStoredHighScore("hungry"));
  const [bestRush3d, setBestRush3d] = useState(getStoredHighScore("rush3d"));
  const [bestSkyfry, setBestSkyfry] = useState(getStoredHighScore("skyfry"));
  const [name, setName] = useState(getStoredName() || customer?.name || "");
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [scope, setScope] = useState<"all" | "week">("all");
  const submittedRef = useRef(false);
  const rewardShownRef = useRef<Set<number>>(new Set());
  const gameScreenRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>(phase);
  const fullscreenSessionRef = useRef(false);
  const endingRef = useRef(false);

  const bestByGame: Record<GameId, number> = {
    climb: bestClimb,
    bounce: bestBounce,
    snake: bestSnake,
    space: bestSpace,
    breakout: bestBreakout,
    hungry: bestHungry,
    rush3d: bestRush3d,
    skyfry: bestSkyfry,
  };
  const best = bestByGame[activeGame];
  const tiers = tiersForGame(activeGame);

  const loadBoard = useCallback(async () => {
    const rows = await fetchLeaderboard(scope);
    setScores(rows as ScoreRow[]);
  }, [scope]);

  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && fullscreenSessionRef.current) {
        fullscreenSessionRef.current = false;
        if (phaseRef.current === "playing" && !endingRef.current) {
          setPhase("select");
          haptic("selection");
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const enterPhoneFullscreen = () => {
    const isPhone = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
    const element = gameScreenRef.current;
    if (!isPhone || !element?.requestFullscreen || document.fullscreenElement) return;
    fullscreenSessionRef.current = true;
    void element.requestFullscreen().catch(() => {
      fullscreenSessionRef.current = false;
    });
  };

  const exitFullscreen = () => {
    fullscreenSessionRef.current = false;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  };

  const returnToGameMenu = () => {
    endingRef.current = false;
    exitFullscreen();
    setPhase("select");
    setTab("game");
    haptic("selection");
  };

  const ensureName = () => {
    if (name.trim()) return true;
    const n = prompt("What name should we show on the leaderboard?")?.trim();
    if (!n) return false;
    setName(n);
    setStoredName(n);
    return true;
  };

  const beginPlaying = (game: GameId) => {
    if (!ensureName()) return;
    endingRef.current = false;
    submittedRef.current = false;
    rewardShownRef.current = new Set();
    setActiveGame(game);
    setScore(0);
    setTab("game");
    if (game === "climb" && !hasSeenClimbTutorial()) {
      setPhase("tutorial");
      return;
    }
    setPhase("playing");
    enterPhoneFullscreen();
    haptic("selection");
  };

  const finishTutorialAndPlay = () => {
    markClimbTutorialSeen();
    setPhase("playing");
    enterPhoneFullscreen();
    haptic("selection");
  };

  const handleGameOver = async (finalScore: number) => {
    if (endingRef.current) return;
    endingRef.current = true;
    exitFullscreen();
    setPhase("gameover");
    setScore(finalScore);
    if (finalScore > bestByGame[activeGame]) {
      setStoredHighScore(finalScore, activeGame);
      if (activeGame === "climb") setBestClimb(finalScore);
      if (activeGame === "bounce") setBestBounce(finalScore);
      if (activeGame === "snake") setBestSnake(finalScore);
      if (activeGame === "space") setBestSpace(finalScore);
      if (activeGame === "breakout") setBestBreakout(finalScore);
      if (activeGame === "hungry") setBestHungry(finalScore);
      if (activeGame === "rush3d") setBestRush3d(finalScore);
      if (activeGame === "skyfry") setBestSkyfry(finalScore);
    }
    if (!submittedRef.current) {
      submittedRef.current = true;
      try {
        await submitScore(`${GAME_META[activeGame].tag}${name || "Guest"}`, finalScore, customer?.id ?? null);
        if (customer?.id) {
          const unlockedTiers = await unlockRewardsForCustomer(customer.id, finalScore, activeGame);
          unlockedTiers.forEach((t) => toast.success(`${t.emoji} Reward unlocked: ${t.label}!`));
        }
        loadBoard();
      } catch { /* ignore */ }
    }
  };

  const handleScoreChange = (s: number) => {
    setScore(s);
    tiers.forEach((t) => {
      if (s >= t.threshold && !rewardShownRef.current.has(t.threshold)) {
        rewardShownRef.current.add(t.threshold);
        toast.success(`${t.emoji} ${t.label} unlocked!`);
        haptic("success");
      }
    });
  };

  const next = tiers.find((t) => score < t.threshold) ?? null;
  const unlocked = tiers.filter((t) => Math.max(score, best) >= t.threshold);
  const tierProgress = next ? Math.min(100, (score / next.threshold) * 100) : 100;
  const isImmersive = phase === "playing" || phase === "tutorial";

  const toggleSound = () => {
    const enabled = !soundEnabled;
    setSoundEnabled(enabled);
    localStorage.setItem("bbq_game_sound", enabled ? "on" : "off");
    haptic("selection");
  };

  return (
    <div
      ref={gameScreenRef}
      className="fixed inset-0 flex flex-col overflow-hidden bg-[#160d1d] text-white"
      style={{ height: "100dvh" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-fuchsia-700/20 blur-3xl" />
      </div>

      <header
        className={`${isImmersive ? "hidden" : "flex"} relative z-10 items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3 backdrop-blur-xl flex-shrink-0`}
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <Link to="/" onClick={() => haptic("selection")} aria-label="Back to main menu" className="ios-press -ml-1 rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-300">Orange&apos;s</p>
          <h1 className="font-display text-lg font-black tracking-wider text-white">ARCADE</h1>
        </div>
        <button
          onClick={toggleSound}
          aria-label={soundEnabled ? "Mute game sounds" : "Enable game sounds"}
          className="ios-press rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
        >
          {soundEnabled ? <Volume2 className="h-5 w-5 text-orange-300" /> : <VolumeX className="h-5 w-5 text-white/60" />}
        </button>
      </header>

      <div className={`${isImmersive ? "hidden" : "flex"} relative z-10 gap-1 px-4 pt-3 flex-shrink-0`}>
        {(["game", "leaderboard", "rewards"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { exitFullscreen(); setTab(t); haptic("selection"); if (t === "leaderboard") loadBoard(); }}
            className={`flex-1 rounded-xl border py-2.5 text-xs font-bold capitalize transition-all duration-300 ios-press ${
              tab === t
                ? "border-orange-300/50 bg-gradient-to-r from-orange-500 to-amber-400 text-[#2a1210] shadow-[0_0_24px_rgba(249,115,22,.28)]"
                : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
            }`}
          >
            {t === "leaderboard" ? "Leaders" : t === "rewards" ? "Rewards" : "Play"}
          </button>
        ))}
      </div>

      <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
        {tab === "game" && (
          <div className="absolute inset-0 flex flex-col">
            {(phase === "playing" || phase === "gameover") && (
              <div className={`${phase === "playing" ? "pointer-events-none absolute left-2 top-2 z-20 w-[calc(100%-140px)] p-0" : "flex-shrink-0 px-4 py-2.5"} flex items-center gap-2 text-xs`}>
                <div className="min-w-[92px] rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-md">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-white/45">
                    {activeGame === "climb" ? "Height" : "Score"}
                  </span>
                  <b className="font-mono text-xl leading-none text-white">
                    {score}{activeGame === "climb" ? "m" : ""}
                  </b>
                </div>
                {phase !== "playing" && (
                  <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold text-orange-200">
                        {activeGame === "climb" ? <Mountain className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}
                        {next ? `Next @ ${next.threshold}${activeGame === "climb" ? "m" : ""}` : "Max rewards"}
                      </span>
                      <span className="text-white/45">Best {best}{activeGame === "climb" ? "m" : ""}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
                      <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-300" style={{ width: `${tierProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={`${phase === "playing" || phase === "tutorial" ? "m-0 rounded-none border-0" : "mx-3 mb-3 rounded-[24px] border border-orange-300/30"} relative flex-1 min-h-0 overflow-hidden bg-[#1a0b2e]`}>
              {(phase === "playing" || phase === "gameover" || phase === "tutorial") && (
                activeGame === "climb" ? (
                  <PotOfGlory
                    running={phase === "playing"}
                    soundEnabled={soundEnabled}
                    onGameOver={handleGameOver}
                    onScoreChange={handleScoreChange}
                  />
                ) : activeGame === "bounce" ? (
                  <BounceBall
                    running={phase === "playing"}
                    soundEnabled={soundEnabled}
                    onGameOver={handleGameOver}
                    onScoreChange={handleScoreChange}
                  />
                ) : activeGame === "snake" ? (
                  <SnakeGame
                    running={phase === "playing"}
                    soundEnabled={soundEnabled}
                    onGameOver={handleGameOver}
                    onScoreChange={handleScoreChange}
                  />
                ) : activeGame === "space" ? (
                  <SpaceDefender
                    running={phase === "playing"}
                    soundEnabled={soundEnabled}
                    onGameOver={handleGameOver}
                    onScoreChange={handleScoreChange}
                  />
                ) : activeGame === "breakout" ? (
                  <BrickBreaker
                    running={phase === "playing"}
                    soundEnabled={soundEnabled}
                    onGameOver={handleGameOver}
                    onScoreChange={handleScoreChange}
                  />
                ) : activeGame === "hungry" ? (
                  <HungryCritters
                    running={phase === "playing"}
                    soundEnabled={soundEnabled}
                    onGameOver={handleGameOver}
                    onScoreChange={handleScoreChange}
                  />
                ) : activeGame === "rush3d" ? (
                  <SmokehouseRush3D
                    running={phase === "playing"}
                    soundEnabled={soundEnabled}
                    onGameOver={handleGameOver}
                    onScoreChange={handleScoreChange}
                  />
                ) : (
                  <FlyingDrumstick
                    running={phase === "playing"}
                    soundEnabled={soundEnabled}
                    onGameOver={handleGameOver}
                    onScoreChange={handleScoreChange}
                  />
                )
              )}

              {phase === "playing" && (
                <>
                  <button
                    onClick={returnToGameMenu}
                    className="ios-press absolute right-2 top-2 z-30 flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-[10px] font-bold text-white backdrop-blur-md"
                    aria-label="Pause and exit to game menu"
                  >
                    <Pause className="h-3.5 w-3.5 fill-current" /> EXIT
                  </button>
                  <div className="pointer-events-none absolute bottom-3 left-1/2 flex max-w-[95%] -translate-x-1/2 gap-2 text-center text-[10px] font-bold text-white/70">
                    <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-md">
                      {activeGame === "climb" && "HOLD & SWING FROM CENTER · PLANT · LEVER UP"}
                      {activeGame === "bounce" && "TAP LEFT / BOOST / RIGHT"}
                      {activeGame === "snake" && "SWIPE ANYWHERE TO TURN"}
                      {activeGame === "space" && "DRAG SHIP • AUTO FIRE"}
                      {activeGame === "breakout" && "DRAG PADDLE • TAP TO LAUNCH"}
                      {activeGame === "hungry" && "DRAG CRITTER • CATCH FOOD • AVOID BURNT"}
                      {activeGame === "rush3d" && "TAP ARROWS OR SWIPE • DODGE CRATES"}
                      {activeGame === "skyfry" && "TAP OR HOLD TO FLY • RELEASE TO DROP"}
                    </span>
                  </div>
                </>
              )}

              {phase === "select" && (
                <div className="absolute inset-0 overflow-y-auto p-4">
                  <div className="mx-auto grid max-w-3xl gap-4 pb-6 sm:grid-cols-2">
                    <div className="pt-2 text-center sm:col-span-2">
                      <p className="mb-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.25em] text-orange-300">
                        <Sparkles className="h-3 w-3" /> Pick a game
                      </p>
                      <h2 className="font-display text-3xl font-black text-white">Kitchen Arcade</h2>
                      <p className="mt-2 text-xs text-white/55">Eight responsive games built for touch, fullscreen, and every phone size.</p>
                    </div>

                    <button
                      onClick={() => beginPlaying("climb")}
                      className="ios-press w-full rounded-3xl border border-orange-300/30 bg-gradient-to-br from-[#3a1a2a] to-[#1a0b2e] p-5 text-left shadow-xl"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-2xl">🍲</div>
                        <div>
                          <h3 className="font-display text-xl font-black text-white">Pot of Glory</h3>
                          <p className="text-[11px] text-orange-200">Glory Pile climber · Best {bestClimb}m</p>
                        </div>
                      </div>
                        <p className="text-xs leading-relaxed text-white/60">
                          Climb a broad S-curved open rock route with real CC0 rock artwork and no box platforms or side walls. Plant the sledge, swing sideways, and recover from every fall.
                        </p>
                      <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-orange-100">
                        <Hand className="h-3.5 w-3.5" /> Swing from center · plant · lever
                      </div>
                    </button>

                    <button
                      onClick={() => beginPlaying("bounce")}
                      className="ios-press w-full rounded-3xl border border-cyan-300/25 bg-gradient-to-br from-[#12344a] to-[#0f1b2e] p-5 text-left shadow-xl"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/25 text-2xl">🔴</div>
                        <div>
                          <h3 className="font-display text-xl font-black text-white">Meatball Bounce</h3>
                          <p className="text-[11px] text-cyan-200">Nokia Bounce style · Best {bestBounce}</p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-white/60">
                        Easy bounce and steer at the start. Later spikes sit just past your jump so you keep thinking “almost!”
                      </p>
                      <div className="mt-3 text-[10px] font-bold text-cyan-100">Tap zones: Left · Bounce · Right</div>
                    </button>

                    <button
                      onClick={() => beginPlaying("snake")}
                      className="ios-press w-full rounded-3xl border border-lime-300/25 bg-gradient-to-br from-[#17331f] to-[#071d20] p-5 text-left shadow-xl"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-500/20 text-2xl">🐍</div>
                        <div>
                          <h3 className="font-display text-xl font-black text-white">Kitchen Snake</h3>
                          <p className="text-[11px] text-lime-200">Swipe classic · Best {bestSnake}</p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-white/60">Swipe anywhere to turn, collect food, grow longer, and survive the speeding grid.</p>
                      <div className="mt-3 text-[10px] font-bold text-lime-100">Swipe or use the visible arrow pad</div>
                    </button>

                    <button
                      onClick={() => beginPlaying("space")}
                      className="ios-press w-full rounded-3xl border border-blue-300/25 bg-gradient-to-br from-[#14294b] to-[#050b1e] p-5 text-left shadow-xl"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-2xl">🚀</div>
                        <div>
                          <h3 className="font-display text-xl font-black text-white">Space Defender</h3>
                          <p className="text-[11px] text-blue-200">Arcade shooter · Best {bestSpace}</p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-white/60">Drag your ship, dodge enemy lasers, and clear faster waves. Your blaster fires automatically.</p>
                      <div className="mt-3 text-[10px] font-bold text-blue-100">One-finger drag controls</div>
                    </button>

                    <button
                      onClick={() => beginPlaying("breakout")}
                      className="ios-press w-full rounded-3xl border border-pink-300/25 bg-gradient-to-br from-[#3b1833] to-[#171224] p-5 text-left shadow-xl"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/20 text-2xl">🧱</div>
                        <div>
                          <h3 className="font-display text-xl font-black text-white">Brick Breaker</h3>
                          <p className="text-[11px] text-pink-200">Paddle classic · Best {bestBreakout}</p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-white/60">Drag the paddle base, keep the ball alive, and smash every colorful brick through harder levels.</p>
                      <div className="mt-3 text-[10px] font-bold text-pink-100">Drag paddle · tap to launch</div>
                    </button>

                    <button
                      onClick={() => beginPlaying("hungry")}
                      className="ios-press w-full rounded-3xl border border-amber-300/25 bg-gradient-to-br from-[#4a2912] to-[#21101d] p-5 text-left shadow-xl"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-2xl">🍖</div>
                        <div>
                          <h3 className="font-display text-xl font-black text-white">Hungry Critters</h3>
                          <p className="text-[11px] text-amber-200">Catch & eat · Best {bestHungry}</p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-white/60">Guide an original hungry smokehouse critter, chain tasty catches, and dodge burnt bites.</p>
                      <div className="mt-3 text-[10px] font-bold text-amber-100">Drag anywhere · build combos</div>
                    </button>

                    <button
                      onClick={() => beginPlaying("rush3d")}
                      className="ios-press w-full rounded-3xl border border-violet-300/25 bg-gradient-to-br from-[#28194b] to-[#130d20] p-5 text-left shadow-xl"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 text-2xl">🏎️</div>
                        <div>
                          <h3 className="font-display text-xl font-black text-white">Kitchen Rush 3D</h3>
                          <p className="text-[11px] text-violet-200">Perspective runner · Best {bestRush3d}</p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-white/60">Face the road, switch projected lanes, collect grill tokens, and survive rising speed.</p>
                      <div className="mt-3 text-[10px] font-bold text-violet-100">Dedicated arrows · or swipe</div>
                    </button>

                    <button
                      onClick={() => beginPlaying("skyfry")}
                      className="ios-press w-full rounded-3xl border border-sky-300/25 bg-gradient-to-br from-[#16385a] via-[#562447] to-[#26122f] p-5 text-left shadow-xl"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/20 text-2xl">🍗</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-xl font-black text-white">Sky Fry</h3>
                            <span className="rounded-full bg-sky-300 px-2 py-0.5 text-[8px] font-black text-sky-950">NEW</span>
                          </div>
                          <p className="text-[11px] text-sky-200">BBQ flyer · Best {bestSkyfry}</p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-white/60">Pilot a flying drumstick through grill-stack gaps. The opening is friendly, then speed rises and gaps tighten.</p>
                      <div className="mt-3 text-[10px] font-bold text-sky-100">Tap or hold to lift · release to drop</div>
                    </button>
                    <OnlineArcade />
                  </div>
                </div>
              )}

              {phase === "tutorial" && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#120915]/75 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-sm rounded-[28px] border border-white/15 bg-[#251429]/95 p-6 text-center shadow-2xl">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/25 text-3xl">🧗</div>
                    <h2 className="font-display mb-2 text-2xl font-black text-white">How to Climb</h2>
                    <ol className="mb-4 space-y-2 text-left text-xs text-white/70">
                      <li className="rounded-xl border border-white/10 bg-white/5 p-3"><b className="text-orange-200">1. Swing</b> — hold and drag from screen center; quick flicks bounce the pot (hammer has mass).</li>
                      <li className="rounded-xl border border-white/10 bg-white/5 p-3"><b className="text-orange-200">2. Plant</b> the head on a rock lip (green ring = PLANTED).</li>
                      <li className="rounded-xl border border-white/10 bg-white/5 p-3"><b className="text-orange-200">3. Lever</b> — while planted, drag opposite the plant or down into the lip to yank upward.</li>
                      <li className="rounded-xl border border-white/10 bg-white/5 p-3"><b className="text-orange-200">4. Pogo</b> — slam the hammer into rock for a bounce; falls respawn at the base.</li>
                    </ol>
                    <button onClick={finishTutorialAndPlay} className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-3.5 font-black text-[#2a1210]">
                      <Play className="h-4 w-4 fill-current" /> GOT IT — CLIMB
                    </button>
                  </div>
                </div>
              )}

              {phase === "gameover" && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#120915]/55 p-4 backdrop-blur-[3px]">
                  <div className="ios-spring-in w-full max-w-sm overflow-hidden rounded-[28px] border border-white/15 bg-[#251429]/90 p-6 text-center shadow-2xl backdrop-blur-xl">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.28em] text-orange-300">Run complete</p>
                    <h2 className="font-display mb-1 text-3xl font-black text-white">{GAME_META[activeGame].title}</h2>
                    <p className="my-2 bg-gradient-to-b from-yellow-200 to-orange-400 bg-clip-text text-6xl font-black text-transparent">
                      {score}{activeGame === "climb" ? "m" : ""}
                    </p>
                    <p className="mb-4 text-xs text-white/55">
                      Best: {best}{activeGame === "climb" ? "m" : ""} {score >= best && score > 0 && "· New record!"}
                    </p>
                    {unlocked.length > 0 && (
                      <div className="mb-3 rounded-xl border border-orange-200 bg-orange-100/60 p-2 text-left">
                        <p className="mb-1 text-[11px] font-semibold text-orange-800">Rewards unlocked:</p>
                        {unlocked.map((r) => (
                          <p key={r.threshold} className="text-xs text-orange-900">{r.emoji} {r.label}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => beginPlaying(activeGame)}
                        className="ios-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-3 font-bold text-[#2a1210]"
                      >
                        <RotateCw className="w-4 h-4" /> Again
                      </button>
                      <button
                        onClick={returnToGameMenu}
                        className="ios-press flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-3 font-bold text-white hover:bg-white/10"
                      >
                        <Home className="w-4 h-4" /> Games
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "leaderboard" && (
          <div className="absolute inset-0 overflow-y-auto px-4 pb-6">
            <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
              {(["all", "week"] as const).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setScope(sc)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium ios-press ${
                    scope === sc ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {sc === "all" ? "All Time" : "This Week"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {scores.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No scores yet — be first!</p>
              )}
              {scores.map((s, i) => (
                <div key={i} className={`ios-card flex items-center justify-between rounded-xl px-3 py-2.5 ${i < 3 ? "border-orange-300" : ""}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <span className="truncate text-sm font-medium">{s.display_name}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-primary">{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "rewards" && (
          <div className="absolute inset-0 overflow-y-auto px-4 pb-6">
            <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
              {([
                { id: "climb" as const, label: "Climb" },
                { id: "bounce" as const, label: "Bounce" },
                { id: "snake" as const, label: "Snake" },
                { id: "space" as const, label: "Space" },
                { id: "breakout" as const, label: "Bricks" },
                { id: "hungry" as const, label: "Hungry" },
                { id: "rush3d" as const, label: "Rush" },
                { id: "skyfry" as const, label: "Sky Fry" },
              ]).map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGame(g.id)}
                  className={`min-w-[64px] flex-1 rounded-lg py-1.5 text-xs font-medium ios-press ${
                    activeGame === g.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Reach these scores in {GAME_META[activeGame].title} to unlock free food.
            </p>
            <div className="space-y-2">
              {tiers.map((t) => {
                const done = best >= t.threshold;
                return (
                  <div key={t.threshold} className={`ios-card flex items-center gap-3 p-3 ${done ? "border-orange-400 bg-orange-50" : ""}`}>
                    <div className="text-3xl">{t.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${done ? "text-orange-900" : "text-foreground"}`}>{t.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {activeGame === "climb" ? `Height ${t.threshold}m+` : `Score ${t.threshold}+`}
                      </p>
                    </div>
                    {done ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">UNLOCKED</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{Math.max(0, t.threshold - best)} to go</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePage;
