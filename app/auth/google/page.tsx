'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useStore } from '@/lib/store';
import { LoadingSpinner } from '@/components/loading-spinner';
import Link from 'next/link';
import { Chrome } from 'lucide-react';

// This component initializes Google OAuth login
// In production, you would use @react-oauth/google package
export default function GoogleAuth() {
  const router = useRouter();
  const { setUser, setIsAuthenticated, addToast } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Simulate Google OAuth flow
  // In production, use google-auth-library or @react-oauth/google
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      // This is a placeholder - in production, get real token from Google
      const googleToken = 'placeholder-google-token';

      const response = await apiClient.googleLogin(googleToken);
      if (response.data?.user) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        addToast(`Welcome ${response.data.user.name}!`, 'success');
        router.push('/dashboard');
      } else {
        setError(response.message || 'Google login failed');
        addToast(response.message || 'Google login failed', 'error');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Google login failed';
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
              <Chrome className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">LCGC ERP</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Sign in with Google</p>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner size="lg" message="Authenticating..." />
              </div>
            ) : (
              <>
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-semibold py-3 rounded-lg transition-all transform hover:scale-105 active:scale-95"
                >
                  <Chrome className="w-5 h-5" />
                  Sign in with Google
                </button>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-200">
                    {error}
                  </div>
                )}

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">Or</span>
                  </div>
                </div>

                <Link
                  href="/auth/otp"
                  className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg transition-all transform hover:scale-105 active:scale-95"
                >
                  Sign in with OTP
                </Link>
              </>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-6">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
