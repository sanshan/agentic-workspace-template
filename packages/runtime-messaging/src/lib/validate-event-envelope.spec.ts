import { describe, expect, it } from 'vitest';

import { createEventEnvelope } from './testing/event-envelope.fixture.js';
import { validateEventEnvelope } from './validate-event-envelope.js';

describe('validateEventEnvelope', () => {
    it('preserves a structurally valid full envelope and arbitrary payload', () => {
        const envelope = createEventEnvelope({
            payload: {
                nested: ['anything', 42, null],
            },
            producerExtension: {
                preserved: true,
            },
        });

        const result = validateEventEnvelope(envelope);

        expect(result).toEqual({
            status: 'valid',
            value: envelope,
        });

        if (result.status === 'valid') {
            expect(result.value).toBe(envelope);
        }
    });

    it.each([
        ['eventName', createEventEnvelope({ eventName: 42 })],
        ['schemaVersion', createEventEnvelope({ schemaVersion: '1' })],
        ['tenant.id', createEventEnvelope({ tenant: { type: 'account', id: 42 } })],
        [
            'actor.origin.latitude',
            createEventEnvelope({
                actor: {
                    type: 'system',
                    id: 'test-service',
                    origin: {
                        ipAddress: null,
                        countryCode: null,
                        region: null,
                        city: null,
                        latitude: 'unknown',
                        longitude: null,
                        timezone: null,
                        environment: 'test',
                        host: 'test-host',
                        instance: 'test-instance',
                    },
                },
            }),
        ],
    ])('rejects malformed required metadata at %s', (path, envelope) => {
        const result = validateEventEnvelope(envelope);

        expect(result.status).toBe('invalid');

        if (result.status === 'invalid') {
            expect(result.failure.kind).toBe('event-validation');
            expect(result.failure.issues.map((issue) => issue.path.join('.'))).toContain(path);
        }
    });

    it('requires the payload field without validating its business content', () => {
        const missingPayload = createEventEnvelope();
        delete missingPayload['payload'];

        expect(validateEventEnvelope(missingPayload)).toMatchObject({
            status: 'invalid',
            failure: {
                kind: 'event-validation',
                issues: [{ path: ['payload'] }],
            },
        });

        expect(validateEventEnvelope(createEventEnvelope({ payload: undefined })).status).toBe('valid');
    });
});
