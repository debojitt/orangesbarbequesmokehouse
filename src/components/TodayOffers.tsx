import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tag } from 'lucide-react';

const TodayOffers = () => {
  const { data: offers = [] } = useQuery({
    queryKey: ['active-offers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('discounts')
        .select('*')
        .eq('is_active', true);
      return (data || []).filter((d) => {
        if (d.start_time && new Date(d.start_time) > new Date()) return false;
        if (d.end_time && new Date(d.end_time) < new Date()) return false;
        return true;
      });
    },
  });

  if (offers.length === 0) return null;

  return (
    <div className="mx-4 mt-2 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <Tag className="w-4 h-4 text-primary" />
        <h2 className="font-display text-sm text-foreground">Today's Offers</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {offers.map((offer) => (
          <div key={offer.id} className="flex-shrink-0 px-4 py-2 maroon-gradient text-primary-foreground text-xs font-semibold rounded-xl shadow-sm">
            {offer.name} — {offer.value}% OFF
          </div>
        ))}
      </div>
    </div>
  );
};

export default TodayOffers;
