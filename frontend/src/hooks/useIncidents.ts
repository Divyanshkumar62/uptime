import useSWR from 'swr';
import { useEffect } from 'react';
import { apiClient } from '../lib/api-client';

export interface Incident {
  id: number;
  endpoint_id: number;
  status_code: number | null;
  response_time_ms: number;
  is_success: boolean;
  checked_at: string;
}

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

export const useIncidents = (limit = 50) => {
  const { data: incidents, error, isLoading, mutate } = useSWR<Incident[]>(
    `/api/incidents?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 10000, // Background poll every 10s as a fallback
    }
  );

  // Auto-refetch incident feed on status change event from Server-Sent Events
  useEffect(() => {
    const handleSSEStatusChange = () => {
      mutate();
    };

    window.addEventListener('uptime-status-change', handleSSEStatusChange);
    return () => {
      window.removeEventListener('uptime-status-change', handleSSEStatusChange);
    };
  }, [mutate]);

  return {
    incidents,
    error,
    isLoading,
    refetch: mutate,
  };
};
