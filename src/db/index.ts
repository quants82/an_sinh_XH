import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { DEFAULT_SUPPORT_GROUPS, DEFAULT_VILLAGES } from "@/lib/constants";
import path from "path";
import fs from "fs";

type DbInstance = ReturnType<typeof drizzlePg<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __db?: DbInstance;
  __initPromise?: Promise<void>;
};

function createDb(): DbInstance {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
    return drizzlePg(pool, { schema });
  }

  // Fallback local PostgreSQL nhúng (PGlite) để chạy & kiểm thử ngay trên máy cá nhân
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  return drizzlePglite(client, { schema }) as unknown as DbInstance;
}

function getDbInstance(): DbInstance {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb();
  }
  return globalForDb.__db;
}

export const db: DbInstance = new Proxy({} as DbInstance, {
  get(_target, prop, receiver) {
    const instance = getDbInstance() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    commune_name TEXT NOT NULL DEFAULT 'Xã Bình An',
    commune_code TEXT NOT NULL DEFAULT 'BA',
    require_drive_to_save BOOLEAN NOT NULL DEFAULT FALSE,
    drive_connected BOOLEAN NOT NULL DEFAULT FALSE,
    drive_email TEXT,
    drive_encrypted_refresh_token TEXT,
    drive_root_folder_id TEXT,
    drive_evidence_folder_id TEXT,
    drive_programs_folder_id TEXT,
    drive_reports_folder_id TEXT,
    drive_backup_folder_id TEXT,
    duplicate_check_months INTEGER NOT NULL DEFAULT 3,
    small_support_max INTEGER NOT NULL DEFAULT 500000,
    medium_support_max INTEGER NOT NULL DEFAULT 2000000,
    small_support_penalty INTEGER NOT NULL DEFAULT 5,
    large_support_penalty INTEGER NOT NULL DEFAULT 10,
    yearly_warning_threshold INTEGER NOT NULL DEFAULT 3,
    last_backup_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS villages (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    role TEXT NOT NULL,
    village_id INTEGER REFERENCES villages(id),
    password_hash TEXT NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS support_groups (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    base_score INTEGER NOT NULL DEFAULT 5,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_phase2_optional BOOLEAN NOT NULL DEFAULT FALSE,
    is_temporary_default BOOLEAN NOT NULL DEFAULT FALSE,
    default_duration_months INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
  )`,
  `CREATE TABLE IF NOT EXISTS citizens (
    id SERIAL PRIMARY KEY,
    citizen_code TEXT NOT NULL UNIQUE,
    record_type TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    full_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    birth_year INTEGER NOT NULL,
    gender TEXT NOT NULL DEFAULT 'KHAC',
    village_id INTEGER NOT NULL REFERENCES villages(id),
    address_detail TEXT NOT NULL DEFAULT '',
    phone TEXT,
    guardian_note TEXT,
    hardship_summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    local_bonus_score INTEGER NOT NULL DEFAULT 0,
    local_bonus_reason TEXT,
    temp_expires_at TIMESTAMP,
    created_by_id INTEGER REFERENCES users(id),
    updated_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS citizen_groups (
    id SERIAL PRIMARY KEY,
    citizen_id INTEGER NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES support_groups(id),
    expires_at TIMESTAMP,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS support_programs (
    id SERIAL PRIMARY KEY,
    program_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    occasion_key TEXT NOT NULL,
    donor_name TEXT NOT NULL,
    support_kind TEXT NOT NULL DEFAULT 'GIFT',
    unit_value INTEGER NOT NULL DEFAULT 500000,
    tier TEXT NOT NULL DEFAULT 'SMALL',
    total_slots INTEGER NOT NULL DEFAULT 20,
    filter_group_ids_json TEXT NOT NULL DEFAULT '[]',
    filter_village_ids_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    locked_by_id INTEGER REFERENCES users(id),
    locked_at TIMESTAMP,
    approved_by_id INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    created_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS evidence_files (
    id SERIAL PRIMARY KEY,
    citizen_id INTEGER REFERENCES citizens(id) ON DELETE CASCADE,
    program_id INTEGER REFERENCES support_programs(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    drive_file_id TEXT NOT NULL,
    uploaded_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS support_allocations (
    id SERIAL PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES support_programs(id) ON DELETE CASCADE,
    citizen_id INTEGER NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    allocation_type TEXT NOT NULL,
    base_score INTEGER NOT NULL DEFAULT 0,
    bonus_score INTEGER NOT NULL DEFAULT 0,
    penalty_score INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    received_count_this_year INTEGER NOT NULL DEFAULT 0,
    received_in_window BOOLEAN NOT NULL DEFAULT FALSE,
    warning_flag TEXT NOT NULL DEFAULT 'NONE',
    warning_message TEXT,
    leader_exception_approved BOOLEAN NOT NULL DEFAULT FALSE,
    exception_reason TEXT,
    is_delivered BOOLEAN NOT NULL DEFAULT FALSE,
    delivered_at TIMESTAMP,
    delivered_support_kind TEXT,
    delivered_gift_details TEXT,
    delivered_value_vnd INTEGER,
    delivery_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS support_history (
    id SERIAL PRIMARY KEY,
    citizen_id INTEGER NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    program_id INTEGER REFERENCES support_programs(id) ON DELETE SET NULL,
    program_code TEXT NOT NULL,
    program_title TEXT NOT NULL,
    occasion_key TEXT NOT NULL,
    donor_name TEXT NOT NULL,
    support_kind TEXT NOT NULL,
    gift_details TEXT NOT NULL DEFAULT '',
    value_vnd INTEGER NOT NULL,
    tier TEXT NOT NULL,
    note TEXT,
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    recorded_by_id INTEGER REFERENCES users(id)
  )`,
  `ALTER TABLE support_allocations ADD COLUMN IF NOT EXISTS delivered_support_kind TEXT`,
  `ALTER TABLE support_allocations ADD COLUMN IF NOT EXISTS delivered_gift_details TEXT`,
  `ALTER TABLE support_allocations ADD COLUMN IF NOT EXISTS delivered_value_vnd INTEGER`,
  `ALTER TABLE support_allocations ADD COLUMN IF NOT EXISTS delivery_note TEXT`,
  `ALTER TABLE support_history ADD COLUMN IF NOT EXISTS gift_details TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE support_history ADD COLUMN IF NOT EXISTS note TEXT`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    task_type TEXT NOT NULL DEFAULT 'OTHER',
    village_id INTEGER REFERENCES villages(id),
    assigned_to_id INTEGER NOT NULL REFERENCES users(id),
    assigned_by_id INTEGER NOT NULL REFERENCES users(id),
    due_date TIMESTAMP,
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'NEW',
    completion_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS citizen_changes (
    id SERIAL PRIMARY KEY,
    citizen_id INTEGER NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    actor_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id),
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
];

async function runInit(): Promise<void> {
  const { eq, sql } = await import("drizzle-orm");

  // Fast path: chỉ chạy 1 truy vấn kiểm tra nếu bảng & dữ liệu nền đã sẵn sàng
  try {
    const probe = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM support_groups) AS gcnt,
        (SELECT COUNT(*)::int FROM villages WHERE name ~ '^Thôn [0-9]+$') AS oldv,
        (SELECT EXISTS (SELECT 1 FROM system_settings)) AS has_settings
    `);
    const row = (
      probe as {
        rows?: Array<{ gcnt?: number; oldv?: number; has_settings?: boolean }>;
      }
    ).rows?.[0];
    if (
      row &&
      Number(row.gcnt) >= DEFAULT_SUPPORT_GROUPS.length &&
      Number(row.oldv) === 0 &&
      row.has_settings
    ) {
      return;
    }
  } catch {
    // Bảng chưa tồn tại -> chạy DDL khởi tạo bên dưới
  }

  for (const ddl of DDL_STATEMENTS) {
    await db.execute(sql.raw(ddl));
  }

  // Seed default system settings if empty
  const existingSettings = await db.select().from(schema.systemSettings).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(schema.systemSettings).values({
      communeName: "Xã Bình An",
      communeCode: "BA",
      requireDriveToSave: false,
      driveConnected: false,
    });
  }

  // Seed default villages or migrate untouched placeholder names ("Thôn 1".."Thôn 17")
  const existingVillages = await db.select().from(schema.villages);
  if (existingVillages.length === 0) {
    await db.insert(schema.villages).values(DEFAULT_VILLAGES);
  } else {
    const byCode = new Map(existingVillages.map((v) => [v.code, v]));
    for (const defV of DEFAULT_VILLAGES) {
      const cur = byCode.get(defV.code);
      if (!cur) {
        await db.insert(schema.villages).values(defV).onConflictDoNothing();
      } else if (/^Thôn \d+$/.test(cur.name.trim())) {
        await db
          .update(schema.villages)
          .set({ name: defV.name, isActive: defV.isActive, sortOrder: defV.sortOrder })
          .where(eq(schema.villages.id, cur.id));
      }
    }
  }

  // Ensure all canonical/NĐ 176/20/335 support groups exist in 1 batch query
  await db
    .insert(schema.supportGroups)
    .values(DEFAULT_SUPPORT_GROUPS)
    .onConflictDoNothing();
}

export async function ensureDbReady(): Promise<void> {
  if (!globalForDb.__initPromise) {
    globalForDb.__initPromise = runInit().catch((err) => {
      globalForDb.__initPromise = undefined;
      throw err;
    });
  }
  await globalForDb.__initPromise;
}
