import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, cp, rm, rename } from "node:fs/promises";
import { build } from "esbuild";
import ts from "typescript";
import postcss from "postcss";
import tailwind from "tailwindcss";
const generated = "pages-demo/src/generated";
await mkdir(generated, { recursive: true });
// Reuse server-page presentation verbatim; replace only server data loading.
const pages = [
  [
    "Admin",
    "app/admin/page.tsx",
    [
      "stats",
      "workload",
      "overdueOrUrgent",
      "weekly",
      "activity",
      "assignmentStats",
      "unassignedJobs",
    ],
  ],
  [
    "Detail",
    "app/jobs/[id]/page.tsx",
    [
      "job",
      "role",
      "canManage",
      "currentUserId",
      "machinists",
      "daysElapsed",
      "hasBillingInfo",
    ],
  ],
  [
    "Jobs",
    "app/jobs/page.tsx",
    [
      "mine",
      "assigned",
      "total",
      "stats",
      "openJobs",
      "page",
      "totalPages",
      "search",
      "status",
      "priority",
      "sortKey",
      "dir",
      "heading",
    ],
  ],
  [
    "Activity",
    "app/admin/activity/page.tsx",
    [
      "searchParams",
      "page",
      "sortKey",
      "dir",
      "count",
      "totalPages",
      "entries",
      "allUsers",
    ],
  ],
  ["Home", "app/page.tsx", ["recentJobs"]],
];
for (const [name, path, props] of pages) {
  const source = await readFile(path, "utf8"),
    ast = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  const imports = ast.statements
    .filter(ts.isImportDeclaration)
    .filter(
      (n) =>
        ![
          "@/lib/auth",
          "@/lib/db",
          "@/lib/schema",
          "@/lib/query-helpers",
          "drizzle-orm",
          "drizzle-orm/pg-core",
        ].includes(n.moduleSpecifier.text),
    )
    .map((n) => n.getText(ast))
    .join("\n");
  const fn = ast.statements.find(
    (n) =>
      ts.isFunctionDeclaration(n) &&
      n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword),
  );
  const ret = fn.body.statements.findLast(ts.isReturnStatement);
  let helpers = "";
  if (name === "Activity") {
    const start = fn.body.statements.findIndex((n) =>
      n.getText(ast).startsWith("const hasFilters"),
    );
    helpers = fn.body.statements
      .slice(start, -1)
      .map((n) => n.getText(ast))
      .join("\n")
      .replaceAll(": SortKey", ": string");
    helpers =
      `const DATE_CLASS = \`\${FIELD_CLASS} [&::-webkit-date-and-time-value]:min-h-5 [&::-webkit-date-and-time-value]:text-left\`;\n` +
      helpers;
  }
  await writeFile(
    `${generated}/${name}.tsx`,
    `// @ts-nocheck — Generated presentation; production pages are typechecked separately.\n${imports}\nexport default function ${name}({${props.join(",")}}:any){\n${helpers}\n${ret.getText(ast)}\n}\n`,
  );
}
// Use the same synthetic users and job generator as the AWS test seed.
const seedSource = await readFile("scripts/seed-dummy-data.ts", "utf8");
const rows = seedSource.slice(
  seedSource.indexOf("  const rows = ["),
  seedSource.indexOf("\n\n  for (const row"),
);
const definitions = seedSource.slice(
  seedSource.indexOf("  const today ="),
  seedSource.indexOf("\n  let jobCount"),
);
await writeFile(
  `${generated}/Seed.ts`,
  `// @ts-nocheck — Generated from the production seed script.\nexport function seed(){${rows};const allUsers=rows.map((u,i)=>({...u,id:i+1,phone:null,isActive:true,createdAt:new Date().toISOString()}));const requestors=allUsers.filter(u=>u.role==='requestor'),machinists=allUsers.filter(u=>u.role==='machinist'),admin=allUsers.find(u=>u.role==='admin');${definitions};return {users:allUsers,jobs:jobDefs.map((j,i)=>({...j,id:i+1,materialsOrdered:false,machinistNotes:'',attachments:[],statusHistory:[{id:i+1,fromStatus:null,toStatus:j.status,note:'Sample job created',changedById:admin.id,changedAt:j.entryDate+'T12:00:00.000Z'}],items:j.items.map((item,n)=>({...item,id:i*10+n+1}))})),requests:[],passwords:Object.fromEntries(allUsers.map(u=>[u.id,'password123'])),userId:admin.id,messages:[],tokens:{}}}`,
);
// Header/footer also use the production layout instead of a separate design.
const layout = await readFile("app/layout.tsx", "utf8");
const header = layout.slice(
  layout.indexOf("          <header"),
  layout.indexOf("\n\n          {session"),
);
const footer = layout.slice(
  layout.indexOf("          <footer"),
  layout.indexOf("\n        </div>\n        <Toaster"),
);
await writeFile(
  `${generated}/Chrome.tsx`,
  `import {Cog} from 'lucide-react';export function Header(){return (${header.replace('src="/ut_logo.svg"', 'src="./assets/ut_logo.svg"')})}export function Footer(){return (${footer})}`,
);
await rm("pages-demo/dist", { recursive: true, force: true });
await mkdir("pages-demo/dist", { recursive: true });
await mkdir("pages-demo/dist/assets", { recursive: true });
for (const file of [
  "public/ut_logo.svg",
  "public/fonts/inter-latin.woff2",
  "public/fonts/Inter-OFL.txt",
]) {
  await cp(file, "pages-demo/dist/assets/" + file.split("/").at(-1));
}
await cp("pages-demo/index.html", "pages-demo/dist/index.html");
await build({
  entryPoints: ["pages-demo/src/main.tsx"],
  bundle: true,
  minify: true,
  outfile: "pages-demo/dist/app.js",
  jsx: "automatic",
  alias: {
    "@": process.cwd(),
    "next/link": process.cwd() + "/pages-demo/src/link.tsx",
    "next/navigation": process.cwd() + "/pages-demo/src/navigation.ts",
    "next-auth/react": process.cwd() + "/pages-demo/src/auth.ts",
  },
  define: { "process.env.NODE_ENV": '"production"' },
});
const configSource = ts.transpileModule(
  await readFile("tailwind.config.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText;
const { default: tailwindConfig } = await import(
  "data:text/javascript;base64," + Buffer.from(configSource).toString("base64")
);
const css = await postcss([
  tailwind({
    ...tailwindConfig,
    content: [...tailwindConfig.content, "./pages-demo/src/**/*.{ts,tsx}"],
  }),
]).process(await readFile("app/globals.css", "utf8"), {
  from: "app/globals.css",
});
await writeFile(
  "pages-demo/dist/style.css",
  `@font-face{font-family:Inter;src:url('./assets/inter-latin.woff2');font-weight:100 900;font-display:swap}body{font-family:Inter,system-ui,sans-serif}\n` +
    css.css,
);
let html = await readFile("pages-demo/dist/index.html", "utf8");
for (const file of ["app.js", "style.css"]) {
  const content = await readFile("pages-demo/dist/" + file);
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 12);
  const [name, ext] = file.split(".");
  const versioned = `${name}.${hash}.${ext}`;
  await rename("pages-demo/dist/" + file, "pages-demo/dist/" + versioned);
  html = html.replace("./" + file, "./" + versioned);
}
await writeFile("pages-demo/dist/index.html", html);
console.log("Demo built from the production page markup and components.");
