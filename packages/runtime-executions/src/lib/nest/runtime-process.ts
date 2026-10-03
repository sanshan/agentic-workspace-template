import { randomUUID } from 'node:crypto';

import type { ExecutionLeaseOwnerId } from '@event-driven-platform/execution';

export class RuntimeProcess {
    public readonly leaseOwnerId = randomUUID() as ExecutionLeaseOwnerId;
}
