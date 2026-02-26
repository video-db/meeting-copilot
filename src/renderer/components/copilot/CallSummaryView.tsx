/**
 * Call Summary View Component
 *
 * Displays post-call AI-generated summary with:
 * - Summary bullets
 * - Customer pain points and goals
 * - Objections and responses
 * - Commitments
 * - Next steps / action items
 * - Risk flags
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  FileText,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageSquare,
  Users,
  Flag,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { useCopilotStore } from '../../stores/copilot.store';
import { cn } from '../../lib/utils';
import type { CopilotCallSummary, CopilotPlaybookSnapshot } from '../../../shared/types/ipc.types';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  badge?: { text: string; variant?: 'default' | 'secondary' | 'destructive' };
}

function Section({ title, icon, children, defaultOpen = true, count, badge }: SectionProps) {
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
          {count !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          )}
          {badge && (
            <Badge variant={badge.variant || 'default'} className="text-xs">
              {badge.text}
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

function BulletList({ items, icon }: { items: string[]; icon?: React.ReactNode }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground italic">None identified</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm flex items-start gap-2">
          {icon || <ArrowRight className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ObjectionsList({ objections }: { objections: CopilotCallSummary['objections'] }) {
  if (!objections || objections.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No objections raised</p>;
  }

  return (
    <div className="space-y-2">
      {objections.map((obj, i) => (
        <div key={i} className="p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs capitalize">
              {obj.type}
            </Badge>
            {obj.resolved ? (
              <Badge variant="default" className="text-xs bg-green-500">
                Resolved
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                Open
              </Badge>
            )}
          </div>
          <p className="text-sm">{obj.text}</p>
          {obj.response && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              Response: "{obj.response}"
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function CommitmentsList({ commitments }: { commitments: CopilotCallSummary['commitments'] }) {
  if (!commitments || commitments.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No commitments made</p>;
  }

  return (
    <div className="space-y-2">
      {commitments.map((com, i) => (
        <div key={i} className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
          <Badge variant={com.who === 'me' ? 'default' : 'secondary'} className="text-xs shrink-0">
            {com.who === 'me' ? 'You' : 'Customer'}
          </Badge>
          <p className="text-sm">{com.commitment}</p>
        </div>
      ))}
    </div>
  );
}

function NextStepsList({ nextSteps }: { nextSteps: CopilotCallSummary['nextSteps'] }) {
  if (!nextSteps || nextSteps.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No next steps identified</p>;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  return (
    <div className="space-y-2">
      {nextSteps.map((step, i) => (
        <div key={i} className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{step.action}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {step.owner === 'me' ? 'You' : step.owner === 'them' ? 'Customer' : 'Both'}
              </Badge>
              <Badge className={cn("text-xs", getPriorityColor(step.priority))}>
                {step.priority}
              </Badge>
              {step.deadline && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {step.deadline}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Component

interface CallSummaryViewProps {
  className?: string;
  summary?: CopilotCallSummary;
  playbook?: CopilotPlaybookSnapshot;
  duration?: number;
}

export function CallSummaryView({ className, summary: propSummary, playbook: propPlaybook, duration: propDuration }: CallSummaryViewProps) {
  const store = useCopilotStore();
  const summary = propSummary || store.callSummary;
  const playbook = propPlaybook || store.playbook;
  const duration = propDuration || store.callDuration;
  const [copied, setCopied] = useState(false);

  if (!summary) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Call Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Call summary will appear here after the recording ends
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

  const copyToClipboard = () => {
    const text = [
      '# Call Summary',
      '',
      '## Key Points',
      ...summary.bullets.map(b => `- ${b}`),
      '',
      '## Customer Pain Points',
      ...summary.customerPain.map(p => `- ${p}`),
      '',
      '## Next Steps',
      ...summary.nextSteps.map(s => `- [${s.owner}] ${s.action}`),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const unresolvedObjections = summary.objections?.filter(o => !o.resolved).length || 0;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Call Summary
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {formatDuration(duration)}
            </Badge>
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="h-3 w-3 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
          <div className="space-y-3">
            {/* Risk Flags */}
            {summary.riskFlags && summary.riskFlags.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risk Flags
                </p>
                <ul className="space-y-1">
                  {summary.riskFlags.map((flag, i) => (
                    <li key={i} className="text-sm text-red-600 dark:text-red-300 flex items-center gap-2">
                      <Flag className="h-3 w-3" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary Bullets */}
            <Section
              title="Summary"
              icon={<FileText className="h-4 w-4" />}
              count={summary.bullets?.length}
            >
              <BulletList items={summary.bullets} />
            </Section>

            {/* Customer Pain & Goals */}
            <Section
              title="Customer Pain Points"
              icon={<Target className="h-4 w-4" />}
              count={summary.customerPain?.length}
            >
              <BulletList items={summary.customerPain} />
            </Section>

            {summary.customerGoals && summary.customerGoals.length > 0 && (
              <Section
                title="Customer Goals"
                icon={<Lightbulb className="h-4 w-4" />}
                count={summary.customerGoals.length}
                defaultOpen={false}
              >
                <BulletList items={summary.customerGoals} />
              </Section>
            )}

            {/* Objections */}
            <Section
              title="Objections"
              icon={<MessageSquare className="h-4 w-4" />}
              count={summary.objections?.length}
              badge={unresolvedObjections > 0 ? { text: `${unresolvedObjections} open`, variant: 'destructive' } : undefined}
            >
              <ObjectionsList objections={summary.objections} />
            </Section>

            {/* Commitments */}
            <Section
              title="Commitments"
              icon={<Users className="h-4 w-4" />}
              count={summary.commitments?.length}
              defaultOpen={false}
            >
              <CommitmentsList commitments={summary.commitments} />
            </Section>

            {/* Next Steps */}
            <Section
              title="Next Steps"
              icon={<CheckCircle2 className="h-4 w-4" />}
              count={summary.nextSteps?.length}
            >
              <NextStepsList nextSteps={summary.nextSteps} />
            </Section>

            {/* Key Decisions */}
            {summary.keyDecisions && summary.keyDecisions.length > 0 && (
              <Section
                title="Key Decisions"
                icon={<Flag className="h-4 w-4" />}
                count={summary.keyDecisions.length}
                defaultOpen={false}
              >
                <BulletList items={summary.keyDecisions} />
              </Section>
            )}

            {/* Playbook Summary */}
            {playbook && (
              <Section
                title={`Playbook: ${playbook.playbookName}`}
                icon={<Target className="h-4 w-4" />}
                badge={{ text: `${playbook.coveragePercentage}%`, variant: playbook.coveragePercentage >= 70 ? 'default' : 'secondary' }}
                defaultOpen={false}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600">✓ {playbook.covered} covered</span>
                    <span className="text-amber-600">◐ {playbook.partial} partial</span>
                    <span className="text-muted-foreground">○ {playbook.missing} missing</span>
                  </div>
                  {playbook.recommendations && playbook.recommendations.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations:</p>
                      <ul className="space-y-1">
                        {playbook.recommendations.slice(0, 3).map((rec, i) => (
                          <li key={i} className="text-xs text-muted-foreground">• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </div>
      </CardContent>
    </Card>
  );
}

export default CallSummaryView;
