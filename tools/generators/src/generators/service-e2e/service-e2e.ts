import {
    formatFiles,
    installPackagesTask,
    readJson,
    type GeneratorCallback,
    type ProjectConfiguration,
    type Tree,
    writeJson,
} from '@nx/devkit';

import type { ServiceE2eGeneratorSchema } from './schema';

const serviceNamePattern = /^[a-z][a-z0-9-]*$/;

interface PackageJson {
    devDependencies?: Record<string, string>;
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

function readBaselineDevDependencies(tree: Tree): Record<string, string> {
    const apiE2ePackageJson = readJson<PackageJson>(tree, 'tools/generators/service-e2e-dependencies.json');
    const devDependencies = apiE2ePackageJson.devDependencies;

    if (!devDependencies) {
        throw new Error('Expected tools/generators/service-e2e-dependencies.json to define devDependencies.');
    }

    return { ...devDependencies };
}

function addE2eServeConfiguration(
    tree: Tree,
    projectRoot: string,
    projectName: string,
): void {
    const projectPath = `${projectRoot}/project.json`;

    if (!tree.exists(projectPath)) {
        throw new Error(`Expected internal service project at ${projectPath}.`);
    }

    const project = readJson<ProjectConfiguration>(tree, projectPath);
    if (project.name !== projectName) {
        throw new Error(`Expected ${projectPath} to define project ${projectName}.`);
    }

    const serveTarget = project.targets?.serve;
    if (!serveTarget) {
        throw new Error(`Expected ${projectName} to define a serve target.`);
    }

    project.targets = {
        ...project.targets,
        serve: {
            ...serveTarget,
            configurations: {
                ...serveTarget.configurations,
                e2e: {
                    buildTarget: `${projectName}:build`,
                    watch: false,
                    inspect: false,
                    debounce: 0,
                },
            },
        },
    };

    writeJson(tree, projectPath, project);
}

export async function serviceE2eGenerator(
    tree: Tree,
    options: ServiceE2eGeneratorSchema,
): Promise<GeneratorCallback> {
    if (!serviceNamePattern.test(options.name)) {
        throw new Error('Service name must use lowercase kebab-case.');
    }

    const serviceRoot = `apps/services/${options.name}`;
    const e2eRoot = `apps/services/${options.name}-e2e`;
    const serviceProjectName = `@agentic-workspace/${options.name}-service`;
    const e2eProjectName = `${serviceProjectName}-e2e`;
    const serverTargetName = `${options.name}-server`;
    const pascalName = toPascalCase(options.name);
    const runtimeConfigKey = toCamelCase(options.name);
    const runtimeConfigFunctionName = `get${pascalName}ServiceE2eRuntimeConfig`;

    if (tree.exists(`${e2eRoot}/project.json`)) {
        throw new Error(`Service E2E project already exists at ${e2eRoot}.`);
    }

    addE2eServeConfiguration(tree, serviceRoot, serviceProjectName);

    writeJson(tree, `${e2eRoot}/project.json`, {
        name: e2eProjectName,
        $schema: '../../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `${e2eRoot}/src`,
        projectType: 'application',
        tags: ['type:e2e'],
        implicitDependencies: [serviceProjectName],
        targets: {
            [serverTargetName]: {
                continuous: true,
                executor: 'nx:run-commands',
                options: {
                    command: `pnpm nx run ${serviceProjectName}:migration:run && pnpm nx run ${serviceProjectName}:serve:e2e`,
                },
            },
            e2e: {
                executor: '@nx/jest:jest',
                outputs: ['{workspaceRoot}/coverage/{e2eProjectRoot}'],
                options: {
                    jestConfig: `${e2eRoot}/jest.config.cts`,
                    passWithNoTests: true,
                    runInBand: true,
                },
                dependsOn: [
                    {
                        projects: [e2eProjectName],
                        target: serverTargetName,
                    },
                ],
            },
        },
    });

    writeJson(tree, `${e2eRoot}/package.json`, {
        name: e2eProjectName,
        version: '1.0.0',
        private: true,
        devDependencies: readBaselineDevDependencies(tree),
    });

    writeJson(tree, `${e2eRoot}/tsconfig.json`, {
        extends: '../../../tsconfig.base.json',
        compilerOptions: {
            outDir: `out-tsc/${options.name}-service-e2e`,
            esModuleInterop: true,
            noUnusedLocals: false,
        },
        include: ['jest.config.ts', 'jest.config.cts', 'src/**/*.ts'],
        references: [{ path: '../../../packages/runtime-config' }],
    });

    writeJson(tree, `${e2eRoot}/.spec.swcrc`, {
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
        `${e2eRoot}/jest.config.cts`,
        `import { readFileSync } from 'fs';
const swcJestConfig = JSON.parse(readFileSync(\`${'${__dirname}'}/.spec.swcrc\`, 'utf-8'));
swcJestConfig.swcrc = false;

export default {
    displayName: '${options.name}-service-e2e',
    preset: '../../../jest.preset.js',
    globalSetup: '<rootDir>/src/support/global-setup.ts',
    globalTeardown: '<rootDir>/src/support/global-teardown.ts',
    setupFiles: ['<rootDir>/src/support/test-setup.ts'],
    testEnvironment: 'node',
    transform: { '^.+\\\\.[tj]s$': ['@swc/jest', swcJestConfig] },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: 'test-output/jest/coverage',
};
`,
    );

    tree.write(
        `${e2eRoot}/src/support/runtime-config.ts`,
        `import { runtimeConfig } from '@agentic-workspace/runtime-config';
import { z } from 'zod';

const HostSchema = z.string().min(1).default('localhost');

export function ${runtimeConfigFunctionName}() {
    const host = HostSchema.parse(process.env.HOST);
    const { port } = runtimeConfig.${runtimeConfigKey};

    return {
        host,
        port,
        baseUrl: \`http://\${host}:\${port}\`,
    };
}
`,
    );

    tree.write(
        `${e2eRoot}/src/support/global-setup.ts`,
        `import { waitForPortOpen } from '@nx/node/utils';

import { ${runtimeConfigFunctionName} } from './runtime-config';

declare global {
    var __TEARDOWN_MESSAGE__: string;
}

module.exports = async function () {
    const { host, port } = ${runtimeConfigFunctionName}();

    await waitForPortOpen(port, { host });
    globalThis.__TEARDOWN_MESSAGE__ = '\\nTearing down...\\n';
};
`,
    );

    tree.write(
        `${e2eRoot}/src/support/global-teardown.ts`,
        `module.exports = async function () {
    console.log(globalThis.__TEARDOWN_MESSAGE__);
};
`,
    );

    tree.write(
        `${e2eRoot}/src/support/test-setup.ts`,
        `import axios from 'axios';

import { ${runtimeConfigFunctionName} } from './runtime-config';

module.exports = async function () {
    const { baseUrl } = ${runtimeConfigFunctionName}();

    axios.defaults.baseURL = baseUrl;
};
`,
    );

    await formatFiles(tree);

    return () => installPackagesTask(tree, true);
}

export default serviceE2eGenerator;

