import React, { useState, useEffect } from 'react';
import { RefreshCw, Inbox, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { RecordingCard } from './RecordingCard';
import { RecordingDetailsModal } from './RecordingDetailsModal';
import { trpc } from '../../api/trpc';
import type { Recording } from '../../../shared/schemas/recording.schema';

export function HistoryView() {
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [hasCleanedUp, setHasCleanedUp] = useState(false);

  const { data: recordings, isLoading, refetch, isRefetching } = trpc.recordings.list.useQuery(
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
      const staleCount = recordings.filter(
        r => (r.status === 'processing' || r.status === 'recording') &&
        Date.now() - new Date(r.createdAt).getTime() > 30 * 60 * 1000
      ).length;

      if (staleCount > 0) {
        cleanupMutation.mutate({ maxAgeMinutes: 30 });
      }
      setHasCleanedUp(true);
    }
  }, [recordings, hasCleanedUp]);

  const sortedRecordings = [...(recordings || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Recording History</h2>
          <p className="text-sm text-muted-foreground">
            {recordings?.length || 0} recording{recordings?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {recordings && recordings.some(r => r.status === 'processing' || r.status === 'recording') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => cleanupMutation.mutate({ maxAgeMinutes: 30 })}
              disabled={cleanupMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clean Stale
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Recordings List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedRecordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Inbox className="h-10 w-10 mb-2" />
            <p className="text-sm">No recordings yet</p>
            <p className="text-xs">Start a recording to see it here</p>
          </div>
        ) : (
          <div className="space-y-3 pr-4">
            {sortedRecordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                onViewDetails={() => setSelectedRecording(recording)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Details Modal */}
      <RecordingDetailsModal
        recording={selectedRecording}
        open={!!selectedRecording}
        onOpenChange={(open) => !open && setSelectedRecording(null)}
      />
    </div>
  );
}
