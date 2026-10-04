import { tenantName } from './tenant/name.js';

describe('core identities', () => {
    it('exposes stable domain names', () => {
        expect(tenantName).toBe('tenant');
    });
});
