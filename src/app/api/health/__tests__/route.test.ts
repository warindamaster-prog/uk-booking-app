import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ limit: select }) }) }),
}));

import { GET } from "../route";

describe("GET /api/health", () => {
  beforeEach(() => { select.mockReset(); vi.spyOn(console, "error").mockImplementation(() => {}); });

  it("returns ok when the database answers", async () => {
    select.mockResolvedValue({ error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 503 without details when the query fails", async () => {
    select.mockResolvedValue({ error: { message: "connection refused to 10.0.0.1" } });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("returns 503 when the client cannot be created or throws", async () => {
    select.mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
