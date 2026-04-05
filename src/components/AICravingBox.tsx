import { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';

interface Suggestion {
  id: string;
  name: string;
  description: string;
  price: number;
  is_veg: boolean;
}

const AICravingBox = () => {
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
    } catch (err) {
      setAiMessage("Sorry, I couldn't process your request right now. Try browsing the menu!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-4 mx-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg text-primary">What are you craving?</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Tell us what you're in the mood for, and we'll find the best match!
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="e.g. 'Something spicy under ₹300' or 'A hearty meal for two'"
          className="flex-1 px-4 py-2 bg-secondary text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:border-primary text-sm"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2 gold-gradient text-primary-foreground font-medium flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {aiMessage && (
        <p className="mt-3 text-sm text-foreground/80 italic">{aiMessage}</p>
      )}

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestions.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-secondary/50 border border-border">
              <div className="flex items-center gap-3">
                <div className={item.is_veg ? 'veg-badge' : 'nonveg-badge'} />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-primary">₹{item.price}</span>
                <button
                  onClick={() => addItem({ menuItemId: item.id, name: item.name, price: item.price, isVeg: item.is_veg })}
                  className="px-3 py-1 text-xs font-medium border border-primary text-primary hover:gold-gradient hover:text-primary-foreground transition-all"
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
