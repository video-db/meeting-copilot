/**
 * MCP Result Card Component
 *
 * Displays MCP tool results in a cue-card style format.
 * Supports text, markdown, properties, and structured data.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  X,
  Pin,
  ExternalLink,
  Zap,
  Server,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MCPDisplayResult } from '../../../preload/index';

interface MCPResultCardProps {
  result: MCPDisplayResult;
  isPinned?: boolean;
  onDismiss: (resultId: string) => void;
  onPin: (resultId: string) => void;
  className?: string;
}

function getServerGradient(serverName: string): string {
  // Generate consistent gradient based on server name
  const hash = serverName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
    'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30',
    'from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30',
    'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
    'from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30',
    'from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30',
  ];
  return gradients[hash % gradients.length];
}

function getServerBadgeColor(serverName: string): string {
  const hash = serverName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    'bg-blue-500 text-white',
    'bg-green-500 text-white',
    'bg-purple-500 text-white',
    'bg-amber-500 text-white',
    'bg-cyan-500 text-white',
    'bg-rose-500 text-white',
  ];
  return colors[hash % colors.length];
}

function formatToolName(toolName: string): string {
  return toolName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MCPResultCard({
  result,
  isPinned,
  onDismiss,
  onPin,
  className,
}: MCPResultCardProps) {
  const { content } = result;
  const openExternal = (url?: string) => {
    if (!url) return;
    void window.electronAPI.app.openExternalLink(url);
  };

  return (
    <Card className={cn('overflow-hidden border-2 animate-in slide-in-from-right duration-300', className)}>
      <CardHeader
        className={cn('border-b p-4 bg-gradient-to-r', getServerGradient(result.serverName))}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn('text-xs', getServerBadgeColor(result.serverName))}>
                <Server className="h-3 w-3 mr-1" />
                {result.serverName}
              </Badge>
              {isPinned && (
                <Badge variant="secondary" className="text-xs">
                  <Pin className="h-3 w-3 mr-1" />
                  Pinned
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-base leading-tight flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              {result.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {formatToolName(result.toolName)}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            {!isPinned && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onPin(result.id)}
                title="Pin this result"
              >
                <Pin className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDismiss(result.id)}
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <ScrollArea className="max-h-[300px]">
          {content.text && (
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {content.text}
            </p>
          )}

          {content.markdown && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href || '#'}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        openExternal(href);
                      }}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {content.markdown}
              </ReactMarkdown>
            </div>
          )}

          {content.items && content.items.length > 0 && (
            <div className="space-y-2">
              {content.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {item.label}
                  </span>
                  {item.type === 'link' ? (
                    <a
                      href={item.value || '#'}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        openExternal(item.value);
                      }}
                    >
                      {item.value.length > 30 ? item.value.substring(0, 30) + '...' : item.value}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : item.type === 'badge' ? (
                    <Badge variant="secondary" className="text-xs">
                      {item.value}
                    </Badge>
                  ) : (
                    <span className="text-sm text-slate-700 dark:text-slate-300 text-right max-w-[60%]">
                      {item.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {content.properties && Object.keys(content.properties).length > 0 && !content.items && (
            <div className="space-y-2">
              {Object.entries(content.properties).map(([key, value], idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300 text-right max-w-[60%]">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {content.raw !== undefined && !content.text && !content.items && !content.properties && (
            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded-lg overflow-auto">
              {JSON.stringify(content.raw, null, 2)}
            </pre>
          )}
        </ScrollArea>
      </CardContent>

      <div className="border-t px-4 py-2 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {new Date(result.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </Card>
  );
}

export default MCPResultCard;
