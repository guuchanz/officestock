# Repair Job Module — Design

**Date:** 2026-07-27
**Status:** Approved

## Goal

Split the application into two top-level modules — **Office Stock** (everything that exists today) and **Repair Job** (new) — and build the Repair Job module: repair records for both internally-reported and external customer devices, a technician master list, repair cost reporting, and a repair widget on the existing dashboard.

## Scope

**In scope**

- Two-module navigation: tabs in the header, module-specific sidebar
- `RepairJob`, `Technician`, `RepairAttachment` models plus migration
- Repair list with filters, create/edit forms, status workflow
- Technicians CRUD master list
- Repair cost reports with Excel/PDF export
- Open/overdue repair cards on the existing Overview dashboard
- Thai and English translations for everything added

**Explicitly out of scope**

- **No stock integration.** Parts used on a repair are recorded as free text. No `StockTransaction` is created and `Product.totalStock` is never touched by this module. The two modules share only the `User` and `Department` tables.
- No customer master table — external customer details are typed per job.
- No new permission logic (see Permissions).

## Navigation

Chosen layout: **module tabs in the header**, sidebar shows the active module's pages.

`src/lib/navigation.ts` is the single source of truth:

```ts
export const MODULES = [
  {
    key: "stock",
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
      // /users appended at runtime when canManageUsers
    ],
  },
  {
    key: "repair",
    href: "/repairs/overview",
    icon: Wrench,
    items: [
      { href: "/repairs/overview",    key: "repairOverview",    icon: LayoutDashboard },
      { href: "/repairs",             key: "repairList",        icon: ClipboardList },
      { href: "/repairs/new",         key: "repairNew",         icon: Plus },
      { href: "/repairs/technicians", key: "technicians",       icon: Users },
      { href: "/repairs/reports",     key: "repairReports",     icon: FileBarChart },
    ],
  },
]
```

Both `ModuleTabs.tsx` (new client component) and `Sidebar.tsx` read from this array.

`ModuleTabs.tsx` renders into the empty `<div />` that already exists on the left of `Header.tsx`. `Header.tsx` stays a server component; only the tabs are client-side.

The active module is derived from `usePathname()` — no client state — so deep links, redirects, and full page loads always render the correct tab and sidebar.

### Active-link matching

The current check is `path === href`, which leaves `/products/new` with nothing highlighted. Replace with **longest matching prefix**: an item matches if `path === href` or `path.startsWith(href + "/")`, and the item with the longest matching `href` wins. This keeps `/repairs` from staying highlighted on `/repairs/new` while making `/repairs/[id]/edit` correctly highlight Repair List.

### Routes

All under the existing `(dashboard)` route group, inheriting its `auth()` check and layout:

| Route | Purpose |
|---|---|
| `/repairs/overview` | Repair mini-dashboard; where the Repair Job tab lands |
| `/repairs` | Repair list, filters, search |
| `/repairs/new` | Create form |
| `/repairs/[id]/edit` | Edit form |
| `/repairs/technicians` | Technician CRUD |
| `/repairs/reports` | Monthly/yearly repair cost report + export |

Next.js resolves static segments before dynamic ones, so `/repairs/new` and `/repairs/reports` do not collide with `/repairs/[id]`.

## Data model

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
  id            Int                @id @default(autoincrement())
  jobNumber     String             @unique
  type          RepairType

  // INTERNAL only
  department    Department?        @relation(fields: [departmentId], references: [id])
  departmentId  Int?

  // EXTERNAL only
  customerName  String?
  customerPhone String?

  deviceName    String
  serialNo      String?
  problem       String             @db.Text

  partsUsed     String?            @db.Text
  partsCost     Decimal            @default(0) @db.Decimal(10, 2)
  labourCost    Decimal            @default(0) @db.Decimal(10, 2)
  totalCost     Decimal            @default(0) @db.Decimal(10, 2)

  status        RepairStatus       @default(RECEIVED)
  technician    Technician?        @relation(fields: [technicianId], references: [id])
  technicianId  Int?

  createdBy     User               @relation(fields: [createdById], references: [id])
  createdById   String

  reportedAt    DateTime           @default(now())
  closedAt      DateTime?
  note          String?            @db.Text

  attachments   RepairAttachment[]
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

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

Back-relations added to existing models:

- `Department.repairJobs RepairJob[]`
- `User.repairJobs RepairJob[]`
- `User.repairAttachments RepairAttachment[]`

`Department` gains a relation but no column, so existing stock behaviour is unaffected.

### Job numbering

`jobNumber` is generated server-side as `RJ-YYMM-NNN`, where `NNN` is a zero-padded per-month sequence. Generated inside the same `prisma.$transaction` as the insert, by counting existing jobs for the current month and retrying once on unique-constraint violation (P2002). This differs from `Quotation.qtNumber`, which is typed by the user.

### Cost

`totalCost` is always computed server-side as `partsCost + labourCost` and never accepted from the client, so the stored total cannot disagree with its parts.

## Status workflow

```
RECEIVED → IN_PROGRESS → DONE → RETURNED
    └──────────┴──────────┴────→ CANCELLED
```

- Legal transitions are enforced in the server action, not just the UI.
- `closedAt` is set when a job enters RETURNED or CANCELLED, and cleared if it moves back to an open state.
- Open = RECEIVED, IN_PROGRESS, DONE. Closed = RETURNED, CANCELLED.
- Backwards transitions between open states are permitted (a job can go DONE → IN_PROGRESS if it fails testing).

## Validation

Zod discriminated union on `type`:

- `INTERNAL` requires `departmentId`; `customerName`/`customerPhone` must be absent
- `EXTERNAL` requires `customerName`; `departmentId` must be absent

Shared rules: `deviceName` and `problem` non-empty; `partsCost` and `labourCost` non-negative; `technicianId` must reference an active technician when set.

Validation runs server-side in every action. Error messages resolve through next-intl so they appear in the selected language.

## Permissions

No new permission logic. Repair jobs, technicians, and repair reports follow the same rule as Products and Quotations: any authenticated user has full access. The `/users` page remains the only role-restricted area.

The `(dashboard)` layout's existing `auth()` check plus `middleware.ts` already protect every `/repairs/*` route — the middleware matcher excludes only `_next/static`, `_next/image`, `uploads`, and `favicon.ico`.

## Attachments

Multiple files per job, stored via the existing `saveUpload(file, "repairs", ext)` into `UPLOAD_DIR/repairs/<uuid><ext>` and served by the existing auth-checked, traversal-safe `/uploads/[...path]` route. No new upload infrastructure.

- Allowed: `.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf` (all already in `contentTypeFor`)
- Limit 10MB per file, matching `bodySizeLimit` in `next.config.ts`
- Deleting a job cascades its attachment rows. Orphaned files on disk are left in place, consistent with how Quotation file replacement already behaves.

## Reports

`src/lib/reportExport.ts` currently hard-codes `TransactionDetailRow` and its column layout inside both `buildExcelReport` and `buildPdfReport`. To serve repair reports it must be generalized:

```ts
type ReportColumn<T> = { header: string; width: number; value: (row: T) => string | number }

buildExcelReport<T>(sheetName: string, columns: ReportColumn<T>[], rows: T[])
buildPdfReport<T>(title: string, columns: ReportColumn<T>[], rows: T[])
```

The three existing report routes (`/api/reports/[month]`, `/api/reports/year/[year]`, `/api/transactions/export`) are updated to pass their existing columns explicitly. Behaviour and output must not change — including the Sarabun WOFF1 font workaround, which stays exactly as-is.

This is the only change in this project that touches working export code.

Repair reports themselves cover: job count and total cost per month, split by internal/external, with Excel and PDF download.

## Dashboard widget

Two cards added to the existing Overview page:

- **Open repairs** — count of jobs in RECEIVED, IN_PROGRESS, or DONE
- **Overdue repairs** — open jobs whose `reportedAt` is more than **7 days** ago

The 7-day threshold is a named constant in `repair.actions.ts` so it can be changed in one place.

## Files

**New**

```
src/lib/navigation.ts
src/components/layout/ModuleTabs.tsx
src/actions/repair.actions.ts
src/actions/technician.actions.ts
src/actions/repairReport.actions.ts
src/app/(dashboard)/repairs/overview/page.tsx
src/app/(dashboard)/repairs/page.tsx
src/app/(dashboard)/repairs/new/page.tsx
src/app/(dashboard)/repairs/[id]/edit/page.tsx
src/app/(dashboard)/repairs/technicians/page.tsx
src/app/(dashboard)/repairs/reports/page.tsx
src/components/repairs/RepairForm.tsx
src/components/repairs/RepairRow.tsx
src/components/repairs/RepairFilters.tsx
src/components/repairs/RepairStatusBadge.tsx
src/components/repairs/RepairAttachments.tsx
src/components/technicians/TechnicianForm.tsx
src/components/technicians/TechnicianRow.tsx
prisma/migrations/<generated>/migration.sql
```

**Modified**

```
prisma/schema.prisma            new models, enums, back-relations
src/components/layout/Sidebar.tsx   module-aware, longest-prefix active match
src/components/layout/Header.tsx    mount ModuleTabs in the existing empty div
src/lib/reportExport.ts             generalize to column definitions
src/app/api/reports/[month]/route.ts        pass columns
src/app/api/reports/year/[year]/route.ts    pass columns
src/app/api/transactions/export/route.ts    pass columns
src/actions/stock.actions.ts        dashboard repair counts
src/app/(dashboard)/dashboard/page.tsx      repair cards
messages/en.json, messages/th.json          new namespaces
```

Components follow the existing `QuotationForm` / `QuotationRow` patterns: `useActionState` + Server Actions, plain Tailwind controls, no component library.

## i18n

New `Nav` keys: `repairOverview`, `repairList`, `repairNew`, `technicians`, `repairReports`, plus module labels `moduleStock` and `moduleRepair`.

New namespaces: `Repairs`, `RepairForm`, `RepairFilters`, `RepairActions`, `Technicians`, `TechnicianForm`, `TechnicianActions`, `RepairReports`.

Every key must exist in both `en.json` and `th.json`. Status and type enum labels are translated, never rendered raw.

## Migration

The migration must be generated on the Linux development machine. Migrations authored on case-insensitive MySQL emit `ALTER TABLE \`product\`` against a table created as `Product`, which fails on this project's MariaDB (`lower_case_table_names=0`). Twelve such statements were repaired on 2026-07-27; new migrations must not reintroduce the problem.

After generating, grep the new migration for lowercase table identifiers before committing.

## Verification

This project has no test runner, so verification is a build plus a manual pass.

1. `npm run build` succeeds; the route table lists all six `/repairs/*` routes
2. Both module tabs render; each shows only its own sidebar items
3. Active highlighting correct on `/repairs`, `/repairs/new`, `/repairs/[id]/edit`, `/products/new`
4. Create an INTERNAL job (department required, customer fields rejected)
5. Create an EXTERNAL job (customer required, department rejected)
6. Drive a job through RECEIVED → IN_PROGRESS → DONE → RETURNED; confirm `closedAt` is set on RETURNED and cleared when reopened
7. Cancel a job from each open state
8. Upload multiple attachments; confirm they serve while logged in and return 401 when logged out
9. `totalCost` equals `partsCost + labourCost` after every save
10. Job numbers increment per month and are unique
11. Existing Excel/PDF exports produce byte-comparable output to before the `reportExport.ts` refactor, Thai characters included
12. Repair report exports download in both formats
13. Dashboard shows correct open and overdue counts
14. Every new screen renders correctly in both Thai and English
15. Existing stock flows still work — inventory, transactions, quotations untouched
