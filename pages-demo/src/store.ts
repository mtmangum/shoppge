import { seed } from "./generated/Seed";
import { sniffFileType } from "@/lib/file-type";
import { clearLoginFailures, resetLoginThrottle } from "@/lib/login-throttle";
import { putFile, getFile, deleteFile, clearFiles } from "./files";
import {
  createJobSchema,
  createUserSchema,
  updateUserSchema,
  updateJobSchema,
  updateStatusSchema,
  createAccessRequestSchema,
} from "@/lib/types";
import {
  profileSettingsSchema,
  passwordSettingsSchema,
} from "@/lib/account-settings";
import { newPasswordSchema } from "@/lib/password-policy";
const key = "shoppge-demo-v2";
export let store: any = seed();
try {
  const saved = JSON.parse(localStorage.getItem(key) || "null");
  if (
    saved?.version === 2 &&
    Array.isArray(saved.jobs) &&
    Array.isArray(saved.users)
  )
    store = saved;
} catch {}
export function save() {
  try {
    localStorage.setItem(key, JSON.stringify({ ...store, version: 2 }));
  } catch {
    window.dispatchEvent(
      new CustomEvent("demo-notice", {
        detail:
          "Storage is full or disabled. Changes remain for this visit only.",
      }),
    );
  }
}
export function reset() {
  store = seed();
  resetLoginThrottle();
  clearFiles().catch(() => {});
  save();
}
export const currentUser = () =>
  store.users.find((u: any) => u.id === store.userId && u.isActive);
export const getUser = (id: number) =>
  store.users.find((u: any) => u.id === id);
export const isOpen = (j: any) => ["pending", "inprogress"].includes(j.status);
export function day(value = new Date()) {
  return new Date(value).toLocaleDateString("en-CA");
}
export const age = (value: string) =>
  Math.round(
    (new Date(day() + "T12:00:00").getTime() -
      new Date(value + "T12:00:00").getTime()) /
      86400000,
  );
export function jobView(j: any) {
  return {
    ...j,
    requestor: getUser(j.requestorId),
    machinist: getUser(j.machinistId),
    completedBy: getUser(j.completedById),
    statusHistory: j.statusHistory.map((h: any) => ({
      ...h,
      changedAt: new Date(h.changedAt),
      changedBy: getUser(h.changedById),
    })),
    attachments: j.attachments.map((a: any) => ({
      ...a,
      uploadedAt: new Date(a.uploadedAt),
      uploadedBy: getUser(a.uploadedById),
    })),
  };
}
export const events = () =>
  store.jobs
    .flatMap((j: any) =>
      j.statusHistory.map((h: any) => ({
        ...h,
        jobId: j.id,
        jobDescription: j.description,
        changedByName: getUser(h.changedById)?.name,
        daysElapsed: age(j.entryDate),
        jobStatus: j.status,
      })),
    )
    .sort(
      (a: any, b: any) => b.changedAt.localeCompare(a.changedAt) || b.id - a.id,
    );
export function stats() {
  const completed = store.jobs.filter((j: any) => j.status === "completed"),
    durations = completed.map((j: any) =>
      Math.max(0, age(j.entryDate) - age(j.dateCompleted || j.entryDate)),
    );
  return {
    pending_count: store.jobs.filter((j: any) => j.status === "pending").length,
    inprogress_count: store.jobs.filter((j: any) => j.status === "inprogress")
      .length,
    urgent_open_count: store.jobs.filter(
      (j: any) => isOpen(j) && j.priority === "urgent",
    ).length,
    completed_count: completed.length,
    avg_completion_days: durations.length
      ? Math.round(
          durations.reduce((a: number, b: number) => a + b, 0) /
            durations.length,
        )
      : 0,
  };
}
const id = () =>
  Math.max(
    0,
    ...store.jobs.flatMap((j: any) => j.statusHistory.map((h: any) => h.id)),
    ...store.users.map((u: any) => u.id),
    ...store.requests.map((r: any) => r.id),
  ) + 1;
const response = (data: any = {}, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function message(to: string, subject: string, url?: string) {
  store.messages.unshift({
    id: crypto.randomUUID(),
    to,
    subject,
    url,
    at: new Date().toISOString(),
  });
}
function invite(u: any, ttl = 7 * 86400000) {
  for (const token of Object.keys(store.tokens))
    if (store.tokens[token].userId === u.id) delete store.tokens[token];
  const token = crypto.randomUUID();
  store.tokens[token] = { userId: u.id, expires: Date.now() + ttl };
  message(
    u.email,
    "Set your password (simulated email)",
    `/reset-password?token=${token}`,
  );
}
function parse(schema: any, data: any) {
  const p = schema.safeParse(data);
  if (!p.success)
    throw new Error(p.error.issues[0]?.message || "Invalid input");
  return p.data;
}
export async function demoFetch(
  input: any,
  options: any = {},
): Promise<Response> {
  const path = String(input),
    method = options.method || "GET",
    u = currentUser();
  try {
    const body =
        typeof options.body === "string" ? JSON.parse(options.body) : {},
      admin = u?.role === "admin",
      staff = admin || u?.role === "machinist";
    if (path === "/api/access-requests" && method === "POST") {
      const b = parse(createAccessRequestSchema, body);
      if (
        !store.users.some((x: any) => x.email === b.email) &&
        !store.requests.some((r: any) => r.email === b.email)
      ) {
        store.requests.push({
          ...b,
          id: id(),
          createdAt: new Date().toISOString(),
        });
        save();
      }
      return response();
    }
    if (path === "/api/password-reset/request") {
      const user = store.users.find(
        (x: any) => x.email === body.email && x.isActive,
      );
      if (user) invite(user, 3600000);
      save();
      return response();
    }
    if (path === "/api/password-reset/confirm") {
      const token = store.tokens[body.token];
      if (!token || token.expires < Date.now() || !getUser(token.userId)?.isActive)
        return response({ error: "Invalid or expired link" }, 400);
      store.passwords[token.userId] = parse(newPasswordSchema, body.password);
      delete store.tokens[body.token];
      clearLoginFailures(getUser(token.userId).email);
      save();
      return response();
    }
    if (!u) return response({ error: "Sign in required" }, 401);
    if (path === "/api/account/password") {
      const b = parse(passwordSettingsSchema, body);
      if (store.passwords[u.id] !== b.currentPassword)
        return response({ error: "Current password is incorrect." }, 400);
      store.passwords[u.id] = b.newPassword;
      save();
      return response();
    }
    if (path === "/api/account") {
      const b = parse(profileSettingsSchema, body);
      Object.assign(u, b);
      save();
      return response({ profile: b });
    }
    if (path === "/api/users" && method === "POST") {
      if (!admin) return response({ error: "Forbidden" }, 403);
      const b = parse(createUserSchema, body);
      if (store.users.some((x: any) => x.email === b.email))
        return response({ error: "Email already in use" }, 409);
      const { password, ...data } = b;
      const user = {
        ...data,
        id: id(),
        isActive: true,
        createdAt: new Date().toISOString(),
        department: data.department || null,
        room: null,
        phone: null,
      };
      store.users.push(user);
      if (password) store.passwords[user.id] = password;
      else invite(user);
      save();
      return response({ id: user.id, inviteSent: true }, 201);
    }
    const userMatch = path.match(/^\/api\/users\/(\d+)$/);
    if (userMatch) {
      if (!admin) return response({ error: "Forbidden" }, 403);
      const user = getUser(Number(userMatch[1]));
      if (!user) return response({ error: "User not found" }, 404);
      if (
        user.id === u.id &&
        (method === "DELETE" ||
          (body.role && body.role !== "admin") ||
          body.isActive === false)
      )
        return response({ error: "Your own admin account is protected" }, 400);
      if (method === "DELETE") {
        if (
          store.jobs.some(
            (j: any) =>
              [j.requestorId, j.machinistId, j.completedById].includes(
                user.id,
              ) ||
              j.attachments.some((a: any) => a.uploadedById === user.id) ||
              j.statusHistory.some((h: any) => h.changedById === user.id),
          )
        )
          return response(
            {
              error:
                "Cannot delete: this user is linked to jobs, attachments, or status history. Deactivate the account instead to preserve those records.",
            },
            400,
          );
        store.users = store.users.filter((x: any) => x.id !== user.id);
        delete store.passwords[user.id];
      } else {
        const { password, ...b } = parse(updateUserSchema, body);
        if (
          b.email &&
          store.users.some((x: any) => x.id !== user.id && x.email === b.email)
        )
          return response({ error: "Email already in use" }, 409);
        Object.assign(user, b);
        if (password) store.passwords[user.id] = password;
      }
      save();
      return response();
    }
    const requestMatch = path.match(/^\/api\/access-requests\/(\d+)$/);
    if (requestMatch) {
      if (!admin) return response({ error: "Forbidden" }, 403);
      const request = store.requests.find(
        (r: any) => r.id === Number(requestMatch[1]),
      );
      if (!request) return response({ error: "Request not found" }, 404);
      if (body.decision === "approved") {
        const result = await demoFetch("/api/users", {
          method: "POST",
          body: JSON.stringify({
            ...request,
            role: body.role,
            password: body.password,
          }),
        });
        if (!result.ok) return result;
      }
      store.requests = store.requests.filter((r: any) => r !== request);
      save();
      return response({ inviteSent: true });
    }
    if (path === "/api/jobs" && method === "POST") {
      const b = parse(createJobSchema, body);
      const next = Math.max(0, ...store.jobs.map((j: any) => j.id)) + 1;
      store.jobs.push({
        ...b,
        id: next,
        requestorId: u.id,
        machinistId: null,
        status: "pending",
        priority: "normal",
        entryDate: day(),
        machinistNotes: "",
        attachments: [],
        statusHistory: [
          {
            id: id(),
            fromStatus: null,
            toStatus: "pending",
            note: null,
            changedById: u.id,
            changedAt: new Date().toISOString(),
          },
        ],
        items: b.items.map((x: any, i: number) => ({
          ...x,
          id: next * 10 + i,
          itemNumber: i + 1,
        })),
      });
      message("shop@example.test", `New job #${next} (simulated notification)`);
      save();
      return response({ id: next }, 201);
    }
    const jobMatch = path.match(/^\/api\/jobs\/(\d+)(.*)$/);
    if (jobMatch) {
      const j = store.jobs.find((j: any) => j.id === Number(jobMatch[1]));
      if (!j) return response({ error: "Job not found" }, 404);
      if (!staff && j.requestorId !== u.id)
        return response({ error: "Forbidden" }, 403);
      const tail = jobMatch[2];
      if (tail.startsWith("/attachments")) {
        const attId = Number(tail.split("/")[2]);
        if (method === "POST") {
          const file = options.body.get("file");
          if (!file) return response({ error: "No file provided" }, 400);
          if (file.size > 25 * 1024 * 1024)
            return response({ error: "File exceeds 25MB limit." }, 400);
          const bytes = new Uint8Array(await file.arrayBuffer()),
            mimeType = sniffFileType(bytes as any);
          if (!mimeType)
            return response(
              { error: "Unsupported file type. Allowed: PDF, PNG, JPEG." },
              400,
            );
          const fileKey = crypto.randomUUID();
          await putFile(fileKey, new Blob([bytes], { type: mimeType }));
          j.attachments.push({
            id: id() + j.attachments.length,
            originalName: file.name,
            fileSizeBytes: file.size,
            mimeType,
            uploadedAt: new Date().toISOString(),
            uploadedById: u.id,
            fileKey,
          });
          save();
          return response({}, 201);
        }
        if (method === "DELETE") {
          if (!staff) return response({ error: "Forbidden" }, 403);
          const a = j.attachments.find((a: any) => a.id === attId);
          if (a) await deleteFile(a.fileKey);
          j.attachments = j.attachments.filter((a: any) => a.id !== attId);
          save();
          return response();
        }
        const att = j.attachments.find((a: any) => a.id === attId);
        if (!att) return response({ error: "Attachment not found" }, 404);
        const blob = await getFile(att.fileKey);
        return blob
          ? new Response(blob, { headers: { "Content-Type": att.mimeType } })
          : response({ error: "Attachment not found in this browser" }, 404);
      }
      if (!staff) return response({ error: "Forbidden" }, 403);
      if (tail === "/status") {
        const b = parse(updateStatusSchema, body),
          previous = j.status;
        if (previous === b.status && !b.note?.trim()) return response();
        j.status = b.status;
        j.dateCompleted =
          b.status === "completed" ? j.dateCompleted || day() : null;
        j.completedById = b.status === "completed" ? u.id : null;
        j.statusHistory.push({
          id: id(),
          fromStatus: previous,
          toStatus: j.status,
          note: b.note || null,
          changedById: u.id,
          changedAt: new Date().toISOString(),
        });
      } else if (method === "DELETE") {
        if (!admin) return response({ error: "Forbidden" }, 403);
        await Promise.all(j.attachments.map((a: any) => deleteFile(a.fileKey)));
        store.jobs = store.jobs.filter((x: any) => x !== j);
      } else Object.assign(j, parse(updateJobSchema, body));
      save();
      return response();
    }
    return response({ error: "Demo endpoint unavailable" }, 404);
  } catch (e: any) {
    return response({ error: e.message }, 400);
  }
}
