# Maintenance (Preventive Maintenance) Module — Design

**Date:** 2026-07-27
**Status:** Draft — awaiting approval

## Goal

Add a **third** top-level module — **Maintenance** — alongside Office Stock and Repair Job. It tracks equipment that must be serviced on a fixed cycle (every N months), shows how many days remain until each item is due again, and keeps a full service history per asset.

The difference from the Repair module in one line: **Repair is reactive** (something broke, open a job), **Maintenance is scheduled** (nothing is broken, the calendar says it is time).

## Scope

**In scope**

- Third module tab in the header, with its own sidebar
- `Equipment`, `MaintenanceLog`, `Factory`, `Area` models plus migration
- Equipment list with filters, sorted by urgency, showing remaining days
- Equipment detail page with service history and a "record service" action
- Factory and Area CRUD master lists
- Maintenance reports (service history + due snapshot) with Excel/PDF export
- An overdue-PM card on the existing Overview dashboard
- Thai and English translations for everything added

**Explicitly out of scope**

- **No stock integration.** Parts consumed during a service are free text, exactly as in the Repair module. No `StockTransaction` is written.
- **No automatic notifications.** Remaining days are shown when a user opens the app; nothing emails or pushes. Listed under Next Steps in the README instead.
- **No recurring-job generation.** The system does not pre-create future service rows. The next due date is derived (see Due-date computation) — there is nothing to clean up if a cycle is skipped.
- No QR/barcode scanning to look up an asset.

## Decisions taken

| Question | Decision | Consequence |
|---|---|---|
| Record each service? | **Yes — `MaintenanceLog` rows** | Full history per asset; next due derives from the newest log |
| Factory / Area | **Master list tables with CRUD** | Two more small admin pages; clean grouping in reports |
| "In charge" person | **Reuse the existing `Technician` table** | No new table, no login required for the person responsible |
| Interval | **Integer months, 1/3/6/12 as presets** | Handles 2/4/18-month cycles without a migration |

## Navigation

`src/lib/navigation.ts` stays the single source of truth. A third entry is appended to `MODULES`:

```ts
{
  key: "maintenance",
  labelKey: "moduleMaintenance",
  href: "/maintenance/overview",
  icon: CalendarClock,
  items: [
    { href: "/maintenance/overview",  key: "maintOverview",  icon: LayoutDashboard },
    { href: "/maintenance",           key: "maintEquipment", icon: HardHat },
    { href: "/maintenance/new",       key: "maintNew",       icon: PlusCircle },
    { href: "/maintenance/factories", key: "factories",      icon: Factory },
    { href: "/maintenance/areas",     key: "areas",          icon: MapPin },
    { href: "/maintenance/reports",   key: "maintReports",   icon: FileBarChart },
  ],
}
```

`NavModule["key"]` widens from `"stock" | "repair"` to include `"maintenance"`. `ModuleTabs` and `Sidebar` need **no code change** — they already map over `MODULES`.

Three tabs still fit the header at 1280px wide (roughly 150px each against a 16-char Thai label); below `sm` the tab labels collapse to icons only. This is the last module that fits — a fourth would need a dropdown, which is out of scope here.

### Routes

| Path | Purpose |
|---|---|
| `/maintenance/overview` | Counts by urgency bucket, overdue list, services done this month |
| `/maintenance` | Equipment list + filters, sorted most-urgent-first |
| `/maintenance/new` | Register equipment |
| `/maintenance/[id]` | Detail: master fields, service history, "record service" |
| `/maintenance/[id]/edit` | Edit the master record |
| `/maintenance/factories` | Factory master list |
| `/maintenance/areas` | Area master list |
| `/maintenance/reports` | Monthly/yearly report + Excel/PDF download |

`/maintenance/[id]` as a **detail** page is a deliberate divergence from the Repair module, which goes straight to `[id]/edit`. Service history needs somewhere to live, and recording a service is a far more frequent action than editing the asset's model number.

### Technician list is mounted at two routes

`moduleForPath()` maps a path to exactly **one** module by longest-prefix match, so a single shared URL cannot sit in two sidebars — putting `/repairs/technicians` in the maintenance sidebar would flip the header tab back to Repair the moment it was clicked.

The list is therefore mounted at **both** `/repairs/technicians` and `/maintenance/technicians`. Both routes render the same `TechnicianManager` server component over the same table; only the URL differs, so each module keeps its own tab highlighted.

Consequences to keep in mind:

- `technician.actions.ts` must `revalidatePath()` **both** routes on every create/update/delete, or the copy in the module you were not looking at serves a stale list. This is centralised in `revalidateTechnicians()`.
- The equipment form's "manage ↗" link points at `/maintenance/technicians` so it never leaves the module.
- `/repairs/technicians` is unchanged, so existing links and bookmarks still work.

The rejected alternative was a shared `/masters/technicians` route in both sidebars, which would still have had the tab-ownership problem and would have broken the existing repair URL.

## Data model

```prisma
model Factory {
  id        Int         @id @default(autoincrement())
  name      String      @unique
  isActive  Boolean     @default(true)
  equipment Equipment[]
  createdAt DateTime    @default(now())
}

model Area {
  id        Int         @id @default(autoincrement())
  name      String      @unique
  isActive  Boolean     @default(true)
  equipment Equipment[]
  createdAt DateTime    @default(now())
}

model Equipment {
  id             Int      @id @default(autoincrement())
  assetNo        String   @unique
  name           String
  model          String?
  serialNo       String?
  detail         String?  @db.Text

  factory        Factory?    @relation(fields: [factoryId], references: [id])
  factoryId      Int?
  area           Area?       @relation(fields: [areaId], references: [id])
  areaId         Int?

  // Person responsible for the asset, not necessarily who performs the service.
  technician     Technician? @relation(fields: [technicianId], references: [id])
  technicianId   Int?

  intervalMonths Int      @default(3)

  /// Cycle origin used only until the first service is logged:
  /// install date, or the last known service date when migrating from paper.
  baselineAt     DateTime

  /// Denormalised from the newest MaintenanceLog; null until the first service.
  lastDoneAt     DateTime?
  /// Stored, not computed on read, so the list can sort and filter in SQL.
  nextDueAt      DateTime

  isActive       Boolean  @default(true)
  note           String?  @db.Text

  logs           MaintenanceLog[]
  createdBy      User     @relation(fields: [createdById], references: [id])
  createdById    String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([nextDueAt])
  @@index([factoryId, areaId])
}

model MaintenanceLog {
  id           Int         @id @default(autoincrement())
  equipment    Equipment   @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  equipmentId  Int

  performedAt  DateTime
  technician   Technician? @relation(fields: [technicianId], references: [id])
  technicianId Int?

  result       MaintResult @default(OK)
  partsUsed    String?     @db.Text
  cost         Decimal     @default(0) @db.Decimal(10, 2)
  note         String?     @db.Text

  createdBy    User        @relation(fields: [createdById], references: [id])
  createdById  String
  createdAt    DateTime    @default(now())

  @@index([equipmentId, performedAt])
}

enum MaintResult {
  OK             // serviced, nothing wrong
  FIXED          // a fault was found and fixed during the service
  NEEDS_REPAIR   // needs a repair job — a hint to open one in the Repair module
}
```

`Technician` gains `equipment Equipment[]` and `maintenanceLogs MaintenanceLog[]`; `User` gains the same two back-relations. No `@relation("name")` labels are needed — Prisma only requires them when two relations join the *same pair* of models, and these are two different pairs.

`Decimal(10,2)` for cost, matching `RepairJob` — never a float for money.

## Due-date computation

The single rule:

```
nextDueAt = addMonths(lastDoneAt ?? baselineAt, intervalMonths)
remainingDays = daysBetween(today, nextDueAt)      // derived, never stored
```

`nextDueAt` is **stored** because the equipment list must sort by urgency and filter "due within 30 days" in SQL — computing it per row in JS would mean loading every asset on every page view. It is recalculated inside the same transaction whenever any input changes:

- a log is created, edited, or deleted → recompute `lastDoneAt` from `MAX(performedAt)`, then `nextDueAt`
- `intervalMonths` or `baselineAt` is edited → recompute `nextDueAt`

`remainingDays` is **never stored** — it changes every midnight, so a stored copy is wrong within a day.

### addMonths must clamp, not overflow

JavaScript's `setMonth` rolls over: 31 Jan + 1 month gives 3 March, not 28 February. A maintenance cycle that lands on the 29th–31st would drift forward a few days every single cycle. `src/lib/maintenance-constants.ts` gets:

```ts
/** Adds whole months, clamping to the last day of the target month. */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, lastDay));
  return d;
}
```

31 Jan + 1 month → 28 Feb (29 Feb in a leap year). 31 Jan + 3 months → 30 Apr.

### Day-granularity comparison

Both sides are normalised to **local midnight** before subtracting, so an asset due later today reads `0 days` (due today), not `-1`. The app serves a single timezone; no UTC conversion is applied.

```ts
export function remainingDays(nextDueAt: Date, now = new Date()): number {
  const a = startOfDay(now), b = startOfDay(nextDueAt);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
```

`Math.round`, not `floor` — DST does not apply in Thailand, but rounding keeps the helper correct if the app is ever deployed elsewhere.

## Urgency buckets

Derived from `remainingDays`, never stored:

| Bucket | Condition | Badge |
|---|---|---|
| `OVERDUE` | `remaining < 0` | red |
| `DUE_SOON` | `0 ≤ remaining ≤ DUE_SOON_DAYS` (default **30**) | amber |
| `SCHEDULED` | `remaining > DUE_SOON_DAYS` | green |
| `INACTIVE` | `isActive = false` | slate — excluded from all counts |

`DUE_SOON_DAYS` lives in `src/lib/maintenance-constants.ts` next to `addMonths`, for the same reason `OVERDUE_DAYS` does in `repair-constants.ts`: a `"use server"` module may only export async functions, so shared constants cannot live in the actions file.

Equipment list default sort: `nextDueAt ASC` — the most overdue asset is the first thing on screen.

## Recording a service

A compact form on `/maintenance/[id]`, not a separate page:

1. `performedAt` (defaults to now), technician, result, parts used, cost, note
2. Insert the `MaintenanceLog`
3. In the **same** `prisma.$transaction`, recompute `lastDoneAt` and `nextDueAt` on the parent

Steps 2 and 3 must be atomic — a crash between them leaves an asset whose schedule silently disagrees with its own history, which is exactly the failure this module exists to prevent.

Back-dating is allowed (paper records get entered late). Future dates are rejected — a service that has not happened yet must not push the next due date out.

If `result = NEEDS_REPAIR`, the detail page shows a "open a repair job" link prefilled with the asset name, model, and serial. It only prefills the form; **no `RepairJob` row is created automatically.**

## Validation

Zod, server-side, translated messages — same shape as `buildRepairSchema()`.

| Field | Rule |
|---|---|
| `assetNo` | required, trimmed, unique — `P2002` maps to a friendly "asset number already exists" |
| `name` | required, 1–191 chars |
| `intervalMonths` | integer, 1–120 |
| `baselineAt` | required, not more than 1 day in the future |
| `factoryId` / `areaId` / `technicianId` | optional positive int; must reference an existing row |
| `performedAt` | required, not in the future |
| `cost` | ≥ 0, max 2 decimals |

## Permissions

Identical to the Repair module: **any signed-in user** may create, edit, and delete. Role only gates the users menu.

> Worth noting since it repeats a gap already present in the repair module: `deleteEquipmentAction` would let any Staff user delete an asset and cascade-delete its entire service history. If that history is ever needed for an audit or a warranty claim, deletion should be soft (`isActive = false`) or admin-only. This spec keeps hard delete for consistency with the existing modules — flagging it so the choice is deliberate rather than inherited.

Deleting a `Factory` or `Area` still referenced by equipment is blocked with a count, matching `deviceType.actions.ts`.

## Reports

Reuses the column-driven `buildExcelReport` / `buildPdfReport` from `src/lib/reportExport.ts` — no new export machinery. Column specs go in `src/lib/reportColumns.ts` beside the repair ones.

`GET /api/maintenance/reports?year=&month=&kind=&format=`

| `kind` | Rows | Answers |
|---|---|---|
| `history` (default) | Services performed in the period | "What did we service last quarter, and what did it cost?" |
| `due` | Current snapshot of all active equipment, most urgent first — `year`/`month` ignored | "What is overdue right now?" — the printable walk-around sheet |

`history` columns: date, asset no, equipment, factory, area, technician, result, parts, cost.
`due` columns: asset no, equipment, model, serial, factory, area, in charge, interval, last done, next due, remaining days, bucket.

Footer totals for `history`: service count, total cost, and a breakdown by result.

Auth check on the route handler mirrors `/api/repairs/reports` — `401` without a session.

## Dashboard widget

The main `/dashboard` grid is already at 5 cards. Maintenance adds **one**:

- **PM overdue** — count of active equipment with `remaining < 0`, linking to `/maintenance?bucket=OVERDUE`

Six cards divide evenly into the existing `lg:grid-cols-3`. The full breakdown (all four buckets, services this month, upcoming 30 days) lives on `/maintenance/overview` rather than crowding the stock dashboard further.

`getMaintenanceDashboardStats()` is one `groupBy` plus one `count`, added to the existing `Promise.all` in `dashboard/page.tsx` so it costs no extra round trip.

## Files

**New**

```
src/lib/maintenance-constants.ts          # addMonths, remainingDays, DUE_SOON_DAYS, buckets
src/actions/equipment.actions.ts          # equipment CRUD, filters, dashboard stats
src/actions/maintenanceLog.actions.ts     # log CRUD + schedule recompute
src/actions/factory.actions.ts            # Factory CRUD
src/actions/area.actions.ts               # Area CRUD
src/actions/maintenanceReport.actions.ts  # history + due report queries

src/app/(dashboard)/maintenance/page.tsx
src/app/(dashboard)/maintenance/overview/page.tsx
src/app/(dashboard)/maintenance/new/page.tsx
src/app/(dashboard)/maintenance/[id]/page.tsx
src/app/(dashboard)/maintenance/[id]/edit/page.tsx
src/app/(dashboard)/maintenance/factories/page.tsx
src/app/(dashboard)/maintenance/areas/page.tsx
src/app/(dashboard)/maintenance/reports/page.tsx
src/app/api/maintenance/reports/route.ts

src/components/maintenance/EquipmentForm.tsx
src/components/maintenance/EquipmentRow.tsx
src/components/maintenance/EquipmentFilters.tsx
src/components/maintenance/DueBadge.tsx          # bucket colour + "N days" / "N days overdue"
src/components/maintenance/ServiceLogForm.tsx
src/components/maintenance/ServiceLogTable.tsx
src/components/factories/FactoryForm.tsx
src/components/factories/FactoryRow.tsx
src/components/areas/AreaForm.tsx
src/components/areas/AreaRow.tsx

prisma/migrations/2026XXXXXXXXXX_add_maintenance_module/migration.sql
```

**Modified**

```
prisma/schema.prisma                      # 4 models, 1 enum, back-relations on User + Technician
src/lib/navigation.ts                     # third MODULES entry, widen NavModule["key"]
src/lib/reportColumns.ts                  # MAINTENANCE_HISTORY_* and MAINTENANCE_DUE_* specs
src/app/(dashboard)/dashboard/page.tsx    # PM overdue card
messages/en.json, messages/th.json        # Nav + Maintenance + MaintenanceActions + Factories + Areas
README.md                                 # third module throughout
```

`ModuleTabs.tsx` and `Sidebar.tsx` are deliberately absent — they read `MODULES` and need no edit.

## i18n

New namespaces: `Maintenance`, `MaintenanceActions`, `Factories`, `Areas`. New `Nav` keys: `moduleMaintenance`, `maintOverview`, `maintEquipment`, `maintNew`, `factories`, `areas`, `maintReports`.

Remaining-days text is pluralised through next-intl rather than string-concatenated, because Thai has no plural form and English does:

```json
"remainingDays": "{days, plural, =0 {Due today} one {# day left} other {# days left}}",
"overdueDays":   "{days, plural, one {# day overdue} other {# days overdue}}"
```

## Migration

One migration, `add_maintenance_module`. All four tables are new and `Equipment.nextDueAt` is `NOT NULL`, so there is no backfill problem — the table starts empty.

Table names must be **PascalCase** in the generated SQL. The casing bug fixed across ten earlier migrations came from exactly this and only shows up on case-sensitive MySQL hosts; check the generated file before committing.

## Verification

1. Register equipment with a 3-month interval and a baseline of today → list shows ~90 days remaining, green.
2. Baseline of 4 months ago, no logs → red, "N days overdue", sorted to the top.
3. Record a service dated today → `lastDoneAt` updates, next due jumps ~3 months out, badge turns green, history shows one row.
4. Delete that log → schedule reverts to the baseline calculation and the badge returns to red.
5. **Month-end:** baseline 31 Jan, interval 1 → next due 28 Feb (not 3 Mar). Interval 3 → 30 Apr.
6. **Leap year:** baseline 29 Feb 2028, interval 12 → 28 Feb 2029.
7. Due today reads "Due today", not "1 day overdue" — the local-midnight check.
8. Try to delete a Factory in use → blocked with the equipment count.
9. Duplicate `assetNo` → friendly message, not a raw `P2002`.
10. Export both report kinds as Excel and PDF; confirm Thai text renders in the PDF (the Sarabun WOFF path, not WOFF2).
11. Sign out and hit `/api/maintenance/reports` directly → `401`.
12. Switch to Thai and walk every page — no raw translation keys.

## Open question

**Area is a flat list, not nested under Factory.** Most plants treat an area as belonging to a factory, which would give a cascading dropdown and let a report group as Factory → Area. This spec keeps them independent because it is simpler and nothing in the request implied a hierarchy.

If nesting is wanted later, the change is small and additive: one nullable `factoryId` on `Area`, a filtered dropdown on the equipment form, and a group level in the report. No data migration is needed as long as area names stay unique.
