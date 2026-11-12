import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("extension does not rewrite network headers or embed YouTube", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../public/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.permissions.includes("declarativeNetRequest"), false);
  assert.equal("declarative_net_request" in manifest, false);
  assert.equal(manifest.host_permissions.some((host) => /youtube|googlevideo|noembed/i.test(host)), false);
  assert.doesNotMatch(manifest.content_security_policy.extension_pages, /youtube|googlevideo|noembed/i);
});
