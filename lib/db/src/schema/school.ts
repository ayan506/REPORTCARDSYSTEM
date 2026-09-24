import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "school_users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("teacher"),
    assignedClasses: jsonb("assigned_classes").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({ usernameIdx: uniqueIndex("school_users_username_idx").on(table.username) }),
);

export const academicSessionsTable = pgTable("academic_sessions", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  status: text("status").notNull().default("upcoming"),
  studentCount: integer("student_count").notNull().default(0),
  completedCount: integer("completed_count").notNull().default(0),
  readOnly: boolean("read_only").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => academicSessionsTable.id),
  name: text("name").notNull(),
  fatherName: text("father_name").notNull(),
  motherName: text("mother_name").notNull(),
  srNumber: text("sr_number").notNull(),
  admissionNumber: text("admission_number").notNull().default(""),
  rollNumber: text("roll_number").notNull(),
  dob: text("dob").notNull().default(""),
  address: text("address").notNull().default(""),
  className: text("class_name").notNull(),
  section: text("section").notNull(),
  photoPath: text("photo_path"),
  status: text("status").notNull().default("pending"),
  percentage: real("percentage"),
  position: integer("position"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marksheetsTable = pgTable("marksheets", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  rows: jsonb("rows").$type<unknown[]>().notNull().default([]),
  attendance: text("attendance").notNull().default(""),
  conduct: text("conduct").notNull().default(""),
  totalObtained: real("total_obtained").notNull().default(0),
  totalMaximum: real("total_maximum").notNull().default(0),
  percentage: real("percentage").notNull().default(0),
  grade: text("grade").notNull().default(""),
  resultStatus: text("result_status").notNull().default("Pending"),
  position: integer("position").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reportTemplatesTable = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  backgroundPath: text("background_path").notNull(),
  width: real("width").notNull(),
  height: real("height").notNull(),
  fields: jsonb("fields").$type<unknown[]>().notNull().default([]),
  active: boolean("active").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogsTable = pgTable("school_audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id"),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolSettingsTable = pgTable("school_settings", {
  id: serial("id").primaryKey(),
  settings: jsonb("settings").$type<Record<string, string | number>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertAcademicSessionSchema = createInsertSchema(academicSessionsTable).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export const insertMarksheetSchema = createInsertSchema(marksheetsTable).omit({ id: true, updatedAt: true });
export const insertReportTemplateSchema = createInsertSchema(reportTemplatesTable).omit({ id: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export const insertSchoolSettingsSchema = createInsertSchema(schoolSettingsTable).omit({ id: true, updatedAt: true });

export type User = typeof usersTable.$inferSelect;
export type AcademicSession = typeof academicSessionsTable.$inferSelect;
export type Student = typeof studentsTable.$inferSelect;
export type Marksheet = typeof marksheetsTable.$inferSelect;
export type ReportTemplate = typeof reportTemplatesTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type SchoolSettings = typeof schoolSettingsTable.$inferSelect;
export type OverlayField = {
  id: string;
  label: string;
  source: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  align: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  fontWeight: "normal" | "bold";
  visible?: boolean;
  color?: string;
};
export type MarkRow = {
  subject: string;
  quarterlyOne: number;
  halfYearly: number;
  quarterlyTwo: number;
  annual: number;
  maxQuarterlyOne?: number;
  maxHalfYearly?: number;
  maxQuarterlyTwo?: number;
  maxAnnual?: number;
};