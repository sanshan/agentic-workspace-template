export function createEventEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        eventId: 'event-1',
        eventName: 'test.event',
        schemaVersion: 1,
        occurredAt: '2026-09-13T18:00:00.000Z',
        intentId: 'intent-1',
        correlationId: 'correlation-1',
        operationName: 'TestOperation',
        tenant: {
            type: 'account',
            id: 'tenant-1',
        },
        actor: {
            type: 'system',
            id: 'test-service',
            origin: {
                ipAddress: null,
                countryCode: null,
                region: null,
                city: null,
                latitude: null,
                longitude: null,
                timezone: null,
                environment: 'test',
                host: 'test-host',
                instance: 'test-instance',
            },
        },
        subject: {
            type: 'user',
            id: 'user-1',
        },
        aggregate: {
            type: 'test-aggregate',
            id: 'aggregate-1',
        },
        payload: {
            arbitrary: ['payload'],
        },
        ...overrides,
    };
}
