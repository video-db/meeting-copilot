/**
 * AuthView Component
 *
 * Inline authentication view (not a modal) for initial setup.
 * Displays as a centered card similar to PermissionsView.
 */

import React, { useState } from 'react';
import { Key, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useConfigStore } from '../../stores/config.store';
import { trpc } from '../../api/trpc';

export function AuthView() {
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
    <div className="max-w-md mx-auto mt-20">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>Welcome to Meeting Copilot</CardTitle>
          </div>
          <CardDescription>
            Enter your details to get started. You can get a VideoDB API key at{' '}
            <a
              href="https://console.videodb.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.videodb.io
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
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
              <label htmlFor="apiKey" className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                VideoDB API Key
              </label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your API key is stored locally and never shared.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending || !name.trim() || !apiKey.trim()}
            >
              {registerMutation.isPending ? 'Connecting...' : 'Get Started'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthView;
