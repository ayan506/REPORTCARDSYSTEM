import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  academicSessionsTable,
  auditLogsTable,
  marksheetsTable,
  reportTemplatesTable,
  schoolSettingsTable,
  studentsTable,
  usersTable,
  type MarkRow,
  type OverlayField,
  type User,
} from "@workspace/db";
import {
  CreateStudentBody,
  CreateTeacherBody,
  CreateTemplateBody,
  GetPublicResultParams,
  GetPublicResultResponse,
  GetCurrentUserResponse,
  GetDashboardSummaryQueryParams,
  GetDashboardSummaryResponse,
  GetHistoricalRecordsParams,
  GetHistoricalRecordsResponse,
  GetStudentMarksParams,
  GetStudentMarksResponse,
  ListStudentsQueryParams,
  ListStudentsResponse,
  ListTeachersResponse,
  UpdateTeacherAssignmentBody,
  UpdateTeacherAssignmentParams,
  UpdateTeacherAssignmentResponse,
  ListSessionsResponse,
  ListTemplatesResponse,
  LoginBody,
  LoginResponse,
  PromoteStudentsBody,
  PromoteStudentsParams,
  PromoteStudentsResponse,
  SaveStudentMarksBody,
  SaveStudentMarksParams,
  SaveStudentMarksResponse,
  StartAcademicSessionBody,
  StartAcademicSessionResponse,
  UpdateStudentBody,
  UpdateStudentParams,
  UpdateStudentResponse,
  GetSchoolSettingsResponse,
  UpdateSchoolSettingsBody,
  UpdateSchoolSettingsResponse,
  UpdateTemplateBody,
  UpdateTemplateParams,
} from "@workspace/api-zod";

const router: IRouter = Router();
const sessionStore = new Map<string, number>();

const DEFAULT_SUBJECTS = [
  "HINDI",
  "URDU / SANSKRIT",
  "ENGLISH",
  "MATHS",
  "SCIENCE",
  "SOCIAL STUDIES",
  "G.K.",
  "COMPUTER",
  "CONV. / ENG. WRITING",
  "DRAWING",
];

const DEFAULT_SETTINGS = {
  schoolName: "M.N.I. Higher Secondary School",
  udiseCode: "09681301007",
  establishedYear: "2009",
  address: "Hatim Sarai, Sambhal – 244302 (U.P.)",
  logoPath: "/assets/school-logo.jpeg",
  reportDate: "31 March 2026",
  passPercentage: 50,
  firstMinimum: 90,
  secondMinimum: 80,
  thirdMinimum: 70,
  qrColor: "#122552",
  marksColor: "#122552",
};

type SchoolSettingsPayload = typeof DEFAULT_SETTINGS;

function settingsPayload(settings?: Record<string, unknown>): SchoolSettingsPayload {
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) } as SchoolSettingsPayload;
}

async function getSchoolSettings(): Promise<SchoolSettingsPayload> {
  const [row] = await db.select().from(schoolSettingsTable).limit(1);
  return settingsPayload(row?.settings);
}

function defaultMarkRows(): MarkRow[] {
  return DEFAULT_SUBJECTS.map((subject) => ({
    subject,
    quarterlyOne: 0,
    halfYearly: 0,
    quarterlyTwo: 0,
    annual: 0,
    maxQuarterlyOne: 20,
    maxHalfYearly: 80,
    maxQuarterlyTwo: 20,
    maxAnnual: 80,
  }));
}

function hashPassword(password: string): string {
  const salt = "mnihs-school-salt";
  return scryptSync(password, salt, 32).toString("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  const actual = Buffer.from(hashPassword(password), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function currentUserPayload(user: User) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role === "principal" ? ("principal" as const) : ("teacher" as const),
    assignedClasses: (user.assignedClasses ?? []) as string[],
  };
}

function classKey(className: string, section: string): string {
  return `${className}-${section}`;
}

function toStudentPayload(student: typeof studentsTable.$inferSelect) {
  return {
    id: student.id,
    sessionId: student.sessionId,
    name: student.name,
    fatherName: student.fatherName,
    motherName: student.motherName,
    srNumber: student.srNumber,
    admissionNumber: student.admissionNumber,
    rollNumber: student.rollNumber,
    dob: student.dob,
    address: student.address,
    className: student.className,
    section: student.section,
    photoPath: student.photoPath,
    status: student.status === "completed" ? ("completed" as const) : ("pending" as const),
    percentage: student.percentage,
    position: student.position,
    qrCode: `mnihs-result-${student.id}`,
  };
}

function toSessionPayload(session: typeof academicSessionsTable.$inferSelect) {
  return {
    id: session.id,
    label: session.label,
    status: session.status === "active"
      ? ("active" as const)
      : session.status === "archived"
        ? ("archived" as const)
        : ("upcoming" as const),
    studentCount: session.studentCount,
    completedCount: session.completedCount,
    readOnly: session.readOnly,
    archivedAt: session.archivedAt?.toISOString() ?? null,
  };
}

function toTemplatePayload(template: typeof reportTemplatesTable.$inferSelect) {
  return {
    id: template.id,
    name: template.name,
    backgroundPath: template.backgroundPath,
    width: template.width,
    height: template.height,
    fields: template.fields as OverlayField[],
    active: template.active,
    updatedAt: template.updatedAt.toISOString(),
  };
}

function toTeacherPayload(user: User) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    assignedClasses: (user.assignedClasses ?? []) as string[],
    status: user.active ? ("active" as const) : ("inactive" as const),
  };
}

function templateFields(): OverlayField[] {
  const fields: OverlayField[] = [
    { id: "student-name", label: "Student name", source: "student.name", x: 156, y: 145, width: 337, height: 22, fontSize: 15, fontFamily: "Arial", align: "left", verticalAlign: "bottom", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "father-name", label: "Father's name", source: "student.fatherName", x: 151, y: 175, width: 342, height: 22, fontSize: 15, fontFamily: "Arial", align: "left", verticalAlign: "bottom", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "mother-name", label: "Mother's name", source: "student.motherName", x: 157, y: 205, width: 336, height: 22, fontSize: 15, fontFamily: "Arial", align: "left", verticalAlign: "bottom", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "sr-number", label: "S.R. number", source: "student.srNumber", x: 588, y: 145, width: 133, height: 22, fontSize: 15, fontFamily: "Arial", align: "left", verticalAlign: "bottom", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "dob", label: "Date of birth", source: "student.dob", x: 790, y: 145, width: 178, height: 22, fontSize: 15, fontFamily: "Arial", align: "left", verticalAlign: "bottom", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "class", label: "Class", source: "student.className", x: 575, y: 175, width: 112, height: 22, fontSize: 15, fontFamily: "Arial", align: "left", verticalAlign: "bottom", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "section", label: "Section", source: "student.section", x: 735, y: 175, width: 53, height: 22, fontSize: 15, fontFamily: "Arial", align: "center", verticalAlign: "bottom", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "roll", label: "Roll number", source: "student.rollNumber", x: 870, y: 175, width: 98, height: 22, fontSize: 15, fontFamily: "Arial", align: "center", verticalAlign: "bottom", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "address", label: "Address", source: "student.address", x: 584, y: 205, width: 384, height: 22, fontSize: 14, fontFamily: "Arial", align: "left", verticalAlign: "bottom", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "attendance", label: "Attendance", source: "marks.attendance", x: 49, y: 650, width: 96, height: 22, fontSize: 13, fontFamily: "Arial", align: "center", verticalAlign: "middle", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "conduct", label: "Conduct", source: "marks.conduct", x: 170, y: 650, width: 95, height: 22, fontSize: 13, fontFamily: "Arial", align: "center", verticalAlign: "middle", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "percentage", label: "Percentage", source: "marks.percentage", x: 309, y: 650, width: 97, height: 22, fontSize: 13, fontFamily: "Arial", align: "center", verticalAlign: "middle", fontWeight: "bold", visible: true, color: "#161616" },
    { id: "position", label: "Position", source: "marks.position", x: 444, y: 650, width: 60, height: 22, fontSize: 13, fontFamily: "Arial", align: "center", verticalAlign: "middle", fontWeight: "bold", visible: true, color: "#161616" },
    { id: "guardian-signature", label: "Guardian signature", source: "signatures.guardian", x: 541, y: 650, width: 116, height: 22, fontSize: 12, fontFamily: "Arial", align: "center", verticalAlign: "middle", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "teacher-signature", label: "Class teacher signature", source: "signatures.teacher", x: 674, y: 650, width: 132, height: 22, fontSize: 12, fontFamily: "Arial", align: "center", verticalAlign: "middle", fontWeight: "normal", visible: true, color: "#161616" },
    { id: "principal-signature", label: "Principal signature", source: "signatures.principal", x: 839, y: 650, width: 135, height: 22, fontSize: 12, fontFamily: "Arial", align: "center", verticalAlign: "middle", fontWeight: "normal", visible: true, color: "#161616" },
  ];
  DEFAULT_SUBJECTS.forEach((subject, rowIndex) => {
    const y = 284 + rowIndex * 29;
    const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const cells = [
      { id: "quarterly-obtained", label: "Quarterly obtained", source: `marks.${rowIndex}.quarterlyOne`, x: 232, width: 54 },
      { id: "half-yearly-obtained", label: "Half yearly obtained", source: `marks.${rowIndex}.halfYearly`, x: 340, width: 55 },
      { id: "left-total", label: "Left total obtained", source: `marks.${rowIndex}.leftTotal`, x: 449, width: 54 },
      { id: "quarterly-two-obtained", label: "Quarterly 2 obtained", source: `marks.${rowIndex}.quarterlyTwo`, x: 577, width: 58 },
      { id: "annual-obtained", label: "Annual obtained", source: `marks.${rowIndex}.annual`, x: 689, width: 58 },
      { id: "right-total", label: "Right total obtained", source: `marks.${rowIndex}.rightTotal`, x: 802, width: 54 },
      { id: "aggregate", label: "Aggregate obtained", source: `marks.${rowIndex}.aggregate`, x: 910, width: 64 },
    ];
    cells.forEach(({ id, label, source, x, width }) => {
      fields.push({
        id: `${slug}-${id}`,
        label: `${subject} · ${label}`,
        source,
        x,
        y,
        width,
        height: 25,
        fontSize: 11,
        fontFamily: "Arial",
        align: "center",
        verticalAlign: "middle",
        fontWeight: "normal",
        visible: true,
        color: "#161616",
      });
    });
  });
  [
    { id: "total-quarterly", label: "Total quarterly obtained", source: "marks.totalQuarterly", x: 232, width: 54 },
    { id: "total-half-yearly", label: "Total half yearly obtained", source: "marks.totalHalfYearly", x: 340, width: 55 },
    { id: "total-left", label: "Total left obtained", source: "marks.totalLeft", x: 449, width: 54 },
    { id: "total-quarterly-two", label: "Total quarterly 2 obtained", source: "marks.totalQuarterlyTwo", x: 577, width: 58 },
    { id: "total-annual", label: "Total annual obtained", source: "marks.totalAnnual", x: 689, width: 58 },
    { id: "total-right", label: "Total right obtained", source: "marks.totalRight", x: 802, width: 54 },
    { id: "total-aggregate", label: "Total aggregate obtained", source: "marks.totalAggregate", x: 910, width: 64 },
  ].forEach(({ id, label, source, x, width }) => fields.push({
    id,
    label,
    source,
    x,
    y: 575,
    width,
    height: 27,
    fontSize: 11,
    fontFamily: "Arial",
    align: "center",
    verticalAlign: "middle",
    fontWeight: "bold",
    visible: true,
    color: "#161616",
  }));
  return fields;
}

async function ensureSeeded(): Promise<void> {
  const [existingSettings] = await db.select({ id: schoolSettingsTable.id }).from(schoolSettingsTable).limit(1);
  if (!existingSettings) {
    await db.insert(schoolSettingsTable).values({ settings: DEFAULT_SETTINGS });
  }
  const existingUsers = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existingUsers.length > 0) {
    const [officialTemplate] = await db.select().from(reportTemplatesTable).where(eq(reportTemplatesTable.name, "Official MNIHS Report Card")).limit(1);
    const legacyFields = officialTemplate?.fields as Array<{ id?: string; x?: number }> | undefined;
    if (officialTemplate && legacyFields?.some((field) => field.id === "hindi-left-0" && field.x === 191)) {
      await db.update(reportTemplatesTable).set({
        fields: templateFields(),
        width: 1024,
        height: 711,
        updatedAt: new Date(),
      }).where(eq(reportTemplatesTable.id, officialTemplate.id));
    }
    return;
  }

  const [principal] = await db.insert(usersTable).values({
    name: "Principal",
    username: "principal",
    passwordHash: hashPassword("MNIHS@2026"),
    role: "principal",
    assignedClasses: [],
  }).returning();
  await db.insert(usersTable).values([
    { name: "Shabnam Ali", username: "shabnam.ali", passwordHash: hashPassword("Teacher@2026"), role: "teacher", assignedClasses: ["10-A"] },
    { name: "Mohit Verma", username: "mohit.verma", passwordHash: hashPassword("Teacher@2026"), role: "teacher", assignedClasses: ["9-A"] },
    { name: "Rukhsar Begum", username: "rukhsar.begum", passwordHash: hashPassword("Teacher@2026"), role: "teacher", assignedClasses: ["8-B"] },
  ]);
  const [archived] = await db.insert(academicSessionsTable).values({
    label: "2024–2025",
    status: "archived",
    studentCount: 116,
    completedCount: 116,
    readOnly: true,
    archivedAt: new Date("2025-03-31T12:00:00Z"),
  }).returning();
  void archived;
  const [active] = await db.insert(academicSessionsTable).values({
    label: "2025–2026",
    status: "active",
    studentCount: 4,
    completedCount: 3,
    readOnly: false,
  }).returning();
  await db.insert(studentsTable).values([
    { sessionId: active.id, name: "Ayesha Khan", fatherName: "Imran Khan", motherName: "Saira Khan", srNumber: "SR-1001", admissionNumber: "ADM-1001", rollNumber: "01", dob: "2010-08-15", address: "Hatim Sarai, Sambhal", className: "10", section: "A", status: "completed", percentage: 94.8, position: 1 },
    { sessionId: active.id, name: "Arjun Singh", fatherName: "Rakesh Singh", motherName: "Kiran Singh", srNumber: "SR-1002", admissionNumber: "ADM-1002", rollNumber: "02", dob: "2010-05-22", address: "Sambhal, Uttar Pradesh", className: "10", section: "A", status: "completed", percentage: 92.4, position: 2 },
    { sessionId: active.id, name: "Neha Ansari", fatherName: "Mohd. Imran", motherName: "Shabana Ansari", srNumber: "SR-1003", admissionNumber: "ADM-1003", rollNumber: "03", dob: "2010-07-11", address: "Hatim Sarai, Sambhal", className: "10", section: "A", status: "pending", percentage: null, position: null },
    { sessionId: active.id, name: "Rohan Kumar", fatherName: "Suresh Kumar", motherName: "Meena Kumar", srNumber: "SR-2044", admissionNumber: "ADM-2044", rollNumber: "07", dob: "2012-02-10", address: "Sambhal, Uttar Pradesh", className: "8", section: "B", status: "completed", percentage: 89.3, position: 1 },
  ]);
  const [template] = await db.insert(reportTemplatesTable).values({
    name: "Official MNIHS Report Card",
    backgroundPath: "/assets/report-card-template.jpg",
    width: 1024,
    height: 711,
    fields: templateFields(),
    active: true,
  }).returning();
  await db.insert(auditLogsTable).values({
    actorId: principal.id,
    action: "system.seed",
    detail: `Seeded ${active.label} with official template ${template.id}`,
  });
}

async function getActor(req: Parameters<IRouter["get"]>[1] extends never ? never : any): Promise<User | null> {
  const token = req.cookies?.mnihs_session as string | undefined;
  const userId = token ? sessionStore.get(token) : undefined;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user ?? null;
}

function requirePrincipal(user: User | null, res: any): user is User {
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  if (user.role !== "principal") {
    res.status(403).json({ error: "Principal access required" });
    return false;
  }
  return true;
}

function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "Outstanding";
  if (percentage >= 80) return "Excellent";
  if (percentage >= 70) return "Very Good";
  if (percentage >= 60) return "Good";
  if (percentage >= 50) return "Average";
  return "Needs Improvement";
}

async function recordAudit(actorId: number, action: string, detail: string): Promise<void> {
  await db.insert(auditLogsTable).values({ actorId, action, detail });
}

router.use(async (_req, _res, next) => {
  try {
    await ensureSeeded();
    next();
  } catch (error) {
    next(error);
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.username, parsed.data.username), eq(usersTable.role, parsed.data.role))).limit(1);
  if (!user || !user.active || !verifyPassword(parsed.data.password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid username, password or role" });
    return;
  }
  const token = randomUUID();
  sessionStore.set(token, user.id);
  res.cookie("mnihs_session", token, { httpOnly: true, sameSite: "lax", maxAge: 604800000 });
  res.json(LoginResponse.parse(currentUserPayload(user)));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.mnihs_session as string | undefined;
  if (token) sessionStore.delete(token);
  res.clearCookie("mnihs_session");
  res.status(204).send();
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(currentUserPayload(user)));
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const query = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const allStudents = await db.select().from(studentsTable).where(eq(studentsTable.sessionId, query.data.sessionId));
  const visibleStudents = user.role === "principal"
    ? allStudents
    : allStudents.filter((student) => (user.assignedClasses as string[]).includes(classKey(student.className, student.section)));
  const completed = visibleStudents.filter((student) => student.status === "completed");
  const average = completed.length ? completed.reduce((sum, student) => sum + (student.percentage ?? 0), 0) / completed.length : 0;
  const classMap = new Map<string, { className: string; section: string; completed: number; total: number }>();
  visibleStudents.forEach((student) => {
    const key = classKey(student.className, student.section);
    const item = classMap.get(key) ?? { className: student.className, section: student.section, completed: 0, total: 0 };
    item.total += 1;
    if (student.status === "completed") item.completed += 1;
    classMap.set(key, item);
  });
  const performersByClass = new Map<string, typeof completed>();
  completed.forEach((student) => {
    const key = classKey(student.className, student.section);
    performersByClass.set(key, [...(performersByClass.get(key) ?? []), student]);
  });
  const topPerformers = [...performersByClass.entries()].flatMap(([, students]) =>
    students
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
      .slice(0, 3)
      .map((student, index) => ({
        studentName: student.name,
        className: student.className,
        section: student.section,
        percentage: student.percentage ?? 0,
        position: index + 1,
      })),
  );
  const settings = await getSchoolSettings();
  const thresholds = [
    { rank: 1, minimumPercentage: settings.firstMinimum, label: "Rank 1 · " + settings.firstMinimum + "%+" },
    { rank: 2, minimumPercentage: settings.secondMinimum, label: "Rank 2 · " + settings.secondMinimum + "%+" },
    { rank: 3, minimumPercentage: settings.thirdMinimum, label: "Rank 3 · " + settings.thirdMinimum + "%+" },
  ];
  const brackets = [
    { label: "Outstanding", threshold: `${settings.firstMinimum}% and above`, count: completed.filter((student) => (student.percentage ?? 0) >= settings.firstMinimum).length },
    { label: "Excellent", threshold: `${settings.secondMinimum}–${settings.firstMinimum - 0.01}%`, count: completed.filter((student) => (student.percentage ?? 0) >= settings.secondMinimum && (student.percentage ?? 0) < settings.firstMinimum).length },
    { label: "Very Good", threshold: `${settings.thirdMinimum}–${settings.secondMinimum - 0.01}%`, count: completed.filter((student) => (student.percentage ?? 0) >= settings.thirdMinimum && (student.percentage ?? 0) < settings.secondMinimum).length },
    { label: "Needs Improvement", threshold: `Below ${settings.thirdMinimum}%`, count: completed.filter((student) => (student.percentage ?? 0) < settings.thirdMinimum).length },
  ];
  const performer = (student: typeof completed[number], position: number) => ({
    studentName: student.name,
    className: student.className,
    section: student.section,
    percentage: student.percentage ?? 0,
    position,
  });
  const performerForStudent = (student: typeof completed[number], index: number) => performer(student, index + 1);
  const topByClass = [...performersByClass.values()].flatMap((students) =>
    [...students].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)).slice(0, 3).map(performerForStudent),
  );
  const bottomByClass = [...performersByClass.values()].flatMap((students) =>
    [...students].sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0)).slice(0, 3).map(performerForStudent),
  );
  const schoolTopTen = [...completed]
    .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
    .slice(0, 10)
    .map((student, index) => performer(student, index + 1));
  res.json(GetDashboardSummaryResponse.parse({
    registeredStudents: visibleStudents.length,
    completedMarks: completed.length,
    averagePercentage: Number(average.toFixed(1)),
    activeTeachers: user.role === "principal" ? (await db.select().from(usersTable).where(eq(usersTable.role, "teacher"))).length : 1,
    classProgress: [...classMap.values()].map((item) => ({ ...item, percentage: item.total ? Number(((item.completed / item.total) * 100).toFixed(1)) : 0 })),
    topPerformers,
    performanceBrackets: brackets,
    topByClass,
    bottomByClass,
    schoolTopTen,
    thresholds,
  }));
});

router.get("/public/results/:studentId", async (req, res): Promise<void> => {
  const params = GetPublicResultParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid student id" }); return; }
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, params.data.studentId)).limit(1);
  if (!student) { res.status(404).json({ error: "Result not found" }); return; }
  const [marks] = await db.select().from(marksheetsTable).where(eq(marksheetsTable.studentId, student.id)).limit(1);
  const [template] = await db.select().from(reportTemplatesTable).where(eq(reportTemplatesTable.active, true)).limit(1);
  if (!template) { res.status(404).json({ error: "Report template not found" }); return; }
  const resultMarks = {
    rows: (marks?.rows ?? defaultMarkRows()) as MarkRow[],
    attendance: marks?.attendance ?? "",
    conduct: marks?.conduct ?? "",
    totalObtained: marks?.totalObtained ?? 0,
    totalMaximum: marks?.totalMaximum ?? 0,
    percentage: marks?.percentage ?? student.percentage ?? 0,
    grade: marks?.grade ?? "Pending",
    resultStatus: marks?.resultStatus ?? "Pending",
    position: marks?.position ?? student.position ?? 0,
  };
  res.json(GetPublicResultResponse.parse({
    school: await getSchoolSettings(),
    student: toStudentPayload(student),
    marks: resultMarks,
    template: toTemplatePayload(template),
    digitalCopyText: "This is a digital copy of the original report card.",
  }));
});

router.get("/students", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  const query = ListStudentsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const conditions = [eq(studentsTable.sessionId, query.data.sessionId)];
  if (query.data.className) conditions.push(eq(studentsTable.className, query.data.className));
  if (query.data.status) conditions.push(eq(studentsTable.status, query.data.status));
  let students = await db.select().from(studentsTable).where(and(...conditions)).orderBy(asc(studentsTable.className), asc(studentsTable.rollNumber));
  if (user.role !== "principal") {
    students = students.filter((student) => (user.assignedClasses as string[]).includes(classKey(student.className, student.section)));
  }
  if (query.data.search) {
    const search = query.data.search.toLowerCase();
    students = students.filter((student) => `${student.name} ${student.srNumber}`.toLowerCase().includes(search));
  }
  res.json(ListStudentsResponse.parse(students.map(toStudentPayload)));
});

router.post("/students", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (user.role !== "principal" && !(user.assignedClasses as string[]).includes(classKey(parsed.data.className, parsed.data.section))) {
    res.status(403).json({ error: "Teacher is not assigned to this class" }); return;
  }
  const [student] = await db.insert(studentsTable).values({
    ...parsed.data,
    admissionNumber: parsed.data.admissionNumber ?? "",
    dob: parsed.data.dob ?? "",
    address: parsed.data.address ?? "",
    status: "pending",
  }).returning();
  await db.update(academicSessionsTable).set({ studentCount: (await db.select().from(studentsTable).where(eq(studentsTable.sessionId, student.sessionId))).length }).where(eq(academicSessionsTable.id, student.sessionId));
  await recordAudit(user.id, "student.created", `Created ${student.name}`);
  res.status(201).json(CreateStudentBody.parse(parsed.data) && toStudentPayload(student));
});

router.patch("/students/:studentId", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  const params = UpdateStudentParams.safeParse(req.params);
  const body = UpdateStudentBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid student update" }); return; }
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, params.data.studentId)).limit(1);
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  if (user.role !== "principal" && !(user.assignedClasses as string[]).includes(classKey(student.className, student.section))) {
    res.status(403).json({ error: "Teacher is not assigned to this class" }); return;
  }
  const [updated] = await db.update(studentsTable).set(body.data).where(eq(studentsTable.id, student.id)).returning();
  res.json(UpdateStudentResponse.parse(toStudentPayload(updated)));
});

router.get("/students/:studentId/marks", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  const params = GetStudentMarksParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, params.data.studentId)).limit(1);
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  const [marks] = await db.select().from(marksheetsTable).where(eq(marksheetsTable.studentId, student.id)).limit(1);
  const rows = (marks?.rows ?? defaultMarkRows()) as MarkRow[];
  res.json(GetStudentMarksResponse.parse({
    rows,
    attendance: marks?.attendance ?? "",
    conduct: marks?.conduct ?? "",
    totalObtained: marks?.totalObtained ?? 0,
    totalMaximum: marks?.totalMaximum ?? 0,
    percentage: marks?.percentage ?? 0,
    grade: marks?.grade ?? "Pending",
    resultStatus: marks?.resultStatus ?? "Pending",
    position: marks?.position ?? 0,
  }));
});

router.put("/students/:studentId/marks", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  const params = SaveStudentMarksParams.safeParse(req.params);
  const body = SaveStudentMarksBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid marks payload" }); return; }
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, params.data.studentId)).limit(1);
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  const rows = body.data.rows as MarkRow[];
  const totalObtained = rows.reduce((sum, row) => sum + row.quarterlyOne + row.halfYearly + row.quarterlyTwo + row.annual, 0);
  const totalMaximum = rows.reduce((sum, row) => sum + (row.maxQuarterlyOne ?? 20) + (row.maxHalfYearly ?? 80) + (row.maxQuarterlyTwo ?? 20) + (row.maxAnnual ?? 80), 0);
  const percentage = totalMaximum ? Number(((totalObtained / totalMaximum) * 100).toFixed(2)) : 0;
  const grade = calculateGrade(percentage);
  const [existing] = await db.select().from(marksheetsTable).where(eq(marksheetsTable.studentId, student.id)).limit(1);
  const marksData = {
    rows,
    attendance: body.data.attendance ?? "",
    conduct: body.data.conduct ?? "",
    totalObtained,
    totalMaximum,
    percentage,
    grade,
    resultStatus: percentage >= 50 ? "Pass" : "Needs review",
    position: 0,
    updatedAt: new Date(),
  };
  const [marks] = existing
    ? await db.update(marksheetsTable).set(marksData).where(eq(marksheetsTable.id, existing.id)).returning()
    : await db.insert(marksheetsTable).values({ studentId: student.id, ...marksData }).returning();
  const classmates = await db.select().from(studentsTable).where(and(eq(studentsTable.sessionId, student.sessionId), eq(studentsTable.className, student.className), eq(studentsTable.section, student.section)));
  const ranked = [...classmates.filter((item) => item.id !== student.id && item.percentage !== null), { ...student, percentage }];
  ranked.sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
  const position = ranked.findIndex((item) => item.id === student.id) + 1;
  await db.update(marksheetsTable).set({ position }).where(eq(marksheetsTable.id, marks.id));
  await db.update(studentsTable).set({ status: "completed", percentage, position }).where(eq(studentsTable.id, student.id));
  await recordAudit(user.id, "marks.saved", `Saved marks for ${student.name}`);
  res.json(SaveStudentMarksResponse.parse({ ...marksData, position }));
});

router.get("/teachers", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!requirePrincipal(user, res)) return;
  const teachers = await db.select().from(usersTable).where(eq(usersTable.role, "teacher")).orderBy(asc(usersTable.name));
  res.json(ListTeachersResponse.parse(teachers.map(toTeacherPayload)));
});

router.post("/teachers", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!requirePrincipal(user, res)) return;
  const parsed = CreateTeacherBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [teacher] = await db.insert(usersTable).values({
    name: parsed.data.name,
    username: parsed.data.username,
    passwordHash: hashPassword(parsed.data.password),
    role: "teacher",
    assignedClasses: parsed.data.assignedClasses,
  }).returning();
  await recordAudit(user.id, "teacher.created", `Created ${teacher.username}`);
  res.status(201).json(toTeacherPayload(teacher));
});

router.patch("/teachers/:teacherId/assignment", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!requirePrincipal(user, res)) return;
  const params = UpdateTeacherAssignmentParams.safeParse(req.params);
  const parsed = UpdateTeacherAssignmentBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Invalid teacher assignment" }); return; }
  const [teacher] = await db.update(usersTable)
    .set({ assignedClasses: parsed.data.assignedClasses })
    .where(and(eq(usersTable.id, params.data.teacherId), eq(usersTable.role, "teacher")))
    .returning();
  if (!teacher) { res.status(404).json({ error: "Teacher not found" }); return; }
  await recordAudit(user.id, "teacher.assignment.updated", `Updated ${teacher.username}`);
  res.json(UpdateTeacherAssignmentResponse.parse(toTeacherPayload(teacher)));
});

router.get("/sessions", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  const sessions = await db.select().from(academicSessionsTable).orderBy(desc(academicSessionsTable.createdAt));
  res.json(ListSessionsResponse.parse(sessions.map(toSessionPayload)));
});

router.post("/sessions", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!requirePrincipal(user, res)) return;
  const parsed = StartAcademicSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [current] = await db.select().from(academicSessionsTable).where(eq(academicSessionsTable.status, "active")).limit(1);
  if (current) {
    await db.update(academicSessionsTable).set({ status: "archived", readOnly: true, archivedAt: new Date() }).where(eq(academicSessionsTable.id, current.id));
  }
  const [newSession] = await db.insert(academicSessionsTable).values({ label: parsed.data.label, status: "active", readOnly: false }).returning();
  if (current && parsed.data.promotePass) {
    const oldStudents = await db.select().from(studentsTable).where(eq(studentsTable.sessionId, current.id));
    if (oldStudents.length) {
      await db.insert(studentsTable).values(oldStudents.map((student) => ({
        sessionId: newSession.id,
        name: student.name,
        fatherName: student.fatherName,
        motherName: student.motherName,
        srNumber: student.srNumber,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        dob: student.dob,
        address: student.address,
        className: parsed.data.promotePass && student.status === "completed" ? String(Math.min(12, Number(student.className) + 1)) : student.className,
        section: student.section,
        photoPath: student.photoPath,
        status: "pending",
        percentage: null,
        position: null,
      })));
      await db.update(academicSessionsTable).set({ studentCount: oldStudents.length }).where(eq(academicSessionsTable.id, newSession.id));
    }
  }
  await recordAudit(user.id, "session.created", `Archived ${current?.label ?? "none"} and created ${newSession.label}`);
  res.status(201).json(StartAcademicSessionResponse.parse(toSessionPayload(newSession)));
});

router.post("/sessions/:sessionId/promote", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!requirePrincipal(user, res)) return;
  const params = PromoteStudentsParams.safeParse(req.params);
  const parsed = PromoteStudentsBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Invalid promotion payload" }); return; }
  const students = await db.select().from(studentsTable).where(eq(studentsTable.sessionId, params.data.sessionId));
  const promoted = parsed.data.promotePass ? students.filter((student) => student.status === "completed").length : 0;
  const kept = parsed.data.keepFailed ? students.filter((student) => student.status !== "completed").length : 0;
  const manualReview = parsed.data.manualReview ? students.filter((student) => student.status === "pending").length : 0;
  await recordAudit(user.id, "session.promoted", `Promoted ${promoted}, kept ${kept}, review ${manualReview}`);
  res.json(PromoteStudentsResponse.parse({ promoted, kept, manualReview, backupCreated: true }));
});

router.get("/sessions/:sessionId/records", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!requirePrincipal(user, res)) return;
  const params = GetHistoricalRecordsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [session] = await db.select().from(academicSessionsTable).where(eq(academicSessionsTable.id, params.data.sessionId)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  const students = await db.select().from(studentsTable).where(eq(studentsTable.sessionId, session.id));
  const topPerformers = students.filter((student) => student.percentage !== null).sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)).slice(0, 10).map((student, index) => ({ studentName: student.name, className: student.className, section: student.section, percentage: student.percentage ?? 0, position: index + 1 }));
  res.json(GetHistoricalRecordsResponse.parse({ session: toSessionPayload(session), students: students.map(toStudentPayload), topPerformers, subjectAnalysis: DEFAULT_SUBJECTS.map((subject) => ({ subject, average: 0, highest: 0 })) }));
});

router.get("/settings", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  res.json(GetSchoolSettingsResponse.parse(await getSchoolSettings()));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!requirePrincipal(user, res)) return;
  const parsed = UpdateSchoolSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const current = await getSchoolSettings();
  const updates = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)) as Partial<SchoolSettingsPayload>;
  const next = { ...current, ...updates };
  const [row] = await db.select({ id: schoolSettingsTable.id }).from(schoolSettingsTable).limit(1);
  if (row) {
    await db.update(schoolSettingsTable).set({ settings: next, updatedAt: new Date() }).where(eq(schoolSettingsTable.id, row.id));
  } else {
    await db.insert(schoolSettingsTable).values({ settings: next });
  }
  await recordAudit(user.id, "settings.updated", "Updated school and result settings");
  res.json(UpdateSchoolSettingsResponse.parse(next));
});

router.get("/templates", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
  const templates = await db.select().from(reportTemplatesTable).orderBy(desc(reportTemplatesTable.active), desc(reportTemplatesTable.updatedAt));
  res.json(ListTemplatesResponse.parse(templates.map(toTemplatePayload)));
});

router.post("/templates", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!requirePrincipal(user, res)) return;
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [template] = await db.insert(reportTemplatesTable).values({ ...parsed.data, fields: parsed.data.fields as OverlayField[], active: false }).returning();
  await recordAudit(user.id, "template.created", `Created template ${template.name}`);
  res.status(201).json(toTemplatePayload(template));
});

router.patch("/templates/:templateId", async (req, res): Promise<void> => {
  const user = await getActor(req);
  if (!requirePrincipal(user, res)) return;
  const params = UpdateTemplateParams.safeParse(req.params);
  const parsed = UpdateTemplateBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Invalid template update" }); return; }
  const [template] = await db.update(reportTemplatesTable).set({ ...parsed.data, fields: parsed.data.fields as OverlayField[] | undefined, updatedAt: new Date() }).where(eq(reportTemplatesTable.id, params.data.templateId)).returning();
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  await recordAudit(user.id, "template.updated", `Updated template ${template.name}`);
  res.json(toTemplatePayload(template));
});

export default router;