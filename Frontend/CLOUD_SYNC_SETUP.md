# Cloud sync setup (not connected yet)

Cloud sync is optional and local data remains usable without an account. The intended sign-in is **Google only**: users click a Google button, sign in with Google, and Supabase manages the session. They do not create a separate email/password login.

**Implementation status:** Google sign-in is implemented but needs an end-to-end test with your configured Supabase and Google projects. Payment and subscription enforcement are not implemented.

## 1. Prepare Supabase

1. Create a Supabase project and save its database password in a password manager.
2. Run `supabase/cloud-sync.sql` in the Supabase SQL editor. This enables row-level security and revision-checked snapshot writes. Before release, verify isolation with two separate accounts.
3. Open **Authentication → Sign In / Providers → Google** and copy the displayed Supabase callback URL. Leave the page open; you will return to enter the Google OAuth credentials.

## 2. Prepare Google sign-in

1. Create a project in Google Cloud Console, then configure the Google Auth Platform consent screen with the app name and required support details. For a test project with external users, add yourself and your friends as test users.
2. Create an OAuth client with application type **Web application**. In **Authorized redirect URIs**, add the Supabase callback URL from the previous step, typically `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Copy the Google client ID and client secret to the **Google provider settings in Supabase** and enable the provider. The Google client secret belongs in Supabase's server-side settings, never in the extension or GitHub.
4. Open `chrome://extensions`, enable Developer mode, and copy the installed extension's **ID**. In Supabase **Authentication → URL Configuration → Redirect URLs**, add `https://<extension-id>.chromiumapp.org/oauth2`, replacing `<extension-id>` with the ID you copied. This is separate from the Supabase callback added in Google Cloud. Unpacked and published installs can have different IDs, so allowlist the exact redirect for each supported build.
5. If Google-only sign-in is required, disable the email provider in Supabase after Google sign-in has been verified. Test sign-in and sign-out using at least two Google accounts. Google's testing mode and production verification rules apply.

See [Supabase's Google sign-in guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) and [Chrome's identity API](https://developer.chrome.com/docs/extensions/reference/api/identity).

## 3. Configure the extension

Create `Frontend/.env.local` with only these public client values:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

Get these from the Supabase project's Connect dialog. These values are embedded in the distributed extension and are visible to users; `.env.local` is not a secret vault. Never place the Google client secret, Supabase secret/service-role key, database password, or payment credentials in this file. The manifest allows `*.supabase.co` projects, not custom domains.

Build the extension with `npm run build`, reload it in `chrome://extensions` and accept the new identity permission if prompted. Open a new tab and use **Settings → Backup & reset → Cloud sync → Sign in with Google**. Review the cloud copy and explicitly select the device or cloud copy. Close other dashboard tabs when restoring.

Automatic checks happen approximately every two hours while a new-tab dashboard is open. Offline data is retained and retried on a later check. This is periodic snapshot backup, not real-time merging; simultaneous edits require an explicit copy choice. The last local copy before a cloud restore is retained on that device. Backup size is limited to 1 MiB per user snapshot by the SQL function.

Routine and task data, recorded analytics, streaks, water/focus progress, theme and colors, activity source and usernames, quick links, tab groups, and work/distraction sites are included. Custom wallpapers, typography, and other appearance settings are not uploaded. Active timers and session credentials are not included. Manual JSON exports omit cloud sessions and sync metadata. Older cloud snapshots retain their original scope so restoring one will not erase newly added settings.

The SQL and client do not provide billing, account deletion, point-in-time recovery, or an SLA. The optional `.github/workflows/cloud-database-backup.yml` in the repository root runs a daily encrypted database dump and retains the artifact for seven days. Enable it only in a private GitHub repository after adding repository secrets `SUPABASE_DB_URL` (the Supabase session-pooler connection string with the literal `[YOUR-PASSWORD]` placeholder), `SUPABASE_DB_PASSWORD` (the raw database password), and `CLOUD_BACKUP_PASSPHRASE`, and setting the repository variable `CLOUD_DATABASE_BACKUPS_ENABLED` to `true`. The workflow URL-encodes the password before connecting; do not put an already encoded password in the password secret. Store the passphrase separately and securely; losing it makes the encrypted backups unusable. GitHub Actions quotas, repository access, artifact retention, and scheduled-workflow behavior apply; use failure alerts and verify the workflow actually runs. Supabase recommends the session-pooler URL for IPv4-only GitHub runners. Never commit plaintext dumps or credentials.

Before offering paid sync, test decrypting and restoring a backup to a separate project, including user authentication and project settings. The workflow is not a complete disaster-recovery solution: database dumps do not include Storage objects, Auth configuration, project secrets, or other external settings. This initial sync intentionally excludes wallpaper files. Review Supabase Auth rate limits, email delivery, user consent, and privacy policy for the intended audience.
