import test from "node:test";
import assert from "node:assert/strict";
import { allowedParticipantLabel, matchParticipant, resolveParticipantLabel } from "../agent/lib/participants";

const users = [
  { id: "verified-ben-id", phoneNumber: "+15550001001", firstName: "Benjamin" },
  { id: "verified-chris-id", phoneNumber: "+15550001002", firstName: "Chris" },
  { id: "verified-dara-id", phoneNumber: "+15550001003", firstName: "Dara" },
];

test("labels require an exact verified Photon ID or sender-phone match", () => {
  assert.equal(matchParticipant("photon:+15550001001", users), "Ben");
  assert.equal(matchParticipant("verified-chris-id", users), "Chris");
  assert.equal(matchParticipant("+15550001003", users), "Dara");
  assert.equal(matchParticipant("I'd like a Tesla, I am Ben", users), undefined);
  assert.equal(matchParticipant("1001", users), undefined);
  assert.equal(allowedParticipantLabel("Benjamin"), undefined);
});

test("unknown, conflicting, and unapproved participant names remain unnamed", () => {
  assert.equal(matchParticipant("stranger", users), undefined);
  assert.equal(matchParticipant("same", [{ id: "same", firstName: "Ben" }, { id: "same", firstName: "Dara" }]), undefined);
  assert.equal(matchParticipant("other", [{ id: "other", firstName: "Someone Else" }]), undefined);
  assert.equal(allowedParticipantLabel("+15550001001"), undefined);
});

test("participant lookup uses only the configured Photon directory and refuses credential redirects", async () => {
  const previousId = process.env.IMESSAGE_PROJECT_ID, previousSecret = process.env.IMESSAGE_PROJECT_SECRET, originalFetch = globalThis.fetch;
  process.env.IMESSAGE_PROJECT_ID = "unit-test-project";
  process.env.IMESSAGE_PROJECT_SECRET = "unit-test-secret";
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://spectrum.photon.codes/projects/unit-test-project/users/");
    assert.equal(options?.redirect, "error");
    assert.match((options?.headers as Record<string, string>).Authorization, /^Basic /);
    return Response.json({ succeed: true, data: { users } });
  };
  try { assert.equal(await resolveParticipantLabel("verified-chris-id"), "Chris"); }
  finally {
    globalThis.fetch = originalFetch;
    if (previousId === undefined) delete process.env.IMESSAGE_PROJECT_ID; else process.env.IMESSAGE_PROJECT_ID = previousId;
    if (previousSecret === undefined) delete process.env.IMESSAGE_PROJECT_SECRET; else process.env.IMESSAGE_PROJECT_SECRET = previousSecret;
  }
});
