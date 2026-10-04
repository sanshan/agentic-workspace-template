import { formatFiles, type Tree, updateJson } from '@nx/devkit';
import { libraryGenerator } from '@nx/js';

import type { PackageGeneratorSchema } from './schema';

const packageNamePattern = /^[a-z][a-z0-9-]*$/;

export async function packageGenerator(tree: Tree, options: PackageGeneratorSchema): Promise<void> {
    if (!packageNamePattern.test(options.name)) {
        throw new Error('Package name must use lowercase kebab-case.');
    }

    const projectRoot = `packages/${options.name}`;
    const projectName = `@agentic-workspace/${options.name}`;

    await libraryGenerator(tree, {
        directory: projectRoot,
        name: options.name,
        importPath: projectName,
        bundler: 'tsc',
        linter: 'eslint',
        minimal: true,
        unitTestRunner: 'vitest',
        useProjectJson: true,
        addPlugin: true,
        skipFormat: true,
    });

    updateJson(tree, `${projectRoot}/package.json`, (packageJson) => {
        const { dependencies: _dependencies, devDependencies: _devDependencies, ...rest } = packageJson;

        return {
            ...rest,
            name: projectName,
            private: true,
            type: 'module',
        };
    });

    updateJson(tree, `${projectRoot}/project.json`, (projectJson) => ({
        name: projectName,
        $schema: projectJson.$schema,
        sourceRoot: `${projectRoot}/src`,
        projectType: 'library',
        tags: ['type:business'],
    }));

    for (const generatedFile of tree.children(`${projectRoot}/src/lib`)) {
        tree.delete(`${projectRoot}/src/lib/${generatedFile}`);
    }
    tree.write(`${projectRoot}/src/index.ts`, '');

    const vitestConfigPath = `${projectRoot}/vitest.config.mts`;
    const vitestConfig = tree.read(vitestConfigPath, 'utf-8');

    if (vitestConfig === null) {
        throw new Error(`Expected ${vitestConfigPath} to be generated.`);
    }

    tree.write(
        vitestConfigPath,
        vitestConfig
            .replace('root: __dirname,', 'root: import.meta.dirname,')
            .replace(`name: '${options.name}'`, `name: '${projectName}'`)
            .replace('watch: false,', 'watch: false,\n        passWithNoTests: true,'),
    );

    await formatFiles(tree);
}

export default packageGenerator;
