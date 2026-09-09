/**
 * Tasks in the order you want to do them.
 *
 * Two properties. A task nobody has dragged keeps behaving the way it did —
 * adding manual ordering must not silently freeze a list that was sorted by
 * date. And saving writes the whole order rather than a relative nudge, so
 * what is stored is exactly what was on screen.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  createTask,
  listOpenTasks,
  reorderTasks,
  sortTasks,
} from "@/lib/services/workflow";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let sqlite: Database.Database;
let dir: string;
const ids: string[] = [];

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-taskorder-"));
  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  for (const title of ["First", "Second", "Third"]) {
    const task = await createTask(db, { title });
    ids.push(task.id);
  }
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("a task nobody dragged behaves as it did", () => {
  it("sorts unplaced tasks after placed ones, keeping their own order", () => {
    const rows = [
      { id: "c", sortOrder: null },
      { id: "a", sortOrder: 1 },
      { id: "d", sortOrder: null },
      { id: "b", sortOrder: 0 },
    ];
    expect(sortTasks(rows).map((row) => row.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("leaves a list nobody has touched exactly as the database gave it", () => {
    const rows = [
      { id: "x", sortOrder: null },
      { id: "y", sortOrder: null },
    ];
    expect(sortTasks(rows).map((row) => row.id)).toEqual(["x", "y"]);
  });
});

describe("saving an order", () => {
  it("stores exactly the order it was given", async () => {
    const reversed = [...ids].reverse();
    const result = await reorderTasks(db, { orderedIds: reversed });
    expect(result.placed).toBe(3);
    const listed = await listOpenTasks(db);
    expect(listed.map((task) => task.title)).toEqual([
      "Third",
      "Second",
      "First",
    ]);
  });

  it("ignores an id that is not an open task rather than failing the move", async () => {
    const result = await reorderTasks(db, {
      orderedIds: [...ids, "not-a-task"],
    });
    expect(result.placed).toBe(3);
  });

  it("survives being sent the same order twice", async () => {
    const first = await listOpenTasks(db);
    await reorderTasks(db, { orderedIds: first.map((task) => task.id) });
    const second = await listOpenTasks(db);
    expect(second.map((task) => task.id)).toEqual(first.map((task) => task.id));
  });
});
