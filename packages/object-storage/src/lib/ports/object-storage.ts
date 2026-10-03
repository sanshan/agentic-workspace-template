export interface ObjectStoragePutRequest {
    readonly key: string;
    readonly content: Uint8Array;
}

export interface ObjectStoragePutResult {
    readonly reference: string;
}

export interface ObjectStorageGetRequest {
    readonly reference: string;
}

export interface ObjectStorageGetResult {
    readonly content: Uint8Array;
}

export abstract class ObjectStorage {
    public abstract put(request: ObjectStoragePutRequest): Promise<ObjectStoragePutResult>;

    public abstract get(request: ObjectStorageGetRequest): Promise<ObjectStorageGetResult>;
}
