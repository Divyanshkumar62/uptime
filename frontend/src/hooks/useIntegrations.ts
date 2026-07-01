import useSWR, { useSWRConfig } from 'swr';
import { apiClient } from '../lib/api-client';
import { z } from 'zod';

export interface IntegrationsSettings {
  whatsapp_token?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_to_number?: string;
  whatsapp_template_name?: string;
  whatsapp_enabled: boolean;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_from_number?: string;
  twilio_to_number?: string;
  twilio_callback_url?: string;
  twilio_enabled: boolean;
  webhook_url?: string;
  webhook_enabled: boolean;
  
  // v2 channels
  slack_url?: string;
  slack_enabled: boolean;
  discord_url?: string;
  discord_enabled: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_from?: string;
  smtp_to?: string;
  smtp_enabled: boolean;

  // Custom Webhook expansions
  webhook_method?: string;
  webhook_headers?: string;
  webhook_body_template?: string;
}

export const IntegrationsSettingsSchema = z.object({
  whatsapp_token: z.string().optional(),
  whatsapp_phone_number_id: z.string().optional(),
  whatsapp_to_number: z.string().optional(),
  whatsapp_template_name: z.string().optional(),
  whatsapp_enabled: z.boolean(),
  twilio_account_sid: z.string().optional(),
  twilio_auth_token: z.string().optional(),
  twilio_from_number: z.string().optional(),
  twilio_to_number: z.string().optional(),
  twilio_callback_url: z.string().url("Invalid Twilio callback URL format").optional().or(z.literal('')),
  twilio_enabled: z.boolean(),
  webhook_url: z.string().url("Invalid webhook URL format").optional().or(z.literal('')),
  webhook_enabled: z.boolean(),

  // v2 Native channels
  slack_url: z.string().url("Invalid Slack webhook URL format").optional().or(z.literal('')),
  slack_enabled: z.boolean().default(false),
  discord_url: z.string().url("Invalid Discord webhook URL format").optional().or(z.literal('')),
  discord_enabled: z.boolean().default(false),
  smtp_host: z.string().optional().or(z.literal('')),
  smtp_port: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
    .pipe(z.number().int().positive("SMTP Port must be a positive integer"))
    .optional()
    .or(z.literal(''))
    .or(z.literal(0)),
  smtp_username: z.string().optional().or(z.literal('')),
  smtp_password: z.string().optional().or(z.literal('')),
  smtp_from: z.string().email("Invalid sender email format").optional().or(z.literal('')),
  smtp_to: z.string().email("Invalid recipient email format").optional().or(z.literal('')),
  smtp_enabled: z.boolean().default(false),

  // Webhook custom editor
  webhook_method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']).default('POST'),
  webhook_headers: z.string().refine((val) => {
    if (!val || val.trim() === '') return true;
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, "Headers must be a valid JSON representation (e.g. {})"),
  webhook_body_template: z.string().optional().or(z.literal(''))
});

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

export const useIntegrations = () => {
  const { mutate } = useSWRConfig();
  const { data: settings, error, isLoading, mutate: mutateSettings } = useSWR<IntegrationsSettings>(
    '/api/settings/integrations',
    fetcher
  );

  const updateIntegrations = async (payload: IntegrationsSettings) => {
    const res = await apiClient.put<IntegrationsSettings>('/api/settings/integrations', payload);
    mutate('/api/settings/integrations');
    return res.data;
  };

  return {
    settings,
    error,
    isLoading,
    updateIntegrations,
    mutateSettings,
  };
};
