import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalApiPort = process.env.API_PORT;
const originalDocumentsPort = process.env.DOCUMENTS_PORT;
const originalDocumentProcessingPort = process.env.DOCUMENT_PROCESSING_PORT;
const originalWebPort = process.env.WEB_PORT;

type PortEnvName = 'API_PORT' | 'DOCUMENTS_PORT' | 'DOCUMENT_PROCESSING_PORT' | 'WEB_PORT';

function restoreEnv(name: PortEnvName, value: string | undefined) {
    if (value === undefined) {
        delete process.env[name];
        return;
    }

    process.env[name] = value;
}

async function loadRuntimeConfig() {
    return import('../src/index');
}

describe('runtimeConfig', () => {
    beforeEach(() => {
        vi.resetModules();
        delete process.env.API_PORT;
        delete process.env.DOCUMENTS_PORT;
        delete process.env.DOCUMENT_PROCESSING_PORT;
        delete process.env.WEB_PORT;
    });

    afterEach(() => {
        restoreEnv('API_PORT', originalApiPort);
        restoreEnv('DOCUMENTS_PORT', originalDocumentsPort);
        restoreEnv('DOCUMENT_PROCESSING_PORT', originalDocumentProcessingPort);
        restoreEnv('WEB_PORT', originalWebPort);
    });

    it('uses default ports when shared environment variables are absent', async () => {
        const { runtimeConfig } = await loadRuntimeConfig();

        expect(runtimeConfig).toEqual({
            api: { port: 3000 },
            documents: { port: 3001 },
            documentProcessing: { port: 3002 },
            web: { port: 4200 },
        });
    });

    it('coerces valid environment overrides to numeric ports', async () => {
        process.env.API_PORT = '3100';
        process.env.DOCUMENTS_PORT = '3101';
        process.env.DOCUMENT_PROCESSING_PORT = '3102';
        process.env.WEB_PORT = '4300';

        const { runtimeConfig } = await loadRuntimeConfig();

        expect(runtimeConfig.api.port).toBe(3100);
        expect(runtimeConfig.documents.port).toBe(3101);
        expect(runtimeConfig.documentProcessing.port).toBe(3102);
        expect(runtimeConfig.web.port).toBe(4300);
    });

    it('keeps PortSchema publicly reusable', async () => {
        const { PortSchema } = await loadRuntimeConfig();

        expect(PortSchema.parse('5432')).toBe(5432);
    });

    it.each(['0', '-1', '65536', '1.5', 'not-a-port'])(
        'rejects invalid API_PORT value %s',
        async (value) => {
            process.env.API_PORT = value;

            await expect(loadRuntimeConfig()).rejects.toThrow();
        },
    );

    it('rejects an invalid DOCUMENTS_PORT value', async () => {
        process.env.DOCUMENTS_PORT = '65536';

        await expect(loadRuntimeConfig()).rejects.toThrow();
    });

    it('rejects an invalid DOCUMENT_PROCESSING_PORT value', async () => {
        process.env.DOCUMENT_PROCESSING_PORT = '65536';

        await expect(loadRuntimeConfig()).rejects.toThrow();
    });

    it('rejects an invalid WEB_PORT value', async () => {
        process.env.WEB_PORT = '65536';

        await expect(loadRuntimeConfig()).rejects.toThrow();
    });
});
