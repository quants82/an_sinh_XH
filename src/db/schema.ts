import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  communeName: text("commune_name").notNull().default("Xã Bình An"),
  communeCode: text("commune_code").notNull().default("BA"),
  requireDriveToSave: boolean("require_drive_to_save").notNull().default(false),
  driveConnected: boolean("drive_connected").notNull().default(false),
  driveEmail: text("drive_email"),
  driveEncryptedRefreshToken: text("drive_encrypted_refresh_token"),
  driveRootFolderId: text("drive_root_folder_id"),
  driveEvidenceFolderId: text("drive_evidence_folder_id"),
  driveProgramsFolderId: text("drive_programs_folder_id"),
  driveReportsFolderId: text("drive_reports_folder_id"),
  driveBackupFolderId: text("drive_backup_folder_id"),
  duplicateCheckMonths: integer("duplicate_check_months").notNull().default(3),
  smallSupportMax: integer("small_support_max").notNull().default(500000),
  mediumSupportMax: integer("medium_support_max").notNull().default(2000000),
  smallSupportPenalty: integer("small_support_penalty").notNull().default(5),
  largeSupportPenalty: integer("large_support_penalty").notNull().default(10),
  yearlyWarningThreshold: integer("yearly_warning_threshold").notNull().default(3),
  customSupportKindsJson: text("custom_support_kinds_json").notNull().default("[]"),
  lastBackupAt: timestamp("last_backup_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const villages = pgTable("villages", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull(),
  unitName: text("unit_name").notNull(),
  role: text("role").notNull(), // OWNER | LEADER | DEPT_HEAD | STAFF | VILLAGE_HEAD | AUDITOR
  villageId: integer("village_id").references(() => villages.id),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supportGroups = pgTable("support_groups", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  baseScore: integer("base_score").notNull().default(5),
  sortOrder: integer("sort_order").notNull().default(0),
  isPhase2Optional: boolean("is_phase2_optional").notNull().default(false),
  isTemporaryDefault: boolean("is_temporary_default").notNull().default(false),
  defaultDurationMonths: integer("default_duration_months"),
  isActive: boolean("is_active").notNull().default(true),
});

export const citizens = pgTable("citizens", {
  id: serial("id").primaryKey(),
  citizenCode: text("citizen_code").notNull().unique(),
  recordType: text("record_type").notNull().default("INDIVIDUAL"), // INDIVIDUAL | HOUSEHOLD_DISASTER
  fullName: text("full_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  birthYear: integer("birth_year").notNull(),
  gender: text("gender").notNull().default("KHAC"),
  villageId: integer("village_id")
    .notNull()
    .references(() => villages.id),
  addressDetail: text("address_detail").notNull().default(""),
  phone: text("phone"),
  guardianNote: text("guardian_note"),
  hardshipSummary: text("hardship_summary").notNull().default(""),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE | TEMPORARY | PENDING_REVIEW | ENDED | MOVED_OUT | DECEASED
  localBonusScore: integer("local_bonus_score").notNull().default(0),
  localBonusReason: text("local_bonus_reason"),
  tempExpiresAt: timestamp("temp_expires_at"),
  createdById: integer("created_by_id").references(() => users.id),
  updatedById: integer("updated_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const citizenGroups = pgTable("citizen_groups", {
  id: serial("id").primaryKey(),
  citizenId: integer("citizen_id")
    .notNull()
    .references(() => citizens.id, { onDelete: "cascade" }),
  groupId: integer("group_id")
    .notNull()
    .references(() => supportGroups.id),
  expiresAt: timestamp("expires_at"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportPrograms = pgTable("support_programs", {
  id: serial("id").primaryKey(),
  programCode: text("program_code").notNull().unique(),
  title: text("title").notNull(),
  occasionKey: text("occasion_key").notNull(),
  donorName: text("donor_name").notNull(),
  supportKind: text("support_kind").notNull().default("GIFT"), // CASH | GIFT | SCHOLARSHIP | OTHER
  unitValue: integer("unit_value").notNull().default(500000),
  tier: text("tier").notNull().default("SMALL"), // SMALL | MEDIUM | LARGE
  totalSlots: integer("total_slots").notNull().default(20),
  filterGroupIdsJson: text("filter_group_ids_json").notNull().default("[]"),
  filterVillageIdsJson: text("filter_village_ids_json").notNull().default("[]"),
  status: text("status").notNull().default("DRAFT"), // DRAFT | PENDING_APPROVAL | LOCKED | APPROVED | REOPENED
  lockedById: integer("locked_by_id").references(() => users.id),
  lockedAt: timestamp("locked_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evidenceFiles = pgTable("evidence_files", {
  id: serial("id").primaryKey(),
  citizenId: integer("citizen_id").references(() => citizens.id, {
    onDelete: "cascade",
  }),
  programId: integer("program_id").references(() => supportPrograms.id, {
    onDelete: "cascade",
  }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  driveFileId: text("drive_file_id").notNull(),
  uploadedById: integer("uploaded_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportAllocations = pgTable("support_allocations", {
  id: serial("id").primaryKey(),
  programId: integer("program_id")
    .notNull()
    .references(() => supportPrograms.id, { onDelete: "cascade" }),
  citizenId: integer("citizen_id")
    .notNull()
    .references(() => citizens.id, { onDelete: "cascade" }),
  allocationType: text("allocation_type").notNull(), // PRIMARY | RESERVE_SECOND_ROUND | EXCLUDED
  baseScore: integer("base_score").notNull().default(0),
  bonusScore: integer("bonus_score").notNull().default(0),
  penaltyScore: integer("penalty_score").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  receivedCountThisYear: integer("received_count_this_year").notNull().default(0),
  receivedInWindow: boolean("received_in_window").notNull().default(false),
  warningFlag: text("warning_flag").notNull().default("NONE"),
  warningMessage: text("warning_message"),
  leaderExceptionApproved: boolean("leader_exception_approved").notNull().default(false),
  exceptionReason: text("exception_reason"),
  isDelivered: boolean("is_delivered").notNull().default(false),
  deliveredAt: timestamp("delivered_at"),
  deliveredSupportKind: text("delivered_support_kind"),
  deliveredGiftDetails: text("delivered_gift_details"),
  deliveredValueVnd: integer("delivered_value_vnd"),
  deliveryNote: text("delivery_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportHistory = pgTable("support_history", {
  id: serial("id").primaryKey(),
  citizenId: integer("citizen_id")
    .notNull()
    .references(() => citizens.id, { onDelete: "cascade" }),
  programId: integer("program_id").references(() => supportPrograms.id, {
    onDelete: "set null",
  }),
  programCode: text("program_code").notNull(),
  programTitle: text("program_title").notNull(),
  occasionKey: text("occasion_key").notNull(),
  donorName: text("donor_name").notNull(),
  supportKind: text("support_kind").notNull(),
  giftDetails: text("gift_details").notNull().default(""),
  valueVnd: integer("value_vnd").notNull(),
  tier: text("tier").notNull(),
  note: text("note"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  recordedById: integer("recorded_by_id").references(() => users.id),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  taskType: text("task_type").notNull().default("OTHER"), // REVIEW_6_MONTHS | VERIFY_DISASTER | UPDATE_EXPIRED_TEMP | PREPARE_PROGRAM | OTHER
  villageId: integer("village_id").references(() => villages.id),
  assignedToId: integer("assigned_to_id")
    .notNull()
    .references(() => users.id),
  assignedById: integer("assigned_by_id")
    .notNull()
    .references(() => users.id),
  dueDate: timestamp("due_date"),
  priority: text("priority").notNull().default("MEDIUM"), // LOW | MEDIUM | HIGH | URGENT
  status: text("status").notNull().default("NEW"), // NEW | IN_PROGRESS | SUBMITTED | DONE | RETURNED
  completionNote: text("completion_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const citizenChanges = pgTable("citizen_changes", {
  id: serial("id").primaryKey(),
  citizenId: integer("citizen_id")
    .notNull()
    .references(() => citizens.id, { onDelete: "cascade" }),
  changeType: text("change_type").notNull(),
  summary: text("summary").notNull(),
  actorId: integer("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
