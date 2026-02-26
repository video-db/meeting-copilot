import { useState, useEffect, useCallback } from 'react';
import { getElectronAPI } from '../api/ipc';
import type { PermissionStatus } from '../../shared/types/ipc.types';

export function usePermissions() {
  const [status, setStatus] = useState<PermissionStatus>({
    microphone: false,
    screen: false,
    accessibility: false,
  });
  const [loading, setLoading] = useState(true);

  const checkPermissions = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) {
      setLoading(false);
      return;
    }

    try {
      const permStatus = await api.permissions.getStatus();
      setStatus(permStatus);
    } catch (error) {
      console.error('Failed to check permissions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const requestMicPermission = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) return false;

    const granted = await api.permissions.requestMicPermission();
    if (granted) {
      setStatus((prev) => ({ ...prev, microphone: true }));
    }
    return granted;
  }, []);

  const requestScreenPermission = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) return false;

    const granted = await api.permissions.requestScreenPermission();
    await checkPermissions(); // Re-check since user needs to grant manually
    return granted;
  }, [checkPermissions]);

  const openSettings = useCallback(async (pane: string) => {
    const api = getElectronAPI();
    if (!api) return;
    await api.permissions.openSystemSettings(pane);
  }, []);

  const allGranted = status.microphone && status.screen;

  return {
    status,
    loading,
    allGranted,
    checkPermissions,
    requestMicPermission,
    requestScreenPermission,
    openSettings,
  };
}
