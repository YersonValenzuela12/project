import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/Logo';

export function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const { supabase } = await import('@/lib/supabase');
      // Supabase reads the recovery token from the URL hash automatically
      // and creates a temporary session for this user.
      const { data } = await supabase.auth.getSession();
      setReady(!!data.session);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { supabase } = await import('@/lib/supabase');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message || 'Unable to update password.');
      return;
    }
    setSuccess(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 px-6">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-ink-100 p-8">
        <div className="mb-6"><Logo size="md" /></div>

        {success ? (
          <div className="text-center py-4">
            <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-ink-900">Password updated</h2>
            <p className="text-sm text-ink-500 mt-2">You can now sign in with your new password.</p>
            <a href="/" className="btn-primary w-full py-2.5 text-sm mt-6 inline-flex items-center justify-center gap-2">
              Go to sign in <ArrowRight size={16} />
            </a>
          </div>
        ) : !ready ? (
          <div className="text-center py-6">
            <p className="text-sm text-ink-500">
              This link is invalid or has expired. Please request a new password reset from the sign-in page.
            </p>
            <a href="/" className="btn-secondary w-full py-2.5 text-sm mt-6 inline-flex items-center justify-center">
              Back to sign in
            </a>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-ink-900">Set a new password</h2>
            <p className="text-sm text-ink-500 mt-1.5 mb-5">Choose a strong password for your Selecom account.</p>

            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">New password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-9 pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input pl-9"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-70">
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
