/**
 * Prompts & Settings Editor Component
 *
 * Allows users to customize AI prompts, thresholds, and configuration.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Save, RotateCcw, Sparkles, Gauge, Settings2 } from 'lucide-react';
import { trpc } from '../../api/trpc';
import { cn } from '../../lib/utils';

interface Setting {
  key: string;
  value: string;
  category: 'prompt' | 'config' | 'threshold';
  label: string;
  description?: string | null;
}

function PromptCard({
  setting,
  value,
  onChange,
}: {
  setting: Setting;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{setting.label}</CardTitle>
        {setting.description && (
          <CardDescription className="text-xs">{setting.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className="font-mono text-xs"
          placeholder="Enter prompt..."
        />
        <p className="text-xs text-muted-foreground mt-2">
          Use <code className="bg-muted px-1 rounded">{'{text}'}</code> or{' '}
          <code className="bg-muted px-1 rounded">{'{transcript}'}</code> as placeholders.
        </p>
      </CardContent>
    </Card>
  );
}

function ThresholdCard({
  setting,
  value,
  onChange,
}: {
  setting: Setting;
  value: string;
  onChange: (value: string) => void;
}) {
  const numValue = parseFloat(value) || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{setting.label}</CardTitle>
            {setting.description && (
              <CardDescription className="text-xs">{setting.description}</CardDescription>
            )}
          </div>
          <span className="text-2xl font-bold text-primary">{value}</span>
        </div>
      </CardHeader>
      <CardContent>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        />
      </CardContent>
    </Card>
  );
}

function ConfigCard({
  setting,
  value,
  onChange,
}: {
  setting: Setting;
  value: string;
  onChange: (value: string) => void;
}) {
  const boolValue = value === 'true';

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">{setting.label}</Label>
            {setting.description && (
              <p className="text-xs text-muted-foreground">{setting.description}</p>
            )}
          </div>
          <Switch
            checked={boolValue}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function PromptsEditor() {
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, refetch } = trpc.settings.getSettings.useQuery();
  const updateMutation = trpc.settings.updateSettings.useMutation({
    onSuccess: () => {
      refetch();
      setHasChanges(false);
    },
  });

  // Initialize local settings from server data
  useEffect(() => {
    if (settings) {
      const settingsMap: Record<string, string> = {};
      settings.forEach((s) => {
        settingsMap[s.key] = s.value;
      });
      setLocalSettings(settingsMap);
    }
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!settings) return;

    const updates = settings.map((s) => ({
      key: s.key,
      value: localSettings[s.key] ?? s.value,
      category: s.category as 'prompt' | 'config' | 'threshold',
      label: s.label,
      description: s.description || undefined,
    }));

    updateMutation.mutate(updates);
  };

  const handleReset = () => {
    if (settings) {
      const settingsMap: Record<string, string> = {};
      settings.forEach((s) => {
        settingsMap[s.key] = s.value;
      });
      setLocalSettings(settingsMap);
      setHasChanges(false);
    }
  };

  const prompts = settings?.filter((s) => s.category === 'prompt') || [];
  const thresholds = settings?.filter((s) => s.category === 'threshold') || [];
  const configs = settings?.filter((s) => s.category === 'config') || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">AI Prompts & Settings</h3>
          <p className="text-sm text-muted-foreground">
            Customize AI behavior, thresholds, and detection settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="prompts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Prompts
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Thresholds
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="mt-4">
          <ScrollArea className="h-[450px]">
            <div className="space-y-4 pr-4">
              {prompts.map((setting) => (
                <PromptCard
                  key={setting.key}
                  setting={setting}
                  value={localSettings[setting.key] ?? setting.value}
                  onChange={(v) => handleChange(setting.key, v)}
                />
              ))}
              {prompts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No prompts configured. Run the app to seed defaults.
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="thresholds" className="mt-4">
          <ScrollArea className="h-[450px]">
            <div className="grid grid-cols-2 gap-4 pr-4">
              {thresholds.map((setting) => (
                <ThresholdCard
                  key={setting.key}
                  setting={setting}
                  value={localSettings[setting.key] ?? setting.value}
                  onChange={(v) => handleChange(setting.key, v)}
                />
              ))}
            </div>
            {thresholds.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No thresholds configured. Run the app to seed defaults.
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ScrollArea className="h-[450px]">
            <div className="space-y-3 pr-4">
              {configs.map((setting) => (
                <ConfigCard
                  key={setting.key}
                  setting={setting}
                  value={localSettings[setting.key] ?? setting.value}
                  onChange={(v) => handleChange(setting.key, v)}
                />
              ))}
            </div>
            {configs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No config options available. Run the app to seed defaults.
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PromptsEditor;
