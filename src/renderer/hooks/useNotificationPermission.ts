import { useCallback, useEffect, useRef, useState } from 'react';

function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
    return null;
  }

  return window.Notification.permission;
}

export function useNotificationPermission() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkPermission = useCallback(async () => {
    const permission = getNotificationPermission();

    if (permission !== null) {
      if (mountedRef.current) {
        setEnabled(permission === 'granted');
        setLoading(false);
      }
      return permission === 'granted';
    }

    try {
      const supported = await window.electronAPI.permissions.checkNotificationPermission();
      if (mountedRef.current) {
        setEnabled(supported);
      }
      return supported;
    } catch {
      return false;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  useEffect(() => {
    const onFocus = () => {
      checkPermission();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkPermission();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkPermission();
      }
    }, 3000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [checkPermission]);

  const openSettings = useCallback(async () => {
    await window.electronAPI.permissions.openSystemSettings('notifications');

    const pollCount = 20;
    for (let i = 0; i < pollCount; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      await checkPermission();
    }
  }, [checkPermission]);

  return {
    enabled,
    loading,
    checkPermission,
    openSettings,
  };
}
