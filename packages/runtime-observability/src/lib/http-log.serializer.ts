export interface SerializedHttpRequestLog {
    readonly method?: string;
    readonly url?: string;
    readonly id?: string | number;
}

export interface SerializedHttpResponseLog {
    readonly statusCode?: number;
}

export function serializeHttpRequestForLog(value: unknown): SerializedHttpRequestLog {
    if (!isRecord(value)) {
        return {};
    }

    const serialized: {
        method?: string;
        url?: string;
        id?: string | number;
    } = {};

    if (typeof value.method === 'string') {
        serialized.method = value.method;
    }

    if (typeof value.url === 'string') {
        serialized.url = value.url;
    }

    if (typeof value.id === 'string' || typeof value.id === 'number') {
        serialized.id = value.id;
    }

    return serialized;
}

export function serializeHttpResponseForLog(value: unknown): SerializedHttpResponseLog {
    if (!isRecord(value) || typeof value.statusCode !== 'number') {
        return {};
    }

    return {
        statusCode: value.statusCode,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
