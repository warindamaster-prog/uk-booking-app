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

describe("staff levels and per-level prices", () => {
  const S = "00000000-0000-0000-0000-00000000000c"; // staff user of bizA
  const asServer = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try { return await fn(); } finally { await db.exec("reset role"); }
  };
  const FUTURE = "2027-04-06"; // Tuesday
  const at = (hhmm: string) => zonedToUtc(FUTURE, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), "Europe/London").toISOString();
  let n = 0;
  const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T & object>(sql, params)).rows[0] as T;

  let junior: string, senior: string, jStaff: string, sStaff: string, plain: string, cutSvc: string;

  it("lets an owner create levels; names are unique per business ignoring case", async () => {
    junior = (await as(A, "a@x.com", () => db.query<{ id: string }>(`insert into staff_levels(business_id,name) values($1,'Junior') returning id`, [bizA]))).rows[0].id;
    senior = (await as(A, "a@x.com", () => db.query<{ id: string }>(`insert into staff_levels(business_id,name) values($1,'Senior') returning id`, [bizA]))).rows[0].id;
    await expect(as(A, "a@x.com", () => db.query(`insert into staff_levels(business_id,name) values($1,'JUNIOR')`, [bizA]))).rejects.toThrow(/duplicate key/);
    await as(B, "b@x.com", () => db.query(`insert into staff_levels(business_id,name) values($1,'Junior')`, [bizB])); // another business may reuse the name
  });

  it("is invisible to other businesses and read-only for staff members", async () => {
    expect((await as(B, "b@x.com", () => db.query(`select 1 from staff_levels where business_id=$1`, [bizA]))).rows).toHaveLength(0);
    expect((await as(S, "s@x.com", () => db.query(`select 1 from staff_levels where business_id=$1`, [bizA]))).rows.length).toBe(2);
    await expect(as(S, "s@x.com", () => db.query(`insert into staff_levels(business_id,name) values($1,'Boss')`, [bizA]))).rejects.toThrow(/row-level security/);
  });

  it("assigns a level and description to staff, but only a level of the same business", async () => {
    jStaff = (await db.query<{ id: string }>(`insert into staff(business_id,name,level_id,description) values($1,'Jo',$2,'Newly qualified') returning id`, [bizA, junior])).rows[0].id;
    sStaff = (await db.query<{ id: string }>(`insert into staff(business_id,name,level_id) values($1,'Sid',$2) returning id`, [bizA, senior])).rows[0].id;
    await expect(db.query(`insert into staff(business_id,name,level_id) values($1,'X',$2)`, [bizB, junior])).rejects.toThrow(/foreign key/);
    await expect(db.query(`update staff set description=$1 where id=$2`, ["x".repeat(301), jStaff])).rejects.toThrow(/check/);
  });

  it("level prices apply per service; deposits are protected", async () => {
    await db.query(`insert into services(business_id,name,duration_minutes,price_pence,deposit_pence) values($1,'Cut',30,2500,1000)`, [bizA]);
    cutSvc = (await db.query<{ id: string }>(`select id from services where business_id=$1 and name='Cut'`, [bizA])).rows[0].id;
    await db.query(`insert into staff_services(business_id,staff_id,service_id) select $1, id, $2 from staff where id in ($3,$4)`, [bizA, cutSvc, jStaff, sStaff]);
    await as(A, "a@x.com", () => db.query(`select public.set_service_level_prices($1, $2::jsonb)`, [cutSvc, JSON.stringify([{ level_id: senior, price_pence: 4000 }])]));
    expect((await db.query(`select price_pence from service_level_prices where service_id=$1`, [cutSvc])).rows).toEqual([{ price_pence: 4000 }]);
    await expect(as(A, "a@x.com", () => db.query(`select public.set_service_level_prices($1, $2::jsonb)`, [cutSvc, JSON.stringify([{ level_id: senior, price_pence: 500 }])]))).rejects.toThrow(/level_price_below_deposit/);
    expect((await db.query(`select price_pence from service_level_prices where service_id=$1`, [cutSvc])).rows).toEqual([{ price_pence: 4000 }]); // atomic: unchanged
    await expect(db.query(`update services set price_pence=5000, deposit_pence=4500 where id=$1`, [cutSvc])).rejects.toThrow(/deposit_above_level_price/);
    await expect(as(B, "b@x.com", () => db.query(`select public.set_service_level_prices($1, '[]'::jsonb)`, [cutSvc]))).rejects.toThrow(/not found/);
    // a staff member can neither add nor wipe level prices (their delete matches no rows under RLS)
    await expect(as(S, "s@x.com", () => db.query(`select public.set_service_level_prices($1, $2::jsonb)`, [cutSvc, JSON.stringify([{ level_id: senior, price_pence: 3000 }])]))).rejects.toThrow(/row-level security/);
    await as(S, "s@x.com", () => db.query(`select public.set_service_level_prices($1, '[]'::jsonb)`, [cutSvc]));
    expect((await db.query(`select price_pence from service_level_prices where service_id=$1`, [cutSvc])).rows).toEqual([{ price_pence: 4000 }]);
  });

  it("create_booking snapshots the price of the assigned person's level", async () => {
    await db.query(`update staff set active=true where id in ($1,$2)`, [jStaff, sStaff]);
    const book = (staff: string, hhmm: string) => asServer(() => db.query<{ id: string }>(
      `select public.create_booking($1,$2,$3,$4,'Pat',$5,'07700 900123',false,decode(md5($6),'hex'),true) id`,
      [bizA, cutSvc, staff, at(hhmm), `pat${n}@x.com`, `lvl${n++}`]));
    const price = async (id: string) => (await one<{ price_pence: number; deposit_pence: number }>(`select price_pence, deposit_pence from bookings where id=$1`, [id]));
    expect(await price((await book(sStaff, "10:00")).rows[0].id)).toEqual({ price_pence: 4000, deposit_pence: 1000 }); // senior override
    expect(await price((await book(jStaff, "10:00")).rows[0].id)).toEqual({ price_pence: 2500, deposit_pence: 1000 }); // junior: no override, standard price
    plain = (await db.query<{ id: string }>(`insert into staff(business_id,name) values($1,'Plain') returning id`, [bizA])).rows[0].id;
    await db.query(`insert into staff_services(business_id,staff_id,service_id) values($1,$2,$3)`, [bizA, plain, cutSvc]);
    expect(await price((await book(plain, "10:00")).rows[0].id)).toEqual({ price_pence: 2500, deposit_pence: 1000 }); // no level: standard
  });

  it("changing a price later does not alter existing bookings", async () => {
    await as(A, "a@x.com", () => db.query(`select public.set_service_level_prices($1, $2::jsonb)`, [cutSvc, JSON.stringify([{ level_id: senior, price_pence: 6000 }])]));
    expect((await db.query(`select price_pence from bookings where staff_id=$1 and service_id=$2`, [sStaff, cutSvc])).rows).toEqual([{ price_pence: 4000 }]);
  });

  it("deleting a level keeps the person but returns them to the standard price", async () => {
    await as(A, "a@x.com", () => db.query(`delete from staff_levels where id=$1`, [senior]));
    expect(await one(`select level_id from staff where id=$1`, [sStaff])).toEqual({ level_id: null });
    expect((await db.query(`select 1 from service_level_prices where level_id=$1`, [senior])).rows).toHaveLength(0);
  });
});

describe("booking status and reschedule rules", () => {
  const FUT = "2027-05-04"; // Tuesday
  const PAST = "2020-01-07";
  const at = (d: string, hhmm: string) => zonedToUtc(d, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), "Europe/London").toISOString();
  let n = 0;
  const mk = async (when: string, status = "confirmed", staff = staffA) => (await db.query<{ id: string }>(
    `insert into bookings(business_id,staff_id,service_id,customer_id,starts_at,ends_at,status,service_name,duration_minutes,price_pence,cancel_token_hash)
     values($1,$2,$3,$4,$5,$5::timestamptz + interval '1 hour',$6,'Gel',60,3000,decode(md5($7),'hex')) returning id`,
    [bizA, staff, svc, cus, when, status, `rule${n++}`])).rows[0].id;
  const set = (id: string, sql: string, params: unknown[] = []) => db.query(`update bookings set ${sql} where id=$1`, [id, ...params]);
  const status = async (id: string) => (await db.query<{ status: string }>(`select status from bookings where id=$1`, [id])).rows[0].status;

  it("cancelling stamps cancelled_at and frees the slot", async () => {
    const id = await mk(at(FUT, "09:00"));
    await set(id, `status='cancelled', cancelled_by='business'`);
    const r = (await db.query<{ cancelled_at: Date | null; cancelled_by: string }>(`select cancelled_at, cancelled_by from bookings where id=$1`, [id])).rows[0];
    expect(r.cancelled_at).toBeInstanceOf(Date);
    expect(r.cancelled_by).toBe("business");
    await mk(at(FUT, "09:00")); // the same time can now be booked again
  });

  it("only allows the defined status changes", async () => {
    const id = await mk(at(FUT, "11:00"));
    await set(id, `status='cancelled'`);
    await expect(set(id, `status='confirmed'`)).rejects.toThrow(/invalid_booking_transition/); // cancelled is final
    const hold = await mk(at(FUT, "12:30"), "pending_payment");
    await set(hold, `status='confirmed'`);
    expect(await status(hold)).toBe("confirmed");
    await expect(set(hold, `status='pending_payment'`)).rejects.toThrow(/invalid_booking_transition/);
    await expect(set(hold, `status='expired'`)).rejects.toThrow(/invalid_booking_transition/);
  });

  it("no-show only after the start time, and can be undone", async () => {
    const future = await mk(at(FUT, "14:30"));
    await expect(set(future, `status='no_show'`)).rejects.toThrow(/after it starts/);
    const past = await mk(at(PAST, "10:00"));
    await set(past, `status='no_show'`);
    expect(await status(past)).toBe("no_show");
    await set(past, `status='confirmed'`);
    expect(await status(past)).toBe("confirmed");
  });

  it("reschedules upcoming bookings, resets the reminder, and the constraint still applies", async () => {
    const a = await mk(at(FUT, "16:00"));
    await db.query(`update bookings set reminder_sent_at=now() where id=$1`, [a]);
    await set(a, `starts_at=$2, ends_at=$2::timestamptz + interval '1 hour'`, [at(FUT, "17:30")]);
    const r = (await db.query<{ reminder_sent_at: Date | null; starts_at: Date }>(`select reminder_sent_at, starts_at from bookings where id=$1`, [a])).rows[0];
    expect(r.reminder_sent_at).toBeNull();
    expect(r.starts_at.toISOString()).toBe(at(FUT, "17:30"));
    const b = await mk(at(FUT, "19:00"));
    await expect(set(b, `starts_at=$2, ends_at=$2::timestamptz + interval '1 hour'`, [at(FUT, "17:45")])).rejects.toThrow(/no_double_booking/);
  });

  it("refuses to move past or cancelled bookings", async () => {
    const past = await mk(at(PAST, "12:00"));
    await expect(set(past, `starts_at=$2`, [at(FUT, "10:00")])).rejects.toThrow(/only upcoming bookings/);
    const gone = await mk(at(FUT, "20:30"));
    await set(gone, `status='cancelled'`);
    await expect(set(gone, `starts_at=$2`, [at(FUT, "21:30")])).rejects.toThrow(/only upcoming bookings/);
  });

  it("applies to the owner's and staff members' own bookings through RLS as well", async () => {
    const id = await mk(at(FUT, "08:00"));
    await as(A, "a@x.com", () => db.query(`update bookings set status='cancelled', cancelled_by='business' where id=$1`, [id]));
    expect(await status(id)).toBe("cancelled");
    const other = await mk(at(FUT, "08:00"));
    const res = await as(B, "b@x.com", () => db.query(`update bookings set status='cancelled' where id=$1 returning id`, [other]));
    expect(res.rows).toHaveLength(0); // another business can't touch it
    expect(await status(other)).toBe("confirmed");
  });
});

describe("emails: booking ids, ICS sequence, outbox and customer cancellation", () => {
  const FUT = "2027-06-08"; // Tuesday
  const at = (hhmm: string) => zonedToUtc(FUT, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), "Europe/London").toISOString();
  const asServer = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try { return await fn(); } finally { await db.exec("reset role"); }
  };
  const hash = (t: string) => `decode(md5('${t}'),'hex')`;
  let n = 0;
  const bookingOf = (id: string) => db.query<Record<string, unknown>>(`select * from bookings where id=$1`, [id]).then((r) => r.rows[0]);
  const create = (over: { id?: string; hhmm?: string; token?: string } = {}) => asServer(() => db.query<{ id: string }>(
    `select public.create_booking($1,$2,$3,$4,'Eve',$5,'07700 900123',false,${hash(over.token ?? `em${n}`)},false,15,$6) id`,
    [bizA, svc, staffA, at(over.hhmm ?? "10:00"), `eve${n++}@x.com`, over.id ?? null]));
  const cancelBy = (token: string) => asServer(() => db.query(`select public.customer_cancel_booking(${hash(token)})`));

  beforeAll(async () => {
    await db.query(`update services set price_pence=0, deposit_pence=0 where id=$1`, [svc]);
    await db.query(`delete from staff_services where staff_id=$1`, [staffA]);
    await db.query(`insert into staff_services(business_id,staff_id,service_id) values($1,$2,$3)`, [bizA, staffA, svc]);
  });

  it("uses the booking id supplied by the server", async () => {
    const wanted = "11111111-2222-4333-8444-555555555555";
    expect((await create({ id: wanted, hhmm: "09:00" })).rows[0].id).toBe(wanted);
    expect((await create({ hhmm: "11:00" })).rows[0].id).not.toBe(wanted); // generated when not supplied
  });

  it("bumps ics_sequence on every reschedule and on cancellation", async () => {
    const id = (await create({ hhmm: "13:00" })).rows[0].id;
    expect((await bookingOf(id)).ics_sequence).toBe(0);
    await db.query(`update bookings set starts_at=$2, ends_at=$2::timestamptz + interval '1 hour' where id=$1`, [id, at("14:30")]);
    await db.query(`update bookings set starts_at=$2, ends_at=$2::timestamptz + interval '1 hour' where id=$1`, [id, at("16:00")]);
    expect((await bookingOf(id)).ics_sequence).toBe(2);
    await db.query(`update bookings set status='cancelled', cancelled_by='business' where id=$1`, [id]);
    expect((await bookingOf(id)).ics_sequence).toBe(3);
  });

  it("the outbox allows each email once per booking version, kind and recipient", async () => {
    const id = (await create({ hhmm: "17:00" })).rows[0].id;
    const add = (recipient: string, seq: number, kind = "confirmation") => db.query(
      `insert into booking_notifications(business_id,booking_id,kind,channel,recipient,seq) values($1,$2,$3,'email',$4,$5)`, [bizA, id, kind, recipient, seq]);
    await add("customer", 0);
    await expect(add("customer", 0)).rejects.toThrow(/booking_notifications_once|duplicate key/);
    await add("business", 0);          // another recipient: fine
    await add("customer", 1);          // after a reschedule: fine
    await add("customer", 0, "reminder");
    expect((await db.query(`select 1 from booking_notifications where booking_id=$1`, [id])).rows).toHaveLength(4);
  });

  it("a customer can cancel by token until the window closes (24 hours by default)", async () => {
    const id = (await create({ hhmm: "20:00", token: "tok-ok" })).rows[0].id;
    await cancelBy("tok-ok");
    expect(await bookingOf(id)).toMatchObject({ status: "cancelled", cancelled_by: "customer", ics_sequence: 1 });
    await expect(cancelBy("tok-ok")).rejects.toThrow(/can no longer be cancelled/); // already cancelled
    await expect(cancelBy("no-such-token")).rejects.toThrow(/not found/);
  });

  it("refuses online cancellation inside the window, and the window is configurable", async () => {
    const soon = (await db.query<{ id: string }>(
      `insert into bookings(business_id,staff_id,service_id,customer_id,starts_at,ends_at,status,service_name,duration_minutes,price_pence,cancel_token_hash)
       values($1,$2,$3,$4, now() + interval '5 hours', now() + interval '6 hours','confirmed','Gel',60,0,${hash("tok-soon")}) returning id`,
      [bizA, staffA, svc, cus])).rows[0].id;
    await expect(cancelBy("tok-soon")).rejects.toThrow(/cancellation_window_closed/);
    await db.query(`update businesses set cancellation_window_hours=2 where id=$1`, [bizA]);
    await cancelBy("tok-soon"); // 5 hours ahead is now outside a 2 hour window
    expect((await bookingOf(soon)).status).toBe("cancelled");
    await db.query(`update businesses set cancellation_window_hours=24 where id=$1`, [bizA]);
  });

  it("unpaid holds can always be cancelled, and the function is server-only", async () => {
    const hold = (await db.query<{ id: string }>(
      `insert into bookings(business_id,staff_id,service_id,customer_id,starts_at,ends_at,status,service_name,duration_minutes,price_pence,hold_expires_at,cancel_token_hash)
       values($1,$2,$3,$4, now() + interval '3 hours', now() + interval '4 hours','pending_payment','Gel',60,0, now() + interval '10 minutes',${hash("tok-hold")}) returning id`,
      [bizA, staffA, svc, cus])).rows[0].id;
    await cancelBy("tok-hold");
    expect((await bookingOf(hold)).status).toBe("cancelled");
    await expect(as(A, "a@x.com", () => db.query(`select public.customer_cancel_booking(${hash("x")})`))).rejects.toThrow(/permission denied/);
  });

  it("lets owners update their contact details but not Stripe columns", async () => {
    await as(A, "a@x.com", () => db.query(`update businesses set owner_name='Lily B', phone='07700 900009' where id=$1`, [bizA]));
    expect((await db.query(`select owner_name, phone from businesses where id=$1`, [bizA])).rows[0]).toEqual({ owner_name: "Lily B", phone: "07700 900009" });
    await expect(as(A, "a@x.com", () => db.query(`update businesses set stripe_account_id='acct_1' where id=$1`, [bizA]))).rejects.toThrow(/permission denied/);
  });
});

describe("show_contact_to_customers", () => {
  const S = "00000000-0000-0000-0000-00000000000c";
  it("is on by default and only the owner can change it", async () => {
    expect((await db.query(`select show_contact_to_customers from businesses where id=$1`, [bizA])).rows[0]).toEqual({ show_contact_to_customers: true });
    await as(A, "a@x.com", () => db.query(`update businesses set show_contact_to_customers=false where id=$1`, [bizA]));
    expect((await db.query(`select show_contact_to_customers from businesses where id=$1`, [bizA])).rows[0]).toEqual({ show_contact_to_customers: false });
    const other = await as(B, "b@x.com", () => db.query(`update businesses set show_contact_to_customers=true where id=$1 returning id`, [bizA]));
    expect(other.rows).toHaveLength(0);
    const staffTry = await as(S, "s@x.com", () => db.query(`update businesses set show_contact_to_customers=true where id=$1 returning id`, [bizA]));
    expect(staffTry.rows).toHaveLength(0);
  });
});

describe("customer privacy: erase and withdraw consent", () => {
  const S = "00000000-0000-0000-0000-00000000000c";
  const FUT = "2027-09-07"; // Tuesday
  const at = (hhmm: string) => zonedToUtc(FUT, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), "Europe/London").toISOString();
  const asServer = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try { return await fn(); } finally { await db.exec("reset role"); }
  };
  const hash = (t: string) => `decode(md5('${t}'),'hex')`;
  const newCustomer = async (email: string, consent = true) => (await db.query<{ id: string }>(
    `insert into customers(business_id,name,email,phone,marketing_consent,marketing_consent_at) values($1,'Dana Doe',$2,'07700 900555',$3,case when $3 then now() end) returning id`,
    [bizA, email, consent])).rows[0].id;
  const book = async (customer: string, when: string, status: string, token: string, starts = at(when)) => (await db.query<{ id: string }>(
    `insert into bookings(business_id,staff_id,service_id,customer_id,starts_at,ends_at,status,service_name,duration_minutes,price_pence,cancel_token_hash)
     values($1,$2,$3,$4,$5,$5::timestamptz + interval '1 hour',$6,'Gel',60,3000,${hash(token)}) returning id`, [bizA, staffA, svc, customer, starts, status])).rows[0].id;
  const erase = (uid: string, email: string, id: string) => as(uid, email, () => db.query(`select public.anonymise_customer($1)`, [id]));

  it("removes the person's details but keeps the booking records, and kills their links", async () => {
    const c = await newCustomer("dana@example.com");
    const past = await book(c, "10:00", "completed", "dana-token", "2020-02-04T10:00:00Z");
    await db.query(`insert into booking_notifications(business_id,booking_id,kind,channel,recipient,seq,status,error) values($1,$2,'confirmation','email','customer',0,'failed','550 rejected: dana@example.com')`, [bizA, past]);

    await erase(A, "a@x.com", c);

    expect((await db.query(`select name,email,phone,marketing_consent,marketing_consent_at,anonymised_at is not null as gone from customers where id=$1`, [c])).rows[0])
      .toEqual({ name: "Deleted customer", email: null, phone: null, marketing_consent: false, marketing_consent_at: null, gone: true });
    expect((await db.query(`select service_name, price_pence, status from bookings where id=$1`, [past])).rows[0]).toEqual({ service_name: "Gel", price_pence: 3000, status: "completed" });
    expect((await db.query(`select 1 from bookings where cancel_token_hash=${hash("dana-token")}`)).rows).toHaveLength(0); // old link no longer finds it
    expect((await db.query(`select error from booking_notifications where booking_id=$1`, [past])).rows[0]).toEqual({ error: null });
  });

  it("is refused while the customer has upcoming bookings, and works once they are cancelled", async () => {
    const c = await newCustomer("erin@example.com");
    const up = await book(c, "10:00", "confirmed", "erin-token");
    await expect(erase(A, "a@x.com", c)).rejects.toThrow(/customer_has_upcoming_bookings/);
    expect((await db.query(`select anonymised_at from customers where id=$1`, [c])).rows[0]).toEqual({ anonymised_at: null });
    await db.query(`update bookings set status='cancelled', cancelled_by='business' where id=$1`, [up]);
    await erase(A, "a@x.com", c);
    expect((await db.query(`select email from customers where id=$1`, [c])).rows[0]).toEqual({ email: null });
  });

  it("is owner-only, and gives the same answer for other businesses' customers", async () => {
    const c = await newCustomer("fay@example.com");
    await expect(erase(B, "b@x.com", c)).rejects.toThrow(/customer not found/);
    await expect(erase(S, "s@x.com", c)).rejects.toThrow(/customer not found/);
    await expect(erase(A, "a@x.com", "00000000-0000-4000-8000-00000000dead")).rejects.toThrow(/customer not found/);
    await expect(asServer(() => db.query(`select public.anonymise_customer($1)`, [c]))).rejects.toThrow(/permission denied|not found/); // not callable as the server role either
    expect((await db.query(`select email from customers where id=$1`, [c])).rows[0]).toEqual({ email: "fay@example.com" });
  });

  it("can be repeated safely, and the email address can be used again afterwards", async () => {
    const c = await newCustomer("gus@example.com");
    await erase(A, "a@x.com", c);
    await erase(A, "a@x.com", c); // second time: nothing happens
    const again = await newCustomer("gus@example.com"); // the unique email is free again
    expect(again).not.toBe(c);
  });

  it("records a withdrawal of marketing consent, for owners only", async () => {
    const c = await newCustomer("hal@example.com", true);
    await expect(as(S, "s@x.com", () => db.query(`select public.withdraw_marketing_consent($1)`, [c]))).rejects.toThrow(/customer not found/);
    await expect(as(B, "b@x.com", () => db.query(`select public.withdraw_marketing_consent($1)`, [c]))).rejects.toThrow(/customer not found/);
    await as(A, "a@x.com", () => db.query(`select public.withdraw_marketing_consent($1)`, [c]));
    expect((await db.query(`select marketing_consent, marketing_consent_at from customers where id=$1`, [c])).rows[0]).toEqual({ marketing_consent: false, marketing_consent_at: null });
  });
});

describe("deposit payments (Stripe webhook functions)", () => {
  const FUT = "2027-10-05"; // Tuesday
  const at = (hhmm: string) => zonedToUtc(FUT, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)), "Europe/London").toISOString();
  const asServer = async <T,>(fn: () => Promise<T>) => {
    await db.exec("set role service_role");
    try { return await fn(); } finally { await db.exec("reset role"); }
  };
  let n = 0;
  const hold = async (hhmm: string, status = "pending_payment") => {
    const i = n++;
    return (await db.query<{ id: string }>(
      `insert into bookings(business_id,staff_id,service_id,customer_id,starts_at,ends_at,status,service_name,duration_minutes,price_pence,deposit_pence,deposit_status,hold_expires_at,stripe_checkout_session_id,cancel_token_hash)
       values($1,$2,$3,$4,$5,$5::timestamptz + interval '1 hour',$6,'Gel',60,3000,1000,'pending', now() + interval '30 minutes',$7, decode(md5($8),'hex')) returning id`,
      [bizA, staffA, svc, cus, at(hhmm), status, `cs_test_${i}`, `dep${i}`])).rows[0].id;
  };
  const apply = (session: string, pi = "pi_1") => asServer(() => db.query<{ r: string }>(`select public.apply_deposit_payment($1,$2) r`, [session, pi])).then((r) => r.rows[0].r);
  const row = async (id: string) => (await db.query<Record<string, unknown>>(`select status, deposit_status, stripe_payment_intent_id, hold_expires_at, stripe_refund_id from bookings where id=$1`, [id])).rows[0];
  const settle = (id: string, outcome: string, refund: string | null = null) => asServer(() => db.query(`select public.record_deposit_outcome($1,$2,$3)`, [id, outcome, refund]));

  it("confirms a held booking when the payment arrives, once", async () => {
    const id = await hold("09:00");
    expect(await apply(`cs_test_${n - 1}`, "pi_a")).toBe("confirmed");
    expect(await row(id)).toMatchObject({ status: "confirmed", deposit_status: "paid", stripe_payment_intent_id: "pi_a", hold_expires_at: null });
    expect(await apply(`cs_test_${n - 1}`, "pi_a")).toBe("already_paid"); // the same webhook delivered twice
    expect(await apply("cs_unknown")).toBe("not_found");
  });

  it("a payment that arrives after the hold expired or the booking was cancelled needs a refund", async () => {
    const late = await hold("11:00");
    await db.query(`update bookings set status='expired' where id=$1`, [late]);
    expect(await apply(`cs_test_${n - 1}`, "pi_late")).toBe("needs_refund");
    expect(await row(late)).toMatchObject({ status: "expired", deposit_status: "paid", stripe_payment_intent_id: "pi_late" });
    await settle(late, "refunded", "re_1");
    expect(await row(late)).toMatchObject({ deposit_status: "refunded", stripe_refund_id: "re_1" });
  });

  it("settles a paid deposit once: refunded or kept; nothing to settle if unpaid", async () => {
    const id = await hold("13:00");
    await expect(settle(id, "refunded")).rejects.toThrow(/deposit_not_paid/);
    await apply(`cs_test_${n - 1}`, "pi_b");
    await settle(id, "retained");
    expect((await row(id)).deposit_status).toBe("retained");
    await settle(id, "retained"); // repeat is fine
    await expect(settle(id, "refunded")).rejects.toThrow(/deposit_not_paid/); // already settled differently
    await expect(settle(id, "maybe")).rejects.toThrow(/invalid outcome/);
  });

  it("is server-only", async () => {
    await expect(as(A, "a@x.com", () => db.query(`select public.apply_deposit_payment('x','y')`))).rejects.toThrow(/permission denied/);
    await expect(as(A, "a@x.com", () => db.query(`select public.record_deposit_outcome($1,'refunded')`, [bizA]))).rejects.toThrow(/permission denied/);
  });
});
