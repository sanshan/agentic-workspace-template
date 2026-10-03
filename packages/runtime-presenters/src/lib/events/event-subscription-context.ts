import type { TenantReference } from '@agentic-workspace/core';
import type { Actor } from '@event-driven-platform/actor';
import type { UseCaseContext } from '@event-driven-platform/use-case';

export interface EventSubscriptionContext extends UseCaseContext {
    readonly actor: Actor;
    readonly tenant: TenantReference;
}
