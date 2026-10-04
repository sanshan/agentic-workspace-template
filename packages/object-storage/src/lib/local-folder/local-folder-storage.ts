import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path';

import {
    ObjectStorage,
    type ObjectStorageGetRequest,
    type ObjectStorageGetResult,
    type ObjectStoragePutRequest,
    type ObjectStoragePutResult,
} from '../ports/object-storage.js';

export interface LocalFolderStorageOptions {
    readonly rootDirectory: string;
}

export class LocalFolderStorage extends ObjectStorage {
    private readonly rootDirectory: string;

    public constructor(options: LocalFolderStorageOptions) {
        super();

        if (options.rootDirectory.trim().length === 0) {
            throw new Error('LocalFolderStorage rootDirectory must not be empty');
        }

        this.rootDirectory = resolve(options.rootDirectory);
    }

    public async put(request: ObjectStoragePutRequest): Promise<ObjectStoragePutResult> {
        const targetPath = this.resolveTargetPath(request.key);

        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, request.content);

        return {
            reference: request.key,
        };
    }

    public async get(request: ObjectStorageGetRequest): Promise<ObjectStorageGetResult> {
        const targetPath = this.resolveTargetPath(request.reference);
        const [resolvedRootDirectory, resolvedTargetPath] = await Promise.all([
            realpath(this.rootDirectory),
            realpath(targetPath),
        ]);

        this.assertWithinRoot(
            resolvedRootDirectory,
            resolvedTargetPath,
            'Object storage reference must stay within the configured root directory',
        );

        return {
            content: await readFile(resolvedTargetPath),
        };
    }

    private resolveTargetPath(key: string): string {
        const segments = this.parseKey(key);
        const targetPath = resolve(this.rootDirectory, ...segments);

        this.assertWithinRoot(
            this.rootDirectory,
            targetPath,
            'Object storage key must stay within the configured root directory',
        );

        return targetPath;
    }

    private assertWithinRoot(rootDirectory: string, targetPath: string, message: string): void {
        const relativePath = relative(rootDirectory, targetPath);

        if (
            relativePath === '..' ||
            relativePath.startsWith(`..${sep}`) ||
            isAbsolute(relativePath)
        ) {
            throw new Error(message);
        }
    }

    private parseKey(key: string): readonly string[] {
        if (
            key.length === 0 ||
            key.includes('\0') ||
            key.includes('\\') ||
            isAbsolute(key) ||
            win32.isAbsolute(key) ||
            /^[A-Za-z]:/.test(key)
        ) {
            throw new Error('Object storage key must be a relative logical key');
        }

        const segments = key.split('/');

        if (
            segments.some(
                (segment) => segment.length === 0 || segment === '.' || segment === '..',
            )
        ) {
            throw new Error('Object storage key contains an invalid path segment');
        }

        return segments;
    }
}
