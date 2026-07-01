import { http, HttpResponse, delay } from 'msw';

// InMemory database simulation
let mockEndpoints = [
  {
    id: 1,
    url: "https://api.github.com",
    headers: "{}",
    interval_seconds: 30,
    timeout_seconds: 5,
    retry_interval_seconds: 10,
    consecutive_failure_threshold: 3,
    jitter_ratio: 0.1,
    json_validation_keys: null,
    status: "UP",
    consecutive_failures: 0,
    is_active: true,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
    http_method: "GET",
    request_body: null,
    accepted_status_codes: "200-299",
    ignore_tls_errors: false,
    tags: ["api", "github"]
  },
  {
    id: 2,
    url: "https://api.nonexistent-service-io.xyz/health",
    headers: '{"Accept": "application/json"}',
    interval_seconds: 60,
    timeout_seconds: 10,
    retry_interval_seconds: 15,
    consecutive_failure_threshold: 3,
    jitter_ratio: 0.2,
    json_validation_keys: JSON.stringify(["status"]),
    status: "DOWN",
    consecutive_failures: 3,
    is_active: true,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
    http_method: "GET",
    request_body: null,
    accepted_status_codes: "200-299",
    ignore_tls_errors: false,
    tags: ["production", "unstable"]
  },
  {
    id: 3,
    url: "https://httpstat.us/200",
    headers: "{}",
    interval_seconds: 15,
    timeout_seconds: 2,
    retry_interval_seconds: 5,
    consecutive_failure_threshold: 2,
    jitter_ratio: 0.05,
    json_validation_keys: null,
    status: "UP",
    consecutive_failures: 0,
    is_active: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    http_method: "GET",
    request_body: null,
    accepted_status_codes: "200-299",
    ignore_tls_errors: false,
    tags: ["test"]
  }
];

// Generate fake latency metrics for mock details
const generateFakeMetrics = (endpointId: number, hours: number) => {
  const count = 40;
  const history = [];
  const since = Date.now() - hours * 3600 * 1000;
  const baseTime = endpointId === 2 ? 0 : endpointId === 1 ? 45 : 120; // 2 is DOWN (timeout/error)
  
  for (let i = 0; i < count; i++) {
    const timeOffset = (hours * 3600 * 1000 / count) * i;
    const isSuccess = endpointId !== 2 || i < 10; // DOWN service has failed checks recently
    const responseTime = isSuccess ? Math.floor(Math.random() * 80) + baseStyle(baseTime) : 0;
    
    history.push({
      id: i + 1,
      endpoint_id: endpointId,
      status_code: isSuccess ? 200 : null,
      response_time_ms: responseTime,
      is_success: isSuccess,
      checked_at: new Date(since + timeOffset).toISOString()
    });
  }
  
  // Sort descending by checked_at like repository
  history.sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime());
  
  // calculate p99
  const successfulTimes = history
    .filter(m => m.is_success)
    .map(m => m.response_time_ms)
    .sort((a, b) => a - b);
    
  let p99 = 0;
  if (successfulTimes.length > 0) {
    const idx = Math.floor(successfulTimes.length * 0.99);
    p99 = successfulTimes[idx];
  }

  return {
    p99_latency_ms: p99,
    history
  };
};

function baseStyle(num: number) {
  return num;
}

export const mockMonitorHandlers = [
  // 1. List all endpoints
  http.get('/api/endpoints', async () => {
    await delay(300);
    return HttpResponse.json(mockEndpoints);
  }),

  // 2. Create endpoint
  http.post('/api/endpoints', async ({ request }) => {
    const body = (await request.json()) as any;
    await delay(200);

    // Simple validation simulator
    if (!body.url.startsWith('http://') && !body.url.startsWith('https://')) {
      return new HttpResponse("URL must start with http:// or https://", { status: 400 });
    }
    
    try {
      if (body.headers) JSON.parse(body.headers);
    } catch {
      return new HttpResponse("Headers must be a valid JSON representation", { status: 400 });
    }

    const newEndpoint = {
      id: mockEndpoints.length + 1,
      url: body.url,
      headers: body.headers || "{}",
      interval_seconds: body.interval_seconds || 60,
      timeout_seconds: body.timeout_seconds || 10,
      retry_interval_seconds: body.retry_interval_seconds || 15,
      consecutive_failure_threshold: body.consecutive_failure_threshold || 3,
      jitter_ratio: body.jitter_ratio || 0.2,
      json_validation_keys: body.json_validation_keys ? JSON.stringify(body.json_validation_keys) : null,
      status: "UP",
      consecutive_failures: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      http_method: body.http_method || "GET",
      request_body: body.request_body || null,
      accepted_status_codes: body.accepted_status_codes || "200-299",
      ignore_tls_errors: body.ignore_tls_errors || false,
      tags: body.tags || []
    };

    mockEndpoints.push(newEndpoint);
    return HttpResponse.json(newEndpoint);
  }),

  // 3. Get single endpoint
  http.get('/api/endpoints/:id', async ({ params }) => {
    const id = Number(params.id);
    await delay(150);
    const endpoint = mockEndpoints.find(e => e.id === id);
    if (!endpoint) {
      return new HttpResponse("Endpoint not found", { status: 404 });
    }
    return HttpResponse.json(endpoint);
  }),

  // 4. Update endpoint
  http.put('/api/endpoints/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as any;
    await delay(200);

    const index = mockEndpoints.findIndex(e => e.id === id);
    if (index === -1) {
      return new HttpResponse("Endpoint not found", { status: 404 });
    }

    // Validation
    if (!body.url.startsWith('http://') && !body.url.startsWith('https://')) {
      return new HttpResponse("URL must start with http:// or https://", { status: 400 });
    }

    const updated = {
      ...mockEndpoints[index],
      url: body.url,
      headers: body.headers || "{}",
      interval_seconds: body.interval_seconds || 60,
      timeout_seconds: body.timeout_seconds || 10,
      retry_interval_seconds: body.retry_interval_seconds || 15,
      consecutive_failure_threshold: body.consecutive_failure_threshold || 3,
      jitter_ratio: body.jitter_ratio || 0.2,
      json_validation_keys: body.json_validation_keys ? JSON.stringify(body.json_validation_keys) : null,
      is_active: body.is_active,
      updated_at: new Date().toISOString(),
      http_method: body.http_method || mockEndpoints[index].http_method || "GET",
      request_body: body.request_body !== undefined ? body.request_body : mockEndpoints[index].request_body || null,
      accepted_status_codes: body.accepted_status_codes || mockEndpoints[index].accepted_status_codes || "200-299",
      ignore_tls_errors: body.ignore_tls_errors !== undefined ? body.ignore_tls_errors : mockEndpoints[index].ignore_tls_errors || false,
      tags: body.tags || mockEndpoints[index].tags || []
    };

    mockEndpoints[index] = updated;
    return HttpResponse.json(updated);
  }),

  // 5. Delete endpoint
  http.delete('/api/endpoints/:id', async ({ params }) => {
    const id = Number(params.id);
    await delay(150);
    const index = mockEndpoints.findIndex(e => e.id === id);
    if (index === -1) {
      return new HttpResponse("Endpoint not found", { status: 404 });
    }
    mockEndpoints.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // 6. Get latency metrics history
  http.get('/api/endpoints/:id/latency', async ({ params, request }) => {
    const id = Number(params.id);
    const url = new URL(request.url);
    const sinceHours = Number(url.searchParams.get('since_hours') || '720');
    await delay(250);

    const exists = mockEndpoints.some(e => e.id === id);
    if (!exists) {
      return new HttpResponse("Endpoint not found", { status: 404 });
    }

    const data = generateFakeMetrics(id, sinceHours);
    return HttpResponse.json(data);
  }),

  // 7. Get incidents (failures)
  http.get('/api/incidents', async () => {
    await delay(300);
    return HttpResponse.json([
      {
        id: 101,
        endpoint_id: 2,
        status_code: 500,
        response_time_ms: 0,
        is_success: false,
        checked_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 102,
        endpoint_id: 2,
        status_code: 504,
        response_time_ms: 10000,
        is_success: false,
        checked_at: new Date(Date.now() - 7200000).toISOString()
      }
    ]);
  }),

  http.get('/api/settings/integrations', async () => {
    await delay(200);
    return HttpResponse.json({
      twilio_enabled: true,
      twilio_account_sid: "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      twilio_auth_token: "********",
      twilio_from_number: "+1234567890",
      twilio_to_number: "+0987654321",
      whatsapp_enabled: false,
      webhook_enabled: true,
      webhook_url: "https://example.com/webhook",
      slack_enabled: false,
      slack_url: "",
      discord_enabled: false,
      discord_url: "",
      smtp_enabled: false,
      smtp_host: "",
      smtp_port: 587,
      smtp_username: "",
      smtp_password: "",
      smtp_from: "",
      smtp_to: "",
      webhook_method: "POST",
      webhook_headers: "",
      webhook_body_template: ""
    });
  }),

  // 9. Update integrations settings
  http.put('/api/settings/integrations', async ({ request }) => {
    const body = (await request.json()) as any;
    await delay(300);
    return HttpResponse.json(body);
  }),

  // 10. Bypass SSE stream (prevent 502 loop)
  http.get('/api/events', () => {
    return new HttpResponse(new ReadableStream(), {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
  })
];
