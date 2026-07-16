import { useState } from 'react';
import { useStaffAuth } from '@/contexts/StaffAuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Loader2, ShieldCheck } from 'lucide-react';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#160d1d] px-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-28 h-[28rem] w-[28rem] rounded-full bg-fuchsia-800/20 blur-3xl" />
      <Link
        to="/"
        aria-label="Back to main menu"
        className="ios-press absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Main Menu
      </Link>
      <div className="relative w-full max-w-sm rounded-[28px] border border-white/15 bg-white/[0.07] p-8 text-center shadow-[0_25px_80px_rgba(0,0,0,.45)] backdrop-blur-2xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 shadow-[0_0_35px_rgba(249,115,22,.35)]">
          <Lock className="w-8 h-8 text-primary-foreground" />
        </div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-orange-300">Orange's Smokehouse</p>
        <h1 className="font-display mb-2 text-3xl font-black text-white">Staff Portal</h1>
        <p className="mb-6 text-sm text-white/55">Enter your secure PIN to continue</p>

        <input
          type="password"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="• • • • • •"
          aria-label="Staff PIN"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none transition-all placeholder:text-white/25 focus:border-orange-400/70 focus:ring-4 focus:ring-orange-500/10"
        />

        {error && <p className="mt-2 text-sm font-medium text-red-300">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || pin.length < 4}
          className="ios-press mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 py-3.5 font-black text-[#2a1210] shadow-[0_10px_30px_rgba(249,115,22,.25)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Unlock
        </button>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-white/35">
          <ShieldCheck className="h-3.5 w-3.5" />
          Authorized staff access only
        </p>
      </div>
    </div>
  );
};

export default StaffLogin;
