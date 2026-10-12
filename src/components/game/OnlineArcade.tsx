import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Globe, Loader2, RotateCcw } from "lucide-react";
import { haptic } from "@/lib/haptics";

type OnlineGame = { id: string; title: string; emoji: string; tag: string; url: string; controls: string };

// Free, open-source games hosted on their authors' public sites (embeddable).
export const ONLINE_GAMES: OnlineGame[] = [
  { id: "dino", title: "T-Rex Runner", emoji: "🦖", tag: "Chrome dino classic", url: "https://wayou.github.io/t-rex-runner/", controls: "Tap to jump" },
  { id: "2048", title: "2048", emoji: "🔢", tag: "Swipe puzzle", url: "https://gabrielecirulli.github.io/2048/", controls: "Swipe to merge" },
  { id: "tetris", title: "Tetris", emoji: "🧩", tag: "Block stacker", url: "https://chvin.github.io/react-tetris/?lan=en", controls: "On-screen buttons" },
  { id: "hextris", title: "Hextris", emoji: "⬡", tag: "Spin puzzle", url: "https://hextris.io/", controls: "Tap left / right" },
  { id: "floppy", title: "Floppy Bird", emoji: "🐤", tag: "Flappy classic", url: "https://nebezb.com/floppybird/", controls: "Tap to flap" },
  { id: "clumsy", title: "Clumsy Bird", emoji: "🐦", tag: "Flyer", url: "https://ellisonleao.github.io/clumsy-bird/", controls: "Tap to fly" },
  { id: "pacman", title: "Pac-Man", emoji: "🟡", tag: "Maze chase", url: "https://mumuy.github.io/pacman/", controls: "Swipe to steer" },
];

const OnlineArcade = () => {
  const [active, setActive] = useState<OnlineGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);

  const open = (g: OnlineGame) => { haptic("selection"); setLoading(true); setActive(g); };

  return (
    <div className="sm:col-span-2">
      <div className="mb-3 mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-orange-300">
        <Globe className="h-3 w-3" /> Online classics
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ONLINE_GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => open(g)}
            className="ios-press flex flex-col items-start rounded-2xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
          >
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-xl">{g.emoji}</span>
            <span className="font-display text-sm font-black text-white">{g.title}</span>
            <span className="text-[10px] text-white/55">{g.tag}</span>
          </button>
        ))}
      </div>

      {active && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-black" style={{ height: "100dvh" }}>
          <div
            className="flex flex-shrink-0 items-center gap-2 border-b border-white/10 bg-[#160d1d] px-3 py-2 text-white"
            style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
          >
            <button aria-label="Back to games" onClick={() => { haptic("selection"); setActive(null); }} className="ios-press rounded-xl border border-white/10 bg-white/5 p-2">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-black">{active.emoji} {active.title}</p>
              <p className="truncate text-[10px] text-white/55">{active.controls}</p>
            </div>
            <button aria-label="Restart game" onClick={() => { setLoading(true); setKey((k) => k + 1); }} className="ios-press rounded-xl border border-white/10 bg-white/5 p-2">
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex-1 min-h-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#160d1d] text-white/70">
                <Loader2 className="h-7 w-7 animate-spin text-orange-300" />
                <span className="text-xs">Loading {active.title}…</span>
              </div>
            )}
            <iframe
              key={`${active.id}-${key}`}
              src={active.url}
              title={active.title}
              onLoad={() => setLoading(false)}
              allow="autoplay; fullscreen; gamepad"
              allowFullScreen
              className="h-full w-full border-0 bg-white"
              style={{ touchAction: "manipulation" }}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default OnlineArcade;
