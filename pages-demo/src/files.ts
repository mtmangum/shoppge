// Attachments stay in IndexedDB in this browser, never in S3 or on a server.
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("shoppge-demo-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Browser file storage unavailable."));
  });
}
async function operation(
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest,
): Promise<any> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("files", mode),
        request = action(transaction.objectStore("files"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
export const putFile = (key: string, file: Blob) =>
  operation("readwrite", (s) => s.put(file, key));
export const getFile = (key: string) =>
  operation("readonly", (s) => s.get(key));
export const deleteFile = (key: string) =>
  operation("readwrite", (s) => s.delete(key));
export const clearFiles = () => operation("readwrite", (s) => s.clear());
