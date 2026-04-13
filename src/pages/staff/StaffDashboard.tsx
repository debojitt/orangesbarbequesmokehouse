import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Gift, TrendingUp, MessageSquare, Star, ShoppingCart, Tag } from 'lucide-react';

const StaffDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ['staff-stats'],
    queryFn: async () => {
      const [customers, feedback, selections, visits, coupons, menuItems] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('item_selections').select('menu_item_id, menu_items(name)').gte('selected_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('loyalty_visits').select('id', { count: 'exact', head: true }).gte('claimed_at', new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from('coupons').select('id', { count: 'exact', head: true }),
        supabase.from('menu_items').select('id', { count: 'exact', head: true }),
      ]);

      const itemCounts: Record<string, { name: string; count: number }> = {};
      (selections.data || []).forEach((s: any) => {
        const name = s.menu_items?.name || 'Unknown';
        if (!itemCounts[s.menu_item_id]) itemCounts[s.menu_item_id] = { name, count: 0 };
        itemCounts[s.menu_item_id].count++;
      });
      const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 5);

      const avgRating = (feedback.data || []).length > 0
        ? ((feedback.data || []).reduce((sum, fb) => sum + fb.rating, 0) / (feedback.data || []).length).toFixed(1)
        : '—';

      return {
        totalGuests: customers.count || 0,
        rewardsRedeemed: visits.count || 0,
        totalCoupons: coupons.count || 0,
        totalItems: menuItems.count || 0,
        feedback: feedback.data || [],
        topItems,
        avgRating,
      };
    },
  });

  const statCards = [
    { label: 'Total Guests', value: stats?.totalGuests || 0, icon: Users },
    { label: 'Menu Items', value: stats?.totalItems || 0, icon: ShoppingCart },
    { label: 'Rewards', value: stats?.rewardsRedeemed || 0, icon: Gift },
    { label: 'Avg Rating', value: stats?.avgRating || '—', icon: Star },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="ios-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl maroon-gradient flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
            <p className="text-2xl font-display text-foreground">{value}</p>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      {/* Top Items */}
      <div className="ios-card p-4">
        <h3 className="font-display text-sm text-primary mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Trending This Week
        </h3>
        {stats?.topItems && stats.topItems.length > 0 ? (
          <div className="space-y-2">
            {stats.topItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm bg-secondary/20 rounded-xl px-3 py-2">
                <span className="text-foreground">{i + 1}. {item.name}</span>
                <span className="text-primary font-medium text-xs">{item.count} picks</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No data yet</p>
        )}
      </div>

      {/* Recent Feedback */}
      <div className="ios-card p-4">
        <h3 className="font-display text-sm text-primary mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Recent Feedback
        </h3>
        <div className="space-y-2">
          {stats?.feedback && stats.feedback.length > 0 ? (
            stats.feedback.slice(0, 10).map((fb) => (
              <div key={fb.id} className="bg-secondary/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3 h-3 ${s <= fb.rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(fb.created_at).toLocaleDateString()}</span>
                </div>
                {fb.message && <p className="text-sm text-foreground">{fb.message}</p>}
                {fb.ai_response && <p className="text-xs text-muted-foreground mt-1 italic">AI: {fb.ai_response}</p>}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No feedback yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
