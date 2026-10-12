import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Gamepad2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { haptic } from '@/lib/haptics';

export type GameAd = { url?: string; type?: 'image' | 'video'; title?: string; subtitle?: string };

export const useGameAd = () =>
  useQuery({
    queryKey: ['game-ad'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'game_ad').maybeSingle();
      return ((data?.value ?? {}) as GameAd);
    },
    staleTime: 60_000,
  });

const GameAdBanner = ({ className = '' }: { className?: string }) => {
  const { data: ad = {} } = useGameAd();
  const title = ad.title || 'Play & win free food';
  const subtitle = ad.subtitle || 'Games while you wait · Free dessert at 100 pts';

  return (
    <Link
      to="/game"
      onClick={() => haptic('selection')}
      aria-label={`${title} – open games`}
      className={`ios-press relative block overflow-hidden rounded-2xl maroon-gradient shadow-md aspect-[16/7] ${className}`}
    >
      {ad.url && ad.type === 'video' && (
        <video src={ad.url} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {ad.url && ad.type !== 'video' && (
        <img src={ad.url} alt="" loading="eager" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
      <span className="absolute left-3 top-3 rounded-md bg-background/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-foreground">Ad</span>
      <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-primary-foreground">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-lg leading-tight"><Gamepad2 className="h-5 w-5 flex-shrink-0" /> <span className="truncate">{title}</span></p>
          <p className="truncate text-[11px] opacity-90">{subtitle}</p>
        </div>
        <span className="flex flex-shrink-0 items-center gap-0.5 rounded-full bg-background px-3 py-1.5 text-xs font-bold text-primary">
          Play <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
};

export default GameAdBanner;
