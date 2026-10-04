import nx from '@nx/eslint-plugin';
import projectConfig from './eslint.project.config.mjs';

const restrictedLocalLayers = (layers, message) => ({
    regex: String.raw`^\..*/(?:${layers.join('|')})(?:/|$)`,
    message,
});

const restrictedPersistenceImports = {
    regex: String.raw`^(?:typeorm|@nestjs/typeorm)(?:/|$)`,
    message: 'Application and domain code must not depend on persistence frameworks.',
};

export default [
    ...nx.configs['flat/base'],
    ...nx.configs['flat/typescript'],
    ...nx.configs['flat/javascript'],
    {
        ignores: [
            '**/dist',
            '**/out-tsc',
            '**/vitest.config.*.timestamp*',
            '**/vite.config.*.timestamp*',
            '**/test-output',
            '**/test-results',
        ],
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        rules: {
            '@nx/enforce-module-boundaries': [
                'error',
                {
                    enforceBuildableLibDependency: true,
                    allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
                    depConstraints: [
                        {
                            sourceTag: 'type:core',
                            onlyDependOnLibsWithTags: ['type:core'],
                            bannedExternalImports: ['@nestjs/*', 'typeorm'],
                        },
                        {
                            sourceTag: 'type:business',
                            onlyDependOnLibsWithTags: ['type:core', 'type:runtime'],
                            bannedExternalImports: ['@nestjs/*'],
                        },
                        {
                            sourceTag: 'type:runtime',
                            onlyDependOnLibsWithTags: ['type:core', 'type:runtime'],
                        },
                        {
                            sourceTag: 'type:app',
                            onlyDependOnLibsWithTags: [
                                'type:core',
                                'type:business',
                                'type:runtime',
                            ],
                        },
                        {
                            sourceTag: 'type:e2e',
                            onlyDependOnLibsWithTags: ['type:app', 'type:runtime'],
                        },
                        {
                            sourceTag: 'type:tooling',
                            onlyDependOnLibsWithTags: ['type:tooling'],
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['**/src/app/app.module.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        restrictedLocalLayers(
                            ['application', 'infrastructure', 'domain'],
                            'AppModule must compose the service through PresentersModule.',
                        ),
                    ],
                },
            ],
        },
    },
    {
        files: ['**/src/app/presenters/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        restrictedLocalLayers(
                            ['infrastructure', 'domain'],
                            'Presenters may depend on the application layer, not local infrastructure or domain internals.',
                        ),
                    ],
                },
            ],
        },
    },
    {
        files: ['**/src/app/application/application.module.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        restrictedLocalLayers(
                            ['presenters'],
                            'ApplicationModule may compose infrastructure but must not depend on presenters.',
                        ),
                        restrictedPersistenceImports,
                    ],
                },
            ],
        },
    },
    {
        files: ['**/src/app/application/**/*.ts'],
        ignores: ['**/src/app/application/application.module.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        restrictedLocalLayers(
                            ['infrastructure', 'presenters'],
                            'Application code may depend on domain contracts, not infrastructure or presenters.',
                        ),
                        restrictedPersistenceImports,
                    ],
                },
            ],
        },
    },
    {
        files: ['**/src/app/infrastructure/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        restrictedLocalLayers(
                            ['presenters'],
                            'Infrastructure must not depend on presenters.',
                        ),
                    ],
                },
            ],
        },
    },
    {
        files: ['**/src/app/domain/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        restrictedLocalLayers(
                            ['application', 'infrastructure', 'presenters'],
                            'Domain code must not depend on outer service layers.',
                        ),
                        {
                            regex: String.raw`^(?:@nestjs(?:/|$)|typeorm(?:/|$))`,
                            message: 'Domain code must remain framework-free.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
        rules: {},
    },
    ...projectConfig,
    {
        files: ['**/*.json'],
        // Override or add rules here
        rules: {},
        languageOptions: {
            parser: await import('jsonc-eslint-parser'),
        },
    },
];

