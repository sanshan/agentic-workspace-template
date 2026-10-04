import { validateEventEnvelope } from '@agentic-workspace/runtime-messaging';
import { defineEventContract } from '@event-driven-platform/event';
import { ExecutionFailureError } from '@event-driven-platform/execution';
import { IntentFactory } from '@event-driven-platform/intent';
import type { UseCase, UseCaseContext } from '@event-driven-platform/use-case';
import type {
    UseCaseExecutionRequest,
    UseCaseExecutor,
} from '@event-driven-platform/use-case-executor';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { EventSubscriptionContext } from './event-subscription-context.js';
import { createEventHandlers, createSubscription } from './event-subscription.js';

const fixtureContract = defineEventContract({
    name: 'fixture.registered',
    schemaVersion: 1,
    payload: z.object({
        documentId: z.string(),
        sequence: z.string().transform((value) => Number(value)),
    }),
});

type FixtureEvent = ReturnType<typeof fixtureContract.parse>;

interface FixtureInput {
    readonly documentId: string;
    readonly sequence: number;
}

type FixtureResult =
    | { readonly status: 'ok' }
    | { readonly status: 'business-failure'; readonly reason: string };

class FixtureUseCase implements UseCase<FixtureInput, FixtureResult, EventSubscriptionContext> {
    public readonly name = 'fixture.process';

    public readonly calls: Array<{
        readonly input: FixtureInput;
        readonly context: EventSubscriptionContext;
    }> = [];

    public constructor(private readonly result: FixtureResult = { status: 'ok' }) {}

    public async execute(
        input: FixtureInput,
        context: EventSubscriptionContext,
    ): Promise<FixtureResult> {
        this.calls.push({ input, context });
        return this.result;
    }
}

class RecordingExecutor implements UseCaseExecutor {
    public readonly requests: unknown[] = [];

    public execute<TInput, TResult, TContext extends UseCaseContext = UseCaseContext>(
        request: UseCaseExecutionRequest<TInput, TResult, TContext>,
    ): Promise<TResult> {
        this.requests.push(request);
        return request.useCase.execute(request.input, request.context);
    }
}

class ThrowingExecutor implements UseCaseExecutor {
    public constructor(private readonly failure: unknown) {}

    public async execute<TInput, TResult, TContext extends UseCaseContext = UseCaseContext>(
        _request: UseCaseExecutionRequest<TInput, TResult, TContext>,
    ): Promise<TResult> {
        throw this.failure;
    }
}

function createActor(type = 'service'): Record<string, unknown> {
    return {
        type,
        id: 'documents-service',
        origin: {
            ipAddress: null,
            countryCode: 'RS',
            region: null,
            city: null,
            latitude: null,
            longitude: null,
            timezone: null,
            environment: null,
            host: null,
            instance: null,
        },
    };
}

function createEnvelope(overrides: Readonly<Record<string, unknown>> = {}) {
    const validation = validateEventEnvelope({
        eventId: 'event-1',
        eventName: fixtureContract.name,
        schemaVersion: fixtureContract.schemaVersion,
        occurredAt: '2026-09-13T18:00:00.000Z',
        intentId: 'parent-intent',
        correlationId: 'correlation-1',
        operationName: 'documents.register',
        tenant: { type: 'tenant', id: 'tenant-1' },
        actor: createActor(),
        subject: { type: 'document', id: 'document-1' },
        aggregate: { type: 'document', id: 'document-1' },
        payload: { documentId: 'document-1', sequence: '7' },
        ...overrides,
    });

    if (validation.status === 'invalid') {
        throw new Error('Fixture envelope must satisfy structural validation.');
    }

    return validation.value;
}

function createFixtureSubscription(
    useCase: FixtureUseCase,
    mapInput: (event: FixtureEvent) => FixtureInput = (event) => ({
        documentId: event.payload.documentId,
        sequence: event.payload.sequence,
    }),
) {
    return createSubscription({
        contract: fixtureContract,
        useCase,
        intentSlot: 'process-document',
        mapInput,
    });
}

function getOnlyHandler(useCase: FixtureUseCase, executor: UseCaseExecutor) {
    const handlers = createEventHandlers([createFixtureSubscription(useCase)], executor);
    const handler = handlers[0];

    if (handler === undefined) {
        throw new Error('Expected one event handler.');
    }

    return handler;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('event subscriptions', () => {
    it('creates a pure subscription whose handler identity comes from the contract', () => {
        const useCase = new FixtureUseCase();
        const subscription = createFixtureSubscription(useCase);

        expect(subscription.identity).toEqual({
            eventName: fixtureContract.name,
            schemaVersion: fixtureContract.schemaVersion,
        });
        expect(subscription.intentSlot).toBe('process-document');
        expect(useCase.calls).toHaveLength(0);
    });

    it('parses the business event, maps only the parsed event and executes with adapted context', async () => {
        const useCase = new FixtureUseCase();
        const executor = new RecordingExecutor();
        let mappedEvent: FixtureEvent | undefined;
        const subscription = createFixtureSubscription(useCase, (event) => {
            mappedEvent = event;
            return {
                documentId: event.payload.documentId,
                sequence: event.payload.sequence,
            };
        });
        const handlers = createEventHandlers([subscription], executor);
        const handler = handlers[0];

        if (handler === undefined) {
            throw new Error('Expected one event handler.');
        }

        await expect(handler.handle(createEnvelope())).resolves.toEqual({
            status: 'handled',
            result: { status: 'ok' },
        });
        expect(mappedEvent).toEqual({
            name: fixtureContract.name,
            schemaVersion: fixtureContract.schemaVersion,
            payload: {
                documentId: 'document-1',
                sequence: 7,
            },
        });
        expect(executor.requests).toHaveLength(1);
        expect(executor.requests[0]).toMatchObject({
            useCase,
            input: {
                documentId: 'document-1',
                sequence: 7,
            },
            context: {
                correlationId: 'correlation-1',
                actor: {
                    type: 'service',
                    id: 'documents-service',
                    origin: {
                        countryCode: 'RS',
                    },
                },
                tenant: {
                    type: 'tenant',
                    id: 'tenant-1',
                },
            },
        });
    });

    it('returns payload validation failure before mapping or execution', async () => {
        const useCase = new FixtureUseCase();
        const executor = new RecordingExecutor();
        const mapInput = vi.fn((_event: FixtureEvent): FixtureInput => ({
            documentId: 'unused',
            sequence: 0,
        }));
        const subscription = createFixtureSubscription(useCase, mapInput);
        const handler = createEventHandlers([subscription], executor)[0];

        if (handler === undefined) {
            throw new Error('Expected one event handler.');
        }

        await expect(
            handler.handle(
                createEnvelope({
                    payload: { documentId: 'document-1', sequence: 7 },
                }),
            ),
        ).resolves.toMatchObject({
            status: 'invalid',
            failure: {
                kind: 'event-validation',
                issues: [
                    {
                        path: ['payload', 'sequence'],
                    },
                ],
            },
        });
        expect(mapInput).not.toHaveBeenCalled();
        expect(executor.requests).toHaveLength(0);
        expect(useCase.calls).toHaveLength(0);
    });

    it.each([
        ['actor type', { actor: createActor('external') }, ['actor', 'type']],
        [
            'actor id',
            { actor: { ...createActor(), id: ' documents-service ' } },
            ['actor', 'id'],
        ],
        ['tenant type', { tenant: { type: 'workspace', id: 'tenant-1' } }, ['tenant', 'type']],
        ['tenant id', { tenant: { type: 'tenant', id: ' tenant-1 ' } }, ['tenant', 'id']],
    ])('rejects incompatible application metadata: %s', async (_label, overrides, path) => {
        const useCase = new FixtureUseCase();
        const executor = new RecordingExecutor();
        const mapInput = vi.fn((_event: FixtureEvent): FixtureInput => ({
            documentId: 'unused',
            sequence: 0,
        }));
        const handler = createEventHandlers(
            [createFixtureSubscription(useCase, mapInput)],
            executor,
        )[0];

        if (handler === undefined) {
            throw new Error('Expected one event handler.');
        }

        await expect(handler.handle(createEnvelope(overrides))).resolves.toMatchObject({
            status: 'invalid',
            failure: {
                kind: 'event-validation',
                issues: [{ path }],
            },
        });
        expect(mapInput).not.toHaveBeenCalled();
        expect(executor.requests).toHaveLength(0);
    });

    it.each([
        ['parent intent id', { intentId: ' parent-intent ' }, ['intentId']],
        ['event id discriminator', { eventId: ' event-1 ' }, ['eventId']],
    ])('maps EDP intent validation failures to invalid envelope metadata: %s', async (_label, overrides, path) => {
        const useCase = new FixtureUseCase();
        const executor = new RecordingExecutor();
        const mapInput = vi.fn((_event: FixtureEvent): FixtureInput => ({
            documentId: 'unused',
            sequence: 0,
        }));
        const handler = createEventHandlers(
            [createFixtureSubscription(useCase, mapInput)],
            executor,
        )[0];

        if (handler === undefined) {
            throw new Error('Expected one event handler.');
        }

        await expect(handler.handle(createEnvelope(overrides))).resolves.toMatchObject({
            status: 'invalid',
            failure: {
                kind: 'event-validation',
                issues: [{ path }],
            },
        });
        expect(mapInput).not.toHaveBeenCalled();
        expect(executor.requests).toHaveLength(0);
    });

    it('propagates mapper failures unchanged', async () => {
        const failure = new Error('mapping failed');
        const useCase = new FixtureUseCase();
        const executor = new RecordingExecutor();
        const subscription = createFixtureSubscription(useCase, () => {
            throw failure;
        });
        const handler = createEventHandlers([subscription], executor)[0];

        if (handler === undefined) {
            throw new Error('Expected one event handler.');
        }

        await expect(handler.handle(createEnvelope())).rejects.toBe(failure);
        expect(executor.requests).toHaveLength(0);
    });

    it('preserves classified executor failures unchanged', async () => {
        const failure = new ExecutionFailureError({
            code: 'fixture.failure',
            message: 'fixture failure',
            retryable: true,
        });
        const useCase = new FixtureUseCase();
        const handler = getOnlyHandler(useCase, new ThrowingExecutor(failure));

        await expect(handler.handle(createEnvelope())).rejects.toBe(failure);
        expect(useCase.calls).toHaveLength(0);
    });

    it('preserves unknown executor failures unchanged', async () => {
        const failure = { kind: 'executor-failure' };
        const useCase = new FixtureUseCase();
        const handler = getOnlyHandler(useCase, new ThrowingExecutor(failure));

        await expect(handler.handle(createEnvelope())).rejects.toBe(failure);
        expect(useCase.calls).toHaveLength(0);
    });

    it('treats normally returned business results as handled outcomes', async () => {
        const businessResult: FixtureResult = {
            status: 'business-failure',
            reason: 'not-ready',
        };
        const useCase = new FixtureUseCase(businessResult);
        const handler = getOnlyHandler(useCase, new RecordingExecutor());

        await expect(handler.handle(createEnvelope())).resolves.toEqual({
            status: 'handled',
            result: businessResult,
        });
    });

    it('derives downstream intent only from parent intent, stable slot and event id', async () => {
        const derive = vi.spyOn(IntentFactory, 'derive');
        const useCase = new FixtureUseCase();
        const handler = getOnlyHandler(useCase, new RecordingExecutor());
        derive.mockClear();

        await handler.handle(createEnvelope());
        await handler.handle(createEnvelope());
        await handler.handle(createEnvelope({ eventId: 'event-2' }));

        expect(derive).toHaveBeenNthCalledWith(1, {
            parent: { id: 'parent-intent' },
            slot: 'process-document',
            discriminator: 'event-1',
        });
        expect(derive).toHaveBeenNthCalledWith(2, {
            parent: { id: 'parent-intent' },
            slot: 'process-document',
            discriminator: 'event-1',
        });
        expect(derive).toHaveBeenNthCalledWith(3, {
            parent: { id: 'parent-intent' },
            slot: 'process-document',
            discriminator: 'event-2',
        });
    });

    it('rejects duplicate intent slots before creating a handler collection', () => {
        const first = createFixtureSubscription(new FixtureUseCase());
        const second = createSubscription({
            contract: defineEventContract({
                name: 'fixture.other',
                schemaVersion: 1,
                payload: z.object({ value: z.string() }),
            }),
            useCase: new FixtureUseCase(),
            intentSlot: 'process-document',
            mapInput: () => ({ documentId: 'document-2', sequence: 2 }),
        });

        expect(() => createEventHandlers([first, second], new RecordingExecutor())).toThrow(
            'Duplicate event subscription intent slot "process-document".',
        );
    });
});
