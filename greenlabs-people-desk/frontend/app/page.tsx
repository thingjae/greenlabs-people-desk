'use client';
import { useEffect } from 'react';
import { getMe } from '@/lib/api';
export default function Home() {
  useEffect(() => { const m = getMe(); window.location.replace(!m ? '/login' : m.role === 'EMPLOYEE' ? '/ask' : '/board'); }, []);
  return null;
}
