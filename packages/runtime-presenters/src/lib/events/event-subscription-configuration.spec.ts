import { defineEventContract } from '@event-driven-platform/event';
import type { UseCase } from '@event-driven-platform/use-case';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { EventSubscriptionContext } from './event-subscription-context.js';
import { createSubscription } from './event-subscription.js';

const fixtureContract = defineEventContract({
    name: 'fixture.configured',
    schemaVersion: 1,
    payload: z.object({ value: z.string() }),
});

type FixtureInput = { readonly value: string };
type FixtureResult = { readonly status: 'ok' };

class FixtureUseCase implements UseCase<FixtureInput, FixtureResult, EventSubscriptionContext> {
    public readonly name = 'fixture.configure';

    public async execute(): Promise<FixtureResult> {
        return { status: 'ok' };
    }
}

function createFixtureSubscription(intentSlot: string) {
    return createSubscription({
        contract: fixtureContract,
        useCase: new FixtureUseCase(),
        intentSlot,
        mapInput: (event) => ({ value: event.payload.value }),
    });
}

describe('event subscription configuration', () => {
    it('rejects a malformed intent slot while constructing the subscription', () => {
        expect(() => createFixtureSubscription('processDocument')).toThrow();
    });

    it('accepts a canonical intent slot without registering or invoking anything', () => {
        expect(createFixtureSubscription('process-document').intentSlot).toBe('process-document');
    });
});
