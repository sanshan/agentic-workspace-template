import { tenantName, type TenantId, type TenantReference } from '@agentic-workspace/core';
import type {
    EventHandler,
    EventHandlerOutcome,
    EventIdentity,
    EventValidationFailure,
} from '@agentic-workspace/runtime-messaging';
import {
    DefaultActorFactory,
    type Actor,
    type ActorOrigin,
    type ActorType,
} from '@event-driven-platform/actor';
import type { AnyEventEnvelope, EventActor } from '@event-driven-platform/event';
import { IntentFactory } from '@event-driven-platform/intent';
import { DefaultTenantReferenceFactory } from '@event-driven-platform/tenant-reference';
import type { UseCase } from '@event-driven-platform/use-case';
import type { UseCaseExecutor } from '@event-driven-platform/use-case-executor';
import { ZodError } from 'zod';

import type { EventSubscriptionContext } from './event-subscription-context.js';

export interface EventContractLike<TEvent = unknown> {
    readonly name: string;
    readonly schemaVersion: number;
    parse(value: unknown): TEvent;
}

export type ParsedEvent<TContract extends EventContractLike> = ReturnType<TContract['parse']>;

type EventSubscriptionUseCase<TInput, TResult> = Omit<
    UseCase<TInput, TResult, EventSubscriptionContext>,
    'execute'
> & {
    readonly execute: (
        input: TInput,
        context: EventSubscriptionContext,
    ) => Promise<TResult>;
};

export type CreateSubscriptionArgument<TEvent, TInput, TResult> = {
    readonly contract: EventContractLike<TEvent>;
    readonly useCase: EventSubscriptionUseCase<TInput, TResult>;
    readonly intentSlot: string;
    readonly mapInput: (event: TEvent) => NoInfer<TInput>;
};

export interface EventSubscription {
    readonly identity: EventIdentity;
    readonly intentSlot: string;
    createHandler(executor: UseCaseExecutor): EventHandler;
}

const actorFactory = new DefaultActorFactory();
const tenantReferenceFactory = new DefaultTenantReferenceFactory();
const intentSlotValidationParentId = '00000000-0000-4000-8000-000000000000';

function assertValidIntentSlot(intentSlot: string): void {
    IntentFactory.derive({
        parent: { id: intentSlotValidationParentId },
        slot: intentSlot,
    });
}

function createValidationFailure(
    path: readonly string[],
    message: string,
): EventValidationFailure {
    return {
        kind: 'event-validation',
        issues: [{ path, message }],
    };
}

function createZodValidationFailure(
    error: ZodError,
    prefix: readonly string[],
): EventValidationFailure {
    return {
        kind: 'event-validation',
        issues: error.issues.map((issue) => ({
            path: [...prefix, ...issue.path.map(String)],
            message: issue.message,
        })),
    };
}

function createIntentValidationFailure(error: ZodError): EventValidationFailure | undefined {
    const issues: EventValidationFailure['issues'][number][] = [];

    for (const issue of error.issues) {
        const path = issue.path.map(String);

        if (path[0] === 'parent' && path[1] === 'id') {
            issues.push({
                path: ['intentId', ...path.slice(2)],
                message: issue.message,
            });
            continue;
        }

        if (path[0] === 'discriminator') {
            issues.push({
                path: ['eventId', ...path.slice(1)],
                message: issue.message,
            });
            continue;
        }

        return undefined;
    }

    return {
        kind: 'event-validation',
        issues,
    };
}

function invalid(failure: EventValidationFailure): EventHandlerOutcome {
    return {
        status: 'invalid',
        failure,
    };
}

function adaptActorOrigin(origin: EventActor['origin']): ActorOrigin {
    return {
        ...(origin.ipAddress === null ? {} : { ipAddress: origin.ipAddress }),
        ...(origin.countryCode === null ? {} : { countryCode: origin.countryCode }),
        ...(origin.region === null ? {} : { region: origin.region }),
        ...(origin.city === null ? {} : { city: origin.city }),
        ...(origin.latitude === null ? {} : { latitude: origin.latitude }),
        ...(origin.longitude === null ? {} : { longitude: origin.longitude }),
        ...(origin.timezone === null ? {} : { timezone: origin.timezone }),
        ...(origin.environment === null ? {} : { environment: origin.environment }),
        ...(origin.host === null ? {} : { host: origin.host }),
        ...(origin.instance === null ? {} : { instance: origin.instance }),
    };
}

type ActorAdaptation =
    | {
          readonly status: 'valid';
          readonly value: Actor;
      }
    | {
          readonly status: 'invalid';
          readonly failure: EventValidationFailure;
      };

function adaptActor(actor: EventActor): ActorAdaptation {
    try {
        return {
            status: 'valid',
            value: actorFactory.create({
                type: actor.type as ActorType,
                id: actor.id,
                origin: adaptActorOrigin(actor.origin),
            }),
        };
    } catch (error) {
        if (error instanceof ZodError) {
            return {
                status: 'invalid',
                failure: createZodValidationFailure(error, ['actor']),
            };
        }

        throw error;
    }
}

type TenantAdaptation =
    | {
          readonly status: 'valid';
          readonly value: TenantReference;
      }
    | {
          readonly status: 'invalid';
          readonly failure: EventValidationFailure;
      };

function adaptTenant(tenant: AnyEventEnvelope['tenant']): TenantAdaptation {
    if (tenant.type !== tenantName) {
        return {
            status: 'invalid',
            failure: createValidationFailure(
                ['tenant', 'type'],
                `Expected tenant type "${tenantName}".`,
            ),
        };
    }

    try {
        return {
            status: 'valid',
            value: tenantReferenceFactory.create({
                type: tenantName,
                id: tenant.id as TenantId,
            }),
        };
    } catch (error) {
        if (error instanceof ZodError) {
            return {
                status: 'invalid',
                failure: createZodValidationFailure(error, ['tenant']),
            };
        }

        throw error;
    }
}

function createSubscriptionHandler<TEvent, TInput, TResult>(options: {
    readonly identity: EventIdentity;
    readonly intentSlot: string;
    readonly contract: EventContractLike<TEvent>;
    readonly useCase: EventSubscriptionUseCase<TInput, TResult>;
    readonly mapInput: (event: TEvent) => TInput;
    readonly executor: UseCaseExecutor;
}): EventHandler {
    return {
        identity: options.identity,
        async handle(envelope) {
            let event: TEvent;

            try {
                event = options.contract.parse({
                    name: envelope.eventName,
                    schemaVersion: envelope.schemaVersion,
                    payload: envelope.payload,
                });
            } catch (error) {
                if (error instanceof ZodError) {
                    return invalid(createZodValidationFailure(error, ['payload']));
                }

                throw error;
            }

            const actor = adaptActor(envelope.actor);
            if (actor.status === 'invalid') {
                return invalid(actor.failure);
            }

            const tenant = adaptTenant(envelope.tenant);
            if (tenant.status === 'invalid') {
                return invalid(tenant.failure);
            }

            let intent: ReturnType<typeof IntentFactory.derive>;

            try {
                intent = IntentFactory.derive({
                    parent: { id: envelope.intentId },
                    slot: options.intentSlot,
                    discriminator: envelope.eventId,
                });
            } catch (error) {
                if (error instanceof ZodError) {
                    const failure = createIntentValidationFailure(error);

                    if (failure !== undefined) {
                        return invalid(failure);
                    }
                }

                throw error;
            }

            const input = options.mapInput(event);
            const context = Object.freeze({
                intent,
                correlationId: envelope.correlationId,
                actor: actor.value,
                tenant: tenant.value,
            }) satisfies EventSubscriptionContext;

            const result = await options.executor.execute({
                useCase: options.useCase,
                input,
                context,
            });

            return {
                status: 'handled' as const,
                result,
            };
        },
    };
}

export function createSubscription<TEvent, TInput, TResult>(
    options: CreateSubscriptionArgument<TEvent, TInput, TResult>,
): EventSubscription {
    assertValidIntentSlot(options.intentSlot);

    const identity = Object.freeze({
        eventName: options.contract.name,
        schemaVersion: options.contract.schemaVersion,
    }) satisfies EventIdentity;

    return Object.freeze({
        identity,
        intentSlot: options.intentSlot,
        createHandler: (executor: UseCaseExecutor) =>
            createSubscriptionHandler({
                identity,
                intentSlot: options.intentSlot,
                contract: options.contract,
                useCase: options.useCase,
                mapInput: options.mapInput,
                executor,
            }),
    });
}

function assertUniqueIntentSlots(subscriptions: readonly EventSubscription[]): void {
    const slots = new Set<string>();

    for (const subscription of subscriptions) {
        if (slots.has(subscription.intentSlot)) {
            throw new Error(`Duplicate event subscription intent slot "${subscription.intentSlot}".`);
        }

        slots.add(subscription.intentSlot);
    }
}

export function createEventHandlers(
    subscriptions: readonly EventSubscription[],
    executor: UseCaseExecutor,
): readonly EventHandler[] {
    assertUniqueIntentSlots(subscriptions);

    return subscriptions.map((subscription) => subscription.createHandler(executor));
}
