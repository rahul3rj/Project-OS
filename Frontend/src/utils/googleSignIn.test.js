import { test } from "node:test";
import assert from "node:assert/strict";
import { signInWithGoogle } from "./googleSignIn.js";

const redirect = "https://abcdefghijklmnop.chromiumapp.org/oauth2";
function mockFlow(result = `${redirect}?code=one-time-code`) {
  const calls = [];
  const auth = {
    signInWithOAuth: async (options) => { calls.push(options); return { data: { url: "https://example.supabase.co/authorize" }, error: null }; },
    exchangeCodeForSession: async (code) => { calls.push(code); return { error: null }; },
  };
  const identity = { getRedirectURL: (path) => { assert.equal(path, "oauth2"); return redirect; }, launchWebAuthFlow: async (options) => { assert.equal(options.interactive, true); return result; } };
  return { auth, identity, calls };
}

test("Google sign-in starts an interactive PKCE flow and exchanges its code", async () => {
  const { auth, identity, calls } = mockFlow();
  await signInWithGoogle(auth, identity);
  assert.deepEqual(calls[0], { provider: "google", options: { redirectTo: redirect, skipBrowserRedirect: true } });
  assert.equal(calls[1], "one-time-code");
});

test("rejects unexpected redirects and missing authorization codes", async () => {
  for (const url of ["https://example.com/oauth2?code=bad", `${redirect}#access_token=not-a-code`, `${redirect}?error=access_denied`]) {
    const { auth, identity, calls } = mockFlow(url);
    await assert.rejects(signInWithGoogle(auth, identity));
    assert.equal(calls.length, 1);
  }
});

test("reports a missing extension identity API", async () => {
  await assert.rejects(signInWithGoogle({}, undefined), /installed Chrome extension/);
});
