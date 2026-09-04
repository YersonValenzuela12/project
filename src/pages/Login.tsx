import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Cctv, Flame, DoorOpen, Activity, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const { supabase } = await import('@/lib/supabase');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message || 'Unable to sign in. Check your credentials.');
      return;
    }
    onLogin();
  };

  const quickFill = (em: string) => {
    setEmail(em);
    setPassword('Selecom1204!');
  };

  const openForgot = () => {
    setForgotEmail(email);
    setForgotSent(false);
    setForgotError(null);
    setForgotOpen(true);
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (!forgotEmail) { setForgotError('Please enter your email.'); return; }
    setForgotLoading(true);
    const { supabase } = await import('@/lib/supabase');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (resetError) {
      setForgotError(resetError.message || 'Unable to send reset email.');
      return;
    }
    setForgotSent(true);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative bg-ink-900 overflow-hidden">
        <img
          src="https://images.pexels.com/photos/264819/pexels-photo-264819.jpeg?auto=compress&cs=tinysrgb&w=1400"
          alt="Security operations center"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/85 via-ink-900/80 to-ink-900/95" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-transparent" />

        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={() => window.location.reload()}
              role="button"
              title="Reload"
            >
              <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shadow-sm ring-1 ring-white/20 p-1">
                <img src="/logo-icon.png" alt="Selecom" className="h-full w-full object-contain" />
              </div>
              <div className="leading-tight">
                <div className="text-lg font-bold"><span className="text-primary-300">Selecom</span></div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-white/50">electronics engineer</div>
              </div>
            </div>
            <span className="text-xs font-medium text-white/60 border border-white/20 rounded-full px-3 py-1">v2.0 Enterprise</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Command every field<br />operation from one console.
            </h1>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Scheduling, dispatch, and compliance for CCTV, access control, fire alarm, fire water, and building Automatitation systems.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { icon: Cctv, label: 'CCTV ' },
                { icon: DoorOpen, label: 'Access Control' },
                { icon: Flame, label: 'Fire Alarm Systems' },
                { icon: Activity, label: 'Automatitation' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 rounded-lg bg-white/5 ring-1 ring-white/10 px-3.5 py-3 backdrop-blur">
                  <f.icon size={18} className="text-primary-300" />
                  <span className="text-sm font-medium text-white/90">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-white/50">
            <span>SYSTEM SENSOR</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>HIKVISION</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>KIDE</span>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Logo size="lg" onClick={() => window.location.reload()} />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-ink-900 tracking-tight">INTRANET</h2>
            <p className="text-sm text-ink-500 mt-1.5">ingresa tus credentiales para acceder a Selecom.</p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">correo</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9" placeholder="you@company.com"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Contraseña</label>
                <button type="button" onClick={openForgot} className="text-xs font-medium text-primary-600 hover:text-primary-700">Forgot password?</button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9 pr-10" placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-ink-600">Keep me signed in for 30 days</span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-70">
              {loading ? 'ingresar…' : (<>Sign in <ArrowRight size={16} /></>)}
            </button>
          </form>
{/*}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-200" />
            <span className="text-xs font-medium text-ink-400 uppercase tracking-wide">Quick demo access</span>
            <div className="h-px flex-1 bg-ink-200" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([                                              //NOMBRE DE USUSRAIOS DE PRUEBA
              { label: 'Admin', email: 'admin@selecom.com', color: 'border-primary-200 hover:border-primary-400 hover:bg-primary-50' },
              { label: 'Supervisor', email: 'jose.rodriguez@selecom.com', color: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50' },
              { label: 'Technician', email: 'yerson.valenzuela@selecom.com', color: 'border-amber-200 hover:border-amber-400 hover:bg-amber-50' },
            ] as const).map((d) => (
              <button
                key={d.label}
                onClick={() => quickFill(d.email)}
                disabled={loading}
                className={cn('btn-secondary py-2.5 text-xs border-2', d.color)}
              >
                {d.label}
              </button>
            ))}
          </div>
*/}
<br/>
<br/>
<br/>
<br/>
<br/>
<br/>
<br/>
          <p className="text-center text-xs text-ink-400 mt-8">
            Protected by Electronics Selecom Information Systems · © 2026
          </p>
        </div>
      </div>

      {/* Forgot password modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setForgotOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <button
              onClick={() => setForgotOpen(false)}
              className="absolute right-4 top-4 text-ink-400 hover:text-ink-700"
            >
              <X size={18} />
            </button>

            {forgotSent ? (
              <div className="text-center py-4">
                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={24} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-ink-900">valida tu correo</h3>
                <p className="text-sm text-ink-500 mt-2">
                  una cuenta existente <span className="font-medium text-ink-700">{forgotEmail}</span>,recibiras el link para cambiar la contraseña.
                </p>
                <button onClick={() => setForgotOpen(false)} className="btn-primary w-full py-2.5 text-sm mt-6">
                  Got it
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-ink-900">cambio de contraseña</h3>
                <p className="text-sm text-ink-500 mt-1.5 mb-5">
                  ingresa tu correo electrónico para cambiar de contraseña.
                </p>

                {forgotError && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3">
                    <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{forgotError}</p>
                  </div>
                )}

                <form onSubmit={submitForgot} className="space-y-4">
                  <div>
                    <label className="label">Correo</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="input pl-9"
                        placeholder="you@selecom.com"
                        autoFocus
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={forgotLoading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-70">
                    {forgotLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
