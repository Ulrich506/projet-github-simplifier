import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("../src/services/operationError.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { creerDiagnosticOperation } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function category(error) {
  return creerDiagnosticOperation(error, "test", "test_step", performance.now(), null).category;
}

test("classifies GitHub authentication, permission, rate limit, and repository errors", () => {
  assert.equal(category({ status: 401, message: "Bad credentials" }), "AUTHENTICATION_ERROR");
  assert.equal(category({ status: 403, message: "Resource not accessible by integration" }), "PERMISSION_DENIED");
  assert.equal(category({
    status: 403,
    response: {
      status: 403,
      data: { message: "API rate limit exceeded" },
      headers: { "x-ratelimit-remaining": "0", "retry-after": "10" },
    },
  }), "GITHUB_RATE_LIMIT");
  assert.equal(category({ status: 404, response: { status: 404, data: { message: "Not Found" } } }), "REPOSITORY_NOT_FOUND");
  assert.equal(category({
    status: 422,
    response: {
      status: 422,
      data: { message: "Validation Failed", errors: [{ field: "name", code: "already_exists" }] },
    },
  }), "REPOSITORY_ALREADY_EXISTS");
});

test("classifies native Git, network, conflict, and timeout errors", () => {
  assert.equal(category("GIT_NOT_INSTALLED: executable not found"), "GIT_NOT_INSTALLED");
  assert.equal(category("GIT_NATIVE_ERROR:128:fatal: unable to access: Could not resolve host github.com"), "NETWORK_ERROR");
  assert.equal(category("GIT_NATIVE_ERROR:1: ! [rejected] main -> main (fetch first)"), "CONFLICT_ERROR");
  assert.equal(category("GIT_OPERATION_TIMEOUT"), "TIMEOUT_ERROR");
  assert.equal(category("GIT_NATIVE_ERROR:128:fatal: index file corrupt"), "GIT_OPERATION_ERROR");
  assert.equal(category("Impossible de vérifier le dossier du projet : permission denied"), "LOCAL_PROJECT_ERROR");
  assert.equal(category("unrecognized transport failure"), "UNKNOWN_ERROR");
});

test("redacts access tokens and common personal home paths from diagnostics", () => {
  const token = "ghp_abcdefghijklmnopqrstuvwxyz123456789012";
  const diagnostic = creerDiagnosticOperation(
    `Authentication failed for ${token} in /home/alice/private-project`,
    "push",
    "push_to_github",
    performance.now(),
    token,
  );
  assert.equal(diagnostic.category, "AUTHENTICATION_ERROR");
  assert(!diagnostic.technicalDetails.includes(token));
  assert(!diagnostic.technicalDetails.includes("/home/alice"));
  assert.match(diagnostic.id, /^diag-|^[0-9a-f-]{36}$/i);
});

test("only marks operations safe for repeat as retryable", () => {
  const transient = new Error("Could not resolve host github.com");
  assert.equal(
    creerDiagnosticOperation(transient, "publication / synchronisation", "synchronize_with_github", performance.now(), null).retryable,
    true,
  );
  assert.equal(
    creerDiagnosticOperation(transient, "création / publication", "create_github_repository", performance.now(), null).retryable,
    false,
  );
});
