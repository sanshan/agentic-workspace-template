import { z } from 'zod';

export const PortSchema = z.coerce.number().int().min(1).max(65535);

const RuntimeEnvSchema = z.object({
    API_PORT: PortSchema.default(3000),
    DOCUMENTS_PORT: PortSchema.default(3001),
    DOCUMENT_PROCESSING_PORT: PortSchema.default(3002),
    WEB_PORT: PortSchema.default(4200),
});

const runtimeEnv = RuntimeEnvSchema.parse(process.env);

export const runtimeConfig = Object.freeze({
    api: Object.freeze({
        port: runtimeEnv.API_PORT,
    }),
    documents: Object.freeze({
        port: runtimeEnv.DOCUMENTS_PORT,
    }),
    documentProcessing: Object.freeze({
        port: runtimeEnv.DOCUMENT_PROCESSING_PORT,
    }),
    web: Object.freeze({
        port: runtimeEnv.WEB_PORT,
    }),
});
