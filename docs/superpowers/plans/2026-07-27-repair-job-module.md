# Repair Job Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the app into two top-level modules (Office Stock, Repair Job) and build the Repair Job module — repair records for internal and external devices, technicians, cost reports, and dashboard counters.

**Architecture:** A single `src/lib/navigation.ts` drives both the header module tabs and the module-aware sidebar; active module is derived from the URL, so there is no client navigation state. Repair pages live inside the existing `(dashboard)` route group and inherit its `auth()` gate. Repair data is fully decoupled from stock — it shares only the `User` and `Department` tables and never writes `StockTransaction` or `Product.totalStock`.

**Tech Stack:** Next.js 15.0.3 (App Router, Server Actions), Prisma 5.22 + MySQL/MariaDB, NextAuth v5, next-intl 4, Zod 3, Tailwind, ExcelJS, PDFKit.

**Spec:** `docs/superpowers/specs/2026-07-27-repair-job-module-design.md`

## Global Constraints

- **No test runner exists in this project.** `package.json` has no `test` script and no test framework is installed. Adding one is out of scope. Every task's verification cycle is therefore `npx tsc --noEmit` plus a scripted manual check in the browser. Where a task says "Expected: FAIL", it means the typecheck or build fails with the named error.
- **Do not integrate repair with stock.** No `StockTransaction` rows, no `Product.totalStock` writes, no `Product` relation on any repair model. Parts used stay free text.
- **No new permission logic.** Every authenticated user has full access to repairs, technicians, and repair reports. Only `/users` stays role-gated (`ADMIN`/`MODERATOR`).
- **Both languages, always.** Every user-visible string goes in `messages/en.json` AND `messages/th.json`. Never render a raw enum value.
- **Migration casing.** This machine's MariaDB runs `lower_case_table_names=0`. After generating any migration, grep it for lowercase table identifiers and fix them to PascalCase before committing. See Task 2 Step 5.
- **`totalCost` is never accepted from the client.** It is always computed server-side as `partsCost + labourCost`.
- **Existing export output must not change.** The `reportExport.ts` refactor in Task 8 is behaviour-preserving; the Sarabun WOFF1 font workaround and its comment stay byte-identical.
- **Money columns** are `Decimal @db.Decimal(10, 2)` in Prisma and must be converted with `Number()` before crossing into a Client Component, matching `getQuotations()`.
- Follow existing house style: 2-space indent, double quotes, `clsx` for conditional classes, `useActionState` + Server Actions for forms, `revalidate = 0` on list pages, shared `.input` / `.label` / `.card` / `.btn-primary` Tailwind classes.

---

## File Structure

**Create**

| File | Responsibility |
|---|---|
| `src/lib/navigation.ts` | Module + item definitions, `moduleForPath`, `activeHref` |
| `src/components/layout/ModuleTabs.tsx` | Header tabs, client component |
| `src/actions/repair.actions.ts` | Repair CRUD, status transitions, job numbering, dashboard stats |
| `src/actions/technician.actions.ts` | Technician CRUD |
| `src/actions/repairReport.actions.ts` | Repair report aggregation + row type |
| `src/lib/reportColumns.ts` | Column defs for transaction and repair exports |
| `src/app/(dashboard)/repairs/overview/page.tsx` | Repair mini-dashboard |
| `src/app/(dashboard)/repairs/page.tsx` | Repair list |
| `src/app/(dashboard)/repairs/new/page.tsx` | Create |
| `src/app/(dashboard)/repairs/[id]/edit/page.tsx` | Edit |
| `src/app/(dashboard)/repairs/technicians/page.tsx` | Technician CRUD |
| `src/app/(dashboard)/repairs/reports/page.tsx` | Repair report |
| `src/app/api/repairs/reports/route.ts` | Excel/PDF download |
| `src/components/repairs/RepairForm.tsx` | Create/edit form |
| `src/components/repairs/RepairRow.tsx` | List row + delete |
| `src/components/repairs/RepairFilters.tsx` | Search/status/type/date filters |
| `src/components/repairs/RepairStatusBadge.tsx` | Status pill |
| `src/components/repairs/RepairStatusSelect.tsx` | Inline status change |
| `src/components/repairs/RepairAttachments.tsx` | Attachment list + delete |
| `src/components/technicians/TechnicianForm.tsx` | Add technician |
| `src/components/technicians/TechnicianRow.tsx` | Inline edit/delete |

**Modify**

| File | Change |
|---|---|
| `prisma/schema.prisma` | 2 enums, 3 models, 3 back-relations |
| `src/components/layout/Sidebar.tsx` | Module-aware, longest-prefix active match |
| `src/components/layout/Header.tsx` | Mount `ModuleTabs` in the existing empty `<div />` |
| `src/lib/reportExport.ts` | Generalize to column definitions |
| `src/app/api/reports/[month]/route.ts` | Pass columns |
| `src/app/api/reports/year/[year]/route.ts` | Pass columns |
| `src/app/api/transactions/export/route.ts` | Pass columns |
| `src/actions/stock.actions.ts` | Add repair counts to dashboard stats |
| `src/app/(dashboard)/dashboard/page.tsx` | Two repair cards |
| `messages/en.json`, `messages/th.json` | Nav keys + 8 new namespaces |

---

## Task 1: Navigation shell

Produces the two-module navigation with placeholder repair pages, so every tab and sidebar link resolves before any repair feature exists.

**Files:**
- Create: `src/lib/navigation.ts`
- Create: `src/components/layout/ModuleTabs.tsx`
- Create: `src/app/(dashboard)/repairs/page.tsx`, `repairs/overview/page.tsx`, `repairs/new/page.tsx`, `repairs/technicians/page.tsx`, `repairs/reports/page.tsx` (placeholders)
- Modify: `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Produces: `MODULES: NavModule[]`, `moduleForPath(path: string): NavModule`, `activeHref(path: string, hrefs: string[]): string | null`, `NavItem`, `NavModule`. Tasks 5–10 replace the placeholder pages.

- [ ] **Step 1: Create `src/lib/navigation.ts`**

```ts
import {
  LayoutDashboard, History, Package, FileBarChart, Building2,
  Users, FileText, Tags, Wrench, ClipboardList, PlusCircle, UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  key: string;
  icon: LucideIcon;
  /** Rendered only when the signed-in user can manage users. */
  adminOnly?: boolean;
}

export interface NavModule {
  key: "stock" | "repair";
  labelKey: string;
  href: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const MODULES: NavModule[] = [
  {
    key: "stock",
    labelKey: "moduleStock",
    href: "/dashboard",
    icon: Package,
    items: [
      { href: "/dashboard",    key: "overview",     icon: LayoutDashboard },
      { href: "/products",     key: "products",     icon: Package },
      { href: "/quotations",   key: "quotations",   icon: FileText },
      { href: "/transactions", key: "transactions", icon: History },
      { href: "/reports",      key: "reports",      icon: FileBarChart },
      { href: "/categories",   key: "categories",   icon: Tags },
      { href: "/departments",  key: "departments",  icon: Building2 },
      { href: "/users",        key: "users",        icon: Users, adminOnly: true },
    ],
  },
  {
    key: "repair",
    labelKey: "moduleRepair",
    href: "/repairs/overview",
    icon: Wrench,
    items: [
      { href: "/repairs/overview",    key: "repairOverview", icon: LayoutDashboard },
      { href: "/repairs",             key: "repairList",     icon: ClipboardList },
      { href: "/repairs/new",         key: "repairNew",      icon: PlusCircle },
      { href: "/repairs/technicians", key: "technicians",    icon: UserCog },
      { href: "/repairs/reports",     key: "repairReports",  icon: FileBarChart },
    ],
  },
];

/**
 * Longest matching prefix wins, so `/repairs/new` selects "New Repair"
 * rather than "Repair List", and `/repairs/7/edit` selects "Repair List".
 */
export function activeHref(path: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (path === href || path.startsWith(`${href}/`)) {
      if (best === null || href.length > best.length) best = href;
    }
  }
  return best;
}

export function moduleForPath(path: string): NavModule {
  let bestModule: NavModule | null = null;
  let bestLength = -1;
  for (const mod of MODULES) {
    for (const item of mod.items) {
      if (path === item.href || path.startsWith(`${item.href}/`)) {
        if (item.href.length > bestLength) {
          bestLength = item.href.length;
          bestModule = mod;
        }
      }
    }
  }
  return bestModule ?? MODULES[0];
}
```

- [ ] **Step 2: Create `src/components/layout/ModuleTabs.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { MODULES, moduleForPath } from "@/lib/navigation";

export default function ModuleTabs() {
  const path = usePathname();
  const t = useTranslations("Nav");
  const current = moduleForPath(path);

  return (
    <nav className="flex items-center gap-1.5">
      {MODULES.map((mod) => {
        const Icon = mod.icon;
        const active = mod.key === current.key;
        return (
          <Link
            key={mod.key}
            href={mod.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-[#1e3a5f] text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            )}
          >
            <Icon size={15} />
            {t(mod.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Replace the nav portion of `src/components/layout/Sidebar.tsx`**

Replace the whole file. The brand block now reflects the active module.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import LanguageSwitcher from "./LanguageSwitcher";
import { moduleForPath, activeHref } from "@/lib/navigation";

interface SidebarProps {
  canManageUsers: boolean;
}

export default function Sidebar({ canManageUsers }: SidebarProps) {
  const path = usePathname();
  const t = useTranslations("Nav");
  const mod = moduleForPath(path);
  const items = mod.items.filter((i) => !i.adminOnly || canManageUsers);
  const current = activeHref(path, items.map((i) => i.href));
  const ModIcon = mod.icon;

  return (
    <aside className="flex w-60 flex-col bg-[#1e3a5f] text-white shrink-0">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
        <ModIcon size={22} className="text-blue-200" />
        <div>
          <p className="font-bold text-sm leading-tight">{t(mod.labelKey)}</p>
          <p className="text-[11px] text-blue-200">IT Asset Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {items.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              href === current
                ? "bg-white/20 text-white shadow-sm"
                : "text-blue-100 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon size={17} />
            {t(key)}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 space-y-3">
        <LanguageSwitcher />
        <p className="text-[11px] text-blue-300 text-center">v1.0.0 © Office Stock</p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Mount the tabs in `src/components/layout/Header.tsx`**

Add the import and replace the empty `<div />` on line 14.

```tsx
import ModuleTabs from "./ModuleTabs";
```

```tsx
      <ModuleTabs />
```

Everything else in the file is unchanged.

- [ ] **Step 5: Add the five placeholder repair pages**

Each of `src/app/(dashboard)/repairs/page.tsx`, `overview/page.tsx`, `new/page.tsx`, `technicians/page.tsx`, `reports/page.tsx` gets this body, with `TITLE` replaced by `Repair List`, `Repair Overview`, `New Repair`, `Technicians`, `Repair Reports` respectively:

```tsx
export default function Page() {
  return (
    <div className="card p-8 text-center text-slate-400 text-sm">
      TITLE — coming in a later task
    </div>
  );
}
```

- [ ] **Step 6: Add navigation translation keys**

In `messages/en.json`, extend the existing `Nav` object with:

```json
"moduleStock": "Office Stock",
"moduleRepair": "Repair Job",
"repairOverview": "Repair Overview",
"repairList": "Repair List",
"repairNew": "New Repair",
"technicians": "Technicians",
"repairReports": "Repair Reports"
```

In `messages/th.json`, extend `Nav` with:

```json
"moduleStock": "คลังอุปกรณ์",
"moduleRepair": "งานซ่อม",
"repairOverview": "ภาพรวมงานซ่อม",
"repairList": "รายการงานซ่อม",
"repairNew": "เปิดงานซ่อม",
"technicians": "ช่างซ่อม",
"repairReports": "รายงานงานซ่อม"
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 8: Manual verification**

Run `npm run dev`, sign in as `admin@company.com` / `admin1234`, then confirm:
1. Two tabs render top-left of the header; Office Stock is active on `/dashboard`
2. Clicking Repair Job lands on `/repairs/overview`; sidebar shows exactly 5 repair items; brand reads "Repair Job"
3. Clicking Office Stock returns to `/dashboard` with the original 8 items
4. On `/products/new` the sidebar highlights **Inventory** (this was broken before)
5. On `/repairs/new` the sidebar highlights **New Repair**, not Repair List
6. Sign in as `staff@company.com` / `staff1234`: Users is absent from the stock sidebar, all 5 repair items still present
7. Switch to Thai from the sidebar switcher; both tabs and all items translate

- [ ] **Step 9: Commit**

```bash
git add src/lib/navigation.ts src/components/layout src/app/\(dashboard\)/repairs messages
git commit -m "feat(nav): add Office Stock / Repair Job module tabs and module-aware sidebar"
```

---

## Task 2: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<generated>/migration.sql`

**Interfaces:**
- Produces: Prisma models `RepairJob`, `Technician`, `RepairAttachment`; enums `RepairType`, `RepairStatus`. All later tasks import these types from `@prisma/client`.

- [ ] **Step 1: Add enums and models to `prisma/schema.prisma`**

Append to the end of the file:

```prisma
enum RepairType {
  INTERNAL
  EXTERNAL
}

enum RepairStatus {
  RECEIVED
  IN_PROGRESS
  DONE
  RETURNED
  CANCELLED
}

model Technician {
  id        Int         @id @default(autoincrement())
  name      String      @unique
  phone     String?
  isActive  Boolean     @default(true)
  repairs   RepairJob[]
  createdAt DateTime    @default(now())
}

model RepairJob {
  id            Int          @id @default(autoincrement())
  jobNumber     String       @unique
  type          RepairType

  department    Department?  @relation(fields: [departmentId], references: [id])
  departmentId  Int?

  customerName  String?
  customerPhone String?

  deviceName    String
  serialNo      String?
  problem       String       @db.Text

  partsUsed     String?      @db.Text
  partsCost     Decimal      @default(0) @db.Decimal(10, 2)
  labourCost    Decimal      @default(0) @db.Decimal(10, 2)
  totalCost     Decimal      @default(0) @db.Decimal(10, 2)

  status        RepairStatus @default(RECEIVED)
  technician    Technician?  @relation(fields: [technicianId], references: [id])
  technicianId  Int?

  createdBy     User         @relation(fields: [createdById], references: [id])
  createdById   String

  reportedAt    DateTime     @default(now())
  closedAt      DateTime?
  note          String?      @db.Text

  attachments   RepairAttachment[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([status])
  @@index([reportedAt])
}

model RepairAttachment {
  id           Int       @id @default(autoincrement())
  repairJob    RepairJob @relation(fields: [repairJobId], references: [id], onDelete: Cascade)
  repairJobId  Int
  fileUrl      String
  fileName     String
  mimeType     String
  uploadedBy   User      @relation(fields: [uploadedById], references: [id])
  uploadedById String
  createdAt    DateTime  @default(now())

  @@index([repairJobId])
}
```

- [ ] **Step 2: Add back-relations to existing models**

In `model Department`, add:

```prisma
  repairJobs   RepairJob[]
```

In `model User`, add:

```prisma
  repairJobs        RepairJob[]
  repairAttachments RepairAttachment[]
```

- [ ] **Step 3: Verify the schema is valid before touching the database**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

If it fails with a missing-back-relation error, Step 2 was incomplete.

- [ ] **Step 4: Generate the migration**

```bash
npx prisma migrate dev --name add_repair_job_module
```

Expected: a new folder under `prisma/migrations/` and "Your database is now in sync with your schema."

- [ ] **Step 5: Check the generated SQL for the casing bug**

```bash
grep -nE '(ALTER|CREATE|REFERENCES|DROP) TABLE `[a-z]' prisma/migrations/*add_repair_job_module/migration.sql
```

Expected: no output. If any line matches, edit the file to PascalCase (`user` → `User`, `department` → `Department`, `repairjob` → `RepairJob`) and re-run the grep until clean. This project's MariaDB is case-sensitive; a lowercase identifier here will break every fresh deploy.

- [ ] **Step 6: Confirm the tables landed**

```bash
npx prisma db execute --stdin <<'SQL'
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'office_stock_db' AND TABLE_NAME IN ('RepairJob','Technician','RepairAttachment');
SQL
```

Expected: three rows.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(repair): add RepairJob, Technician and RepairAttachment models"
```

---

## Task 3: Technician actions and page

Built before repairs because `RepairForm` needs a technician dropdown.

**Files:**
- Create: `src/actions/technician.actions.ts`
- Create: `src/components/technicians/TechnicianForm.tsx`, `TechnicianRow.tsx`
- Replace: `src/app/(dashboard)/repairs/technicians/page.tsx`
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `Technician` from `@prisma/client` (Task 2)
- Produces: `TechnicianActionState`, `createTechnicianAction(_prev, formData)`, `updateTechnicianAction(_prev, formData)`, `deleteTechnicianAction(id: number)`, `getTechnicians(includeInactive?: boolean): Promise<Technician[]>`

- [ ] **Step 1: Create `src/actions/technician.actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type TechnicianActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

async function buildTechnicianSchema() {
  const t = await getTranslations("TechnicianActions");
  return z.object({
    name:     z.string().min(1, t("nameRequired")),
    phone:    z.string().optional(),
    isActive: z.boolean(),
  });
}

function readTechnicianForm(formData: FormData) {
  return {
    name:     ((formData.get("name") as string) ?? "").trim(),
    phone:    ((formData.get("phone") as string) || "").trim() || undefined,
    isActive: formData.get("isActive") !== "false",
  };
}

export async function createTechnicianAction(
  _prev: TechnicianActionState,
  formData: FormData
): Promise<TechnicianActionState> {
  const session = await auth();
  const t = await getTranslations("TechnicianActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const schema = await buildTechnicianSchema();
  const parsed = schema.safeParse(readTechnicianForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.technician.create({
      data: {
        name:     parsed.data.name,
        phone:    parsed.data.phone ?? null,
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/repairs/technicians");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateTechnicianAction(
  _prev: TechnicianActionState,
  formData: FormData
): Promise<TechnicianActionState> {
  const session = await auth();
  const t = await getTranslations("TechnicianActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const schema = await buildTechnicianSchema();
  const parsed = schema.safeParse(readTechnicianForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.technician.update({
      where: { id },
      data: {
        name:     parsed.data.name,
        phone:    parsed.data.phone ?? null,
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/repairs/technicians");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e.code === "P2002") return { success: false, message: t("duplicateName") };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteTechnicianAction(id: number): Promise<TechnicianActionState> {
  const session = await auth();
  const t = await getTranslations("TechnicianActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const assigned = await prisma.repairJob.count({ where: { technicianId: id } });
  if (assigned > 0) {
    return { success: false, message: t("inUse", { count: assigned }) };
  }

  try {
    await prisma.technician.delete({ where: { id } });
    revalidatePath("/repairs/technicians");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function getTechnicians(includeInactive = true) {
  return prisma.technician.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}
```

`deleteTechnicianAction` blocks deletion of an assigned technician rather than relying on the database error, mirroring how category deletion is guarded.

- [ ] **Step 2: Create `src/components/technicians/TechnicianForm.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { PlusCircle } from "lucide-react";
import { createTechnicianAction, type TechnicianActionState } from "@/actions/technician.actions";

const initState: TechnicianActionState = { success: false, message: "" };

export default function TechnicianForm() {
  const t = useTranslations("TechnicianForm");
  const tc = useTranslations("Common");
  const [state, formAction, pending] = useActionState(createTechnicianAction, initState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-100">
      <div className="flex-1 min-w-[180px]">
        <label className="label" htmlFor="name">{t("nameLabel")}</label>
        <input id="name" name="name" className="input" placeholder={t("namePlaceholder")} required />
      </div>
      <div className="flex-1 min-w-[150px]">
        <label className="label" htmlFor="phone">{t("phoneLabel")}</label>
        <input id="phone" name="phone" className="input" placeholder={t("phonePlaceholder")} />
      </div>
      <button type="submit" disabled={pending} className={clsx("btn-primary py-2.5", pending && "opacity-60 cursor-not-allowed")}>
        <PlusCircle size={16} />
        {pending ? tc("saving") : t("add")}
      </button>

      {state.message && (
        <p className={clsx(
          "w-full text-sm font-medium rounded-lg px-3 py-2",
          state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        )}>
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Create `src/components/technicians/TechnicianRow.tsx`**

```tsx
"use client";

import { useState, useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  updateTechnicianAction,
  deleteTechnicianAction,
  type TechnicianActionState,
} from "@/actions/technician.actions";

const initState: TechnicianActionState = { success: false, message: "" };

interface Props {
  technician: { id: number; name: string; phone: string | null; isActive: boolean };
}

export default function TechnicianRow({ technician }: Props) {
  const t = useTranslations("Technicians");
  const tc = useTranslations("Common");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [state, formAction, pending] = useActionState(updateTechnicianAction, initState);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  async function handleDelete() {
    if (!confirm(t("confirmDelete", { name: technician.name }))) return;
    setDeleting(true);
    setError("");
    const res = await deleteTechnicianAction(technician.id);
    if (!res.success) setError(res.message);
    setDeleting(false);
  }

  if (editing) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={4} className="px-5 py-3">
          <form action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={technician.id} />
            <input name="name" className="input flex-1 min-w-[160px]" defaultValue={technician.name} required />
            <input name="phone" className="input flex-1 min-w-[130px]" defaultValue={technician.phone ?? ""} />
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" name="isActive" value="true" defaultChecked={technician.isActive} />
              {t("active")}
            </label>
            <input type="hidden" name="isActive" value="false" />
            <button type="submit" disabled={pending} className="btn-primary py-2">
              <Check size={15} />{pending ? tc("saving") : tc("save")}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              <X size={15} />
            </button>
            {state.message && !state.success && (
              <span className="text-xs text-red-600">{state.message}</span>
            )}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-5 py-3 font-medium text-slate-800">{technician.name}</td>
      <td className="px-4 py-3 text-slate-600">{technician.phone || "-"}</td>
      <td className="px-4 py-3">
        <span className={clsx(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
          technician.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
        )}>
          {technician.isActive ? t("active") : t("inactive")}
        </span>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="px-5 py-3 text-right">
        <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-blue-600" title={tc("edit")}>
          <Pencil size={15} />
        </button>
        <button onClick={handleDelete} disabled={deleting} className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50" title={tc("delete")}>
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
```

The hidden `isActive=false` input after the checkbox makes an unchecked box submit `false` — a checkbox alone submits nothing. `readTechnicianForm` reads `formData.get("isActive") !== "false"`, and `FormData.get` returns the **first** value, so a checked box (which submits `"true"` first) wins.

- [ ] **Step 4: Replace `src/app/(dashboard)/repairs/technicians/page.tsx`**

```tsx
import { getTechnicians } from "@/actions/technician.actions";
import TechnicianForm from "@/components/technicians/TechnicianForm";
import TechnicianRow from "@/components/technicians/TechnicianRow";
import { getTranslations } from "next-intl/server";

export const revalidate = 0;

export default async function TechniciansPage() {
  const [technicians, t] = await Promise.all([
    getTechnicians(),
    getTranslations("Technicians"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: technicians.length })}</p>
      </div>

      <div className="card overflow-hidden">
        <TechnicianForm />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colName")}</th>
                <th className="px-4 py-3 font-medium">{t("colPhone")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {technicians.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
              )}
              {technicians.map((tech) => (
                <TechnicianRow key={tech.id} technician={tech} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add translations**

`messages/en.json`:

```json
"Technicians": {
  "title": "Technicians",
  "itemsCount": "{count} technicians",
  "colName": "Name",
  "colPhone": "Phone",
  "colStatus": "Status",
  "colActions": "Actions",
  "empty": "No technicians yet",
  "active": "Active",
  "inactive": "Inactive",
  "confirmDelete": "Delete technician \"{name}\"?"
},
"TechnicianForm": {
  "nameLabel": "Technician name",
  "namePlaceholder": "e.g. Somchai P.",
  "phoneLabel": "Phone",
  "phonePlaceholder": "08x-xxx-xxxx",
  "add": "Add technician"
},
"TechnicianActions": {
  "loginRequired": "Please sign in first",
  "invalidData": "Please check the form",
  "nameRequired": "Technician name is required",
  "duplicateName": "A technician with this name already exists",
  "inUse": "Cannot delete — assigned to {count} repair jobs",
  "notFound": "Technician not found",
  "createSuccess": "Technician added",
  "updateSuccess": "Technician updated",
  "deleteSuccess": "Technician deleted",
  "genericError": "Something went wrong"
}
```

`messages/th.json`:

```json
"Technicians": {
  "title": "ช่างซ่อม",
  "itemsCount": "ช่างซ่อม {count} คน",
  "colName": "ชื่อ",
  "colPhone": "เบอร์โทร",
  "colStatus": "สถานะ",
  "colActions": "จัดการ",
  "empty": "ยังไม่มีข้อมูลช่างซ่อม",
  "active": "ใช้งาน",
  "inactive": "ปิดใช้งาน",
  "confirmDelete": "ต้องการลบช่าง \"{name}\" ใช่หรือไม่?"
},
"TechnicianForm": {
  "nameLabel": "ชื่อช่างซ่อม",
  "namePlaceholder": "เช่น สมชาย พ.",
  "phoneLabel": "เบอร์โทร",
  "phonePlaceholder": "08x-xxx-xxxx",
  "add": "เพิ่มช่างซ่อม"
},
"TechnicianActions": {
  "loginRequired": "กรุณาเข้าสู่ระบบก่อน",
  "invalidData": "กรุณาตรวจสอบข้อมูลในฟอร์ม",
  "nameRequired": "กรุณากรอกชื่อช่างซ่อม",
  "duplicateName": "มีช่างซ่อมชื่อนี้อยู่แล้ว",
  "inUse": "ลบไม่ได้ — ถูกใช้อยู่ใน {count} งานซ่อม",
  "notFound": "ไม่พบข้อมูลช่างซ่อม",
  "createSuccess": "เพิ่มช่างซ่อมแล้ว",
  "updateSuccess": "แก้ไขข้อมูลช่างซ่อมแล้ว",
  "deleteSuccess": "ลบช่างซ่อมแล้ว",
  "genericError": "เกิดข้อผิดพลาด"
}
```

Check `messages/en.json` for an existing `Common.save` and `Common.edit`/`Common.delete` key before relying on them; if any is missing, add it in both files with values "Save"/"บันทึก", "Edit"/"แก้ไข", "Delete"/"ลบ".

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Manual verification**

On `/repairs/technicians`: add a technician; add a second with the same name and confirm the duplicate message; edit a name inline; toggle Active off and confirm the badge changes; delete an unassigned technician. Switch to Thai and confirm every label translates.

- [ ] **Step 8: Commit**

```bash
git add src/actions/technician.actions.ts src/components/technicians src/app/\(dashboard\)/repairs/technicians messages
git commit -m "feat(repair): add technician master list"
```

---

## Task 4: Repair actions

The core of the module. No UI in this task.

**Files:**
- Create: `src/actions/repair.actions.ts`
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `RepairJob`, `RepairStatus`, `RepairType` (Task 2); `saveUpload` from `@/lib/uploads`
- Produces:
  - `OVERDUE_DAYS: number`
  - `RepairActionState = { success: boolean; message: string; errors?: Record<string,string[]> }`
  - `createRepairAction(_prev, formData): Promise<RepairActionState>`
  - `updateRepairAction(_prev, formData): Promise<RepairActionState>`
  - `deleteRepairAction(id: number): Promise<RepairActionState>`
  - `updateRepairStatusAction(id: number, status: RepairStatus): Promise<RepairActionState>`
  - `deleteRepairAttachmentAction(id: number): Promise<RepairActionState>`
  - `RepairFilterParams = { q?: string; status?: string; type?: string; from?: string; to?: string }`
  - `getRepairJobs(filters: RepairFilterParams): Promise<RepairListItem[]>`
  - `getRepairJobById(id: number)`
  - `getRepairDashboardStats(): Promise<{ open: number; overdue: number; byStatus: Record<RepairStatus, number>; monthCost: number }>`

- [ ] **Step 1: Create `src/actions/repair.actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { RepairStatus, RepairType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";

/** An open job older than this many days counts as overdue on the dashboard. */
export const OVERDUE_DAYS = 7;

export const OPEN_STATUSES: RepairStatus[] = [
  RepairStatus.RECEIVED,
  RepairStatus.IN_PROGRESS,
  RepairStatus.DONE,
];

const CLOSED_STATUSES: RepairStatus[] = [RepairStatus.RETURNED, RepairStatus.CANCELLED];

/** Legal moves. Backwards moves between open states are allowed (failed retest). */
const TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  RECEIVED:    [RepairStatus.IN_PROGRESS, RepairStatus.CANCELLED],
  IN_PROGRESS: [RepairStatus.RECEIVED, RepairStatus.DONE, RepairStatus.CANCELLED],
  DONE:        [RepairStatus.IN_PROGRESS, RepairStatus.RETURNED, RepairStatus.CANCELLED],
  RETURNED:    [RepairStatus.DONE],
  CANCELLED:   [RepairStatus.RECEIVED],
};

export type RepairActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const ALLOWED_MIME = [
  "image/png", "image/jpeg", "image/webp", "application/pdf",
];
const EXT_FOR_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const MAX_FILE_SIZE = 10 * 1024 * 1024;

class AttachmentError extends Error {}

async function buildRepairSchema() {
  const t = await getTranslations("RepairActions");
  return z
    .object({
      type:          z.nativeEnum(RepairType),
      departmentId:  z.number().int().positive().optional(),
      customerName:  z.string().optional(),
      customerPhone: z.string().optional(),
      deviceName:    z.string().min(1, t("deviceNameRequired")),
      serialNo:      z.string().optional(),
      problem:       z.string().min(1, t("problemRequired")),
      partsUsed:     z.string().optional(),
      partsCost:     z.number().min(0, t("costInvalid")),
      labourCost:    z.number().min(0, t("costInvalid")),
      status:        z.nativeEnum(RepairStatus),
      technicianId:  z.number().int().positive().optional(),
      reportedAt:    z.coerce.date({ errorMap: () => ({ message: t("reportedAtRequired") }) }),
      note:          z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.type === RepairType.INTERNAL && !data.departmentId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["departmentId"], message: t("departmentRequired") });
      }
      if (data.type === RepairType.EXTERNAL && !data.customerName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customerName"], message: t("customerNameRequired") });
      }
    });
}

function readRepairForm(formData: FormData) {
  const num = (key: string) => {
    const raw = (formData.get(key) as string) || "";
    return raw ? Number(raw) : undefined;
  };
  const str = (key: string) => ((formData.get(key) as string) || "").trim() || undefined;

  return {
    type:          formData.get("type") as RepairType,
    departmentId:  num("departmentId"),
    customerName:  str("customerName"),
    customerPhone: str("customerPhone"),
    deviceName:    ((formData.get("deviceName") as string) ?? "").trim(),
    serialNo:      str("serialNo"),
    problem:       ((formData.get("problem") as string) ?? "").trim(),
    partsUsed:     str("partsUsed"),
    partsCost:     num("partsCost") ?? 0,
    labourCost:    num("labourCost") ?? 0,
    status:        (formData.get("status") as RepairStatus) || RepairStatus.RECEIVED,
    technicianId:  num("technicianId"),
    reportedAt:    (formData.get("reportedAt") as string) || new Date().toISOString().slice(0, 10),
    note:          str("note"),
  };
}

/** Fields that only apply to one repair type are nulled out for the other. */
function typeScopedFields(data: { type: RepairType; departmentId?: number; customerName?: string; customerPhone?: string }) {
  const internal = data.type === RepairType.INTERNAL;
  return {
    departmentId:  internal ? data.departmentId ?? null : null,
    customerName:  internal ? null : data.customerName ?? null,
    customerPhone: internal ? null : data.customerPhone ?? null,
  };
}

function closedAtFor(status: RepairStatus, existing: Date | null): Date | null {
  if (CLOSED_STATUSES.includes(status)) return existing ?? new Date();
  return null;
}

/**
 * `RJ-YYMM-NNN`, sequential within the current month.
 * Runs inside the caller's transaction so the count and the insert cannot interleave.
 */
async function nextJobNumber(tx: typeof prisma, when: Date): Promise<string> {
  const yy = String(when.getFullYear()).slice(-2);
  const mm = String(when.getMonth() + 1).padStart(2, "0");
  const prefix = `RJ-${yy}${mm}-`;

  const latest = await tx.repairJob.findFirst({
    where: { jobNumber: { startsWith: prefix } },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });

  const seq = latest ? Number(latest.jobNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

async function saveAttachments(files: File[], repairJobId: number, userId: string) {
  const t = await getTranslations("RepairActions");
  for (const file of files) {
    if (file.size === 0) continue;
    if (!ALLOWED_MIME.includes(file.type)) throw new AttachmentError(t("fileTypeError"));
    if (file.size > MAX_FILE_SIZE) throw new AttachmentError(t("fileTooLarge"));

    const url = await saveUpload(file, "repairs", EXT_FOR_MIME[file.type]);
    await prisma.repairAttachment.create({
      data: {
        repairJobId,
        fileUrl:      url,
        fileName:     file.name,
        mimeType:     file.type,
        uploadedById: userId,
      },
    });
  }
}

export async function createRepairAction(
  _prev: RepairActionState,
  formData: FormData
): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  if (!session?.user?.id) return { success: false, message: t("loginRequired") };

  const schema = await buildRepairSchema();
  const parsed = schema.safeParse(readRepairForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const jobNumber = await nextJobNumber(tx as unknown as typeof prisma, d.reportedAt);
      return tx.repairJob.create({
        data: {
          jobNumber,
          type:        d.type,
          ...typeScopedFields(d),
          deviceName:  d.deviceName,
          serialNo:    d.serialNo ?? null,
          problem:     d.problem,
          partsUsed:   d.partsUsed ?? null,
          partsCost:   d.partsCost,
          labourCost:  d.labourCost,
          totalCost:   d.partsCost + d.labourCost,
          status:      d.status,
          technicianId: d.technicianId ?? null,
          createdById: session.user!.id!,
          reportedAt:  d.reportedAt,
          closedAt:    closedAtFor(d.status, null),
          note:        d.note ?? null,
        },
      });
    });

    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    await saveAttachments(files, created.id, session.user.id);

    revalidatePath("/repairs");
    revalidatePath("/repairs/overview");
    return { success: true, message: t("createSuccess") };
  } catch (e: any) {
    if (e instanceof AttachmentError) return { success: false, message: e.message };
    if (e.code === "P2002") return { success: false, message: t("jobNumberClash") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateRepairAction(
  _prev: RepairActionState,
  formData: FormData
): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  if (!session?.user?.id) return { success: false, message: t("loginRequired") };

  const id = Number(formData.get("id"));
  if (!id) return { success: false, message: t("notFound") };

  const schema = await buildRepairSchema();
  const parsed = schema.safeParse(readRepairForm(formData));
  if (!parsed.success) {
    return { success: false, message: t("invalidData"), errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const existing = await prisma.repairJob.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };

  if (existing.status !== d.status && !TRANSITIONS[existing.status].includes(d.status)) {
    return {
      success: false,
      message: t("illegalTransition"),
      errors: { status: [t("illegalTransition")] },
    };
  }

  try {
    await prisma.repairJob.update({
      where: { id },
      data: {
        type:        d.type,
        ...typeScopedFields(d),
        deviceName:  d.deviceName,
        serialNo:    d.serialNo ?? null,
        problem:     d.problem,
        partsUsed:   d.partsUsed ?? null,
        partsCost:   d.partsCost,
        labourCost:  d.labourCost,
        totalCost:   d.partsCost + d.labourCost,
        status:      d.status,
        technicianId: d.technicianId ?? null,
        reportedAt:  d.reportedAt,
        closedAt:    closedAtFor(d.status, existing.closedAt),
        note:        d.note ?? null,
      },
    });

    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    await saveAttachments(files, id, session.user.id);

    revalidatePath("/repairs");
    revalidatePath("/repairs/overview");
    return { success: true, message: t("updateSuccess") };
  } catch (e: any) {
    if (e instanceof AttachmentError) return { success: false, message: e.message };
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function updateRepairStatusAction(
  id: number,
  status: RepairStatus
): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  const existing = await prisma.repairJob.findUnique({ where: { id } });
  if (!existing) return { success: false, message: t("notFound") };
  if (existing.status === status) return { success: true, message: t("updateSuccess") };
  if (!TRANSITIONS[existing.status].includes(status)) {
    return { success: false, message: t("illegalTransition") };
  }

  try {
    await prisma.repairJob.update({
      where: { id },
      data: { status, closedAt: closedAtFor(status, existing.closedAt) },
    });
    revalidatePath("/repairs");
    revalidatePath("/repairs/overview");
    return { success: true, message: t("updateSuccess") };
  } catch {
    return { success: false, message: t("genericError") };
  }
}

export async function deleteRepairAction(id: number): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    await prisma.repairJob.delete({ where: { id } });
    revalidatePath("/repairs");
    revalidatePath("/repairs/overview");
    return { success: true, message: t("deleteSuccess") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export async function deleteRepairAttachmentAction(id: number): Promise<RepairActionState> {
  const session = await auth();
  const t = await getTranslations("RepairActions");
  if (!session?.user) return { success: false, message: t("loginRequired") };

  try {
    const row = await prisma.repairAttachment.delete({ where: { id } });
    revalidatePath(`/repairs/${row.repairJobId}/edit`);
    return { success: true, message: t("attachmentDeleted") };
  } catch (e: any) {
    if (e.code === "P2025") return { success: false, message: t("notFound") };
    return { success: false, message: t("genericError") };
  }
}

export interface RepairFilterParams {
  q?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
}

function buildRepairWhere({ q, status, type, from, to }: RepairFilterParams) {
  const where: any = {};

  if (q) {
    where.OR = [
      { jobNumber: { contains: q } },
      { deviceName: { contains: q } },
      { serialNo: { contains: q } },
      { problem: { contains: q } },
      { customerName: { contains: q } },
    ];
  }
  if (status && status in RepairStatus) where.status = status as RepairStatus;
  if (type && type in RepairType) where.type = type as RepairType;

  if (from || to) {
    where.reportedAt = {};
    if (from) where.reportedAt.gte = new Date(`${from}T00:00:00`);
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      where.reportedAt.lt = end;
    }
  }
  return where;
}

export async function getRepairJobs(filters: RepairFilterParams = {}) {
  const jobs = await prisma.repairJob.findMany({
    where: buildRepairWhere(filters),
    orderBy: { reportedAt: "desc" },
    include: {
      department: { select: { name: true } },
      technician: { select: { name: true } },
      createdBy:  { select: { name: true, email: true } },
      _count:     { select: { attachments: true } },
    },
  });

  return jobs.map((j) => ({
    ...j,
    partsCost:  Number(j.partsCost),
    labourCost: Number(j.labourCost),
    totalCost:  Number(j.totalCost),
  }));
}

export type RepairListItem = Awaited<ReturnType<typeof getRepairJobs>>[number];

export async function getRepairJobById(id: number) {
  const job = await prisma.repairJob.findUnique({
    where: { id },
    include: {
      attachments: { orderBy: { createdAt: "asc" } },
      department:  { select: { name: true } },
      technician:  { select: { name: true } },
    },
  });
  if (!job) return null;
  return {
    ...job,
    partsCost:  Number(job.partsCost),
    labourCost: Number(job.labourCost),
    totalCost:  Number(job.totalCost),
  };
}

export async function getRepairDashboardStats() {
  const overdueBefore = new Date();
  overdueBefore.setDate(overdueBefore.getDate() - OVERDUE_DAYS);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [grouped, overdue, monthAgg] = await Promise.all([
    prisma.repairJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.repairJob.count({
      where: { status: { in: OPEN_STATUSES }, reportedAt: { lt: overdueBefore } },
    }),
    prisma.repairJob.aggregate({
      _sum: { totalCost: true },
      where: { reportedAt: { gte: monthStart } },
    }),
  ]);

  const byStatus = Object.fromEntries(
    Object.values(RepairStatus).map((s) => [s, 0])
  ) as Record<RepairStatus, number>;
  for (const row of grouped) byStatus[row.status] = row._count._all;

  const open = OPEN_STATUSES.reduce((sum, s) => sum + byStatus[s], 0);

  return { open, overdue, byStatus, monthCost: Number(monthAgg._sum.totalCost ?? 0) };
}
```

- [ ] **Step 2: Add `RepairActions` translations**

`messages/en.json`:

```json
"RepairActions": {
  "loginRequired": "Please sign in first",
  "invalidData": "Please check the form",
  "deviceNameRequired": "Device name is required",
  "problemRequired": "Problem description is required",
  "departmentRequired": "Department is required for an internal job",
  "customerNameRequired": "Customer name is required for an external job",
  "costInvalid": "Cost cannot be negative",
  "reportedAtRequired": "Reported date is required",
  "illegalTransition": "That status change is not allowed",
  "jobNumberClash": "Job number collision, please try again",
  "fileTypeError": "Only PNG, JPG, WEBP or PDF files are allowed",
  "fileTooLarge": "Each file must be 10MB or smaller",
  "attachmentDeleted": "Attachment deleted",
  "notFound": "Repair job not found",
  "createSuccess": "Repair job created",
  "updateSuccess": "Repair job updated",
  "deleteSuccess": "Repair job deleted",
  "genericError": "Something went wrong"
}
```

`messages/th.json`:

```json
"RepairActions": {
  "loginRequired": "กรุณาเข้าสู่ระบบก่อน",
  "invalidData": "กรุณาตรวจสอบข้อมูลในฟอร์ม",
  "deviceNameRequired": "กรุณากรอกชื่ออุปกรณ์",
  "problemRequired": "กรุณากรอกอาการเสีย",
  "departmentRequired": "งานภายในต้องระบุแผนก",
  "customerNameRequired": "งานภายนอกต้องระบุชื่อลูกค้า",
  "costInvalid": "ค่าใช้จ่ายต้องไม่ติดลบ",
  "reportedAtRequired": "กรุณาระบุวันที่แจ้งซ่อม",
  "illegalTransition": "ไม่สามารถเปลี่ยนสถานะแบบนี้ได้",
  "jobNumberClash": "เลขที่งานซ้ำ กรุณาลองใหม่อีกครั้ง",
  "fileTypeError": "รองรับเฉพาะไฟล์ PNG, JPG, WEBP หรือ PDF",
  "fileTooLarge": "ไฟล์แต่ละไฟล์ต้องมีขนาดไม่เกิน 10MB",
  "attachmentDeleted": "ลบไฟล์แนบแล้ว",
  "notFound": "ไม่พบงานซ่อม",
  "createSuccess": "สร้างงานซ่อมแล้ว",
  "updateSuccess": "แก้ไขงานซ่อมแล้ว",
  "deleteSuccess": "ลบงานซ่อมแล้ว",
  "genericError": "เกิดข้อผิดพลาด"
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. If `tx as unknown as typeof prisma` errors, replace `nextJobNumber`'s parameter type with `Prisma.TransactionClient` imported from `@prisma/client` and drop the cast.

- [ ] **Step 4: Commit**

```bash
git add src/actions/repair.actions.ts messages
git commit -m "feat(repair): add repair job server actions with status workflow"
```

---

## Task 5: Repair list, filters, status badge

**Files:**
- Create: `src/components/repairs/RepairStatusBadge.tsx`, `RepairFilters.tsx`, `RepairRow.tsx`, `RepairStatusSelect.tsx`
- Replace: `src/app/(dashboard)/repairs/page.tsx`
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `getRepairJobs`, `deleteRepairAction`, `updateRepairStatusAction`, `RepairListItem` (Task 4)
- Produces: `RepairStatusBadge` (props `{ status: RepairStatus }`), used again in Task 7

- [ ] **Step 1: Create `src/components/repairs/RepairStatusBadge.tsx`**

```tsx
import { RepairStatus } from "@prisma/client";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";

const STYLES: Record<RepairStatus, string> = {
  RECEIVED:    "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  DONE:        "bg-emerald-100 text-emerald-700",
  RETURNED:    "bg-slate-200 text-slate-600",
  CANCELLED:   "bg-red-100 text-red-700",
};

export default function RepairStatusBadge({ status }: { status: RepairStatus }) {
  const t = useTranslations("Repairs");
  return (
    <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", STYLES[status])}>
      {t(`status${status}`)}
    </span>
  );
}
```

This is a Server Component by default and `useTranslations` works in both, so it can be used from the server list page and from client rows alike.

- [ ] **Step 2: Create `src/components/repairs/RepairFilters.tsx`**

Mirror the existing `src/components/transactions/TransactionFilters.tsx` interaction model (router push on change, spinner while pending).

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { RepairStatus, RepairType } from "@prisma/client";

export default function RepairFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("RepairFilters");
  const tr = useTranslations("Repairs");

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/repairs?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-100">
      <div className="relative flex-1 min-w-[200px]">
        <label className="label" htmlFor="q">{t("searchLabel")}</label>
        <Search size={15} className="absolute left-3 top-[38px] text-slate-400" />
        <input
          id="q" className="input pl-9" placeholder={t("searchPlaceholder")}
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
        />
        {pending && <Loader2 size={15} className="absolute right-3 top-[38px] animate-spin text-slate-400" />}
      </div>

      <div className="min-w-[150px]">
        <label className="label" htmlFor="status">{t("statusLabel")}</label>
        <select id="status" className="input" defaultValue={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {Object.values(RepairStatus).map((s) => (
            <option key={s} value={s}>{tr(`status${s}`)}</option>
          ))}
        </select>
      </div>

      <div className="min-w-[140px]">
        <label className="label" htmlFor="type">{t("typeLabel")}</label>
        <select id="type" className="input" defaultValue={params.get("type") ?? ""} onChange={(e) => update("type", e.target.value)}>
          <option value="">{t("allTypes")}</option>
          {Object.values(RepairType).map((v) => (
            <option key={v} value={v}>{tr(`type${v}`)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="from">{t("fromLabel")}</label>
        <input id="from" type="date" className="input" defaultValue={params.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="to">{t("toLabel")}</label>
        <input id="to" type="date" className="input" defaultValue={params.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/repairs/RepairStatusSelect.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RepairStatus } from "@prisma/client";
import { updateRepairStatusAction } from "@/actions/repair.actions";

export default function RepairStatusSelect({ id, status }: { id: number; status: RepairStatus }) {
  const t = useTranslations("Repairs");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      <select
        className="input py-1 text-xs"
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as RepairStatus;
          setError("");
          startTransition(async () => {
            const res = await updateRepairStatusAction(id, next);
            if (!res.success) setError(res.message);
          });
        }}
      >
        {Object.values(RepairStatus).map((s) => (
          <option key={s} value={s}>{t(`status${s}`)}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/repairs/RepairRow.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Paperclip } from "lucide-react";
import { deleteRepairAction, type RepairListItem } from "@/actions/repair.actions";
import RepairStatusSelect from "./RepairStatusSelect";

export default function RepairRow({ job }: { job: RepairListItem }) {
  const t = useTranslations("Repairs");
  const tc = useTranslations("Common");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm(t("confirmDelete", { jobNumber: job.jobNumber }))) return;
    setDeleting(true);
    setError("");
    const res = await deleteRepairAction(job.id);
    if (!res.success) setError(res.message);
    setDeleting(false);
  }

  const owner = job.type === "INTERNAL" ? job.department?.name ?? "-" : job.customerName ?? "-";

  return (
    <tr className="hover:bg-slate-50 align-top">
      <td className="px-5 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{job.jobNumber}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800">{job.deviceName}</p>
        <p className="text-xs text-slate-500 line-clamp-1">{job.problem}</p>
        {job._count.attachments > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <Paperclip size={11} />{job._count.attachments}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">
        <span className="text-xs text-slate-400 block">{t(`type${job.type}`)}</span>
        {owner}
      </td>
      <td className="px-4 py-3 text-slate-600">{job.technician?.name ?? "-"}</td>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
        {new Date(job.reportedAt).toLocaleDateString("th-TH")}
      </td>
      <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
        {job.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-3">
        <RepairStatusSelect id={job.id} status={job.status} />
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        <Link href={`/repairs/${job.id}/edit`} className="inline-block p-1.5 text-slate-400 hover:text-blue-600" title={tc("edit")}>
          <Pencil size={15} />
        </Link>
        <button onClick={handleDelete} disabled={deleting} className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-50" title={tc("delete")}>
          <Trash2 size={15} />
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
```

- [ ] **Step 5: Replace `src/app/(dashboard)/repairs/page.tsx`**

```tsx
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getRepairJobs } from "@/actions/repair.actions";
import RepairFilters from "@/components/repairs/RepairFilters";
import RepairRow from "@/components/repairs/RepairRow";

export const revalidate = 0;

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const [jobs, t] = await Promise.all([
    getRepairJobs(params),
    getTranslations("Repairs"),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("itemsCount", { count: jobs.length })}</p>
        </div>
        <Link href="/repairs/new" className="btn-primary">
          <PlusCircle size={16} />
          {t("addNew")}
        </Link>
      </div>

      <div className="card overflow-hidden">
        <RepairFilters />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t("colJobNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("colDevice")}</th>
                <th className="px-4 py-3 font-medium">{t("colOwner")}</th>
                <th className="px-4 py-3 font-medium">{t("colTechnician")}</th>
                <th className="px-4 py-3 font-medium">{t("colReportedAt")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("colTotalCost")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
              )}
              {jobs.map((job) => <RepairRow key={job.id} job={job} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add `Repairs` and `RepairFilters` translations**

`messages/en.json`:

```json
"Repairs": {
  "title": "Repair Jobs",
  "itemsCount": "{count} repair jobs",
  "addNew": "New repair",
  "empty": "No repair jobs yet",
  "colJobNumber": "Job No.",
  "colDevice": "Device / Problem",
  "colOwner": "Reported by",
  "colTechnician": "Technician",
  "colReportedAt": "Reported",
  "colTotalCost": "Total cost",
  "colStatus": "Status",
  "colActions": "Actions",
  "confirmDelete": "Delete repair job {jobNumber}?",
  "statusRECEIVED": "Received",
  "statusIN_PROGRESS": "In progress",
  "statusDONE": "Done",
  "statusRETURNED": "Returned",
  "statusCANCELLED": "Cancelled",
  "typeINTERNAL": "Internal",
  "typeEXTERNAL": "External"
},
"RepairFilters": {
  "searchLabel": "Search",
  "searchPlaceholder": "Job no., device, serial, customer…",
  "statusLabel": "Status",
  "allStatuses": "All statuses",
  "typeLabel": "Type",
  "allTypes": "All types",
  "fromLabel": "From",
  "toLabel": "To"
}
```

`messages/th.json`:

```json
"Repairs": {
  "title": "งานซ่อม",
  "itemsCount": "งานซ่อม {count} รายการ",
  "addNew": "เปิดงานซ่อม",
  "empty": "ยังไม่มีงานซ่อม",
  "colJobNumber": "เลขที่งาน",
  "colDevice": "อุปกรณ์ / อาการ",
  "colOwner": "ผู้แจ้ง",
  "colTechnician": "ช่างซ่อม",
  "colReportedAt": "วันที่แจ้ง",
  "colTotalCost": "ค่าใช้จ่ายรวม",
  "colStatus": "สถานะ",
  "colActions": "จัดการ",
  "confirmDelete": "ต้องการลบงานซ่อม {jobNumber} ใช่หรือไม่?",
  "statusRECEIVED": "รับเรื่อง",
  "statusIN_PROGRESS": "กำลังซ่อม",
  "statusDONE": "ซ่อมเสร็จ",
  "statusRETURNED": "ส่งคืนแล้ว",
  "statusCANCELLED": "ยกเลิก",
  "typeINTERNAL": "ภายใน",
  "typeEXTERNAL": "ภายนอก"
},
"RepairFilters": {
  "searchLabel": "ค้นหา",
  "searchPlaceholder": "เลขที่งาน, อุปกรณ์, S/N, ลูกค้า…",
  "statusLabel": "สถานะ",
  "allStatuses": "ทุกสถานะ",
  "typeLabel": "ประเภท",
  "allTypes": "ทุกประเภท",
  "fromLabel": "ตั้งแต่",
  "toLabel": "ถึง"
}
```

- [ ] **Step 7: Typecheck and verify**

Run: `npx tsc --noEmit` → PASS.

`/repairs` renders an empty table (no data yet — Task 6 adds creation). Confirm all four filter controls render, the status dropdown lists five translated statuses, and switching language translates the headers.

- [ ] **Step 8: Commit**

```bash
git add src/components/repairs src/app/\(dashboard\)/repairs/page.tsx messages
git commit -m "feat(repair): add repair job list with filters and inline status change"
```

---

## Task 6: Repair form, attachments, create and edit pages

**Files:**
- Create: `src/components/repairs/RepairForm.tsx`, `RepairAttachments.tsx`
- Replace: `src/app/(dashboard)/repairs/new/page.tsx`
- Create: `src/app/(dashboard)/repairs/[id]/edit/page.tsx`
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `createRepairAction`, `updateRepairAction`, `getRepairJobById`, `deleteRepairAttachmentAction` (Task 4); `getTechnicians` (Task 3); `getDepartments` from `@/actions/department.actions`
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Confirm the departments getter name**

Run: `grep -n "export async function get" src/actions/department.actions.ts`

Use whatever function it exports (expected `getDepartments`). If the name differs, substitute it everywhere below.

- [ ] **Step 2: Create `src/components/repairs/RepairAttachments.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, FileText, ImageIcon } from "lucide-react";
import { deleteRepairAttachmentAction } from "@/actions/repair.actions";

interface Attachment {
  id: number;
  fileUrl: string;
  fileName: string;
  mimeType: string;
}

export default function RepairAttachments({ attachments }: { attachments: Attachment[] }) {
  const t = useTranslations("RepairForm");
  const [removed, setRemoved] = useState<number[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  const visible = attachments.filter((a) => !removed.includes(a.id));
  if (visible.length === 0) return <p className="text-xs text-slate-400">{t("noAttachments")}</p>;

  async function remove(id: number) {
    if (!confirm(t("confirmDeleteAttachment"))) return;
    setBusy(id);
    const res = await deleteRepairAttachmentAction(id);
    if (res.success) setRemoved((prev) => [...prev, id]);
    setBusy(null);
  }

  return (
    <ul className="space-y-1.5">
      {visible.map((a) => (
        <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          {a.mimeType === "application/pdf" ? <FileText size={15} className="text-slate-400" /> : <ImageIcon size={15} className="text-slate-400" />}
          <a href={a.fileUrl} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm text-blue-600 hover:underline">
            {a.fileName}
          </a>
          <button
            type="button" onClick={() => remove(a.id)} disabled={busy === a.id}
            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Create `src/components/repairs/RepairForm.tsx`**

```tsx
"use client";

import { useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { RepairStatus, RepairType } from "@prisma/client";
import {
  createRepairAction, updateRepairAction, type RepairActionState,
} from "@/actions/repair.actions";
import RepairAttachments from "./RepairAttachments";

const initState: RepairActionState = { success: false, message: "" };

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
}

interface RepairFormProps {
  departments: { id: number; name: string }[];
  technicians: { id: number; name: string; isActive: boolean }[];
  job?: {
    id: number;
    jobNumber: string;
    type: RepairType;
    departmentId: number | null;
    customerName: string | null;
    customerPhone: string | null;
    deviceName: string;
    serialNo: string | null;
    problem: string;
    partsUsed: string | null;
    partsCost: number;
    labourCost: number;
    status: RepairStatus;
    technicianId: number | null;
    reportedAt: Date;
    note: string | null;
    attachments: { id: number; fileUrl: string; fileName: string; mimeType: string }[];
  };
}

export default function RepairForm({ departments, technicians, job }: RepairFormProps) {
  const t = useTranslations("RepairForm");
  const tr = useTranslations("Repairs");
  const tc = useTranslations("Common");
  const isEdit = !!job;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateRepairAction : createRepairAction,
    initState
  );
  const [type, setType] = useState<RepairType>(job?.type ?? RepairType.INTERNAL);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.push("/repairs");
  }, [state.success, router]);

  const fieldError = (field: string) => state.errors?.[field]?.[0];
  const activeTechnicians = technicians.filter((tech) => tech.isActive || tech.id === job?.technicianId);

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={job.id} />}

      {isEdit && (
        <p className="text-sm text-slate-500">
          {t("jobNumberLabel")}: <span className="font-mono font-semibold text-slate-700">{job.jobNumber}</span>
        </p>
      )}

      {/* Type */}
      <div>
        <label className="label">{t("typeLabel")}</label>
        <div className="flex gap-4">
          {Object.values(RepairType).map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio" name="type" value={v} checked={type === v}
                onChange={() => setType(v)}
              />
              {tr(`type${v}`)}
            </label>
          ))}
        </div>
      </div>

      {/* Type-scoped fields */}
      {type === RepairType.INTERNAL ? (
        <div>
          <label className="label" htmlFor="departmentId">{t("departmentLabel")}</label>
          <select id="departmentId" name="departmentId" className="input" defaultValue={job?.departmentId ?? ""}>
            <option value="">{t("departmentPlaceholder")}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {fieldError("departmentId") && <p className="mt-1 text-xs text-red-600">{fieldError("departmentId")}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="customerName">{t("customerNameLabel")}</label>
            <input id="customerName" name="customerName" className="input" defaultValue={job?.customerName ?? ""} />
            {fieldError("customerName") && <p className="mt-1 text-xs text-red-600">{fieldError("customerName")}</p>}
          </div>
          <div>
            <label className="label" htmlFor="customerPhone">{t("customerPhoneLabel")}</label>
            <input id="customerPhone" name="customerPhone" className="input" defaultValue={job?.customerPhone ?? ""} />
          </div>
        </div>
      )}

      {/* Device */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="deviceName">{t("deviceNameLabel")}</label>
          <input id="deviceName" name="deviceName" className="input" placeholder={t("deviceNamePlaceholder")} defaultValue={job?.deviceName} required />
          {fieldError("deviceName") && <p className="mt-1 text-xs text-red-600">{fieldError("deviceName")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="serialNo">{t("serialNoLabel")}</label>
          <input id="serialNo" name="serialNo" className="input" defaultValue={job?.serialNo ?? ""} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="problem">{t("problemLabel")}</label>
        <textarea id="problem" name="problem" rows={2} className="input resize-none" placeholder={t("problemPlaceholder")} defaultValue={job?.problem} required />
        {fieldError("problem") && <p className="mt-1 text-xs text-red-600">{fieldError("problem")}</p>}
      </div>

      {/* Assignment */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label" htmlFor="technicianId">{t("technicianLabel")}</label>
          <select id="technicianId" name="technicianId" className="input" defaultValue={job?.technicianId ?? ""}>
            <option value="">{t("technicianPlaceholder")}</option>
            {activeTechnicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">{t("statusLabel")}</label>
          <select id="status" name="status" className="input" defaultValue={job?.status ?? RepairStatus.RECEIVED}>
            {Object.values(RepairStatus).map((s) => <option key={s} value={s}>{tr(`status${s}`)}</option>)}
          </select>
          {fieldError("status") && <p className="mt-1 text-xs text-red-600">{fieldError("status")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="reportedAt">{t("reportedAtLabel")}</label>
          <input id="reportedAt" name="reportedAt" type="date" className="input" defaultValue={toDateInputValue(job?.reportedAt)} required />
        </div>
      </div>

      {/* Parts and cost */}
      <div>
        <label className="label" htmlFor="partsUsed">{t("partsUsedLabel")}</label>
        <textarea id="partsUsed" name="partsUsed" rows={2} className="input resize-none" placeholder={t("partsUsedPlaceholder")} defaultValue={job?.partsUsed ?? ""} />
        <p className="mt-1 text-xs text-slate-400">{t("partsUsedHint")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="partsCost">{t("partsCostLabel")}</label>
          <input id="partsCost" name="partsCost" type="number" min={0} step="0.01" className="input" placeholder="0.00" defaultValue={job?.partsCost ?? 0} />
          {fieldError("partsCost") && <p className="mt-1 text-xs text-red-600">{fieldError("partsCost")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="labourCost">{t("labourCostLabel")}</label>
          <input id="labourCost" name="labourCost" type="number" min={0} step="0.01" className="input" placeholder="0.00" defaultValue={job?.labourCost ?? 0} />
          {fieldError("labourCost") && <p className="mt-1 text-xs text-red-600">{fieldError("labourCost")}</p>}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="note">{t("noteLabel")}</label>
        <textarea id="note" name="note" rows={2} className="input resize-none" defaultValue={job?.note ?? ""} />
      </div>

      {/* Attachments */}
      <div>
        <label className="label">{t("attachmentsLabel")}</label>
        {isEdit && <div className="mb-2"><RepairAttachments attachments={job.attachments} /></div>}
        <input name="files" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="input" />
        <p className="mt-1 text-xs text-slate-400">{t("attachmentsHint")}</p>
      </div>

      {state.message && (
        <p className={clsx(
          "text-sm font-medium rounded-lg px-3 py-2",
          state.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        )}>
          {state.success ? "✅ " : "❌ "}{state.message}
        </p>
      )}

      <div className="pt-2 flex gap-3">
        <Link href="/repairs" className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors text-center">
          {tc("cancel")}
        </Link>
        <button type="submit" disabled={pending} className={clsx("btn-primary flex-1 justify-center py-2.5", pending && "opacity-60 cursor-not-allowed")}>
          {pending ? tc("saving") : isEdit ? t("saveEdit") : t("add")}
        </button>
      </div>
    </form>
  );
}
```

Fields for the inactive type are unmounted, so the browser does not submit them and `typeScopedFields` nulls the other side regardless.

- [ ] **Step 4: Replace `src/app/(dashboard)/repairs/new/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { getDepartments } from "@/actions/department.actions";
import { getTechnicians } from "@/actions/technician.actions";
import RepairForm from "@/components/repairs/RepairForm";

export const revalidate = 0;

export default async function NewRepairPage() {
  const [departments, technicians, t] = await Promise.all([
    getDepartments(),
    getTechnicians(false),
    getTranslations("RepairForm"),
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("newTitle")}</h1>
      <div className="card p-6">
        <RepairForm departments={departments} technicians={technicians} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/(dashboard)/repairs/[id]/edit/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDepartments } from "@/actions/department.actions";
import { getTechnicians } from "@/actions/technician.actions";
import { getRepairJobById } from "@/actions/repair.actions";
import RepairForm from "@/components/repairs/RepairForm";

export const revalidate = 0;

export default async function EditRepairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, departments, technicians, t] = await Promise.all([
    getRepairJobById(Number(id)),
    getDepartments(),
    getTechnicians(),
    getTranslations("RepairForm"),
  ]);

  if (!job) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t("editTitle")}</h1>
      <div className="card p-6">
        <RepairForm departments={departments} technicians={technicians} job={job} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add `RepairForm` translations**

`messages/en.json`:

```json
"RepairForm": {
  "newTitle": "New repair job",
  "editTitle": "Edit repair job",
  "jobNumberLabel": "Job number",
  "typeLabel": "Job type",
  "departmentLabel": "Department",
  "departmentPlaceholder": "— Select department —",
  "customerNameLabel": "Customer name",
  "customerPhoneLabel": "Customer phone",
  "deviceNameLabel": "Device",
  "deviceNamePlaceholder": "e.g. HP LaserJet M404",
  "serialNoLabel": "Serial no.",
  "problemLabel": "Problem",
  "problemPlaceholder": "Describe the fault",
  "technicianLabel": "Technician",
  "technicianPlaceholder": "— Unassigned —",
  "statusLabel": "Status",
  "reportedAtLabel": "Reported date",
  "partsUsedLabel": "Parts used",
  "partsUsedPlaceholder": "e.g. 1x RAM 8GB, 1x SSD 256GB",
  "partsUsedHint": "Free text — this does not change stock levels",
  "partsCostLabel": "Parts cost",
  "labourCostLabel": "Labour cost",
  "noteLabel": "Note",
  "attachmentsLabel": "Attachments",
  "attachmentsHint": "PNG, JPG, WEBP or PDF — up to 10MB each",
  "noAttachments": "No attachments",
  "confirmDeleteAttachment": "Delete this attachment?",
  "add": "Create repair job",
  "saveEdit": "Save changes"
}
```

`messages/th.json`:

```json
"RepairForm": {
  "newTitle": "เปิดงานซ่อมใหม่",
  "editTitle": "แก้ไขงานซ่อม",
  "jobNumberLabel": "เลขที่งาน",
  "typeLabel": "ประเภทงาน",
  "departmentLabel": "แผนก",
  "departmentPlaceholder": "— เลือกแผนก —",
  "customerNameLabel": "ชื่อลูกค้า",
  "customerPhoneLabel": "เบอร์โทรลูกค้า",
  "deviceNameLabel": "อุปกรณ์",
  "deviceNamePlaceholder": "เช่น HP LaserJet M404",
  "serialNoLabel": "หมายเลขเครื่อง",
  "problemLabel": "อาการเสีย",
  "problemPlaceholder": "อธิบายอาการเสีย",
  "technicianLabel": "ช่างซ่อม",
  "technicianPlaceholder": "— ยังไม่มอบหมาย —",
  "statusLabel": "สถานะ",
  "reportedAtLabel": "วันที่แจ้ง",
  "partsUsedLabel": "อะไหล่ที่ใช้",
  "partsUsedPlaceholder": "เช่น RAM 8GB 1 ตัว, SSD 256GB 1 ตัว",
  "partsUsedHint": "ข้อความอิสระ — ไม่ตัดสต็อกสินค้า",
  "partsCostLabel": "ค่าอะไหล่",
  "labourCostLabel": "ค่าแรง",
  "noteLabel": "หมายเหตุ",
  "attachmentsLabel": "ไฟล์แนบ",
  "attachmentsHint": "PNG, JPG, WEBP หรือ PDF ไฟล์ละไม่เกิน 10MB",
  "noAttachments": "ไม่มีไฟล์แนบ",
  "confirmDeleteAttachment": "ต้องการลบไฟล์แนบนี้ใช่หรือไม่?",
  "add": "สร้างงานซ่อม",
  "saveEdit": "บันทึกการแก้ไข"
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Manual verification — the core acceptance pass**

1. `/repairs/new`, type = Internal, leave Department empty, submit → department error shown, nothing saved
2. Fill department + device + problem, submit → redirects to `/repairs`, row appears with job number `RJ-YYMM-001`
3. Create a second internal job → `RJ-YYMM-002`
4. Create an External job: department field is gone, customer name required, saves with customer shown in "Reported by"
5. Set partsCost 100, labourCost 250 → list shows total 350.00
6. Edit that job, change status Received → Done directly. Expect the "status change is not allowed" error (Received only permits In progress or Cancelled)
7. Change Received → In progress → Done → Returned in three saves; after Returned, check `closedAt` is set:
   ```bash
   npx prisma db execute --stdin <<'SQL'
   SELECT jobNumber, status, closedAt FROM RepairJob ORDER BY id DESC LIMIT 5;
   SQL
   ```
8. Move it back Returned → Done and confirm `closedAt` becomes NULL
9. Upload two images and a PDF on edit; confirm all three list, open in a new tab, and render
10. Sign out, paste an attachment URL directly → expect 401
11. Delete an attachment → disappears from the list; reload confirms
12. Use the inline status dropdown on the list; an illegal move shows the error under the select
13. Delete a job → its attachment rows disappear too:
    ```bash
    npx prisma db execute --stdin <<'SQL'
    SELECT COUNT(*) FROM RepairAttachment WHERE repairJobId NOT IN (SELECT id FROM RepairJob);
    SQL
    ```
    Expected: 0
14. Repeat steps 2 and 4 in Thai and confirm every label and error is translated

- [ ] **Step 9: Commit**

```bash
git add src/components/repairs src/app/\(dashboard\)/repairs messages
git commit -m "feat(repair): add repair job create/edit form with attachments"
```

---

## Task 7: Repair overview page

**Files:**
- Replace: `src/app/(dashboard)/repairs/overview/page.tsx`
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `getRepairDashboardStats`, `getRepairJobs` (Task 4); `RepairStatusBadge` (Task 5)

- [ ] **Step 1: Replace the page**

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RepairStatus } from "@prisma/client";
import { getRepairDashboardStats, getRepairJobs } from "@/actions/repair.actions";
import RepairStatusBadge from "@/components/repairs/RepairStatusBadge";

export const revalidate = 0;

export default async function RepairOverviewPage() {
  const [stats, recent, t] = await Promise.all([
    getRepairDashboardStats(),
    getRepairJobs({}),
    getTranslations("RepairOverview"),
  ]);

  const cards = [
    { key: "open",    value: String(stats.open),     tone: "text-slate-900" },
    { key: "overdue", value: String(stats.overdue),  tone: stats.overdue > 0 ? "text-amber-600" : "text-slate-900" },
    { key: "done",    value: String(stats.byStatus[RepairStatus.DONE]), tone: "text-emerald-600" },
    {
      key: "monthCost",
      value: stats.monthCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      tone: "text-slate-900",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("subtitle", { days: 7 })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.key} className="card p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400">{t(`card_${c.key}`)}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">{t("recentTitle")}</h2>
          <Link href="/repairs" className="text-xs font-medium text-blue-600 hover:underline">{t("viewAll")}</Link>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {recent.length === 0 && (
              <tr><td className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
            )}
            {recent.slice(0, 8).map((job) => (
              <tr key={job.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{job.jobNumber}</td>
                <td className="px-4 py-3">
                  <Link href={`/repairs/${job.id}/edit`} className="font-medium text-slate-800 hover:text-blue-600">
                    {job.deviceName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{job.technician?.name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {new Date(job.reportedAt).toLocaleDateString("th-TH")}
                </td>
                <td className="px-5 py-3 text-right"><RepairStatusBadge status={job.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `RepairOverview` translations**

`messages/en.json`:

```json
"RepairOverview": {
  "title": "Repair Overview",
  "subtitle": "Open jobs older than {days} days count as overdue",
  "card_open": "Open repairs",
  "card_overdue": "Overdue",
  "card_done": "Awaiting return",
  "card_monthCost": "Cost this month",
  "recentTitle": "Recent repair jobs",
  "viewAll": "View all",
  "empty": "No repair jobs yet"
}
```

`messages/th.json`:

```json
"RepairOverview": {
  "title": "ภาพรวมงานซ่อม",
  "subtitle": "งานที่ค้างเกิน {days} วัน นับเป็นงานเกินกำหนด",
  "card_open": "งานที่ยังไม่ปิด",
  "card_overdue": "เกินกำหนด",
  "card_done": "รอส่งคืน",
  "card_monthCost": "ค่าใช้จ่ายเดือนนี้",
  "recentTitle": "งานซ่อมล่าสุด",
  "viewAll": "ดูทั้งหมด",
  "empty": "ยังไม่มีงานซ่อม"
}
```

- [ ] **Step 3: Typecheck and verify**

`npx tsc --noEmit` → PASS. On `/repairs/overview` the four cards show counts matching `/repairs`, and the recent table lists at most 8 jobs newest first.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/repairs/overview messages
git commit -m "feat(repair): add repair overview page"
```

---

## Task 8: Generalize reportExport (behaviour-preserving)

No repair code in this task. Pure refactor so Task 9 can reuse the exporters.

**Files:**
- Modify: `src/lib/reportExport.ts`
- Create: `src/lib/reportColumns.ts`
- Modify: `src/app/api/reports/[month]/route.ts`, `src/app/api/reports/year/[year]/route.ts`, `src/app/api/transactions/export/route.ts`

**Interfaces:**
- Produces:
  - `ExcelColumn<T> = { header: string; key: string; width: number; numFmt?: string; value: (row: T) => string | number }`
  - `PdfColumn<T> = { label: string; width: number; align: "left" | "right" | "center"; value: (row: T) => string }`
  - `buildExcelReport<T>(sheetName: string, columns: ExcelColumn<T>[], rows: T[]): Promise<ArrayBuffer>`
  - `buildPdfReport<T>(title: string, columns: PdfColumn<T>[], rows: T[], footer?: (rows: T[]) => string): Promise<Buffer>`
  - `TRANSACTION_EXCEL_COLUMNS`, `TRANSACTION_PDF_COLUMNS`, `transactionFooter`

- [ ] **Step 1: Capture baseline exports before changing anything**

With the dev server running and signed in, download one of each and keep them for comparison:

```bash
mkdir -p /tmp/report-baseline
# In the browser, download the current month's Excel and PDF plus the
# transactions Excel export, and move all three into /tmp/report-baseline/
ls -l /tmp/report-baseline
```

Note each file's size. Step 6 compares against these.

- [ ] **Step 2: Rewrite `src/lib/reportExport.ts`**

Keep lines 1–14 (imports and the `THAI_FONT` comment and constant) **exactly as they are**, except the now-unused `TransactionDetailRow` import, which is removed. Replace everything from line 16 onward:

```ts
export interface ExcelColumn<T> {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
  value: (row: T) => string | number;
}

export interface PdfColumn<T> {
  label: string;
  width: number;
  align: "left" | "right" | "center";
  value: (row: T) => string;
}

export async function buildExcelReport<T>(
  sheetName: string,
  columns: ExcelColumn<T>[],
  rows: T[]
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, c.value(row)])));
  }

  for (const c of columns) {
    if (c.numFmt) sheet.getColumn(c.key).numFmt = c.numFmt;
  }

  return workbook.xlsx.writeBuffer();
}
```

Keep `THAI_RUN`, `splitRuns` and `drawText` (lines 59–93) **byte-identical**. Then replace `buildPdfReport`:

```ts
export async function buildPdfReport<T>(
  title: string,
  columns: PdfColumn<T>[],
  rows: T[],
  footer?: (rows: T[]) => string
) {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.registerFont("thai", THAI_FONT);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fontSize(16);
  drawText(doc, title, doc.page.margins.left, doc.y, pageWidth, "center");
  doc.moveDown(1.5);

  const startX = doc.page.margins.left;
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  let y = doc.y;

  const drawHeader = () => {
    let x = startX;
    doc.fontSize(9).fillColor("#333");
    for (const col of columns) {
      drawText(doc, col.label, x, y, col.width, col.align);
      x += col.width;
    }
    y += 16;
    doc.moveTo(startX, y).lineTo(startX + tableWidth, y).strokeColor("#ccc").stroke();
    y += 4;
  };

  drawHeader();

  for (const row of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }

    let x = startX;
    doc.fontSize(8).fillColor("#111");
    for (const col of columns) {
      drawText(doc, col.value(row), x, y, col.width, col.align);
      x += col.width;
    }
    y += 16;
  }

  doc.moveTo(startX, y).lineTo(startX + tableWidth, y).strokeColor("#ccc").stroke();
  y += 8;
  doc.fontSize(10).fillColor("#000");
  if (footer) drawText(doc, footer(rows), startX, y, tableWidth, "right");

  doc.end();
  return done;
}
```

- [ ] **Step 3: Create `src/lib/reportColumns.ts`**

These reproduce the previous hard-coded layouts exactly — same headers, widths, order, formatting and Thai labels.

```ts
import type { TransactionDetailRow } from "@/actions/report.actions";
import type { ExcelColumn, PdfColumn } from "./reportExport";

const money = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TRANSACTION_EXCEL_COLUMNS: ExcelColumn<TransactionDetailRow>[] = [
  { header: "Date",         key: "date",      width: 14, value: (r) => r.createdAt.toLocaleDateString("th-TH") },
  { header: "Type",         key: "type",      width: 10, value: (r) => (r.type === "IN" ? "นำเข้า" : "เบิกออก") },
  { header: "Product Code", key: "code",      width: 14, value: (r) => r.productCode },
  { header: "Product Name", key: "name",      width: 30, value: (r) => r.productName },
  { header: "Quantity",     key: "quantity",  width: 10, value: (r) => (r.type === "IN" ? r.quantity : -r.quantity) },
  { header: "Unit",         key: "unit",      width: 10, value: (r) => r.unit ?? "ชิ้น" },
  { header: "Unit Price",   key: "unitPrice", width: 14, numFmt: "#,##0.00", value: (r) => r.unitPrice },
  { header: "Cost",         key: "cost",      width: 14, numFmt: "#,##0.00", value: (r) => r.cost },
  { header: "Reason",       key: "reason",    width: 18, value: (r) => r.reason },
  { header: "Receiver",     key: "receiver",  width: 16, value: (r) => r.receiver ?? "" },
  { header: "Note",         key: "note",      width: 20, value: (r) => r.note ?? "" },
  { header: "Operator",     key: "operator",  width: 20, value: (r) => r.operator },
];

export const TRANSACTION_PDF_COLUMNS: PdfColumn<TransactionDetailRow>[] = [
  { label: "Date",         width: 60,  align: "left",   value: (r) => r.createdAt.toLocaleDateString("th-TH") },
  { label: "Type",         width: 45,  align: "center", value: (r) => (r.type === "IN" ? "นำเข้า" : "เบิกออก") },
  { label: "Code",         width: 55,  align: "left",   value: (r) => r.productCode },
  { label: "Product Name", width: 130, align: "left",   value: (r) => r.productName },
  { label: "Quantity",     width: 45,  align: "right",  value: (r) => `${r.type === "IN" ? "+" : "-"}${r.quantity} ${r.unit ?? "ชิ้น"}` },
  { label: "Unit Price",   width: 65,  align: "right",  value: (r) => money(r.unitPrice) },
  { label: "Cost",         width: 70,  align: "right",  value: (r) => money(r.cost) },
  { label: "Receiver",     width: 80,  align: "left",   value: (r) => r.receiver ?? "-" },
  { label: "Operator",     width: 90,  align: "left",   value: (r) => r.operator },
];

export function transactionFooter(rows: TransactionDetailRow[]) {
  const total = rows.reduce((s, r) => s + r.cost, 0);
  return `Total: ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`;
}
```

- [ ] **Step 4: Update the three existing routes**

In each of `src/app/api/reports/[month]/route.ts`, `src/app/api/reports/year/[year]/route.ts`, `src/app/api/transactions/export/route.ts`:

Add the import:

```ts
import {
  TRANSACTION_EXCEL_COLUMNS, TRANSACTION_PDF_COLUMNS, transactionFooter,
} from "@/lib/reportColumns";
```

Then change each call site:

```ts
// before: buildExcelReport(sheetName, rows)
buildExcelReport(sheetName, TRANSACTION_EXCEL_COLUMNS, rows)

// before: buildPdfReport(title, rows)
buildPdfReport(title, TRANSACTION_PDF_COLUMNS, rows, transactionFooter)
```

Leave the surrounding auth, filename and header logic untouched.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. Any error here means a call site was missed.

- [ ] **Step 6: Verify output is unchanged**

Download the same three reports again into `/tmp/report-after/`, then:

```bash
ls -l /tmp/report-baseline /tmp/report-after
```

Excel files will not be byte-identical (ExcelJS writes a timestamp), so compare **sheet content** instead:

```bash
cd /tmp && for f in report-baseline report-after; do
  unzip -p $f/*.xlsx xl/worksheets/sheet1.xml > /tmp/$f-sheet.xml
done
diff /tmp/report-baseline-sheet.xml /tmp/report-after-sheet.xml && echo "EXCEL IDENTICAL"
```

Expected: `EXCEL IDENTICAL`.

For the PDF, open both and confirm identical column headers, row values, page count, and that Thai text (including a row containing แ) renders correctly. File sizes should match within a few bytes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reportExport.ts src/lib/reportColumns.ts src/app/api
git commit -m "refactor(reports): drive Excel/PDF exporters from column definitions"
```

---

## Task 9: Repair reports page and export route

**Files:**
- Create: `src/actions/repairReport.actions.ts`
- Replace: `src/app/(dashboard)/repairs/reports/page.tsx`
- Create: `src/app/api/repairs/reports/route.ts`
- Modify: `src/lib/reportColumns.ts`
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `buildExcelReport`, `buildPdfReport`, `ExcelColumn`, `PdfColumn` (Task 8)
- Produces: `RepairReportRow`, `getRepairReport(year: number, month?: number)`, `REPAIR_EXCEL_COLUMNS`, `REPAIR_PDF_COLUMNS`, `repairFooter`

- [ ] **Step 1: Create `src/actions/repairReport.actions.ts`**

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { RepairStatus, RepairType } from "@prisma/client";

export interface RepairReportRow {
  jobNumber:  string;
  reportedAt: Date;
  type:       RepairType;
  owner:      string;
  deviceName: string;
  problem:    string;
  technician: string;
  status:     RepairStatus;
  partsCost:  number;
  labourCost: number;
  totalCost:  number;
}

export interface RepairReportSummary {
  rows:          RepairReportRow[];
  totalJobs:     number;
  totalCost:     number;
  internalJobs:  number;
  externalJobs:  number;
  internalCost:  number;
  externalCost:  number;
}

/** `month` is 1-12. Omit it for a full-year report. */
export async function getRepairReport(year: number, month?: number): Promise<RepairReportSummary> {
  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const end   = month ? new Date(year, month, 1)     : new Date(year + 1, 0, 1);

  const jobs = await prisma.repairJob.findMany({
    where: { reportedAt: { gte: start, lt: end } },
    orderBy: { reportedAt: "asc" },
    include: {
      department: { select: { name: true } },
      technician: { select: { name: true } },
    },
  });

  const rows: RepairReportRow[] = jobs.map((j) => ({
    jobNumber:  j.jobNumber,
    reportedAt: j.reportedAt,
    type:       j.type,
    owner:      j.type === RepairType.INTERNAL ? j.department?.name ?? "-" : j.customerName ?? "-",
    deviceName: j.deviceName,
    problem:    j.problem,
    technician: j.technician?.name ?? "-",
    status:     j.status,
    partsCost:  Number(j.partsCost),
    labourCost: Number(j.labourCost),
    totalCost:  Number(j.totalCost),
  }));

  const sum = (pred: (r: RepairReportRow) => boolean) =>
    rows.filter(pred).reduce((s, r) => s + r.totalCost, 0);

  return {
    rows,
    totalJobs:    rows.length,
    totalCost:    rows.reduce((s, r) => s + r.totalCost, 0),
    internalJobs: rows.filter((r) => r.type === RepairType.INTERNAL).length,
    externalJobs: rows.filter((r) => r.type === RepairType.EXTERNAL).length,
    internalCost: sum((r) => r.type === RepairType.INTERNAL),
    externalCost: sum((r) => r.type === RepairType.EXTERNAL),
  };
}
```

- [ ] **Step 2: Append repair columns to `src/lib/reportColumns.ts`**

```ts
import type { RepairReportRow } from "@/actions/repairReport.actions";

export const REPAIR_EXCEL_COLUMNS: ExcelColumn<RepairReportRow>[] = [
  { header: "Job No.",     key: "jobNumber",  width: 16, value: (r) => r.jobNumber },
  { header: "Reported",    key: "reportedAt", width: 14, value: (r) => r.reportedAt.toLocaleDateString("th-TH") },
  { header: "Type",        key: "type",       width: 12, value: (r) => (r.type === "INTERNAL" ? "ภายใน" : "ภายนอก") },
  { header: "Reported by", key: "owner",      width: 22, value: (r) => r.owner },
  { header: "Device",      key: "device",     width: 28, value: (r) => r.deviceName },
  { header: "Problem",     key: "problem",    width: 34, value: (r) => r.problem },
  { header: "Technician",  key: "technician", width: 20, value: (r) => r.technician },
  { header: "Status",      key: "status",     width: 14, value: (r) => r.status },
  { header: "Parts Cost",  key: "partsCost",  width: 14, numFmt: "#,##0.00", value: (r) => r.partsCost },
  { header: "Labour Cost", key: "labourCost", width: 14, numFmt: "#,##0.00", value: (r) => r.labourCost },
  { header: "Total Cost",  key: "totalCost",  width: 14, numFmt: "#,##0.00", value: (r) => r.totalCost },
];

export const REPAIR_PDF_COLUMNS: PdfColumn<RepairReportRow>[] = [
  { label: "Job No.",    width: 75,  align: "left",   value: (r) => r.jobNumber },
  { label: "Reported",   width: 60,  align: "left",   value: (r) => r.reportedAt.toLocaleDateString("th-TH") },
  { label: "Type",       width: 45,  align: "center", value: (r) => (r.type === "INTERNAL" ? "ภายใน" : "ภายนอก") },
  { label: "Reported by",width: 95,  align: "left",   value: (r) => r.owner },
  { label: "Device",     width: 120, align: "left",   value: (r) => r.deviceName },
  { label: "Technician", width: 85,  align: "left",   value: (r) => r.technician },
  { label: "Status",     width: 65,  align: "center", value: (r) => r.status },
  { label: "Total",      width: 70,  align: "right",  value: (r) => money(r.totalCost) },
];

export function repairFooter(rows: RepairReportRow[]) {
  const total = rows.reduce((s, r) => s + r.totalCost, 0);
  return `Total: ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB`;
}
```

PDF widths sum to 615, inside the 770pt landscape A4 content width.

- [ ] **Step 3: Create `src/app/api/repairs/reports/route.ts`**

Open `src/app/api/reports/[month]/route.ts` first and mirror its auth check and response-header style exactly.

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRepairReport } from "@/actions/repairReport.actions";
import { buildExcelReport, buildPdfReport } from "@/lib/reportExport";
import { REPAIR_EXCEL_COLUMNS, REPAIR_PDF_COLUMNS, repairFooter } from "@/lib/reportColumns";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const monthParam = url.searchParams.get("month");
  const month = monthParam ? Number(monthParam) : undefined;
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "excel";

  if (!year || year < 2000 || year > 2100) {
    return new NextResponse("Invalid year", { status: 400 });
  }
  if (month !== undefined && (month < 1 || month > 12)) {
    return new NextResponse("Invalid month", { status: 400 });
  }

  const { rows } = await getRepairReport(year, month);
  const label = month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
  const title = `Repair Report ${label}`;

  if (format === "pdf") {
    const buffer = await buildPdfReport(title, REPAIR_PDF_COLUMNS, rows, repairFooter);
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="repair-report-${label}.pdf"`,
      },
    });
  }

  const buffer = await buildExcelReport(title, REPAIR_EXCEL_COLUMNS, rows);
  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="repair-report-${label}.xlsx"`,
    },
  });
}
```

- [ ] **Step 4: Replace `src/app/(dashboard)/repairs/reports/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { getRepairReport } from "@/actions/repairReport.actions";
import RepairStatusBadge from "@/components/repairs/RepairStatusBadge";

export const revalidate = 0;

export default async function RepairReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = params.month === "" ? undefined : Number(params.month) || now.getMonth() + 1;

  const [report, t] = await Promise.all([
    getRepairReport(year, month),
    getTranslations("RepairReports"),
  ]);

  const label = month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
  const query = `year=${year}${month ? `&month=${month}` : ""}`;
  const money = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{label}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/repairs/reports?${query}&format=excel`} className="btn-primary py-2">{t("downloadExcel")}</a>
          <a href={`/api/repairs/reports?${query}&format=pdf`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            {t("downloadPdf")}
          </a>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="year">{t("yearLabel")}</label>
          <select id="year" name="year" className="input" defaultValue={year}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="month">{t("monthLabel")}</label>
          <select id="month" name="month" className="input" defaultValue={month ?? ""}>
            <option value="">{t("wholeYear")}</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary py-2.5">{t("apply")}</button>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t("totalJobs")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{report.totalJobs}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t("totalCost")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{money(report.totalCost)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t("internal")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{report.internalJobs}</p>
          <p className="text-xs text-slate-400">{money(report.internalCost)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t("external")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{report.externalJobs}</p>
          <p className="text-xs text-slate-400">{money(report.externalCost)}</p>
        </div>
      </div>

      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">{t("colJobNumber")}</th>
              <th className="px-4 py-3 font-medium">{t("colReportedAt")}</th>
              <th className="px-4 py-3 font-medium">{t("colDevice")}</th>
              <th className="px-4 py-3 font-medium">{t("colTechnician")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              <th className="px-5 py-3 font-medium text-right">{t("colTotalCost")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.rows.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm">{t("empty")}</td></tr>
            )}
            {report.rows.map((r) => (
              <tr key={r.jobNumber} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-700">{r.jobNumber}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.reportedAt.toLocaleDateString("th-TH")}</td>
                <td className="px-4 py-3 text-slate-800">{r.deviceName}</td>
                <td className="px-4 py-3 text-slate-600">{r.technician}</td>
                <td className="px-4 py-3"><RepairStatusBadge status={r.status} /></td>
                <td className="px-5 py-3 text-right text-slate-700">{money(r.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add `RepairReports` translations**

`messages/en.json`:

```json
"RepairReports": {
  "title": "Repair Reports",
  "yearLabel": "Year",
  "monthLabel": "Month",
  "wholeYear": "Whole year",
  "apply": "Apply",
  "downloadExcel": "Download Excel",
  "downloadPdf": "Download PDF",
  "totalJobs": "Total jobs",
  "totalCost": "Total cost",
  "internal": "Internal",
  "external": "External",
  "colJobNumber": "Job No.",
  "colReportedAt": "Reported",
  "colDevice": "Device",
  "colTechnician": "Technician",
  "colStatus": "Status",
  "colTotalCost": "Total cost",
  "empty": "No repair jobs in this period"
}
```

`messages/th.json`:

```json
"RepairReports": {
  "title": "รายงานงานซ่อม",
  "yearLabel": "ปี",
  "monthLabel": "เดือน",
  "wholeYear": "ทั้งปี",
  "apply": "แสดงรายงาน",
  "downloadExcel": "ดาวน์โหลด Excel",
  "downloadPdf": "ดาวน์โหลด PDF",
  "totalJobs": "จำนวนงานซ่อม",
  "totalCost": "ค่าใช้จ่ายรวม",
  "internal": "งานภายใน",
  "external": "งานภายนอก",
  "colJobNumber": "เลขที่งาน",
  "colReportedAt": "วันที่แจ้ง",
  "colDevice": "อุปกรณ์",
  "colTechnician": "ช่างซ่อม",
  "colStatus": "สถานะ",
  "colTotalCost": "ค่าใช้จ่ายรวม",
  "empty": "ไม่มีงานซ่อมในช่วงเวลานี้"
}
```

- [ ] **Step 6: Typecheck and verify**

`npx tsc --noEmit` → PASS.

On `/repairs/reports`: the four summary cards match the row list; changing month/year reloads; "Whole year" widens the range. Download Excel — 11 columns, cost columns formatted `#,##0.00`. Download PDF — Thai text renders (create a job with a Thai device name containing แ first). Sign out and request `/api/repairs/reports?year=2026` → 401.

- [ ] **Step 7: Commit**

```bash
git add src/actions/repairReport.actions.ts src/lib/reportColumns.ts src/app/api/repairs src/app/\(dashboard\)/repairs/reports messages
git commit -m "feat(repair): add repair cost reports with Excel and PDF export"
```

---

## Task 10: Dashboard widget and final sweep

**Files:**
- Modify: `src/actions/stock.actions.ts`, `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `getRepairDashboardStats` (Task 4)

- [ ] **Step 1: Inspect the existing dashboard**

```bash
grep -n "export async function getDashboard" -A 40 src/actions/stock.actions.ts
```

Identify the stats function and the shape it returns.

- [ ] **Step 2: Add repair counts to the dashboard page**

Do **not** change the stock stats function. In `src/app/(dashboard)/dashboard/page.tsx`, import and call the repair stats alongside the existing data:

```tsx
import { getRepairDashboardStats } from "@/actions/repair.actions";
```

Add `getRepairDashboardStats()` to the existing `Promise.all([...])` and destructure it as `repairStats`. Then render two more cards in the existing metric-card grid, matching the surrounding `MetricCard` usage:

```tsx
<MetricCard
  title={t("openRepairs")}
  value={repairStats.open}
  icon={Wrench}
  href="/repairs"
/>
<MetricCard
  title={t("overdueRepairs")}
  value={repairStats.overdue}
  icon={AlertTriangle}
  href="/repairs?status=IN_PROGRESS"
/>
```

Open `src/components/dashboard/MetricCard.tsx` first and match its actual prop names — if it takes no `href`, wrap each card in a `<Link>` instead. Import `Wrench` and `AlertTriangle` from `lucide-react`.

- [ ] **Step 3: Add the two dashboard keys**

`messages/en.json`, inside the existing `Dashboard` namespace:

```json
"openRepairs": "Open repairs",
"overdueRepairs": "Overdue repairs"
```

`messages/th.json`, inside `Dashboard`:

```json
"openRepairs": "งานซ่อมค้าง",
"overdueRepairs": "งานซ่อมเกินกำหนด"
```

- [ ] **Step 4: Verify both message files have identical key trees**

```bash
node -e "
const en=require('./messages/en.json'), th=require('./messages/th.json');
const walk=(o,p='')=>Object.entries(o).flatMap(([k,v])=>
  v&&typeof v==='object'?walk(v,p+k+'.'):[p+k]);
const a=new Set(walk(en)), b=new Set(walk(th));
const miss=[...a].filter(k=>!b.has(k)), extra=[...b].filter(k=>!a.has(k));
console.log('missing in th:',miss);
console.log('missing in en:',extra);
process.exit(miss.length||extra.length?1:0);
"
```

Expected: both lists empty, exit 0. Fix any mismatch before continuing.

- [ ] **Step 5: Full production build**

Run: `npm run build`
Expected: succeeds, and the route table lists all six repair routes plus `ƒ /api/repairs/reports` and the existing `ƒ /uploads/[...path]`.

- [ ] **Step 6: Full regression pass**

Work through the spec's Verification list end to end, in both languages:

1. Both module tabs; correct sidebar per module; correct active highlighting
2. Internal and external job creation with validation errors
3. Full status walk including `closedAt` set and cleared
4. Cancel from each open state
5. Multi-file attachments; 401 when signed out; cascade delete
6. `totalCost == partsCost + labourCost` after every save
7. Job numbers increment per month, unique
8. Repair report Excel and PDF, both month and whole-year
9. Dashboard open/overdue counts correct
10. **Existing stock flows untouched** — add a product, run a stock IN and a stock OUT, download the monthly Excel and PDF, download the transactions export, open a quotation PDF

- [ ] **Step 7: Commit**

```bash
git add src/actions/stock.actions.ts src/app/\(dashboard\)/dashboard messages
git commit -m "feat(repair): surface open and overdue repair counts on the dashboard"
```

---

## Self-Review Notes

**Spec coverage:** Navigation → Task 1. Data model → Task 2. Job numbering, status workflow, validation, cost rule → Task 4. Technicians → Task 3. Repair list → Task 5. Forms and attachments → Task 6. Repair overview → Task 7. Report generalization → Task 8. Repair reports → Task 9. Dashboard widget and i18n parity → Task 10. Permissions require no code (spec: same rule as the rest of the app) and are exercised by the staff-user check in Task 1 Step 8. Migration casing → Task 2 Step 5.

**Known deviations from the writing-plans default:**
- No TDD cycle, because the project has no test runner and adding one is outside the approved scope. Each task substitutes `npx tsc --noEmit` plus explicit manual checks with expected outcomes.
- Task 8 is a pure refactor with no user-visible deliverable. It is separated because it touches working export code and deserves its own review gate.

**Type consistency check:** `RepairActionState` is used identically across Tasks 4–6. `RepairListItem` is exported from `repair.actions.ts` (Task 4) and consumed by `RepairRow` (Task 5). `ExcelColumn`/`PdfColumn` are defined in Task 8 and consumed in Task 9. `getTechnicians(includeInactive?: boolean)` is defined in Task 3 and called with `false` (new) and no argument (edit) in Task 6. `RepairStatusBadge` takes `{ status: RepairStatus }` in Tasks 5, 7 and 9.
