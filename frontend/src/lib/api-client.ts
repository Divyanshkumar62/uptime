import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';
import { useSSEStore } from '../stores/useSSEStore';
import { mutate } from 'swr';

export const apiClient = axios.create({
  baseURL: '', // Uses base host, routing to proxy '/api' in dev
  timeout: 10000,
});

// Request interceptor to inject api-key
apiClient.interceptors.request.use(
  (config) => {
    const key = useAuthStore.getState().adminApiKey;
    if (key) {
      config.headers['X-API-Key'] = key;
      config.headers['Authorization'] = `Bearer ${key}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to catch unauthorized API calls
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // 1. Terminate SSE connection
      useSSEStore.getState().disconnect();

      // 2. Clear credentials from auth store
      useAuthStore.getState().logout();

      // 3. Clear SWR cache
      mutate(() => true, undefined, { revalidate: false });

      // 4. Redirect to login with expired query parameter
      window.location.href = '/login?expired=true';
    }
    return Promise.reject(error);
  }
);
