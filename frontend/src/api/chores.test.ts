import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import * as chores from "./chores";

afterEach(() => {
  vi.unstubAllGlobals();
});

const input: chores.ChoreInput = {
  title: "Dishes",
  points: 5,
  assignedToUserId: "u1",
  recurrence: "daily",
  dueDate: "2026-08-17",
};

describe("chores api", () => {
  it("listChores without dueToday", async () => {
    const fetchMock = mockApi({ "GET /api/chores": { body: { chores: [] } } });
    await chores.listChores();
    expect(fetchMock).toHaveBeenCalledWith("/api/chores", expect.anything());
  });

  it("listChores with dueToday appends query", async () => {
    const fetchMock = mockApi({ "GET /api/chores?due=today": { body: { chores: [] } } });
    await chores.listChores(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/chores?due=today", expect.anything());
  });

  it("getChore fetches by id", async () => {
    mockApi({ "GET /api/chores/c1": { body: { id: "c1" } } });
    await expect(chores.getChore("c1")).resolves.toEqual({ id: "c1" });
  });

  it("createChore posts input", async () => {
    mockApi({ "POST /api/chores": { body: { id: "c1", ...input } } });
    await expect(chores.createChore(input)).resolves.toMatchObject({ id: "c1" });
  });

  it("updateChore patches by id", async () => {
    mockApi({ "PATCH /api/chores/c1": { body: { id: "c1", ...input } } });
    await expect(chores.updateChore("c1", input)).resolves.toMatchObject({ id: "c1" });
  });

  it("deleteChore deletes by id", async () => {
    mockApi({ "DELETE /api/chores/c1": { body: { ok: true } } });
    await expect(chores.deleteChore("c1")).resolves.toEqual({ ok: true });
  });

  it("completeChore posts complete", async () => {
    mockApi({ "POST /api/chores/c1/complete": { body: { ok: true, alreadyDone: false } } });
    await expect(chores.completeChore("c1")).resolves.toEqual({ ok: true, alreadyDone: false });
  });

  it("uncompleteChore posts uncomplete", async () => {
    mockApi({ "POST /api/chores/c1/uncomplete": { body: { ok: true } } });
    await expect(chores.uncompleteChore("c1")).resolves.toEqual({ ok: true });
  });
});
