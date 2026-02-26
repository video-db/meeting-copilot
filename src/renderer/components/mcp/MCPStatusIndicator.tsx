/**
 * MCP Status Indicator Component
 *
 * Shows connection status for MCP servers as a compact badge or indicator.
 */

import React from 'react';
import { Badge } from '../ui/badge';
import { Server, Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { useMCPStore, selectConnectionStates, selectAvailableTools } from '../../stores/mcp.store';
import { cn } from '../../lib/utils';

type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface MCPStatusIndicatorProps {
  variant?: 'badge' | 'dot' | 'compact';
  showToolCount?: boolean;
  className?: string;
}

function getStatusInfo(status: MCPConnectionStatus) {
  switch (status) {
    case 'connected':
      return {
        icon: Wifi,
        color: 'text-green-500',
        bgColor: 'bg-green-500',
        badgeVariant: 'default' as const,
        label: 'Connected',
      };
    case 'connecting':
      return {
        icon: Loader2,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500',
        badgeVariant: 'secondary' as const,
        label: 'Connecting...',
      };
    case 'error':
      return {
        icon: AlertCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-500',
        badgeVariant: 'destructive' as const,
        label: 'Error',
      };
    default:
      return {
        icon: WifiOff,
        color: 'text-slate-400',
        bgColor: 'bg-slate-400',
        badgeVariant: 'outline' as const,
        label: 'Disconnected',
      };
  }
}

export function MCPStatusIndicator({
  variant = 'badge',
  showToolCount = false,
  className,
}: MCPStatusIndicatorProps) {
  const connectionStates = useMCPStore(selectConnectionStates);
  const availableTools = useMCPStore(selectAvailableTools);

  // Determine overall status
  const statuses = Object.values(connectionStates);
  let overallStatus: MCPConnectionStatus = 'disconnected';

  if (statuses.some((s) => s.status === 'connected')) {
    overallStatus = 'connected';
  } else if (statuses.some((s) => s.status === 'connecting')) {
    overallStatus = 'connecting';
  } else if (statuses.some((s) => s.status === 'error')) {
    overallStatus = 'error';
  }

  const connectedCount = statuses.filter((s) => s.status === 'connected').length;
  const totalCount = statuses.length;
  const toolCount = availableTools.length;

  const statusInfo = getStatusInfo(overallStatus);
  const StatusIcon = statusInfo.icon;

  if (totalCount === 0) {
    return null;
  }

  if (variant === 'dot') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <div
          className={cn(
            'w-2 h-2 rounded-full',
            statusInfo.bgColor,
            overallStatus === 'connecting' && 'animate-pulse'
          )}
        />
        {showToolCount && toolCount > 0 && (
          <span className="text-xs text-slate-500">{toolCount}</span>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <StatusIcon
          className={cn(
            'h-3.5 w-3.5',
            statusInfo.color,
            overallStatus === 'connecting' && 'animate-spin'
          )}
        />
        <span className="text-xs font-medium">
          {connectedCount}/{totalCount}
        </span>
        {showToolCount && toolCount > 0 && (
          <span className="text-xs text-slate-500">({toolCount} tools)</span>
        )}
      </div>
    );
  }

  // Badge variant
  return (
    <Badge variant={statusInfo.badgeVariant} className={cn('gap-1.5', className)}>
      <Server className="h-3 w-3" />
      <StatusIcon
        className={cn(
          'h-3 w-3',
          overallStatus === 'connecting' && 'animate-spin'
        )}
      />
      <span>
        {connectedCount}/{totalCount} MCP
      </span>
      {showToolCount && toolCount > 0 && (
        <span className="text-xs opacity-75">| {toolCount} tools</span>
      )}
    </Badge>
  );
}

export default MCPStatusIndicator;
