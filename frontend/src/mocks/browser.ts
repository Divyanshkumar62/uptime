import { setupWorker } from 'msw/browser';
import { mockMonitorHandlers } from './handlers';

export const worker = setupWorker(...mockMonitorHandlers);
