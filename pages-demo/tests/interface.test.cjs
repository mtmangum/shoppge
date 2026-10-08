const { JSDOM } = require("jsdom");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const root = require("node:path").resolve(__dirname, "../dist") + "/";
const html = fs.readFileSync(root + "index.html", "utf8");
const scriptFile = html.match(/src="\.\/([^"]+)"/)[1];
assert.match(scriptFile, /^app\.[a-f0-9]{12}\.js$/);
const dom = new JSDOM(html, {
  url: "https://mtmangum.github.io/shoppge/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const w = dom.window,
  d = w.document;
w.indexedDB = require("fake-indexeddb").indexedDB;
w.Blob = Blob;

w.fetch = async () => {
  throw Error("Unexpected network request");
};
w.Response = Response;
w.TextDecoder = TextDecoder;
w.TextEncoder = TextEncoder;
w.confirm = () => true;
w.HTMLElement.prototype.scrollIntoView = function () {};
const errors = [];
w.addEventListener("error", (e) => errors.push(e.error));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const change = (el, v) => {
  const p =
    el.tagName === "SELECT"
      ? w.HTMLSelectElement.prototype
      : el.tagName === "TEXTAREA"
        ? w.HTMLTextAreaElement.prototype
        : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(p, "value").set.call(el, v);
  el.dispatchEvent(
    new w.Event(el.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
};
const clickText = async (text) => {
  const el = [...d.querySelectorAll("button,a")].find(
    (x) => x.textContent.trim() === text,
  );
  assert.ok(el, text);
  el.click();
  await wait(50);
};
(async () => {
  w.eval(fs.readFileSync(root + scriptFile, "utf8"));
  await wait(80);
  for (const label of [
    "Admin Dashboard",
    "Shop Trends (last 12 weeks)",
    "Machinist Workload",
    "Overdue / Urgent Jobs",
    "Needs Assignment",
    "Recent Activity",
    "Avg. Completion",
    "Users",
  ])
    assert.ok(d.body.textContent.includes(label), label);
  assert.equal(d.querySelectorAll('svg[role="img"]').length, 2);
  assert.equal(
    d.querySelector("body #root>div>div").textContent.includes("DEMO"),
    true,
  );
  await clickText("Open Jobs");
  assert.ok(d.getElementById("jobs-search"));
  change(d.getElementById("jobs-status"), "completed");
  await wait(80);
  assert.ok([...d.querySelectorAll("tbody tr")].length > 0);
  assert.ok(d.querySelectorAll("tbody tr").length <= 10);
  await clickText("+ New Job");
  assert.ok(d.getElementById("job-description"));
  change(d.getElementById("job-date-required"), "2026-12-20");
  change(d.getElementById("job-description"), "A sample QA fixture");
  change(d.querySelector('[aria-label="Description for item 1"]'), "QA item");
  await clickText("Submit Job");
  await wait(100);
  assert.ok(d.body.textContent.includes("Job #66"));
  assert.ok(d.body.textContent.includes("Machinist Actions"));
  change(d.getElementById("job-assigned-machinist"), "2");
  await wait(80);
  assert.match(d.body.textContent, /Assignment saved/);
  change(d.getElementById("job-status"), "inprogress");
  await clickText("Update Status");
  assert.match(d.body.textContent, /In Progress/);
  change(
    d.getElementById("job-machinist-notes"),
    "Checked <script>unsafe</script> notes",
  );
  await clickText("Save Notes");
  assert.equal(d.querySelectorAll("main script").length, 0);
  const upload = new FormData();
  upload.append(
    "file",
    new File(["%PDF-1.4\nDemo drawing"], "drawing.pdf", {
      type: "application/pdf",
    }),
  );
  const uploaded = await w.fetch("/api/jobs/66/attachments", {
    method: "POST",
    body: upload,
  });
  assert.equal(uploaded.status, 201);
  const fileId = JSON.parse(
    w.localStorage.getItem("shoppge-demo-v2"),
  ).jobs.find((j) => j.id === 66).attachments[0].id;
  const downloaded = await w.fetch(`/api/jobs/66/attachments/${fileId}`);
  assert.equal(await downloaded.text(), "%PDF-1.4\nDemo drawing");
  const bad = new FormData();
  bad.append(
    "file",
    new File(["bad content"], "bad.pdf", { type: "application/pdf" }),
  );
  assert.equal(
    (await w.fetch("/api/jobs/66/attachments", { method: "POST", body: bad }))
      .status,
    400,
  );
  assert.equal(
    (await w.fetch(`/api/jobs/66/attachments/${fileId}`, { method: "DELETE" }))
      .status,
    200,
  );

  await clickText("Users");
  assert.ok(d.body.textContent.includes("Test Admin"));
  await clickText("New User");
  change(d.getElementById("new-user-name"), "QA Visitor");
  change(d.getElementById("new-user-email"), "qa@example.test");
  await clickText("Create User");
  assert.ok(d.body.textContent.includes("QA Visitor"));
  assert.ok(
    JSON.parse(w.localStorage.getItem("shoppge-demo-v2")).users.length === 8,
  );
  const state = JSON.parse(w.localStorage.getItem("shoppge-demo-v2"));
  const user = state.users.find((u) => u.email === "qa@example.test"),
    token = Object.keys(state.tokens).find(
      (t) => state.tokens[t].userId === user.id,
    );
  assert.ok(token);
  assert.equal(
    (
      await w.fetch("/api/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password: "demo-long-password" }),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await w.fetch("/api/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password: "demo-long-password" }),
      })
    ).status,
    400,
  );
  assert.equal(
    (await w.fetch("/api/users/1", { method: "DELETE" })).status,
    400,
  );
  assert.equal(
    (
      await w.fetch("/api/access-requests", {
        method: "POST",
        body: JSON.stringify({
          name: "Access QA",
          email: "access@example.test",
          reason: "Demo QA",
        }),
      })
    ).status,
    200,
  );

  await clickText("Activity");
  assert.ok(d.body.textContent.includes("Activity Log"));
  assert.ok(d.getElementById("activity-job-id"));
  change(d.getElementById("activity-job-id"), "66");
  await clickText("Filter");
  assert.ok(w.location.hash.includes("jobId=66"));
  await clickText("Test Admin");
  assert.ok(d.getElementById("profile-name"));
  change(d.getElementById("profile-name"), "Demo Administrator");
  await clickText("Save profile");
  assert.ok(d.body.textContent.includes("Profile saved."));
  const dark = d.querySelector('input[value="dark"]');
  dark.click();
  await wait(60);
  assert.equal(d.documentElement.dataset.theme, "dark");
  change(d.querySelector('[aria-label="View as"]'), "machinist");
  await wait(80);
  assert.equal(
    [...d.querySelectorAll("nav a")].some((a) => a.textContent === "Users"),
    false,
  );
  await clickText("Assigned to Me");
  assert.ok(d.body.textContent.includes("A sample QA fixture"));
  await clickText("Sign out");
  assert.ok(d.getElementById("login-email"));
  change(d.getElementById("login-email"), "admin@utexas.edu");
  change(d.getElementById("login-password"), "password123");
  await clickText("Sign In");
  await wait(80);
  assert.ok(d.body.textContent.includes("Admin Dashboard"));
  await clickText("Reset");
  assert.equal(
    JSON.parse(w.localStorage.getItem("shoppge-demo-v2")).jobs.length,
    65,
  );
  assert.equal(
    JSON.parse(w.localStorage.getItem("shoppge-demo-v2")).users.length,
    7,
  );
  assert.equal(errors.length, 0, errors.map(String).join("\n"));
  console.log(
    "Production-interface demo passed: dashboard, charts, jobs/filtering, creation, assignments, status, notes, users/invitations, activity filtering, profile, theme, role switching, sign-out/sign-in, reset, attachments, invitations, password links, access requests, and linked-user protection.",
  );
  w.close();
})().catch((e) => {
  console.error(e);
  w.close();
  process.exitCode = 1;
});
