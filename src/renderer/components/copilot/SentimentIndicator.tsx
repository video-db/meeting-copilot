/**
 * Sentiment Indicator Component
 *
 * Displays customer sentiment with trend visualization.
 * Compact view for sidebar, expanded view with history.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  SmilePlus,
  Meh,
  Frown,
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
} from 'lucide-react';
import { useCopilotStore } from '../../stores/copilot.store';
import { cn } from '../../lib/utils';
import type { CopilotSentiment } from '../../../shared/types/ipc.types';

// Sub-components

function SentimentIcon({ sentiment, className }: { sentiment: string; className?: string }) {
  switch (sentiment) {
    case 'positive':
      return <SmilePlus className={cn("text-green-500", className)} />;
    case 'negative':
      return <Frown className={cn("text-red-500", className)} />;
    default:
      return <Meh className={cn("text-amber-500", className)} />;
  }
}

function TrendIcon({ trend, className }: { trend: string; className?: string }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className={cn("text-green-500", className)} />;
    case 'declining':
      return <TrendingDown className={cn("text-red-500", className)} />;
    default:
      return <Minus className={cn("text-muted-foreground", className)} />;
  }
}

function SentimentMeter({ averageScore }: { averageScore: number }) {
  // averageScore is -1 to 1, convert to 0-100 for display
  const percentage = Math.round((averageScore + 1) * 50);

  const getColor = () => {
    if (percentage >= 60) return 'bg-green-500';
    if (percentage >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500 rounded-full", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Negative</span>
        <span>Neutral</span>
        <span>Positive</span>
      </div>
    </div>
  );
}

function SentimentHistory({ history }: { history: CopilotSentiment['history'] }) {
  if (!history || history.length === 0) {
    return null;
  }

  // Take last 10 entries
  const recentHistory = history.slice(-10);

  return (
    <div className="flex items-center gap-0.5">
      {recentHistory.map((entry, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-4 rounded-sm transition-colors",
            entry.sentiment === 'positive'
              ? "bg-green-400"
              : entry.sentiment === 'negative'
                ? "bg-red-400"
                : "bg-amber-400"
          )}
          title={`${entry.text.substring(0, 50)}...`}
        />
      ))}
    </div>
  );
}

// Main Component

interface SentimentIndicatorProps {
  className?: string;
  compact?: boolean;
}

export function SentimentIndicator({ className, compact = false }: SentimentIndicatorProps) {
  const { sentiment, isCallActive } = useCopilotStore();

  if (!isCallActive || !sentiment) {
    if (compact) {
      return (
        <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
          <Heart className="h-4 w-4" />
          <span className="text-xs">--</span>
        </div>
      );
    }

    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Customer Sentiment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-2">
            Sentiment analysis will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSentimentLabel = () => {
    switch (sentiment.current) {
      case 'positive':
        return 'Positive';
      case 'negative':
        return 'Concerned';
      default:
        return 'Neutral';
    }
  };

  const getTrendLabel = () => {
    switch (sentiment.trend) {
      case 'improving':
        return 'Improving';
      case 'declining':
        return 'Declining';
      default:
        return 'Stable';
    }
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <SentimentIcon sentiment={sentiment.current} className="h-4 w-4" />
        <span className="text-xs font-medium">{getSentimentLabel()}</span>
        <TrendIcon trend={sentiment.trend} className="h-3 w-3" />
      </div>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Customer Sentiment
          </CardTitle>
          <Badge
            variant={
              sentiment.current === 'positive'
                ? 'default'
                : sentiment.current === 'negative'
                  ? 'destructive'
                  : 'secondary'
            }
            className="text-xs"
          >
            {getSentimentLabel()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <SentimentIcon sentiment={sentiment.current} className="h-8 w-8" />
            <div>
              <p className="font-medium">{getSentimentLabel()}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendIcon trend={sentiment.trend} className="h-3 w-3" />
                {getTrendLabel()}
              </p>
            </div>
          </div>
        </div>

        {/* Sentiment Meter */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Overall Sentiment</p>
          <SentimentMeter averageScore={sentiment.averageScore} />
        </div>

        {/* History Timeline */}
        {sentiment.history && sentiment.history.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Trend</p>
            <SentimentHistory history={sentiment.history} />
          </div>
        )}

        {/* Warning for negative/declining */}
        {(sentiment.current === 'negative' || sentiment.trend === 'declining') && (
          <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {sentiment.current === 'negative'
                ? 'Customer may have concerns - consider addressing them'
                : 'Sentiment is declining - check in with the customer'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SentimentIndicator;
