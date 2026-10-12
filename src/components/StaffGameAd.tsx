import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GameAdBanner, { useGameAd, type GameAd } from './GameAdBanner';

const StaffGameAd = () => {
  const qc = useQueryClient();
  const { data: ad } = useGameAd();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTitle(ad?.title ?? ''); setSubtitle(ad?.subtitle ?? ''); }, [ad?.title, ad?.subtitle]);

  const save = async (next: GameAd) => {
    setBusy(true);
    const { error } = await supabase.from('app_settings').upsert({ key: 'game_ad', value: next as any, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error('Could not save banner');
    await qc.invalidateQueries({ queryKey: ['game-ad'] });
    toast.success('Game banner updated');
  };

  const upload = async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && !file.type.startsWith('image/')) return toast.error('Choose a photo or video');
    if (file.size > 25 * 1024 * 1024) return toast.error('File must be under 25 MB');
    setBusy(true);
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const path = `ads/game-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('gallery').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { setBusy(false); return toast.error('Upload failed'); }
    const url = supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl;
    await save({ ...ad, title, subtitle, url, type: isVideo ? 'video' : 'image' });
  };

  return (
    <div className="ios-card p-4 mb-6 space-y-3">
      <div>
        <h3 className="font-display text-lg text-primary">Game Ad Banner</h3>
        <p className="text-xs text-muted-foreground">Shown on the menu page and loyalty card. Add a photo or short video.</p>
      </div>
      <GameAdBanner className="pointer-events-none" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (Play & win free food)" className="w-full px-3 py-2 bg-secondary border border-border rounded-xl text-sm" />
      <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle" className="w-full px-3 py-2 bg-secondary border border-border rounded-xl text-sm" />
      <div className="flex flex-wrap gap-2">
        <label className={`ios-press flex items-center gap-1.5 rounded-xl maroon-gradient px-3 py-2 text-xs font-semibold text-primary-foreground cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload className="h-4 w-4" /> {busy ? 'Saving…' : 'Upload photo / video'}
          <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </label>
        <button disabled={busy} onClick={() => save({ ...ad, title, subtitle })} className="ios-press rounded-xl border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60">Save text</button>
        {ad?.url && (
          <button disabled={busy} onClick={() => save({ title, subtitle })} className="ios-press flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-60">
            <Trash2 className="h-4 w-4" /> Remove media
          </button>
        )}
      </div>
    </div>
  );
};

export default StaffGameAd;
