/**
 * Cue Card Editor Component
 *
 * Allows users to view, create, edit, and delete cue cards
 * for objection handling.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Plus, Pencil, Trash2, MessageSquare, HelpCircle, X } from 'lucide-react';
import { trpc } from '../../api/trpc';
import { cn } from '../../lib/utils';

const OBJECTION_TYPES = [
  { value: 'pricing', label: 'Pricing', color: 'bg-green-100 text-green-800' },
  { value: 'timing', label: 'Timing', color: 'bg-amber-100 text-amber-800' },
  { value: 'competitor', label: 'Competitor', color: 'bg-purple-100 text-purple-800' },
  { value: 'authority', label: 'Authority', color: 'bg-blue-100 text-blue-800' },
  { value: 'security', label: 'Security', color: 'bg-red-100 text-red-800' },
  { value: 'integration', label: 'Integration', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-gray-100 text-gray-800' },
  { value: 'send_info', label: 'Send Info', color: 'bg-indigo-100 text-indigo-800' },
] as const;

type ObjectionType = typeof OBJECTION_TYPES[number]['value'];

interface CueCard {
  id: string;
  objectionType: ObjectionType;
  title: string;
  talkTracks: string[];
  followUpQuestions: string[];
  proofPoints?: string[];
  avoidSaying?: string[];
  sourceDoc?: string;
  isDefault: boolean;
}

interface CueCardFormData {
  objectionType: ObjectionType;
  title: string;
  talkTracks: string;
  followUpQuestions: string;
  proofPoints: string;
  avoidSaying: string;
  sourceDoc: string;
}

const emptyForm: CueCardFormData = {
  objectionType: 'pricing',
  title: '',
  talkTracks: '',
  followUpQuestions: '',
  proofPoints: '',
  avoidSaying: '',
  sourceDoc: '',
};

function CueCardForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData?: CueCard;
  onSubmit: (data: CueCardFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<CueCardFormData>(
    initialData
      ? {
          objectionType: initialData.objectionType,
          title: initialData.title,
          talkTracks: initialData.talkTracks.join('\n'),
          followUpQuestions: initialData.followUpQuestions.join('\n'),
          proofPoints: initialData.proofPoints?.join('\n') || '',
          avoidSaying: initialData.avoidSaying?.join('\n') || '',
          sourceDoc: initialData.sourceDoc || '',
        }
      : emptyForm
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="objectionType">Objection Type</Label>
          <Select
            value={form.objectionType}
            onValueChange={(v) => setForm({ ...form, objectionType: v as ObjectionType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Handling Pricing Objections"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="talkTracks">
          Talk Tracks <span className="text-muted-foreground text-xs">(one per line)</span>
        </Label>
        <Textarea
          id="talkTracks"
          value={form.talkTracks}
          onChange={(e) => setForm({ ...form, talkTracks: e.target.value })}
          placeholder="I understand budget is a concern. Let's talk about the ROI...&#10;What would the cost of NOT solving this problem be?"
          rows={4}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="followUpQuestions">
          Follow-up Questions <span className="text-muted-foreground text-xs">(one per line)</span>
        </Label>
        <Textarea
          id="followUpQuestions"
          value={form.followUpQuestions}
          onChange={(e) => setForm({ ...form, followUpQuestions: e.target.value })}
          placeholder="What budget range were you expecting?&#10;How do you typically evaluate ROI?"
          rows={3}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="proofPoints">
            Proof Points <span className="text-muted-foreground text-xs">(optional, one per line)</span>
          </Label>
          <Textarea
            id="proofPoints"
            value={form.proofPoints}
            onChange={(e) => setForm({ ...form, proofPoints: e.target.value })}
            placeholder="Average customer sees 3x ROI&#10;Reduces manual work by 40%"
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="avoidSaying">
            Avoid Saying <span className="text-muted-foreground text-xs">(optional, one per line)</span>
          </Label>
          <Textarea
            id="avoidSaying"
            value={form.avoidSaying}
            onChange={(e) => setForm({ ...form, avoidSaying: e.target.value })}
            placeholder="I can give you a discount&#10;It's not that expensive"
            rows={2}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceDoc">
          Source Document <span className="text-muted-foreground text-xs">(optional reference)</span>
        </Label>
        <Input
          id="sourceDoc"
          value={form.sourceDoc}
          onChange={(e) => setForm({ ...form, sourceDoc: e.target.value })}
          placeholder="e.g., Meeting Playbook v2.0, Page 15"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CueCardEditor() {
  const [editingCard, setEditingCard] = useState<CueCard | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: cueCards, refetch } = trpc.settings.getCueCards.useQuery();
  const createMutation = trpc.settings.createCueCard.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateOpen(false);
    },
  });
  const updateMutation = trpc.settings.updateCueCard.useMutation({
    onSuccess: () => {
      refetch();
      setIsEditOpen(false);
      setEditingCard(null);
    },
  });
  const deleteMutation = trpc.settings.deleteCueCard.useMutation({
    onSuccess: () => refetch(),
  });

  const handleCreate = (data: CueCardFormData) => {
    createMutation.mutate({
      objectionType: data.objectionType,
      title: data.title,
      talkTracks: data.talkTracks.split('\n').filter(Boolean),
      followUpQuestions: data.followUpQuestions.split('\n').filter(Boolean),
      proofPoints: data.proofPoints ? data.proofPoints.split('\n').filter(Boolean) : undefined,
      avoidSaying: data.avoidSaying ? data.avoidSaying.split('\n').filter(Boolean) : undefined,
      sourceDoc: data.sourceDoc || undefined,
    });
  };

  const handleUpdate = (data: CueCardFormData) => {
    if (!editingCard) return;
    updateMutation.mutate({
      id: editingCard.id,
      data: {
        objectionType: data.objectionType,
        title: data.title,
        talkTracks: data.talkTracks.split('\n').filter(Boolean),
        followUpQuestions: data.followUpQuestions.split('\n').filter(Boolean),
        proofPoints: data.proofPoints ? data.proofPoints.split('\n').filter(Boolean) : [],
        avoidSaying: data.avoidSaying ? data.avoidSaying.split('\n').filter(Boolean) : [],
        sourceDoc: data.sourceDoc || undefined,
      },
    });
  };

  const getTypeColor = (type: string) => {
    return OBJECTION_TYPES.find((t) => t.value === type)?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Cue Cards</h3>
          <p className="text-sm text-muted-foreground">
            Customize objection handling cards shown during calls
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Cue Card
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Cue Card</DialogTitle>
              <DialogDescription>
                Add a new objection handling card with talk tracks and questions.
              </DialogDescription>
            </DialogHeader>
            <CueCardForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreateOpen(false)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-4">
          {cueCards?.map((card) => (
            <Card key={card.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{card.title}</CardTitle>
                      {card.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    <Badge className={cn('mt-1 text-xs', getTypeColor(card.objectionType))}>
                      {OBJECTION_TYPES.find((t) => t.value === card.objectionType)?.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingCard(card as CueCard);
                        setIsEditOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Cue Card</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{card.title}"? This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: card.id })}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="font-medium">Talk Tracks:</span>{' '}
                    {card.talkTracks.slice(0, 2).join(' • ')}
                    {card.talkTracks.length > 2 && (
                      <span className="text-muted-foreground"> +{card.talkTracks.length - 2} more</span>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="font-medium">Questions:</span>{' '}
                    {card.followUpQuestions.slice(0, 2).join(' • ')}
                    {card.followUpQuestions.length > 2 && (
                      <span className="text-muted-foreground">
                        {' '}
                        +{card.followUpQuestions.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(!cueCards || cueCards.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No cue cards yet. Create one to get started.
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Cue Card</DialogTitle>
            <DialogDescription>Update the objection handling card.</DialogDescription>
          </DialogHeader>
          {editingCard && (
            <CueCardForm
              initialData={editingCard}
              onSubmit={handleUpdate}
              onCancel={() => {
                setIsEditOpen(false);
                setEditingCard(null);
              }}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CueCardEditor;
