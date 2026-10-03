import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: 'runtime-config',
        watch: false,
        environment: 'node',
        include: ['tests/**/*.{test,spec}.ts'],
        coverage: {
            reportsDirectory: './test-output/vitest/coverage',
            provider: 'v8',
        },
    },
});
