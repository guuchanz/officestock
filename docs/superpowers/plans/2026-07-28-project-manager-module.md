# Project Manager Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fourth top-level module — Project Manager — that tracks standalone projects with a start date, milestone-driven progress, a dated update log carrying costs and files, budget vs. actual, and Excel reports.

**Architecture:** The module plugs into the existing `src/lib/navigation.ts` registry, so adding the fourth tab is data, not new layout code. Pages live inside the `(dashboard)` route group and inherit its `auth()` gate. Project data is fully standalone — it shares only `User` and `Department` and never touches stock, repair, or maintenance rows. `Project.progress` and `Project.actualCost` are derived columns recomputed by one helper inside the same transaction as the mutation that invalidates them.

**Tech Stack:** Next.js 15.5 (App Router, Server Actions), Prisma 5.22 + MySQL/MariaDB, NextAuth v5, next-intl 4, Zod 3, Tailwind, ExcelJS.

**Spec:** `docs/superpowers/specs/2026-07-28-project-manager-design.md`

## Global Constraints

- **Fix `.env` before starting.** The repo's `.env` currently reads `DATABASE_URL="phpmyadmin://root:Chan%409999@localhost:3306/office_stock_db"`. `phpmyadmin://` is not a driver; every Prisma call fails with *"the URL must start with the protocol `mysql://`"*. The file is owned by `root`, so this needs sudo:
  ```bash
  sudo sed -i 's|phpmyadmin://|mysql://|' .env
  ```
  Do this first — `prisma migrate dev` in Task 1 cannot work otherwise. MySQL listens on **3306**; the `3310` that phpMyAdmin displays is a config artefact (it connects over the Unix socket and ignores the port).
- **No test runner exists in this project.** `package.json` has no `test` script and no framework installed; adding one is out of scope. Every task's verification cycle is `npx tsc --noEmit` plus a scripted check (a `node -e` script against the DB) and a named manual browser check. Where a step says "Expected: FAIL", it means the typecheck or the script fails with the named error.
- **Migration casing.** This machine's MariaDB runs `lower_case_table_names=0`. After generating any migration, grep it for lowercase table identifiers and fix them to PascalCase before committing. See Task 1 Step 5.
- **Do not integrate with other modules.** No `StockTransaction` rows, no `Product`/`RepairJob`/`Equipment` relations on any project model. Costs are typed on update entries only.
- **Both languages, always.** Every user-visible string goes in `messages/en.json` AND `messages/th.json`. Never render a raw enum value.
- **`progress` and `actualCost` are never accepted from the client.** They are computed by `recalcProject` only. No form field, no Zod key, no `data:` property in any create/update call.
- **Money columns** are `Decimal @db.Decimal(12, 2)` in Prisma and must be converted with `Number()` before crossing into a Client Component, matching `getQuotations()`. A `Decimal` handed to a Client Component throws a serialisation error at runtime, not compile time.
- **Date-only fields are normalised to local midnight on write** (`d.setHours(0, 0, 0, 0)`), matching `src/lib/maintenance-constants.ts:39`. Skipping this puts timeline bars a day off for users east of UTC.
- **Delete is ADMIN-only**; every other action requires only a session. Gate with `(session.user as any).role !== "ADMIN"`, matching `src/actions/user.actions.ts:20`.
- Follow existing house style: 2-space indent, double quotes, `clsx` for conditional classes, `useActionState` + Server Actions for forms, `export const revalidate = 0` on list pages, shared `.input` / `.label` / `.card` / `.btn-primary` Tailwind classes.

---

## File Structure

**Create**

| File | Responsibility |
|---|---|
| `src/lib/project-constants.ts` | Pure, client-safe: status transitions, status/priority lists |
| `src/lib/projects.ts` | Server helpers: `recalcProject`, `nextProjectCode`, `dateOnly` |
| `src/actions/project.actions.ts` | Project CRUD, status transition, at-risk toggle, list query, overview stats |
| `src/actions/projectMilestone.actions.ts` | Milestone add/rename/dates/toggle/reorder/remove |
| `src/actions/projectUpdate.actions.ts` | Post update + files, delete update, delete attachment |
| `src/actions/projectReport.actions.ts` | Report row type + query |
| `src/app/(dashboard)/projects/page.tsx` | Project list |
| `src/app/(dashboard)/projects/new/page.tsx` | Create |
| `src/app/(dashboard)/projects/[id]/page.tsx` | Detail: timeline, milestones, updates, files |
| `src/app/(dashboard)/projects/[id]/edit/page.tsx` | Edit |
| `src/app/(dashboard)/projects/overview/page.tsx` | Mini-dashboard |
| `src/app/(dashboard)/projects/reports/page.tsx` | Report table |
| `src/app/api/projects/reports/route.ts` | Excel download |
| `src/components/projects/ProjectForm.tsx` | Create/edit form |
| `src/components/projects/ProjectRow.tsx` | List row + delete |
| `src/components/projects/ProjectFilters.tsx` | Search/status/priority/department filters |
| `src/components/projects/ProjectStatusBadge.tsx` | Status + priority pills |
| `src/components/projects/ProgressBar.tsx` | Shared progress bar |
| `src/components/projects/ProjectStatusSelect.tsx` | Inline status change |
| `src/components/projects/ProjectTimeline.tsx` | CSS-grid milestone bars |
| `src/components/projects/MilestoneEditor.tsx` | Add/tick/remove milestones |
| `src/components/projects/UpdateLog.tsx` | Post update + list entries |
| `src/components/projects/ProjectAttachments.tsx` | Project-level files |

**Modify**

| File | Change |
|---|---|
| `prisma/schema.prisma` | 2 enums, 4 models, 5 back-relations |
| `src/lib/navigation.ts` | `"project"` in the key union, 4th `MODULES` entry |
| `src/lib/reportColumns.ts` | `PROJECT_EXCEL_COLUMNS` |
| `messages/en.json` | 5 `Nav` keys + 8 namespaces |
| `messages/th.json` | Same keys, Thai copy |

---

## Task 1: Schema, migration, and constants

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/project-constants.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: Prisma models `Project`, `ProjectMilestone`, `ProjectUpdate`, `ProjectAttachment`; enums `ProjectStatus`, `ProjectPriority`. From `project-constants.ts`: `TRANSITIONS: Record<ProjectStatus, ProjectStatus[]>`, `PROJECT_STATUSES: ProjectStatus[]`, `PROJECT_PRIORITIES: ProjectPriority[]`, `OVERDUE_GRACE_DAYS: number`.

- [ ] **Step 1: Fix the database URL**

```bash
sudo sed -i 's|phpmyadmin://|mysql://|' .env
grep '^DATABASE_URL' .env
```

Expected: `DATABASE_URL="mysql://root:Chan%409999@localhost:3306/office_stock_db"`. Without this every later step fails.

- [ ] **Step 2: Append the enums and models to `prisma/schema.prisma`**

Add at the end of the file:

```prisma
// ---------------------------------------------------------------------------
// Project Manager module
// ---------------------------------------------------------------------------

enum ProjectStatus {
  PLANNING
  IN_PROGRESS
  ON_HOLD
  DONE
  CANCELLED
}

enum ProjectPriority {
  LOW
  MEDIUM
  HIGH
}

model Project {
  id      Int     @id @default(autoincrement())
  code    String  @unique
  name    String
  details String? @db.Text

  department   Department? @relation(fields: [departmentId], references: [id])
  departmentId Int?

  /// The person responsible for delivery. Nullable so a project can be
  /// created before an owner is decided.
  owner   User?   @relation("ProjectOwner", fields: [ownerId], references: [id])
  ownerId String?

  status   ProjectStatus   @default(PLANNING)
  priority ProjectPriority @default(MEDIUM)

  /// Manual flag, set by a human who knows the project is in trouble even
  /// when the dates still look fine.
  atRisk Boolean @default(false)

  startDate  DateTime
  /// Planned finish. Compared against `finishedAt` to report late delivery.
  dueDate    DateTime?
  /// Actual finish. Stamped when status becomes DONE, cleared on reopen.
  finishedAt DateTime?

  budget Decimal @default(0) @db.Decimal(12, 2)
  /// Derived: sum(updates.cost). Stored because the reports aggregate it in SQL.
  actualCost Decimal @default(0) @db.Decimal(12, 2)
  /// Derived: done milestones / total milestones, 0-100. Stored so the list
  /// can sort and filter without loading every milestone row.
  progress Int @default(0)

  milestones  ProjectMilestone[]
  updates     ProjectUpdate[]
  attachments ProjectAttachment[]

  createdBy   User   @relation("ProjectCreatedBy", fields: [createdById], references: [id])
  createdById String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([startDate])
}

model ProjectMilestone {
  id        Int     @id @default(autoincrement())
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId Int

  name      String
  startDate DateTime?
  endDate   DateTime?
  isDone    Boolean   @default(false)
  doneAt    DateTime?
  /// Display order. Milestones are a plan, not a chronology.
  sortOrder Int @default(0)

  createdAt DateTime @default(now())

  @@index([projectId])
}

model ProjectUpdate {
  id        Int     @id @default(autoincrement())
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId Int

  note String  @db.Text
  /// Money spent, explained by `note`. Rolls up into Project.actualCost.
  cost Decimal @default(0) @db.Decimal(12, 2)

  createdBy   User     @relation(fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime @default(now())

  attachments ProjectAttachment[]

  @@index([projectId])
}

model ProjectAttachment {
  id        Int     @id @default(autoincrement())
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId Int

  /// Set when the file arrived with an update-log entry; null for
  /// project-level documents. One table so upload, list and delete are shared.
  update   ProjectUpdate? @relation(fields: [updateId], references: [id], onDelete: Cascade)
  updateId Int?

  /// Human label typed by the uploader, as in RepairAttachment — keeps the
  /// list readable when the file is called "IMG_4471.jpg".
  docName      String @default("")
  fileUrl      String
  fileName     String
  mimeType     String
  uploadedBy   User   @relation(fields: [uploadedById], references: [id])
  uploadedById String
  createdAt    DateTime @default(now())

  @@index([projectId])
  @@index([updateId])
}
```

- [ ] **Step 3: Add the five back-relations**

In `model User` (around line 10-32), add to the relation list:

```prisma
  projects           Project[]           @relation("ProjectCreatedBy")
  ownedProjects      Project[]           @relation("ProjectOwner")
  projectUpdates     ProjectUpdate[]
  projectAttachments ProjectAttachment[]
```

In `model Department` (around line 73), add:

```prisma
  projects Project[]
```

- [ ] **Step 4: Generate the migration**

Run: `npx prisma migrate dev --name add_project_manager_module`
Expected: migration created and applied, `prisma generate` runs. If it fails with a protocol error, Step 1 was skipped.

- [ ] **Step 5: Check the generated SQL for the casing bug**

```bash
grep -nE '(ALTER|CREATE|REFERENCES|DROP) TABLE `[a-z]' prisma/migrations/*add_project_manager_module/migration.sql
```

Expected: no output. If any line matches, edit the file to PascalCase (`user` → `User`, `department` → `Department`, `project` → `Project`) and re-run the grep until clean. This project's MariaDB is case-sensitive; a lowercase identifier breaks every fresh deploy.

- [ ] **Step 6: Verify the tables exist with the right shape**

```bash
node -e '
const {PrismaClient}=require("@prisma/client");
(async()=>{const p=new PrismaClient();
console.log("projects:", await p.project.count());
console.log("milestones:", await p.projectMilestone.count());
console.log("updates:", await p.projectUpdate.count());
console.log("attachments:", await p.projectAttachment.count());
await p.$disconnect();})().catch(e=>{console.error("FAIL:",e.message);process.exit(1)});'
```

Expected: four zero counts, no error.

- [ ] **Step 7: Create `src/lib/project-constants.ts`**

```ts
import { ProjectStatus, ProjectPriority } from "@prisma/client";

/**
 * Lives here rather than in `project.actions.ts` because a `"use server"`
 * module may only export async functions, and Client Components import
 * these lists to build dropdowns.
 */

/** A project past its due date by more than this many days is "overdue". */
export const OVERDUE_GRACE_DAYS = 0;

/** Order used by every status dropdown and report grouping. */
export const PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.ON_HOLD,
  ProjectStatus.DONE,
  ProjectStatus.CANCELLED,
];

export const PROJECT_PRIORITIES: ProjectPriority[] = [
  ProjectPriority.LOW,
  ProjectPriority.MEDIUM,
  ProjectPriority.HIGH,
];

/** Statuses that mean the project is still live. */
export const OPEN_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.ON_HOLD,
];

/**
 * Legal moves. CANCELLED is terminal; DONE can be reopened to IN_PROGRESS,
 * which clears `finishedAt`.
 */
export const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNING:    [ProjectStatus.IN_PROGRESS, ProjectStatus.CANCELLED],
  IN_PROGRESS: [ProjectStatus.ON_HOLD, ProjectStatus.DONE, ProjectStatus.CANCELLED],
  ON_HOLD:     [ProjectStatus.IN_PROGRESS, ProjectStatus.CANCELLED],
  DONE:        [ProjectStatus.IN_PROGRESS],
  CANCELLED:   [],
};
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/project-constants.ts
git commit -m "feat: add Project Manager schema, migration, and constants"
```

---

## Task 2: Server helpers (`recalcProject`, code generation)

**Files:**
- Create: `src/lib/projects.ts`

**Interfaces:**
- Consumes: Prisma models from Task 1.
- Produces:
  - `dateOnly(d: Date): Date` — normalises to local midnight
  - `nextProjectCode(tx: Prisma.TransactionClient, year: number): Promise<string>` — returns `PJ-YYYY-NNN`
  - `recalcProject(tx: Prisma.TransactionClient, projectId: number): Promise<void>` — rewrites `progress` and `actualCost`
  - `round2(n: number): number`

- [ ] **Step 1: Create `src/lib/projects.ts`**

```ts
import { Prisma } from "@prisma/client";

/**
 * Server-only helpers for the Project module. Not a `"use server"` module —
 * these are called from actions, never from the client, and `recalcProject`
 * must accept a transaction client, which a Server Action cannot.
 */

/** Rounds to 2 decimals without float drift on the last digit. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Normalises a date to local midnight. `startDate` and `dueDate` are
 * conceptually dates, not instants; without this a bar rendered from a
 * 17:00 +07 timestamp lands on the previous day once converted to UTC.
 * Matches `src/lib/maintenance-constants.ts:39`.
 */
export function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * `PJ-YYYY-NNN`, sequence restarting each calendar year. Same shape as
 * `jobNumber` in `repair.actions.ts:123-129`: read the newest code sharing
 * this year's prefix, parse the numeric tail, increment, pad to 3.
 *
 * Must be called inside the same transaction as the insert, or two
 * simultaneous creates can both read the same "latest" row.
 */
export async function nextProjectCode(
  tx: Prisma.TransactionClient,
  year: number
): Promise<string> {
  const prefix = `PJ-${year}-`;
  const latest = await tx.project.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const seq = latest ? Number(latest.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

/**
 * Rewrites the two derived columns from their sources.
 *
 * Takes a transaction client rather than the global `prisma` so it runs
 * inside the mutation that invalidated the values — otherwise a rolled-back
 * milestone insert leaves `progress` describing rows that no longer exist.
 *
 * A project with no milestones is 0%, not 100%: an empty plan is not a
 * finished project.
 */
export async function recalcProject(
  tx: Prisma.TransactionClient,
  projectId: number
): Promise<void> {
  const [total, done, costAgg] = await Promise.all([
    tx.projectMilestone.count({ where: { projectId } }),
    tx.projectMilestone.count({ where: { projectId, isDone: true } }),
    tx.projectUpdate.aggregate({ where: { projectId }, _sum: { cost: true } }),
  ]);

  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const actualCost = round2(Number(costAgg._sum.cost ?? 0));

  await tx.project.update({
    where: { id: projectId },
    data: { progress, actualCost },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Verify the helpers against the real database**

`recalcProject` is TypeScript, so it cannot be required from a `node -e` one-liner. Write a throwaway script and run it through the existing `ts-node` setup that `prisma/seed.ts` uses.

Create `prisma/verify-project.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { recalcProject } from "../src/lib/projects";

async function main() {
  const p = new PrismaClient();
  const u = await p.user.findFirstOrThrow({ where: { email: "admin@company.com" } });
  const proj = await p.project.create({
    data: { code: "PJ-TEST-001", name: "tmp", startDate: new Date(), createdById: u.id },
  });
  await p.projectMilestone.createMany({
    data: ["a", "b", "c", "d"].map((name, i) => ({
      projectId: proj.id, name, isDone: i < 3,
    })),
  });
  await p.projectUpdate.create({
    data: { projectId: proj.id, note: "n", cost: 1500, createdById: u.id },
  });

  await p.$transaction(async (tx) => recalcProject(tx, proj.id));
  const after = await p.project.findUniqueOrThrow({ where: { id: proj.id } });
  console.log("progress:", after.progress, "expected 75");
  console.log("actualCost:", Number(after.actualCost), "expected 1500");

  // Zero-milestone case
  const empty = await p.project.create({
    data: { code: "PJ-TEST-002", name: "empty", startDate: new Date(), createdById: u.id },
  });
  await p.$transaction(async (tx) => recalcProject(tx, empty.id));
  const emptyAfter = await p.project.findUniqueOrThrow({ where: { id: empty.id } });
  console.log("empty progress:", emptyAfter.progress, "expected 0");

  await p.project.deleteMany({ where: { code: { startsWith: "PJ-TEST-" } } });
  await p.$disconnect();
}
main();
```

Run it:

```bash
npx ts-node --project tsconfig.seed.json prisma/verify-project.ts
```

Expected output — the three numbers must match their stated expectations:

```
progress: 75 expected 75
actualCost: 1500 expected 1500
empty progress: 0 expected 0
```

If `progress` reads 100 on the empty project, the `total === 0` guard in `recalcProject` is wrong. Then delete the script — it is a check, not a fixture:

```bash
rm prisma/verify-project.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/projects.ts
git commit -m "feat: add project derived-field and code-generation helpers"
```

---

## Task 3: Navigation tab and Nav translations

**Files:**
- Modify: `src/lib/navigation.ts`, `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: routes `/projects`, `/projects/new`, `/projects/overview`, `/projects/reports` registered in `MODULES`; the `NavModule["key"]` union gains `"project"`.

- [ ] **Step 1: Extend the icon import in `src/lib/navigation.ts:1-5`**

Add `FolderKanban` to the existing `lucide-react` import list:

```ts
import {
  LayoutDashboard, History, Package, FileBarChart, Building2,
  Users, FileText, Tags, Wrench, ClipboardList, PlusCircle, UserCog,
  CalendarClock, HardHat, Factory, MapPin, FolderKanban,
} from "lucide-react";
```

- [ ] **Step 2: Widen the module key union at `src/lib/navigation.ts:17`**

```ts
  key: "stock" | "repair" | "maintenance" | "project";
```

- [ ] **Step 3: Append the fourth module to `MODULES`**

After the maintenance entry, before the closing `];`:

```ts
  {
    key: "project",
    labelKey: "moduleProject",
    href: "/projects/overview",
    icon: FolderKanban,
    items: [
      { href: "/projects/overview", key: "projectOverview", icon: LayoutDashboard },
      { href: "/projects",          key: "projectList",     icon: FolderKanban },
      { href: "/projects/new",      key: "projectNew",      icon: PlusCircle },
      { href: "/projects/reports",  key: "projectReports",  icon: FileBarChart },
    ],
  },
```

`moduleForPath` and `activeHref` need no change — longest-prefix matching already resolves `/projects/7` to the list tab and `/projects/new` to New Project.

- [ ] **Step 4: Add the five `Nav` keys to `messages/en.json`**

Inside the existing `"Nav"` object:

```json
    "moduleProject": "Projects",
    "projectOverview": "Overview",
    "projectList": "Project List",
    "projectNew": "New Project",
    "projectReports": "Reports"
```

- [ ] **Step 5: Add the same keys to `messages/th.json`**

```json
    "moduleProject": "โครงการ",
    "projectOverview": "ภาพรวม",
    "projectList": "รายการโครงการ",
    "projectNew": "เพิ่มโครงการ",
    "projectReports": "รายงาน"
```

- [ ] **Step 6: Verify both message files still parse**

```bash
node -e 'for (const f of ["en","th"]) { const d=require("./messages/"+f+".json"); if(!d.Nav.moduleProject) throw new Error(f+" missing moduleProject"); console.log(f,"ok:",d.Nav.moduleProject); }'
```

Expected: `en ok: Projects` and `th ok: โครงการ`.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Manual browser check**

Start `npm run dev`, open `http://localhost:3000/dashboard`. Expected: a fourth tab "Projects" in the header next to Maintenance. Clicking it navigates to `/projects/overview` and 404s — that page arrives in Task 8. The tab must render highlighted while on that URL.

- [ ] **Step 9: Commit**

```bash
git add src/lib/navigation.ts messages/en.json messages/th.json
git commit -m "feat: register the Projects module tab and nav translations"
```

---

## Task 4: Project actions (CRUD, status, list, stats)

**Files:**
- Create: `src/actions/project.actions.ts`

**Interfaces:**
- Consumes: `recalcProject`, `nextProjectCode`, `dateOnly`, `round2` from `src/lib/projects.ts`; `TRANSITIONS`, `OPEN_STATUSES` from `src/lib/project-constants.ts`.
- Produces:
  - `type ProjectActionState = { success: boolean; message: string; errors?: Record<string, string[]> }`
  - `createProjectAction(prev, formData): Promise<ProjectActionState>`
  - `updateProjectAction(id: number, prev, formData): Promise<ProjectActionState>`
  - `deleteProjectAction(id: number): Promise<ProjectActionState>`
  - `changeProjectStatusAction(id: number, status: ProjectStatus): Promise<ProjectActionState>`
  - `toggleAtRiskAction(id: number): Promise<ProjectActionState>`
  - `getProjects(filters): Promise<ProjectListRow[]>`
  - `getProject(id: number): Promise<ProjectDetail | null>`
  - `getProjectStats(): Promise<ProjectStats>`
  - `type ProjectListRow`, `type ProjectDetail`, `type ProjectStats`

- [ ] **Step 1: Create `src/actions/project.actions.ts` — header, schema, types**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { ProjectStatus, ProjectPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { dateOnly, nextProjectCode, recalcProject } from "@/lib/projects";
import { TRANSITIONS, OPEN_STATUSES } from "@/lib/project-constants";

export type ProjectActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

async function buildProjectSchema() {
  const t = await getTranslations("ProjectActions");
  return z
    .object({
      name:         z.string().min(1, t("nameRequired")),
      details:      z.string().optional(),
      departmentId: z.number().int().positive().optional(),
      ownerId:      z.string().optional(),
      status:       z.nativeEnum(ProjectStatus),
      priority:     z.nativeEnum(ProjectPriority),
      atRisk:       z.boolean(),
      startDate:    z.coerce.date({ errorMap: () => ({ message: t("startDateRequired") }) }),
      dueDate:      z.coerce.date().optional(),
      budget:       z.number().min(0, t("budgetInvalid")),
    })
    .superRefine((data, ctx) => {
      if (data.dueDate && data.dueDate < data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueDate"],
          message: t("dueBeforeStart"),
        });
      }
    });
}

function readProjectForm(formData: FormData) {
  const num = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? undefined : Number(v);
  };
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  return {
    name:         formData.get("name") ?? "",
    details:      str("details"),
    departmentId: num("departmentId"),
    ownerId:      str("ownerId"),
    status:       formData.get("status") ?? ProjectStatus.PLANNING,
    priority:     formData.get("priority") ?? ProjectPriority.MEDIUM,
    atRisk:       formData.get("atRisk") === "on",
    startDate:    formData.get("startDate") ?? "",
    dueDate:      str("dueDate"),
    budget:       num("budget") ?? 0,
  };
}
```

- [ ] **Step 2: Add create and update**

```ts
export async function createProjectAction(
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  const userId = session?.user?.id;
  if (!userId) return { success: false, message: t("loginRequired") };

  const schema = await buildProjectSchema();
  const parsed = schema.safeParse(readProjectForm(formData));
  if (!parsed.success) {
    return {
      success: false,
      message: t("invalidData"),
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  await prisma.$transaction(async (tx) => {
    const code = await nextProjectCode(tx, d.startDate.getFullYear());
    await tx.project.create({
      data: {
        code,
        name:         d.name,
        details:      d.details ?? null,
        departmentId: d.departmentId ?? null,
        ownerId:      d.ownerId ?? null,
        status:       d.status,
        priority:     d.priority,
        atRisk:       d.atRisk,
        startDate:    dateOnly(d.startDate),
        dueDate:      d.dueDate ? dateOnly(d.dueDate) : null,
        finishedAt:   d.status === ProjectStatus.DONE ? new Date() : null,
        budget:       d.budget,
        createdById:  userId,
      },
    });
  });

  revalidatePath("/projects");
  revalidatePath("/projects/overview");
  return { success: true, message: t("createSuccess") };
}

export async function updateProjectAction(
  id: number,
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const schema = await buildProjectSchema();
  const parsed = schema.safeParse(readProjectForm(formData));
  if (!parsed.success) {
    return {
      success: false,
      message: t("invalidData"),
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  // The form may not change status; a status change made here still has to
  // keep finishedAt honest.
  const enteringDone = d.status === ProjectStatus.DONE && existing.status !== ProjectStatus.DONE;
  const leavingDone  = d.status !== ProjectStatus.DONE && existing.status === ProjectStatus.DONE;

  await prisma.project.update({
    where: { id },
    data: {
      name:         d.name,
      details:      d.details ?? null,
      departmentId: d.departmentId ?? null,
      ownerId:      d.ownerId ?? null,
      status:       d.status,
      priority:     d.priority,
      atRisk:       d.atRisk,
      startDate:    dateOnly(d.startDate),
      dueDate:      d.dueDate ? dateOnly(d.dueDate) : null,
      budget:       d.budget,
      ...(enteringDone ? { finishedAt: new Date() } : {}),
      ...(leavingDone ? { finishedAt: null } : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects/overview");
  return { success: true, message: t("updateSuccess") };
}
```

- [ ] **Step 3: Add delete, status change, and at-risk toggle**

```ts
/**
 * ADMIN only. Cascades to milestones, updates and attachments via the
 * schema's onDelete: Cascade — the uploaded files on disk are intentionally
 * left in place, matching how repair attachments behave.
 */
export async function deleteProjectAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };
  if ((session.user as any).role !== "ADMIN") {
    return { success: false, message: t("forbidden") };
  }

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.project.delete({ where: { id } });

  revalidatePath("/projects");
  revalidatePath("/projects/overview");
  return { success: true, message: t("deleteSuccess") };
}

export async function changeProjectStatusAction(
  id: number,
  status: ProjectStatus
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };
  if (existing.status === status) return { success: true, message: t("updateSuccess") };
  if (!TRANSITIONS[existing.status].includes(status)) {
    return { success: false, message: t("illegalTransition") };
  }

  await prisma.project.update({
    where: { id },
    data: {
      status,
      // Entering DONE stamps the actual finish; leaving it clears it, so a
      // reopened project is not reported as delivered.
      finishedAt: status === ProjectStatus.DONE ? new Date() : null,
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects/overview");
  return { success: true, message: t("updateSuccess") };
}

export async function toggleAtRiskAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.project.update({
    where: { id },
    data: { atRisk: !existing.atRisk },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects/overview");
  return { success: true, message: t("updateSuccess") };
}
```

- [ ] **Step 4: Add the list query**

```ts
export type ProjectListRow = {
  id: number;
  code: string;
  name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  atRisk: boolean;
  progress: number;
  startDate: Date;
  dueDate: Date | null;
  finishedAt: Date | null;
  budget: number;
  actualCost: number;
  departmentName: string | null;
  ownerName: string | null;
};

export async function getProjects(filters: {
  q?: string;
  status?: string;
  priority?: string;
  departmentId?: string;
}): Promise<ProjectListRow[]> {
  const where: any = {};

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
      { details: { contains: q } },
    ];
  }
  if (filters.status && filters.status in ProjectStatus) {
    where.status = filters.status as ProjectStatus;
  }
  if (filters.priority && filters.priority in ProjectPriority) {
    where.priority = filters.priority as ProjectPriority;
  }
  const deptId = Number(filters.departmentId);
  if (Number.isInteger(deptId) && deptId > 0) where.departmentId = deptId;

  const rows = await prisma.project.findMany({
    where,
    orderBy: [{ atRisk: "desc" }, { startDate: "desc" }],
    include: {
      department: { select: { name: true } },
      owner:      { select: { name: true, email: true } },
    },
  });

  // Decimal must not cross into a Client Component.
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    status: r.status,
    priority: r.priority,
    atRisk: r.atRisk,
    progress: r.progress,
    startDate: r.startDate,
    dueDate: r.dueDate,
    finishedAt: r.finishedAt,
    budget: Number(r.budget),
    actualCost: Number(r.actualCost),
    departmentName: r.department?.name ?? null,
    ownerName: r.owner?.name ?? r.owner?.email ?? null,
  }));
}
```

- [ ] **Step 5: Add the detail query**

```ts
export type ProjectDetail = ProjectListRow & {
  details: string | null;
  departmentId: number | null;
  ownerId: string | null;
  milestones: {
    id: number; name: string; startDate: Date | null; endDate: Date | null;
    isDone: boolean; doneAt: Date | null; sortOrder: number;
  }[];
  updates: {
    id: number; note: string; cost: number; createdAt: Date; authorName: string;
    attachments: { id: number; docName: string; fileUrl: string; fileName: string }[];
  }[];
  files: { id: number; docName: string; fileUrl: string; fileName: string; createdAt: Date }[];
};

export async function getProject(id: number): Promise<ProjectDetail | null> {
  const r = await prisma.project.findUnique({
    where: { id },
    include: {
      department: { select: { name: true } },
      owner:      { select: { name: true, email: true } },
      milestones: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      updates: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy:   { select: { name: true, email: true } },
          attachments: { select: { id: true, docName: true, fileUrl: true, fileName: true } },
        },
      },
      // Project-level documents only; per-update files come back nested above.
      attachments: {
        where: { updateId: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, docName: true, fileUrl: true, fileName: true, createdAt: true },
      },
    },
  });
  if (!r) return null;

  return {
    id: r.id,
    code: r.code,
    name: r.name,
    details: r.details,
    status: r.status,
    priority: r.priority,
    atRisk: r.atRisk,
    progress: r.progress,
    startDate: r.startDate,
    dueDate: r.dueDate,
    finishedAt: r.finishedAt,
    budget: Number(r.budget),
    actualCost: Number(r.actualCost),
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    ownerId: r.ownerId,
    ownerName: r.owner?.name ?? r.owner?.email ?? null,
    milestones: r.milestones.map((m) => ({
      id: m.id, name: m.name, startDate: m.startDate, endDate: m.endDate,
      isDone: m.isDone, doneAt: m.doneAt, sortOrder: m.sortOrder,
    })),
    updates: r.updates.map((u) => ({
      id: u.id,
      note: u.note,
      cost: Number(u.cost),
      createdAt: u.createdAt,
      authorName: u.createdBy.name ?? u.createdBy.email,
      attachments: u.attachments,
    })),
    files: r.attachments,
  };
}
```

- [ ] **Step 6: Add the overview stats query**

```ts
export type ProjectStats = {
  open: number;
  overdue: number;
  atRisk: number;
  doneThisYear: number;
  budgetTotal: number;
  actualTotal: number;
};

export async function getProjectStats(): Promise<ProjectStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const [open, overdue, atRisk, doneThisYear, sums] = await Promise.all([
    prisma.project.count({ where: { status: { in: OPEN_STATUSES } } }),
    prisma.project.count({
      where: { status: { in: OPEN_STATUSES }, dueDate: { lt: today } },
    }),
    prisma.project.count({ where: { atRisk: true, status: { in: OPEN_STATUSES } } }),
    prisma.project.count({
      where: { status: ProjectStatus.DONE, finishedAt: { gte: yearStart } },
    }),
    prisma.project.aggregate({
      where: { status: { in: OPEN_STATUSES } },
      _sum: { budget: true, actualCost: true },
    }),
  ]);

  return {
    open,
    overdue,
    atRisk,
    doneThisYear,
    budgetTotal: Number(sums._sum.budget ?? 0),
    actualTotal: Number(sums._sum.actualCost ?? 0),
  };
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. If it fails on `t("nameRequired")`, the `ProjectActions` namespace is added in Task 9 — add a stub `"ProjectActions": {}` to both message files now and fill it there.

- [ ] **Step 8: Commit**

```bash
git add src/actions/project.actions.ts
git commit -m "feat: add project CRUD, status transition, and query actions"
```

---

## Task 5: Milestone actions

**Files:**
- Create: `src/actions/projectMilestone.actions.ts`

**Interfaces:**
- Consumes: `recalcProject`, `dateOnly` from `src/lib/projects.ts`; `ProjectActionState` from `src/actions/project.actions.ts`.
- Produces:
  - `addMilestoneAction(projectId: number, prev: ProjectActionState, formData: FormData): Promise<ProjectActionState>`
  - `toggleMilestoneAction(id: number): Promise<ProjectActionState>`
  - `deleteMilestoneAction(id: number): Promise<ProjectActionState>`

- [ ] **Step 1: Create `src/actions/projectMilestone.actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { dateOnly, recalcProject } from "@/lib/projects";
import type { ProjectActionState } from "./project.actions";

const milestoneSchema = z.object({
  name:      z.string().min(1),
  startDate: z.coerce.date().optional(),
  endDate:   z.coerce.date().optional(),
});

export async function addMilestoneAction(
  projectId: number,
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };

  const parsed = milestoneSchema.safeParse({
    name:      formData.get("name") ?? "",
    startDate: str("startDate"),
    endDate:   str("endDate"),
  });
  if (!parsed.success) {
    return { success: false, message: t("milestoneNameRequired") };
  }
  const d = parsed.data;

  if (d.startDate && d.endDate && d.endDate < d.startDate) {
    return { success: false, message: t("endBeforeStart") };
  }

  await prisma.$transaction(async (tx) => {
    const last = await tx.projectMilestone.findFirst({
      where: { projectId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await tx.projectMilestone.create({
      data: {
        projectId,
        name:      d.name,
        startDate: d.startDate ? dateOnly(d.startDate) : null,
        endDate:   d.endDate ? dateOnly(d.endDate) : null,
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });
    // A new milestone changes the denominator, so progress moves even though
    // nothing was ticked.
    await recalcProject(tx, projectId);
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true, message: t("milestoneAdded") };
}

export async function toggleMilestoneAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.projectMilestone.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.$transaction(async (tx) => {
    await tx.projectMilestone.update({
      where: { id },
      data: {
        isDone: !existing.isDone,
        doneAt: existing.isDone ? null : new Date(),
      },
    });
    await recalcProject(tx, existing.projectId);
  });

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/projects");
  return { success: true, message: t("updateSuccess") };
}

export async function deleteMilestoneAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.projectMilestone.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.$transaction(async (tx) => {
    await tx.projectMilestone.delete({ where: { id } });
    await recalcProject(tx, existing.projectId);
  });

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/projects");
  return { success: true, message: t("deleteSuccess") };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/actions/projectMilestone.actions.ts
git commit -m "feat: add milestone actions with progress recalculation"
```

---

## Task 6: Update-log actions with file uploads

**Files:**
- Create: `src/actions/projectUpdate.actions.ts`

**Interfaces:**
- Consumes: `recalcProject`, `round2`; `pairFilesWithNames`, `PendingAttachment` from `src/lib/attachments.ts`; `saveUpload` from `src/lib/uploads.ts`; `ProjectActionState`.
- Produces:
  - `addUpdateAction(projectId: number, prev: ProjectActionState, formData: FormData): Promise<ProjectActionState>`
  - `deleteUpdateAction(id: number): Promise<ProjectActionState>`
  - `addProjectFilesAction(projectId: number, prev: ProjectActionState, formData: FormData): Promise<ProjectActionState>`
  - `deleteProjectAttachmentAction(id: number): Promise<ProjectActionState>`

- [ ] **Step 1: Create `src/actions/projectUpdate.actions.ts` — header and upload guards**

Mirrors `repair.actions.ts:157-180`: same PDF-only allow-list and 10MB cap, validated **before** any row is written so a rejected file never leaves an orphaned update behind.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { pairFilesWithNames, type PendingAttachment } from "@/lib/attachments";
import { recalcProject } from "@/lib/projects";
import type { ProjectActionState } from "./project.actions";

// Same policy as RepairAttachment, from the same reasoning: PDF only.
const EXT_FOR_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

class AttachmentError extends Error {}

function readFiles(formData: FormData): PendingAttachment[] {
  // One `docNames` input is rendered per selected file, in FileList order,
  // so the two arrays line up by index.
  return pairFilesWithNames(formData.getAll("files"), formData.getAll("docNames"));
}

async function assertAttachmentsValid(pending: PendingAttachment[]) {
  const t = await getTranslations("ProjectActions");
  for (const { file } of pending) {
    if (!EXT_FOR_MIME[file.type]) throw new AttachmentError(t("fileTypeError"));
    if (file.size > MAX_FILE_SIZE) throw new AttachmentError(t("fileTooLarge"));
  }
}

/**
 * Writes the files to disk and the rows to the DB. `updateId` is null for
 * project-level documents and set for files posted with an update entry.
 */
async function saveAttachments(
  tx: Prisma.TransactionClient,
  pending: PendingAttachment[],
  projectId: number,
  updateId: number | null,
  userId: string
) {
  for (const { file, docName } of pending) {
    const ext = EXT_FOR_MIME[file.type];
    const url = await saveUpload(file, "projects", ext);
    await tx.projectAttachment.create({
      data: {
        projectId,
        updateId,
        docName,
        fileUrl:      url,
        fileName:     file.name,
        mimeType:     file.type,
        uploadedById: userId,
      },
    });
  }
}
```

- [ ] **Step 2: Add `addUpdateAction`**

```ts
const updateSchema = z.object({
  note: z.string().min(1),
  cost: z.number().min(0),
});

export async function addUpdateAction(
  projectId: number,
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  const userId = session?.user?.id;
  if (!userId) return { success: false, message: t("loginRequired") };

  const costRaw = formData.get("cost");
  const parsed = updateSchema.safeParse({
    note: formData.get("note") ?? "",
    cost: costRaw === null || costRaw === "" ? 0 : Number(costRaw),
  });
  if (!parsed.success) return { success: false, message: t("noteRequired") };

  const pending = readFiles(formData);
  try {
    await assertAttachmentsValid(pending);
  } catch (e) {
    if (e instanceof AttachmentError) return { success: false, message: e.message };
    throw e;
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.projectUpdate.create({
      data: {
        projectId,
        note:        parsed.data.note,
        cost:        parsed.data.cost,
        createdById: userId,
      },
    });
    await saveAttachments(tx, pending, projectId, created.id, userId);
    // The new cost row changes actualCost.
    await recalcProject(tx, projectId);
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/projects/overview");
  return { success: true, message: t("updateAdded") };
}
```

- [ ] **Step 3: Add the three delete/upload actions**

```ts
export async function deleteUpdateAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.projectUpdate.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.$transaction(async (tx) => {
    // Attachments cascade from the schema.
    await tx.projectUpdate.delete({ where: { id } });
    await recalcProject(tx, existing.projectId);
  });

  revalidatePath(`/projects/${existing.projectId}`);
  revalidatePath("/projects");
  return { success: true, message: t("deleteSuccess") };
}

/** Project-level documents: no update row, `updateId` stays null. */
export async function addProjectFilesAction(
  projectId: number,
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  const userId = session?.user?.id;
  if (!userId) return { success: false, message: t("loginRequired") };

  const pending = readFiles(formData);
  if (pending.length === 0) return { success: false, message: t("noFiles") };

  try {
    await assertAttachmentsValid(pending);
  } catch (e) {
    if (e instanceof AttachmentError) return { success: false, message: e.message };
    throw e;
  }

  await prisma.$transaction(async (tx) => {
    await saveAttachments(tx, pending, projectId, null, userId);
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: t("filesAdded") };
}

export async function deleteProjectAttachmentAction(id: number): Promise<ProjectActionState> {
  const session = await auth();
  const t = await getTranslations("ProjectActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.projectAttachment.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  await prisma.projectAttachment.delete({ where: { id } });

  revalidatePath(`/projects/${existing.projectId}`);
  return { success: true, message: t("deleteSuccess") };
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/actions/projectUpdate.actions.ts
git commit -m "feat: add project update log actions with file attachments"
```

---

## Task 7: List page, filters, badges, progress bar

**Files:**
- Create: `src/components/projects/ProjectStatusBadge.tsx`, `src/components/projects/ProgressBar.tsx`, `src/components/projects/ProjectFilters.tsx`, `src/components/projects/ProjectRow.tsx`, `src/app/(dashboard)/projects/page.tsx`

**Interfaces:**
- Consumes: `getProjects`, `deleteProjectAction`, `ProjectListRow` from `project.actions.ts`; `PROJECT_STATUSES`, `PROJECT_PRIORITIES`.
- Produces: `<ProjectStatusBadge status priority? />`, `<ProgressBar value />`, `<ProjectFilters departments />`, `<ProjectRow project canDelete />`.

- [ ] **Step 1: Create `src/components/projects/ProjectStatusBadge.tsx`**

Mirrors `RepairStatusBadge.tsx` exactly, including the `Projects` translation namespace and `status<ENUM>` key convention.

```tsx
import { ProjectStatus, ProjectPriority } from "@prisma/client";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  PLANNING:    "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  ON_HOLD:     "bg-slate-200 text-slate-600",
  DONE:        "bg-emerald-100 text-emerald-700",
  CANCELLED:   "bg-red-100 text-red-700",
};

const PRIORITY_STYLES: Record<ProjectPriority, string> = {
  LOW:    "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH:   "bg-orange-100 text-orange-700",
};

const PILL = "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslations("Projects");
  return <span className={clsx(PILL, STATUS_STYLES[status])}>{t(`status${status}`)}</span>;
}

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  const t = useTranslations("Projects");
  return <span className={clsx(PILL, PRIORITY_STYLES[priority])}>{t(`priority${priority}`)}</span>;
}
```

- [ ] **Step 2: Create `src/components/projects/ProgressBar.tsx`**

```tsx
import { clsx } from "clsx";

/**
 * `value` is always the derived Project.progress, 0-100. Never accepts a
 * hand-typed number — see the Global Constraints.
 */
export default function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 min-w-[7rem]">
      <div
        className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={clsx("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-[#1e3a5f]")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-500 w-9 text-right">{pct}%</span>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/projects/ProjectFilters.tsx`**

Follow the existing `RepairFilters.tsx` pattern: a Client Component that pushes query params, debounced search.

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PROJECT_STATUSES, PROJECT_PRIORITIES } from "@/lib/project-constants";

export default function ProjectFilters({
  departments,
}: {
  departments: { id: number; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("ProjectFilters");
  const tp = useTranslations("Projects");

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/projects?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
      <input
        className="input max-w-xs"
        placeholder={t("searchPlaceholder")}
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => set("q", e.target.value)}
      />
      <select className="input w-auto" defaultValue={params.get("status") ?? ""}
              onChange={(e) => set("status", e.target.value)}>
        <option value="">{t("allStatuses")}</option>
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>{tp(`status${s}`)}</option>
        ))}
      </select>
      <select className="input w-auto" defaultValue={params.get("priority") ?? ""}
              onChange={(e) => set("priority", e.target.value)}>
        <option value="">{t("allPriorities")}</option>
        {PROJECT_PRIORITIES.map((p) => (
          <option key={p} value={p}>{tp(`priority${p}`)}</option>
        ))}
      </select>
      <select className="input w-auto" defaultValue={params.get("departmentId") ?? ""}
              onChange={(e) => set("departmentId", e.target.value)}>
        <option value="">{t("allDepartments")}</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/projects/ProjectRow.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteProjectAction, type ProjectListRow } from "@/actions/project.actions";
import { ProjectStatusBadge, ProjectPriorityBadge } from "./ProjectStatusBadge";
import ProgressBar from "./ProgressBar";

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProjectRow({
  project,
  canDelete,
}: {
  project: ProjectListRow;
  canDelete: boolean;
}) {
  const t = useTranslations("Projects");
  const [pending, start] = useTransition();

  function onDelete() {
    if (!confirm(t("confirmDelete", { name: project.name }))) return;
    start(async () => {
      const res = await deleteProjectAction(project.id);
      if (!res.success) alert(res.message);
    });
  }

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-5 py-3 font-medium text-slate-700 whitespace-nowrap">
        <Link href={`/projects/${project.id}`} className="hover:underline">{project.code}</Link>
      </td>
      <td className="px-4 py-3">
        <Link href={`/projects/${project.id}`} className="hover:underline">{project.name}</Link>
        {project.atRisk && (
          <AlertTriangle size={14} className="inline ml-1.5 -mt-0.5 text-orange-500" aria-label={t("atRisk")} />
        )}
      </td>
      <td className="px-4 py-3 text-slate-500">{project.departmentName ?? "-"}</td>
      <td className="px-4 py-3 text-slate-500">{project.ownerName ?? "-"}</td>
      <td className="px-4 py-3"><ProjectPriorityBadge priority={project.priority} /></td>
      <td className="px-4 py-3"><ProjectStatusBadge status={project.status} /></td>
      <td className="px-4 py-3"><ProgressBar value={project.progress} /></td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
        {project.dueDate ? project.dueDate.toLocaleDateString("th-TH") : "-"}
      </td>
      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{money(project.actualCost)}</td>
      <td className="px-4 py-3 text-right">
        {canDelete && (
          <button onClick={onDelete} disabled={pending}
                  className="text-slate-400 hover:text-red-600 disabled:opacity-40"
                  aria-label={t("delete")}>
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  );
}
```

- [ ] **Step 5: Create `src/app/(dashboard)/projects/page.tsx`**

```tsx
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getProjects } from "@/actions/project.actions";
import ProjectFilters from "@/components/projects/ProjectFilters";
import ProjectRow from "@/components/projects/ProjectRow";

export const revalidate = 0;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; departmentId?: string }>;
}) {
  const params = await searchParams;
  const [projects, departments, t, session] = await Promise.all([
    getProjects(params),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getTranslations("Projects"),
    auth(),
  ]);
  const canDelete = (session?.user as any)?.role === "ADMIN";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: projects.length })}</p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <PlusCircle size={16} />
          {t("addNew")}
        </Link>
      </div>

      <div className="card overflow-hidden">
        <ProjectFilters departments={departments} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colCode")}</th>
                <th className="px-4 py-3 font-medium">{t("colName")}</th>
                <th className="px-4 py-3 font-medium">{t("colDepartment")}</th>
                <th className="px-4 py-3 font-medium">{t("colOwner")}</th>
                <th className="px-4 py-3 font-medium">{t("colPriority")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("colProgress")}</th>
                <th className="px-4 py-3 font-medium">{t("colDueDate")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("colActualCost")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <ProjectRow key={p.id} project={p} canDelete={canDelete} />
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-400">
                    {t("empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/projects src/app/\(dashboard\)/projects/page.tsx
git commit -m "feat: add project list page with filters and status badges"
```

---

## Task 8: Create/edit form and pages

**Files:**
- Create: `src/components/projects/ProjectForm.tsx`, `src/app/(dashboard)/projects/new/page.tsx`, `src/app/(dashboard)/projects/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `createProjectAction`, `updateProjectAction`, `getProject`, `ProjectDetail`.
- Produces: `<ProjectForm departments users project? />` — omit `project` to create.

- [ ] **Step 1: Create `src/components/projects/ProjectForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { createProjectAction, updateProjectAction, type ProjectActionState, type ProjectDetail } from "@/actions/project.actions";
import { PROJECT_STATUSES, PROJECT_PRIORITIES } from "@/lib/project-constants";

const EMPTY: ProjectActionState = { success: false, message: "" };

/** yyyy-mm-dd for <input type="date">, in local time. */
function isoDate(d: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

export default function ProjectForm({
  departments,
  users,
  project,
}: {
  departments: { id: number; name: string }[];
  users: { id: string; label: string }[];
  project?: ProjectDetail;
}) {
  const t = useTranslations("ProjectForm");
  const tp = useTranslations("Projects");
  const router = useRouter();

  const action = project
    ? updateProjectAction.bind(null, project.id)
    : createProjectAction;
  const [state, formAction, pending] = useActionState(action, EMPTY);

  useEffect(() => {
    if (state.success) router.push(project ? `/projects/${project.id}` : "/projects");
  }, [state.success, project, router]);

  return (
    <form action={formAction} className="card p-6 space-y-4 max-w-3xl">
      {state.message && !state.success && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <div>
        <label className="label" htmlFor="name">{t("name")}</label>
        <input id="name" name="name" className="input" required
               defaultValue={project?.name ?? ""} />
        {state.errors?.name && <p className="text-xs text-red-600 mt-1">{state.errors.name[0]}</p>}
      </div>

      <div>
        <label className="label" htmlFor="details">{t("details")}</label>
        <textarea id="details" name="details" rows={4} className="input"
                  defaultValue={project?.details ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="startDate">{t("startDate")}</label>
          <input id="startDate" name="startDate" type="date" className="input" required
                 defaultValue={isoDate(project?.startDate ?? null)} />
          {state.errors?.startDate && <p className="text-xs text-red-600 mt-1">{state.errors.startDate[0]}</p>}
        </div>
        <div>
          <label className="label" htmlFor="dueDate">{t("dueDate")}</label>
          <input id="dueDate" name="dueDate" type="date" className="input"
                 defaultValue={isoDate(project?.dueDate ?? null)} />
          {state.errors?.dueDate && <p className="text-xs text-red-600 mt-1">{state.errors.dueDate[0]}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="departmentId">{t("department")}</label>
          <select id="departmentId" name="departmentId" className="input"
                  defaultValue={project?.departmentId ?? ""}>
            <option value="">{t("none")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ownerId">{t("owner")}</label>
          <select id="ownerId" name="ownerId" className="input" defaultValue={project?.ownerId ?? ""}>
            <option value="">{t("none")}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="status">{t("status")}</label>
          <select id="status" name="status" className="input" defaultValue={project?.status ?? "PLANNING"}>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{tp(`status${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="priority">{t("priority")}</label>
          <select id="priority" name="priority" className="input" defaultValue={project?.priority ?? "MEDIUM"}>
            {PROJECT_PRIORITIES.map((p) => <option key={p} value={p}>{tp(`priority${p}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="budget">{t("budget")}</label>
          <input id="budget" name="budget" type="number" step="0.01" min="0" className="input"
                 defaultValue={project?.budget ?? 0} />
          {state.errors?.budget && <p className="text-xs text-red-600 mt-1">{state.errors.budget[0]}</p>}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="atRisk" defaultChecked={project?.atRisk ?? false} />
        {t("atRisk")}
      </label>

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
```

Note: `progress` and `actualCost` have no inputs here, by design.

- [ ] **Step 2: Create `src/app/(dashboard)/projects/new/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import ProjectForm from "@/components/projects/ProjectForm";

export const revalidate = 0;

export default async function NewProjectPage() {
  const [departments, users, t] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    getTranslations("Projects"),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("addNew")}</h1>
      <ProjectForm
        departments={departments}
        users={users.map((u) => ({ id: u.id, label: u.name ?? u.email }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/projects/[id]/edit/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getProject } from "@/actions/project.actions";
import ProjectForm from "@/components/projects/ProjectForm";

export const revalidate = 0;

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const [project, departments, users, t] = await Promise.all([
    getProject(projectId),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    getTranslations("Projects"),
  ]);
  if (!project) notFound();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("editTitle", { code: project.code })}</h1>
      <ProjectForm
        departments={departments}
        users={users.map((u) => ({ id: u.id, label: u.name ?? u.email }))}
        project={project}
      />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual check**

With `npm run dev` running, open `/projects/new`, fill name + start date, submit. Expected: redirect to `/projects`, one row present, code `PJ-2026-001`. Create a second: code `PJ-2026-002`. Set a due date earlier than the start date: expected inline error `dueBeforeStart`, no row written.

- [ ] **Step 6: Commit**

```bash
git add src/components/projects/ProjectForm.tsx "src/app/(dashboard)/projects/new" "src/app/(dashboard)/projects/[id]/edit"
git commit -m "feat: add project create and edit forms"
```

---

## Task 9: Detail page — timeline, milestones, update log, files

**Files:**
- Create: `src/components/projects/ProjectTimeline.tsx`, `src/components/projects/MilestoneEditor.tsx`, `src/components/projects/UpdateLog.tsx`, `src/components/projects/ProjectAttachments.tsx`, `src/components/projects/ProjectStatusSelect.tsx`, `src/app/(dashboard)/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: `getProject`, `ProjectDetail`, `changeProjectStatusAction`, milestone actions, update actions, `TRANSITIONS`.
- Produces: the detail route.

- [ ] **Step 1: Create `src/components/projects/ProjectTimeline.tsx`**

Pure CSS grid — no chart library. Milestones without dates render as a muted row rather than a zero-width bar.

```tsx
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import type { ProjectDetail } from "@/actions/project.actions";

const DAY = 24 * 60 * 60 * 1000;

export default function ProjectTimeline({ project }: { project: ProjectDetail }) {
  const t = useTranslations("ProjectTimeline");
  const dated = project.milestones.filter((m) => m.startDate && m.endDate);
  const undated = project.milestones.filter((m) => !m.startDate || !m.endDate);

  if (project.milestones.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">{t("noMilestones")}</p>;
  }

  // Window spans the project dates plus every dated milestone, so a milestone
  // running past the due date is still fully visible.
  const starts = [project.startDate, ...dated.map((m) => m.startDate!)];
  const ends = [
    ...(project.dueDate ? [project.dueDate] : []),
    ...dated.map((m) => m.endDate!),
    project.startDate,
  ];
  const min = new Date(Math.min(...starts.map((d) => d.getTime())));
  const max = new Date(Math.max(...ends.map((d) => d.getTime())));
  const totalDays = Math.max(1, Math.round((max.getTime() - min.getTime()) / DAY) + 1);

  return (
    <div className="space-y-2">
      {dated.map((m) => {
        const offset = Math.round((m.startDate!.getTime() - min.getTime()) / DAY);
        const span = Math.max(1, Math.round((m.endDate!.getTime() - m.startDate!.getTime()) / DAY) + 1);
        return (
          <div key={m.id} className="grid grid-cols-[10rem_1fr_9rem] items-center gap-3 text-sm">
            <span className={clsx("truncate", m.isDone ? "text-slate-400 line-through" : "text-slate-700")}>
              {m.name}
            </span>
            {/* Hidden on small screens: bars are unreadable below ~640px. */}
            <div className="hidden sm:grid h-5" style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}>
              <div
                className={clsx("rounded-full h-2 self-center", m.isDone ? "bg-emerald-500" : "bg-[#1e3a5f]")}
                style={{ gridColumn: `${offset + 1} / span ${span}` }}
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap text-right">
              {m.startDate!.toLocaleDateString("th-TH")} – {m.endDate!.toLocaleDateString("th-TH")}
            </span>
          </div>
        );
      })}

      {undated.map((m) => (
        <div key={m.id} className="grid grid-cols-[10rem_1fr_9rem] items-center gap-3 text-sm">
          <span className={clsx("truncate", m.isDone ? "text-slate-400 line-through" : "text-slate-700")}>
            {m.name}
          </span>
          <span className="hidden sm:block text-xs text-slate-300 italic">{t("noDates")}</span>
          <span className="text-xs text-slate-400 text-right">—</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/projects/MilestoneEditor.tsx`**

```tsx
"use client";

import { useActionState, useTransition } from "react";
import { Check, Circle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import {
  addMilestoneAction, toggleMilestoneAction, deleteMilestoneAction,
} from "@/actions/projectMilestone.actions";
import type { ProjectActionState, ProjectDetail } from "@/actions/project.actions";

const EMPTY: ProjectActionState = { success: false, message: "" };

export default function MilestoneEditor({ project }: { project: ProjectDetail }) {
  const t = useTranslations("ProjectMilestones");
  const [state, formAction, pending] = useActionState(
    addMilestoneAction.bind(null, project.id),
    EMPTY
  );
  const [busy, start] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100">
        {project.milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <button
              onClick={() => start(async () => { await toggleMilestoneAction(m.id); })}
              disabled={busy}
              aria-label={m.isDone ? t("markNotDone") : t("markDone")}
              className={clsx("shrink-0", m.isDone ? "text-emerald-600" : "text-slate-300 hover:text-slate-500")}
            >
              {m.isDone ? <Check size={18} /> : <Circle size={18} />}
            </button>
            <span className={clsx("flex-1 text-sm", m.isDone && "text-slate-400 line-through")}>
              {m.name}
            </span>
            <button
              onClick={() => start(async () => { await deleteMilestoneAction(m.id); })}
              disabled={busy}
              aria-label={t("delete")}
              className="text-slate-300 hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {project.milestones.length === 0 && (
          <li className="py-3 text-sm text-slate-400">{t("empty")}</li>
        )}
      </ul>

      {state.message && !state.success && (
        <p className="text-xs text-red-600">{state.message}</p>
      )}

      <form action={formAction} className="flex flex-wrap gap-2">
        <input name="name" className="input flex-1 min-w-[10rem]" placeholder={t("namePlaceholder")} required />
        <input name="startDate" type="date" className="input w-auto" aria-label={t("startDate")} />
        <input name="endDate" type="date" className="input w-auto" aria-label={t("endDate")} />
        <button type="submit" className="btn-primary" disabled={pending}>{t("add")}</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/projects/UpdateLog.tsx`**

```tsx
"use client";

import { useActionState, useTransition } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { addUpdateAction, deleteUpdateAction } from "@/actions/projectUpdate.actions";
import type { ProjectActionState, ProjectDetail } from "@/actions/project.actions";

const EMPTY: ProjectActionState = { success: false, message: "" };

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function UpdateLog({ project }: { project: ProjectDetail }) {
  const t = useTranslations("ProjectUpdates");
  const [state, formAction, pending] = useActionState(
    addUpdateAction.bind(null, project.id),
    EMPTY
  );
  const [busy, start] = useTransition();

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-2">
        <textarea name="note" rows={2} className="input" placeholder={t("notePlaceholder")} required />
        <div className="flex flex-wrap gap-2">
          <input name="cost" type="number" step="0.01" min="0" defaultValue={0}
                 className="input w-32" aria-label={t("cost")} />
          {/* One docNames input per file, in FileList order — pairFilesWithNames zips by index. */}
          <input name="files" type="file" multiple accept="application/pdf" className="input flex-1" />
          <input name="docNames" className="input w-40" placeholder={t("fileLabel")} />
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? t("posting") : t("post")}
          </button>
        </div>
        {state.message && !state.success && (
          <p className="text-xs text-red-600">{state.message}</p>
        )}
      </form>

      <ul className="divide-y divide-slate-100">
        {project.updates.map((u) => (
          <li key={u.id} className="py-3 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-slate-500">
                {u.createdAt.toLocaleDateString("th-TH")} · {u.authorName}
                {u.cost > 0 && <span className="ml-2 font-medium text-slate-700">{money(u.cost)}</span>}
              </div>
              <button
                onClick={() => start(async () => { await deleteUpdateAction(u.id); })}
                disabled={busy}
                aria-label={t("delete")}
                className="text-slate-300 hover:text-red-600 shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{u.note}</p>
            {u.attachments.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1">
                {u.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.fileUrl} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                      <Paperclip size={12} />{a.docName || a.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {project.updates.length === 0 && (
          <li className="py-3 text-sm text-slate-400">{t("empty")}</li>
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/projects/ProjectAttachments.tsx`**

```tsx
"use client";

import { useActionState, useTransition } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addProjectFilesAction, deleteProjectAttachmentAction,
} from "@/actions/projectUpdate.actions";
import type { ProjectActionState, ProjectDetail } from "@/actions/project.actions";

const EMPTY: ProjectActionState = { success: false, message: "" };

// Own namespace, not the shared `Attachments` one — that is used by the repair
// and equipment modules and has a different key set (docNameLabel, hint, ...).
export default function ProjectAttachments({ project }: { project: ProjectDetail }) {
  const t = useTranslations("ProjectFiles");
  const [state, formAction, pending] = useActionState(
    addProjectFilesAction.bind(null, project.id),
    EMPTY
  );
  const [busy, start] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100">
        {project.files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-2 text-sm">
            <Paperclip size={14} className="text-slate-400 shrink-0" />
            <a href={f.fileUrl} target="_blank" rel="noreferrer" className="flex-1 text-blue-700 hover:underline truncate">
              {f.docName || f.fileName}
            </a>
            <button
              onClick={() => start(async () => { await deleteProjectAttachmentAction(f.id); })}
              disabled={busy}
              aria-label={t("delete")}
              className="text-slate-300 hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {project.files.length === 0 && <li className="py-2 text-sm text-slate-400">{t("empty")}</li>}
      </ul>

      <form action={formAction} className="flex flex-wrap gap-2">
        <input name="files" type="file" multiple accept="application/pdf" className="input flex-1" />
        <input name="docNames" className="input w-40" placeholder={t("labelPlaceholder")} />
        <button type="submit" className="btn-primary" disabled={pending}>{t("upload")}</button>
      </form>
      {state.message && !state.success && <p className="text-xs text-red-600">{state.message}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/projects/ProjectStatusSelect.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { ProjectStatus } from "@prisma/client";
import { useTranslations } from "next-intl";
import { changeProjectStatusAction } from "@/actions/project.actions";
import { TRANSITIONS } from "@/lib/project-constants";

export default function ProjectStatusSelect({
  id,
  status,
}: {
  id: number;
  status: ProjectStatus;
}) {
  const t = useTranslations("Projects");
  const [pending, start] = useTransition();
  const allowed = TRANSITIONS[status];

  return (
    <select
      className="input w-auto"
      value={status}
      disabled={pending || allowed.length === 0}
      onChange={(e) =>
        start(async () => {
          const res = await changeProjectStatusAction(id, e.target.value as ProjectStatus);
          if (!res.success) alert(res.message);
        })
      }
    >
      <option value={status}>{t(`status${status}`)}</option>
      {allowed.map((s) => (
        <option key={s} value={s}>{t(`status${s}`)}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 6: Create `src/app/(dashboard)/projects/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getProject } from "@/actions/project.actions";
import { ProjectStatusBadge, ProjectPriorityBadge } from "@/components/projects/ProjectStatusBadge";
import ProgressBar from "@/components/projects/ProgressBar";
import ProjectStatusSelect from "@/components/projects/ProjectStatusSelect";
import ProjectTimeline from "@/components/projects/ProjectTimeline";
import MilestoneEditor from "@/components/projects/MilestoneEditor";
import UpdateLog from "@/components/projects/UpdateLog";
import ProjectAttachments from "@/components/projects/ProjectAttachments";

export const revalidate = 0;

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const [project, t] = await Promise.all([
    getProject(projectId),
    getTranslations("Projects"),
  ]);
  if (!project) notFound();

  const variance = project.budget - project.actualCost;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">{project.code}</p>
          <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <ProjectStatusBadge status={project.status} />
            <ProjectPriorityBadge priority={project.priority} />
            {project.atRisk && (
              <span className="rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5 text-xs font-semibold">
                {t("atRisk")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProjectStatusSelect id={project.id} status={project.status} />
          <Link href={`/projects/${project.id}/edit`} className="btn-primary">
            <Pencil size={15} />{t("edit")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("colProgress")}</p>
          <div className="mt-2"><ProgressBar value={project.progress} /></div>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("colBudget")}</p>
          <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{money(project.budget)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("colActualCost")}</p>
          <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{money(project.actualCost)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("variance")}</p>
          <p className={`text-lg font-bold mt-1 tabular-nums ${variance < 0 ? "text-red-600" : "text-emerald-600"}`}>
            {money(variance)}
          </p>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">{t("sectionDetails")}</h2>
        <dl className="grid gap-3 sm:grid-cols-3 text-sm">
          <div><dt className="text-slate-500">{t("colDepartment")}</dt><dd>{project.departmentName ?? "-"}</dd></div>
          <div><dt className="text-slate-500">{t("colOwner")}</dt><dd>{project.ownerName ?? "-"}</dd></div>
          <div><dt className="text-slate-500">{t("colStartDate")}</dt><dd>{project.startDate.toLocaleDateString("th-TH")}</dd></div>
          <div><dt className="text-slate-500">{t("colDueDate")}</dt><dd>{project.dueDate?.toLocaleDateString("th-TH") ?? "-"}</dd></div>
          <div><dt className="text-slate-500">{t("colFinishedAt")}</dt><dd>{project.finishedAt?.toLocaleDateString("th-TH") ?? "-"}</dd></div>
        </dl>
        {project.details && <p className="text-sm text-slate-700 whitespace-pre-wrap pt-2">{project.details}</p>}
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">{t("sectionTimeline")}</h2>
        <ProjectTimeline project={project} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">{t("sectionMilestones")}</h2>
          <MilestoneEditor project={project} />
        </div>
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">{t("sectionFiles")}</h2>
          <ProjectAttachments project={project} />
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">{t("sectionUpdates")}</h2>
        <UpdateLog project={project} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Manual check**

Open a project. Add 4 milestones, tick 3. Expected: progress reads 75% here and on `/projects`. Post an update with cost 1500 and a PDF. Expected: actual cost 1500, variance updates, the PDF downloads. Try attaching a `.png`: expected `fileTypeError`, no update row created.

- [ ] **Step 9: Commit**

```bash
git add src/components/projects "src/app/(dashboard)/projects/[id]/page.tsx"
git commit -m "feat: add project detail page with timeline, milestones, and update log"
```

---

## Task 10: Overview page

**Files:**
- Create: `src/app/(dashboard)/projects/overview/page.tsx`

**Interfaces:**
- Consumes: `getProjectStats`, `getProjects`.

- [ ] **Step 1: Create `src/app/(dashboard)/projects/overview/page.tsx`**

```tsx
import Link from "next/link";
import { AlertTriangle, CalendarClock, FolderKanban, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getProjectStats, getProjects } from "@/actions/project.actions";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import ProgressBar from "@/components/projects/ProgressBar";

export const revalidate = 0;

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ProjectOverviewPage() {
  const [stats, all, t] = await Promise.all([
    getProjectStats(),
    getProjects({}),
    getTranslations("ProjectOverview"),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attention = all.filter(
    (p) =>
      p.status !== "DONE" &&
      p.status !== "CANCELLED" &&
      (p.atRisk || (p.dueDate !== null && p.dueDate < today))
  );

  const cards = [
    { key: "open",         value: String(stats.open),         icon: FolderKanban,  tone: "text-[#1e3a5f]" },
    { key: "overdue",      value: String(stats.overdue),      icon: CalendarClock, tone: "text-red-600" },
    { key: "atRisk",       value: String(stats.atRisk),       icon: AlertTriangle, tone: "text-orange-600" },
    { key: "doneThisYear", value: String(stats.doneThisYear), icon: CheckCircle2,  tone: "text-emerald-600" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="card p-4 flex items-center gap-3">
              <Icon size={22} className={c.tone} />
              <div>
                <p className="text-xs text-slate-500">{t(c.key)}</p>
                <p className="text-xl font-bold text-slate-900">{c.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("budgetTotal")}</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{money(stats.budgetTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("actualTotal")}</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{money(stats.actualTotal)}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{t("needsAttention")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {attention.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-5 py-3">
                    <Link href={`/projects/${p.id}`} className="hover:underline font-medium">{p.name}</Link>
                    <span className="text-xs text-slate-400 ml-2">{p.code}</span>
                  </td>
                  <td className="px-4 py-3"><ProjectStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3"><ProgressBar value={p.progress} /></td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {p.dueDate ? p.dueDate.toLocaleDateString("th-TH") : "-"}
                  </td>
                </tr>
              ))}
              {attention.length === 0 && (
                <tr><td className="px-5 py-8 text-center text-slate-400">{t("allClear")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/projects/overview"
git commit -m "feat: add project overview page"
```

---

## Task 11: Reports page and Excel export

**Files:**
- Create: `src/actions/projectReport.actions.ts`, `src/app/(dashboard)/projects/reports/page.tsx`, `src/app/api/projects/reports/route.ts`
- Modify: `src/lib/reportColumns.ts`

**Interfaces:**
- Consumes: `buildExcelReport`, `ExcelColumn` from `src/lib/reportExport.ts`.
- Produces: `type ProjectReportRow`, `getProjectReport(year, status?)`, `PROJECT_EXCEL_COLUMNS`.

- [ ] **Step 1: Create `src/actions/projectReport.actions.ts`**

```ts
"use server";

import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProjectReportRow = {
  code: string;
  name: string;
  department: string;
  owner: string;
  status: ProjectStatus;
  priority: string;
  startDate: Date;
  dueDate: Date | null;
  finishedAt: Date | null;
  /** Positive = late. Null when there is nothing to measure against. */
  daysLate: number | null;
  budget: number;
  actualCost: number;
  variance: number;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * `daysLate` is finishedAt - dueDate for finished projects, today - dueDate
 * for unfinished ones already past due, and null otherwise.
 */
function daysLate(dueDate: Date | null, finishedAt: Date | null, today: Date): number | null {
  if (!dueDate) return null;
  const end = finishedAt ?? today;
  const diff = Math.round((end.getTime() - dueDate.getTime()) / DAY);
  if (!finishedAt && diff <= 0) return null;
  return diff;
}

export async function getProjectReport(
  year: number,
  status?: string
): Promise<{ rows: ProjectReportRow[] }> {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: any = { startDate: { gte: from, lt: to } };
  if (status && status in ProjectStatus) where.status = status as ProjectStatus;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { startDate: "asc" },
    include: {
      department: { select: { name: true } },
      owner:      { select: { name: true, email: true } },
    },
  });

  const rows = projects.map((p) => {
    const budget = Number(p.budget);
    const actualCost = Number(p.actualCost);
    return {
      code: p.code,
      name: p.name,
      department: p.department?.name ?? "-",
      owner: p.owner?.name ?? p.owner?.email ?? "-",
      status: p.status,
      priority: p.priority,
      startDate: p.startDate,
      dueDate: p.dueDate,
      finishedAt: p.finishedAt,
      daysLate: daysLate(p.dueDate, p.finishedAt, today),
      budget,
      actualCost,
      variance: budget - actualCost,
    };
  });

  return { rows };
}
```

- [ ] **Step 2: Add the Excel column definitions to `src/lib/reportColumns.ts`**

Add the import at the top, next to the existing type imports:

```ts
import type { ProjectReportRow } from "@/actions/projectReport.actions";
```

Then append at the end of the file:

```ts
export const PROJECT_EXCEL_COLUMNS: ExcelColumn<ProjectReportRow>[] = [
  { header: "Code",        key: "code",       width: 16, value: (r) => r.code },
  { header: "Project",     key: "name",       width: 32, value: (r) => r.name },
  { header: "Department",  key: "department", width: 18, value: (r) => r.department },
  { header: "Owner",       key: "owner",      width: 20, value: (r) => r.owner },
  { header: "Status",      key: "status",     width: 14, value: (r) => r.status },
  { header: "Priority",    key: "priority",   width: 10, value: (r) => r.priority },
  { header: "Start",       key: "start",      width: 14, value: (r) => r.startDate.toLocaleDateString("th-TH") },
  { header: "Due",         key: "due",        width: 14, value: (r) => r.dueDate?.toLocaleDateString("th-TH") ?? "" },
  { header: "Finished",    key: "finished",   width: 14, value: (r) => r.finishedAt?.toLocaleDateString("th-TH") ?? "" },
  { header: "Days Late",   key: "daysLate",   width: 11, value: (r) => r.daysLate ?? "" },
  { header: "Budget",      key: "budget",     width: 14, numFmt: "#,##0.00", value: (r) => r.budget },
  { header: "Actual",      key: "actual",     width: 14, numFmt: "#,##0.00", value: (r) => r.actualCost },
  { header: "Variance",    key: "variance",   width: 14, numFmt: "#,##0.00", value: (r) => r.variance },
];
```

- [ ] **Step 3: Create `src/app/api/projects/reports/route.ts`**

Mirrors `src/app/api/repairs/reports/route.ts`, Excel only.

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProjectReport } from "@/actions/projectReport.actions";
import { buildExcelReport } from "@/lib/reportExport";
import { PROJECT_EXCEL_COLUMNS } from "@/lib/reportColumns";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const status = sp.get("status") ?? undefined;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ message: "ปีไม่ถูกต้อง" }, { status: 400 });
  }
  if (sp.get("format") !== "excel") {
    return NextResponse.json({ message: "รูปแบบไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  const { rows } = await getProjectReport(year, status);
  const buffer = await buildExcelReport(`รายงานโครงการ ${year}`, PROJECT_EXCEL_COLUMNS, rows);

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="project-report-${year}.xlsx"`,
    },
  });
}
```

- [ ] **Step 4: Create `src/app/(dashboard)/projects/reports/page.tsx`**

```tsx
import Link from "next/link";
import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getProjectReport } from "@/actions/projectReport.actions";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";

export const revalidate = 0;

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ProjectReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string }>;
}) {
  const params = await searchParams;
  const year = Number(params.year) || new Date().getFullYear();

  const [{ rows }, t] = await Promise.all([
    getProjectReport(year, params.status),
    getTranslations("ProjectReports"),
  ]);

  const totals = rows.reduce(
    (a, r) => ({ budget: a.budget + r.budget, actual: a.actual + r.actualCost }),
    { budget: 0, actual: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{t("title", { year })}</h1>
        <Link
          href={`/api/projects/reports?year=${year}${params.status ? `&status=${params.status}` : ""}&format=excel`}
          className="btn-primary"
        >
          <Download size={16} />{t("exportExcel")}
        </Link>
      </div>

      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">{t("colCode")}</th>
              <th className="px-4 py-3 font-medium">{t("colName")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("colDue")}</th>
              <th className="px-4 py-3 font-medium">{t("colFinished")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("colDaysLate")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("colBudget")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("colActual")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("colVariance")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-t border-slate-100">
                <td className="px-5 py-3 whitespace-nowrap">{r.code}</td>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3"><ProjectStatusBadge status={r.status} /></td>
                <td className="px-4 py-3 whitespace-nowrap">{r.dueDate?.toLocaleDateString("th-TH") ?? "-"}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.finishedAt?.toLocaleDateString("th-TH") ?? "-"}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${r.daysLate && r.daysLate > 0 ? "text-red-600" : ""}`}>
                  {r.daysLate ?? "-"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.budget)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.actualCost)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${r.variance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {money(r.variance)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-400">{t("empty")}</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="px-5 py-3" colSpan={6}>{t("total")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totals.budget)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totals.actual)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(totals.budget - totals.actual)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck and manual check**

Run: `npx tsc --noEmit`
Expected: PASS.

Open `/projects/reports`. Expected: the projects created earlier are listed. Click Export Excel — a `project-report-2026.xlsx` downloads and opens with 13 columns.

- [ ] **Step 6: Commit**

```bash
git add src/actions/projectReport.actions.ts src/lib/reportColumns.ts "src/app/(dashboard)/projects/reports" src/app/api/projects
git commit -m "feat: add project reports page and Excel export"
```

---

## Task 12: Translations and final sweep

**Files:**
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: every `t("...")` key used in Tasks 4-11.

- [ ] **Step 1: Add the eight namespaces to `messages/en.json`**

```json
  "Projects": {
    "title": "Projects",
    "addNew": "New Project",
    "editTitle": "Edit {code}",
    "edit": "Edit",
    "delete": "Delete",
    "empty": "No projects yet",
    "itemsCount": "{count} projects",
    "atRisk": "At risk",
    "variance": "Variance",
    "confirmDelete": "Delete project \"{name}\"? This also deletes its milestones, updates and files.",
    "colCode": "Code",
    "colName": "Project",
    "colDepartment": "Department",
    "colOwner": "Owner",
    "colPriority": "Priority",
    "colStatus": "Status",
    "colProgress": "Progress",
    "colStartDate": "Start Date",
    "colDueDate": "Due Date",
    "colFinishedAt": "Finished",
    "colBudget": "Budget",
    "colActualCost": "Actual Cost",
    "sectionDetails": "Details",
    "sectionTimeline": "Timeline",
    "sectionMilestones": "Milestones",
    "sectionUpdates": "Update Log",
    "sectionFiles": "Files",
    "statusPLANNING": "Planning",
    "statusIN_PROGRESS": "In Progress",
    "statusON_HOLD": "On Hold",
    "statusDONE": "Done",
    "statusCANCELLED": "Cancelled",
    "priorityLOW": "Low",
    "priorityMEDIUM": "Medium",
    "priorityHIGH": "High"
  },
  "ProjectForm": {
    "name": "Project Name",
    "details": "Details",
    "startDate": "Start Date",
    "dueDate": "Due Date",
    "department": "Department",
    "owner": "Owner",
    "status": "Status",
    "priority": "Priority",
    "budget": "Budget",
    "atRisk": "Flag this project as at risk",
    "none": "— None —",
    "save": "Save",
    "saving": "Saving..."
  },
  "ProjectFilters": {
    "searchPlaceholder": "Search name or code...",
    "allStatuses": "All statuses",
    "allPriorities": "All priorities",
    "allDepartments": "All departments"
  },
  "ProjectTimeline": {
    "noMilestones": "Add milestones to see the timeline",
    "noDates": "no dates set"
  },
  "ProjectMilestones": {
    "empty": "No milestones yet",
    "namePlaceholder": "Milestone name",
    "startDate": "Start date",
    "endDate": "End date",
    "add": "Add",
    "delete": "Delete milestone",
    "markDone": "Mark as done",
    "markNotDone": "Mark as not done"
  },
  "ProjectUpdates": {
    "empty": "No updates yet",
    "notePlaceholder": "What happened?",
    "cost": "Cost",
    "fileLabel": "File label",
    "post": "Post",
    "posting": "Posting...",
    "delete": "Delete update"
  },
  "ProjectOverview": {
    "title": "Project Overview",
    "open": "Open Projects",
    "overdue": "Overdue",
    "atRisk": "At Risk",
    "doneThisYear": "Finished This Year",
    "budgetTotal": "Total Budget (open)",
    "actualTotal": "Total Spent (open)",
    "needsAttention": "Needs Attention",
    "allClear": "Nothing overdue or at risk"
  },
  "ProjectReports": {
    "title": "Project Report {year}",
    "exportExcel": "Export Excel",
    "empty": "No projects in this period",
    "total": "Total",
    "colCode": "Code",
    "colName": "Project",
    "colStatus": "Status",
    "colDue": "Due",
    "colFinished": "Finished",
    "colDaysLate": "Days Late",
    "colBudget": "Budget",
    "colActual": "Actual",
    "colVariance": "Variance"
  },
  "ProjectActions": {
    "loginRequired": "Please sign in first",
    "forbidden": "Administrators only",
    "invalidData": "Please check the form",
    "notFound": "Project not found",
    "nameRequired": "Project name is required",
    "startDateRequired": "Start date is required",
    "budgetInvalid": "Budget must be zero or more",
    "dueBeforeStart": "Due date cannot be before the start date",
    "endBeforeStart": "End date cannot be before the start date",
    "milestoneNameRequired": "Milestone name is required",
    "noteRequired": "Update note is required",
    "noFiles": "Choose at least one file",
    "fileTypeError": "PDF files only",
    "fileTooLarge": "File must be smaller than 10MB",
    "illegalTransition": "That status change is not allowed",
    "createSuccess": "Project created",
    "updateSuccess": "Saved",
    "deleteSuccess": "Deleted",
    "milestoneAdded": "Milestone added",
    "updateAdded": "Update posted",
    "filesAdded": "Files uploaded"
  }
```

- [ ] **Step 2: Add the same namespaces to `messages/th.json`**

```json
  "Projects": {
    "title": "โครงการ",
    "addNew": "เพิ่มโครงการ",
    "editTitle": "แก้ไข {code}",
    "edit": "แก้ไข",
    "delete": "ลบ",
    "empty": "ยังไม่มีโครงการ",
    "itemsCount": "{count} โครงการ",
    "atRisk": "เสี่ยง",
    "variance": "ส่วนต่าง",
    "confirmDelete": "ลบโครงการ \"{name}\" หรือไม่? ไมล์สโตน บันทึกความคืบหน้า และไฟล์จะถูกลบด้วย",
    "colCode": "รหัส",
    "colName": "ชื่อโครงการ",
    "colDepartment": "แผนก",
    "colOwner": "ผู้รับผิดชอบ",
    "colPriority": "ความสำคัญ",
    "colStatus": "สถานะ",
    "colProgress": "ความคืบหน้า",
    "colStartDate": "วันเริ่ม",
    "colDueDate": "กำหนดเสร็จ",
    "colFinishedAt": "เสร็จจริง",
    "colBudget": "งบประมาณ",
    "colActualCost": "ค่าใช้จ่ายจริง",
    "sectionDetails": "รายละเอียด",
    "sectionTimeline": "ไทม์ไลน์",
    "sectionMilestones": "ไมล์สโตน",
    "sectionUpdates": "บันทึกความคืบหน้า",
    "sectionFiles": "ไฟล์แนบ",
    "statusPLANNING": "วางแผน",
    "statusIN_PROGRESS": "กำลังดำเนินการ",
    "statusON_HOLD": "พักไว้",
    "statusDONE": "เสร็จสิ้น",
    "statusCANCELLED": "ยกเลิก",
    "priorityLOW": "ต่ำ",
    "priorityMEDIUM": "ปานกลาง",
    "priorityHIGH": "สูง"
  },
  "ProjectForm": {
    "name": "ชื่อโครงการ",
    "details": "รายละเอียด",
    "startDate": "วันเริ่ม",
    "dueDate": "กำหนดเสร็จ",
    "department": "แผนก",
    "owner": "ผู้รับผิดชอบ",
    "status": "สถานะ",
    "priority": "ความสำคัญ",
    "budget": "งบประมาณ",
    "atRisk": "ทำเครื่องหมายว่าโครงการนี้มีความเสี่ยง",
    "none": "— ไม่ระบุ —",
    "save": "บันทึก",
    "saving": "กำลังบันทึก..."
  },
  "ProjectFilters": {
    "searchPlaceholder": "ค้นหาชื่อหรือรหัส...",
    "allStatuses": "ทุกสถานะ",
    "allPriorities": "ทุกความสำคัญ",
    "allDepartments": "ทุกแผนก"
  },
  "ProjectTimeline": {
    "noMilestones": "เพิ่มไมล์สโตนเพื่อดูไทม์ไลน์",
    "noDates": "ยังไม่กำหนดวันที่"
  },
  "ProjectMilestones": {
    "empty": "ยังไม่มีไมล์สโตน",
    "namePlaceholder": "ชื่อไมล์สโตน",
    "startDate": "วันเริ่ม",
    "endDate": "วันสิ้นสุด",
    "add": "เพิ่ม",
    "delete": "ลบไมล์สโตน",
    "markDone": "ทำเครื่องหมายว่าเสร็จ",
    "markNotDone": "ยกเลิกเครื่องหมายเสร็จ"
  },
  "ProjectUpdates": {
    "empty": "ยังไม่มีบันทึก",
    "notePlaceholder": "มีอะไรคืบหน้าบ้าง?",
    "cost": "ค่าใช้จ่าย",
    "fileLabel": "ชื่อไฟล์",
    "post": "บันทึก",
    "posting": "กำลังบันทึก...",
    "delete": "ลบบันทึก"
  },
  "ProjectOverview": {
    "title": "ภาพรวมโครงการ",
    "open": "โครงการที่ดำเนินอยู่",
    "overdue": "เกินกำหนด",
    "atRisk": "มีความเสี่ยง",
    "doneThisYear": "เสร็จสิ้นปีนี้",
    "budgetTotal": "งบประมาณรวม",
    "actualTotal": "ใช้จ่ายรวม",
    "needsAttention": "ต้องติดตาม",
    "allClear": "ไม่มีโครงการเกินกำหนดหรือเสี่ยง"
  },
  "ProjectReports": {
    "title": "รายงานโครงการ {year}",
    "exportExcel": "ส่งออก Excel",
    "empty": "ไม่มีโครงการในช่วงนี้",
    "total": "รวม",
    "colCode": "รหัส",
    "colName": "ชื่อโครงการ",
    "colStatus": "สถานะ",
    "colDue": "กำหนดเสร็จ",
    "colFinished": "เสร็จจริง",
    "colDaysLate": "ล่าช้า (วัน)",
    "colBudget": "งบประมาณ",
    "colActual": "ใช้จริง",
    "colVariance": "ส่วนต่าง"
  },
  "ProjectActions": {
    "loginRequired": "กรุณาเข้าสู่ระบบก่อน",
    "forbidden": "เฉพาะผู้ดูแลระบบเท่านั้น",
    "invalidData": "กรุณาตรวจสอบข้อมูล",
    "notFound": "ไม่พบโครงการ",
    "nameRequired": "กรุณากรอกชื่อโครงการ",
    "startDateRequired": "กรุณาระบุวันเริ่ม",
    "budgetInvalid": "งบประมาณต้องไม่ติดลบ",
    "dueBeforeStart": "กำหนดเสร็จต้องไม่ก่อนวันเริ่ม",
    "endBeforeStart": "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    "milestoneNameRequired": "กรุณากรอกชื่อไมล์สโตน",
    "noteRequired": "กรุณากรอกรายละเอียด",
    "noFiles": "กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์",
    "fileTypeError": "รองรับเฉพาะไฟล์ PDF",
    "fileTooLarge": "ไฟล์ต้องมีขนาดไม่เกิน 10MB",
    "illegalTransition": "ไม่สามารถเปลี่ยนสถานะแบบนี้ได้",
    "createSuccess": "สร้างโครงการแล้ว",
    "updateSuccess": "บันทึกแล้ว",
    "deleteSuccess": "ลบแล้ว",
    "milestoneAdded": "เพิ่มไมล์สโตนแล้ว",
    "updateAdded": "บันทึกความคืบหน้าแล้ว",
    "filesAdded": "อัปโหลดไฟล์แล้ว"
  }
```

- [ ] **Step 2b: Add the `ProjectFiles` namespace to both files**

`ProjectAttachments.tsx` uses its own namespace rather than the shared `Attachments` one — that namespace belongs to the repair and equipment modules and carries a different key set (`docNameLabel`, `docNamePlaceholder`, `removeFile`, `filesSelected`, `hint`). Adding generic `delete`/`empty`/`upload` keys to it would blur ownership across three modules.

`messages/en.json`:

```json
  "ProjectFiles": {
    "empty": "No files attached",
    "upload": "Upload",
    "labelPlaceholder": "File label",
    "delete": "Delete file"
  }
```

`messages/th.json`:

```json
  "ProjectFiles": {
    "empty": "ยังไม่มีไฟล์แนบ",
    "upload": "อัปโหลด",
    "labelPlaceholder": "ชื่อไฟล์",
    "delete": "ลบไฟล์"
  }
```

- [ ] **Step 3: Verify both files parse and have matching key sets**

```bash
node -e '
const en=require("./messages/en.json"), th=require("./messages/th.json");
const NS=["Projects","ProjectForm","ProjectFilters","ProjectTimeline","ProjectMilestones","ProjectUpdates","ProjectFiles","ProjectOverview","ProjectReports","ProjectActions"];
let bad=0;
for (const ns of NS) {
  const a=Object.keys(en[ns]||{}), b=Object.keys(th[ns]||{});
  const missing=a.filter(k=>!b.includes(k)), extra=b.filter(k=>!a.includes(k));
  if (missing.length||extra.length) { bad=1; console.log(ns,"missing in th:",missing,"extra in th:",extra); }
}
console.log(bad?"FAIL":"all namespaces match");'
```

Expected: `all namespaces match`.

- [ ] **Step 4: Full typecheck and production build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both PASS. The build is the check that catches a Client Component importing a server-only module — a class of error `tsc` does not see.

- [ ] **Step 5: Run the full manual acceptance list from the spec**

1. Create a project → code `PJ-2026-001`; a second → `-002`.
2. Add 4 milestones, tick 3 → progress reads 75% on detail and list.
3. Post an update with cost 1,500 and a PDF → actual cost updates, file downloads.
4. Illegal transition `PLANNING` → `DONE` is rejected with `illegalTransition`.
5. `IN_PROGRESS` → `DONE` stamps a finish date; reopening to `IN_PROGRESS` clears it.
6. Delete as `STAFF` (`staff@company.com`) → `forbidden`; as `ADMIN` → succeeds.
7. After an ADMIN delete, confirm no orphans:
   ```bash
   node -e '
   const {PrismaClient}=require("@prisma/client");
   (async()=>{const p=new PrismaClient();
   const ids=(await p.project.findMany({select:{id:true}})).map(r=>r.id);
   const orphanM=await p.projectMilestone.count({where:{projectId:{notIn:ids}}});
   const orphanU=await p.projectUpdate.count({where:{projectId:{notIn:ids}}});
   const orphanA=await p.projectAttachment.count({where:{projectId:{notIn:ids}}});
   console.log("orphans:",orphanM,orphanU,orphanA,"expected 0 0 0");
   await p.$disconnect();})();'
   ```
8. Switch the language to Thai — no raw keys anywhere in the module.
9. A milestone with no dates renders as "ยังไม่กำหนดวันที่", not a zero-width bar.

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/th.json
git commit -m "feat: add Thai and English translations for the Projects module"
```

---

## Self-Review Notes

**Spec coverage.** Every spec section maps to a task: data model → Task 1; derived fields → Task 2; status rules → Task 4 Step 3; routes/nav → Task 3; list → Task 7; form → Task 8; timeline, milestones, update log, attachments → Task 9; overview → Task 10; reports + Excel → Task 11; i18n → Task 12; manual test checklist → Task 12 Step 5. The three spec risks are addressed inline: `Number()` conversion in every query mapper, `dateOnly` on all date-only writes, and `recalcProject` taking a `TransactionClient`.

**Known deviations from the spec, deliberate:**
- The spec listed `MilestoneEditor` with reorder; Task 9 ships add/toggle/delete and a `sortOrder` column that increments by 10. Drag-reorder is UI-only work with no schema consequence and is left for a follow-up — the column supports it when wanted.
- `OVERDUE_GRACE_DAYS` is defined as 0 in Task 1 and not read anywhere yet; overdue is `dueDate < today`. It exists so the threshold has one home if it ever becomes non-zero. If a reviewer prefers, delete it — nothing depends on it.

**Type consistency.** `ProjectActionState` is defined once in `project.actions.ts` and imported by the two other action modules. `ProjectDetail extends ProjectListRow`, so every component taking either receives the same field names. `recalcProject(tx, projectId)` has the same signature at all four call sites (Tasks 5 and 6). `ProjectStatusBadge` is a **named** export alongside `ProjectPriorityBadge`; `ProgressBar` is a **default** export — the import styles in Tasks 7, 9 and 10 match.

**One ordering constraint:** Task 4 Step 7's typecheck will fail on missing `ProjectActions` translation keys unless the stub is added as noted. Task 12 fills them properly. If executing strictly in order, add `"ProjectActions": {}` to both message files during Task 4.
