import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@truck-platform/state';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userType = useAuthStore((s) => s.user?.userType);

  if (!isAuthenticated) return <Redirect href="/auth/login" />;
  if (userType === 'trucker') return <Redirect href="/(trucker)/dashboard" />;
  if (userType === 'merchant') return <Redirect href="/(merchant)/dashboard" />;
  return <Redirect href="/auth/login" />;
}
