import React, { useState, useEffect } from 'react';
import type { Endpoint, CreateEndpointDto, UpdateEndpointDto } from '../../../hooks/useEndpoints';
import { useEndpoints } from '../../../hooks/useEndpoints';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Toggle } from '../../../components/ui/Toggle';
import { X, Plus } from 'lucide-react';
import { z } from 'zod';

const EndpointFormSchema = z.object({
  url: z.string().url("URL must start with http:// or https://").refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
    message: "URL must start with http:// or https://",
  }),
  headers: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, "Headers must be a valid JSON representation (e.g. {})"),
  interval_seconds: z.number().int().min(15, "Interval must be between 15 and 3600 seconds").max(3600, "Interval must be between 15 and 3600 seconds"),
  timeout_seconds: z.number().int().min(1, "Timeout must be between 1 and 10 seconds").max(10, "Timeout must be between 1 and 10 seconds"),
  consecutive_failure_threshold: z.number().int().positive("Consecutive failure threshold must be greater than 0"),
  jitter_ratio: z.number().min(0.0, "Jitter ratio must be between 0.0 and 1.0").max(1.0, "Jitter ratio must be between 0.0 and 1.0"),
  http_method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']),
  request_body: z.string().nullable().optional(),
  accepted_status_codes: z.string().regex(/^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/, "Invalid accepted status codes format. Use e.g. 200,201 or 200-299"),
  ignore_tls_errors: z.boolean(),
  tags: z.array(z.string()),
}).superRefine((data, ctx) => {
  if (['POST', 'PUT', 'PATCH'].includes(data.http_method) && data.request_body) {
    try {
      JSON.parse(data.request_body);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['request_body'],
        message: 'Request body must be a valid JSON representation',
      });
    }
    const bodyByteLength = new TextEncoder().encode(data.request_body).length;
    if (bodyByteLength > 102400) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['request_body'],
        message: 'Request body size exceeds 100KB limit',
      });
    }
  }
});

interface EndpointFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpoint?: Endpoint; // Present if editing
}

export const EndpointFormModal: React.FC<EndpointFormModalProps> = ({ isOpen, onClose, endpoint }) => {
  const { createEndpoint, updateEndpoint } = useEndpoints();

  // Form states
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('{}');
  const [interval, setInterval] = useState(60);
  const [timeout, setTimeoutVal] = useState(10);
  const [threshold, setThreshold] = useState(3);
  const [jitter, setJitter] = useState(0.20);
  const [validationKeys, setValidationKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');

  // v2 Advanced features states
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'>('GET');
  const [requestBody, setRequestBody] = useState('');
  const [acceptedStatusCodes, setAcceptedStatusCodes] = useState('200-299');
  const [ignoreTlsErrors, setIgnoreTlsErrors] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestBodyByteLength = new TextEncoder().encode(requestBody).length;

  // Populate form if editing
  useEffect(() => {
    if (endpoint) {
      setUrl(endpoint.url);
      setHeaders(endpoint.headers);
      setInterval(endpoint.interval_seconds);
      setTimeoutVal(endpoint.timeout_seconds);
      setThreshold(endpoint.consecutive_failure_threshold);
      setJitter(endpoint.jitter_ratio);
      setValidationKeys(
        endpoint.json_validation_keys ? JSON.parse(endpoint.json_validation_keys) : []
      );
      setHttpMethod((endpoint.http_method as any) || 'GET');
      setRequestBody(endpoint.request_body || '');
      setAcceptedStatusCodes(endpoint.accepted_status_codes || '200-299');
      setIgnoreTlsErrors(endpoint.ignore_tls_errors || false);
      setTags(endpoint.tags || []);
    } else {
      // Clear form on create
      setUrl('');
      setHeaders('{}');
      setInterval(60);
      setTimeoutVal(10);
      setThreshold(3);
      setJitter(0.20);
      setValidationKeys([]);
      setHttpMethod('GET');
      setRequestBody('');
      setAcceptedStatusCodes('200-299');
      setIgnoreTlsErrors(false);
      setTags([]);
    }
    setErrors({});
  }, [endpoint, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const formData = {
      url,
      headers,
      interval_seconds: interval,
      timeout_seconds: timeout,
      consecutive_failure_threshold: threshold,
      jitter_ratio: jitter,
      http_method: httpMethod,
      request_body: requestBody || null,
      accepted_status_codes: acceptedStatusCodes,
      ignore_tls_errors: ignoreTlsErrors,
      tags,
    };

    const result = EndpointFormSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        let fieldName = path;
        if (path === 'interval_seconds') fieldName = 'interval';
        else if (path === 'timeout_seconds') fieldName = 'timeout';
        else if (path === 'consecutive_failure_threshold') fieldName = 'threshold';
        else if (path === 'jitter_ratio') fieldName = 'jitter';
        else if (path === 'accepted_status_codes') fieldName = 'acceptedStatusCodes';
        else if (path === 'request_body') fieldName = 'requestBody';

        newErrors[fieldName] = issue.message;
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const bodyPayload = ['POST', 'PUT', 'PATCH'].includes(httpMethod) && requestBody.trim() ? requestBody : null;

      if (endpoint) {
        // Edit mode
        const dto: UpdateEndpointDto = {
          url,
          headers,
          interval_seconds: interval,
          timeout_seconds: timeout,
          consecutive_failure_threshold: threshold,
          jitter_ratio: jitter,
          json_validation_keys: validationKeys,
          is_active: endpoint.is_active,
          http_method: httpMethod,
          request_body: bodyPayload,
          accepted_status_codes: acceptedStatusCodes,
          ignore_tls_errors: ignoreTlsErrors,
          tags,
        };
        await updateEndpoint(endpoint.id, dto);
      } else {
        // Create mode
        const dto: CreateEndpointDto = {
          url,
          headers,
          interval_seconds: interval,
          timeout_seconds: timeout,
          consecutive_failure_threshold: threshold,
          jitter_ratio: jitter,
          json_validation_keys: validationKeys,
          http_method: httpMethod,
          request_body: bodyPayload,
          accepted_status_codes: acceptedStatusCodes,
          ignore_tls_errors: ignoreTlsErrors,
          tags,
        };
        await createEndpoint(dto);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrors({ submit: err.response?.data || err.message || 'Operation failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddKey = () => {
    if (newKey.trim() && !validationKeys.includes(newKey.trim())) {
      setValidationKeys([...validationKeys, newKey.trim()]);
      setNewKey('');
    }
  };

  const handleRemoveKey = (keyToRemove: string) => {
    setValidationKeys(validationKeys.filter((k) => k !== keyToRemove));
  };

  const handleAddTag = () => {
    const cleaned = newTag.trim().toLowerCase();
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 'var(--z-modal)',
      padding: 'var(--space-md)'
    }}>
      {/* Modal Dialog Content */}
      <div style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '550px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-high)'
      }}>
        {/* Header */}
        <header style={{
          padding: 'var(--space-lg)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>
            {endpoint ? 'Edit Endpoint Config' : 'Register Monitored Endpoint'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close Modal">
            <X size={18} />
          </Button>
        </header>

        {/* Scrollable Form body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-lg)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', maxHeight: '60vh' }}>
            {errors.submit && (
              <div style={{ padding: 'var(--space-sm) var(--space-md)', backgroundColor: 'var(--color-destructive-bg)', color: 'var(--color-destructive)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
                {errors.submit}
              </div>
            )}

            {/* Target URL & Method in Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 'var(--space-md)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                <label htmlFor="endpoint-method" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                  Method
                </label>
                <select
                  id="endpoint-method"
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value as any)}
                  style={{
                    height: '40px',
                    padding: '0 var(--space-md)',
                    backgroundColor: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <Input
                id="endpoint-url"
                label="Target Endpoint URL"
                placeholder="https://api.my-app.com/health"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                error={errors.url}
                required
              />
            </div>

            {/* JSON Request Body (only for payload-supporting methods) */}
            {['POST', 'PUT', 'PATCH'].includes(httpMethod) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="endpoint-body" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                    JSON Request Body (Optional)
                  </label>
                  <span style={{ fontSize: '10px', color: requestBodyByteLength > 92160 ? 'var(--color-warning)' : 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {requestBodyByteLength} / 102,400 bytes
                  </span>
                </div>
                <textarea
                  id="endpoint-body"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  style={{
                    width: '100%',
                    height: '85px',
                    padding: 'var(--space-sm) var(--space-md)',
                    fontFamily: 'monospace',
                    fontSize: 'var(--font-size-xs)',
                    backgroundColor: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    border: `1px solid ${errors.requestBody ? 'var(--color-destructive)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
                {requestBodyByteLength > 92160 && (
                  <span style={{ fontSize: '11px', color: 'var(--color-warning)' }}>
                    Warning: JSON body size is approaching the 100KB system limit.
                  </span>
                )}
                {errors.requestBody && (
                  <span role="alert" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-destructive)' }}>
                    {errors.requestBody}
                  </span>
                )}
              </div>
            )}

            {/* Request headers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <label htmlFor="endpoint-headers" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                Request Headers (Serialized JSON)
              </label>
              <textarea
                id="endpoint-headers"
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                style={{
                  width: '100%',
                  height: '80px',
                  padding: 'var(--space-sm) var(--space-md)',
                  fontFamily: 'monospace',
                  fontSize: 'var(--font-size-xs)',
                  backgroundColor: 'var(--color-bg-base)',
                  color: 'var(--color-text-primary)',
                  border: `1px solid ${errors.headers ? 'var(--color-destructive)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  outline: 'none',
                  resize: 'none'
                }}
              />
              {errors.headers && (
                <span role="alert" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-destructive)' }}>
                  {errors.headers}
                </span>
              )}
            </div>

            {/* Grid properties: Interval & Timeout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input
                id="endpoint-interval"
                label="Interval (Seconds)"
                type="number"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                error={errors.interval}
                min={15}
                max={3600}
                required
              />
              <Input
                id="endpoint-timeout"
                label="Timeout (Seconds)"
                type="number"
                value={timeout}
                onChange={(e) => setTimeoutVal(Number(e.target.value))}
                error={errors.timeout}
                min={1}
                max={10}
                required
              />
            </div>

            {/* Grid properties: Threshold & Jitter */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input
                id="endpoint-threshold"
                label="Outage Failure Threshold"
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                error={errors.threshold}
                min={1}
                required
                helperText="Consecutive fails before alerting"
              />
              <Input
                id="endpoint-jitter"
                label="Jitter Ratio"
                type="number"
                step="0.01"
                value={jitter}
                onChange={(e) => setJitter(Number(e.target.value))}
                error={errors.jitter}
                min={0}
                max={1}
                required
                helperText="Delays skew (e.g. 0.20 = ±20%)"
              />
            </div>

            {/* Accepted Status Codes & SSL validation bypass */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
              <Input
                id="endpoint-status-codes"
                label="Accepted Status Codes"
                placeholder="200-299"
                value={acceptedStatusCodes}
                onChange={(e) => setAcceptedStatusCodes(e.target.value)}
                error={errors.acceptedStatusCodes}
                helperText="Codes or ranges (e.g. 200,201,200-299)"
                required
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  TLS Options
                </span>
                <div style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
                  <Toggle
                    id="endpoint-tls-bypass"
                    checked={ignoreTlsErrors}
                    onChange={(e) => setIgnoreTlsErrors(e.target.checked)}
                    label="Ignore TLS Errors"
                  />
                </div>
              </div>
            </div>

            {/* Response JSON key validations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <label htmlFor="new-key" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                Response JSON Key Validation Path (Optional)
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <Input
                  id="new-key"
                  placeholder="e.g. status"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={handleAddKey} style={{ height: '40px' }}>
                  <Plus size={16} />
                </Button>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                Asserts these keys exist in response JSON.
              </span>

              {/* Validation key tags display */}
              {validationKeys.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'var(--space-sm)' }}>
                  {validationKeys.map((key, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-base)',
                        fontSize: 'var(--font-size-xs)',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      <span>{key}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKey(key)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--color-destructive)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Flat Tagging System */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <label htmlFor="endpoint-tags-input" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                Tags (Press Enter or Comma to add)
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <Input
                  id="endpoint-tags-input"
                  placeholder="e.g. production, api"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                />
                <Button type="button" variant="secondary" onClick={handleAddTag} style={{ height: '40px' }}>
                  <Plus size={16} />
                </Button>
              </div>

              {/* Tags display */}
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'var(--space-sm)' }}>
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-base)',
                        fontSize: 'var(--font-size-xs)',
                        fontFamily: 'var(--font-mono)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-primary)'
                      }}
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--color-destructive)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Footer actions */}
          <footer style={{
            padding: 'var(--space-lg)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-md)',
            flexShrink: 0
          }}>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {endpoint ? 'Save Changes' : 'Register Monitor'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
};
