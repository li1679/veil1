import { handleEmailEvent } from './workerEmail.js';
import { handleFetchRequest } from './workerFetch.js';
import { handleScheduledEvent } from './workerScheduled.js';

export { SecurityRateLimiter } from './securityRateLimiter.js';

export default {
  fetch: handleFetchRequest,
  email: handleEmailEvent,
  scheduled: handleScheduledEvent,
};

