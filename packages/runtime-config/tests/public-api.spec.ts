import { describe, expect, it } from 'vitest';

import * as runtimeConfigPackage from '../src/index';

describe('runtime-config public API', () => {
    it('exports the validated runtime config and reusable port schema only', () => {
        expect(runtimeConfigPackage).toHaveProperty('PortSchema');
        expect(runtimeConfigPackage).toHaveProperty('runtimeConfig');
        expect(runtimeConfigPackage).not.toHaveProperty('PortsEnvSchema');
    });
});
