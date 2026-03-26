import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Inbox, Search } from 'lucide-react';
import { RecordingCard } from './RecordingCard';
import { RecordingDetailPage } from './RecordingDetailPage';
import { trpc } from '../../api/trpc';
import { useSessionStore } from '../../stores/session.store';
import type { Recording } from '../../../shared/schemas/recording.schema';

interface HistoryViewProps {
  initialSelectedRecordingId?: number | null;
  onClearInitialSelection?: () => void;
}

export function HistoryView({ initialSelectedRecordingId, onClearInitialSelection }: HistoryViewProps = {}) {
  const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(initialSelectedRecordingId ?? null);

  useEffect(() => {
    if (initialSelectedRecordingId != null) {
      setSelectedRecordingId(initialSelectedRecordingId);
      onClearInitialSelection?.();
    }
  }, [initialSelectedRecordingId, onClearInitialSelection]);
  const [hasCleanedUp, setHasCleanedUp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeSessionId = useSessionStore((state) => state.sessionId);

  const { data: recordings, isLoading, refetch } = trpc.recordings.list.useQuery(
    undefined,
    {
      refetchInterval: 10000,
    }
  );

  const cleanupMutation = trpc.recordings.cleanupStale.useMutation({
    onSuccess: (result) => {
      if (result.cleaned > 0) {
        refetch();
      }
    },
  });

  useEffect(() => {
    if (!hasCleanedUp && recordings) {
      // Check for stale recordings older than 1 hour (excluding active session)
      const staleCount = recordings.filter(
        r => (r.status === 'processing' || r.status === 'recording') &&
        r.sessionId !== activeSessionId &&
        Date.now() - new Date(r.createdAt).getTime() > 60 * 60 * 1000
      ).length;

      if (staleCount > 0) {
        cleanupMutation.mutate({
          maxAgeMinutes: 60,
          excludeSessionId: activeSessionId || undefined,
        });
      }
      setHasCleanedUp(true);
    }
  }, [recordings, hasCleanedUp, activeSessionId]);

  // Sort recordings by date (newest first) and filter by search query
  const filteredRecordings = useMemo(() => {
    const sorted = [...(recordings || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (!searchQuery.trim()) {
      return sorted;
    }

    const query = searchQuery.toLowerCase();
    return sorted.filter((recording) => {
      // Search in meeting name
      if (recording.meetingName?.toLowerCase().includes(query)) {
        return true;
      }
      // Search in short overview
      if (recording.shortOverview?.toLowerCase().includes(query)) {
        return true;
      }
      return false;
    });
  }, [recordings, searchQuery]);

  // If a recording is selected, show the detail page
  if (selectedRecordingId !== null) {
    return (
      <RecordingDetailPage
        recordingId={selectedRecordingId}
        onBack={() => setSelectedRecordingId(null)}
      />
    );
  }

  // Show the recordings grid
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <h1 className="text-[28px] font-semibold text-black tracking-tight">
          Meeting Recordings
        </h1>
        <p className="text-[15px] text-[#6b6b6b] mt-1">
          View and manage your past meeting recordings
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-8 pb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#969696]" />
          <input
            type="text"
            placeholder="Search recordings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[14px] text-black placeholder:text-[#969696] focus:outline-none focus:border-[#c0c0c0] focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Recording Cards Grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-6 w-6 animate-spin text-[#969696]" />
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#6b6b6b]">
            <Inbox className="h-12 w-12 mb-3 text-[#c0c0c0]" />
            {searchQuery ? (
              <>
                <p className="text-[15px] font-medium">No matching recordings</p>
                <p className="text-[13px] text-[#969696] mt-1">Try a different search term</p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-medium">No recordings yet</p>
                <p className="text-[13px] text-[#969696] mt-1">Start a recording to see it here</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRecordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                onClick={() => setSelectedRecordingId(recording.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
