import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/packages/runtime-health',
    test: {
        name: '@agentic-workspace/runtime-health',
        watch: false,
        globals: true,
        environment: 'jsdom',
        include: ['src/**/*.integration.spec.ts'],
        reporters: ['default'],
        coverage: {
            reportsDirectory: './test-output/vitest/coverage',
            provider: 'v8' as const,
        },
    },
}));
