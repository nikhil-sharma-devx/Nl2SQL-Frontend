/**
 * AuthPage — Login / Register screen with Google Sign-In.
 *
 * Redesigned: bold dark "data instrument" aesthetic with aurora atmosphere,
 * shadcn primitives, and a dual-mode (login / register) tab transition.
 * Business logic, modes, and handlers are unchanged.
 */
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { forgotPassword, resetPassword } from '../api/client';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  KeyRound,
  RefreshCw,
  ArrowLeft,
  TerminalSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

const titleByMode: Record<Mode, string> = {
  login: 'Sign In',
  register: 'Create Account',
  verify: 'Verify Email',
  forgot: 'Send Reset Link',
  reset: 'Reset Password',
};

const AuthPage = () => {
  const { login, register, verifyOTP, resendOTP, googleLogin } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (mode !== 'forgot' && mode !== 'verify' && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'forgot') {
        await forgotPassword(email);
        setMode('reset');
        setError(null);
      } else if (mode === 'reset') {
        await resetPassword(email, otpCode, password);
        setMode('login');
        setError('Password reset successfully. Please sign in with your new password.');
        setPassword('');
      } else if (mode === 'verify') {
        await verifyOTP(email, otpCode);
        navigate('/');
      } else if (mode === 'login') {
        await login(email, password);
        navigate('/');
      } else {
        await register(email, password, fullName || undefined);
        setMode('verify');
        setError(null);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Something went wrong. Please try again.';

      if (msg.includes('Unverified email')) {
        setMode('verify');
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await resendOTP(email);
      setError('A new verification code has been sent to your email.');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to resend OTP. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setIsLoading(true);
    setError(null);
    try {
      await googleLogin(credentialResponse.credential);
      navigate('/');
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isErrorBanner =
    !!error && !error.toLowerCase().includes('success') && !error.toLowerCase().includes('sent');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background p-4">
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />
      <div className="auth-blob auth-blob-3" />

      <div className="relative z-10 w-full max-w-[420px] animate-slide-up rounded-3xl border border-border/80 bg-popover/82 p-8 shadow-[0_40px_140px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl">
        <div className="mb-7 flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-[0_0_36px_rgba(16,185,129,0.65),0_0_12px_rgba(16,185,129,0.4)] glow-primary">
            <TerminalSquare className="h-6 w-6" strokeWidth={2.3} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground">NL-to-SQL</h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/70">
              Query in plain English
            </p>
          </div>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as Mode);
              clearError();
            }}
            className="mb-6"
          >
            <TabsList>
              <TabsTrigger id="tab-login" value="login">
                Sign In
              </TabsTrigger>
              <TabsTrigger id="tab-register" value="register">
                Create Account
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {(mode === 'verify' || mode === 'reset') && (
          <div className="mb-6 text-center">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {mode === 'verify' ? 'Verify Your Email' : 'Reset Password'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the 6-digit code sent to
              <br />
              <strong className="font-mono text-primary">{email}</strong>
            </p>
          </div>
        )}
        {mode === 'forgot' && (
          <div className="mb-6 text-center">
            <h2 className="font-display text-xl font-semibold text-foreground">Forgot Password</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email to receive a password reset code.</p>
          </div>
        )}

        {error && (
          <div
            className={cn(
              'mb-4 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm',
              isErrorBanner
                ? 'animate-shake border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-primary/30 bg-primary/10 text-primary',
            )}
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-fullname">Full Name (optional)</Label>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80" />
                <Input
                  id="auth-fullname"
                  type="text"
                  className="pl-10"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80" />
                <Input
                  id="auth-email"
                  type="email"
                  className="pl-10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="auth-password">{mode === 'reset' ? 'New Password' : 'Password'}</Label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      clearError();
                    }}
                    className="text-xs font-medium normal-case tracking-normal text-primary hover:text-primary"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80" />
                <Input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="px-10"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 transition-colors hover:text-foreground/85"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80" />
                <Input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className="pl-10"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {(mode === 'verify' || mode === 'reset') && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-otp">Verification Code</Label>
              <div className="relative">
                <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80" />
                <Input
                  id="auth-otp"
                  type="text"
                  className="pl-10 text-center font-mono text-lg tracking-[0.35em]"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoComplete="one-time-code"
                />
              </div>
            </div>
          )}

          <Button id="auth-submit" type="submit" disabled={isLoading} size="lg" className="mt-1 w-full">
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : (
              <>
                <Sparkles size={16} />
                {titleByMode[mode]}
              </>
            )}
          </Button>

          {(mode === 'verify' || mode === 'reset') && (
            <Button type="button" variant="outline" disabled={isLoading} onClick={handleResendOTP} className="w-full">
              <RefreshCw size={16} />
              Resend Code
            </Button>
          )}
        </form>

        {(mode === 'login' || mode === 'register') && (
          <>
            <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground/80">
              <span className="h-px flex-1 bg-border" />
              or continue with
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in was cancelled or failed')}
                theme="filled_black"
                shape="pill"
                size="large"
                text={mode === 'login' ? 'signin_with' : 'signup_with'}
                width="356"
              />
            </div>
          </>
        )}

        {mode === 'login' || mode === 'register' ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              className="font-semibold text-primary hover:text-primary"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                clearError();
              }}
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        ) : (
          <p className="mt-6 text-center text-sm">
            <button
              type="button"
              className="mx-auto flex items-center gap-2 font-semibold text-primary hover:text-primary"
              onClick={() => {
                setMode('login');
                clearError();
              }}
            >
              <ArrowLeft size={16} />
              Back to Sign In
            </button>
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
