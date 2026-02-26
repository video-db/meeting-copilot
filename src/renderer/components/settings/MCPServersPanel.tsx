/**
 * MCP Servers Panel Component
 *
 * Settings panel for managing MCP server connections.
 * Allows adding, editing, and removing MCP servers.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Plus,
  Pencil,
  Trash2,
  Server,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  Check,
  RefreshCw,
  ExternalLink,
  Zap,
  X,
} from 'lucide-react';
import { useMCP } from '../../hooks/useMCP';
import { cn } from '../../lib/utils';
import type { MCPServerConfig, MCPServerTemplate } from '../../../preload/index';

// Server Card Component

interface ServerCardProps {
  server: MCPServerConfig;
  connectionState?: { status: string; error?: string };
  onEdit: (server: MCPServerConfig) => void;
  onDelete: (serverId: string) => void;
  onConnect: (serverId: string) => void;
  onDisconnect: (serverId: string) => void;
  onToggleEnabled: (serverId: string, enabled: boolean) => void;
  isConnecting?: boolean;
}

function ServerCard({
  server,
  connectionState,
  onEdit,
  onDelete,
  onConnect,
  onDisconnect,
  onToggleEnabled,
  isConnecting,
}: ServerCardProps) {
  const status = connectionState?.status || 'disconnected';

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500 text-white">
            <Wifi className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="secondary" className="animate-pulse">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Connecting
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <WifiOff className="h-3 w-3 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <Card className={cn('transition-all', !server.isEnabled && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Server className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-base">{server.name}</CardTitle>
            </div>
            <CardDescription className="text-xs">
              {server.transport === 'stdio' ? server.command : server.url}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {connectionState?.error && (
          <p className="text-xs text-red-500 mb-3 p-2 bg-red-50 dark:bg-red-950/30 rounded">
            {connectionState.error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={server.isEnabled}
                onCheckedChange={(checked) => onToggleEnabled(server.id, checked)}
                id={`enabled-${server.id}`}
              />
              <Label htmlFor={`enabled-${server.id}`} className="text-xs">
                Enabled
              </Label>
            </div>
            <Badge variant="outline" className="text-xs">
              {server.transport}
            </Badge>
            {server.autoConnect && (
              <Badge variant="secondary" className="text-xs">
                Auto-connect
              </Badge>
            )}
          </div>

          <div className="flex gap-1">
            {status === 'connected' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDisconnect(server.id)}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onConnect(server.id)}
                disabled={isConnecting || !server.isEnabled}
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Connect'
                )}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => onEdit(server)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Server</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{server.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(server.id)}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Add Server Dialog

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: MCPServerTemplate[];
  editingServer?: MCPServerConfig | null;
  onSubmit: (data: any) => Promise<void>;
}

function AddServerDialog({
  open,
  onOpenChange,
  templates,
  editingServer,
  onSubmit,
}: AddServerDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [form, setForm] = useState({
    name: '',
    transport: 'stdio' as 'stdio' | 'http',
    command: '',
    args: '',
    url: '',
    env: {} as Record<string, string>,
    headers: {} as Record<string, string>,
    isEnabled: true,
    autoConnect: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingServer) {
      setForm({
        name: editingServer.name,
        transport: editingServer.transport,
        command: editingServer.command || '',
        args: editingServer.args?.join(' ') || '',
        url: editingServer.url || '',
        env: {},
        headers: {},
        isEnabled: editingServer.isEnabled,
        autoConnect: editingServer.autoConnect,
      });
      setSelectedTemplate(editingServer.templateId || '');
    } else {
      setForm({
        name: '',
        transport: 'stdio',
        command: '',
        args: '',
        url: '',
        env: {},
        headers: {},
        isEnabled: true,
        autoConnect: false,
      });
      setSelectedTemplate('');
    }
  }, [editingServer, open]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setForm({
        ...form,
        name: template.name,
        transport: template.transport,
        command: template.defaultCommand || '',
        args: template.defaultArgs?.join(' ') || '',
        url: template.defaultUrl || '',
      });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: form.name,
        transport: form.transport,
        command: form.transport === 'stdio' ? form.command : undefined,
        args: form.transport === 'stdio' && form.args
          ? form.args.split(' ').filter(Boolean)
          : undefined,
        url: form.transport === 'http' ? form.url : undefined,
        env: Object.keys(form.env).length > 0 ? form.env : undefined,
        headers: Object.keys(form.headers).length > 0 ? form.headers : undefined,
        templateId: selectedTemplate || undefined,
        isEnabled: form.isEnabled,
        autoConnect: form.autoConnect,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle>
            {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
          </DialogTitle>
          <DialogDescription>
            {editingServer
              ? 'Update the server configuration.'
              : 'Connect to an MCP server for CRM, docs, or other integrations.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pl-6 pr-8 pb-4">
          {/* Template Selection */}
          {!editingServer && (
            <div className="space-y-2">
              <Label>Start from template (optional)</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        <span>{template.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateData && (
                <p className="text-xs text-slate-500">{selectedTemplateData.description}</p>
              )}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., HubSpot CRM"
              required
            />
          </div>

          {/* Transport Type */}
          <div className="space-y-2">
            <Label>Transport Type</Label>
            <Select
              value={form.transport}
              onValueChange={(v) => setForm({ ...form, transport: v as 'stdio' | 'http' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">Stdio (Local Process)</SelectItem>
                <SelectItem value="http">HTTP/SSE (Remote)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stdio Config */}
          {form.transport === 'stdio' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="command">Command</Label>
                <Input
                  id="command"
                  value={form.command}
                  onChange={(e) => setForm({ ...form, command: e.target.value })}
                  placeholder="e.g., npx"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="args">Arguments (space-separated)</Label>
                <Input
                  id="args"
                  value={form.args}
                  onChange={(e) => setForm({ ...form, args: e.target.value })}
                  placeholder="e.g., -y @modelcontextprotocol/server-memory"
                />
              </div>

              {/* Environment Variables for STDIO */}
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Environment Variables</Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Add environment variables for the process (e.g., API_KEY, CODA_TOKEN)
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const key = `ENV_VAR_${Object.keys(form.env).length + 1}`;
                      setForm({
                        ...form,
                        env: { ...form.env, [key]: '' },
                      });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Variable
                  </Button>
                </div>
                {Object.keys(form.env).length > 0 && (
                  <div className="space-y-3 pt-2">
                    {Object.entries(form.env).map(([key, value], index) => (
                      <div key={index} className="flex gap-3 items-center">
                        <div className="flex-1">
                          <Input
                            placeholder="Variable name (e.g., API_KEY)"
                            value={key}
                            onChange={(e) => {
                              const newEnv = { ...form.env };
                              delete newEnv[key];
                              newEnv[e.target.value] = value;
                              setForm({ ...form, env: newEnv });
                            }}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            placeholder="Value (stored securely)"
                            type="password"
                            value={value}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                env: { ...form.env, [key]: e.target.value },
                              });
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => {
                            const newEnv = { ...form.env };
                            delete newEnv[key];
                            setForm({ ...form, env: newEnv });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {Object.keys(form.env).length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic pt-1">
                    No environment variables configured
                  </p>
                )}
              </div>
            </>
          )}

          {/* HTTP Config */}
          {form.transport === 'http' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="url">Server URL</Label>
                <Input
                  id="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://mcp-server.example.com"
                  required
                />
              </div>

              {/* Custom Headers */}
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Custom Headers</Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Add custom HTTP headers for authentication (e.g., Authorization, X-API-Key)
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const key = `Header-${Object.keys(form.headers).length + 1}`;
                      setForm({
                        ...form,
                        headers: { ...form.headers, [key]: '' },
                      });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Header
                  </Button>
                </div>
                {Object.keys(form.headers).length > 0 && (
                  <div className="space-y-3 pt-2">
                    {Object.entries(form.headers).map(([key, value], index) => (
                      <div key={index} className="flex gap-3 items-center">
                        <div className="flex-1">
                          <Input
                            placeholder="Header name (e.g., Authorization)"
                            value={key}
                            onChange={(e) => {
                              const newHeaders = { ...form.headers };
                              delete newHeaders[key];
                              newHeaders[e.target.value] = value;
                              setForm({ ...form, headers: newHeaders });
                            }}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            placeholder="Value (stored securely)"
                            type="password"
                            value={value}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                headers: { ...form.headers, [key]: e.target.value },
                              });
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => {
                            const newHeaders = { ...form.headers };
                            delete newHeaders[key];
                            setForm({ ...form, headers: newHeaders });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {Object.keys(form.headers).length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic pt-1">
                    No custom headers configured
                  </p>
                )}
              </div>
            </>
          )}

          {/* Environment Variables (for templates that require them) */}
          {selectedTemplateData?.requiredEnvVars && selectedTemplateData.requiredEnvVars.length > 0 && (
            <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div>
                <Label className="text-sm font-medium text-amber-800 dark:text-amber-200">Required Credentials</Label>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  These credentials are required for this template to work
                </p>
              </div>
              <div className="space-y-4 pt-2">
                {selectedTemplateData.requiredEnvVars.map((envVar) => (
                  <div key={envVar.key} className="space-y-2">
                    <Label htmlFor={envVar.key} className="text-sm font-medium">
                      {envVar.label}
                    </Label>
                    <Input
                      id={envVar.key}
                      type={envVar.secret ? 'password' : 'text'}
                      value={form.env[envVar.key] || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          env: { ...form.env, [envVar.key]: e.target.value },
                        })
                      }
                      placeholder={envVar.placeholder}
                    />
                    {envVar.description && (
                      <p className="text-xs text-slate-500">{envVar.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isEnabled}
                onCheckedChange={(checked) => setForm({ ...form, isEnabled: checked })}
                id="isEnabled"
              />
              <Label htmlFor="isEnabled" className="text-sm">
                Enabled
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.autoConnect}
                onCheckedChange={(checked) => setForm({ ...form, autoConnect: checked })}
                id="autoConnect"
              />
              <Label htmlFor="autoConnect" className="text-sm">
                Auto-connect on startup
              </Label>
            </div>
          </div>

          {/* Setup Instructions */}
          {selectedTemplateData?.setupInstructions && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Setup Instructions
              </Label>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 whitespace-pre-line">
                {selectedTemplateData.setupInstructions}
              </p>
              {selectedTemplateData.docsUrl && (
                <a
                  href={selectedTemplateData.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-2"
                >
                  View documentation
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.name}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : editingServer ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {editingServer ? 'Save Changes' : 'Add Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Component

export function MCPServersPanel() {
  const {
    servers,
    templates,
    connectionStates,
    connectedServerCount,
    toolCount,
    customTriggerKeywords,
    loadData,
    createServer,
    updateServer,
    deleteServer,
    connect,
    disconnect,
    updateTriggerKeywords,
  } = useMCP();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);
  const [connectingServers, setConnectingServers] = useState<Set<string>>(new Set());
  const [newKeyword, setNewKeyword] = useState('');
  const [isSavingKeywords, setIsSavingKeywords] = useState(false);

  const handleConnect = async (serverId: string) => {
    setConnectingServers((prev) => new Set([...prev, serverId]));
    try {
      await connect(serverId);
    } finally {
      setConnectingServers((prev) => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    }
  };

  const handleDisconnect = async (serverId: string) => {
    await disconnect(serverId);
  };

  const handleToggleEnabled = async (serverId: string, enabled: boolean) => {
    await updateServer(serverId, { isEnabled: enabled });
  };

  const handleEdit = (server: MCPServerConfig) => {
    setEditingServer(server);
    setDialogOpen(true);
  };

  const handleDelete = async (serverId: string) => {
    await deleteServer(serverId);
  };

  const handleSubmit = async (data: any) => {
    if (editingServer) {
      await updateServer(editingServer.id, data);
    } else {
      await createServer(data);
    }
    setEditingServer(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingServer(null);
    }
  };

  const handleAddKeyword = async () => {
    const keyword = newKeyword.trim().toLowerCase();
    if (!keyword || customTriggerKeywords.includes(keyword)) {
      setNewKeyword('');
      return;
    }

    setIsSavingKeywords(true);
    try {
      await updateTriggerKeywords([...customTriggerKeywords, keyword]);
      setNewKeyword('');
    } finally {
      setIsSavingKeywords(false);
    }
  };

  const handleRemoveKeyword = async (keyword: string) => {
    setIsSavingKeywords(true);
    try {
      await updateTriggerKeywords(customTriggerKeywords.filter(k => k !== keyword));
    } finally {
      setIsSavingKeywords(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" />
            MCP Servers
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Connect external tools like CRMs, docs, and calendars
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {connectedServerCount}/{servers.length} connected
          </Badge>
          {toolCount > 0 && (
            <Badge variant="outline">{toolCount} tools available</Badge>
          )}
          <Button variant="outline" size="icon" onClick={() => loadData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Server
          </Button>
        </div>
      </div>

      {/* Trigger Keywords Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Trigger Keywords</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Custom keywords that trigger MCP tool lookups during calls. These are added to the default keywords.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add new keyword */}
          <div className="flex gap-2">
            <Input
              placeholder="Add a keyword (e.g., 'competitor', 'demo')..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyword();
                }
              }}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleAddKeyword}
              disabled={!newKeyword.trim() || isSavingKeywords}
            >
              {isSavingKeywords ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Keywords list */}
          {customTriggerKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {customTriggerKeywords.map((keyword) => (
                <Badge
                  key={keyword}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  {keyword}
                  <button
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="ml-1 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full p-0.5"
                    disabled={isSavingKeywords}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              No custom keywords added. Default keywords like "documentation", "CRM", "calendar", etc. are always active.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Server List */}
      {servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="font-medium mb-2">No MCP Servers Configured</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-4">
              Add MCP servers to connect CRMs, documentation, calendars, and other tools
              that provide contextual insights during calls.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Server
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pr-4">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                connectionState={connectionStates[server.id]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onToggleEnabled={handleToggleEnabled}
                isConnecting={connectingServers.has(server.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Add/Edit Dialog */}
      <AddServerDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        templates={templates}
        editingServer={editingServer}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default MCPServersPanel;
