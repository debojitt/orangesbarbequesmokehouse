import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Calendar, Gift, TrendingUp, MessageSquare, Star } from 'lucide-react';

const StaffDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ['staff-stats'],
    queryFn: async () => {
      const [customers, feedback, selections, visits] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('item_selections').select('menu_item_id, menu_items(name)').gte('selected_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('loyalty_visits').select('id', { count: 'exact', head: true }).gte('claimed_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);

      // Count most selected items
      const itemCounts: Record<string, { name: string; count: number }> = {};
      (selections.data || []).forEach((s: any) => {
        const name = s.menu_items?.name || 'Unknown';
        if (!itemCounts[s.menu_item_id]) itemCounts[s.menu_item_id] = { name, count: 0 };
        itemCounts[s.menu_item_id].count++;
      });
      const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 5);

      return {
        totalGuests: customers.count || 0,
        rewardsRedeemed: visits.count || 0,
        feedback: feedback.data || [],
        topItems,
      };
    },
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Guests', value: stats?.totalGuests || 0, icon: Users },
          { label: 'Rewards This Month', value: stats?.rewardsRedeemed || 0, icon: Gift },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-display text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Top Items This Week */}
      <div className="glass-panel p-4">
        <h3 className="font-display text-sm text-primary mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Most Selected This Week
        </h3>
        {stats?.topItems && stats.topItems.length > 0 ? (
          <div className="space-y-2">
            {stats.topItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-foreground">{i + 1}. {item.name}</span>
                <span className="text-primary font-medium">{item.count} orders</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No data yet</p>
        )}
      </div>

      {/* Feedback Feed */}
      <div className="glass-panel p-4">
        <h3 className="font-display text-sm text-primary mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Recent Feedback
        </h3>
        <div className="space-y-3">
          {stats?.feedback && stats.feedback.length > 0 ? (
            stats.feedback.map((fb) => (
              <div key={fb.id} className="glass-panel p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3 h-3 ${s <= fb.rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(fb.created_at).toLocaleDateString()}</span>
                </div>
                {fb.message && <p className="text-sm text-foreground">{fb.message}</p>}
                {fb.ai_response && (
                  <p className="text-xs text-muted-foreground mt-1 italic">AI: {fb.ai_response}</p>
                )}
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
