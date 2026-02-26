/**
 * Playbook Panel Component
 *
 * Displays meeting methodology progress:
 * - MEDDIC/Challenger checklist
 * - Coverage status per item
 * - Suggested questions
 * - Evidence links
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Target,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { useCopilotStore } from '../../stores/copilot.store';
import { cn } from '../../lib/utils';
import type { CopilotPlaybookItem, CopilotPlaybookSnapshot } from '../../../shared/types/ipc.types';

// Sub-components

function CoverageProgress({ snapshot }: { snapshot: CopilotPlaybookSnapshot }) {
  const { covered, partial, missing, total, coveragePercentage } = snapshot;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{coveragePercentage}% Complete</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            {covered}
          </span>
          <span className="flex items-center gap-1">
            <CircleDot className="h-3 w-3 text-amber-500" />
            {partial}
          </span>
          <span className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-muted-foreground" />
            {missing}
          </span>
        </div>
      </div>
      <div className="h-2 flex rounded-full overflow-hidden bg-muted">
        <div
          className="bg-green-500 transition-all duration-500"
          style={{ width: `${(covered / total) * 100}%` }}
        />
        <div
          className="bg-amber-500 transition-all duration-500"
          style={{ width: `${(partial / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

interface PlaybookItemRowProps {
  item: CopilotPlaybookItem;
  isExpanded: boolean;
  onToggle: () => void;
}

function PlaybookItemRow({ item, isExpanded, onToggle }: PlaybookItemRowProps) {
  const getStatusIcon = () => {
    switch (item.status) {
      case 'covered':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <CircleDot className="h-4 w-4 text-amber-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBg = () => {
    switch (item.status) {
      case 'covered':
        return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800';
      case 'partial':
        return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-background border-border';
    }
  };

  return (
    <div className={cn("rounded-lg border transition-colors", getStatusBg())}>
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <p className="font-medium text-sm">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Suggested Questions */}
          {item.suggestedQuestions && item.suggestedQuestions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Suggested Questions
              </p>
              <ul className="space-y-1">
                {item.suggestedQuestions.slice(0, 3).map((q, i) => (
                  <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-blue-400 py-0.5">
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence (if covered/partial) */}
          {item.evidence && item.evidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Evidence
              </p>
              <ul className="space-y-1">
                {item.evidence.slice(0, 2).map((e, i) => (
                  <li key={i} className="text-xs p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">
                      @ {Math.floor(e.timestamp / 60)}:{String(Math.floor(e.timestamp % 60)).padStart(2, '0')}
                    </span>
                    <p className="mt-0.5 italic">"{e.excerpt}"</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Component

interface PlaybookPanelProps {
  className?: string;
  compact?: boolean;
}

export function PlaybookPanel({ className, compact = false }: PlaybookPanelProps) {
  const { playbook, isCallActive } = useCopilotStore();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  if (!playbook) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Playbook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {isCallActive ? 'Loading playbook...' : 'Start a recording to track playbook progress'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    const missingItems = playbook.items.filter(i => i.status === 'missing');

    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-1">
            <Target className="h-3 w-3" />
            {playbook.playbookName}
          </span>
          <Badge variant={playbook.coveragePercentage >= 70 ? "default" : "secondary"}>
            {playbook.coveragePercentage}%
          </Badge>
        </div>
        <CoverageProgress snapshot={playbook} />
        {missingItems.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Missing: {missingItems.slice(0, 2).map(i => i.label).join(', ')}
            {missingItems.length > 2 && ` +${missingItems.length - 2} more`}
          </p>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {playbook.playbookName}
          </CardTitle>
          <Badge variant={playbook.coveragePercentage >= 70 ? "default" : "secondary"}>
            {playbook.coveragePercentage}% Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 min-h-0 flex-1 overflow-hidden p-4 pt-0">
        <CoverageProgress snapshot={playbook} />

        <ScrollArea className="flex-1 -mx-4 px-4">
          <div className="space-y-2 pr-2">
            {playbook.items.map((item) => (
              <PlaybookItemRow
                key={item.id}
                item={item}
                isExpanded={expandedItem === item.id}
                onToggle={() => setExpandedItem(
                  expandedItem === item.id ? null : item.id
                )}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Recommendations */}
        {playbook.recommendations && playbook.recommendations.length > 0 && (
          <div className="pt-2 border-t shrink-0">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Recommendations
            </p>
            <ul className="space-y-1">
              {playbook.recommendations.slice(0, 2).map((rec, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  • {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PlaybookPanel;
