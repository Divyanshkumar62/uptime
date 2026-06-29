import { create } from 'zustand';

export interface StatusEvent {
  endpoint_id: number;
  url: string;
  previous_status: string;
  new_status: string;
  consecutive_failures: number;
  alerted_at: string;
}

interface SSEState {
  status: 'connected' | 'connecting' | 'disconnected';
  lastEvent: StatusEvent | null;
  connect: () => void;
  disconnect: () => void;
}

const INITIAL_DELAY = 1000; // 1s
const MAX_DELAY = 30000;    // 30s

export const useSSEStore = create<SSEState>((set) => {
  let eventSource: EventSource | null = null;
  let reconnectTimeout: number | null = null;
  let reconnectAttempts = 0;
  
  const connectSSE = () => {
    // Clear any pending reconnect timers
    if (reconnectTimeout) {
      window.clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (eventSource) {
      eventSource.close();
    }

    set({ status: 'connecting' });

    // Establish Server-Sent Events connection.
    // Axum endpoint is "/api/events"
    eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      set({ status: 'connected' });
      reconnectAttempts = 0; // Reset attempts on successful connection
    };

    eventSource.onmessage = (event) => {
      try {
        const payload: StatusEvent = JSON.parse(event.data);
        set({ lastEvent: payload });
        
        // Trigger SWR cache invalidation globally by dispatching a custom event
        // that useEndpoints hook can listen to.
        const customEvent = new CustomEvent('uptime-status-change', { detail: payload });
        window.dispatchEvent(customEvent);
      } catch (err) {
        console.error('Failed to parse SSE payload:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource?.close();
      eventSource = null;
      set({ status: 'disconnected' });

      // Apply exponential backoff reconnect with jitter
      const delay = Math.min(INITIAL_DELAY * Math.pow(2, reconnectAttempts), MAX_DELAY) + Math.random() * 1000;
      reconnectAttempts += 1;

      console.warn(`SSE connection error. Retrying in ${(delay / 1000).toFixed(1)}s (Attempt #${reconnectAttempts})`);

      reconnectTimeout = window.setTimeout(() => {
        connectSSE();
      }, delay);
    };
  };

  return {
    status: 'disconnected',
    lastEvent: null,
    connect: () => {
      connectSSE();
    },
    disconnect: () => {
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      reconnectAttempts = 0;
      set({ status: 'disconnected', lastEvent: null });
    }
  };
});
