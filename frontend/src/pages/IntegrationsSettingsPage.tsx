import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/ui/Button';
import { Toggle } from '../components/ui/Toggle';
import { Input } from '../components/ui/Input';
import { AlertCircle, CheckCircle, MessageSquare, Phone, Webhook, X } from 'lucide-react';
import { z } from 'zod';

interface IntegrationsSettings {
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
}

const IntegrationsSettingsSchema = z.object({
  whatsapp_token: z.string().optional(),
  whatsapp_phone_number_id: z.string().optional(),
  whatsapp_to_number: z.string().optional(),
  whatsapp_template_name: z.string().optional(),
  whatsapp_enabled: z.boolean(),
  twilio_account_sid: z.string().optional(),
  twilio_auth_token: z.string().optional(),
  twilio_from_number: z.string().optional(),
  twilio_to_number: z.string().optional(),
  twilio_callback_url: z.string().url().optional().or(z.literal('')),
  twilio_enabled: z.boolean(),
  webhook_url: z.string().url().optional().or(z.literal('')),
  webhook_enabled: z.boolean(),
});

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

type IntegrationType = 'whatsapp' | 'twilio' | 'webhook';

interface IntegrationCardConfig {
  type: IntegrationType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const INTEGRATION_CARDS: IntegrationCardConfig[] = [
  {
    type: 'whatsapp',
    title: 'Meta WhatsApp',
    description: 'Send status updates via WhatsApp Business API templates to group chats.',
    icon: <MessageSquare size={28} />,
    color: 'var(--color-success)',
  },
  {
    type: 'twilio',
    title: 'Twilio',
    description: 'Phone call or SMS notifications when monitors trigger failure thresholds.',
    icon: <Phone size={28} />,
    color: 'var(--color-destructive)',
  },
  {
    type: 'webhook',
    title: 'Webhook',
    description: 'Dispatch JSON event payloads via POST requests to external endpoints like Slack or Discord.',
    icon: <Webhook size={28} />,
    color: 'var(--color-warning)',
  },
];

export const IntegrationsSettingsPage: React.FC = () => {
  const { data: settings, error, isLoading, mutate } = useSWR<IntegrationsSettings>(
    '/api/settings/integrations',
    fetcher
  );

  const [formData, setFormData] = useState<IntegrationsSettings>({
    whatsapp_enabled: false,
    twilio_enabled: false,
    webhook_enabled: false,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Modal state
  const [activeModal, setActiveModal] = useState<IntegrationType | null>(null);

  // Sync state with fetched settings
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleToggleChange = (name: keyof IntegrationsSettings) => {
    setFormData((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setFormErrors({});
    setErrorMessage('');
    setSuccessMessage('');

    const payload = { ...formData };
    if (!payload.twilio_callback_url) payload.twilio_callback_url = '';
    if (!payload.webhook_url) payload.webhook_url = '';

    const validation = IntegrationsSettingsSchema.safeParse(payload);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        errors[path] = issue.message;
      });
      setFormErrors(errors);
      setSaveStatus('error');
      setErrorMessage('Please fix the validation errors below.');
      return;
    }

    try {
      await apiClient.put('/api/settings/integrations', payload);
      setSaveStatus('success');
      setSuccessMessage('Integrations settings updated successfully.');
      mutate(payload, false);
      setActiveModal(null);
      setTimeout(() => {
        setSaveStatus('idle');
        setSuccessMessage('');
      }, 3000);
    } catch (err: any) {
      console.error('Failed to update integrations settings:', err);
      setSaveStatus('error');
      setErrorMessage(
        err.response?.data?.message || 'Failed to save integrations settings. Please try again.'
      );
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3xl)' }}>
        <span style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
          Loading settings...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 'var(--space-2xl)',
          textAlign: 'center',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <h3 style={{ color: 'var(--color-destructive)', marginBottom: 'var(--space-md)' }}>
          Failed to load settings
        </h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Ensure the backend integrations table migrations have run successfully.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>
          Alert Integrations
        </h2>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Configure notification channels for monitoring alerts
        </p>
      </div>

      {/* Status Messages */}
      {successMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--color-success-bg)',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <CheckCircle size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--color-destructive-bg)',
            border: '1px solid var(--color-destructive)',
            color: 'var(--color-destructive)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Integration Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 'var(--space-lg)',
      }}>
        {INTEGRATION_CARDS.map((card) => {
          const isEnabled = formData[`${card.type}_enabled` as keyof IntegrationsSettings] as boolean;
          return (
            <div
              key={card.type}
              onClick={() => setActiveModal(card.type)}
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: `1px solid ${isEnabled ? card.color : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-xl)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-lg)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) var(--easing-standard)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = card.color;
                e.currentTarget.style.boxShadow = `0 0 20px rgba(78, 222, 163, 0.08)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isEnabled ? card.color : 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Card top: icon + toggle */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-bg-deep)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.color,
                }}>
                  {card.icon}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Toggle
                    checked={isEnabled}
                    onChange={() => handleToggleChange(`${card.type}_enabled` as keyof IntegrationsSettings)}
                  />
                </div>
              </div>

              {/* Card body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  {card.description}
                </p>
              </div>

              {/* Bottom: status indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                paddingTop: 'var(--space-sm)',
                borderTop: '1px solid var(--color-border)',
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isEnabled ? 'var(--color-success)' : 'var(--color-text-muted)',
                }} />
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: isEnabled ? 'var(--color-success)' : 'var(--color-text-muted)',
                  letterSpacing: '0.02em',
                }}>
                  {isEnabled ? 'Active' : 'Inactive'}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-primary)',
                  letterSpacing: '0.02em',
                }}>
                  Configure &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Config Modals */}
      {/* WhatsApp Modal */}
      {activeModal === 'whatsapp' && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1040,
            padding: 'var(--space-md)',
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="glass-effect"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-modal)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-lg) var(--space-xl)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-bg-deep)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-success)',
                }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--color-text-primary)' }}>
                    Meta WhatsApp API
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                    WHATSAPP BUSINESS API
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <Input
                  id="whatsapp_token"
                  name="whatsapp_token"
                  label="API TOKEN"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  type="password"
                  placeholder="whatsapp-bearer-token"
                  value={formData.whatsapp_token || ''}
                  onChange={handleInputChange}
                  error={formErrors.whatsapp_token}
                />
                <Input
                  id="whatsapp_phone_number_id"
                  name="whatsapp_phone_number_id"
                  label="PHONE NUMBER ID"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="10928374981"
                  value={formData.whatsapp_phone_number_id || ''}
                  onChange={handleInputChange}
                  error={formErrors.whatsapp_phone_number_id}
                />
                <Input
                  id="whatsapp_to_number"
                  name="whatsapp_to_number"
                  label="RECIPIENT NUMBER"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="15551234567"
                  value={formData.whatsapp_to_number || ''}
                  onChange={handleInputChange}
                  error={formErrors.whatsapp_to_number}
                />
                <Input
                  id="whatsapp_template_name"
                  name="whatsapp_template_name"
                  label="TEMPLATE NAME"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="service_down"
                  value={formData.whatsapp_template_name || ''}
                  onChange={handleInputChange}
                  error={formErrors.whatsapp_template_name}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                <Toggle
                  checked={formData.whatsapp_enabled}
                  onChange={() => handleToggleChange('whatsapp_enabled')}
                  label="Enable Integration"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                <Button variant="ghost" onClick={() => setActiveModal(null)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={saveStatus === 'saving'}>
                  Save Settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Twilio Modal */}
      {activeModal === 'twilio' && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1040,
            padding: 'var(--space-md)',
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="glass-effect"
            style={{
              width: '100%',
              maxWidth: '640px',
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-modal)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-lg) var(--space-xl)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-bg-deep)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-destructive)',
                }}>
                  <Phone size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--color-text-primary)' }}>
                    Twilio Voice & SMS
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                    TWILIO API
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <Input
                  id="twilio_account_sid"
                  name="twilio_account_sid"
                  label="ACCOUNT SID"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="AC1029384756"
                  value={formData.twilio_account_sid || ''}
                  onChange={handleInputChange}
                  error={formErrors.twilio_account_sid}
                />
                <Input
                  id="twilio_auth_token"
                  name="twilio_auth_token"
                  label="AUTH TOKEN"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  type="password"
                  placeholder="twilio-auth-token"
                  value={formData.twilio_auth_token || ''}
                  onChange={handleInputChange}
                  error={formErrors.twilio_auth_token}
                />
                <Input
                  id="twilio_from_number"
                  name="twilio_from_number"
                  label="FROM NUMBER"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="15557654321"
                  value={formData.twilio_from_number || ''}
                  onChange={handleInputChange}
                  error={formErrors.twilio_from_number}
                />
                <Input
                  id="twilio_to_number"
                  name="twilio_to_number"
                  label="TARGET NUMBER"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="15558889999"
                  value={formData.twilio_to_number || ''}
                  onChange={handleInputChange}
                  error={formErrors.twilio_to_number}
                />
                <div style={{ gridColumn: 'span 2' }}>
                  <Input
                    id="twilio_callback_url"
                    name="twilio_callback_url"
                    label="CALLBACK URL (TWIML)"
                    labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                    placeholder="https://monitor.example.com/api/twilio-callback"
                    value={formData.twilio_callback_url || ''}
                    onChange={handleInputChange}
                    error={formErrors.twilio_callback_url}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                <Toggle
                  checked={formData.twilio_enabled}
                  onChange={() => handleToggleChange('twilio_enabled')}
                  label="Enable Integration"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                <Button variant="ghost" onClick={() => setActiveModal(null)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={saveStatus === 'saving'}>
                  Save Settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Webhook Modal */}
      {activeModal === 'webhook' && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1040,
            padding: 'var(--space-md)',
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="glass-effect"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-modal)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-lg) var(--space-xl)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-bg-deep)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-warning)',
                }}>
                  <Webhook size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--color-text-primary)' }}>
                    Generic HTTP Webhook
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                    WEBHOOK API
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              <Input
                id="webhook_url"
                name="webhook_url"
                label="WEBHOOK ENDPOINT URL"
                labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                placeholder="https://hooks.slack.com/services/..."
                value={formData.webhook_url || ''}
                onChange={handleInputChange}
                error={formErrors.webhook_url}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                <Toggle
                  checked={formData.webhook_enabled}
                  onChange={() => handleToggleChange('webhook_enabled')}
                  label="Enable Integration"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                <Button variant="ghost" onClick={() => setActiveModal(null)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={saveStatus === 'saving'}>
                  Save Settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};