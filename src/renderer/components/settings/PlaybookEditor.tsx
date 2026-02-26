/**
 * Playbook Editor Component
 *
 * Allows users to view, create, edit, and manage playbooks
 * (meeting methodologies like MEDDIC, Challenger, etc.)
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { Plus, Pencil, Trash2, Star, BookOpen, X } from 'lucide-react';
import { trpc } from '../../api/trpc';
import { cn } from '../../lib/utils';

const PLAYBOOK_TYPES = [
  { value: 'MEDDIC', label: 'MEDDIC' },
  { value: 'Challenger', label: 'Challenger' },
  { value: 'SPIN', label: 'SPIN' },
  { value: 'Custom', label: 'Custom' },
] as const;

type PlaybookType = typeof PLAYBOOK_TYPES[number]['value'];

interface PlaybookItem {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  suggestedQuestions: string[];
  detectionPrompt?: string;
}

interface Playbook {
  id: string;
  name: string;
  type: PlaybookType;
  description?: string;
  items: PlaybookItem[];
  isDefault: boolean;
}

interface PlaybookItemFormData {
  id: string;
  label: string;
  description: string;
  keywords: string;
  suggestedQuestions: string;
}

interface PlaybookFormData {
  name: string;
  type: PlaybookType;
  description: string;
  items: PlaybookItemFormData[];
}

function PlaybookItemForm({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: PlaybookItemFormData;
  index: number;
  onChange: (index: number, data: PlaybookItemFormData) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">Item {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => onRemove(index)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={item.label}
            onChange={(e) => onChange(index, { ...item, label: e.target.value })}
            placeholder="e.g., Metrics"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">ID (unique)</Label>
          <Input
            value={item.id}
            onChange={(e) => onChange(index, { ...item, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
            placeholder="e.g., m-metrics"
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Input
          value={item.description}
          onChange={(e) => onChange(index, { ...item, description: e.target.value })}
          placeholder="What this item tracks"
          required
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Keywords (comma-separated)</Label>
        <Input
          value={item.keywords}
          onChange={(e) => onChange(index, { ...item, keywords: e.target.value })}
          placeholder="ROI, cost savings, revenue, metrics"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Suggested Questions (one per line)</Label>
        <Textarea
          value={item.suggestedQuestions}
          onChange={(e) => onChange(index, { ...item, suggestedQuestions: e.target.value })}
          placeholder="What metrics matter most?&#10;How do you measure success?"
          rows={2}
        />
      </div>
    </Card>
  );
}

function PlaybookForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData?: Playbook;
  onSubmit: (data: PlaybookFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<PlaybookFormData>(
    initialData
      ? {
          name: initialData.name,
          type: initialData.type,
          description: initialData.description || '',
          items: initialData.items.map((item) => ({
            id: item.id,
            label: item.label,
            description: item.description,
            keywords: item.keywords.join(', '),
            suggestedQuestions: item.suggestedQuestions.join('\n'),
          })),
        }
      : {
          name: '',
          type: 'Custom',
          description: '',
          items: [
            { id: '', label: '', description: '', keywords: '', suggestedQuestions: '' },
          ],
        }
  );

  const handleItemChange = (index: number, data: PlaybookItemFormData) => {
    const newItems = [...form.items];
    newItems[index] = data;
    setForm({ ...form, items: newItems });
  };

  const handleRemoveItem = (index: number) => {
    if (form.items.length <= 1) return;
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const handleAddItem = () => {
    setForm({
      ...form,
      items: [
        ...form.items,
        { id: '', label: '', description: '', keywords: '', suggestedQuestions: '' },
      ],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Playbook Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Enterprise MEDDIC"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            value={form.type}
            onValueChange={(v) => setForm({ ...form, type: v as PlaybookType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAYBOOK_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="A brief description of this playbook..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Checklist Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
            <Plus className="h-3 w-3 mr-1" />
            Add Item
          </Button>
        </div>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {form.items.map((item, index) => (
              <PlaybookItemForm
                key={index}
                item={item}
                index={index}
                onChange={handleItemChange}
                onRemove={handleRemoveItem}
              />
            ))}
          </div>
        </ScrollArea>
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

export function PlaybookEditor() {
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: playbooks, refetch } = trpc.settings.getPlaybooks.useQuery();
  const createMutation = trpc.settings.createPlaybook.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateOpen(false);
    },
  });
  const updateMutation = trpc.settings.updatePlaybook.useMutation({
    onSuccess: () => {
      refetch();
      setIsEditOpen(false);
      setEditingPlaybook(null);
    },
  });
  const deleteMutation = trpc.settings.deletePlaybook.useMutation({
    onSuccess: () => refetch(),
  });
  const setDefaultMutation = trpc.settings.setDefaultPlaybook.useMutation({
    onSuccess: () => refetch(),
  });

  const handleCreate = (data: PlaybookFormData) => {
    createMutation.mutate({
      name: data.name,
      type: data.type,
      description: data.description || undefined,
      items: data.items.map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        keywords: item.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        suggestedQuestions: item.suggestedQuestions.split('\n').filter(Boolean),
      })),
    });
  };

  const handleUpdate = (data: PlaybookFormData) => {
    if (!editingPlaybook) return;
    updateMutation.mutate({
      id: editingPlaybook.id,
      data: {
        name: data.name,
        type: data.type,
        description: data.description || undefined,
        items: data.items.map((item) => ({
          id: item.id,
          label: item.label,
          description: item.description,
          keywords: item.keywords.split(',').map((k) => k.trim()).filter(Boolean),
          suggestedQuestions: item.suggestedQuestions.split('\n').filter(Boolean),
        })),
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Playbooks</h3>
          <p className="text-sm text-muted-foreground">
            Manage meeting methodology checklists (MEDDIC, Challenger, etc.)
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Playbook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Playbook</DialogTitle>
              <DialogDescription>
                Create a new meeting methodology checklist.
              </DialogDescription>
            </DialogHeader>
            <PlaybookForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreateOpen(false)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-4">
          {playbooks?.map((playbook) => (
            <Card key={playbook.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      <CardTitle className="text-base">{playbook.name}</CardTitle>
                      {playbook.isDefault && (
                        <Badge className="bg-amber-100 text-amber-800">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{playbook.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {playbook.items.length} items
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!playbook.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate({ id: playbook.id })}
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Set Active
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingPlaybook(playbook as Playbook);
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
                          <AlertDialogTitle>Delete Playbook</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{playbook.name}"? This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: playbook.id })}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {playbook.description && (
                  <CardDescription className="mt-2">{playbook.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="items" className="border-none">
                    <AccordionTrigger className="py-2 text-sm">
                      View Checklist Items
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {playbook.items.map((item: PlaybookItem, index: number) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 p-2 bg-muted/50 rounded"
                          >
                            <span className="text-xs font-medium text-muted-foreground w-6">
                              {index + 1}.
                            </span>
                            <div>
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}

          {(!playbooks || playbooks.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No playbooks yet. Create one to get started.
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Playbook</DialogTitle>
            <DialogDescription>Update the meeting methodology playbook.</DialogDescription>
          </DialogHeader>
          {editingPlaybook && (
            <PlaybookForm
              initialData={editingPlaybook}
              onSubmit={handleUpdate}
              onCancel={() => {
                setIsEditOpen(false);
                setEditingPlaybook(null);
              }}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PlaybookEditor;
