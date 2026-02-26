import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Play,
  ExternalLink,
  Clock,
  FileText,
  Video,
  Mic,
  Users,
  Gauge,
  Target,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import type { Recording } from '../../../shared/schemas/recording.schema';
import { formatDuration, formatRelativeTime, unwrapMarkdownCodeBlock, cn } from '../../lib/utils';
import { getElectronAPI } from '../../api/ipc';

interface RecordingDetailsModalProps {
  recording: Recording | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function RecordingDetailsModal({
  recording,
  open,
  onOpenChange,
}: RecordingDetailsModalProps) {
  if (!recording) return null;

  const handlePlay = async () => {
    const api = getElectronAPI();
    if (recording.playerUrl && api) {
      await api.app.openPlayerWindow(recording.playerUrl);
    }
  };

  const handleOpenExternal = async () => {
    const api = getElectronAPI();
    if (recording.playerUrl && api) {
      await api.app.openExternalLink(recording.playerUrl);
    }
  };

  const metrics = recording.metricsSnapshot;
  const playbook = recording.playbookSnapshot;
  const callSummary = recording.callSummary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Recording Details
          </DialogTitle>
          <DialogDescription>Session: {recording.sessionId.slice(0, 20)}...</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Status and Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                <Badge
                  variant={
                    recording.status === 'available'
                      ? 'success'
                      : recording.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {recording.status}
                </Badge>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Created</p>
                <p className="text-sm flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(recording.createdAt)}
                </p>
              </div>

              {recording.duration && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Duration</p>
                  <p className="text-sm flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {formatDuration(recording.duration)}
                  </p>
                </div>
              )}

              {recording.videoId && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Video ID</p>
                  <p className="text-sm font-mono text-xs truncate">{recording.videoId}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {recording.status === 'available' && recording.playerUrl && (
              <div className="flex gap-2">
                <Button onClick={handlePlay}>
                  <Play className="h-4 w-4 mr-2" />
                  Play in App
                </Button>
                <Button variant="outline" onClick={handleOpenExternal}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Browser
                </Button>
              </div>
            )}

            {/* Conversation Metrics */}
            {metrics && (
              <CollapsibleSection
                title="Conversation Metrics"
                icon={<Gauge className="h-4 w-4" />}
                defaultOpen={true}
              >
                <div className="space-y-4 pt-2">
                  {/* Talk Ratio */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Talk Ratio</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Mic className="h-3 w-3 text-blue-500" />
                        <span className="text-sm font-medium">{Math.round(metrics.talkRatio.me * 100)}%</span>
                      </div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all',
                            metrics.talkRatio.me > 0.65 ? 'bg-amber-500' : 'bg-blue-500'
                          )}
                          style={{ width: `${metrics.talkRatio.me * 100}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">{Math.round(metrics.talkRatio.them * 100)}%</span>
                        <Users className="h-3 w-3 text-purple-500" />
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground">Speaking Pace</p>
                      <p className={cn('text-lg font-semibold', metrics.pace > 180 ? 'text-amber-500' : '')}>
                        {metrics.pace} <span className="text-xs font-normal">WPM</span>
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground">Questions Asked</p>
                      <p className="text-lg font-semibold">{metrics.questionsAsked}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground">Longest Monologue</p>
                      <p className={cn('text-lg font-semibold', metrics.longestMonologue > 45 ? 'text-amber-500' : '')}>
                        {Math.round(metrics.longestMonologue)}s
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-xs text-muted-foreground">Interruptions</p>
                      <p className="text-lg font-semibold">{metrics.interruptionCount}</p>
                    </div>
                  </div>

                  {/* Word Counts */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2">
                      <p className="text-xs text-blue-600 dark:text-blue-400">Your Words</p>
                      <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">{metrics.wordCount.me}</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-2">
                      <p className="text-xs text-purple-600 dark:text-purple-400">Their Words</p>
                      <p className="text-lg font-semibold text-purple-700 dark:text-purple-300">{metrics.wordCount.them}</p>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* Playbook Progress */}
            {playbook && (
              <CollapsibleSection
                title={`Playbook: ${playbook.playbookName}`}
                icon={<Target className="h-4 w-4" />}
                badge={`${playbook.coveragePercentage}%`}
                defaultOpen={true}
              >
                <div className="space-y-3 pt-2">
                  {/* Coverage Summary */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {playbook.covered} covered
                    </span>
                    <span className="text-amber-600">{playbook.partial} partial</span>
                    <span className="text-muted-foreground">{playbook.missing} missing</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all',
                        playbook.coveragePercentage >= 70 ? 'bg-green-500' : 'bg-amber-500'
                      )}
                      style={{ width: `${playbook.coveragePercentage}%` }}
                    />
                  </div>

                  {/* Items List */}
                  {playbook.items && playbook.items.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {playbook.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30"
                        >
                          <span className="text-sm">{item.label}</span>
                          <Badge
                            variant={
                              item.status === 'covered'
                                ? 'default'
                                : item.status === 'partial'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-xs"
                          >
                            {item.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recommendations */}
                  {playbook.recommendations && playbook.recommendations.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations</p>
                      <ul className="space-y-1">
                        {playbook.recommendations.map((rec, i) => (
                          <li key={i} className="text-xs text-muted-foreground">• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Call Summary (Real-time) - Primary section */}
            {callSummary && (
              <CollapsibleSection
                title="Call Summary"
                icon={<MessageSquare className="h-4 w-4" />}
                defaultOpen={true}
                badge={`${callSummary.bullets?.length || 0} points`}
              >
                <div className="space-y-3 pt-2">
                  {/* Risk Flags */}
                  {callSummary.riskFlags && callSummary.riskFlags.length > 0 && (
                    <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-xs font-medium text-red-700 dark:text-red-400 flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Risk Flags
                      </p>
                      <ul className="space-y-0.5">
                        {callSummary.riskFlags.map((flag, i) => (
                          <li key={i} className="text-xs text-red-600 dark:text-red-300">• {flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Summary Bullets */}
                  {callSummary.bullets && callSummary.bullets.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Key Points</p>
                      <ul className="space-y-0.5">
                        {callSummary.bullets.map((bullet, i) => (
                          <li key={i} className="text-sm">• {bullet}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Customer Pain */}
                  {callSummary.customerPain && callSummary.customerPain.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Customer Pain Points</p>
                      <ul className="space-y-0.5">
                        {callSummary.customerPain.map((pain, i) => (
                          <li key={i} className="text-sm">• {pain}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Next Steps */}
                  {callSummary.nextSteps && callSummary.nextSteps.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Next Steps</p>
                      <div className="space-y-1">
                        {callSummary.nextSteps.map((step, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs">
                              {step.owner === 'me' ? 'You' : step.owner === 'them' ? 'Customer' : 'Both'}
                            </Badge>
                            <span>{step.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Objections */}
                  {callSummary.objections && callSummary.objections.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Objections Raised</p>
                      <div className="space-y-1">
                        {callSummary.objections.map((obj, i) => (
                          <div key={i} className="p-2 bg-muted/30 rounded text-sm">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge variant="outline" className="text-xs">{obj.type}</Badge>
                              {obj.resolved && <Badge className="text-xs bg-green-500">Resolved</Badge>}
                            </div>
                            <p className="text-sm">{obj.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* AI Insights (from VideoDB) */}
            {recording.insightsStatus === 'ready' && recording.insights && (
              <CollapsibleSection
                title="AI Summary"
                icon={<FileText className="h-4 w-4" />}
                defaultOpen={!callSummary}
              >
                <div className="prose prose-sm dark:prose-invert max-w-none pt-2">
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => (
                        <h2 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                      ),
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      p: ({ children }) => <p className="text-sm my-2">{children}</p>,
                    }}
                  >
                    {unwrapMarkdownCodeBlock(recording.insights)}
                  </ReactMarkdown>
                </div>
              </CollapsibleSection>
            )}

            {recording.insightsStatus === 'processing' && (
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Generating AI insights... This may take a moment.
                </p>
              </div>
            )}

            {recording.insightsStatus === 'failed' && (
              <div className="bg-destructive/10 rounded-lg p-4 text-center">
                <p className="text-sm text-destructive">
                  Failed to generate insights for this recording.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
