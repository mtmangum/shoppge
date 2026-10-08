import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  format,
  startOfWeek,
  subWeeks,
  differenceInCalendarDays,
  parseISO,
} from "date-fns";
import { NavigationContext } from "./navigation";
import {
  store,
  save,
  reset,
  currentUser,
  getUser,
  age,
  isOpen,
  stats,
  events,
  jobView,
  demoFetch,
} from "./store";
import { Header, Footer } from "./generated/Chrome";
import Admin from "./generated/Admin";
import Detail from "./generated/Detail";
import Jobs from "./generated/Jobs";
import Activity from "./generated/Activity";
import Home from "./generated/Home";
import NewJob from "@/app/jobs/new/page";
import Login from "@/app/login/page";
import RequestAccess from "@/app/request-access/page";
import ForgotPassword from "@/app/forgot-password/page";
import ResetPassword from "@/app/reset-password/page";
import { Navbar } from "@/components/layout/Navbar";
import { UsersHeader } from "@/components/admin/users/UsersHeader";
import { UsersManager } from "@/components/admin/users/UsersManager";
import { AccessRequestsQueue } from "@/components/admin/users/AccessRequestsQueue";
import { AccountSettings } from "@/components/account/AccountSettings";
import { parseTheme, THEME_COOKIE } from "@/lib/account-settings";
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: any, options?: any) =>
  String(input).startsWith("/api/")
    ? demoFetch(input, options)
    : nativeFetch(input, options);
function dashboard() {
  const jobs = store.jobs,
    open = jobs.filter(isOpen),
    machinists = store.users.filter(
      (u: any) => u.isActive && ["admin", "machinist"].includes(u.role),
    ),
    unassigned = open
      .filter((j: any) => !j.machinistId)
      .sort(
        (a: any, b: any) =>
          a.entryDate.localeCompare(b.entryDate) || a.id - b.id,
      );
  const completed = jobs.filter(
    (j: any) => j.status === "completed" && j.dateCompleted,
  );
  return {
    stats: stats(),
    workload: machinists
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        openCount: open.filter((j: any) => j.machinistId === u.id).length,
        urgentOpenCount: open.filter(
          (j: any) => j.machinistId === u.id && j.priority === "urgent",
        ).length,
        completedCount: completed.filter((j: any) => j.machinistId === u.id)
          .length,
      }))
      .sort((a: any, b: any) => b.openCount - a.openCount),
    overdueOrUrgent: open
      .filter((j: any) => j.priority === "urgent" || age(j.dateRequired) > 0)
      .sort((a: any, b: any) => age(b.dateRequired) - age(a.dateRequired))
      .map((j: any) => ({
        ...j,
        requestorName: getUser(j.requestorId)?.name,
        machinistName: getUser(j.machinistId)?.name,
        daysInQueue: age(j.entryDate),
        daysOverdue: Math.max(0, age(j.dateRequired)),
      })),
    weekly: Array.from({ length: 12 }, (_, i) => {
      const start = subWeeks(
        startOfWeek(new Date(), { weekStartsOn: 1 }),
        11 - i,
      );
      const group = completed.filter(
        (j: any) =>
          differenceInCalendarDays(parseISO(j.dateCompleted), start) >= 0 &&
          differenceInCalendarDays(parseISO(j.dateCompleted), start) < 7,
      );
      return {
        week_start: start.toISOString(),
        completed_count: group.length,
        avg_turnaround_days: group.length
          ? Math.round(
              group.reduce(
                (n: number, j: any) =>
                  n +
                  differenceInCalendarDays(
                    parseISO(j.dateCompleted),
                    parseISO(j.entryDate),
                  ),
                0,
              ) / group.length,
            )
          : null,
      };
    }),
    activity: events().slice(0, 10),
    assignmentStats: {
      openCount: unassigned.length,
      urgentCount: unassigned.filter((j: any) => j.priority === "urgent")
        .length,
    },
    unassignedJobs: unassigned.map((j: any) => ({
      ...j,
      daysInQueue: age(j.entryDate),
    })),
  };
}
function list(params: URLSearchParams, u: any) {
  const search = params.get("search")?.trim() || "",
    status = params.get("status") || "all",
    priority = params.get("priority") || "all",
    mine = params.get("mine") === "1",
    assigned = params.get("assigned") === "1",
    sortKey = params.get("sort") || "id",
    dir = params.get("dir") === "asc" ? "asc" : "desc",
    page = Math.max(1, Number(params.get("page")) || 1);
  const jobs = store.jobs
    .filter(
      (j: any) =>
        (status === "all" ? isOpen(j) : j.status === status) &&
        (priority === "all" || j.priority === priority) &&
        (!mine || j.requestorId === u.id) &&
        (!assigned || j.machinistId === u.id) &&
        (!search ||
          j.description.toLowerCase().includes(search.toLowerCase()) ||
          String(j.id) === search.replace(/^#/, "")),
    )
    .map((j: any) => ({
      ...j,
      requestorName: getUser(j.requestorId)?.name,
      machinistName: getUser(j.machinistId)?.name,
      daysElapsed: age(j.entryDate),
    }));
  jobs.sort((a: any, b: any) => {
    const x = a[sortKey] ?? "",
      y = b[sortKey] ?? "";
    return (
      (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) *
      (dir === "asc" ? 1 : -1)
    );
  });
  return {
    mine,
    assigned,
    total: jobs.length,
    stats: stats(),
    openJobs: jobs.slice((page - 1) * 10, page * 10),
    page,
    totalPages: Math.max(1, Math.ceil(jobs.length / 10)),
    search,
    status,
    priority,
    sortKey,
    dir,
    heading: mine ? "My Jobs" : assigned ? "Assigned to Me" : "Open Jobs",
  };
}
function activity(params: URLSearchParams) {
  const searchParams = Object.fromEntries(params),
    page = Math.max(1, Number(searchParams.page) || 1),
    sortKey = searchParams.sort || "changedAt",
    dir = searchParams.dir === "asc" ? "asc" : "desc";
  const entries = events().filter(
    (e: any) =>
      (!searchParams.jobId || e.jobId === Number(searchParams.jobId)) &&
      (!searchParams.changedById ||
        e.changedById === Number(searchParams.changedById)) &&
      (!searchParams.status || e.toStatus === searchParams.status) &&
      (!searchParams.from || e.changedAt.slice(0, 10) >= searchParams.from) &&
      (!searchParams.to || e.changedAt.slice(0, 10) <= searchParams.to),
  );
  entries.sort((a: any, b: any) => {
    const key = sortKey === "changedBy" ? "changedByName" : sortKey,
      x = a[key] ?? "",
      y = b[key] ?? "";
    return (
      (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) *
      (dir === "asc" ? 1 : -1)
    );
  });
  return {
    searchParams,
    page,
    sortKey,
    dir,
    count: entries.length,
    totalPages: Math.max(1, Math.ceil(entries.length / 50)),
    entries: entries.slice((page - 1) * 50, page * 50),
    allUsers: [...store.users].sort((a: any, b: any) =>
      a.name.localeCompare(b.name),
    ),
  };
}
const readRoute = () => location.hash.slice(1) || "/admin";
function App() {
  const [route, setRoute] = useState(readRoute),
    [revision, refresh] = useState(0),
    [inbox, setInbox] = useState(false),
    [notice, setNotice] = useState("");
  const u = currentUser();
  const url = useMemo(() => new URL(route, "https://demo.local"), [route]);
  const path = url.pathname,
    params = url.searchParams;
  const router = useMemo(() => {
    const go = (href: string, replace = false) => {
      const parsed = new URL(href, "https://demo.local");
      if (parsed.origin !== "https://demo.local") return;
      const target = parsed.pathname + parsed.search;
      history[replace ? "replaceState" : "pushState"]({}, "", "#" + target);
      setRoute(target);
      refresh((n) => n + 1);
    };
    return {
      push: go,
      replace: (href: string) => go(href, true),
      refresh: () => refresh((n) => n + 1),
      back: () => history.back(),
    };
  }, []);
  useEffect(() => {
    const change = () => {
      setRoute(readRoute());
      refresh((n) => n + 1);
    };
    const n = (e: any) => setNotice(e.detail);
    window.addEventListener("hashchange", change);
    window.addEventListener("popstate", change);
    window.addEventListener("demo-notice", n);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("popstate", change);
      window.removeEventListener("demo-notice", n);
    };
  }, []);
  useEffect(() => {
    if (u && path === "/")
      router.replace(u.role === "admin" ? "/admin" : "/jobs");
    else if (
      !u &&
      ["/admin", "/jobs", "/settings"].some((p) => path.startsWith(p))
    )
      router.replace("/login");
    else if (u && path.startsWith("/admin") && u.role !== "admin")
      router.replace("/jobs");
    const theme = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith(THEME_COOKIE + "="))
      ?.split("=")[1];
    document.documentElement.dataset.theme = parseTheme(theme);
  }, [route, revision]);
  function page() {
    if (path === "/login") return <Login />;
    if (path === "/request-access") return <RequestAccess />;
    if (path === "/forgot-password") return <ForgotPassword />;
    if (path === "/reset-password") return <ResetPassword />;
    if (path === "/")
      return (
        <Home
          recentJobs={[...store.jobs]
            .sort((a: any, b: any) => b.id - a.id)
            .slice(0, 10)
            .map((j: any) => ({ ...j, daysElapsed: age(j.entryDate) }))}
        />
      );
    if (!u) return null;
    if (path === "/admin" && u.role === "admin")
      return <Admin {...dashboard()} />;
    if (path === "/admin/users" && u.role === "admin")
      return (
        <div className="space-y-6">
          <UsersHeader />
          <AccessRequestsQueue requests={store.requests} />
          <UsersManager
            users={[...store.users].sort((a: any, b: any) =>
              a.name.localeCompare(b.name),
            )}
            currentUserId={u.id}
          />
        </div>
      );
    if (path === "/admin/activity" && u.role === "admin")
      return <Activity {...activity(params)} />;
    if (path === "/settings")
      return (
        <AccountSettings
          account={u}
          initialTheme={parseTheme(document.documentElement.dataset.theme)}
        />
      );
    if (path === "/jobs/new") return <NewJob />;
    if (path === "/jobs") return <Jobs {...list(params, u)} />;
    const match = path.match(/^\/jobs\/(\d+)$/);
    if (match) {
      const j = store.jobs.find((j: any) => j.id === Number(match[1]));
      if (j && (u.role !== "requestor" || j.requestorId === u.id))
        return (
          <Detail
            job={jobView(j)}
            role={u.role}
            canManage={u.role !== "requestor"}
            currentUserId={u.id}
            machinists={store.users.filter(
              (x: any) => x.isActive && x.role !== "requestor",
            )}
            daysElapsed={age(j.entryDate)}
            hasBillingInfo={
              j.accountNumber ||
              j.accountTitle ||
              j.sponsorOrg ||
              j.bookkeeperName
            }
          />
        );
    }
    return (
      <p className="text-sm text-gray-500">
        Page not found or you do not have access to this job.
      </p>
    );
  }
  return (
    <NavigationContext.Provider value={{ path, params, router }}>
      <div
        className="min-h-screen bg-gray-50 overflow-x-hidden"
        onSubmitCapture={(e) => {
          const form = e.target as HTMLFormElement;
          if (form.getAttribute("method")?.toLowerCase() === "get") {
            e.preventDefault();
            const query = new URLSearchParams(new FormData(form) as any);
            router.push(path + "?" + query.toString());
          }
        }}
        onClickCapture={async (e) => {
          const a = (e.target as HTMLElement).closest("a");
          if (a?.getAttribute("href")?.startsWith("/api/jobs/")) {
            e.preventDefault();
            const response = await demoFetch(a.getAttribute("href"));
            if (!response.ok) {
              setNotice("Attachment unavailable.");
              return;
            }
            const blob = await response.blob(),
              url = URL.createObjectURL(blob),
              download = document.createElement("a");
            download.href = url;
            download.download = a.textContent?.trim() || "drawing.pdf";
            download.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        }}
      >
        <div className="border-b bg-gray-100 text-gray-700 text-xs">
          <div className="max-w-7xl mx-auto px-4 py-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span>
              <strong>DEMO</strong> · Sample data; saved in this browser only.
              No real accounts or email.
            </span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1">
                View as{" "}
                <select
                  aria-label="View as"
                  className="border rounded px-1 py-0 text-xs"
                  value={u?.role || "signedout"}
                  onChange={(e) => {
                    store.userId =
                      e.target.value === "signedout"
                        ? null
                        : store.users.find(
                            (x: any) => x.role === e.target.value && x.isActive,
                          )?.id;
                    save();
                    router.push(
                      e.target.value === "admin"
                        ? "/admin"
                        : e.target.value === "signedout"
                          ? "/"
                          : "/jobs",
                    );
                  }}
                >
                  <option value="admin">Admin</option>
                  <option value="machinist">Machinist</option>
                  <option value="requestor">Requestor</option>
                  <option value="signedout">Signed out</option>
                </select>
              </label>
              <button className="underline" onClick={() => setInbox((v) => !v)}>
                Demo inbox ({store.messages.length})
              </button>
              <button
                className="underline"
                onClick={() => {
                  if (confirm("Reset all browser-local demo changes?")) {
                    reset();
                    router.push("/admin");
                  }
                }}
              >
                Reset
              </button>
              <button
                className="underline"
                onClick={() =>
                  setNotice(
                    "Demo sign-in: admin@utexas.edu, machinist@utexas.edu, or requestor@utexas.edu; password123. Do not use your real credentials.",
                  )
                }
              >
                Demo logins
              </button>
            </div>
          </div>
        </div>
        {notice && (
          <div
            role="status"
            className="max-w-7xl mx-auto px-4 py-2 text-xs text-gray-700 bg-yellow-50 flex justify-between gap-4"
          >
            {notice}
            <button onClick={() => setNotice("")}>Dismiss</button>
          </div>
        )}
        {inbox && (
          <section className="max-w-7xl mx-auto px-4 py-3 text-sm">
            <h2 className="font-semibold mb-2">
              Simulated email · nothing was sent
            </h2>
            {store.messages.length ? (
              store.messages.map((m: any) => (
                <div key={m.id} className="border rounded bg-white p-3 mb-2">
                  <p>
                    {m.subject} · {m.to}
                  </p>
                  {m.url && (
                    <a
                      className="text-[#BF5700] underline"
                      href={"#" + m.url}
                      onClick={() => setInbox(false)}
                    >
                      Open demo password link
                    </a>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500">No messages yet.</p>
            )}
          </section>
        )}
        <Header />
        {u && <Navbar user={u} />}
        <main className="max-w-7xl mx-auto px-4 py-6">
          <React.Fragment key={path}>{page()}</React.Fragment>
        </main>
        <Footer />
      </div>
    </NavigationContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
