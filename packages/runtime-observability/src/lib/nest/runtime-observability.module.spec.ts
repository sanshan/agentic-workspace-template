import { Test } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { RuntimeTelemetry } from '../runtime-telemetry.js';
import { RuntimeObservabilityModule } from './runtime-observability.module.js';

describe('RuntimeObservabilityModule', () => {
    it('composes the shared Nest/Pino logger', async () => {
        const testingModule = await Test.createTestingModule({
            imports: [
                RuntimeObservabilityModule.register({
                    service: {
                        name: 'test-service',
                        version: '1.0.0',
                        environment: 'test',
                    },
                }),
            ],
        }).compile();

        expect(await testingModule.resolve(PinoLogger)).toBeDefined();

        await testingModule.close();
    });

    it('composes the optional shared OpenTelemetry runtime', async () => {
        const testingModule = await Test.createTestingModule({
            imports: [
                RuntimeObservabilityModule.register({
                    service: {
                        name: 'test-service',
                        version: '1.0.0',
                        environment: 'test',
                    },
                    telemetry: {},
                }),
            ],
        }).compile();

        expect(testingModule.get(RuntimeTelemetry)).toBeDefined();

        await testingModule.close();
    });
});
