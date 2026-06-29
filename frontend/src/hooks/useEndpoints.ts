import useSWR, { useSWRConfig } from 'swr';
import { useEffect } from 'react';
import { apiClient } from '../lib/api-client';

export interface Endpoint {
  id: number;
  url: string;
  headers: string;
  interval_seconds: number;
  timeout_seconds: number;
  retry_interval_seconds: number;
  consecutive_failure_threshold: number;
  jitter_ratio: number;
  json_validation_keys: string | null;
  status: 'UP' | 'DOWN';
  consecutive_failures: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  http_method: string;
  request_body: string | null;
  accepted_status_codes: string;
  ignore_tls_errors: boolean;
  tags: string[];
}

export interface CreateEndpointDto {
  url: string;
  headers?: string;
  interval_seconds?: number;
  timeout_seconds?: number;
  retry_interval_seconds?: number;
  consecutive_failure_threshold?: number;
  jitter_ratio?: number;
  json_validation_keys?: string[];
  http_method?: string;
  request_body?: string | null;
  accepted_status_codes?: string;
  ignore_tls_errors?: boolean;
  tags?: string[];
}

export interface UpdateEndpointDto {
  url: string;
  headers?: string;
  interval_seconds?: number;
  timeout_seconds?: number;
  retry_interval_seconds?: number;
  consecutive_failure_threshold?: number;
  jitter_ratio?: number;
  json_validation_keys?: string[];
  is_active: boolean;
  http_method?: string;
  request_body?: string | null;
  accepted_status_codes?: string;
  ignore_tls_errors?: boolean;
  tags?: string[];
}

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

export const useEndpoints = () => {
  const { mutate } = useSWRConfig();
  const { data: endpoints, error, isLoading, mutate: mutateList } = useSWR<Endpoint[]>(
    '/api/endpoints',
    fetcher
  );

  // Hook into the custom window event to catch SSE status events
  // and trigger immediate cache invalidation of the endpoints list
  useEffect(() => {
    const handleSSEStatusChange = () => {
      // Re-fetch endpoints list
      mutateList();
    };

    window.addEventListener('uptime-status-change', handleSSEStatusChange);
    return () => {
      window.removeEventListener('uptime-status-change', handleSSEStatusChange);
    };
  }, [mutateList]);

  // Create monitor mutation
  const createEndpoint = async (dto: CreateEndpointDto) => {
    const res = await apiClient.post<Endpoint>('/api/endpoints', dto);
    // Invalidate list cache
    mutate('/api/endpoints');
    return res.data;
  };

  // Update monitor mutation
  const updateEndpoint = async (id: number, dto: UpdateEndpointDto) => {
    const res = await apiClient.put<Endpoint>(`/api/endpoints/${id}`, dto);
    // Invalidate list and detail cache
    mutate('/api/endpoints');
    mutate(`/api/endpoints/${id}`);
    return res.data;
  };

  // Toggle active flag with Optimistic Updates
  const toggleActive = async (id: number, currentActiveState: boolean) => {
    if (!endpoints) return;

    const nextActiveState = !currentActiveState;

    // Optimistically update local list state
    const optimisticList = endpoints.map((ep) =>
      ep.id === id ? { ...ep, is_active: nextActiveState } : ep
    );

    // Call SWR local mutate
    mutateList(optimisticList, false);

    try {
      const endpointToUpdate = endpoints.find((ep) => ep.id === id);
      if (!endpointToUpdate) throw new Error('Endpoint not found');

      // Setup DTO
      let parsedKeys: string[] = [];
      if (endpointToUpdate.json_validation_keys) {
        try {
          parsedKeys = JSON.parse(endpointToUpdate.json_validation_keys);
        } catch (e) {
          console.error('Failed to parse json_validation_keys JSON from database:', e);
        }
      }

      const dto: UpdateEndpointDto = {
        url: endpointToUpdate.url,
        headers: endpointToUpdate.headers,
        interval_seconds: endpointToUpdate.interval_seconds,
        timeout_seconds: endpointToUpdate.timeout_seconds,
        retry_interval_seconds: endpointToUpdate.retry_interval_seconds,
        consecutive_failure_threshold: endpointToUpdate.consecutive_failure_threshold,
        jitter_ratio: endpointToUpdate.jitter_ratio,
        json_validation_keys: parsedKeys,
        is_active: nextActiveState,
        http_method: endpointToUpdate.http_method,
        request_body: endpointToUpdate.request_body,
        accepted_status_codes: endpointToUpdate.accepted_status_codes,
        ignore_tls_errors: endpointToUpdate.ignore_tls_errors,
        tags: endpointToUpdate.tags,
      };

      await apiClient.put(`/api/endpoints/${id}`, dto);
      
      // Confirm with cache re-fetch
      mutateList();
    } catch (err) {
      // Rollback to original state if call failed
      mutateList(endpoints, false);
      throw err;
    }
  };

  // Delete monitor mutation with Optimistic Updates
  const deleteEndpoint = async (id: number) => {
    if (!endpoints) return;

    // Optimistically filter item out
    const optimisticList = endpoints.filter((ep) => ep.id !== id);
    mutateList(optimisticList, false);

    try {
      await apiClient.delete(`/api/endpoints/${id}`);
      // Revalidate cache
      mutate('/api/endpoints');
    } catch (err) {
      // Rollback list on failure
      mutateList(endpoints, false);
      throw err;
    }
  };

  return {
    endpoints,
    error,
    isLoading,
    createEndpoint,
    updateEndpoint,
    toggleActive,
    deleteEndpoint,
    mutateList,
  };
};
