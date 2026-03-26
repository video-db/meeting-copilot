/**
 * Settings View Component
 *
 * Main settings page with tabs for Account, Notifications, MCP Servers, and Workflows.
 * Redesigned based on Figma specs.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Eye,
  EyeOff,
  Copy,
  Pencil,
  LogOut,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useConfigStore } from '../../stores/config.store';
import { MCPServersPanel } from './MCPServersPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { WorkflowsPanel } from './WorkflowsPanel';

type SettingsTab = 'account' | 'notifications' | 'mcpServers' | 'workflows';

interface SettingsViewProps {
  initialTab?: SettingsTab | null;
  onClearInitialTab?: () => void;
}

// Tab navigation component
function SettingsTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}) {
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'account', label: 'Account' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'mcpServers', label: 'MCP Servers' },
    { id: 'workflows', label: 'Workflows' },
  ];

  return (
    <div className="bg-[#f7f7f7] flex gap-[10px] p-[4px] rounded-[14px] w-full">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-[16px] py-[12px] rounded-[12px] text-[14px] font-medium transition-all ${
            activeTab === tab.id
              ? 'bg-[#ff4000] text-white font-semibold shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]'
              : 'text-[#464646] hover:bg-[#efefef]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// Settings Card wrapper
function SettingsCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-[#e4e4ec] rounded-[14px] overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

// Card header
function CardHeader({ title }: { title: string }) {
  return (
    <div className="px-[20px] py-[16px] border-b border-[#ededf3]">
      <h3 className="text-[16px] font-semibold text-[#141420] leading-[22.5px]">
        {title}
      </h3>
    </div>
  );
}

// Card row
function CardRow({
  label,
  children,
  hasBorder = true,
}: {
  label: string;
  children: React.ReactNode;
  hasBorder?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-[20px] py-[14px] ${
        hasBorder ? 'border-b border-[#ededf3]' : ''
      }`}
    >
      <span className="text-[14px] font-medium text-[#464646]">{label}</span>
      <div className="flex items-center gap-[8px]">{children}</div>
    </div>
  );
}

// Google Calendar icon SVG
function GoogleCalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 2.25H4.5C3.67157 2.25 3 2.92157 3 3.75V14.25C3 15.0784 3.67157 15.75 4.5 15.75H13.5C14.3284 15.75 15 15.0784 15 14.25V3.75C15 2.92157 14.3284 2.25 13.5 2.25Z" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 1.5V3" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 1.5V3" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 6H15" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="5.25" y="8.25" width="2.25" height="2.25" rx="0.5" fill="#EA4335"/>
      <rect x="7.875" y="8.25" width="2.25" height="2.25" rx="0.5" fill="#FBBC05"/>
      <rect x="10.5" y="8.25" width="2.25" height="2.25" rx="0.5" fill="#34A853"/>
      <rect x="5.25" y="10.875" width="2.25" height="2.25" rx="0.5" fill="#4285F4"/>
    </svg>
  );
}

// Calendar icon for empty state
function CalendarEmptyIcon() {
  return (
    <div className="w-[50px] h-[50px] bg-[rgba(255,64,0,0.1)] border border-[rgba(236,91,22,0.13)] rounded-[8px] flex items-center justify-center">
      <Calendar className="w-[25px] h-[25px] text-[#ec5b16]" />
    </div>
  );
}

// Logout icon SVG
function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H7.5" stroke="#d1242f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.333 14.1667L17.4997 10L13.333 5.83337" stroke="#d1242f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.5 10H7.5" stroke="#d1242f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Account Panel Component
function AccountPanel() {
  const configStore = useConfigStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Calendar state
  const [calendarStatus, setCalendarStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);

  // Check calendar auth status on mount
  useEffect(() => {
    checkCalendarStatus();

    // Listen for auth required
    const unsubAuthRequired = window.electronAPI.calendarOn.onAuthRequired(() => {
      setCalendarStatus('error');
    });

    return () => {
      unsubAuthRequired();
    };
  }, []);

  const checkCalendarStatus = async () => {
    setIsLoadingCalendar(true);
    try {
      const result = await window.electronAPI.calendar.isSignedIn();
      if (result.success && result.isSignedIn) {
        setCalendarStatus('connected');
        // Could store email if available
      } else {
        setCalendarStatus('disconnected');
      }
    } catch (err) {
      setCalendarStatus('error');
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarStatus('connecting');
    try {
      const result = await window.electronAPI.calendar.signIn();
      if (result.success) {
        setCalendarStatus('connected');
      } else {
        setCalendarStatus('error');
      }
    } catch (err) {
      setCalendarStatus('error');
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      await window.electronAPI.calendar.signOut();
      setCalendarStatus('disconnected');
    } catch (err) {
      // Ignore error
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return key;
    return `${key.slice(0, 8)} •••••••`;
  };

  const handleCopyApiKey = async () => {
    if (configStore.apiKey) {
      await navigator.clipboard.writeText(configStore.apiKey);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleSaveApiKey = async () => {
    if (!newApiKey.trim()) return;
    setIsSaving(true);
    try {
      configStore.setConfig({ apiKey: newApiKey.trim() });
      setIsEditingApiKey(false);
      setNewApiKey('');
    } catch (err) {
      console.error('Failed to save API key:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingApiKey(false);
    setNewApiKey('');
  };

  const handleLogout = () => {
    configStore.clearAuth();
  };

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Account Card */}
      <SettingsCard>
        <CardHeader title="Account" />

        {/* Name Row */}
        <CardRow label="Name">
          <span className="text-[14px] font-medium text-black">
            {configStore.userName || 'Not set'}
          </span>
        </CardRow>

        {/* API Key Row */}
        <CardRow label="API Key" hasBorder={false}>
          {isEditingApiKey ? (
            <>
              <input
                type="text"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Paste new API key"
                className="w-[200px] px-[12px] py-[6px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[8px] text-[13px] text-[#141420] placeholder:text-[#969696] outline-none focus:border-[#ec5b16]"
              />
              <button
                onClick={handleSaveApiKey}
                disabled={isSaving || !newApiKey.trim()}
                className="px-[10px] py-[6px] bg-[#ff4000] hover:bg-[#e63900] disabled:opacity-50 rounded-[8px] text-[13px] font-medium text-white transition-colors"
              >
                {isSaving ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-[10px] py-[6px] bg-[#f0f0f5] border border-[#efefef] rounded-[8px] text-[13px] font-medium text-[#464646] hover:bg-[#e8e8ed] transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="text-[14px] font-medium text-black font-mono">
                {showApiKey
                  ? configStore.apiKey || 'Not set'
                  : maskApiKey(configStore.apiKey || '')}
              </span>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-[6px] bg-[#f0f0f5] border border-[#efefef] rounded-[8px] hover:bg-[#e8e8ed] transition-colors"
                title={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? (
                  <EyeOff className="w-[16px] h-[16px] text-[#464646]" />
                ) : (
                  <Eye className="w-[16px] h-[16px] text-[#464646]" />
                )}
              </button>
              <button
                onClick={handleCopyApiKey}
                className="p-[6px] bg-[#f0f0f5] border border-[#efefef] rounded-[8px] hover:bg-[#e8e8ed] transition-colors"
                title={copySuccess ? 'Copied!' : 'Copy API key'}
              >
                {copySuccess ? (
                  <Check className="w-[16px] h-[16px] text-[#059669]" />
                ) : (
                  <Copy className="w-[16px] h-[16px] text-[#464646]" />
                )}
              </button>
              <button
                onClick={() => setIsEditingApiKey(true)}
                className="flex items-center gap-[4px] px-[10px] py-[6px] bg-[#f0f0f5] border border-[#efefef] rounded-[8px] hover:bg-[#e8e8ed] transition-colors"
              >
                <Pencil className="w-[16px] h-[16px] text-[#ff4000]" />
                <span className="text-[13px] font-medium text-[#ff4000]">Change</span>
              </button>
            </>
          )}
        </CardRow>
      </SettingsCard>

      {/* Calendar Connection Card */}
      <SettingsCard>
        <CardHeader title="Calendar Connection" />
        <div className="flex flex-col items-center gap-[14px] py-[21px]">
          {isLoadingCalendar ? (
            <Loader2 className="w-[32px] h-[32px] text-[#ec5b16] animate-spin" />
          ) : calendarStatus === 'connected' ? (
            <>
              <div className="flex items-center gap-[8px] p-[12px] bg-[#ecfdf5] rounded-[10px]">
                <Check className="w-[18px] h-[18px] text-[#059669]" />
                <span className="text-[14px] font-medium text-[#059669]">
                  Calendar connected
                </span>
              </div>
              <button
                onClick={handleDisconnectCalendar}
                className="px-[25px] py-[13px] bg-white border border-[#d0d0d8] rounded-[12px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.06)] text-[14px] font-medium text-[#464646] hover:bg-[#f7f7f7] transition-colors"
              >
                Disconnect Calendar
              </button>
            </>
          ) : (
            <>
              <CalendarEmptyIcon />
              <p className="text-[13px] text-[#969696] text-center max-w-[320px]">
                Connect calendars to auto-detect meetings
              </p>
              <button
                onClick={handleConnectCalendar}
                disabled={calendarStatus === 'connecting'}
                className="flex items-center gap-[8px] px-[25px] py-[13px] bg-white border border-[#d0d0d8] rounded-[12px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.06)] text-[14px] font-medium text-black hover:bg-[#f7f7f7] transition-colors disabled:opacity-50"
              >
                {calendarStatus === 'connecting' ? (
                  <Loader2 className="w-[18px] h-[18px] animate-spin" />
                ) : (
                  <GoogleCalendarIcon />
                )}
                <span>Connect Google Calendar</span>
              </button>
            </>
          )}
        </div>
      </SettingsCard>

      {/* Log out Button */}
      <button
        onClick={handleLogout}
        className="flex items-center justify-center gap-[8px] w-full px-[17px] py-[11px] bg-[rgba(209,36,47,0.06)] border border-[rgba(209,36,47,0.19)] rounded-[10px] hover:bg-[rgba(209,36,47,0.1)] transition-colors"
      >
        <LogoutIcon />
        <span className="text-[14px] font-semibold text-[#d1242f]">Log out</span>
      </button>
    </div>
  );
}

export function SettingsView({ initialTab, onClearInitialTab }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'account');

  // Apply initial tab when it changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      onClearInitialTab?.();
    }
  }, [initialTab, onClearInitialTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return <AccountPanel />;
      case 'notifications':
        return <NotificationsPanel />;
      case 'mcpServers':
        return <MCPServersPanel />;
      case 'workflows':
        return <WorkflowsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="flex items-start justify-center pt-[40px] pb-[24px] px-[60px]">
        <div className="flex-1 max-w-[660px] flex flex-col gap-[30px]">
          {/* Title */}
          <h1 className="text-[24px] font-semibold text-[#141420] tracking-[-0.17px]">
            Settings
          </h1>

          {/* Content */}
          <div className="flex flex-col gap-[24px]">
            {/* Tab Navigation */}
            <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Tab Content */}
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
