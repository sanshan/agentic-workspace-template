import { isSpanContextValid, trace } from '@opentelemetry/api';

export interface ActiveTraceLogFields {
    readonly traceId: string;
    readonly spanId: string;
}

export function getActiveTraceLogFields(): ActiveTraceLogFields | undefined {
    const span = trace.getActiveSpan();

    if (!span) {
        return undefined;
    }

    const spanContext = span.spanContext();

    if (!isSpanContextValid(spanContext)) {
        return undefined;
    }

    return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
    };
}
