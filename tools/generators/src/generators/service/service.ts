import {
    formatFiles,
    installPackagesTask,
    readJson,
    type GeneratorCallback,
    type Tree,
    writeJson,
} from '@nx/devkit';
import { libraryGenerator } from '@nx/js';

import type { ServiceGeneratorSchema } from './schema';

const serviceNamePattern = /^[a-z][a-z0-9-]*$/;
const baselineDependencyNames = [
    '@agentic-workspace/runtime-config',
    '@nestjs/common',
    '@nestjs/config',
    '@nestjs/core',
    '@nestjs/typeorm',
    'pg',
    'reflect-metadata',
    'rxjs',
    'tslib',
    'typeorm',
    'zod',
] as const;

interface PackageJson {
    dependencies?: Record<string, string>;
}

function toPascalCase(name: string): string {
    return name
        .split('-')
        .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
        .join('');
}

function toCamelCase(name: string): string {
    const pascalName = toPascalCase(name);
    return `${pascalName.charAt(0).toLowerCase()}${pascalName.slice(1)}`;
}

function toEnvironmentPrefix(name: string): string {
    return name.replaceAll('-', '_').toUpperCase();
}

function deleteIfExists(tree: Tree, path: string): void {
    if (tree.exists(path)) {
        tree.delete(path);
    }
}

function readBaselineDependencies(tree: Tree): Record<string, string> {
    const apiPackageJson = readJson<PackageJson>(tree, 'tools/generators/service-dependencies.json');
    const dependencies: Record<string, string> = {};

    for (const dependencyName of baselineDependencyNames) {
        const version = apiPackageJson.dependencies?.[dependencyName];
        if (!version) {
            throw new Error(`Expected tools/generators/service-dependencies.json to define ${dependencyName}.`);
        }
        dependencies[dependencyName] = version;
    }

    return dependencies;
}

export async function serviceGenerator(
    tree: Tree,
    options: ServiceGeneratorSchema,
): Promise<GeneratorCallback> {
    if (!serviceNamePattern.test(options.name)) {
        throw new Error('Service name must use lowercase kebab-case.');
    }

    const projectRoot = `apps/services/${options.name}`;
    const projectName = `@agentic-workspace/${options.name}-service`;
    const pascalName = toPascalCase(options.name);
    const camelName = toCamelCase(options.name);
    const environmentPrefix = toEnvironmentPrefix(options.name);
    const configRoot = `${projectRoot}/src/app/infrastructure/config`;
    const typeormRoot = `${projectRoot}/src/app/infrastructure/persistence/typeorm`;

    await libraryGenerator(tree, {
        directory: projectRoot,
        name: options.name,
        importPath: projectName,
        bundler: 'tsc',
        linter: 'eslint',
        minimal: true,
        unitTestRunner: 'none',
        useProjectJson: true,
        addPlugin: true,
        skipFormat: true,
    });

    for (const generatedFile of tree.children(`${projectRoot}/src/lib`)) {
        tree.delete(`${projectRoot}/src/lib/${generatedFile}`);
    }
    deleteIfExists(tree, `${projectRoot}/src/index.ts`);
    deleteIfExists(tree, `${projectRoot}/tsconfig.lib.json`);

    writeJson(tree, `${projectRoot}/project.json`, {
        name: projectName,
        $schema: '../../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `${projectRoot}/src`,
        projectType: 'application',
        tags: ['type:app'],
        targets: {
            build: {
                executor: '@nx/js:tsc',
                options: {
                    outputPath: `${projectRoot}/dist`,
                    main: `${projectRoot}/src/main.ts`,
                    tsConfig: `${projectRoot}/tsconfig.app.json`,
                    rootDir: `${projectRoot}/src`,
                },
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
            start: {
                continuous: true,
                executor: 'nx:run-commands',
                options: { command: `node ${projectRoot}/dist/main.js` },
            },
            test: { options: { passWithNoTests: true } },
            'migration:generate': {
                executor: 'nx:run-commands',
                options: {
                    command: `pnpm -w --filter ${projectName} run migration:generate -- ./src/app/infrastructure/persistence/typeorm/migrations/{args.name}`,
                },
            },
            'migration:run': {
                executor: 'nx:run-commands',
                options: { command: `pnpm -w --filter ${projectName} run migration:run` },
            },
            'migration:revert': {
                executor: 'nx:run-commands',
                options: { command: `pnpm -w --filter ${projectName} run migration:revert` },
            },
            'migration:show': {
                executor: 'nx:run-commands',
                options: { command: `pnpm -w --filter ${projectName} run migration:show` },
            },
        },
    });

    writeJson(tree, `${projectRoot}/package.json`, {
        name: projectName,
        version: '0.0.1',
        private: true,
        scripts: {
            typeorm: 'ts-node -P ./tsconfig.app.json ./node_modules/typeorm/cli.js',
            'migration:generate':
                'ts-node -P ./tsconfig.app.json ./node_modules/typeorm/cli.js migration:generate -d ./src/app/infrastructure/persistence/typeorm/data-source.ts',
            'migration:run':
                'ts-node -P ./tsconfig.app.json ./node_modules/typeorm/cli.js migration:run -d ./src/app/infrastructure/persistence/typeorm/data-source.ts',
            'migration:revert':
                'ts-node -P ./tsconfig.app.json ./node_modules/typeorm/cli.js migration:revert -d ./src/app/infrastructure/persistence/typeorm/data-source.ts',
            'migration:show':
                'ts-node -P ./tsconfig.app.json ./node_modules/typeorm/cli.js migration:show -d ./src/app/infrastructure/persistence/typeorm/data-source.ts',
        },
        dependencies: readBaselineDependencies(tree),
    });

    writeJson(tree, `${projectRoot}/tsconfig.json`, {
        extends: '../../../tsconfig.base.json',
        compilerOptions: {
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
        },
        files: [],
        include: [],
        references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.spec.json' }],
    });

    writeJson(tree, `${projectRoot}/tsconfig.app.json`, {
        extends: '../../../tsconfig.base.json',
        compilerOptions: {
            outDir: 'dist',
            types: ['node'],
            rootDir: 'src',
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            tsBuildInfoFile: 'dist/tsconfig.app.tsbuildinfo',
            target: 'es2021',
        },
        include: ['src/**/*.ts'],
        exclude: [
            'out-tsc',
            'dist',
            'jest.config.ts',
            'jest.config.cts',
            'src/**/*.spec.ts',
            'src/**/*.test.ts',
            'src/**/*.e2e-spec.ts',
            'eslint.config.js',
            'eslint.config.cjs',
            'eslint.config.mjs',
        ],
        references: [{ path: '../../../packages/runtime-config/tsconfig.lib.json' }],
    });

    writeJson(tree, `${projectRoot}/tsconfig.spec.json`, {
        extends: '../../../tsconfig.base.json',
        compilerOptions: {
            outDir: './out-tsc/jest',
            types: ['jest', 'node'],
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
        },
        include: [
            'jest.config.ts',
            'jest.config.cts',
            'src/**/*.test.ts',
            'src/**/*.spec.ts',
            'src/**/*.e2e-spec.ts',
            'src/**/*.d.ts',
        ],
        references: [{ path: './tsconfig.app.json' }],
    });

    writeJson(tree, `${projectRoot}/.spec.swcrc`, {
        jsc: {
            target: 'es2017',
            parser: { syntax: 'typescript', decorators: true, dynamicImport: true },
            transform: { decoratorMetadata: true, legacyDecorator: true },
            keepClassNames: true,
            externalHelpers: true,
            loose: true,
        },
        module: { type: 'es6' },
        sourceMaps: true,
        exclude: [],
    });

    tree.write(
        `${projectRoot}/jest.config.cts`,
        `const { readFileSync } = require('fs');
const swcJestConfig = JSON.parse(readFileSync(\`${'${__dirname}'}/.spec.swcrc\`, 'utf-8'));
swcJestConfig.swcrc = false;

module.exports = {
    displayName: '${projectName}',
    preset: '../../../jest.preset.js',
    testEnvironment: 'node',
    transform: { '^.+\\\\.[tj]s$': ['@swc/jest', swcJestConfig] },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: 'test-output/jest/coverage',
};
`,
    );

    tree.write(
        `${projectRoot}/eslint.config.mjs`,
        `import baseConfig from '../../../eslint.config.mjs';

export default [...baseConfig];
`,
    );

    tree.write(
        `${projectRoot}/src/main.ts`,
        `import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);

    app.enableShutdownHooks();
    Logger.log('${pascalName} service started');
}

void bootstrap();
`,
    );

    tree.write(
        `${projectRoot}/src/app/app.module.ts`,
        `import { Module } from '@nestjs/common';

import { PresentersModule } from './presenters/presenters.module';

@Module({
    imports: [PresentersModule],
})
export class AppModule {}
`,
    );

    tree.write(
        `${projectRoot}/src/app/application/application.module.ts`,
        `import { Module } from '@nestjs/common';

import { InfrastructureModule } from '../infrastructure/infrastructure.module';

@Module({
    imports: [InfrastructureModule],
    exports: [InfrastructureModule],
})
export class ApplicationModule {}
`,
    );

    tree.write(
        `${configRoot}/${options.name}-env.schema.ts`,
        `import { PortSchema } from '@agentic-workspace/runtime-config';
import { z } from 'zod';

export const ${pascalName}EnvSchema = z.object({
    ${environmentPrefix}_DB_HOST: z.string(),
    ${environmentPrefix}_DB_PORT: PortSchema,
    ${environmentPrefix}_DB_USERNAME: z.string(),
    ${environmentPrefix}_DB_PASSWORD: z.string(),
    ${environmentPrefix}_DB_NAME: z.string(),
});
`,
    );

    tree.write(
        `${configRoot}/${options.name}.config.ts`,
        `import { registerAs } from '@nestjs/config';

import { ${pascalName}EnvSchema } from './${options.name}-env.schema';

export function create${pascalName}Config() {
    const env = ${pascalName}EnvSchema.parse(process.env);

    return {
        database: {
            host: env.${environmentPrefix}_DB_HOST,
            port: env.${environmentPrefix}_DB_PORT,
            username: env.${environmentPrefix}_DB_USERNAME,
            password: env.${environmentPrefix}_DB_PASSWORD,
            name: env.${environmentPrefix}_DB_NAME,
        },
    };
}

export const ${camelName}Config = registerAs('${options.name}', create${pascalName}Config);
`,
    );

    tree.write(
        `${configRoot}/${options.name}-config.module.ts`,
        `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ${camelName}Config } from './${options.name}.config';

@Module({
    imports: [ConfigModule.forFeature(${camelName}Config)],
    exports: [ConfigModule],
})
export class ${pascalName}ConfigModule {}
`,
    );

    tree.write(
        `${typeormRoot}/typeorm-options.ts`,
        `import type { ConfigType } from '@nestjs/config';
import type { DataSourceOptions } from 'typeorm';

import type { ${camelName}Config } from '../../config/${options.name}.config';

type ${pascalName}DatabaseConfig = ConfigType<typeof ${camelName}Config>['database'];

export function create${pascalName}TypeOrmOptions(
    database: ${pascalName}DatabaseConfig,
): DataSourceOptions {
    return {
        type: 'postgres',
        host: database.host,
        port: database.port,
        username: database.username,
        password: database.password,
        database: database.name,
        synchronize: false,
        logging: false,
    };
}
`,
    );

    tree.write(
        `${typeormRoot}/${options.name}-typeorm.module.ts`,
        `import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ${pascalName}ConfigModule } from '../../config/${options.name}-config.module';
import { ${camelName}Config } from '../../config/${options.name}.config';
import { create${pascalName}TypeOrmOptions } from './typeorm-options';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [${pascalName}ConfigModule],
            inject: [${camelName}Config.KEY],
            useFactory: (config: ConfigType<typeof ${camelName}Config>) => ({
                ...create${pascalName}TypeOrmOptions(config.database),
                autoLoadEntities: true,
            }),
        }),
    ],
    exports: [TypeOrmModule],
})
export class ${pascalName}TypeormModule {}
`,
    );

    tree.write(
        `${typeormRoot}/data-source.ts`,
        `import { DataSource } from 'typeorm';

import { create${pascalName}Config } from '../../config/${options.name}.config';
import { create${pascalName}TypeOrmOptions } from './typeorm-options';

const config = create${pascalName}Config();

export const AppDataSource = new DataSource({
    ...create${pascalName}TypeOrmOptions(config.database),
    entities: [\`${'${__dirname}'}/entities/*{.ts,.js}\`],
    migrations: [\`${'${__dirname}'}/migrations/*{.ts,.js}\`],
    migrationsRun: false,
});
`,
    );

    tree.write(
        `${projectRoot}/src/app/infrastructure/infrastructure.module.ts`,
        `import { Module } from '@nestjs/common';

import { ${pascalName}ConfigModule } from './config/${options.name}-config.module';
import { ${pascalName}TypeormModule } from './persistence/typeorm/${options.name}-typeorm.module';

@Module({
    imports: [${pascalName}ConfigModule, ${pascalName}TypeormModule],
    exports: [${pascalName}ConfigModule, ${pascalName}TypeormModule],
})
export class InfrastructureModule {}
`,
    );

    tree.write(
        `${projectRoot}/src/app/presenters/presenters.module.ts`,
        `import { Module } from '@nestjs/common';

import { ApplicationModule } from '../application/application.module';

@Module({
    imports: [ApplicationModule],
})
export class PresentersModule {}
`,
    );

    await formatFiles(tree);

    return () => installPackagesTask(tree, true);
}

export default serviceGenerator;
