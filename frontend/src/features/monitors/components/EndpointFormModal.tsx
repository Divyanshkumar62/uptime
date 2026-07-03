import React, { useState, useEffect } from 'react';
import type { Endpoint, CreateEndpointDto, UpdateEndpointDto } from '../../../hooks/useEndpoints';
import { useEndpoints } from '../../../hooks/useEndpoints';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Toggle } from '../../../components/ui/Toggle';
import { X, Plus } from 'lucide-react';
import { z } from 'zod';

const EndpointFormSchema = z.object({
  monitor_type: z.enum(['HTTP', 'TCP', 'DNS', 'POSTGRES', 'MYSQL', 'REDIS', 'DOCKER']).default('HTTP'),
  url: z.string().min(1, "Target host or URL is required"),
  interval_seconds: z.number().int().min(15, "Interval must be between 15 and 3600 seconds").max(3600, "Interval must be between 15 and 3600 seconds"),
  timeout_seconds: z.number().int().min(1, "Timeout must be between 1 and 10 seconds").max(10, "Timeout must be between 1 and 10 seconds"),
  consecutive_failure_threshold: z.number().int().positive("Consecutive failure threshold must be greater than 0"),
  jitter_ratio: z.number().min(0.0, "Jitter ratio must be between 0.0 and 1.0").max(1.0, "Jitter ratio must be between 0.0 and 1.0"),
  tags: z.array(z.string()),
  throttle_seconds: z.number().int().min(0, "Throttle seconds must be a positive integer").default(900),

  // HTTP specific fields
  headers: z.string().optional().nullable(),
  http_method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']).optional().nullable(),
  request_body: z.string().optional().nullable(),
  accepted_status_codes: z.string().optional().nullable(),
  ignore_tls_errors: z.boolean().optional().nullable(),

  // TCP specific fields
  port: z.any().optional().nullable(),

  // DNS specific fields
  dns_record_type: z.enum(['A', 'AAAA', 'MX', 'CNAME', 'TXT']).optional().nullable(),
  dns_resolve_server: z.string().optional().nullable(),
  dns_expected_result: z.string().optional().nullable(),

  // Database & Docker specific fields (v2 expansions)
  db_connection_string: z.string().optional().nullable(),
  docker_container_id: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.monitor_type === 'HTTP') {
    // URL format checks
    if (!data.url.startsWith('http://') && !data.url.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: "URL must start with http:// or https://",
      });
    }

    // Headers checks
    if (data.headers) {
      try {
        JSON.parse(data.headers);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['headers'],
          message: "Headers must be a valid JSON representation (e.g. {})",
        });
      }
    }

    // Request body checks
    if (['POST', 'PUT', 'PATCH'].includes(data.http_method || 'GET') && data.request_body) {
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

    // Accepted status codes checks
    if (data.accepted_status_codes && !/^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/.test(data.accepted_status_codes)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accepted_status_codes'],
        message: "Invalid accepted status codes format. Use e.g. 200,201 or 200-299",
      });
    }
  } else if (data.monitor_type === 'TCP') {
    const portStr = String(data.port || '').trim();
    if (!portStr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['port'],
        message: "Port is required for TCP monitors",
      });
    } else {
      const portNum = Number(portStr);
      if (isNaN(portNum) || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['port'],
          message: "Port must be an integer between 1 and 65535",
        });
      }
    }
  } else if (data.monitor_type === 'DNS') {
    if (!data.dns_record_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dns_record_type'],
        message: "DNS Record Type is required for DNS monitors",
      });
    }
  } else if (['POSTGRES', 'MYSQL', 'REDIS'].includes(data.monitor_type)) {
    const raw = data.db_connection_string || '';
    if (!raw) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['db_connection_string'],
        message: "Database connection string is required",
      });
    } else if (raw !== '********') {
      const connStr = raw.trim();
      const lower = connStr.toLowerCase();
      if (data.monitor_type === 'POSTGRES' && !lower.startsWith('postgresql://') && !lower.startsWith('postgres://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['db_connection_string'],
          message: "Database connection string must start with postgresql:// or postgres://",
        });
      } else if (data.monitor_type === 'MYSQL' && !lower.startsWith('mysql://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['db_connection_string'],
          message: "Database connection string must start with mysql://",
        });
      } else if (data.monitor_type === 'REDIS' && !lower.startsWith('redis://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['db_connection_string'],
          message: "Database connection string must start with redis://",
        });
      }
    }
  } else if (data.monitor_type === 'DOCKER') {
    if (!(data.docker_container_id || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['docker_container_id'],
        message: "Docker Container ID is required",
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
  const [throttleSeconds, setThrottleSeconds] = useState(900);

  // TCP & DNS monitor types states
  const [monitorType, setMonitorType] = useState<'HTTP' | 'TCP' | 'DNS' | 'POSTGRES' | 'MYSQL' | 'REDIS' | 'DOCKER'>('HTTP');
  const [port, setPort] = useState<number | string>('');
  const [dnsRecordType, setDnsRecordType] = useState<'A' | 'AAAA' | 'MX' | 'CNAME' | 'TXT'>('A');
  const [dnsResolveServer, setDnsResolveServer] = useState('');
  const [dnsExpectedResult, setDnsExpectedResult] = useState('');

  // Database & Docker specific states
  const [dbConnectionString, setDbConnectionString] = useState('');
  const [dockerContainerId, setDockerContainerId] = useState('');

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
      setThrottleSeconds(endpoint.throttle_seconds !== undefined ? endpoint.throttle_seconds : 900);
      setMonitorType(endpoint.monitor_type || 'HTTP');
      setPort(endpoint.port !== null && endpoint.port !== undefined ? endpoint.port : '');
      setDnsRecordType((endpoint.dns_record_type as any) || 'A');
      setDnsResolveServer(endpoint.dns_resolve_server || '');
      setDnsExpectedResult(endpoint.dns_expected_result || '');
      setDbConnectionString(endpoint.db_connection_string || '');
      setDockerContainerId(endpoint.docker_container_id || '');
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
      setThrottleSeconds(900);
      setMonitorType('HTTP');
      setPort('');
      setDnsRecordType('A');
      setDnsResolveServer('');
      setDnsExpectedResult('');
      setDbConnectionString('');
      setDockerContainerId('');
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
      throttle_seconds: throttleSeconds,
      monitor_type: monitorType,
      port: port === '' ? null : port,
      dns_record_type: dnsRecordType,
      dns_resolve_server: dnsResolveServer || null,
      dns_expected_result: dnsExpectedResult || null,
      db_connection_string: dbConnectionString || null,
      docker_container_id: dockerContainerId || null,
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
        else if (path === 'throttle_seconds') fieldName = 'throttleSeconds';
        else if (path === 'monitor_type') fieldName = 'monitorType';
        else if (path === 'port') fieldName = 'port';
        else if (path === 'dns_record_type') fieldName = 'dnsRecordType';
        else if (path === 'dns_resolve_server') fieldName = 'dnsResolveServer';
        else if (path === 'dns_expected_result') fieldName = 'dnsExpectedResult';
        else if (path === 'db_connection_string') fieldName = 'dbConnectionString';
        else if (path === 'docker_container_id') fieldName = 'dockerContainerId';

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
      let dto: CreateEndpointDto = {
        url,
        interval_seconds: interval,
        timeout_seconds: timeout,
        consecutive_failure_threshold: threshold,
        jitter_ratio: jitter,
        tags,
        throttle_seconds: throttleSeconds,
        monitor_type: monitorType,
      };

      if (monitorType === 'HTTP') {
        const bodyPayload = ['POST', 'PUT', 'PATCH'].includes(httpMethod) && requestBody.trim() ? requestBody : null;
        dto = {
          ...dto,
          http_method: httpMethod,
          headers,
          request_body: bodyPayload,
          accepted_status_codes: acceptedStatusCodes,
          ignore_tls_errors: ignoreTlsErrors,
          json_validation_keys: validationKeys,
          port: null,
          dns_record_type: null,
          dns_resolve_server: null,
          dns_expected_result: null,
          db_connection_string: null,
          docker_container_id: null,
        };
      } else if (monitorType === 'TCP') {
        dto = {
          ...dto,
          http_method: 'GET',
          headers: '{}',
          request_body: null,
          accepted_status_codes: '200-299',
          ignore_tls_errors: false,
          json_validation_keys: [],
          port: port === '' ? null : Number(port),
          dns_record_type: null,
          dns_resolve_server: null,
          dns_expected_result: null,
          db_connection_string: null,
          docker_container_id: null,
        };
      } else if (monitorType === 'DNS') {
        dto = {
          ...dto,
          http_method: 'GET',
          headers: '{}',
          request_body: null,
          accepted_status_codes: '200-299',
          ignore_tls_errors: false,
          json_validation_keys: [],
          port: null,
          dns_record_type: dnsRecordType,
          dns_resolve_server: dnsResolveServer || null,
          dns_expected_result: dnsExpectedResult || null,
          db_connection_string: null,
          docker_container_id: null,
        };
      } else if (['POSTGRES', 'MYSQL', 'REDIS'].includes(monitorType)) {
        dto = {
          ...dto,
          http_method: 'GET',
          headers: '{}',
          request_body: null,
          accepted_status_codes: '200-299',
          ignore_tls_errors: false,
          json_validation_keys: [],
          port: null,
          dns_record_type: null,
          dns_resolve_server: null,
          dns_expected_result: null,
          db_connection_string: dbConnectionString || null,
          docker_container_id: null,
        };
      } else if (monitorType === 'DOCKER') {
        dto = {
          ...dto,
          http_method: 'GET',
          headers: '{}',
          request_body: null,
          accepted_status_codes: '200-299',
          ignore_tls_errors: false,
          json_validation_keys: [],
          port: null,
          dns_record_type: null,
          dns_resolve_server: null,
          dns_expected_result: null,
          db_connection_string: null,
          docker_container_id: dockerContainerId || null,
        };
      }

      if (endpoint) {
        // Edit mode
        const updateDto: UpdateEndpointDto = {
          ...dto,
          is_active: endpoint.is_active,
        };
        await updateEndpoint(endpoint.id, updateDto);
      } else {
        // Create mode
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

            {/* Monitor Type Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <label htmlFor="endpoint-monitor-type" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                Monitor Type
              </label>
              <select
                id="endpoint-monitor-type"
                value={monitorType}
                onChange={(e) => setMonitorType(e.target.value as any)}
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
                {['HTTP', 'TCP', 'DNS', 'POSTGRES', 'MYSQL', 'REDIS', 'DOCKER'].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.monitorType && (
                <span role="alert" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-destructive)' }}>
                  {errors.monitorType}
                </span>
              )}
            </div>

            {/* Target URL / Address */}
            {monitorType === 'HTTP' ? (
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
            ) : (
              <Input
                id="endpoint-url"
                label={['TCP', 'POSTGRES', 'MYSQL', 'REDIS', 'DOCKER'].includes(monitorType) ? 'Target Host or IP' : 'Target Domain / Host'}
                placeholder={['TCP', 'POSTGRES', 'MYSQL', 'REDIS', 'DOCKER'].includes(monitorType) ? '127.0.0.1' : 'my-app.com'}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                error={errors.url}
                required
              />
            )}

            {/* Database specific inputs */}
            {['POSTGRES', 'MYSQL', 'REDIS'].includes(monitorType) && (
              <Input
                id="endpoint-db-connection-string"
                label="Database Connection String"
                type="password"
                placeholder={
                  monitorType === 'POSTGRES' ? 'postgresql://user:password@localhost:5432/dbname' :
                  monitorType === 'MYSQL' ? 'mysql://user:password@localhost:3306/dbname' :
                  'redis://:password@localhost:6379/0'
                }
                value={dbConnectionString}
                onChange={(e) => setDbConnectionString(e.target.value)}
                error={errors.dbConnectionString}
                required
              />
            )}

            {/* Docker specific inputs */}
            {monitorType === 'DOCKER' && (
              <Input
                id="endpoint-docker-container-id"
                label="Docker Container ID"
                placeholder="e.g. web-app, my-redis, or 12charhash"
                value={dockerContainerId}
                onChange={(e) => setDockerContainerId(e.target.value)}
                error={errors.dockerContainerId}
                required
              />
            )}

            {/* TCP specific inputs */}
            {monitorType === 'TCP' && (
              <Input
                id="endpoint-port"
                label="Port"
                type="number"
                placeholder="e.g. 80, 443, 22"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                error={errors.port}
                min={1}
                max={65535}
                required
              />
            )}

            {/* DNS specific inputs */}
            {monitorType === 'DNS' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  <label htmlFor="endpoint-dns-record-type" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                    DNS Record Type
                  </label>
                  <select
                    id="endpoint-dns-record-type"
                    value={dnsRecordType}
                    onChange={(e) => setDnsRecordType(e.target.value as any)}
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
                    {['A', 'AAAA', 'MX', 'CNAME', 'TXT'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {errors.dnsRecordType && (
                    <span role="alert" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-destructive)' }}>
                      {errors.dnsRecordType}
                    </span>
                  )}
                </div>

                <Input
                  id="endpoint-dns-nameserver"
                  label="Nameserver (Optional)"
                  placeholder="e.g. 8.8.8.8"
                  value={dnsResolveServer}
                  onChange={(e) => setDnsResolveServer(e.target.value)}
                  error={errors.dnsResolveServer}
                  helperText="Resolver IP/host; queries system default if omitted"
                />

                <Input
                  id="endpoint-dns-expected"
                  label="Expected Result (Optional)"
                  placeholder="e.g. 93.184.215.14"
                  value={dnsExpectedResult}
                  onChange={(e) => setDnsExpectedResult(e.target.value)}
                  error={errors.dnsExpectedResult}
                  helperText="Matches resolved record strings (IP, CNAME target, etc.)"
                />
              </>
            )}

            {/* HTTP specific request config inputs */}
            {monitorType === 'HTTP' && (
              <>
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
              </>
            )}

            {/* Grid properties: Interval & Timeout */}
            {monitorType === 'HTTP' ? (
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
            ) : (
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
            )}

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

            {/* Accepted Status Codes & SSL validation bypass (HTTP only) */}
            {monitorType === 'HTTP' && (
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
            )}

            {/* Alert Cooldown */}
            <Input
              id="endpoint-throttle"
              label="Alert Cooldown (Seconds)"
              type="number"
              value={throttleSeconds}
              onChange={(e) => setThrottleSeconds(Number(e.target.value))}
              error={errors.throttleSeconds}
              min={0}
              required
              helperText="Cooldown threshold before dispatching another alert (default 900)"
            />

            {/* Response JSON key validations (HTTP only) */}
            {monitorType === 'HTTP' && (
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
            )}

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
