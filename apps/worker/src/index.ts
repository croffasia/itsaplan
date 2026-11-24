import { startWorkers } from './start';

// Entry point of the worker. The api applies database migrations on startup.
startWorkers();
