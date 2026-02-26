/**
 * Bookmark Dialog Component
 *
 * Modal for creating bookmarks with category selection
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';
import {
  Flag,
  AlertTriangle,
  DollarSign,
  Users,
  CheckCircle,
  ArrowRight,
  Star,
} from 'lucide-react';

export type BookmarkCategory =
  | 'important'
  | 'follow_up'
  | 'pricing'
  | 'competitor'
  | 'risk'
  | 'decision'
  | 'action_item';

interface BookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (category: BookmarkCategory, note?: string) => void;
  transcriptText?: string;
}

const BOOKMARK_CATEGORIES: Array<{
  id: BookmarkCategory;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}> = [
  {
    id: 'important',
    label: 'Important',
    icon: Star,
    color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
    description: 'Key moment to remember',
  },
  {
    id: 'action_item',
    label: 'Action Item',
    icon: CheckCircle,
    color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    description: 'Task or follow-up needed',
  },
  {
    id: 'follow_up',
    label: 'Follow Up',
    icon: ArrowRight,
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    description: 'Requires follow-up later',
  },
  {
    id: 'pricing',
    label: 'Pricing',
    icon: DollarSign,
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    description: 'Pricing discussion',
  },
  {
    id: 'competitor',
    label: 'Competitor',
    icon: Users,
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    description: 'Competitor mention',
  },
  {
    id: 'risk',
    label: 'Risk',
    icon: AlertTriangle,
    color: 'text-red-600 bg-red-100 dark:bg-red-900/30',
    description: 'Potential risk or objection',
  },
  {
    id: 'decision',
    label: 'Decision',
    icon: Flag,
    color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30',
    description: 'Decision point',
  },
];

export function BookmarkDialog({
  open,
  onOpenChange,
  onSubmit,
  transcriptText,
}: BookmarkDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<BookmarkCategory | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCategory) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selectedCategory, note.trim() || undefined);
      // Reset state
      setSelectedCategory(null);
      setNote('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedCategory(null);
      setNote('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Bookmark</DialogTitle>
          <DialogDescription>
            Mark this moment for easy reference later
          </DialogDescription>
        </DialogHeader>

        {transcriptText && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground italic border">
            "{transcriptText.slice(0, 100)}{transcriptText.length > 100 ? '...' : ''}"
          </div>
        )}

        <div className="space-y-3">
          <label className="text-sm font-medium">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {BOOKMARK_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border text-left transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <div className={cn('p-1.5 rounded', cat.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{cat.label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {cat.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Note (optional)</label>
          <Textarea
            placeholder="Add a note about this moment..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedCategory || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Bookmark'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BookmarkDialog;
