import { trace, TraceFlags, type Span } from '@opentelemetry/api';

import { getActiveTraceLogFields } from './trace-context.js';

describe('getActiveTraceLogFields', () => {
    it('returns trace and span ids from the active OpenTelemetry span', () => {
        const traceId = '0123456789abcdef0123456789abcdef';
        const spanId = '0123456789abcdef';
        const activeSpan = {
            spanContext: () => ({
                traceId,
                spanId,
                traceFlags: TraceFlags.SAMPLED,
            }),
        } as unknown as Span;
        const getActiveSpan = vi
            .spyOn(trace, 'getActiveSpan')
            .mockReturnValue(activeSpan);

        expect(getActiveTraceLogFields()).toEqual({ traceId, spanId });

        getActiveSpan.mockRestore();
    });
});
