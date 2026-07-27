/**
 * Pairing and totalling for repeatable part/cost lists.
 *
 * Shared by the Repair module (`RepairPart`) and the Maintenance module
 * (`MaintenancePart`) — both collect the same name+cost rows, so the money
 * arithmetic and index alignment live in one tested place.
 *
 * Kept out of any `"use server"` module so it can be unit tested directly.
 */

export interface PendingPart {
  name: string;
  cost: number;
}

export const MAX_PART_NAME = 191;

/** Two decimals, matching `Decimal(10,2)`, without float drift like 0.1+0.2. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Zips `names[i]` with `costs[i]` into part rows.
 *
 * Rows whose name is blank are dropped *after* zipping so a blank row in the
 * middle cannot shift later costs onto the wrong part. A missing or unparsable
 * cost counts as 0 rather than failing the whole submit — a part with no price
 * yet is still worth recording.
 */
export function pairParts(
  names: readonly unknown[],
  costs: readonly unknown[]
): PendingPart[] {
  return names
    .map((name, i) => {
      const raw = costs[i];
      const num = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
      return {
        name: typeof name === "string" ? name.trim() : "",
        cost: Number.isFinite(num) && num > 0 ? round2(num) : 0,
      };
    })
    .filter((p) => p.name !== "")
    .map((p) => ({ ...p, name: p.name.slice(0, MAX_PART_NAME) }));
}

/** Total for a service: everything not tied to a part, plus every part. */
export function totalCost(labourCost: number, parts: readonly PendingPart[]): number {
  const labour = Number.isFinite(labourCost) && labourCost > 0 ? labourCost : 0;
  return round2(parts.reduce((sum, p) => sum + p.cost, labour));
}
