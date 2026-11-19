// Runs the real migrations in an in-process Postgres (PGlite) with a stubbed
// Supabase auth/storage, and checks constraints and RLS isolation.
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { computeSlots } from "@/lib/availability";
import { zonedToUtc } from "@/lib/time";
import { pricePence } from "@/lib/pricing";

const dir = path.join(__dirname, "../migrations");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
let db: PGlite;
let bizA: string, bizB: string, staffA: string, svc: string, cus: string;

async function as<T>(uid: string, email: string, fn: () => Promise<T>) {
  await db.exec(`set role authenticated;
    select set_config('request.jwt.claim.sub','${uid}',false);
    select set_config('request.jwt.claims','{"email":"${email}"}',false);`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}

function book(start: string, end: string, token: string, status = "confirmed") {
  return db.query(
    `insert into bookings(business_id,staff_id,service_id,customer_id,starts_at,ends_at,
       buffer_after_minutes,status,service_name,duration_minutes,price_pence,cancel_token_hash)
     values($1,$2,$3,$4,$5,$6,10,$7,'Gel',60,3000,decode(md5($8),'hex'))`,
    [bizA, staffA, svc, cus, start, end, status, token]);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
    grant usage on schema auth, public to authenticated, anon, service_role;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public bool,
      file_size_limit int, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;`);
  for (const f of fs.readdirSync(dir).sort()) {
    // pgcrypto is not bundled in PGlite; gen_random_uuid() is built in.
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8").replace("create extension if not exists pgcrypto;", ""));
  }
  await db.exec(`insert into auth.users values ('${A}','a@x.com'),('${B}','b@x.com')`);
  bizA = (await as(A, "a@x.com", () => db.query<{ id: string }>(`select public.create_business('Lily Nails','lily-nails','Lily','lily@x.com','07700 900001',5,'month') id`))).rows[0].id;
  bizB = (await as(B, "b@x.com", () => db.query<{ id: string }>(`select public.create_business('Other','other-biz','Bob','bob@x.com','07700 900002',2,'year') id`))).rows[0].id;
  staffA = (await db.query<{ id: string }>(`select id from staff where business_id=$1`, [bizA])).rows[0].id;
  await db.query(`insert into services(business_id,name,duration_minutes,buffer_after_minutes) values($1,'Gel',60,10)`, [bizA]);
  svc = (await db.query<{ id: string }>(`select id from services where business_id=$1`, [bizA])).rows[0].id;
  await db.query(`insert into customers(business_id,name,email) values($1,'C','c@x.com')`, [bizA]);
  cus = (await db.query<{ id: string }>(`select id from customers`)).rows[0].id;
});

describe("double booking", () => {
  it("accepts the first booking", async () => {
    await book("2026-06-01 10:00+01", "2026-06-01 11:00+01", "1");
  });
  it("rejects an overlapping booking for the same staff", async () => {
    await expect(book("2026-06-01 10:30+01", "2026-06-01 11:30+01", "2")).rejects.toThrow(/no_double_booking/);
  });
  it("rejects a booking inside the buffer", async () => {
    await expect(book("2026-06-01 11:05+01", "2026-06-01 12:05+01", "3")).rejects.toThrow(/no_double_booking/);
  });
  it("allows a booking right after the buffer", async () => {
    await book("2026-06-01 11:10+01", "2026-06-01 12:10+01", "4");
  });
  it("frees the slot once cancelled", async () => {
    await db.exec(`update bookings set status='cancelled' where starts_at='2026-06-01 10:00+01'`);
    await book("2026-06-01 10:00+01", "2026-06-01 11:00+01", "5");
  });
});

describe("other constraints", () => {
  it("rejects overlapping working hours", async () => {
    await db.query(`insert into working_hours(business_id,staff_id,weekday,start_minute,end_minute) values($1,$2,1,540,720)`, [bizA, staffA]);
    await expect(db.query(`insert into working_hours(business_id,staff_id,weekday,start_minute,end_minute) values($1,$2,1,700,900)`, [bizA, staffA])).rejects.toThrow(/no_overlap/);
  });
  it("rejects a deposit larger than the price", async () => {
    await expect(db.query(`insert into services(business_id,name,duration_minutes,price_pence,deposit_pence) values($1,'Bad',30,1000,2000)`, [bizA])).rejects.toThrow(/check/);
  });
  it("rejects cross-tenant references", async () => {
    await expect(db.query(`insert into staff_services(business_id,staff_id,service_id) values($1,$2,$3)`, [bizB, staffA, svc])).rejects.toThrow(/foreign key/);
  });
});

describe("RLS", () => {
  it("lets a user see only their own business and bookings", async () => {
    expect((await as(A, "a@x.com", () => db.query(`select slug from businesses`))).rows).toEqual([{ slug: "lily-nails" }]);
    expect((await as(B, "b@x.com", () => db.query(`select count(*)::int n from bookings`))).rows[0]).toEqual({ n: 0 });
  });
  it("blocks cross-tenant updates", async () => {
    const r = await as(B, "b@x.com", () => db.query(`update businesses set name='hax' where id=$1 returning id`, [bizA]));
    expect(r.rows).toHaveLength(0);
  });
  it("blocks clients writing Stripe or consent columns", async () => {
    await expect(as(A, "a@x.com", () => db.query(`update businesses set stripe_charges_enabled=true`))).rejects.toThrow(/permission denied/);
    await expect(as(A, "a@x.com", () => db.query(`update customers set marketing_consent=true`))).rejects.toThrow(/permission denied/);
  });
  it("gives anon no access", async () => {
    await db.exec("set role anon");
    try { await expect(db.query(`select * from businesses`)).rejects.toThrow(/permission denied/); }
    finally { await db.exec("reset role"); }
  });
  it("allows a second business only once per user", async () => {
    await expect(as(A, "a@x.com", () => db.query(`select public.create_business('X','xxx','A','a@x.com','1234567',1,'month')`))).rejects.toThrow(/already belongs/);
  });
  it("scopes logo uploads to the owner's business folder", async () => {
    await as(A, "a@x.com", () => db.query(`insert into storage.objects(bucket_id,name) values('logos',$1)`, [`${bizA}/x.png`]));
    await expect(as(B, "b@x.com", () => db.query(`insert into storage.objects(bucket_id,name) values('logos',$1)`, [`${bizA}/y.png`]))).rejects.toThrow(/row-level security/);
    await expect(as(A, "a@x.com", () => db.query(`insert into storage.objects(bucket_id,name) values('logos','nope/z.png')`))).rejects.toThrow(/row-level security/);
  });
});

describe("set_working_hours / set_staff_services", () => {
  const S = "00000000-0000-0000-0000-00000000000c";
  let staffS: string;
  const hours = (rows: [number, number, number][]) =>
    JSON.stringify(rows.map(([weekday, start, end]) => ({ weekday, start, end })));
  const setHours = (uid: string, email: string, staff: string, rows: [number, number, number][]) =>
    as(uid, email, () => db.query(`select public.set_working_hours($1, $2::jsonb)`, [staff, hours(rows)]));
  const count = async (staff: string) =>
    (await db.query<{ n: number }>(`select count(*)::int n from working_hours where staff_id=$1`, [staff])).rows[0].n;

  beforeAll(async () => {
    await db.exec(`insert into auth.users values ('${S}','s@x.com')`);
    staffS = (await db.query<{ id: string }>(
      `insert into staff(business_id,user_id,name) values($1,$2,'Sam') returning id`, [bizA, S])).rows[0].id;
    await db.query(`insert into business_members(business_id,user_id,role) values($1,$2,'staff')`, [bizA, S]);
  });

  it("replaces the weekly hours in one go", async () => {
    await setHours(A, "a@x.com", staffA, [[1, 540, 1020], [2, 540, 1020]]);
    expect(await count(staffA)).toBe(2);
    await setHours(A, "a@x.com", staffA, [[3, 600, 900]]);
    expect(await count(staffA)).toBe(1);
  });
  it("keeps the old hours if the new set is invalid (atomic)", async () => {
    await expect(setHours(A, "a@x.com", staffA, [[4, 540, 720], [4, 700, 900]])).rejects.toThrow(/no_overlap/);
    expect(await count(staffA)).toBe(1);
  });
  it("lets a staff member edit only their own hours", async () => {
    await setHours(S, "s@x.com", staffS, [[1, 540, 1020]]);
    expect(await count(staffS)).toBe(1);
    await expect(setHours(S, "s@x.com", staffA, [[1, 0, 60]])).rejects.toThrow(/row-level security/);
    expect(await count(staffA)).toBe(1);
  });
  it("cannot touch another business's staff", async () => {
    await expect(setHours(B, "b@x.com", staffA, [[1, 540, 600]])).rejects.toThrow(/not found/);
  });
  it("assigns services, and blocks services from another business", async () => {
    await as(A, "a@x.com", () => db.query(`select public.set_staff_services($1, array[$2]::uuid[])`, [staffA, svc]));
    expect((await db.query(`select 1 from staff_services where staff_id=$1`, [staffA])).rows).toHaveLength(1);
    await db.query(`insert into services(business_id,name,duration_minutes) values($1,'Other',30)`, [bizB]);
    const foreign = (await db.query<{ id: string }>(`select id from services where business_id=$1`, [bizB])).rows[0].id;
    await expect(as(A, "a@x.com", () => db.query(`select public.set_staff_services($1, array[$2]::uuid[])`, [staffA, foreign]))).rejects.toThrow(/foreign key/);
    expect((await db.query(`select 1 from staff_services where staff_id=$1`, [staffA])).rows).toHaveLength(1);
  });
  it("only the owner can assign services", async () => {
    await expect(as(S, "s@x.com", () => db.query(`select public.set_staff_services($1, array[$2]::uuid[])`, [staffS, svc]))).rejects.toThrow(/row-level security/);
  });
});

describe("availability engine agrees with the no_double_booking constraint", () => {
  const DATE = "2026-06-02"; // Tuesday, BST
  const ranges: [number, number][] = [[540, 780], [840, 1080]]; // 09:00-13:00, 14:00-18:00
  const DURATION = 60;
  const at = (hhmm: string) => zonedToUtc(DATE, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), "Europe/London").toISOString();

  it("offers exactly the starts the database would accept", async () => {
    await as(A, "a@x.com", () => db.query(`select public.set_working_hours($1, $2::jsonb)`, [
      staffA, JSON.stringify(ranges.map(([start, end]) => ({ weekday: 2, start, end }))),
    ]));
    await book(at("10:00"), at("11:00"), "av1");
    await book(at("12:00"), at("13:00"), "av2", "cancelled"); // must not block anything
    await book(at("15:30"), at("16:30"), "av3");
    await book(at("17:00"), at("18:00"), "av4", "pending_payment"); // an unpaid hold blocks too

    const live = (await db.query<{ starts_at: Date; ends_at: Date; buffer_before_minutes: number; buffer_after_minutes: number }>(
      `select starts_at, ends_at, buffer_before_minutes, buffer_after_minutes from bookings
       where staff_id=$1 and status in ('pending_payment','confirmed','completed','no_show')`, [staffA])).rows;
    const blocked = live.map((b) => ({
      start: new Date(b.starts_at.getTime() - b.buffer_before_minutes * 60000),
      end: new Date(b.ends_at.getTime() + b.buffer_after_minutes * 60000),
    }));

    const slots = computeSlots({
      tz: "Europe/London", date: DATE, now: new Date("2026-05-01T08:00:00Z"), slotIntervalMinutes: 15,
      minNoticeMinutes: 0, maxAdvanceDays: 90,
      service: { durationMinutes: DURATION, bufferBeforeMinutes: 0, bufferAfterMinutes: 10 },
      staff: [{ id: staffA, workingHours: ranges.map(([start, end]) => ({ weekday: 2, start, end })), timeOff: [], blocked }],
    });
    const offered = new Set(slots.map((x) => x.start.toISOString()));

    let accepted = 0, rejected = 0, n = 0;
    for (let t = 480; t <= 1140; t += 15) {
      if (!ranges.some(([s, e]) => t >= s && t + DURATION <= e)) continue; // outside working hours: engine's job only
      const start = zonedToUtc(DATE, t, "Europe/London");
      const end = new Date(start.getTime() + DURATION * 60000);
      await db.exec("begin");
      let ok = true;
      try { await book(start.toISOString(), end.toISOString(), `cand${n++}`); } catch { ok = false; }
      await db.exec("rollback");
      expect(offered.has(start.toISOString()), `start ${start.toISOString()}`).toBe(ok);
      if (ok) accepted++; else rejected++;
    }
    expect(accepted).toBeGreaterThan(5);
    expect(rejected).toBeGreaterThan(5);
  });
});

describe("create_booking and rate_limit_hit (server-only functions)", () => {
  const DAY = "2027-03-02"; // far future so the start is never in the past
  const when = (hhmm: string) => zonedToUtc(DAY, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), "Europe/London").toISOString();
  const asServer = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try { return await fn(); } finally { await db.exec("reset role"); }
  };
  let n = 0;
  const create = (over: Partial<{ biz: string; svc: string; staff: string; at: string; email: string; consent: boolean; deposit: boolean; name: string }> = {}) =>
    asServer(() => db.query<{ id: string }>(
      `select public.create_booking($1,$2,$3,$4,$5,$6,'07700 900123',$7,decode(md5($8),'hex'),$9) id`,
      [over.biz ?? bizA, over.svc ?? svc, over.staff ?? staffA, over.at ?? when("10:00"), over.name ?? "Cat", over.email ?? "cat@x.com",
       over.consent ?? false, `pub${n++}`, over.deposit ?? false]));

  it("is not callable by signed-in users or anon", async () => {
    await expect(as(A, "a@x.com", () => db.query(`select public.create_booking($1,$2,$3,now() + interval '1 day','x','x@x.com','1',false,'\\x00',false)`, [bizA, svc, staffA]))).rejects.toThrow(/permission denied/);
    await db.exec("set role anon");
    try { await expect(db.query(`select public.rate_limit_hit('k', 60, 5)`)).rejects.toThrow(/permission denied/); }
    finally { await db.exec("reset role"); }
  });

  it("creates a confirmed booking with snapshots and a customer", async () => {
    await db.query(`delete from staff_services where staff_id=$1`, [staffA]);
    await db.query(`insert into staff_services(business_id,staff_id,service_id) values($1,$2,$3)`, [bizA, staffA, svc]);
    const id = (await create()).rows[0].id;
    const b = (await db.query<{ status: string; service_name: string; duration_minutes: number; deposit_status: string; hold_expires_at: Date | null }>(
      `select status, service_name, duration_minutes, deposit_status, hold_expires_at from bookings where id=$1`, [id])).rows[0];
    expect(b).toMatchObject({ status: "confirmed", service_name: "Gel", duration_minutes: 60, deposit_status: "none", hold_expires_at: null });
  });

  it("rejects a double booking atomically (customer upsert rolls back too)", async () => {
    const before = (await db.query<{ n: number }>(`select count(*)::int n from customers`)).rows[0].n;
    await expect(create({ at: when("10:30"), email: "new-person@x.com" })).rejects.toThrow(/no_double_booking/);
    expect((await db.query<{ n: number }>(`select count(*)::int n from customers`)).rows[0].n).toBe(before);
  });

  it("reuses one customer per email (case-insensitive) and only ever grants consent", async () => {
    await create({ at: when("12:00"), email: "CAT@x.com", name: "Cat Two", consent: true });
    await create({ at: when("14:00"), email: "cat@X.com", consent: false });
    const rows = (await db.query<{ name: string; marketing_consent: boolean; n: number }>(
      `select name, marketing_consent, count(*) over ()::int n from customers where business_id=$1 and lower(email)='cat@x.com'`, [bizA])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].marketing_consent).toBe(true); // a later booking without the tick doesn't withdraw it
  });

  it("rejects wrong tenant, inactive or non-offering staff, and the past", async () => {
    await expect(create({ biz: bizB, at: when("16:00") })).rejects.toThrow(/not available/);
    await db.query(`update staff set active=false where id=$1`, [staffA]);
    await expect(create({ at: when("16:00") })).rejects.toThrow(/not available/);
    await db.query(`update staff set active=true where id=$1`, [staffA]);
    await expect(create({ at: "2020-01-01T10:00:00Z" })).rejects.toThrow(/in the past/);
  });

  it("holds the slot for deposit services and frees it when the hold expires", async () => {
    await db.query(`update services set price_pence=3000, deposit_pence=1000 where id=$1`, [svc]);
    await expect(create({ at: when("16:00"), deposit: false })).rejects.toThrow(/deposit payment is not available/);
    const id = (await create({ at: when("16:00"), deposit: true })).rows[0].id;
    const held = (await db.query<{ status: string; deposit_status: string; hold_expires_at: Date }>(`select status, deposit_status, hold_expires_at from bookings where id=$1`, [id])).rows[0];
    expect(held).toMatchObject({ status: "pending_payment", deposit_status: "pending" });
    expect(held.hold_expires_at.getTime()).toBeGreaterThan(Date.now());
    await expect(create({ at: when("16:00"), deposit: true, email: "dog@x.com" })).rejects.toThrow(/no_double_booking/);
    await db.query(`update bookings set hold_expires_at = now() - interval '1 minute' where id=$1`, [id]);
    await create({ at: when("16:00"), deposit: true, email: "dog@x.com" }); // sweeps the stale hold, then succeeds
    expect((await db.query<{ status: string }>(`select status from bookings where id=$1`, [id])).rows[0].status).toBe("expired");
    await db.query(`update services set price_pence=0, deposit_pence=0 where id=$1`, [svc]);
  });

  it("rate limiter allows up to the limit per window, per key", async () => {
    const hit = (k: string) => asServer(() => db.query<{ ok: boolean }>(`select public.rate_limit_hit($1, 600, 3) ok`, [k])).then((r) => r.rows[0].ok);
    expect([await hit("ip:1"), await hit("ip:1"), await hit("ip:1"), await hit("ip:1")]).toEqual([true, true, true, false]);
    expect(await hit("ip:2")).toBe(true);
  });
});

describe("billing: pricing, trial and staff seats", () => {
  const S = "00000000-0000-0000-0000-00000000000c"; // staff user of bizA (from an earlier block)
  const billing = async (biz: string) => (await db.query<Record<string, unknown>>(`select * from business_billing where business_id=$1`, [biz])).rows[0];
  const asServer = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try { return await fn(); } finally { await db.exec("reset role"); }
  };
  let n = 0;
  const newBusiness = async (seats: number, interval = "month") => {
    const i = ++n, uid = `00000000-0000-0000-0000-0000000000e${i}`, email = `owner${i}@x.com`;
    await db.exec(`insert into auth.users values ('${uid}','${email}')`);
    const id = (await as(uid, email, () => db.query<{ id: string }>(
      `select public.create_business('Shop ${i}','shop-${i}','Owner ${i}',$1,'07700 900003',$2,$3) id`, [email, seats, interval]))).rows[0].id;
    return { id, uid, email };
  };
  const addStaff = (b: string, name = "Extra") => db.query(`insert into staff(business_id,name) values($1,$2)`, [b, name]);
  const setSeats = (o: { id: string; uid: string; email: string }, seats: number) =>
    as(o.uid, o.email, () => db.query(`select public.change_staff_seats($1,$2)`, [o.id, seats]));

  it("SQL and TypeScript prices agree for every seat count and both intervals", async () => {
    for (let seats = 1; seats <= 50; seats++) {
      for (const interval of ["month", "year"] as const) {
        const r = await db.query<{ p: number }>(`select public.billing_price_pence($1,$2) p`, [seats, interval]);
        expect(r.rows[0].p, `${seats} ${interval}`).toBe(pricePence(seats, interval));
      }
    }
  });

  it("creates a billing row with a 60 day trial, the computed price and the contact details", async () => {
    const a = await billing(bizA);
    expect(a).toMatchObject({ status: "trialing", staff_seats: 5, billing_interval: "month", current_price_pence: 2300, stripe_subscription_id: null });
    const days = ((a.trial_ends_at as Date).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(59.9);
    expect(days).toBeLessThan(60.1);
    expect(await billing(bizB)).toMatchObject({ billing_interval: "year", staff_seats: 2, current_price_pence: 17000 });
    expect((await db.query(`select owner_name, phone, email from businesses where id=$1`, [bizA])).rows[0])
      .toEqual({ owner_name: "Lily", phone: "07700 900001", email: "lily@x.com" });
    await expect(as(A, "a@x.com", () => db.query(`select public.create_business('Z','zzz','Z','z@x.com','1234567',0,'month')`))).rejects.toThrow(/already belongs|seats must be/);
  });

  it("the database stops active staff exceeding the seats paid for", async () => {
    const o = await newBusiness(2);
    await addStaff(o.id, "Second");
    await expect(addStaff(o.id, "Third")).rejects.toThrow(/staff_seats_exceeded/);
    await db.query(`update staff set active=false where business_id=$1 and name='Second'`, [o.id]);
    await addStaff(o.id, "Third"); // a freed seat can be reused
    await expect(db.query(`update staff set active=true where business_id=$1 and name='Second'`, [o.id])).rejects.toThrow(/staff_seats_exceeded/);
    await db.query(`insert into staff(business_id,name,active) values($1,'Inactive person',false)`, [o.id]); // inactive staff don't use a seat
  });

  it("during the trial seat changes apply immediately and are never charged", async () => {
    const o = await newBusiness(2);
    await setSeats(o, 4);
    expect(await billing(o.id)).toMatchObject({ staff_seats: 4, current_price_pence: 2100, next_staff_seats: null });
    await addStaff(o.id, "B"); await addStaff(o.id, "C");
    await expect(setSeats(o, 2)).rejects.toThrow(/staff_seats_below_active/);
    await setSeats(o, 3);
    expect(await billing(o.id)).toMatchObject({ staff_seats: 3, current_price_pence: 1900 });
  });

  it("only the owner can change seats", async () => {
    const o = await newBusiness(3);
    const other = await newBusiness(1);
    await expect(as(other.uid, other.email, () => db.query(`select public.change_staff_seats($1,4)`, [o.id]))).rejects.toThrow(/not allowed/);
    await expect(as(S, "s@x.com", () => db.query(`select public.change_staff_seats($1,4)`, [bizA]))).rejects.toThrow(/not allowed/);
    await expect(setSeats(o, 51)).rejects.toThrow(/between 1 and 50/);
  });

  it("with a subscription a reduction waits for the next period: 3 staff pay 19 now and 17 next", async () => {
    const o = await newBusiness(3);
    await db.query(`update business_billing set stripe_subscription_id='sub_1', status='active', current_period_end=now() + interval '10 days' where business_id=$1`, [o.id]);
    await addStaff(o.id, "B"); // 2 active of 3 seats

    await setSeats(o, 2);
    const b = await billing(o.id);
    expect(b).toMatchObject({ staff_seats: 3, current_price_pence: 1900, next_staff_seats: 2, next_price_pence: 1700 });
    expect((b.change_effective_at as Date).getTime()).toBe((b.current_period_end as Date).getTime());

    await expect(setSeats(o, 4)).rejects.toThrow(/seat_increase_requires_payment/);
    await expect(addStaff(o.id, "C")).rejects.toThrow(/staff_seats_exceeded/); // capped by the scheduled 2

    await setSeats(o, 3); // setting the current count cancels the reduction
    expect(await billing(o.id)).toMatchObject({ staff_seats: 3, current_price_pence: 1900, next_staff_seats: null, next_price_pence: null });
    await addStaff(o.id, "C");
    await expect(setSeats(o, 2)).rejects.toThrow(/staff_seats_below_active/); // 3 people are active

    await db.query(`update staff set active=false where business_id=$1 and name='C'`, [o.id]);
    await setSeats(o, 2);
    expect(await asServer(() => db.query<{ n: number }>(`select public.apply_due_seat_changes() n`)).then((r) => r.rows[0].n)).toBe(0); // not due yet
    await db.query(`update business_billing set change_effective_at = now() - interval '1 minute' where business_id=$1`, [o.id]);
    expect(await asServer(() => db.query<{ n: number }>(`select public.apply_due_seat_changes() n`)).then((r) => r.rows[0].n)).toBeGreaterThanOrEqual(1);
    expect(await billing(o.id)).toMatchObject({ staff_seats: 2, current_price_pence: 1700, next_staff_seats: null, change_effective_at: null });
  });

  it("billing is readable by the owner only and never writable from the client", async () => {
    expect((await as(A, "a@x.com", () => db.query(`select 1 from business_billing`))).rows).toHaveLength(1);
    expect((await as(S, "s@x.com", () => db.query(`select 1 from business_billing`))).rows).toHaveLength(0); // staff member
    expect((await as(B, "b@x.com", () => db.query(`select 1 from business_billing where business_id=$1`, [bizA]))).rows).toHaveLength(0);
    await expect(as(A, "a@x.com", () => db.query(`update business_billing set current_price_pence=1`))).rejects.toThrow(/permission denied/);
    await expect(as(A, "a@x.com", () => db.query(`select public.apply_due_seat_changes()`))).rejects.toThrow(/permission denied/);
  });
});
