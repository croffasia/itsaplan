// What a storage backend has to do. index.ts picks one by STORAGE_DRIVER and every
// caller keeps using the same putObject / getObject / deleteObject functions.
export interface StoredObject {
  body: ReadableStream;
  contentType: string;
  contentLength?: number;
}

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  // A missing object is not an error.
  delete(key: string): Promise<void>;
}
