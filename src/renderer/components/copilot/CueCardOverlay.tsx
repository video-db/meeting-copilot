/**
 * Cue Card Overlay (Assistance Panel) Component
 *
 * Redesigned as a slide-in panel with:
 * - Gradient header with objection type
 * - Talk tracks in green boxes
 * - Follow-up questions in blue boxes
 * - Proof points in purple boxes
 * - Feedback buttons
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  X,
  Pin,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Check,
  HelpCircle,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { useCopilotStore } from '../../stores/copilot.store';
import { useCopilot } from '../../hooks/useCopilot';
import { cn } from '../../lib/utils';
import type { CopilotCueCard } from '../../../shared/types/ipc.types';

// Sub-components

interface CueCardItemProps {
  cueCard: CopilotCueCard;
  isPinned?: boolean;
  onDismiss: (triggerId: string) => void;
  onPin: (triggerId: string) => void;
  onFeedback: (triggerId: string, feedback: 'helpful' | 'wrong' | 'irrelevant') => void;
}

function CueCardItem({ cueCard, isPinned, onDismiss, onPin, onFeedback }: CueCardItemProps) {
  const [showFeedback, setShowFeedback] = useState(false);

  const getObjectionGradient = (type: string) => {
    switch (type) {
      case 'pricing':
        return 'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30';
      case 'timing':
        return 'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30';
      case 'competitor':
        return 'from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30';
      case 'authority':
        return 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30';
      case 'security':
        return 'from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30';
      case 'integration':
        return 'from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30';
      default:
        return 'from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30';
    }
  };

  const getObjectionColor = (type: string) => {
    switch (type) {
      case 'pricing':
        return 'bg-green-500 text-white';
      case 'timing':
        return 'bg-amber-500 text-white';
      case 'competitor':
        return 'bg-purple-500 text-white';
      case 'authority':
        return 'bg-blue-500 text-white';
      case 'security':
        return 'bg-red-500 text-white';
      case 'integration':
        return 'bg-cyan-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  return (
    <Card className="overflow-hidden shadow-lg border-2 animate-in slide-in-from-right duration-300">
      {/* Header with gradient */}
      <CardHeader
        className={cn('border-b p-4 bg-gradient-to-r', getObjectionGradient(cueCard.objectionType))}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <Badge className={cn('mb-2 text-xs', getObjectionColor(cueCard.objectionType))}>
              {cueCard.objectionType}
            </Badge>
            <h3 className="font-semibold text-base leading-tight">{cueCard.title}</h3>
          </div>
          <div className="flex gap-1 shrink-0">
            {!isPinned && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onPin(cueCard.triggerId)}
                title="Pin this card"
              >
                <Pin className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDismiss(cueCard.triggerId)}
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 italic line-clamp-2">
          "{cueCard.triggerText}"
        </p>
      </CardHeader>

      {/* Content */}
      <CardContent className="p-4 space-y-4">
        {/* Talk Tracks - Say This */}
        <div>
          <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-2">
            <Check className="h-4 w-4" />
            Say This
          </h4>
          <div className="space-y-2">
            {cueCard.talkTracks.slice(0, 3).map((track, idx) => (
              <div
                key={idx}
                className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{track}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up Questions - Ask This */}
        <div>
          <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Ask This
          </h4>
          <div className="space-y-2">
            {cueCard.followUpQuestions.slice(0, 3).map((question, idx) => (
              <div
                key={idx}
                className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 hover:shadow-md transition-shadow cursor-pointer"
              >
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {question}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Proof Points */}
        {cueCard.proofPoints && cueCard.proofPoints.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Proof Points
            </h4>
            <div className="space-y-2">
              {cueCard.proofPoints.slice(0, 2).map((point, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-sm text-slate-600 dark:text-slate-400"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Avoid Saying */}
        {cueCard.avoidSaying && cueCard.avoidSaying.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Avoid Saying
            </h4>
            <div className="space-y-2">
              {cueCard.avoidSaying.slice(0, 2).map((avoid, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm text-slate-600 dark:text-slate-400 border border-red-200 dark:border-red-800"
                >
                  {avoid}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer - Feedback */}
      <div className="border-t p-3 bg-slate-50 dark:bg-slate-900">
        {!showFeedback ? (
          <button
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            onClick={() => setShowFeedback(true)}
          >
            Was this helpful?
          </button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 h-8 text-xs"
              onClick={() => {
                onFeedback(cueCard.triggerId, 'helpful');
                setShowFeedback(false);
              }}
            >
              <ThumbsUp className="w-3 h-3" />
              Helpful
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 h-8 text-xs"
              onClick={() => {
                onFeedback(cueCard.triggerId, 'wrong');
                setShowFeedback(false);
              }}
            >
              <ThumbsDown className="w-3 h-3" />
              Wrong
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// Main Component

interface CueCardOverlayProps {
  className?: string;
  maxCards?: number;
}

export function CueCardOverlay({ className, maxCards = 2 }: CueCardOverlayProps) {
  const { activeCueCards, pinnedCueCards, isCallActive } = useCopilotStore();
  const { dismissCueCard, pinCueCard, submitCueCardFeedback } = useCopilot();

  const allCards = [
    ...pinnedCueCards,
    ...activeCueCards.slice(0, maxCards - pinnedCueCards.length),
  ];

  if (!isCallActive || allCards.length === 0) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Live Assist</span>
          </div>
        </div>
        <Card className="flex-1">
          <CardContent className="flex items-center justify-center h-full min-h-[200px]">
            <div className="text-center">
              <Lightbulb className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isCallActive
                  ? 'Cue cards will appear when objections are detected'
                  : 'Start recording to see live assistance'}
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
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Live Assist</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {allCards.length} active
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-2">
          {allCards.map((card) => (
            <CueCardItem
              key={card.triggerId}
              cueCard={card}
              isPinned={card.status === 'pinned'}
              onDismiss={dismissCueCard}
              onPin={pinCueCard}
              onFeedback={submitCueCardFeedback}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default CueCardOverlay;
