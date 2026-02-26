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
import { Input } from '../ui/input';
import { useConfigStore } from '../../stores/config.store';
import { trpc } from '../../api/trpc';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const configStore = useConfigStore();
  const registerMutation = trpc.auth.register.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !apiKey.trim()) {
      setError('Please enter your name and API key');
      return;
    }

    try {
      const result = await registerMutation.mutateAsync({
        name: name.trim(),
        apiKey: apiKey.trim(),
      });

      if (result.success && result.accessToken) {
        configStore.setAuth(result.accessToken, result.name || name, apiKey.trim());
        onOpenChange(false);
        setName('');
        setApiKey('');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome to Meeting Copilot</DialogTitle>
          <DialogDescription>
            Enter your VideoDB API key to get started. You can get one at{' '}
            <a
              href="https://console.videodb.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.videodb.io
            </a>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Your Name
            </label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="apiKey" className="text-sm font-medium">
              VideoDB API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Connecting...' : 'Get Started'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
