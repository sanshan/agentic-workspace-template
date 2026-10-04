import { readJson, type Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { serviceE2eGenerator } from './service-e2e';

const apiE2eDevDependencies = {
    '@agentic-workspace/runtime-config': 'workspace:*',
    axios: '^1.19.0',
    zod: 'catalog:',
};

function writeServiceProject(tree: Tree, name: string): void {
    const projectName = `@agentic-workspace/${name}-service`;

    writeJson(tree, `apps/services/${name}/project.json`, {
        name: projectName,
        projectType: 'application',
        targets: {
            build: {
                executor: '@nx/js:tsc',
            },
            serve: {
                continuous: true,
                executor: '@nx/js:node',
                defaultConfiguration: 'development',
                options: { buildTarget: `${projectName}:build` },
                configurations: {
                    development: { buildTarget: `${projectName}:build` },
                    production: { buildTarget: `${projectName}:build` },
                },
            },
            'migration:run': {
                executor: 'nx:run-commands',
            },
        },
    });
}

describe('service e2e generator', () => {
    let tree: Tree;

    beforeEach(() => {
        tree = createTreeWithEmptyWorkspace();
        writeJson(tree, 'tools/generators/service-e2e-dependencies.json', {
            name: '@agentic-workspace/api-e2e',
            devDependencies: apiE2eDevDependencies,
        });
        writeServiceProject(tree, 'documents');
    });

    it('creates the canonical Documents service E2E project and runtime support', async () => {
        const callback = await serviceE2eGenerator(tree, { name: 'documents' });

        expect(typeof callback).toBe('function');

        const project = readJson(tree, 'apps/services/documents-e2e/project.json');
        const packageJson = readJson(tree, 'apps/services/documents-e2e/package.json');
        const tsconfig = readJson(tree, 'apps/services/documents-e2e/tsconfig.json');
        const serviceProject = readJson(tree, 'apps/services/documents/project.json');
        const runtimeConfig = tree.read(
            'apps/services/documents-e2e/src/support/runtime-config.ts',
            'utf-8',
        );
        const globalSetup = tree.read(
            'apps/services/documents-e2e/src/support/global-setup.ts',
            'utf-8',
        );
        const testSetup = tree.read(
            'apps/services/documents-e2e/src/support/test-setup.ts',
            'utf-8',
        );
        const jestConfig = tree.read('apps/services/documents-e2e/jest.config.cts', 'utf-8');

        expect(project).toMatchObject({
            name: '@agentic-workspace/documents-service-e2e',
            sourceRoot: 'apps/services/documents-e2e/src',
            projectType: 'application',
            tags: ['type:e2e'],
            implicitDependencies: ['@agentic-workspace/documents-service'],
        });
        expect(project.targets['documents-server']).toMatchObject({
            continuous: true,
            executor: 'nx:run-commands',
            options: {
                command:
                    'pnpm nx run @agentic-workspace/documents-service:migration:run && pnpm nx run @agentic-workspace/documents-service:serve:e2e',
            },
        });
        expect(project.targets.e2e).toMatchObject({
            executor: '@nx/jest:jest',
            options: {
                jestConfig: 'apps/services/documents-e2e/jest.config.cts',
                passWithNoTests: true,
                runInBand: true,
            },
            dependsOn: [
                {
                    projects: ['@agentic-workspace/documents-service-e2e'],
                    target: 'documents-server',
                },
            ],
        });

        expect(serviceProject.targets.serve.configurations).toMatchObject({
            development: { buildTarget: '@agentic-workspace/documents-service:build' },
            production: { buildTarget: '@agentic-workspace/documents-service:build' },
            e2e: {
                buildTarget: '@agentic-workspace/documents-service:build',
                watch: false,
                inspect: false,
                debounce: 0,
            },
        });

        expect(packageJson).toMatchObject({
            name: '@agentic-workspace/documents-service-e2e',
            private: true,
            devDependencies: apiE2eDevDependencies,
        });
        expect(tsconfig).toMatchObject({
            extends: '../../../tsconfig.base.json',
            references: [{ path: '../../../packages/runtime-config' }],
        });
        expect(tsconfig.compilerOptions.noImplicitAny).toBeUndefined();
        expect(runtimeConfig).toContain('runtimeConfig.documents');
        expect(runtimeConfig).toContain('getDocumentsServiceE2eRuntimeConfig');
        expect(globalSetup).toContain('declare global');
        expect(globalSetup).toContain('waitForPortOpen(port, { host })');
        expect(testSetup).toContain('axios.defaults.baseURL = baseUrl');
        expect(jestConfig).toContain("preset: '../../../jest.preset.js'");

        const generatedText = [
            JSON.stringify(project),
            JSON.stringify(packageJson),
            runtimeConfig,
            globalSetup,
            testSetup,
            jestConfig,
        ].join('\n');
        expect(generatedText).not.toContain('@agentic-workspace/api');
        expect(generatedText).not.toContain('runtimeConfig.api');
        expect(generatedText).not.toContain('api-e2e');
        expect(tree.exists('apps/services/documents-e2e/src/api/health.spec.ts')).toBe(false);
    });

    it('derives service identities and runtime config access from kebab-case names', async () => {
        writeServiceProject(tree, 'billing-events');

        await serviceE2eGenerator(tree, { name: 'billing-events' });

        const project = readJson(tree, 'apps/services/billing-events-e2e/project.json');
        const runtimeConfig = tree.read(
            'apps/services/billing-events-e2e/src/support/runtime-config.ts',
            'utf-8',
        );

        expect(project.name).toBe('@agentic-workspace/billing-events-service-e2e');
        expect(project.implicitDependencies).toEqual(['@agentic-workspace/billing-events-service']);
        expect(runtimeConfig).toContain('runtimeConfig.billingEvents');
        expect(runtimeConfig).toContain('getBillingEventsServiceE2eRuntimeConfig');
    });

    it('rejects names outside lowercase kebab-case', async () => {
        await expect(serviceE2eGenerator(tree, { name: 'InvalidName' })).rejects.toThrow(
            'Service name must use lowercase kebab-case.',
        );
        expect(tree.exists('apps/services/InvalidName-e2e/project.json')).toBe(false);
    });

    it('rejects a missing target service', async () => {
        await expect(serviceE2eGenerator(tree, { name: 'missing' })).rejects.toThrow(
            'Expected internal service project at apps/services/missing/project.json.',
        );
    });
});

