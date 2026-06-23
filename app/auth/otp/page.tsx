'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useStore } from '@/lib/store';
import { LoadingButton } from '@/components/loading-spinner';
import Link from 'next/link';
import { Mail, Lock } from 'lucide-react';

export default function OTPLogin() {
  const router = useRouter();
  const { setUser, setIsAuthenticated, addToast } = useStore();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOTP] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiClient.requestOTP(email);
      if (response.success) {
        setStep('otp');
        addToast('OTP sent to your email', 'success');
      } else {
        setError(response.message || 'Failed to send OTP');
        addToast(response.message || 'Failed to send OTP', 'error');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to request OTP';
      setError(errorMsg);
      addToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiClient.verifyOTP(email, otp);
      if (response.data?.user) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        addToast(`Welcome ${response.data.user.name}!`, 'success');
        router.push('/dashboard');
      } else {
        setError(response.message || 'Failed to verify OTP');
        addToast(response.message || 'Failed to verify OTP', 'error');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to verify OTP';
      setError(errorMsg);
      addToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 border border-slate-200 dark:border-slate-700">
          {/* Logo & Branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">LCGC ERP</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Sign in with OTP</p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-200">{error}</div>}

              <LoadingButton
                type="submit"
                isLoading={isLoading}
                loadingText="Sending OTP..."
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 rounded-lg transition-all transform hover:scale-105 active:scale-95"
              >
                Send OTP
              </LoadingButton>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Enter the OTP sent to <span className="font-semibold text-slate-900 dark:text-white">{email}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  OTP Code
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOTP(e.target.value.toUpperCase())}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-center text-lg tracking-widest"
                  />
                </div>
              </div>

              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-200">{error}</div>}

              <LoadingButton
                type="submit"
                isLoading={isLoading}
                loadingText="Verifying..."
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-2 rounded-lg transition-all transform hover:scale-105 active:scale-95"
              >
                Verify OTP
              </LoadingButton>

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOTP('');
                  setError('');
                }}
                className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline py-2"
              >
                Change Email
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
              Or{' '}
              <Link href="/auth/google" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                Sign in with Google
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
