import 'reflect-metadata';

import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import type { EventHandler } from '../event-handler.js';
import { EventHandlerRegistry } from '../event-handler-registry.js';
import { EventIngress } from '../event-ingress.js';
import { createEventEnvelope } from '../testing/event-envelope.fixture.js';
import { RuntimeMessagingModule } from './runtime-messaging.module.js';

const firstHandler: EventHandler = {
    identity: {
        eventName: 'first.event',
        schemaVersion: 1,
    },
    handle: vi.fn(async () => ({ status: 'handled' as const, result: 'first' })),
};

const secondHandler: EventHandler = {
    identity: {
        eventName: 'second.event',
        schemaVersion: 2,
    },
    handle: vi.fn(async () => ({ status: 'handled' as const, result: 'second' })),
};

@Injectable()
class AsyncFirstRegistrar implements OnModuleInit {
    public constructor(public readonly registry: EventHandlerRegistry) {}

    public async onModuleInit(): Promise<void> {
        await Promise.resolve();
        this.registry.register(firstHandler);
    }
}

@Injectable()
class SecondRegistrar implements OnModuleInit {
    public constructor(public readonly registry: EventHandlerRegistry) {}

    public onModuleInit(): void {
        this.registry.register(secondHandler);
    }
}

@Module({
    imports: [RuntimeMessagingModule],
    providers: [AsyncFirstRegistrar],
})
class FirstRegistrationModule {}

@Module({
    imports: [RuntimeMessagingModule],
    providers: [SecondRegistrar],
})
class SecondRegistrationModule {}

@Module({
    imports: [FirstRegistrationModule, SecondRegistrationModule, RuntimeMessagingModule],
})
class TestHostModule {}

const duplicateHandler: EventHandler = {
    identity: {
        eventName: 'duplicate.event',
        schemaVersion: 1,
    },
    handle: vi.fn(async () => ({ status: 'handled' as const, result: undefined })),
};

@Injectable()
class FirstDuplicateRegistrar implements OnModuleInit {
    public constructor(private readonly registry: EventHandlerRegistry) {}

    public onModuleInit(): void {
        this.registry.register(duplicateHandler);
    }
}

@Injectable()
class SecondDuplicateRegistrar implements OnModuleInit {
    public constructor(private readonly registry: EventHandlerRegistry) {}

    public onModuleInit(): void {
        this.registry.register({
            ...duplicateHandler,
            handle: vi.fn(async () => ({ status: 'handled' as const, result: undefined })),
        });
    }
}

@Module({
    imports: [RuntimeMessagingModule],
    providers: [FirstDuplicateRegistrar, SecondDuplicateRegistrar],
})
class DuplicateHostModule {}

async function createInitializedHost(): Promise<TestingModule> {
    const moduleRef = await Test.createTestingModule({ imports: [TestHostModule] }).compile();
    await moduleRef.init();
    return moduleRef;
}

describe('RuntimeMessagingModule', () => {
    it('shares one registry across importing modules and seals after async registration completes', async () => {
        const moduleRef = await Test.createTestingModule({ imports: [TestHostModule] }).compile();
        const registry = moduleRef.get(EventHandlerRegistry);
        const ingress = moduleRef.get(EventIngress);
        const firstRegistrar = moduleRef.get(AsyncFirstRegistrar);
        const secondRegistrar = moduleRef.get(SecondRegistrar);

        expect(firstRegistrar.registry).toBe(registry);
        expect(secondRegistrar.registry).toBe(registry);
        expect(registry.isSealed).toBe(false);
        await expect(ingress.dispatch(createEventEnvelope())).rejects.toThrow(
            'Event handler registry is not sealed.',
        );

        await moduleRef.init();

        expect(registry.isSealed).toBe(true);
        expect(registry.resolve(firstHandler.identity)).toEqual({
            status: 'resolved',
            handler: firstHandler,
        });
        expect(registry.resolve(secondHandler.identity)).toEqual({
            status: 'resolved',
            handler: secondHandler,
        });

        await moduleRef.close();
    });

    it('isolates registry instances between Nest application contexts', async () => {
        const firstApp = await createInitializedHost();
        const secondApp = await createInitializedHost();

        expect(firstApp.get(EventHandlerRegistry)).not.toBe(secondApp.get(EventHandlerRegistry));
        expect(firstApp.get(EventIngress)).not.toBe(secondApp.get(EventIngress));

        await firstApp.close();
        await secondApp.close();
    });

    it('cannot seal or dispatch after duplicate registration fails during initialization', async () => {
        const moduleRef = await Test.createTestingModule({ imports: [DuplicateHostModule] }).compile();
        const registry = moduleRef.get(EventHandlerRegistry);
        const ingress = moduleRef.get(EventIngress);

        await expect(moduleRef.init()).rejects.toThrow(
            'Duplicate Event handler registration for "duplicate.event" schema version 1.',
        );
        expect(registry.isSealed).toBe(false);
        await expect(
            ingress.dispatch(
                createEventEnvelope({
                    eventName: 'duplicate.event',
                    schemaVersion: 1,
                }),
            ),
        ).rejects.toThrow('Event handler registry is not sealed.');
    });
});
