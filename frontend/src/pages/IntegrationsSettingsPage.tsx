import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Toggle } from '../components/ui/Toggle';
import { Input } from '../components/ui/Input';
import { AlertCircle, CheckCircle, MessageSquare, Phone, Webhook, X, Mail } from 'lucide-react';
import { useIntegrations, IntegrationsSettingsSchema } from '../hooks/useIntegrations';
import type { IntegrationsSettings } from '../hooks/useIntegrations';

type IntegrationType = 'whatsapp' | 'twilio' | 'webhook' | 'slack' | 'discord' | 'smtp';

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
    title: 'Custom Webhook',
    description: 'Dispatch custom JSON event payloads via HTTP requests to external endpoints.',
    icon: <Webhook size={28} />,
    color: 'var(--color-warning)',
  },
  {
    type: 'slack',
    title: 'Slack Webhook',
    description: 'Post real-time status alerts directly into configured Slack channels.',
    icon: <MessageSquare size={28} />,
    color: '#36C5F0',
  },
  {
    type: 'discord',
    title: 'Discord Webhook',
    description: 'Relay failure alerts to Discord channels using native Discord webhooks.',
    icon: <MessageSquare size={28} />,
    color: '#5865F2',
  },
  {
    type: 'smtp',
    title: 'SMTP Email',
    description: 'Send direct alert notifications to administrator mailboxes using an SMTP relay.',
    icon: <Mail size={28} />,
    color: '#10B981',
  },
];

export const IntegrationsSettingsPage: React.FC = () => {
  const { settings, error, isLoading, updateIntegrations, mutateSettings } = useIntegrations();

  const [formData, setFormData] = useState<IntegrationsSettings>({
    whatsapp_enabled: false,
    twilio_enabled: false,
    webhook_enabled: false,
    slack_enabled: false,
    discord_enabled: false,
    smtp_enabled: false,
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
    if (!payload.slack_url) payload.slack_url = '';
    if (!payload.discord_url) payload.discord_url = '';
    if (!payload.smtp_host) payload.smtp_host = '';
    if (payload.smtp_port === undefined || payload.smtp_port === null || (payload.smtp_port as any) === '') {
      payload.smtp_port = 0;
    }
    if (!payload.smtp_username) payload.smtp_username = '';
    if (!payload.smtp_password) payload.smtp_password = '';
    if (!payload.smtp_from) payload.smtp_from = '';
    if (!payload.smtp_to) payload.smtp_to = '';
    if (!payload.webhook_method) payload.webhook_method = 'POST';
    if (!payload.webhook_headers) payload.webhook_headers = '';
    if (!payload.webhook_body_template) payload.webhook_body_template = '';

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

    // Convert types back if needed
    const validatedData = validation.data as IntegrationsSettings;

    try {
      await updateIntegrations(validatedData);
      setSaveStatus('success');
      setSuccessMessage('Integrations settings updated successfully.');
      mutateSettings(validatedData, false);
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
              maxHeight: '90vh',
              overflowY: 'auto'
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
                    Custom HTTP Webhook
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                    CUSTOM WEBHOOK
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
                placeholder="https://example.com/alerts"
                value={formData.webhook_url || ''}
                onChange={handleInputChange}
                error={formErrors.webhook_url}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                <label htmlFor="webhook_method" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  HTTP METHOD
                </label>
                <select
                  id="webhook_method"
                  name="webhook_method"
                  value={formData.webhook_method || 'POST'}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 var(--space-md)',
                    backgroundColor: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                  }}
                >
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                <label htmlFor="webhook_headers" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  CUSTOM HEADERS (JSON)
                </label>
                <textarea
                  id="webhook_headers"
                  name="webhook_headers"
                  placeholder='{"Content-Type": "application/json"}'
                  value={formData.webhook_headers || ''}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    height: '75px',
                    padding: 'var(--space-sm) var(--space-md)',
                    fontFamily: 'monospace',
                    fontSize: 'var(--font-size-xs)',
                    backgroundColor: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    border: `1px solid ${formErrors.webhook_headers ? 'var(--color-destructive)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
                {formErrors.webhook_headers && (
                  <span role="alert" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-destructive)' }}>
                    {formErrors.webhook_headers}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                <label htmlFor="webhook_body_template" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  JSON BODY TEMPLATE
                </label>
                <textarea
                  id="webhook_body_template"
                  name="webhook_body_template"
                  placeholder='{"status": "{status}", "url": "{monitorUrl}", "error": "{errorMessage}"}'
                  value={formData.webhook_body_template || ''}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    height: '100px',
                    padding: 'var(--space-sm) var(--space-md)',
                    fontFamily: 'monospace',
                    fontSize: 'var(--font-size-xs)',
                    backgroundColor: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    border: `1px solid ${formErrors.webhook_body_template ? 'var(--color-destructive)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
                {formErrors.webhook_body_template && (
                  <span role="alert" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-destructive)' }}>
                    {formErrors.webhook_body_template}
                  </span>
                )}
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', padding: 'var(--space-xs) var(--space-sm)', backgroundColor: 'var(--color-bg-deep)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', lineHeight: '1.4' }}>
                  <strong>Template Placeholders:</strong><br />
                  • <code>{`{status}`}</code>: Monitor status (UP/DOWN)<br />
                  • <code>{`{monitorUrl}`}</code>: Target URL tested<br />
                  • <code>{`{monitorName}`}</code>: Target monitor name<br />
                  • <code>{`{errorMessage}`}</code>: Error message details
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                <Toggle
                  checked={formData.webhook_enabled}
                  onChange={() => handleToggleChange('webhook_enabled')}
                  label="Enable Custom Webhook"
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

      {/* Slack Modal */}
      {activeModal === 'slack' && (
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
                  color: '#36C5F0',
                }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--color-text-primary)' }}>
                    Slack Integration
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                    SLACK WEBHOOK
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
                id="slack_url"
                name="slack_url"
                label="SLACK WEBHOOK URL"
                labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                placeholder="https://hooks.slack.com/services/..."
                value={formData.slack_url || ''}
                onChange={handleInputChange}
                error={formErrors.slack_url}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                <Toggle
                  checked={formData.slack_enabled}
                  onChange={() => handleToggleChange('slack_enabled')}
                  label="Enable Slack Integration"
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

      {/* Discord Modal */}
      {activeModal === 'discord' && (
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
                  color: '#5865F2',
                }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--color-text-primary)' }}>
                    Discord Integration
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                    DISCORD WEBHOOK
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
                id="discord_url"
                name="discord_url"
                label="DISCORD WEBHOOK URL"
                labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                placeholder="https://discord.com/api/webhooks/..."
                value={formData.discord_url || ''}
                onChange={handleInputChange}
                error={formErrors.discord_url}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                <Toggle
                  checked={formData.discord_enabled}
                  onChange={() => handleToggleChange('discord_enabled')}
                  label="Enable Discord Integration"
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

      {/* SMTP Modal */}
      {activeModal === 'smtp' && (
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
              maxHeight: '90vh',
              overflowY: 'auto'
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
                  color: '#10B981',
                }}>
                  <Mail size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', margin: 0, color: 'var(--color-text-primary)' }}>
                    SMTP Email Relay
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                    SMTP NOTIFICATIONS
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
            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 'var(--space-md)' }}>
                <Input
                  id="smtp_host"
                  name="smtp_host"
                  label="SMTP HOST"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="smtp.example.com"
                  value={formData.smtp_host || ''}
                  onChange={handleInputChange}
                  error={formErrors.smtp_host}
                />
                <Input
                  id="smtp_port"
                  name="smtp_port"
                  label="PORT"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="587"
                  type="number"
                  value={formData.smtp_port || ''}
                  onChange={handleInputChange}
                  error={formErrors.smtp_port}
                />
              </div>

              <Input
                id="smtp_username"
                name="smtp_username"
                label="SMTP USERNAME"
                labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                placeholder="user@example.com"
                value={formData.smtp_username || ''}
                onChange={handleInputChange}
                error={formErrors.smtp_username}
              />

              <Input
                id="smtp_password"
                name="smtp_password"
                label="SMTP PASSWORD"
                labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                placeholder="••••••••"
                type="password"
                value={formData.smtp_password || ''}
                onChange={handleInputChange}
                error={formErrors.smtp_password}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <Input
                  id="smtp_from"
                  name="smtp_from"
                  label="SENDER EMAIL"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="alerts@example.com"
                  value={formData.smtp_from || ''}
                  onChange={handleInputChange}
                  error={formErrors.smtp_from}
                />
                <Input
                  id="smtp_to"
                  name="smtp_to"
                  label="RECIPIENT EMAIL"
                  labelStyle={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="admin@example.com"
                  value={formData.smtp_to || ''}
                  onChange={handleInputChange}
                  error={formErrors.smtp_to}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
                <Toggle
                  checked={formData.smtp_enabled}
                  onChange={() => handleToggleChange('smtp_enabled')}
                  label="Enable SMTP Integration"
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