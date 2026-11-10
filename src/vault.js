import { createSnapshotMarkdown, safeSlug } from "./security.js";

const DATABASE_NAME = "linkchat-vault";
const STORE_NAME = "handles";
const VAULT_KEY = "primary-vault";

export async function connectVault() {
  const handle = await window.showDirectoryPicker({
    id: "linkchat-vault",
    mode: "readwrite",
    startIn: "documents",
  });
  const allowed = await verifyPermission(handle, true);
  if (!allowed) throw new Error("Write permission was not granted for that folder.");
  await storeVaultHandle(handle);
  return handle;
}

export async function verifyPermission(handle, request) {
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  if (!request) return false;
  return (await handle.requestPermission(options)) === "granted";
}

export async function initializeVault(root) {
  const response = await fetch(chrome.runtime.getURL("vault-template/files.json"));
  if (!response.ok) throw new Error("The bundled vault manifest could not be read.");
  const { files, managed_files: managedFiles = [] } = await response.json();
  validateTemplateManifest(files, managedFiles);
  const managed = new Set(managedFiles);
  const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (const relativePath of files) {
    const template = await fetch(chrome.runtime.getURL(`vault-template/${relativePath}`));
    if (!template.ok) throw new Error(`Missing bundled vault file: ${relativePath}`);
    const contents = await template.text();
    if (managed.has(relativePath)) {
      await syncManagedTextFile(root, relativePath, contents, backupStamp);
    } else {
      await writeTextFile(root, relativePath, contents, { overwrite: false });
    }
  }
}

export async function syncManagedTextFile(root, relativePath, contents, backupStamp) {
  const existing = await readTextFile(root, relativePath);
  if (existing === contents) return "unchanged";
  if (existing !== null) {
    await writeTextFile(root, `.linkchat/backups/${backupStamp}/${relativePath}`, existing, { overwrite: false });
  }
  await writeTextFile(root, relativePath, contents, { overwrite: true });
  return existing === null ? "created" : "updated";
}

export async function saveInboxSnapshot(root, snapshot) {
  const now = new Date();
  const quarantine = (snapshot.findings || []).length > 0;
  const folder = quarantine ? "inbox/quarantine" : "inbox";
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const base = `${stamp}-${safeSlug(snapshot.contactName)}-${safeSlug(snapshot.captureKind || "profile-overview")}`;
  const filename = await availableFilename(root, folder, base, ".md");
  const relativePath = `${folder}/${filename}`;
  await writeTextFile(root, relativePath, createSnapshotMarkdown(snapshot, now), {
    overwrite: false,
  });
  return { relativePath, quarantine };
}

export async function getStoredVault() {
  try {
    return await withStore("readonly", (store) => requestAsPromise(store.get(VAULT_KEY)));
  } catch {
    return null;
  }
}

async function storeVaultHandle(handle) {
  await withStore("readwrite", (store) => requestAsPromise(store.put(handle, VAULT_KEY)));
}

async function availableFilename(root, folder, base, extension) {
  const directory = await getDirectory(root, folder, true);
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const name = `${base}${suffix ? `-${suffix}` : ""}${extension}`;
    try {
      await directory.getFileHandle(name);
    } catch (error) {
      if (error?.name === "NotFoundError") return name;
      throw error;
    }
  }
  throw new Error("Could not allocate a unique inbox filename.");
}

async function writeTextFile(root, relativePath, contents, { overwrite }) {
  const parts = relativePath.split("/").filter(Boolean);
  const filename = parts.pop();
  const directory = await getDirectory(root, parts.join("/"), true);

  if (!overwrite) {
    try {
      await directory.getFileHandle(filename);
      return false;
    } catch (error) {
      if (error?.name !== "NotFoundError") throw error;
    }
  }

  const file = await directory.getFileHandle(filename, { create: true });
  const writable = await file.createWritable();
  await writable.write(contents);
  await writable.close();
  return true;
}

async function readTextFile(root, relativePath) {
  const parts = relativePath.split("/").filter(Boolean);
  const filename = parts.pop();
  try {
    const directory = await getDirectory(root, parts.join("/"), false);
    const handle = await directory.getFileHandle(filename);
    return (await handle.getFile()).text();
  } catch (error) {
    if (error?.name === "NotFoundError") return null;
    throw error;
  }
}

async function getDirectory(root, relativePath, create) {
  let current = root;
  for (const part of relativePath.split("/").filter(Boolean)) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

function withStore(mode, operation) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE_NAME)) {
        open.result.createObjectStore(STORE_NAME);
      }
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = async () => {
      const database = open.result;
      const transaction = database.transaction(STORE_NAME, mode);
      try {
        const result = await operation(transaction.objectStore(STORE_NAME));
        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      } catch (error) {
        database.close();
        reject(error);
      }
    };
  });
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function validateTemplateManifest(files, managedFiles) {
  if (!Array.isArray(files) || !Array.isArray(managedFiles)) throw new Error("The vault manifest is invalid.");
  if (new Set(files).size !== files.length) throw new Error("The vault manifest contains duplicate files.");
  const available = new Set(files);
  for (const value of [...files, ...managedFiles]) {
    if (typeof value !== "string" || value.startsWith("/") || value.split("/").includes("..")) {
      throw new Error(`Unsafe vault manifest path: ${String(value)}`);
    }
  }
  for (const value of managedFiles) {
    if (!available.has(value)) throw new Error(`Managed vault file is not bundled: ${value}`);
  }
}
