import type { VeloConfig } from '../lib/config.js';
import { validateWixApiConfig, wixApiFetch } from '../lib/wixApi.js';

const TEMPLATES_QUERY_PATH = '/v3/triggered-emails/templates/query';
const TEMPLATES_CREATE_PATH = '/v3/triggered-emails/templates';

interface EmailTemplateVariable {
  name: string;
}

interface EmailTemplate {
  id: string;
  displayName: string;
  status: string;
  variables?: EmailTemplateVariable[];
}

export interface CreateTemplateInput {
  displayName: string;
  subject: string;
  body: string;
}

/**
 * List triggered email templates via Wix REST API.
 */
export async function listEmailTemplates(config: VeloConfig): Promise<string> {
  const configErr = validateWixApiConfig(config);
  if (configErr) return configErr;

  const result = await wixApiFetch(config, 'POST', TEMPLATES_QUERY_PATH, {
    query: {},
  });

  if (!result.ok) {
    return `Error listing email templates (HTTP ${result.status}): ${JSON.stringify(result.body)}`;
  }

  const templates = (result.body.emailTemplates ?? []) as EmailTemplate[];
  if (templates.length === 0) {
    return 'No triggered email templates found.';
  }

  const lines = templates.map((t) => {
    const vars = t.variables?.map((v) => v.name).join(', ') || 'none';
    return `  ${t.id}  ${t.displayName}  [${t.status}]  vars: ${vars}`;
  });

  return `Triggered Email Templates (${templates.length}):\n${lines.join('\n')}`;
}

/**
 * Create a triggered email template via Wix REST API.
 */
export async function createEmailTemplate(
  config: VeloConfig,
  input: CreateTemplateInput,
): Promise<string> {
  const configErr = validateWixApiConfig(config);
  if (configErr) return configErr;

  const result = await wixApiFetch(config, 'POST', TEMPLATES_CREATE_PATH, {
    emailTemplate: {
      displayName: input.displayName,
      subject: input.subject,
      body: input.body,
    },
  });

  if (!result.ok) {
    return `Error creating email template (HTTP ${result.status}): ${JSON.stringify(result.body)}`;
  }

  const template = result.body.emailTemplate as EmailTemplate | undefined;
  if (!template) {
    return 'Error: No template returned in API response';
  }

  return `Successfully created email template:\n  ID: ${template.id}\n  Name: ${template.displayName}\n  Status: ${template.status}`;
}
