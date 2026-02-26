/**
 * Transcription Panel Component
 *
 * Modern chat-like interface for live transcription:
 * - Avatar indicators (Me/Customer)
 * - Timestamp badges
 * - Styled message bubbles
 * - Objection detection highlighting
 * - Auto-scroll to latest
 * - Bookmarking support
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, Volume2, Bookmark, BookmarkCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useTranscriptionStore, TranscriptItem } from '../../stores/transcription.store';
import { useSessionStore } from '../../stores/session.store';
import { useCopilot } from '../../hooks/useCopilot';
import { cn } from '../../lib/utils';
import { BookmarkDialog, BookmarkCategory } from './BookmarkDialog';

interface TranscriptMessageProps {
  item: TranscriptItem;
  isLive?: boolean;
  onBookmark?: (item: TranscriptItem) => void;
}

function TranscriptMessage({ item, isLive, onBookmark }: TranscriptMessageProps) {
  const isMe = item.source === 'mic';

  // Format timestamp from epoch to MM:SS relative to recording start
  const formatTime = (timestamp: number) => {
    // For now, just show time since we don't have recording start time here
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={cn(
        'group relative animate-in slide-in-from-bottom-2 duration-300',
        isLive && 'opacity-90'
      )}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-1',
            isMe
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
          )}
        >
          {isMe ? (
            <Mic className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-3xl">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'text-xs font-medium',
                isMe ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
              )}
            >
              {isMe ? 'You' : 'Customer'}
            </span>
            <span className="text-xs text-slate-400">{formatTime(item.timestamp)}</span>
            {isLive && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                LIVE
              </Badge>
            )}
          </div>

          <div
            className={cn(
              'rounded-2xl px-4 py-3 text-sm leading-relaxed',
              isMe
                ? 'bg-blue-50 dark:bg-blue-950/30 text-slate-900 dark:text-slate-100'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100',
              isLive && 'italic opacity-80'
            )}
          >
            {item.text}
          </div>
        </div>

        {/* Quick Actions (on hover) */}
        {onBookmark && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-6">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:text-primary"
              title="Bookmark this moment"
              onClick={() => onBookmark(item)}
            >
              <Bookmark className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingMessage({ text, source }: { text: string; source: 'mic' | 'system_audio' }) {
  const isMe = source === 'mic';

  return (
    <div className="flex gap-3 opacity-60">
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-1',
          isMe
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
        )}
      >
        {isMe ? <Mic className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </div>
      <div className="flex-1 max-w-3xl">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              'text-xs font-medium',
              isMe ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
            )}
          >
            {isMe ? 'You' : 'Customer'}
          </span>
          <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 animate-pulse">
            Speaking...
          </Badge>
        </div>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed italic',
            isMe
              ? 'bg-blue-50/50 dark:bg-blue-950/20'
              : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50'
          )}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

export function TranscriptionPanel() {
  const { items, enabled, pendingMic, pendingSystemAudio, setEnabled } = useTranscriptionStore();
  const { status, elapsedTime } = useSessionStore();
  const { createBookmark, recordingId } = useCopilot();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [bookmarkItem, setBookmarkItem] = useState<TranscriptItem | null>(null);

  const isRecording = status === 'recording';

  // Handle bookmark button click on a specific transcript item
  const handleBookmarkItem = useCallback((item: TranscriptItem) => {
    setBookmarkItem(item);
    setBookmarkDialogOpen(true);
  }, []);

  // Handle bookmark button in header (bookmark current moment)
  const handleBookmarkNow = useCallback(() => {
    setBookmarkItem(null); // No specific item, just the current moment
    setBookmarkDialogOpen(true);
  }, []);

  // Handle bookmark submission
  const handleBookmarkSubmit = useCallback(async (category: BookmarkCategory, note?: string) => {
    // Calculate timestamp - use item timestamp or current elapsed time
    const timestamp = bookmarkItem
      ? (bookmarkItem.timestamp - (items[0]?.timestamp || bookmarkItem.timestamp)) / 1000
      : elapsedTime;

    const success = await createBookmark(timestamp, category, note);
    if (success) {
      console.log('Bookmark created successfully');
    } else {
      console.error('Failed to create bookmark');
    }
  }, [bookmarkItem, items, elapsedTime, createBookmark]);

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [items, pendingMic, pendingSystemAudio]);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Live Transcription</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Real-time conversation feed</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8"
              onClick={handleBookmarkNow}
              disabled={!isRecording || !recordingId}
              title={!isRecording ? 'Start recording to bookmark' : 'Bookmark this moment'}
            >
              <Bookmark className="w-3 h-3" />
              Bookmark
            </Button>
            <div className="flex items-center gap-2 pl-3 border-l">
              <span className="text-xs text-muted-foreground">
                {enabled ? 'Enabled' : 'Disabled'}
              </span>
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={isRecording} />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-6 space-y-4">
            {items.length === 0 && !pendingMic && !pendingSystemAudio ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Mic className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                  {enabled
                    ? isRecording
                      ? 'Waiting for speech...'
                      : 'Start recording to see transcription'
                    : 'Enable transcription to see live text'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {enabled && !isRecording && 'Click the Start Recording button above'}
                </p>
              </div>
            ) : (
              <>
                {items.map((item) => (
                  <TranscriptMessage
                    key={item.id}
                    item={item}
                    onBookmark={recordingId ? handleBookmarkItem : undefined}
                  />
                ))}

                {/* Pending transcripts */}
                {pendingMic && <PendingMessage text={pendingMic} source="mic" />}
                {pendingSystemAudio && <PendingMessage text={pendingSystemAudio} source="system_audio" />}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Bookmark Dialog */}
      <BookmarkDialog
        open={bookmarkDialogOpen}
        onOpenChange={setBookmarkDialogOpen}
        onSubmit={handleBookmarkSubmit}
        transcriptText={bookmarkItem?.text}
      />
    </Card>
  );
}

export default TranscriptionPanel;
