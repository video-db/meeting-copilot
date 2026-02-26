/**
 * MCP Results Overlay Component
 *
 * Displays MCP tool results alongside cue cards during calls.
 * Shows active results with pinning and dismissal support.
 */

import React, { useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Zap, Server } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useMCPStore } from '../../stores/mcp.store';
import { useMCP } from '../../hooks/useMCP';
import { MCPResultCard } from './MCPResultCard';
import { cn } from '../../lib/utils';

interface MCPResultsOverlayProps {
  className?: string;
  maxResults?: number;
}

export function MCPResultsOverlay({ className, maxResults = 2 }: MCPResultsOverlayProps) {
  // Use useShallow to prevent infinite loops from array selectors
  const activeResults = useMCPStore(useShallow((state) => state.activeResults));

  // Memoize the filtered results
  const visibleResults = useMemo(
    () => activeResults.filter((r) => !r.dismissed),
    [activeResults]
  );
  const pinnedResults = useMemo(
    () => activeResults.filter((r) => r.pinned && !r.dismissed),
    [activeResults]
  );

  const { connectedServerCount, dismissResult, pinResult } = useMCP();

  const allResults = [
    ...pinnedResults,
    ...visibleResults.filter(r => !r.pinned).slice(0, maxResults - pinnedResults.length),
  ];

  if (allResults.length === 0) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">MCP Results</span>
          </div>
          {connectedServerCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Server className="h-3 w-3 mr-1" />
              {connectedServerCount} connected
            </Badge>
          )}
        </div>
        <Card className="flex-1">
          <CardContent className="flex items-center justify-center h-full min-h-[150px]">
            <div className="text-center">
              <Zap className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {connectedServerCount > 0
                  ? 'MCP results will appear when tools are triggered'
                  : 'Connect MCP servers to see results'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">MCP Results</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {allResults.length} active
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-2">
          {allResults.map((result) => (
            <MCPResultCard
              key={result.id}
              result={result}
              isPinned={result.pinned}
              onDismiss={dismissResult}
              onPin={pinResult}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default MCPResultsOverlay;
