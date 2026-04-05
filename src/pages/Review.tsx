import { useState } from 'react';
import { Star, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCustomer } from '@/contexts/CustomerContext';

const ReviewPage = () => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const { customer } = useCustomer();

  const handleRatingSelect = async (stars: number) => {
    setRating(stars);
    if (stars >= 5) {
      // Save feedback then redirect to Google
      await supabase.from('feedback').insert({
        rating: stars,
        customer_id: customer?.id || null,
        message: 'Redirected to Google Review',
      });
      // TODO: Make this configurable via staff portal
      window.open('https://g.page/r/YOUR_GOOGLE_REVIEW_LINK/review', '_blank');
      setSubmitted(true);
    } else if (stars < 4) {
      setShowFeedbackForm(true);
    } else {
      // 4 stars - just save
      await supabase.from('feedback').insert({
        rating: stars,
        customer_id: customer?.id || null,
      });
      setSubmitted(true);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-review', {
        body: { message: feedback, rating },
      });

      const response = data?.response || "Thank you for your feedback. We'll work on improving your experience.";
      setAiResponse(response);

      await supabase.from('feedback').insert({
        rating,
        customer_id: customer?.id || null,
        message: feedback,
        ai_response: response,
      });

      setSubmitted(true);
    } catch {
      setAiResponse("Thank you for your feedback. We'll work on improving.");
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="glass-panel-strong">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display text-xl gold-text">Review Us</h1>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="glass-panel p-8 max-w-md w-full text-center">
          {!submitted ? (
            <>
              {!showFeedbackForm ? (
                <>
                  <h2 className="font-display text-2xl text-primary mb-2">How was your experience?</h2>
                  <p className="text-muted-foreground text-sm mb-6">Tap a star to rate us</p>
                  <div className="flex justify-center gap-3 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        onClick={() => handleRatingSelect(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-10 h-10 ${
                            star <= (hoveredRating || rating)
                              ? 'fill-primary text-primary'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl text-foreground mb-2">We're sorry!</h2>
                  <p className="text-muted-foreground text-sm mb-4">May we know what went wrong?</p>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us about your experience..."
                    className="w-full h-32 px-4 py-3 bg-secondary text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none text-sm"
                  />
                  <button
                    onClick={handleSubmitFeedback}
                    disabled={loading || !feedback.trim()}
                    className="mt-4 w-full py-3 gold-gradient text-primary-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Feedback
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl text-primary mb-4">Thank You! 🙏</h2>
              {aiResponse && (
                <div className="glass-panel p-4 text-left mb-4">
                  <p className="text-sm text-foreground">{aiResponse}</p>
                </div>
              )}
              <Link to="/" className="inline-block px-6 py-2 gold-gradient text-primary-foreground font-medium mt-4">
                Back to Menu
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewPage;
