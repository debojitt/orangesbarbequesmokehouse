import { useState } from 'react';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';

interface Suggestion {
  id: string;
  name: string;
  description: string;
  price: number;
  is_veg: boolean;
}

const AICravingBox = ({ onClose }: { onClose?: () => void }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [aiMessage, setAiMessage] = useState('');
  const { addItem } = useCart();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSuggestions([]);
    setAiMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('ai-craving', {
        body: { query: query.trim() },
      });
      if (error) throw error;
      if (data?.suggestions) setSuggestions(data.suggestions);
      if (data?.message) setAiMessage(data.message);
    } catch {
      setAiMessage("Sorry, I couldn't process your request right now. Try browsing the menu!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel-strong rounded-2xl p-4 border border-primary/20 shadow-2xl max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-display text-base gold-text">What are you craving?</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="e.g. 'Something spicy under ₹300'"
          className="flex-1 px-3 py-2 bg-secondary/60 text-foreground rounded-xl border border-border placeholder:text-muted-foreground focus:outline-none focus:border-primary text-sm"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-3 py-2 gold-gradient text-primary-foreground rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {aiMessage && <p className="mt-3 text-sm text-foreground/80 italic">{aiMessage}</p>}
      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestions.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-secondary/40 rounded-xl border border-border/50">
              <div className="flex items-center gap-3">
                <div className={item.is_veg ? 'veg-badge' : 'nonveg-badge'} />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-primary">₹{item.price}</span>
                <button
                  onClick={() => addItem({ menuItemId: item.id, name: item.name, price: item.price, isVeg: item.is_veg })}
                  className="px-2 py-1 text-xs font-medium gold-gradient text-primary-foreground rounded-lg"
                >
                  ADD
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AICravingBox;
