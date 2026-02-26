import React from 'react';
import { Play, Clock, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Recording } from '../../../shared/schemas/recording.schema';
import { formatDuration, formatRelativeTime, stripMarkdown } from '../../lib/utils';
import { getElectronAPI } from '../../api/ipc';

interface RecordingCardProps {
  recording: Recording;
  onViewDetails: () => void;
}

export function RecordingCard({ recording, onViewDetails }: RecordingCardProps) {
  const handlePlay = async () => {
    const api = getElectronAPI();
    if (recording.playerUrl && api) {
      await api.app.openPlayerWindow(recording.playerUrl);
    }
  };

  const getStatusBadge = () => {
    switch (recording.status) {
      case 'recording':
        return <Badge variant="destructive">Recording</Badge>;
      case 'processing':
        return (
          <Badge variant="warning" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'available':
        return <Badge variant="success">Ready</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  const getSummaryBadge = () => {
    // Prioritize call summary over insights
    if (recording.callSummary?.bullets && recording.callSummary.bullets.length > 0) {
      return <Badge variant="default">Summary ready</Badge>;
    }

    if (recording.status !== 'available') return null;

    switch (recording.insightsStatus) {
      case 'pending':
        return <Badge variant="secondary">Insights pending</Badge>;
      case 'processing':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating insights
          </Badge>
        );
      case 'ready':
        return <Badge variant="outline">Insights ready</Badge>;
      case 'failed':
        return <Badge variant="outline">Insights failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getStatusBadge()}
              {getSummaryBadge()}
            </div>

            <p className="text-sm font-medium truncate">
              Session: {recording.sessionId.slice(0, 20)}...
            </p>

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(recording.createdAt)}
              </span>
              {recording.duration && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {formatDuration(recording.duration)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {recording.status === 'available' && recording.playerUrl && (
              <Button size="sm" variant="outline" onClick={handlePlay}>
                <Play className="h-4 w-4 mr-1" />
                Play
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onViewDetails}>
              Details
            </Button>
          </div>
        </div>

        {/* Call Summary preview (prioritized) */}
        {recording.callSummary?.bullets && recording.callSummary.bullets.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1">Call Summary</p>
            <ul className="text-sm space-y-0.5">
              {recording.callSummary.bullets.slice(0, 2).map((bullet, i) => (
                <li key={i} className="line-clamp-1">• {bullet}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Fallback to insights if no call summary */}
        {!recording.callSummary?.bullets?.length && recording.insightsStatus === 'ready' && recording.insights && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1">AI Summary</p>
            <p className="text-sm line-clamp-2">{stripMarkdown(recording.insights)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
