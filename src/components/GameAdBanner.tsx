import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { haptic } from '@/lib/haptics';

export type Ad = { id: string; url?: string; type?: 'image' | 'video'; title?: string; subtitle?: string; link?: string; cta?: string };

const FALLBACK: Ad[] = [{ id: 'game', title: 'Play & win free food', subtitle: 'Games while you wait · Free dessert at 100 pts', link: '/game', cta: 'Play' }];

export const useAds = () =>
  useQuery({
    queryKey: ['ads'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'ads').maybeSingle();
      const list = Array.isArray(data?.value) ? (data!.value as unknown as Ad[]) : [];
      return list;
    },
    staleTime: 60_000,
  });

const AdSlide = ({ ad, eager }: { ad: Ad; eager: boolean }) => (
  <Link
    to={ad.link || '/game'}
    onClick={() => haptic('selection')}
    draggable={false}
    className="relative block h-full w-full flex-shrink-0 snap-center overflow-hidden rounded-2xl maroon-gradient"
  >
    {ad.url && ad.type === 'video' && (
      <video src={ad.url} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
    )}
    {ad.url && ad.type !== 'video' && (
      <img src={ad.url} alt={ad.title || 'Ad'} loading={eager ? 'eager' : 'lazy'} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/10 to-transparent" />
    <span className="absolute left-3 top-3 rounded-md bg-background/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-foreground">Ad</span>
    <div className="absolute inset-x-3 bottom-4 flex items-end justify-between gap-2 text-primary-foreground">
      <div className="min-w-0">
        <p className="truncate font-display text-lg leading-tight">{ad.title}</p>
        <p className="truncate text-[11px] opacity-90">{ad.subtitle}</p>
      </div>
      <span className="flex flex-shrink-0 items-center gap-0.5 rounded-full bg-background px-3 py-1.5 text-xs font-bold text-primary">
        {ad.cta || 'View'} <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </div>
  </Link>
);

const GameAdBanner = ({ className = '' }: { className?: string }) => {
  const { data } = useAds();
  const ads = data && data.length ? data : FALLBACK;
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || paused.current) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % ads.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, 4500);
    return () => clearInterval(t);
  }, [ads.length]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onTouchStart={() => { paused.current = true; }}
        onTouchEnd={() => { setTimeout(() => { paused.current = false; }, 4000); }}
        className="flex aspect-[16/7] snap-x snap-mandatory overflow-x-auto rounded-2xl shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {ads.map((ad, i) => <AdSlide key={ad.id} ad={ad} eager={i === 0} />)}
      </div>
      {ads.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
          {ads.map((ad, i) => (
            <span key={ad.id} className={`h-1 rounded-full transition-all ${i === index ? 'w-4 bg-primary-foreground' : 'w-1.5 bg-primary-foreground/50'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default GameAdBanner;
