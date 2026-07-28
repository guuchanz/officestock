# Project Manager Module — Design

**Date:** 2026-07-28
**Status:** Draft — awaiting approval

## Goal

Add a **fourth** top-level module — **Project Manager** — alongside Office Stock, Repair Job and Maintenance. It tracks discrete pieces of work that run over weeks or months: an office renovation, an IT rollout, a new branch setup. Each project has a start date, a plan made of milestones, a running log of what actually happened, and a set of attached files.

The difference from the existing modules in one line: **Repair is reactive** (something broke), **Maintenance is scheduled** (the calendar says it is time), **Project is a one-off body of work with a plan and an end date**.

## Scope

**In scope**

- Fourth module tab in the header, with its own sidebar
- `Project`, `ProjectMilestone`, `ProjectUpdate`, `ProjectAttachment` models plus migration
- Project list with filters (status, priority, department, owner, free-text search)
- Project detail page: timeline, milestone editor, update log, file attachments
- Derived progress % and actual cost — never hand-typed
- Budget vs. actual cost, priority, and a manual at-risk flag
- Overview page with at-risk and overdue projects
- Reports page with Excel export
- Thai and English translations for everything added

**Explicitly out of scope**

- **No link to Repair, Maintenance, Stock or Quotations.** A project is a standalone tracker. Costs are typed on update entries; no `StockTransaction` is written and no repair job is grouped under a project. Revisit once the module has been in real use.
- **No task list under milestones and no per-task assignees.** A milestone is the smallest unit. Full task breakdown is the thing teams abandon first when it is not their daily tool.
- **No notifications.** Overdue and at-risk projects are shown when a user opens the overview page; nothing emails or pushes.
- **No Gantt dependencies.** Milestones do not block each other; the timeline draws bars, it does not schedule.
- No chart library. The timeline is CSS grid.

## Decisions taken

| Question | Decision | Consequence |
|---|---|---|
| Does a project link to other modules? | **No — standalone** | Much smaller build; no coupling to three existing modules |
| How is progress tracked? | **Derived from milestones** | Progress cannot go stale or be argued about |
| Planned vs. actual dates | **Both stored** (`dueDate`, `finishedAt`) | On-time/late is reportable; storing only one loses it forever |
| Where do costs come from? | **Summed from update entries** | Cost accrues as work happens, with a note explaining each amount |
| Attachments | **One table, `updateId` nullable** | Project-level docs and per-update files share one code path |
| Status changes | **State machine, as in Repair** | Illegal jumps rejected in the action, not just hidden in the UI |

## Data model

New models in `prisma/schema.prisma`, following the `RepairJob` / `RepairAttachment` shape already in the file.

```prisma
enum ProjectStatus   { PLANNING  IN_PROGRESS  ON_HOLD  DONE  CANCELLED }
enum ProjectPriority { LOW  MEDIUM  HIGH }

model Project {
  id      Int     @id @default(autoincrement())
  code    String  @unique          // PJ-2026-001
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

  /// Manual flag. Set by a human who knows the project is in trouble even
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
  /// can sort and filter on it without loading every milestone row.
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
  /// Display order. Milestones are a plan, not a chronology — the user
  /// controls the sequence.
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

  createdBy   User   @relation(fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime @default(now())

  attachments ProjectAttachment[]

  @@index([projectId])
}

model ProjectAttachment {
  id        Int     @id @default(autoincrement())
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId Int

  /// Set when the file was uploaded with an update-log entry; null for
  /// project-level documents. One table serves both so the upload, list and
  /// delete code paths are shared.
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

Back-relations to add: `User` gains `projects`, `ownedProjects`, `projectUpdates`, `projectAttachments`; `Department` gains `projects`. `User` needs named relations (`ProjectOwner`, `ProjectCreatedBy`) because it points at `Project` twice.

### Derived fields

`progress` and `actualCost` are stored but **never writable from a form**. A single helper recomputes both:

```ts
// src/lib/projects.ts
async function recalcProject(projectId: number): Promise<void>
//   progress   = round(doneMilestones / totalMilestones * 100), 0 when none
//   actualCost = sum(updates.cost)
```

Called at the end of every milestone and update mutation. This mirrors `RepairJob.partsCost`, which is stored for the same reason: the reports aggregate it in SQL.

A project with **zero milestones has progress 0**, not 100 — an empty plan is not a finished project.

### Project code

`PJ-YYYY-NNN`, generated exactly like `jobNumber` in `repair.actions.ts:123-129`: take the newest code with the current year's prefix, parse the numeric tail, increment, pad to 3. Sequence restarts each calendar year.

## Status rules

Transitions are enforced in the action with a `TRANSITIONS` map, following `repair.actions.ts:338`:

| From | Allowed to |
|---|---|
| `PLANNING` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `ON_HOLD`, `DONE`, `CANCELLED` |
| `ON_HOLD` | `IN_PROGRESS`, `CANCELLED` |
| `DONE` | `IN_PROGRESS` (reopen) |
| `CANCELLED` | — terminal |

Entering `DONE` stamps `finishedAt = now()`. Leaving `DONE` clears it. An illegal transition returns the `illegalTransition` message rather than silently succeeding.

**Status is independent of progress.** A project can be `DONE` at 80% progress — the remaining milestones were dropped, and the record should say so honestly rather than auto-completing them.

## Routes and navigation

`src/lib/navigation.ts`: the `NavModule` key union gains `"project"` and a fourth `MODULES` entry after maintenance. Tab icon `FolderKanban`.

| Route | Nav key | Icon | Purpose |
|---|---|---|---|
| `/projects/overview` | `projectOverview` | `LayoutDashboard` | stat cards, at-risk and overdue lists |
| `/projects` | `projectList` | `FolderKanban` | filterable, sortable table |
| `/projects/new` | `projectNew` | `PlusCircle` | create form |
| `/projects/[id]` | — | — | detail: timeline, milestones, updates, files |
| `/projects/reports` | `projectReports` | `FileBarChart` | report table + Excel export |

`moduleForPath` and `activeHref` need **no change**: longest-prefix matching already resolves `/projects/[id]` to the project list tab and `/projects/new` to New Project.

## Components and actions

```
src/actions/
  project.actions.ts           create, update, delete, changeStatus, toggleAtRisk
  projectMilestone.actions.ts  add, rename, setDates, toggleDone, reorder, remove
  projectUpdate.actions.ts     post update (+ files), delete update
  projectReport.actions.ts     report query + Excel export

src/lib/
  projects.ts                  recalcProject, TRANSITIONS, code generation,
                               STATUS/PRIORITY constants (mirrors repair-constants.ts)

src/components/projects/
  ProjectForm.tsx          create/edit, react-hook-form + zod like ProductForm
  ProjectFilters.tsx       status, priority, department, owner, search
  ProjectTable.tsx         list rows with progress bar and status badge
  ProjectStatusBadge.tsx   shared status/priority pills
  ProjectTimeline.tsx      CSS-grid milestone bars
  MilestoneEditor.tsx      add/edit/reorder/tick milestones
  UpdateLog.tsx            dated entries, cost, attached files
  ProjectAttachments.tsx   project-level files, reuses pairFilesWithNames
```

### Timeline rendering

CSS grid, no dependency. Compute the project window as `min(milestone.startDate, project.startDate)` to `max(milestone.endDate, project.dueDate)`, then place each bar with `grid-column` derived from day offsets. Milestones missing dates render as an unpositioned row with a muted "no dates set" label — never a zero-width bar. On mobile the grid collapses to a stacked list with date text instead of bars.

### Files

Reuses `src/lib/uploads.ts` (`saveUpload`, `UPLOAD_ROOT`) and `src/lib/attachments.ts` (`pairFilesWithNames`, `MAX_DOC_NAME`), served through the existing `/uploads/[...path]` route. Same MIME allow-list and size cap as `RepairAttachment`, from the same constants — no second policy.

### Authorisation

Every action starts with `auth()` and returns `loginRequired` when there is no session, matching `repair.actions.ts:187`. Any signed-in user may create projects, post updates and tick milestones. **Deleting a project is `ADMIN`-only**, gated as in `user.actions.ts:20` — it cascades to milestones, updates and attachments.

## Reports

One report table: project code, name, department, owner, status, priority, start, due, finished, days late, budget, actual, variance. Filters by date range and status. Excel export via the existing `exceljs` setup in `src/lib/reportExport.ts`, matching `/repairs/reports`.

"Days late" is `finishedAt - dueDate` for finished projects, `today - dueDate` for unfinished ones past due, and blank otherwise.

## Internationalisation

New namespaces in **both** `messages/en.json` and `messages/th.json`: `Projects`, `ProjectForm`, `ProjectFilters`, `ProjectTimeline`, `ProjectMilestones`, `ProjectUpdates`, `ProjectActions`, `ProjectOverview`, `ProjectReports`. Five new `Nav` keys plus `moduleProject`.

## Testing

The project has no test runner, so verification is manual, consistent with the previous two modules:

1. `npx prisma migrate dev` applies cleanly against `office_stock_db`.
2. Create a project → code is `PJ-2026-001`; a second is `-002`.
3. Add 4 milestones, tick 3 → progress reads 75% on both detail and list.
4. Post an update with cost 1,500 and 2 files → actual cost updates, both files download.
5. Illegal transition (`PLANNING` → `DONE`) is rejected with a message.
6. `IN_PROGRESS` → `DONE` stamps a finish date; reopening clears it.
7. Delete a project as `STAFF` → forbidden; as `ADMIN` → succeeds and leaves no orphaned attachment rows.
8. Switch to Thai — no raw keys anywhere in the module.
9. Timeline renders correctly with milestones that have no dates set.

## Risks

- **Decimal handling.** Prisma returns `Decimal`; the existing modules convert with `Number()` at the boundary. Follow that or budget maths silently concatenates strings.
- **Timezone drift on date-only fields.** `startDate`/`dueDate` are conceptually dates, stored as `DateTime`. Normalise to midnight on write, as the maintenance module does for due dates, or bars land a day off.
- **`recalcProject` must run inside the same transaction** as the mutation that triggered it, or a failed write leaves `progress` describing milestones that were rolled back.

## Next steps

1. User reviews this spec.
2. `writing-plans` produces the implementation plan.
3. Implement, verify against the checklist above.

Deferred until the module is in real use: linking projects to repair jobs and equipment, per-milestone assignees, notifications for overdue projects, and a PDF project summary.
