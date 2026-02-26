/**
 * Metrics Panel Component
 *
 * Displays real-time conversation metrics:
 * - Talk ratio visualization
 * - Speaking pace
 * - Questions asked
 * - Conversation health score
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Mic,
  Users,
  Gauge,
  HelpCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useCopilotStore } from '../../stores/copilot.store';
import { cn } from '../../lib/utils';

// Sub-components

interface TalkRatioBarProps {
  meRatio: number;
  themRatio: number;
}

function TalkRatioBar({ meRatio, themRatio }: TalkRatioBarProps) {
  const mePercent = Math.round(meRatio * 100);
  const themPercent = Math.round(themRatio * 100);

  // Ideal range is 35-55% for "me"
  const isBalanced = meRatio >= 0.35 && meRatio <= 0.55;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Mic className="h-3 w-3" />
          You: {mePercent}%
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Them: {themPercent}%
        </span>
      </div>
      <div className="h-3 flex rounded-full overflow-hidden bg-muted">
        <div
          className={cn(
            "transition-all duration-500",
            isBalanced ? "bg-green-500" : meRatio > 0.55 ? "bg-amber-500" : "bg-blue-500"
          )}
          style={{ width: `${mePercent}%` }}
        />
        <div
          className="bg-slate-400 transition-all duration-500"
          style={{ width: `${themPercent}%` }}
        />
      </div>
      {!isBalanced && meRatio > 0.65 && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Consider letting the customer speak more
        </p>
      )}
    </div>
  );
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'stable';
  warning?: boolean;
}

function MetricItem({ icon, label, value, subtext, trend, warning }: MetricItemProps) {
  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-lg",
      warning ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/50"
    )}>
      <div className="flex items-center gap-2">
        <div className={cn(
          "p-1.5 rounded-md",
          warning ? "bg-amber-100 text-amber-700" : "bg-background text-muted-foreground"
        )}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          {subtext && (
            <p className="text-xs text-muted-foreground">{subtext}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className={cn(
          "text-lg font-semibold",
          warning ? "text-amber-700" : ""
        )}>
          {value}
        </span>
        {trend && (
          <span className="text-muted-foreground">
            {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
            {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
            {trend === 'stable' && <Minus className="h-4 w-4" />}
          </span>
        )}
      </div>
    </div>
  );
}

function HealthScore({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getLabel = () => {
    if (score >= 80) return 'Great';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-muted/50 to-muted rounded-lg">
      <div>
        <p className="text-sm font-medium">Conversation Health</p>
        <p className="text-xs text-muted-foreground">{getLabel()}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn("text-3xl font-bold", getColor())}>
          {score}
        </div>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

// Main Component

interface MetricsPanelProps {
  className?: string;
  compact?: boolean;
}

export function MetricsPanel({ className, compact = false }: MetricsPanelProps) {
  const { metrics, healthScore, isCallActive } = useCopilotStore();

  if (!isCallActive || !metrics) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Conversation Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Start a recording to see live metrics
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <TalkRatioBar
          meRatio={metrics.talkRatio.me}
          themRatio={metrics.talkRatio.them}
        />
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            {metrics.pace} WPM
          </span>
          <span className="flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            {metrics.questionsAsked} questions
          </span>
          <Badge variant={healthScore >= 70 ? "default" : "destructive"} className="text-xs">
            Health: {healthScore}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Conversation Metrics
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {formatDuration(metrics.callDuration)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <HealthScore score={healthScore} />

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Talk Ratio</p>
          <TalkRatioBar
            meRatio={metrics.talkRatio.me}
            themRatio={metrics.talkRatio.them}
          />
        </div>

        <div className="space-y-2">
          <MetricItem
            icon={<Gauge className="h-4 w-4" />}
            label="Speaking Pace"
            value={`${metrics.pace}`}
            subtext="words per minute"
            warning={metrics.pace > 180}
          />

          <MetricItem
            icon={<HelpCircle className="h-4 w-4" />}
            label="Questions Asked"
            value={metrics.questionsAsked}
            subtext="discovery questions"
          />

          {metrics.monologueDetected && (
            <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Long monologue detected - consider asking a question
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricsPanel;
