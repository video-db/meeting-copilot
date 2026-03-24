/**
 * Workflows IPC Handlers
 *
 * Handles IPC communication for workflow webhook management.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { v4 as uuid } from 'uuid';
import { createChildLogger } from '../lib/logger';
import {
  getAllWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from '../db';
import type {
  Workflow,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
} from '../../shared/types/workflow.types';

const logger = createChildLogger('ipc-workflows');

let mainWindow: BrowserWindow | null = null;

export function setWorkflowsMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

export function setupWorkflowHandlers(): void {
  logger.info('Setting up workflow IPC handlers');

  // Get all workflows
  ipcMain.handle('workflows:get-all', async (): Promise<{
    success: boolean;
    workflows?: Workflow[];
    error?: string;
  }> => {
    try {
      const workflows = getAllWorkflows();
      return {
        success: true,
        workflows: workflows.map((w) => ({
          id: w.id,
          name: w.name,
          webhookUrl: w.webhookUrl,
          enabled: w.enabled,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        })),
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to get workflows');
      return { success: false, error: err.message };
    }
  });

  // Get a single workflow
  ipcMain.handle('workflows:get', async (_event, id: string): Promise<{
    success: boolean;
    workflow?: Workflow;
    error?: string;
  }> => {
    try {
      const workflow = getWorkflowById(id);
      if (!workflow) {
        return { success: false, error: 'Workflow not found' };
      }
      return {
        success: true,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          webhookUrl: workflow.webhookUrl,
          enabled: workflow.enabled,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to get workflow');
      return { success: false, error: err.message };
    }
  });

  // Create a workflow
  ipcMain.handle('workflows:create', async (_event, request: CreateWorkflowRequest): Promise<{
    success: boolean;
    workflow?: Workflow;
    error?: string;
  }> => {
    try {
      const workflow = createWorkflow({
        id: uuid(),
        name: request.name,
        webhookUrl: request.webhookUrl,
        enabled: request.enabled ?? true,
      });

      logger.info({ workflowId: workflow.id, name: workflow.name }, 'Workflow created');

      return {
        success: true,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          webhookUrl: workflow.webhookUrl,
          enabled: workflow.enabled,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to create workflow');
      return { success: false, error: err.message };
    }
  });

  // Update a workflow
  ipcMain.handle('workflows:update', async (_event, id: string, request: UpdateWorkflowRequest): Promise<{
    success: boolean;
    workflow?: Workflow;
    error?: string;
  }> => {
    try {
      const existing = getWorkflowById(id);
      if (!existing) {
        return { success: false, error: 'Workflow not found' };
      }

      const workflow = updateWorkflow(id, {
        name: request.name,
        webhookUrl: request.webhookUrl,
        enabled: request.enabled,
      });

      if (!workflow) {
        return { success: false, error: 'Failed to update workflow' };
      }

      logger.info({ workflowId: id }, 'Workflow updated');

      return {
        success: true,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          webhookUrl: workflow.webhookUrl,
          enabled: workflow.enabled,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to update workflow');
      return { success: false, error: err.message };
    }
  });

  // Delete a workflow
  ipcMain.handle('workflows:delete', async (_event, id: string): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const existing = getWorkflowById(id);
      if (!existing) {
        return { success: false, error: 'Workflow not found' };
      }

      deleteWorkflow(id);
      logger.info({ workflowId: id }, 'Workflow deleted');

      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to delete workflow');
      return { success: false, error: err.message };
    }
  });

  // Test a webhook URL
  ipcMain.handle('workflows:test', async (_event, webhookUrl: string): Promise<{
    success: boolean;
    statusCode?: number;
    error?: string;
    responseTime?: number;
  }> => {
    try {
      const { testWorkflowWebhook } = await import('../services/workflow-webhook.service');
      const result = await testWorkflowWebhook(webhookUrl);
      return result;
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err.message }, 'Failed to test webhook');
      return { success: false, error: err.message };
    }
  });

  logger.info('Workflow IPC handlers registered');
}

export function removeWorkflowHandlers(): void {
  ipcMain.removeHandler('workflows:get-all');
  ipcMain.removeHandler('workflows:get');
  ipcMain.removeHandler('workflows:create');
  ipcMain.removeHandler('workflows:update');
  ipcMain.removeHandler('workflows:delete');
  ipcMain.removeHandler('workflows:test');

  logger.info('Workflow IPC handlers removed');
}
