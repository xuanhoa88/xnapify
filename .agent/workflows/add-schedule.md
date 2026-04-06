---
description: Add a recurring cron-based scheduled task to a module or extension
---

Add a new background scheduled task logic utilizing the robust `node-cron` wrapper via the internal Schedule Engine (from `shared/api/engines/schedule`).

## When to Use Schedules
Use the Schedule Engine when you need to run logic on a recurring, timer-based cadence:
- **Periodic Aggregation**: Daily or weekly status roll-ups.
- **Maintenance Tasks**: Cleanup jobs (soft-delete purges, expired token invalidation).
- **Polling & Webhook Syncing**: Routinely pulling data from third-party non-webhook-enabled REST feeds.

## Application Structure
Schedules are typically registered during the **bootstrap (`boot()`) phase** of a given module, or modularized out to a separate registration file (`api/schedules.js`).

## 1. Implement & Register the Schedule

```javascript
// @apps/billing/api/index.js
export default {
  // ...
  async boot({ container }) {
    const schedule = container.resolve('schedule');
    const { Invoice } = container.resolve('models');

    // Destructure { signal } from the callback argument!
    schedule.register('billing:invoice-reminders', '0 0 * * *', async ({ signal }) => {
       console.info('Running invoice routine...');
       
       // Pass it into async processes to safely Abort on SIGTERM
       const dueInvoices = await Invoice.findAll({
         where: { status: 'due' }
       }, { signal }); 
       
       // Note: To prevent Event-Loop exhaustion on heavy jobs, dispatch to Queue!
    });
  }
}
```

## 2. Core Best Practices

### A. Native `AbortSignal` Capability
Our custom Schedule Engine wrapper creates unique `AbortController` maps for every job tick. Always destructure `{ signal }` in the cron handler and pass it into operations like:
- Sequelize ORM `findAll({ transaction, signal })`
- JavaScript DOM HTTP requests `fetch(url, { signal })`
This will automatically terminate query workloads if a runtime Extension is deactivated or the Node.js process gracefully shuts down via `SIGTERM`.

### B. Offloading Heavy Workloads
Schedules execute sequentially. DO NOT process heavy blocking tasks synchronously inside the schedule handler. Instead, dispatch that instruction batch to the **Queue Engine**.
```javascript
schedule.register('marketing:batch-emails', '0 6 * * *', async () => {
  const queue = container.resolve('queue');
  
  // Handlers return instantly while dedicated Queue limits CPU back-pressure 
  await queue('marketing').publish('dispatch-emails', { batchId: 'morning-batch' });
});
```

### C. System Architecture Guarantees
- **Overlap Protection**: The engine maintains isolated `isExecuting` mutexes. If your task triggers every 1 minute but takes 1.5 minutes to resolve an API endpoint, the redundant subsequent tick is suppressed to prevent state overlap.
- **Graceful Timeouts**: When `SIGTERM`/`SIGINT` fires, the schedule manager awaits your async Promises up to *5000ms* using `Promise.allSettled`. It also cancels the task signals dynamically natively tracking memory allocations safely across the event-loop.

## 3. Testing Schedules

Unit Testing should verify that your module physically registered its schedules and that it delegates calls properly:

```javascript
// @apps/billing/api/index.test.js
import billingApp from './index';

describe('Billing Module Schedules', () => {
   it('should register daily invoice cron correctly on boot', async () => {
       const mockSchedule = { register: jest.fn() };
       const mockModels = { Invoice: {} };
       
       const container = { 
          resolve: (key) => key === 'schedule' ? mockSchedule : mockModels 
       };
       
       await billingApp.boot({ container });
       
       expect(mockSchedule.register).toHaveBeenCalledWith(
          'billing:invoice-reminders',
          '0 0 * * *', // Daily at Midnight
          expect.any(Function),
       );
   });
});
```

---

## See Also
- `/add-worker` — For building the offline thread pools parsing the data your schedule invokes.
- `/add-engine` — For reference constructing similar wrapper engines.
