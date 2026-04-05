import { useState } from 'react';
import { useStaffAuth } from '@/contexts/StaffAuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';

const StaffLogin = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useStaffAuth();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!pin.trim()) return;
    setError('');
    setLoading(true);
    const success = await login(pin);
    setLoading(false);
    if (success) {
      navigate('/staff/dashboard');
    } else {
      setError('Invalid PIN');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="glass-panel p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 gold-gradient flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl gold-text mb-2">Staff Portal</h1>
        <p className="text-muted-foreground text-sm mb-6">Enter your PIN to continue</p>

        <input
          type="password"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="• • • • • •"
          className="w-full px-4 py-4 bg-secondary text-foreground text-center text-2xl tracking-[0.5em] border border-border placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />

        {error && <p className="text-destructive text-sm mt-2">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || pin.length < 4}
          className="w-full mt-4 py-3 gold-gradient text-primary-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Unlock
        </button>
      </div>
    </div>
  );
};

export default StaffLogin;
