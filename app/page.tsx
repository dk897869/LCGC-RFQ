'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/auth');
    }
  }, [router]);

  return <LoadingSpinner fullScreen size="lg" message="Loading..." />;
}
