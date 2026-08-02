'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const mode = typeof window !== 'undefined' ? localStorage.getItem('zhizi_analysis_mode') : null;
    if (isLoggedIn() || mode === 'remote') {
      router.replace('/analyze');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#E8B931]/30 border-t-[#E8B931] rounded-full animate-spin" />
    </div>
  );
}
