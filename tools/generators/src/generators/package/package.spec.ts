import { readJson, type Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { libraryGenerator } from '@nx/js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { packageGenerator } from './package';

vi.mock('@nx/js', () => ({
    libraryGenerator: vi.fn(async (tree: Tree) => {
        writeJson(tree, 'packages/example/package.json', {
            name: 'example',
            dependencies: { tslib: '^2.3.0' },
            devDependencies: { vitest: '^4.1.11' },
        });
        writeJson(tree, 'packages/example/project.json', {
            $schema: '../../node_modules/nx/schemas/project-schema.json',
            name: 'example',
            sourceRoot: 'packages/example/src',
            projectType: 'library',
            tags: [],
            targets: {
                lint: { executor: '@nx/eslint:lint' },
                test: { executor: '@nx/vitest:test' },
            },
        });
        writeJson(tree, 'packages/example/tsconfig.json', {});
        writeJson(tree, 'packages/example/tsconfig.lib.json', {});
        writeJson(tree, 'packages/example/tsconfig.spec.json', {});
        tree.write('packages/example/src/index.ts', "export * from './lib/example.js';\n");
        tree.write('packages/example/src/lib/example.ts', 'export const example = true;\n');
        tree.write('packages/example/eslint.config.mjs', "'@nx/dependency-checks'\n");
        tree.write(
            'packages/example/vitest.config.mts',
            "export default { root: __dirname, test: { name: 'example', watch: false, } };\n",
        );
    }),
}));

describe('package generator', () => {
    let tree: Tree;

    beforeEach(() => {
        tree = createTreeWithEmptyWorkspace();
        vi.mocked(libraryGenerator).mockClear();
    });

    it('creates the canonical Agentic Workspace package system files', async () => {
        await packageGenerator(tree, { name: 'example' });

        expect(libraryGenerator).toHaveBeenCalledWith(
            tree,
            expect.objectContaining({
                directory: 'packages/example',
                name: 'example',
                importPath: '@agentic-workspace/example',
                bundler: 'tsc',
                linter: 'eslint',
                unitTestRunner: 'vitest',
                useProjectJson: true,
                addPlugin: true,
            }),
        );

        const projectJson = readJson(tree, 'packages/example/project.json');
        const packageJson = readJson(tree, 'packages/example/package.json');
        const eslintConfig = tree.read('packages/example/eslint.config.mjs', 'utf-8');
        const vitestConfig = tree.read('packages/example/vitest.config.mts', 'utf-8');

        expect(projectJson).toEqual({
            name: '@agentic-workspace/example',
            $schema: '../../node_modules/nx/schemas/project-schema.json',
            sourceRoot: 'packages/example/src',
            projectType: 'library',
            tags: ['type:business'],
        });
        expect(packageJson).toMatchObject({
            name: '@agentic-workspace/example',
            private: true,
            type: 'module',
        });
        expect(packageJson.dependencies).toBeUndefined();
        expect(packageJson.devDependencies).toBeUndefined();
        expect(eslintConfig).toContain('@nx/dependency-checks');
        expect(vitestConfig).toContain('root: import.meta.dirname');
        expect(vitestConfig).not.toContain('__dirname');
        expect(vitestConfig).toContain("name: '@agentic-workspace/example'");
        expect(vitestConfig).toContain('passWithNoTests: true');

        expect(tree.exists('packages/example/project.json')).toBe(true);
        expect(tree.exists('packages/example/tsconfig.json')).toBe(true);
        expect(tree.exists('packages/example/tsconfig.lib.json')).toBe(true);
        expect(tree.exists('packages/example/tsconfig.spec.json')).toBe(true);
        expect(tree.read('packages/example/src/index.ts', 'utf-8')).toBe('');
        expect(tree.children('packages/example/src/lib')).toEqual([]);
    });

    it('rejects names outside lowercase kebab-case', async () => {
        await expect(packageGenerator(tree, { name: 'InvalidName' })).rejects.toThrow(
            'Package name must use lowercase kebab-case.',
        );
        expect(libraryGenerator).not.toHaveBeenCalled();
    });
});
