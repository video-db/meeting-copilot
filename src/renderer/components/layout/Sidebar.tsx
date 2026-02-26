import React from 'react';
import { Video, History, Settings, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { useConfigStore } from '../../stores/config.store';
import { getElectronAPI } from '../../api/ipc';
import { cn } from '../../lib/utils';

interface SidebarProps {
  activeTab: 'recording' | 'history' | 'settings';
  onTabChange: (tab: 'recording' | 'history' | 'settings') => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const configStore = useConfigStore();

  const handleLogout = async () => {
    const api = getElectronAPI();
    if (api) {
      await api.app.logout();
    }
    configStore.clearAuth();
  };

  const tabs = [
    { id: 'recording' as const, icon: Video, label: 'Recording' },
    { id: 'history' as const, icon: History, label: 'History' },
    { id: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-full w-16 border-r bg-muted/30">
      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center gap-2 py-4">
        {tabs.map(({ id, icon: Icon, label }) => (
          <Button
            key={id}
            variant="ghost"
            size="icon"
            className={cn(
              'w-10 h-10 no-drag',
              activeTab === id && 'bg-accent text-accent-foreground'
            )}
            onClick={() => onTabChange(id)}
            title={label}
          >
            <Icon className="h-5 w-5" />
          </Button>
        ))}
      </nav>

      {/* User section */}
      <div className="flex flex-col items-center gap-2 py-4 border-t">
        {configStore.userName && (
          <div
            className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium"
            title={configStore.userName}
          >
            {configStore.userName.charAt(0).toUpperCase()}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 no-drag text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
