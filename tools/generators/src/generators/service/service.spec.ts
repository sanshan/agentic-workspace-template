import { readJson, type Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator } from '@nx/js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serviceGenerator } from './service';

vi.mock('@nx/js', () => ({
    libraryGenerator: vi.fn(
        async (
            tree: Tree,
            options: {
                directory: string;
                name: string;
            },
        ) => {
            const projectRoot = options.directory;

            writeJson(tree, `${projectRoot}/package.json`, { name: options.name });
            writeJson(tree, `${projectRoot}/project.json`, {
                name: options.name,
                projectType: 'library',
            });
            writeJson(tree, `${projectRoot}/tsconfig.lib.json`, {});
            tree.write(`${projectRoot}/src/index.ts`, "export * from './lib/generated.js';\n");
            tree.write(`${projectRoot}/src/lib/generated.ts`, 'export const generated = true;\n');
        },
    ),
}));

const apiDependencies = {
    '@agentic-workspace/runtime-config': 'workspace:*',
    '@nestjs/common': '^11.0.0',
    '@nestjs/config': '^4.0.4',
    '@nestjs/core': '^11.0.0',
    '@nestjs/platform-express': '^11.0.0',
    '@nestjs/terminus': '^11.1.0',
    '@nestjs/typeorm': '^11.0.3',
    pg: 'catalog:',
    'reflect-metadata': '^0.2.0',
    rxjs: '^7.8.0',
    tslib: 'catalog:',
    typeorm: 'catalog:',
    zod: 'catalog:',
};

describe('service generator', () => {
    let tree: Tree;

    beforeEach(() => {
        tree = createTreeWithEmptyWorkspace();
        writeJson(tree, 'tools/generators/service-dependencies.json', {
            name: '@agentic-workspace/api',
            dependencies: apiDependencies,
        });
        vi.mocked(libraryGenerator).mockClear();
    });

    it('creates the canonical non-bundled internal service shell', async () => {
        const callback = await serviceGenerator(tree, { name: 'example' });

        expect(typeof callback).toBe('function');
        expect(libraryGenerator).toHaveBeenCalledWith(
            tree,
            expect.objectContaining({
                directory: 'apps/services/example',
                name: 'example',
                importPath: '@agentic-workspace/example-service',
                bundler: 'tsc',
                linter: 'eslint',
                minimal: true,
                unitTestRunner: 'none',
                useProjectJson: true,
                addPlugin: true,
            }),
        );

        const projectJson = readJson(tree, 'apps/services/example/project.json');
        const packageJson = readJson(tree, 'apps/services/example/package.json');
        const tsconfig = readJson(tree, 'apps/services/example/tsconfig.json');
        const appTsconfig = readJson(tree, 'apps/services/example/tsconfig.app.json');
        const projectText = JSON.stringify(projectJson);

        expect(projectJson.name).toBe('@agentic-workspace/example-service');
        expect(projectJson.projectType).toBe('application');
        expect(projectJson.tags).toEqual(['type:app']);
        expect(projectJson.targets.build.executor).toBe('@nx/js:tsc');
        expect(projectJson.targets.serve.executor).toBe('@nx/js:node');
        expect(projectJson.targets.start.options.command).toBe(
            'node apps/services/example/dist/main.js',
        );
        expect(projectJson.targets['migration:generate'].options.command).toContain(
            '--filter @agentic-workspace/example-service',
        );
        expect(projectText).not.toContain('webpack');
        expect(projectText).not.toContain('esbuild');

        expect(packageJson.name).toBe('@agentic-workspace/example-service');
        expect(packageJson.private).toBe(true);
        expect(packageJson.dependencies).toMatchObject({
            '@agentic-workspace/runtime-config': 'workspace:*',
            '@nestjs/config': '^4.0.4',
            '@nestjs/typeorm': '^11.0.3',
            pg: 'catalog:',
            typeorm: 'catalog:',
            zod: 'catalog:',
        });
        expect(packageJson.dependencies['@nestjs/terminus']).toBeUndefined();
        expect(packageJson.dependencies['@nestjs/platform-express']).toBeUndefined();

        expect(tsconfig.compilerOptions).toMatchObject({
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
        });
        expect(appTsconfig.compilerOptions).toMatchObject({
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            rootDir: 'src',
        });
        expect(appTsconfig.references).toContainEqual({
            path: '../../../packages/runtime-config/tsconfig.lib.json',
        });

        const main = tree.read('apps/services/example/src/main.ts', 'utf-8');
        const appModule = tree.read(
            'apps/services/example/src/app/app.module.ts',
            'utf-8',
        );
        const applicationModule = tree.read(
            'apps/services/example/src/app/application/application.module.ts',
            'utf-8',
        );
        const presentersModule = tree.read(
            'apps/services/example/src/app/presenters/presenters.module.ts',
            'utf-8',
        );
        const envSchema = tree.read(
            'apps/services/example/src/app/infrastructure/config/example-env.schema.ts',
            'utf-8',
        );
        const config = tree.read(
            'apps/services/example/src/app/infrastructure/config/example.config.ts',
            'utf-8',
        );
        const configModule = tree.read(
            'apps/services/example/src/app/infrastructure/config/example-config.module.ts',
            'utf-8',
        );
        const typeormModule = tree.read(
            'apps/services/example/src/app/infrastructure/persistence/typeorm/example-typeorm.module.ts',
            'utf-8',
        );
        const typeormOptions = tree.read(
            'apps/services/example/src/app/infrastructure/persistence/typeorm/typeorm-options.ts',
            'utf-8',
        );
        const dataSource = tree.read(
            'apps/services/example/src/app/infrastructure/persistence/typeorm/data-source.ts',
            'utf-8',
        );
        const jestConfig = tree.read('apps/services/example/jest.config.cts', 'utf-8');

        expect(main).toContain('NestFactory.createApplicationContext(AppModule)');
        expect(main).not.toContain('.listen(');
        expect(appModule).toContain(
            "import { PresentersModule } from './presenters/presenters.module';",
        );
        expect(appModule).toContain('imports: [PresentersModule]');
        expect(appModule).not.toContain('InfrastructureModule');
        expect(applicationModule).toContain(
            "import { InfrastructureModule } from '../infrastructure/infrastructure.module';",
        );
        expect(applicationModule).toContain('imports: [InfrastructureModule]');
        expect(applicationModule).toContain('exports: [InfrastructureModule]');
        expect(presentersModule).toContain(
            "import { ApplicationModule } from '../application/application.module';",
        );
        expect(presentersModule).toContain('imports: [ApplicationModule]');
        expect(presentersModule).not.toContain('InfrastructureModule');
        expect(envSchema).toContain('EXAMPLE_DB_HOST');
        expect(envSchema).toContain('EXAMPLE_DB_PORT: PortSchema');
        expect(envSchema).not.toContain('EXAMPLE_PORT');
        expect(config).toContain("registerAs('example', createExampleConfig)");
        expect(configModule).toContain('ConfigModule.forFeature(exampleConfig)');
        expect(typeormModule).toContain('TypeOrmModule.forRootAsync');
        expect(typeormModule).toContain('inject: [exampleConfig.KEY]');
        expect(typeormModule).toContain('ConfigType<typeof exampleConfig>');
        expect(typeormModule).not.toContain('DatabaseHealth');
        expect(typeormOptions).toContain('synchronize: false');
        expect(dataSource).toContain('const config = createExampleConfig()');
        expect(dataSource).toContain('migrationsRun: false');
        expect(dataSource).toContain('/entities/*{.ts,.js}');
        expect(dataSource).toContain('/migrations/*{.ts,.js}');
        expect(jestConfig).toContain("displayName: '@agentic-workspace/example-service'");

        expect(
            tree.exists(
                'apps/services/example/src/app/infrastructure/persistence/typeorm/entities/.gitkeep',
            ),
        ).toBe(false);
        expect(
            tree.exists(
                'apps/services/example/src/app/infrastructure/persistence/typeorm/repositories/.gitkeep',
            ),
        ).toBe(false);
        expect(
            tree.exists(
                'apps/services/example/src/app/infrastructure/persistence/typeorm/migrations/.gitkeep',
            ),
        ).toBe(false);
        expect(tree.exists('apps/services/example/src/index.ts')).toBe(false);
        expect(tree.children('apps/services/example/src/lib')).toEqual([]);
        expect(tree.exists('apps/services/example/tsconfig.lib.json')).toBe(false);
    });

    it('derives class, package and environment names from kebab-case service names', async () => {
        await serviceGenerator(tree, { name: 'billing-events' });

        const envSchema = tree.read(
            'apps/services/billing-events/src/app/infrastructure/config/billing-events-env.schema.ts',
            'utf-8',
        );
        const config = tree.read(
            'apps/services/billing-events/src/app/infrastructure/config/billing-events.config.ts',
            'utf-8',
        );
        const projectJson = readJson(tree, 'apps/services/billing-events/project.json');

        expect(projectJson.name).toBe('@agentic-workspace/billing-events-service');
        expect(envSchema).toContain('BILLING_EVENTS_DB_HOST');
        expect(config).toContain('createBillingEventsConfig');
        expect(config).toContain('billingEventsConfig');
    });

    it('rejects names outside lowercase kebab-case', async () => {
        await expect(serviceGenerator(tree, { name: 'InvalidName' })).rejects.toThrow(
            'Service name must use lowercase kebab-case.',
        );
        expect(libraryGenerator).not.toHaveBeenCalled();
    });
});
