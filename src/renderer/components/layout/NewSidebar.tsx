/**
 * NewSidebar Component
 *
 * New sidebar design matching the Figma mockup.
 * - Company logo placeholder
 * - Home icon (active state with orange background)
 * - Record icon
 * - Settings icon
 * - Logout at bottom
 */

import React from 'react';
import { LogOut } from 'lucide-react';
import { useConfigStore } from '../../stores/config.store';
import { getElectronAPI } from '../../api/ipc';

type Tab = 'home' | 'history' | 'settings';

interface NewSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

// Home Icon
function HomeIcon({ active }: { active: boolean }) {
  const color = active ? '#ec5b16' : '#464646';
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? 'rgba(236,91,22,0.15)' : 'none'}
      />
      <path
        d="M9 22V12h6v10"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Record/History Icon
function RecordIcon({ active }: { active: boolean }) {
  const color = active ? '#ec5b16' : '#464646';
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="3"
        y="6"
        width="14"
        height="12"
        rx="2"
        stroke={color}
        strokeWidth="1.5"
        fill={active ? 'rgba(236,91,22,0.15)' : 'none'}
      />
      <path
        d="M17 9.5l4-2.5v10l-4-2.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Settings Icon
function SettingsIcon({ active }: { active: boolean }) {
  const color = active ? '#ec5b16' : '#464646';
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth="1.5"
        fill={active ? 'rgba(236,91,22,0.15)' : 'none'}
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Logout Icon
function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
        stroke="#464646"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17l5-5-5-5M21 12H9"
        stroke="#464646"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NewSidebar({ activeTab, onTabChange }: NewSidebarProps) {
  const configStore = useConfigStore();

  const handleLogout = async () => {
    const api = getElectronAPI();
    if (api) {
      await api.app.logout();
    }
    configStore.clearAuth();
  };

  const tabs: { id: Tab; icon: (active: boolean) => React.ReactNode; label: string }[] = [
    { id: 'home', icon: (a) => <HomeIcon active={a} />, label: 'Home' },
    { id: 'history', icon: (a) => <RecordIcon active={a} />, label: 'Recordings' },
    { id: 'settings', icon: (a) => <SettingsIcon active={a} />, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-full bg-white border-r border-[rgba(0,0,0,0.1)]">
      {/* Top section with logo and nav */}
      <div className="flex-1 flex flex-col items-center gap-[20px] p-[20px]">
        {/* Logo placeholder */}
        <div className="w-[40px] h-[40px] rounded-[9px] bg-[#efefef]" />

        {/* Navigation items */}
        {tabs.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`p-[4px] rounded-[6px] transition-colors ${
              activeTab === id ? 'bg-[#ffe9d3]' : 'hover:bg-[#f5f5f5]'
            }`}
            title={label}
          >
            {icon(activeTab === id)}
          </button>
        ))}
      </div>

      {/* Bottom section with logout */}
      <div className="flex flex-col items-center pb-[20px]">
        <button
          onClick={handleLogout}
          className="p-[4px] rounded-[6px] hover:bg-[#f5f5f5] transition-colors"
          title="Logout"
        >
          <LogoutIcon />
        </button>
      </div>
    </div>
  );
}

export default NewSidebar;
