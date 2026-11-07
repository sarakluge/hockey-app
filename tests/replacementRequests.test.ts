import test from "node:test";
import assert from "node:assert/strict";
import { replacementPreviewData } from "../src/lib/demo";
import { pendingReplacementRequests } from "../src/lib/replacementRequests";

test("reminders only include current unanswered invitations for the linked family", () => {
  const data = replacementPreviewData();
  assert.equal(pendingReplacementRequests(data, "demo-family-2").length, 1);
  assert.equal(pendingReplacementRequests(data, "demo-family-0").length, 0);
  assert.equal(pendingReplacementRequests(data, null).length, 0);
  for (const response of ["queued", "declined", "accepted", "closed"] as const) {
    data.replacementInvitations[0].response = response;
    assert.equal(pendingReplacementRequests(data, "demo-family-2").length, 0);
  }
  data.replacementInvitations[0].response = "pending";
  for (const status of ["found", "exhausted", "cancelled"] as const) {
    data.replacementSearches[0].status = status;
    assert.equal(pendingReplacementRequests(data, "demo-family-2").length, 0);
  }
});
test("expired invitations and matches that have started no longer show reminders", () => {
  const data = replacementPreviewData();
  assert.equal(
    pendingReplacementRequests(
      data,
      "demo-family-2",
      Date.parse(data.replacementSearches[0].deadline!),
    ).length,
    0,
  );
  data.replacementSearches[0].deadline = null;
  const match = data.matches.find((m) => m.id === "demo:3")!;
  assert.equal(
    pendingReplacementRequests(data, "demo-family-2", Date.parse(match.starts_at!))
      .length,
    0,
  );
  match.starts_at = null;
  for (const status of ["finished", "cancelled"]) {
    match.status = status;
    assert.equal(pendingReplacementRequests(data, "demo-family-2").length, 0);
  }
});
