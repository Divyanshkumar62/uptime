import useSWR from 'swr';
import { apiClient } from '../lib/api-client';

export interface PingMetric {
  id: number;
  endpoint_id: number;
  status_code: number | null;
  response_time_ms: number;
  is_success: boolean;
  checked_at: string;
}

export interface LatencyResponse {
  p99_latency_ms: number;
  history: PingMetric[];
}

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

export const useLatency = (endpointId: number, sinceHours = 720) => {
  const { data, error, isLoading, mutate } = useSWR<LatencyResponse>(
    endpointId ? `/api/endpoints/${endpointId}/latency?since_hours=${sinceHours}` : null,
    fetcher,
    {
      // Latency data doesn't change every second, default refresh interval is fine,
      // but we can refresh on focus/reconnect.
      revalidateOnFocus: true,
      dedupingInterval: 5000, // 5s deduping
    }
  );

  return {
    latencyData: data,
    error,
    isLoading,
    mutateLatency: mutate,
  };
};
