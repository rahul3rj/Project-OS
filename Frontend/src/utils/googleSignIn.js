// Supabase PKCE keeps the verifier in extension storage; Chrome returns only
// the authorization code to this extension's own redirect URL.
export async function signInWithGoogle(auth, identity) {
  if (!identity?.getRedirectURL || !identity?.launchWebAuthFlow) {
    throw new Error("Google sign-in is available in the installed Chrome extension.");
  }
  const redirectTo = identity.getRedirectURL("oauth2");
  const { data, error } = await auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Could not start Google sign-in.");
  const result = await identity.launchWebAuthFlow({ url: data.url, interactive: true });
  if (!result) throw new Error("Google sign-in was cancelled.");
  let callback;
  try { callback = new URL(result); } catch { throw new Error("Google sign-in returned an invalid redirect."); }
  const expected = new URL(redirectTo);
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname) {
    throw new Error("Google sign-in returned an unexpected redirect.");
  }
  if (callback.searchParams.has("error") || callback.hash.includes("error=")) {
    throw new Error("Google sign-in could not be completed. Check your account and try again.");
  }
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("Google sign-in did not return an authorization code. Check the Supabase redirect settings.");
  const { error: exchangeError } = await auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
