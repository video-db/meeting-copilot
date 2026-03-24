/**
 * Workflows Panel Component
 *
 * Settings panel for managing workflow webhooks (n8n, Zapier, etc.)
 */

import React, { useState, useEffect } from 'react';
import {
  Workflow,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  X,
  Play,
} from 'lucide-react';

interface WorkflowItem {
  id: string;
  name: string;
  webhookUrl: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Toggle Component
function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-[38px] h-[22px] rounded-full relative transition-colors ${
        enabled ? 'bg-[#ec5b16]' : 'bg-[#e4e4ec]'
      }`}
    >
      <div
        className={`absolute size-[18px] bg-white rounded-full top-[2px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.15)] transition-all ${
          enabled ? 'left-[18px]' : 'left-[2px]'
        }`}
      />
    </button>
  );
}

export function WorkflowsPanel() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Test state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.workflows.getAll();
      if (result.success && result.workflows) {
        setWorkflows(result.workflows);
      } else {
        setError(result.error || 'Failed to load workflows');
      }
    } catch (err) {
      setError('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setFormEnabled(true);
    setFormError(null);
    setShowForm(true);
  };

  const handleEdit = (workflow: WorkflowItem) => {
    setEditingId(workflow.id);
    setFormName(workflow.name);
    setFormUrl(workflow.webhookUrl);
    setFormEnabled(workflow.enabled);
    setFormError(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setFormError(null);
  };

  const handleSave = async () => {
    // Validate
    if (!formName.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!formUrl.trim()) {
      setFormError('Webhook URL is required');
      return;
    }
    try {
      new URL(formUrl);
    } catch {
      setFormError('Invalid URL format');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingId) {
        // Update existing
        const result = await window.electronAPI.workflows.update(editingId, {
          name: formName.trim(),
          webhookUrl: formUrl.trim(),
          enabled: formEnabled,
        });
        if (result.success) {
          await loadWorkflows();
          handleCancel();
        } else {
          setFormError(result.error || 'Failed to update workflow');
        }
      } else {
        // Create new
        const result = await window.electronAPI.workflows.create({
          name: formName.trim(),
          webhookUrl: formUrl.trim(),
          enabled: formEnabled,
        });
        if (result.success) {
          await loadWorkflows();
          handleCancel();
        } else {
          setFormError(result.error || 'Failed to create workflow');
        }
      }
    } catch (err) {
      setFormError('An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await window.electronAPI.workflows.delete(id);
      if (result.success) {
        await loadWorkflows();
      } else {
        setError(result.error || 'Failed to delete workflow');
      }
    } catch (err) {
      setError('Failed to delete workflow');
    }
  };

  const handleToggleEnabled = async (workflow: WorkflowItem) => {
    try {
      const result = await window.electronAPI.workflows.update(workflow.id, {
        enabled: !workflow.enabled,
      });
      if (result.success) {
        await loadWorkflows();
      }
    } catch (err) {
      // Ignore errors
    }
  };

  const handleTest = async (workflow: WorkflowItem) => {
    setTestingId(workflow.id);
    setTestResult(null);

    try {
      const result = await window.electronAPI.workflows.test(workflow.webhookUrl);
      setTestResult({
        id: workflow.id,
        success: result.success,
        message: result.success
          ? `Success (${result.responseTime}ms)`
          : result.error || 'Test failed',
      });
    } catch (err) {
      setTestResult({
        id: workflow.id,
        success: false,
        message: 'Test failed',
      });
    } finally {
      setTestingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-[48px]">
        <Loader2 className="h-[24px] w-[24px] animate-spin text-[#969696]" />
      </div>
    );
  }

  return (
    <div className="space-y-[16px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-[#141420] flex items-center gap-[8px]">
            <Workflow className="h-[18px] w-[18px]" />
            Workflows
          </h2>
          <p className="text-[13px] text-[#969696] mt-[2px]">
            Send meeting data to automation tools like n8n and Zapier
          </p>
        </div>
        {!showForm && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-[6px] px-[14px] py-[8px] bg-[#ec5b16] hover:bg-[#d9520f] text-white text-[13px] font-medium rounded-[8px] transition-colors"
          >
            <Plus className="h-[14px] w-[14px]" />
            Add Workflow
          </button>
        )}
      </div>

      {error && (
        <div className="p-[12px] bg-[#fef2f2] border border-[#fecaca] rounded-[10px]">
          <p className="text-[13px] text-[#dc2626] flex items-center gap-[8px]">
            <AlertCircle className="h-[14px] w-[14px]" />
            {error}
          </p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white border border-[#ededf3] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]">
          <div className="px-[20px] py-[16px] border-b border-[#ededf3]">
            <h3 className="text-[15px] font-semibold text-[#141420]">
              {editingId ? 'Edit Workflow' : 'New Workflow'}
            </h3>
            <p className="text-[13px] text-[#969696] mt-[4px]">
              Configure a webhook URL to receive meeting data after each recording.
            </p>
          </div>
          <div className="px-[20px] py-[20px] space-y-[16px]">
            {formError && (
              <div className="p-[12px] bg-[#fef2f2] border border-[#fecaca] rounded-[10px]">
                <p className="text-[13px] text-[#dc2626] flex items-center gap-[8px]">
                  <AlertCircle className="h-[14px] w-[14px]" />
                  {formError}
                </p>
              </div>
            )}

            <div className="space-y-[6px]">
              <label className="text-[13px] font-medium text-[#141420]">Name</label>
              <input
                type="text"
                placeholder="e.g., Notion Sync, n8n Workflow"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-[12px] py-[10px] text-[14px] text-[#141420] bg-white border border-[#ededf3] rounded-[10px] outline-none focus:border-[#ec5b16] focus:ring-1 focus:ring-[#ec5b16]/20 transition-colors placeholder:text-[#969696]"
              />
            </div>

            <div className="space-y-[6px]">
              <label className="text-[13px] font-medium text-[#141420]">Webhook URL</label>
              <input
                type="url"
                placeholder="https://your-webhook-url.com/hook"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="w-full px-[12px] py-[10px] text-[14px] text-[#141420] bg-white border border-[#ededf3] rounded-[10px] outline-none focus:border-[#ec5b16] focus:ring-1 focus:ring-[#ec5b16]/20 transition-colors placeholder:text-[#969696] font-mono text-[13px]"
              />
              <p className="text-[12px] text-[#969696]">
                The URL that will receive POST requests with meeting data
              </p>
            </div>

            <div className="flex items-center justify-between py-[8px]">
              <div>
                <p className="text-[13px] font-medium text-[#141420]">Enabled</p>
                <p className="text-[12px] text-[#969696]">
                  Only enabled workflows will be triggered
                </p>
              </div>
              <Toggle enabled={formEnabled} onChange={setFormEnabled} />
            </div>

            <div className="flex items-center gap-[8px] pt-[8px]">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-[6px] px-[16px] py-[10px] bg-[#ec5b16] hover:bg-[#d9520f] text-white text-[14px] font-medium rounded-[10px] transition-colors disabled:opacity-50"
              >
                {isSaving && <Loader2 className="h-[14px] w-[14px] animate-spin" />}
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={handleCancel}
                className="px-[16px] py-[10px] border border-[#ededf3] rounded-[10px] text-[14px] font-medium text-[#464646] hover:bg-[#f7f7f7] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflows List */}
      {workflows.length === 0 && !showForm ? (
        <div className="bg-white border border-[#ededf3] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col items-center py-[48px] px-[20px]">
            <div className="w-[48px] h-[48px] flex items-center justify-center bg-[#f7f7f7] rounded-[12px] mb-[16px]">
              <Workflow className="h-[24px] w-[24px] text-[#969696]" />
            </div>
            <p className="text-[14px] text-[#464646] text-center mb-[8px]">
              No workflows configured yet
            </p>
            <p className="text-[13px] text-[#969696] text-center max-w-[320px] mb-[16px]">
              Add a webhook URL to automatically send meeting recordings, summaries, and action items to your automation tools.
            </p>
            <button
              onClick={handleAdd}
              className="flex items-center gap-[6px] px-[16px] py-[10px] bg-[#ec5b16] hover:bg-[#d9520f] text-white text-[14px] font-medium rounded-[10px] transition-colors"
            >
              <Plus className="h-[14px] w-[14px]" />
              Add Your First Workflow
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-[12px]">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="bg-white border border-[#ededf3] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)] px-[16px] py-[14px]">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[8px] mb-[4px]">
                    <h4 className="text-[14px] font-medium text-[#141420] truncate">{workflow.name}</h4>
                    <div className={`px-[8px] py-[2px] rounded-[6px] ${
                      workflow.enabled
                        ? 'bg-[#ecfdf5] text-[#059669]'
                        : 'bg-[#f7f7f7] text-[#969696]'
                    }`}>
                      <span className="text-[11px] font-medium">
                        {workflow.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {testResult && testResult.id === workflow.id && (
                      <div className={`flex items-center gap-[4px] px-[8px] py-[2px] rounded-[6px] ${
                        testResult.success
                          ? 'bg-[#ecfdf5] text-[#059669]'
                          : 'bg-[#fef2f2] text-[#dc2626]'
                      }`}>
                        {testResult.success ? (
                          <Check className="h-[12px] w-[12px]" />
                        ) : (
                          <X className="h-[12px] w-[12px]" />
                        )}
                        <span className="text-[11px] font-medium">{testResult.message}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[12px] text-[#969696] truncate font-mono">
                    {workflow.webhookUrl}
                  </p>
                </div>

                <div className="flex items-center gap-[4px] ml-[16px]">
                  <button
                    onClick={() => handleTest(workflow)}
                    disabled={testingId === workflow.id}
                    title="Test webhook"
                    className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] hover:bg-[#f7f7f7] transition-colors disabled:opacity-50"
                  >
                    {testingId === workflow.id ? (
                      <Loader2 className="h-[16px] w-[16px] animate-spin text-[#464646]" />
                    ) : (
                      <Play className="h-[16px] w-[16px] text-[#464646]" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(workflow)}
                    title="Edit workflow"
                    className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] hover:bg-[#f7f7f7] transition-colors"
                  >
                    <Pencil className="h-[16px] w-[16px] text-[#464646]" />
                  </button>
                  <button
                    onClick={() => handleDelete(workflow.id)}
                    title="Delete workflow"
                    className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] hover:bg-[#fef2f2] transition-colors"
                  >
                    <Trash2 className="h-[16px] w-[16px] text-[#dc2626]" />
                  </button>
                  <Toggle
                    enabled={workflow.enabled}
                    onChange={() => handleToggleEnabled(workflow)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-white border border-[#ededf3] rounded-[12px] shadow-[0px_1.272px_15.267px_0px_rgba(0,0,0,0.05)]">
        <div className="px-[20px] py-[16px]">
          <h4 className="text-[14px] font-semibold text-[#141420] mb-[8px]">
            Webhook Payload
          </h4>
          <p className="text-[13px] text-[#464646] mb-[8px]">
            After each meeting recording, enabled workflows receive a POST request with:
          </p>
          <ul className="text-[13px] text-[#969696] space-y-[4px] list-disc list-inside">
            <li>Meeting title, description, and duration</li>
            <li>VideoDB video ID and player URL</li>
            <li>AI-generated summary and topics</li>
            <li>Action items and post-meeting checklist</li>
            <li>Full transcript (if available)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default WorkflowsPanel;
