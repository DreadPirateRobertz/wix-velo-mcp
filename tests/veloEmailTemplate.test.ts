import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listEmailTemplates, createEmailTemplate } from '../src/tools/veloEmailTemplate.js';
import type { VeloConfig } from '../src/lib/config.js';

const mockWixApiFetch = vi.fn();

vi.mock('../src/lib/wixApi.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/lib/wixApi.js')>();
  return {
    ...orig,
    wixApiFetch: (...args: unknown[]) => mockWixApiFetch(...args),
  };
});

describe('veloEmailTemplate', () => {
  const config: VeloConfig = {
    devRepo: '/fake/dev',
    prodRepo: '/fake/prod',
    wixApiKey: 'test-api-key',
    wixSiteId: 'test-site-id',
  };

  beforeEach(() => {
    mockWixApiFetch.mockReset();
  });

  // ═══════════════════════════════════════════════════════════════════
  // listEmailTemplates
  // ═══════════════════════════════════════════════════════════════════

  describe('listEmailTemplates', () => {
    it('calls wixApiFetch with correct endpoint and method', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: { emailTemplates: [] },
      });

      await listEmailTemplates(config);

      expect(mockWixApiFetch).toHaveBeenCalledWith(
        config,
        'POST',
        '/v3/triggered-emails/templates/query',
        expect.any(Object),
      );
    });

    it('returns formatted template list when templates exist', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          emailTemplates: [
            {
              id: 'tmpl-001',
              displayName: 'Welcome Email',
              status: 'ACTIVE',
              variables: [{ name: 'firstName' }, { name: 'lastName' }],
            },
            {
              id: 'tmpl-002',
              displayName: 'Order Confirmation',
              status: 'ACTIVE',
              variables: [{ name: 'orderId' }],
            },
          ],
        },
      });

      const result = await listEmailTemplates(config);
      expect(result).toContain('Welcome Email');
      expect(result).toContain('Order Confirmation');
      expect(result).toContain('tmpl-001');
      expect(result).toContain('tmpl-002');
      expect(result).toContain('firstName');
      expect(result).toContain('orderId');
    });

    it('returns "no templates found" message when empty', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: { emailTemplates: [] },
      });

      const result = await listEmailTemplates(config);
      expect(result).toMatch(/no.*template/i);
    });

    it('returns error message on API failure', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: false,
        status: 401,
        body: { message: 'Unauthorized' },
      });

      const result = await listEmailTemplates(config);
      expect(result).toContain('Error');
      expect(result).toContain('401');
    });

    it('returns error on missing API credentials', async () => {
      const noKeyConfig: VeloConfig = {
        devRepo: '/fake/dev',
        prodRepo: '/fake/prod',
      };

      const result = await listEmailTemplates(noKeyConfig);
      expect(result).toContain('ERROR');
      expect(result).toContain('WIX_API_KEY');
    });

    it('handles templates with no variables gracefully', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          emailTemplates: [
            {
              id: 'tmpl-003',
              displayName: 'Simple Notification',
              status: 'ACTIVE',
            },
          ],
        },
      });

      const result = await listEmailTemplates(config);
      expect(result).toContain('Simple Notification');
      expect(result).not.toContain('undefined');
    });

    it('handles network errors gracefully', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: false,
        status: 0,
        body: { error: 'Network error' },
      });

      const result = await listEmailTemplates(config);
      expect(result).toContain('Error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // createEmailTemplate
  // ═══════════════════════════════════════════════════════════════════

  describe('createEmailTemplate', () => {
    it('calls wixApiFetch with correct endpoint and payload', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          emailTemplate: {
            id: 'tmpl-new',
            displayName: 'New Template',
            status: 'ACTIVE',
          },
        },
      });

      await createEmailTemplate(config, {
        displayName: 'New Template',
        subject: 'Hello {{name}}',
        body: '<p>Welcome, {{name}}!</p>',
      });

      expect(mockWixApiFetch).toHaveBeenCalledWith(
        config,
        'POST',
        '/v3/triggered-emails/templates',
        expect.objectContaining({
          emailTemplate: expect.objectContaining({
            displayName: 'New Template',
            subject: 'Hello {{name}}',
            body: '<p>Welcome, {{name}}!</p>',
          }),
        }),
      );
    });

    it('returns success message with template ID', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          emailTemplate: {
            id: 'tmpl-new-123',
            displayName: 'Order Shipped',
            status: 'ACTIVE',
          },
        },
      });

      const result = await createEmailTemplate(config, {
        displayName: 'Order Shipped',
        subject: 'Your order has shipped',
        body: '<p>Track your order</p>',
      });

      expect(result).toContain('tmpl-new-123');
      expect(result).toContain('Order Shipped');
      expect(result).toMatch(/created|success/i);
    });

    it('returns error message on API failure', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: false,
        status: 400,
        body: { message: 'Invalid template data' },
      });

      const result = await createEmailTemplate(config, {
        displayName: 'Bad Template',
        subject: '',
        body: '',
      });

      expect(result).toContain('Error');
      expect(result).toContain('400');
    });

    it('returns error on missing API credentials', async () => {
      const noKeyConfig: VeloConfig = {
        devRepo: '/fake/dev',
        prodRepo: '/fake/prod',
      };

      const result = await createEmailTemplate(noKeyConfig, {
        displayName: 'Test',
        subject: 'Test',
        body: 'Test',
      });

      expect(result).toContain('ERROR');
      expect(result).toContain('WIX_API_KEY');
    });

    it('requires displayName in payload', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: { emailTemplate: { id: 'x', displayName: 'X', status: 'ACTIVE' } },
      });

      await createEmailTemplate(config, {
        displayName: 'Required Name',
        subject: 'Sub',
        body: 'Body',
      });

      const payload = mockWixApiFetch.mock.calls[0][3];
      expect(payload.emailTemplate.displayName).toBe('Required Name');
    });

    it('handles network errors gracefully', async () => {
      mockWixApiFetch.mockResolvedValue({
        ok: false,
        status: 0,
        body: { error: 'Connection refused' },
      });

      const result = await createEmailTemplate(config, {
        displayName: 'Test',
        subject: 'Test',
        body: 'Test',
      });

      expect(result).toContain('Error');
    });
  });
});
