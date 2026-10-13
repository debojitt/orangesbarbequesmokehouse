import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Trash2, Plus, ArrowUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GameAdBanner, { useAds, type Ad } from './GameAdBanner';

const StaffGameAd = () => {
  const qc = useQueryClient();
  const { data } = useAds();
  const [ads, setAds] = useState<Ad[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data) setAds(data); }, [data]);

  const persist = async (next: Ad[], msg = 'Ads saved') => {
    setBusy(true);
    const { error } = await supabase.from('app_settings').upsert({ key: 'ads', value: next as any, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error('Could not save ads');
    setAds(next);
    await qc.invalidateQueries({ queryKey: ['ads'] });
    toast.success(msg);
  };

  const update = (i: number, patch: Partial<Ad>) => setAds((a) => a.map((ad, j) => (j === i ? { ...ad, ...patch } : ad)));

  const upload = async (i: number, file: File) => {
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && !file.type.startsWith('image/')) return toast.error('Choose a photo or video');
    if (file.size > 25 * 1024 * 1024) return toast.error('File must be under 25 MB');
    setBusy(true);
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const path = `ads/ad-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('gallery').upload(path, file, { contentType: file.type, upsert: true });
    setBusy(false);
    if (error) return toast.error('Upload failed');
    const url = supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl;
    await persist(ads.map((ad, j) => (j === i ? { ...ad, url, type: isVideo ? 'video' : 'image' } : ad)), 'Media uploaded');
  };

  const input = 'w-full px-3 py-2 bg-secondary border border-border rounded-xl text-sm';

  return (
    <div className="ios-card p-4 mb-6 space-y-3">
      <div>
        <h3 className="font-display text-lg text-primary">Ad Banners</h3>
        <p className="text-xs text-muted-foreground">Swipeable ads on the menu and loyalty pages. Add photos or videos.</p>
      </div>
      <GameAdBanner />
      {ads.map((ad, i) => (
        <div key={ad.id} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Ad {i + 1}</span>
            <div className="flex gap-1">
              {i > 0 && <button aria-label="Move up" onClick={() => { const n = [...ads]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setAds(n); }} className="p-1"><ArrowUp className="h-4 w-4" /></button>}
              <button aria-label="Delete ad" onClick={() => setAds(ads.filter((_, j) => j !== i))} className="p-1 text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <input value={ad.title ?? ''} onChange={(e) => update(i, { title: e.target.value })} placeholder="Title" className={input} />
          <input value={ad.subtitle ?? ''} onChange={(e) => update(i, { subtitle: e.target.value })} placeholder="Subtitle" className={input} />
          <div className="flex gap-2">
            <select value={ad.link ?? '/'} onChange={(e) => update(i, { link: e.target.value })} className={input}>
              <option value="/">Menu</option><option value="/game">Games</option><option value="/loyalty">Loyalty</option><option value="/cart">Cart</option>
            </select>
            <input value={ad.cta ?? ''} onChange={(e) => update(i, { cta: e.target.value })} placeholder="Button (Order)" className={input} />
          </div>
          <label className={`ios-press inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload className="h-4 w-4" /> {ad.url ? 'Replace photo / video' : 'Upload photo / video'}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(i, f); e.target.value = ''; }} />
          </label>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => setAds([...ads, { id: `ad-${Date.now()}`, title: 'New offer', subtitle: '', link: '/', cta: 'Order' }])} className="ios-press flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><Plus className="h-4 w-4" /> Add ad</button>
        <button disabled={busy} onClick={() => persist(ads)} className="ios-press rounded-xl maroon-gradient px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">{busy ? 'Saving…' : 'Save ads'}</button>
      </div>
    </div>
  );
};

export default StaffGameAd;
