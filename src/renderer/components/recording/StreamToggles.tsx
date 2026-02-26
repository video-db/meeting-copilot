import React from 'react';
import { Mic, Volume2, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';

interface StreamState {
  microphone: boolean;
  systemAudio: boolean;
  screen: boolean;
}

interface StreamTogglesProps {
  streams: StreamState;
  onToggle: (stream: keyof StreamState) => void;
  disabled?: boolean;
}

export function StreamToggles({ streams, onToggle, disabled }: StreamTogglesProps) {
  const toggles = [
    {
      id: 'microphone' as const,
      icon: Mic,
      label: 'Microphone',
      description: 'Capture audio from your microphone',
    },
    {
      id: 'systemAudio' as const,
      icon: Volume2,
      label: 'System Audio',
      description: 'Capture audio from your computer',
    },
    {
      id: 'screen' as const,
      icon: Monitor,
      label: 'Screen',
      description: 'Capture your screen',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {toggles.map(({ id, icon: Icon, label, description }) => (
          <div key={id} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch
              checked={streams[id]}
              onCheckedChange={() => onToggle(id)}
              disabled={disabled}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
