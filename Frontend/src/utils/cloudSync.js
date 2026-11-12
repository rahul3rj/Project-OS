import { createClient } from "@supabase/supabase-js";
import { cloudKeysToRemove, isCloudKey, makeCloudSnapshot, validateCloudSnapshot } from "./cloudSnapshot.js";
import { signInWithGoogle } from "./googleSignIn.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured = Boolean(url && key && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url));
const client = cloudConfigured ? createClient(url, key, { auth: { storageKey: "project_os_auth_v1", detectSessionInUrl: false, flowType: "pkce" } }) : null;
const META = "project_os_cloud_meta_v1";
const RECOVERY = "project_os_cloud_recovery_v1";
const PREVIOUS_CLOUD = "project_os_cloud_previous_v1";
const INTERVAL = 2 * 60 * 60 * 1000;
export const CLOUD_EVENT = "project-os-cloud-change";
const notify = () => window.dispatchEvent(new Event(CLOUD_EVENT));

async function readAll() {
  const api = globalThis.chrome?.storage?.local || globalThis.browser?.storage?.local;
  const items = api ? await api.get(null) : {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!isCloudKey(key) || items[key] !== undefined) continue;
    const raw = localStorage.getItem(key);
    try { items[key] = JSON.parse(raw); } catch { items[key] = raw; }
  }
  return items;
}
async function writeItems(items) {
  const api = globalThis.chrome?.storage?.local || globalThis.browser?.storage?.local;
  if (api) await api.set(items);
  else for (const [key, value] of Object.entries(items)) localStorage.setItem(key, JSON.stringify(value));
}
async function replaceCloudItems(snapshot) {
  const { data } = snapshot;
  const api = globalThis.chrome?.storage?.local || globalThis.browser?.storage?.local;
  const current = await readAll();
  const remove = cloudKeysToRemove(snapshot, current);
  if (api) { await api.set(data); if (remove.length) await api.remove(remove); }
  for (const key of Object.keys(current).filter((key) => isCloudKey(key, snapshot.scope || 1))) localStorage.removeItem(key);
  if (!api) for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value));
}
async function digest(snapshot) {
  // Postgres jsonb may reorder object keys, so hash a canonical representation.
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical(snapshot))));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const requireClient = () => { if (!client) throw new Error("Cloud sync is not configured yet."); return client; };
export async function cloudUser() {
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.user || null;
}
export async function cloudSignIn() {
  if (!navigator.locks?.request) throw new Error("Google sign-in needs browser lock support.");
  return navigator.locks.request("project-os-google-sign-in", { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error("Google sign-in is already open in another tab.");
    await signInWithGoogle(requireClient().auth, globalThis.chrome?.identity);
    notify();
  });
}
export async function cloudSignOut() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
  notify();
}
async function currentUser() {
  const user = await cloudUser();
  if (!user) throw new Error("Sign in to use cloud sync.");
  return user;
}
async function remoteSnapshot(user) {
  const { data, error } = await requireClient().from("cloud_snapshots").select("revision, snapshot, updated_at").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (data) validateCloudSnapshot(data.snapshot);
  return data;
}
export async function cloudStatus() {
  const user = await cloudUser();
  const items = await readAll();
  const meta = user && items[META]?.userId === user.id ? items[META] : null;
  return { user, meta, hasRecovery: Boolean(items[RECOVERY]), hasPriorCloud: Boolean(items[PREVIOUS_CLOUD]) };
}
export async function inspectCloud() { return remoteSnapshot(await currentUser()); }
async function locked(fn) {
  if (!navigator.locks?.request) throw new Error("Cloud sync needs browser lock support to avoid conflicting tabs.");
  return navigator.locks.request("project-os-cloud-sync", fn);
}
async function upload(user, snapshot, revision) {
  const { data, error } = await requireClient().rpc("save_cloud_snapshot", { expected_revision: revision, new_snapshot: snapshot });
  if (error) {
    if (error.message?.includes("cloud_revision_conflict")) throw new Error("The cloud copy changed on another device. Review it before syncing.");
    throw error;
  }
  await writeItems({ [META]: { userId: user.id, revision: Number(data), hash: await digest(snapshot), syncedAt: Date.now() } });
  notify();
}
// Explicit user choice establishes the first baseline, even if a cloud copy exists.
export async function uploadDeviceData(expectedRevision) {
  return locked(async () => {
    const user = await currentUser();
    const remote = await remoteSnapshot(user);
    if ((remote?.revision || 0) !== expectedRevision) throw new Error("The cloud copy changed. Review it again before replacing it.");
    if (remote) await writeItems({ [PREVIOUS_CLOUD]: remote.snapshot });
    const snapshot = makeCloudSnapshot(await readAll());
    await upload(user, snapshot, remote?.revision || 0);
  });
}
export async function restoreCloudData(expectedRevision) {
  return locked(async () => {
    const user = await currentUser();
    const remote = await remoteSnapshot(user);
    if (!remote) throw new Error("There is no cloud backup for this account yet.");
    if (remote.revision !== expectedRevision) throw new Error("The cloud copy changed. Review it again before restoring it.");
    await writeItems({ [RECOVERY]: makeCloudSnapshot(await readAll()) });
    await replaceCloudItems(remote.snapshot);
    await writeItems({ [META]: { userId: user.id, revision: remote.revision, hash: await digest(remote.snapshot), syncedAt: Date.now() } });
    notify();
  });
}
export async function restoreLocalRecovery() {
  return locked(async () => {
    const items = await readAll();
    const snapshot = validateCloudSnapshot(items[RECOVERY]);
    await replaceCloudItems(snapshot);
    // Require an explicit choice before uploading recovered data.
    await writeItems({ [META]: null });
    notify();
  });
}
export async function restorePreviousCloud() {
  return locked(async () => {
    const items = await readAll();
    const snapshot = validateCloudSnapshot(items[PREVIOUS_CLOUD]);
    await writeItems({ [RECOVERY]: makeCloudSnapshot(items) });
    await replaceCloudItems(snapshot);
    await writeItems({ [META]: null });
    notify();
  });
}
export async function syncCloud({ force = false } = {}) {
  return locked(async () => {
    const user = await currentUser();
    const items = await readAll();
    const meta = items[META];
    if (!meta || meta.userId !== user.id) return "choose";
    if (!force && Date.now() - meta.syncedAt < INTERVAL) return "waiting";
    const snapshot = makeCloudSnapshot(items);
    if (await digest(snapshot) === meta.hash) {
      // Check for another device's changes even when this device is unchanged.
      const remote = await remoteSnapshot(user);
      if (!remote || remote.revision !== meta.revision) throw new Error("The cloud copy changed on another device. Review it before syncing.");
      await writeItems({ [META]: { ...meta, syncedAt: Date.now() } });
      notify();
      return "unchanged";
    }
    await upload(user, snapshot, meta.revision);
    return "synced";
  });
}
