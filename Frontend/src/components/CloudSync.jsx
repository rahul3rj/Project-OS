import React, { useCallback, useEffect, useState } from "react";
import { CLOUD_EVENT, cloudConfigured, cloudSignOut, cloudStatus, inspectCloud, restoreCloudData, restoreLocalRecovery, restorePreviousCloud, syncCloud, uploadDeviceData } from "../utils/cloudSync.js";

let lastError = "";
function announceError(error) { lastError = error?.message || String(error); window.dispatchEvent(new Event(CLOUD_EVENT)); }

function ProfileAvatar({ user }) {
  const [failed, setFailed] = useState(false);
  const metadata = user.user_metadata || {};
  const candidate = metadata.avatar_url || metadata.picture;
  let imageUrl = "";
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" && (url.hostname === "googleusercontent.com" || url.hostname.endsWith(".googleusercontent.com"))) imageUrl = url.href;
  } catch { /* A missing picture uses the initials fallback. */ }
  const initial = (metadata.full_name || metadata.name || user.email || "?").trim().charAt(0).toUpperCase();
  return <span className="h-11 w-11 shrink-0 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden text-sm text-white font-gilroy-bold" aria-hidden="true">
    {imageUrl && !failed ? <img src={imageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initial}
  </span>;
}

export function CloudSyncRuntime() {
  useEffect(() => {
    if (!cloudConfigured) return;
    let running = false;
    const check = async () => {
      if (running || !navigator.onLine) return;
      running = true;
      try {
        if ((await cloudStatus()).user) {
          const result = await syncCloud();
          if (result !== "waiting") { lastError = ""; window.dispatchEvent(new Event(CLOUD_EVENT)); }
        }
      } catch (error) { announceError(error); }
      finally { running = false; }
    };
    check();
    const timer = setInterval(check, 60000);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    return () => { clearInterval(timer); window.removeEventListener("online", check); window.removeEventListener("focus", check); };
  }, []);
  return null;
}

export default function CloudSync() {
  const [status, setStatus] = useState({ user: null, meta: null, hasRecovery: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState(undefined);
  const refresh = useCallback(async () => { try { setStatus(await cloudStatus()); } catch (error) { setMessage(error.message); } }, []);
  useEffect(() => { refresh(); window.addEventListener(CLOUD_EVENT, refresh); return () => window.removeEventListener(CLOUD_EVENT, refresh); }, [refresh]);
  const run = async (action) => { setBusy(true); setMessage(""); try { await action(); await refresh(); } catch (error) { setMessage(error.message || "Cloud sync failed."); } finally { setBusy(false); } };
  const button = "px-4 py-2 rounded-xl text-xs border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-50 cursor-pointer";
  if (!cloudConfigured) return <div className="rounded-2xl border border-white/15 p-4 text-xs text-white/65">Cloud sync is being prepared. Your data stays on this device; manual backup remains available below.</div>;
  return <div className="rounded-2xl border border-white/15 p-4 flex flex-col gap-3 text-xs">
    <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-sm text-white font-gilroy-bold">Cloud sync</h3><span className="px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-gilroy-bold uppercase tracking-wider border border-yellow-200/50 shadow-md backdrop-blur-sm flex items-center gap-1 select-none"><i className="ri-flask-line text-[11px]" aria-hidden="true" /> Beta</span></div><p className="text-white/50 mt-1">Your data and settings, backed up. Wallpaper stays on this device.</p></div><i className="ri-cloud-line text-lg text-white/50" aria-hidden="true" /></div>
    {!status.user ? <span className="self-start inline-flex" title="Coming soon"><button type="button" className={`${button} !cursor-not-allowed`} disabled aria-label="Sign in with Google, coming soon"><i className="ri-google-fill mr-2" aria-hidden="true" />Sign in with Google</button></span> : <>
      <div className="flex items-center gap-3 py-2 border-y border-white/10">
        <ProfileAvatar key={status.user.id} user={status.user} />
        <div className="min-w-0 flex-1"><p className="text-white font-gilroy-bold truncate">{status.user.user_metadata?.full_name || status.user.user_metadata?.name || "Google account"}</p><p className="text-white/50 mt-1 truncate">{status.user.email}</p></div>
        <button className="text-white/55 hover:text-white cursor-pointer shrink-0" disabled={busy} onClick={() => run(async () => { await cloudSignOut(); setRemote(undefined); lastError = ""; })}>Sign out</button>
      </div>
      <p className="text-white/60 flex items-center gap-1.5"><i className={`${lastError ? "ri-error-warning-line text-amber-300" : "ri-cloud-check-line"} text-sm`} aria-hidden="true" />{lastError ? "Sync needs attention" : status.meta ? `Last checked ${new Date(status.meta.syncedAt).toLocaleString()}` : "Choose a copy to start syncing"}</p>
      {lastError && <p role="alert" className="text-amber-300">Not synced: {lastError}</p>}
      <div className="flex flex-wrap gap-2">
        {status.meta && <button className={button} disabled={busy} onClick={() => run(async () => { await syncCloud({ force: true }); lastError = ""; setMessage("Cloud sync checked successfully."); })}>Sync now</button>}
        <button className={button} disabled={busy} onClick={() => run(async () => { const result = await inspectCloud(); setRemote(result || null); })}>Review cloud copy</button>
      </div>
      {remote !== undefined && <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5">
        <p className="text-white/70">{remote ? `Cloud copy updated ${new Date(remote.updated_at).toLocaleString()}.` : "No cloud copy exists for this account."} Close other dashboard tabs before restoring or replacing data.</p>
        <div className="flex flex-wrap gap-2">
          {remote && <button className={button} disabled={busy} onClick={() => { if (window.confirm("Restore the cloud copy? Current local productivity data will be saved as a recovery copy on this device.")) run(async () => { await restoreCloudData(remote.revision); window.location.reload(); }); }}>Restore cloud copy</button>}
          <button className={button} disabled={busy} onClick={() => { if (window.confirm(remote ? "Replace the cloud copy with this device's data?" : "Create a cloud backup from this device's data?")) run(async () => { await uploadDeviceData(remote?.revision || 0); setRemote(undefined); lastError = ""; setMessage("Cloud backup saved."); }); }}>Use this device’s data</button>
        </div>
      </div>}
    </>}
    {status.hasRecovery && <button className={`${button} self-start`} disabled={busy} onClick={() => { if (window.confirm("Restore the local recovery copy? Close other dashboard tabs first. Cloud sync will pause until you choose a copy again.")) run(async () => { await restoreLocalRecovery(); window.location.reload(); }); }}>Restore previous local data</button>}
    {status.hasPriorCloud && <button className={`${button} self-start`} disabled={busy} onClick={() => { if (window.confirm("Restore the previous cloud copy to this device? Close other dashboard tabs first. Your current local data will be saved as a recovery copy.")) run(async () => { await restorePreviousCloud(); window.location.reload(); }); }}>Restore previous cloud data</button>}
    {message && <p role="status" className="text-white/75">{message}</p>}
  </div>;
}
