import test from "node:test";
import assert from "node:assert/strict";
import {
  authRedirectUrl,
  isPasswordRecoveryUrl,
  passwordValidation,
} from "../src/lib/auth";

test("auth redirects retain the GitHub Pages base path and use an explicit recovery marker", () => {
  assert.equal(
    authRedirectUrl("https://example.github.io", "/hockey-app/"),
    "https://example.github.io/hockey-app/",
  );
  assert.equal(
    authRedirectUrl("https://example.github.io", "/hockey-app/", true),
    "https://example.github.io/hockey-app/?auth=recovery",
  );
  assert.equal(
    authRedirectUrl("http://127.0.0.1:5181", "/", true),
    "http://127.0.0.1:5181/?auth=recovery",
  );
});

test("recovery is identified before Supabase removes its implicit-flow token fragment", () => {
  assert.ok(
    isPasswordRecoveryUrl("https://example.test/#access_token=example&type=recovery"),
  );
  assert.ok(isPasswordRecoveryUrl("https://example.test/?auth=recovery"));
  assert.equal(isPasswordRecoveryUrl("https://example.test/#matcher"), false);
  assert.equal(isPasswordRecoveryUrl("https://example.test/#type=signup"), false);
});

test("new passwords require length and matching confirmation, without changing the password", () => {
  assert.ok(passwordValidation("short", "short"));
  assert.ok(passwordValidation("long-password", "different-password"));
  assert.equal(passwordValidation("a long test phrase", "a long test phrase"), "");
});
