import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, useLocation } from 'wouter';
import {
  Activity, Archive, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, ClipboardList,
  Download, FileImage, FileText, Grid2X2, LayoutDashboard, LogOut, Menu, Plus, RotateCcw, Save,
  QrCode, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, UserPlus, Users, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import {
  getGetCurrentUserQueryKey, getGetDashboardSummaryQueryKey, getGetStudentMarksQueryKey,
  getGetHistoricalRecordsQueryKey, getGetSchoolSettingsQueryKey, getListStudentsQueryKey, getListTeachersQueryKey,
  getListSessionsQueryKey, getListTemplatesQueryKey, useCreateStudent, useCreateTeacher,
  useCreateTemplate, useGetCurrentUser, useGetDashboardSummary, useGetHistoricalRecords, useGetSchoolSettings,
  useGetStudentMarks, useListSessions, useListStudents, useListTeachers, useListTemplates,
  useLogin, useLogout, usePromoteStudents, useSaveStudentMarks, useStartAcademicSession,
  useUpdateSchoolSettings, useUpdateStudent, useUpdateTeacherAssignment, useUpdateTemplate,
} from '@workspace/api-client-react';
import type {
  AcademicSession, DashboardSummary, MarksSheet, OverlayField, ReportTemplate, SchoolSettings, Student,
  Teacher,
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import { DashboardRankings } from '@/components/dashboard-rankings';
import { PublicResultPage } from '@/components/public-result-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});
const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/students', label: 'Students & marks', icon: Users },
  { href: '/sessions', label: 'Academic sessions', icon: RotateCcw, principal: true },
  { href: '/templates', label: 'Report templates', icon: FileImage, principal: true },
  { href: '/teachers', label: 'Teachers', icon: UserPlus, principal: true },
  { href: '/settings', label: 'School settings', icon: Settings2, principal: true },
];

function cx(...values: Array<string | false | undefined>) { return values.filter(Boolean).join(' '); }
function initials(value = '') { return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'MN'; }
function activeSession(sessions?: AcademicSession[]) { return sessions?.find((s) => s.status === 'active') ?? sessions?.[0]; }

function LoadingBlock({ lines = 4 }: { lines?: number }) {
  return <div className="space-y-3" data-testid="loading-state">{Array.from({ length: lines }).map((_, i) => <div className="skeleton h-12 w-full" key={i} />)}</div>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className={cx('modal', wide && 'max-w-5xl')} data-testid="modal">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-bold tracking-tight">{title}</h2>
        <button className="btn btn-ghost p-2" onClick={onClose} aria-label="Close dialog" data-testid="button-close-dialog"><X size={17} /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>;
}

function AuthPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [role, setRole] = useState<'principal' | 'teacher'>('principal');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  return <main className="app-noise min-h-[100dvh] grid lg:grid-cols-[1.05fr_.95fr] bg-background">
    <section className="hidden lg:flex relative overflow-hidden bg-sidebar text-sidebar-foreground p-14 flex-col justify-between">
      <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-sidebar-border opacity-60" />
      <div className="absolute -left-32 bottom-20 h-72 w-72 rounded-full bg-sidebar-accent opacity-70" />
      <div className="relative flex items-center gap-3">
        <img src="/assets/school-logo.jpeg" className="h-12 w-12 rounded-full object-cover ring-2 ring-sidebar-primary/50" alt="M.N.I. Higher Secondary School logo" />
        <div><p className="font-bold">M.N.I. Higher Secondary</p><p className="eyebrow text-sidebar-primary">School ERP / 01</p></div>
      </div>
      <div className="relative max-w-xl">
        <p className="eyebrow text-sidebar-primary mb-5">Academic records workspace</p>
        <h1 className="text-5xl font-bold leading-[1.05] tracking-[-.045em]">Results, ready when the school is.</h1>
        <p className="mt-6 max-w-md text-sm leading-6 text-sidebar-foreground/65">A focused place for principals and teachers to enter marks, review progress, and produce report cards without losing the thread.</p>
        <div className="mt-10 flex items-center gap-3 text-xs text-sidebar-foreground/60"><ShieldCheck size={16} className="text-sidebar-primary" /> Session data is scoped and role-aware.</div>
      </div>
      <p className="relative mono text-[10px] text-sidebar-foreground/40">M.N.I.H.S. · HATIM SARAI · SAMBHAL</p>
    </section>
    <section className="flex items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-md rise">
        <div className="mb-10 flex items-center gap-3 lg:hidden"><img src="/assets/school-logo.jpeg" className="h-12 w-12 rounded-full object-cover" alt="School logo" /><div><b>M.N.I. Higher Secondary</b><p className="eyebrow">School ERP</p></div></div>
        <p className="eyebrow mb-3">Welcome back</p>
        <h2 className="text-3xl font-bold tracking-[-.04em]">Sign in to your workspace</h2>
        <p className="mt-2 text-sm text-muted-foreground">Use the account issued by your school administrator.</p>
        <div className="mt-8 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          {(['principal', 'teacher'] as const).map((item) => <button key={item} onClick={() => setRole(item)} className={cx('rounded-md py-2 text-xs font-bold capitalize transition', role === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')} data-testid={`button-role-${item}`}>{item}</button>)}
        </div>
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); login.mutate({ data: { username, password, role } }, { onSuccess: () => setLocation('/dashboard') }); }}>
          <div><label className="field-label" htmlFor="username">Username</label><input id="username" className="field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. principal.mni" required data-testid="input-username" /></div>
          <div><label className="field-label" htmlFor="password">Password</label><input id="password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required data-testid="input-password" /></div>
          {login.isError && <p className="text-sm text-destructive" data-testid="status-login-error">We couldn't sign you in. Check your details and try again.</p>}
          <button className="btn btn-primary w-full py-3" disabled={login.isPending} data-testid="button-sign-in">{login.isPending ? 'Checking credentials…' : 'Enter workspace'} <ArrowRight size={16} /></button>
        </form>
        <p className="mt-8 text-center text-xs text-muted-foreground">Need access? Contact the school principal.</p>
      </div>
    </section>
  </main>;
}

function Shell({ user, children }: { user: { name: string; role: string; username: string }; children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const logout = useLogout();
  const title = navItems.find((item) => location.startsWith(item.href))?.label ?? 'Overview';
  return <div className="app-noise min-h-[100dvh] bg-background">
    <aside className={cx('fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform md:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5"><img src="/assets/school-logo.jpeg" className="h-10 w-10 rounded-full object-cover" alt="School logo" /><div className="min-w-0"><p className="truncate text-sm font-bold">M.N.I. Higher Secondary</p><p className="eyebrow text-sidebar-primary">School ERP</p></div></div>
      <div className="px-4 pt-7"><p className="eyebrow px-3 text-sidebar-foreground/45">Workspace</p><nav className="mt-3 space-y-1">{navItems.filter((item) => !item.principal || user.role === 'principal').map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', location.startsWith(item.href) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground')} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} /><span>{item.label}</span>{location.startsWith(item.href) && <ChevronRight size={14} className="ml-auto text-sidebar-primary" />}</Link>; })}</nav></div>
      <div className="mt-auto border-t border-sidebar-border p-4"><div className="flex items-center gap-3 rounded-lg bg-sidebar-accent p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">{initials(user.name)}</span><div className="min-w-0"><p className="truncate text-xs font-bold">{user.name}</p><p className="eyebrow text-sidebar-foreground/45 capitalize">{user.role}</p></div><button className="ml-auto text-sidebar-foreground/45 hover:text-sidebar-foreground" title="Sign out" onClick={() => logout.mutate()} data-testid="button-logout"><LogOut size={15} /></button></div></div>
    </aside>
    {open && <button className="fixed inset-0 z-20 bg-foreground/20 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" />}
    <div className="md:pl-64"><header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-8"><div className="flex items-center gap-3"><button className="btn btn-ghost p-2 md:hidden" onClick={() => setOpen(true)} data-testid="button-open-navigation"><Menu size={19} /></button><div><p className="eyebrow">{location === '/dashboard' ? 'Live school view' : 'Workspace'}</p><h1 className="text-lg font-bold">{title}</h1></div></div><div className="flex items-center gap-3"><span className="hidden text-right sm:block"><b className="block text-xs">{user.name}</b><span className="text-[11px] text-muted-foreground capitalize">{user.role} account</span></span><span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initials(user.name)}</span></div></header><main className="page-pad mx-auto max-w-[1500px] p-4 md:p-8">{children}</main></div>
  </div>;
}

function DashboardPage({ user }: { user: { role: string; assignedClasses?: string[] } }) {
  const sessions = useListSessions();
  const session = activeSession(sessions.data);
  const summary = useGetDashboardSummary({ sessionId: session?.id ?? 0 });
  const data = summary.data as DashboardSummary | undefined;
  return <div className="space-y-7 rise">
     <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="eyebrow">Good morning, {user.role}</p><h2 className="mt-1 text-3xl font-bold tracking-[-.045em]">The school at a glance.</h2><p className="mt-2 text-sm text-muted-foreground">{session ? `${session.label} · ${session.completedCount} of ${session.studentCount} records complete` : 'Choose an active academic session to begin.'}</p>{user.role === 'teacher' && <p className="mt-2 text-xs font-bold text-primary" data-testid="status-assigned-classes">Assigned classes: {user.assignedClasses?.length ? user.assignedClasses.join(', ') : 'No classes assigned'}</p>}</div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground"><span className="h-2 w-2 rounded-full bg-primary" /> Data updates live</span></div>
    {!session && sessions.isLoading ? <LoadingBlock lines={3} /> : <>{summary.isLoading ? <LoadingBlock lines={5} /> : data ? <DashboardContent data={data} /> : <EmptyState icon={<ClipboardList />} title="No summary yet" body="Once an active session has students, progress will appear here." />}</>}
  </div>;
}

function DashboardContent({ data }: { data: DashboardSummary }) {
  const cards = [{ label: 'Registered students', value: data.registeredStudents, note: 'in this session', accent: 'bg-primary' }, { label: 'Marks completed', value: data.completedMarks, note: `${data.registeredStudents ? Math.round(data.completedMarks / data.registeredStudents * 100) : 0}% of roster`, accent: 'bg-accent' }, { label: 'Average percentage', value: `${data.averagePercentage.toFixed(1)}%`, note: 'across completed records', accent: 'bg-sidebar-primary' }, { label: 'Active teachers', value: data.activeTeachers, note: 'accounts with access', accent: 'bg-primary' }];
  return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <div className="panel relative overflow-hidden p-5" key={card.label} data-testid={`metric-${card.label.toLowerCase().replaceAll(' ', '-')}`}><div className={cx('absolute left-0 top-0 h-1 w-14', card.accent)} /><p className="eyebrow">{card.label}</p><p className="mt-3 text-3xl font-bold tracking-[-.05em]">{card.value}</p><p className="mt-1 text-xs text-muted-foreground">{card.note}</p></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><section className="panel p-5"><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">Completion by class</p><h3 className="mt-1 font-bold">Where attention is needed</h3></div><Activity size={18} className="text-muted-foreground" /></div><div className="space-y-5">{data.classProgress.map((item) => <div key={`${item.className}-${item.section}`} data-testid={`progress-class-${item.className}-${item.section}`}><div className="mb-2 flex justify-between text-xs"><span className="font-bold">Class {item.className} <span className="text-muted-foreground">/ {item.section}</span></span><span className="mono text-muted-foreground">{item.percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(item.percentage, 100)}%` }} /></div></div>)}</div></section><section className="panel p-5"><p className="eyebrow">Result distribution</p><h3 className="mt-1 font-bold">Performance brackets</h3><div className="mt-5 space-y-3">{data.performanceBrackets.map((item, i) => <div className="flex items-center gap-3" key={item.label}><span className={cx('h-2.5 w-2.5 rounded-full', i === 0 ? 'bg-primary' : i === 1 ? 'bg-sidebar-primary' : 'bg-accent')} /><div className="flex-1"><div className="flex justify-between text-xs"><span>{item.label}</span><b>{item.count}</b></div><p className="mt-1 text-[11px] text-muted-foreground">{item.threshold}</p></div></div>)}</div></section></div>
     <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="eyebrow">Recognition</p><h3 className="mt-1 font-bold">Top performers</h3></div><Sparkles size={18} className="text-accent" /></div><div className="table-wrap"><table><thead><tr><th>Position</th><th>Student</th><th>Class</th><th>Percentage</th></tr></thead><tbody>{data.topPerformers.map((item) => <tr key={`${item.position}-${item.studentName}`} data-testid={`row-top-performer-${item.position}`}><td><span className="mono font-bold text-primary">#{item.position}</span></td><td className="font-bold">{item.studentName}</td><td>{item.className} <span className="text-muted-foreground">/ {item.section}</span></td><td className="mono">{item.percentage}%</td></tr>)}</tbody></table></div></section>
     <DashboardRankings data={data} />
  </>;
}

function StudentsPage({ user }: { user?: { role: string; assignedClasses?: string[] } }) {
  const sessions = useListSessions(); const session = activeSession(sessions.data);
  const [search, setSearch] = useState(''); const [className, setClassName] = useState('all'); const [dialog, setDialog] = useState<'create' | 'marks' | 'edit' | 'report' | null>(null); const [selected, setSelected] = useState<Student | null>(null);
  const params = useMemo(() => ({ sessionId: session?.id ?? 0, search: search || undefined, className: className === 'all' ? undefined : className }), [session?.id, search, className]);
  const students = useListStudents(params); const createStudent = useCreateStudent(); const updateStudent = useUpdateStudent(); const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: getListStudentsQueryKey(params) });
  const classOptions = Array.from(new Set((students.data ?? []).map((s) => s.className))).sort();
  const submitStudent = (payload: Record<string, string>) => {
    const data = { sessionId: session?.id ?? 0, name: payload.name, fatherName: payload.fatherName, motherName: payload.motherName, srNumber: payload.srNumber, admissionNumber: payload.admissionNumber, rollNumber: payload.rollNumber, dob: payload.dob, address: payload.address, className: payload.className, section: payload.section };
    if (dialog === 'edit' && selected) updateStudent.mutate({ studentId: selected.id, data }, { onSuccess: () => { refresh(); setDialog(null); } }); else createStudent.mutate({ data }, { onSuccess: () => { refresh(); setDialog(null); } });
  };
   return <div className="space-y-6 rise"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Roster control</p><h2 className="mt-1 text-3xl font-bold tracking-[-.045em]">Students & marks</h2><p className="mt-2 text-sm text-muted-foreground">Capture student identity once. Let totals and positions follow.</p>{user?.role === 'teacher' && <p className="mt-2 text-xs font-bold text-primary" data-testid="status-student-assignment-context">Working context: {user.assignedClasses?.length ? user.assignedClasses.join(', ') : 'No classes assigned'}</p>}</div><button className="btn btn-primary" onClick={() => { setSelected(null); setDialog('create'); }} data-testid="button-add-student"><Plus size={16} /> Add student</button></div>
    <div className="panel flex flex-col gap-3 p-3 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="field pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, SR number or admission number" data-testid="input-student-search" /></div><select className="field sm:w-44" value={className} onChange={(e) => setClassName(e.target.value)} data-testid="select-student-class"><option value="all">All classes</option>{classOptions.map((item) => <option key={item} value={item}>Class {item}</option>)}</select><button className="btn btn-soft" onClick={() => { setSearch(''); setClassName('all'); }} data-testid="button-reset-student-filters"><SlidersHorizontal size={15} /> Reset</button></div>
     <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="eyebrow">Current session</p><h3 className="mt-1 font-bold">{session?.label ?? 'Loading session'}</h3></div><span className="mono text-xs text-muted-foreground">{students.data?.length ?? 0} records</span></div>{students.isLoading ? <div className="p-5"><LoadingBlock /></div> : (students.data?.length ?? 0) === 0 ? <EmptyState icon={<Users />} title="Roster is clear" body="No students match this view. Add the first record or broaden your filters." action={<button className="btn btn-primary" onClick={() => setDialog('create')} data-testid="button-empty-add-student">Add student</button>} /> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Identifiers</th><th>Class</th><th>Status</th><th>Percentage</th><th className="text-right">Action</th></tr></thead><tbody>{students.data?.map((student) => <tr key={student.id} data-testid={`row-student-${student.id}`}><td><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-[10px] font-bold">{initials(student.name)}</span><div><b className="block">{student.name}</b><span className="text-[11px] text-muted-foreground">{student.fatherName}</span></div></div></td><td><span className="mono text-[11px]">SR {student.srNumber}</span><span className="block text-[11px] text-muted-foreground">Roll {student.rollNumber}</span></td><td>{student.className} <span className="text-muted-foreground">/ {student.section}</span></td><td><span className={cx('rounded-full px-2 py-1 text-[10px] font-bold', student.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent')}>{student.status}</span></td><td className="mono">{student.percentage == null ? '—' : `${student.percentage}%`}</td><td><div className="flex justify-end gap-1"><button className="btn btn-soft px-2.5 py-1.5" onClick={() => { setSelected(student); setDialog('marks'); }} data-testid={`button-enter-marks-${student.id}`}>Marks</button><button className="btn btn-soft px-2.5 py-1.5" onClick={() => { setSelected(student); setDialog('report'); }} data-testid={`button-download-report-${student.id}`}><Download size={13} /> Report</button><Link href={`/result/${student.id}`} target="_blank" className="btn btn-ghost px-2.5 py-1.5" data-testid={`link-student-result-${student.id}`}><QrCode size={13} /> QR</Link><button className="btn btn-ghost px-2.5 py-1.5" onClick={() => { setSelected(student); setDialog('edit'); }} data-testid={`button-edit-student-${student.id}`}>Edit</button></div></td></tr>)}</tbody></table></div>}</section>
    {dialog === 'create' || dialog === 'edit' ? <StudentForm student={selected} onClose={() => setDialog(null)} onSubmit={submitStudent} pending={createStudent.isPending || updateStudent.isPending} /> : null}
     {dialog === 'marks' && selected ? <MarksDialog student={selected} onClose={() => setDialog(null)} /> : null}
     {dialog === 'report' && selected ? <ReportCardDialog student={selected} onClose={() => setDialog(null)} /> : null}
  </div>;
}

function StudentForm({ student, onClose, onSubmit, pending }: { student: Student | null; onClose: () => void; onSubmit: (payload: Record<string, string>) => void; pending: boolean }) {
  const [form, setForm] = useState<Record<string, string>>({ name: student?.name ?? '', fatherName: student?.fatherName ?? '', motherName: student?.motherName ?? '', srNumber: student?.srNumber ?? '', admissionNumber: student?.admissionNumber ?? '', rollNumber: student?.rollNumber ?? '', dob: student?.dob ?? '', address: student?.address ?? '', className: student?.className ?? '', section: student?.section ?? '' });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal title={student ? 'Edit student record' : 'Onboard a student'} onClose={onClose}><form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}><div className="sm:col-span-2"><label className="field-label">Full name</label><input className="field" value={form.name} onChange={(e) => update('name', e.target.value)} required data-testid="input-student-name" /></div>{[['fatherName',"Father's name"],['motherName',"Mother's name"],['srNumber','SR number'],['admissionNumber','Admission number'],['rollNumber','Roll number'],['dob','Date of birth'],['className','Class'],['section','Section']].map(([key,label]) => <div key={key}><label className="field-label">{label}</label><input className="field" type={key === 'dob' ? 'date' : 'text'} value={form[key]} onChange={(e) => update(key, e.target.value)} required={['fatherName','motherName','srNumber','rollNumber','className','section'].includes(key)} data-testid={`input-student-${key}`} /></div>)}<div className="sm:col-span-2"><label className="field-label">Address</label><textarea className="field min-h-20" value={form.address} onChange={(e) => update('address', e.target.value)} data-testid="input-student-address" /></div><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn btn-soft" onClick={onClose} data-testid="button-cancel-student">Cancel</button><button className="btn btn-primary" disabled={pending} data-testid="button-save-student">{pending ? 'Saving…' : <><Save size={15} /> Save record</>}</button></div></form></Modal>;
}

function MarksDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const marks = useGetStudentMarks(student.id); const save = useSaveStudentMarks(); const qc = useQueryClient();
  const [sheet, setSheet] = useState<MarksSheet | null>(null);
  const server = marks.data as MarksSheet | undefined;
  const rows = sheet?.rows ?? server?.rows ?? [];
  const setRow = (index: number, key: string, value: string) => setSheet((current) => { const base = current ?? server ?? { rows: [], attendance: '', conduct: '', totalObtained: 0, totalMaximum: 0, percentage: 0, grade: '', resultStatus: '', position: 0 }; return { ...base, rows: base.rows.map((row, i) => i === index ? { ...row, [key]: Number(value) || 0 } : row) }; });
  const submit = () => { if (!sheet && !server) return; const data = { rows, attendance: sheet?.attendance ?? server?.attendance ?? '', conduct: sheet?.conduct ?? server?.conduct ?? '' }; save.mutate({ studentId: student.id, data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetStudentMarksQueryKey(student.id) }); qc.invalidateQueries({ queryKey: getListStudentsQueryKey({ sessionId: student.sessionId }) }); onClose(); } }); };
  return <Modal title={`Marks · ${student.name}`} onClose={onClose} wide><div className="mb-5 flex items-start justify-between"><div><p className="eyebrow">Automatic result calculation</p><p className="mt-1 text-sm text-muted-foreground">Enter obtained marks; totals, grade and position are calculated by the school rules.</p></div>{server && <div className="text-right"><p className="mono text-2xl font-bold text-primary">{server.percentage}%</p><p className="text-[11px] text-muted-foreground">{server.grade} · {server.resultStatus}</p></div>}</div>{marks.isLoading ? <LoadingBlock lines={4} /> : <><div className="table-wrap border border-border rounded-lg"><table><thead><tr><th>Subject</th><th>Quarterly 1</th><th>Half yearly</th><th>Quarterly 2</th><th>Annual</th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.subject}><td className="font-bold">{row.subject}</td>{(['quarterlyOne','halfYearly','quarterlyTwo','annual'] as const).map((key) => <td key={key}><input className="field w-24 py-1.5 text-center mono text-xs" type="number" min="0" value={row[key]} onChange={(e) => setRow(i, key, e.target.value)} data-testid={`input-mark-${i}-${key}`} /></td>)}</tr>)}</tbody></table></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className="field-label">Attendance</label><input className="field" value={sheet?.attendance ?? server?.attendance ?? ''} onChange={(e) => setSheet((current) => ({ ...(current ?? server!), attendance: e.target.value }))} data-testid="input-attendance" /></div><div><label className="field-label">Conduct</label><input className="field" value={sheet?.conduct ?? server?.conduct ?? ''} onChange={(e) => setSheet((current) => ({ ...(current ?? server!), conduct: e.target.value }))} data-testid="input-conduct" /></div></div><div className="mt-5 flex justify-end gap-2"><button className="btn btn-soft" onClick={onClose} data-testid="button-cancel-marks">Cancel</button><button className="btn btn-primary" onClick={submit} disabled={save.isPending} data-testid="button-save-marks"><Save size={15} /> {save.isPending ? 'Calculating…' : 'Save marks & calculate'}</button></div></>}</Modal>;
}

function overlayValue(field: OverlayField, student: Student, marks?: MarksSheet): string {
  const source = field.source;
  const studentValues: Record<string, string | number | null | undefined> = {
    name: student.name,
    fatherName: student.fatherName,
    motherName: student.motherName,
    srNumber: student.srNumber,
    dob: student.dob,
    className: student.className,
    section: student.section,
    rollNumber: student.rollNumber,
    address: student.address,
  };
  if (source.startsWith('student.')) return String(studentValues[source.replace('student.', '')] ?? '');
  if (source === 'marks.attendance') return marks?.attendance ?? '';
  if (source === 'marks.conduct') return marks?.conduct ?? '';
  if (source === 'marks.percentage') return marks ? `${marks.percentage}%` : '';
  if (source === 'marks.position') return marks?.position ? `#${marks.position}` : '';
  const rowMatch = source.match(/^marks\.(\d+)\.(.+)$/);
  if (rowMatch) {
    const row = marks?.rows[Number(rowMatch[1])] as (Record<string, number | string> | undefined);
    const key = rowMatch[2];
    if (!row) return '';
    if (key === 'leftTotal') return String(Number(row.quarterlyOne ?? 0) + Number(row.halfYearly ?? 0));
    if (key === 'rightTotal') return String(Number(row.quarterlyTwo ?? 0) + Number(row.annual ?? 0));
    if (key === 'aggregate') return String(Number(row.quarterlyOne ?? 0) + Number(row.halfYearly ?? 0) + Number(row.quarterlyTwo ?? 0) + Number(row.annual ?? 0));
    return String(row[key] ?? '');
  }
  if (source.startsWith('marks.total')) {
    const rows = marks?.rows ?? [];
    const total = rows.reduce((sum, row) => {
      const current = row as unknown as Record<string, number>;
      if (source === 'marks.totalQuarterly') return sum + Number(current.quarterlyOne ?? 0);
      if (source === 'marks.totalHalfYearly') return sum + Number(current.halfYearly ?? 0);
      if (source === 'marks.totalLeft') return sum + Number(current.quarterlyOne ?? 0) + Number(current.halfYearly ?? 0);
      if (source === 'marks.totalQuarterlyTwo') return sum + Number(current.quarterlyTwo ?? 0);
      if (source === 'marks.totalAnnual') return sum + Number(current.annual ?? 0);
      if (source === 'marks.totalRight') return sum + Number(current.quarterlyTwo ?? 0) + Number(current.annual ?? 0);
      return sum + Number(current.quarterlyOne ?? 0) + Number(current.halfYearly ?? 0) + Number(current.quarterlyTwo ?? 0) + Number(current.annual ?? 0);
    }, 0);
    return String(total);
  }
  return '';
}

function ReportCardDialog({ student, onClose }: { student: Student; onClose: () => void }) {
  const marks = useGetStudentMarks(student.id);
  const templates = useListTemplates();
  const template = templates.data?.find((item) => item.active) ?? templates.data?.[0];
  const [showPhoto, setShowPhoto] = useState(Boolean(student.photoPath));
  const [signaturePath, setSignaturePath] = useState('');
  const printReport = () => window.setTimeout(() => window.print(), 50);
  return <Modal title={`Report card · ${student.name}`} onClose={onClose} wide>
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><p className="eyebrow">Official report-card output</p><p className="text-sm text-muted-foreground">The saved template mapping and live marks are rendered on the original artwork.</p></div>
      <div className="flex gap-2"><Link href={`/result/${student.id}`} target="_blank" className="btn btn-soft" data-testid={`link-public-result-${student.id}`}><QrCode size={15} /> Digital result</Link><button className="btn btn-primary" onClick={printReport} disabled={!template || marks.isLoading} data-testid="button-print-report"><Download size={15} /> Print landscape PDF</button></div>
    </div>
    <div className="mb-4 grid gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs sm:grid-cols-2">
      <label className="flex items-center gap-2"><input type="checkbox" checked={showPhoto} onChange={(event) => setShowPhoto(event.target.checked)} data-testid="checkbox-report-student-photo" /> Include student photo when available</label>
      <div><label className="field-label">Signature image path (manual)</label><input className="field py-2 text-xs" value={signaturePath} onChange={(event) => setSignaturePath(event.target.value)} placeholder="/assets/signature.png" data-testid="input-report-signature-path" /><p className="mt-1 text-[10px] text-muted-foreground">Signatures are never auto-mapped to a template.</p></div>
    </div>
    {!template || marks.isLoading ? <LoadingBlock lines={5} /> : <div className="report-print mx-auto w-full max-w-[1024px]">
      <div className="relative aspect-[1024/711] w-full overflow-hidden border border-border bg-white shadow-sm" data-testid="report-card-preview">
        <img src={template.backgroundPath} className="absolute inset-0 h-full w-full object-fill" alt="Official MNIHS report card" />
        {showPhoto && student.photoPath && <img src={student.photoPath} className="absolute right-[5%] top-[8%] h-[14%] w-[10%] object-cover" alt={`${student.name} student photo`} data-testid="report-student-photo" />}
        {signaturePath && <img src={signaturePath} className="absolute bottom-[7%] right-[7%] h-[7%] max-w-[18%] object-contain" alt="Manually selected signature" data-testid="report-signature-image" />}
        {template.fields.filter((field) => field.visible !== false).map((field) => {
          const value = overlayValue(field, student, marks.data);
          if (!value) return null;
          return <span key={field.id} className="pointer-events-none absolute flex whitespace-nowrap leading-none" style={{ left: `${(field.x / template.width) * 100}%`, top: `${(field.y / template.height) * 100}%`, width: `${(field.width / template.width) * 100}%`, height: `${(field.height / template.height) * 100}%`, alignItems: field.verticalAlign === 'top' ? 'flex-start' : field.verticalAlign === 'bottom' ? 'flex-end' : 'center', justifyContent: field.align === 'left' ? 'flex-start' : field.align === 'right' ? 'flex-end' : 'center', color: field.color, fontFamily: field.fontFamily, fontSize: `${Math.max(6, field.fontSize * 0.72)}px`, fontWeight: field.fontWeight }}>{value}</span>;
        })}
      </div>
    </div>}
  </Modal>;
}

function SessionsPage() {
  const sessions = useListSessions(); const [start, setStart] = useState(false); const [selectedId, setSelectedId] = useState<number | null>(null); const [promoteId, setPromoteId] = useState<number | null>(null);
  const startSession = useStartAcademicSession(); const promote = usePromoteStudents(); const qc = useQueryClient(); const history = useGetHistoricalRecords(selectedId ?? 0);
  const refresh = () => qc.invalidateQueries({ queryKey: getListSessionsQueryKey() });
  return <div className="space-y-6 rise"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Continuity & archive</p><h2 className="mt-1 text-3xl font-bold tracking-[-.045em]">Academic sessions</h2><p className="mt-2 text-sm text-muted-foreground">Start clean years while keeping every previous result read-only.</p></div><button className="btn btn-primary" onClick={() => setStart(true)} data-testid="button-start-session"><Plus size={16} /> Start new year</button></div><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sessions.isLoading ? <LoadingBlock lines={3} /> : sessions.data?.map((session) => <div className={cx('panel p-5', session.status === 'active' && 'ring-2 ring-primary/20')} key={session.id} data-testid={`card-session-${session.id}`}><div className="flex items-start justify-between"><div><p className="eyebrow">{session.status === 'active' ? 'Current session' : 'Archive'}</p><h3 className="mt-1 text-lg font-bold">{session.label}</h3></div><span className={cx('rounded-full px-2 py-1 text-[10px] font-bold capitalize', session.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{session.status}</span></div><div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-4"><div><p className="eyebrow">Students</p><b className="mono text-lg">{session.studentCount}</b></div><div><p className="eyebrow">Complete</p><b className="mono text-lg">{session.completedCount}</b></div></div><div className="mt-5 flex gap-2">{session.status === 'active' ? <button className="btn btn-soft" onClick={() => setPromoteId(session.id)} data-testid={`button-promote-${session.id}`}>Promotion rules <ArrowRight size={14} /></button> : <button className="btn btn-ghost" onClick={() => setSelectedId(session.id)} data-testid={`button-view-history-${session.id}`}><Archive size={14} /> View read-only records</button>}</div></div>)}</section>
    {start && <Modal title="Start a new academic year" onClose={() => setStart(false)}><SessionForm pending={startSession.isPending} onSubmit={(data) => startSession.mutate({ data }, { onSuccess: () => { refresh(); setStart(false); } })} /></Modal>}
    {promoteId && <Modal title="Promotion rules" onClose={() => setPromoteId(null)}><PromotionForm pending={promote.isPending} onSubmit={(data) => promote.mutate({ sessionId: promoteId, data }, { onSuccess: () => { refresh(); setPromoteId(null); } })} /></Modal>}
    {selectedId && <Modal title="Historical records · read-only" onClose={() => setSelectedId(null)} wide>{history.isLoading ? <LoadingBlock /> : history.data ? <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><div className="panel p-4"><p className="eyebrow">Students</p><b className="mono text-xl">{history.data.students.length}</b></div><div className="panel p-4"><p className="eyebrow">Top performer</p><b>{history.data.topPerformers[0]?.studentName ?? '—'}</b></div><div className="panel p-4"><p className="eyebrow">Session</p><b>{history.data.session.label}</b></div></div><div className="table-wrap border border-border rounded-lg"><table><thead><tr><th>Student</th><th>Class</th><th>Percentage</th><th>Position</th></tr></thead><tbody>{history.data.students.map((s) => <tr key={s.id}><td className="font-bold">{s.name}</td><td>{s.className} / {s.section}</td><td className="mono">{s.percentage ?? '—'}%</td><td className="mono">#{s.position ?? '—'}</td></tr>)}</tbody></table></div></div> : <EmptyState title="No records found" body="This archive does not have readable records yet." />}</Modal>}
  </div>;
}

function SessionForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: { label: string; promotePass: boolean; keepFailed: boolean; keepAssignments: boolean; manualReview: boolean }) => void }) {
  const [label, setLabel] = useState('2025 – 2026'); const [rules, setRules] = useState({ promotePass: true, keepFailed: true, keepAssignments: true, manualReview: false });
  return <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onSubmit({ label, ...rules }); }}><div><label className="field-label">Session label</label><input className="field" value={label} onChange={(e) => setLabel(e.target.value)} required data-testid="input-session-label" /></div><p className="eyebrow">Promotion defaults</p>{Object.entries(rules).map(([key,value]) => <label className="flex items-center gap-3 text-sm" key={key}><input type="checkbox" checked={value} onChange={(e) => setRules((r) => ({ ...r, [key]: e.target.checked }))} data-testid={`checkbox-session-${key}`} /><span>{key === 'promotePass' ? 'Promote students who pass' : key === 'keepFailed' ? 'Keep failed students in the new roster' : key === 'keepAssignments' ? 'Carry teacher assignments forward' : 'Flag borderline results for manual review'}</span></label>)}<button className="btn btn-primary w-full" disabled={pending} data-testid="button-confirm-start-session">{pending ? 'Starting…' : 'Archive current & start session'}</button></form>;
}
function PromotionForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: { promotePass: boolean; keepFailed: boolean; keepAssignments: boolean; manualReview: boolean }) => void }) { const [data,setData] = useState({ promotePass:true, keepFailed:true, keepAssignments:true, manualReview:false }); return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(data); }}>{Object.entries(data).map(([key,value]) => <label className="flex items-center gap-3 text-sm" key={key}><input type="checkbox" checked={value} onChange={(e) => setData((d) => ({...d,[key]:e.target.checked}))} data-testid={`checkbox-promote-${key}`} /><span>{key === 'promotePass' ? 'Promote passing students' : key === 'keepFailed' ? 'Keep failed students' : key === 'keepAssignments' ? 'Keep class assignments' : 'Send borderline cases for review'}</span></label>)}<button className="btn btn-primary w-full" disabled={pending} data-testid="button-confirm-promotion">{pending ? 'Applying…' : 'Apply promotion rules'}</button></form>; }

function TemplatesPage() {
  const CANVAS_WIDTH = 1024;
  const CANVAS_HEIGHT = 711;
  const templates = useListTemplates();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<ReportTemplate | null>(null);
  const [name, setName] = useState('MNIHS Annual Report Card');
  const [fields, setFields] = useState<OverlayField[]>([]);
  const [uploadPreview, setUploadPreview] = useState('/assets/report-card-template.jpg');
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; x: number; y: number; field: OverlayField } | null>(null);

  const openTemplate = (template: ReportTemplate) => {
    setSelected(template);
    setName(template.name);
    setFields(template.fields);
    setUploadPreview(template.backgroundPath || '/assets/report-card-template.jpg');
  };
  useEffect(() => {
    if (!selected && templates.data?.[0]) openTemplate(templates.data[0]);
  }, [selected, templates.data]);
  const newTemplate = () => {
    setSelected(null);
    setName('MNIHS Annual Report Card');
    setFields([
      { id: 'student-name', label: 'Student name', source: 'student.name', x: 156, y: 145, width: 337, height: 22, fontSize: 15, fontFamily: 'Arial', align: 'left', verticalAlign: 'bottom', fontWeight: 'normal', visible: true, color: '#161616' },
      { id: 'percentage', label: 'Percentage', source: 'marks.percentage', x: 309, y: 650, width: 97, height: 22, fontSize: 13, fontFamily: 'Arial', align: 'center', verticalAlign: 'middle', fontWeight: 'bold', visible: true, color: '#161616' },
    ]);
    setUploadPreview('/assets/report-card-template.jpg');
  };
  const setField = (id: string, patch: Partial<OverlayField>) => setFields((current) => current.map((field) => field.id === id ? { ...field, ...patch } : field));
  const saveTemplate = () => {
    const backgroundPath = uploadPreview.startsWith('blob:') ? (selected?.backgroundPath || '/assets/report-card-template.jpg') : uploadPreview;
    const data = { name, backgroundPath, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, fields };
    if (selected) update.mutate({ templateId: selected.id, data: { name, backgroundPath, fields } }, { onSuccess: (result) => { setSelected(result); setFields(result.fields); qc.invalidateQueries({ queryKey: getListTemplatesQueryKey() }); } });
    else create.mutate({ data }, { onSuccess: (result) => { setSelected(result); qc.invalidateQueries({ queryKey: getListTemplatesQueryKey() }); } });
  };
  const onPointerDown = (event: React.PointerEvent, field: OverlayField, mode: 'move' | 'resize') => {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { id: field.id, mode, x: event.clientX, y: event.clientY, field };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = ((event.clientX - state.x) / rect.width) * CANVAS_WIDTH;
    const dy = ((event.clientY - state.y) / rect.height) * CANVAS_HEIGHT;
    const next = state.mode === 'move'
      ? { x: Math.max(0, Math.min(CANVAS_WIDTH - state.field.width, state.field.x + dx)), y: Math.max(0, Math.min(CANVAS_HEIGHT - state.field.height, state.field.y + dy)) }
      : { width: Math.max(12, Math.min(CANVAS_WIDTH - state.field.x, state.field.width + dx)), height: Math.max(10, Math.min(CANVAS_HEIGHT - state.field.y, state.field.height + dy)) };
    setField(state.id, next);
    drag.current = { ...state, x: event.clientX, y: event.clientY, field: { ...state.field, ...next } };
  };
  return <div className="space-y-6 rise"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Fixed-coordinate publishing</p><h2 className="mt-1 text-3xl font-bold tracking-[-.045em]">Report templates</h2><p className="mt-2 text-sm text-muted-foreground">Map trusted values onto the official report-card artwork.</p></div><div className="flex gap-2"><button className="btn btn-soft" onClick={newTemplate} data-testid="button-new-template"><Plus size={15} /> New template</button><button className="btn btn-primary" onClick={saveTemplate} disabled={create.isPending || update.isPending} data-testid="button-save-template"><Save size={15} /> Save template</button></div></div><div className="grid gap-5 xl:grid-cols-[240px_1fr_280px]"><section className="panel p-4"><div className="mb-4 flex items-center justify-between"><p className="eyebrow">Saved templates</p><FileText size={16} className="text-muted-foreground" /></div>{templates.isLoading ? <LoadingBlock lines={2} /> : templates.data?.length ? <div className="space-y-2">{templates.data.map((template) => <button key={template.id} className={cx('w-full rounded-lg border p-3 text-left text-sm', selected?.id === template.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted')} onClick={() => openTemplate(template)} data-testid={`button-template-${template.id}`}><b className="block truncate">{template.name}</b><span className="text-[11px] text-muted-foreground">{template.fields.length} mapped fields</span></button>)}</div> : <p className="text-xs text-muted-foreground">No saved templates. Start with the official artwork.</p>}<div className="mt-5 border-t border-border pt-4"><label className="field-label">Template name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-template-name" /></div><div className="mt-4"><label className="field-label">Upload replacement</label><input type="file" accept="image/*" className="field text-xs" onChange={(e) => { const file = e.target.files?.[0]; if (file) setUploadPreview(URL.createObjectURL(file)); }} data-testid="input-template-upload" /></div></section><section className="panel overflow-hidden p-4"><div className="mb-3 flex items-center justify-between"><div><p className="eyebrow">Canvas / 1024 × 711 natural pixels</p><p className="text-xs text-muted-foreground">Drag a field to move it. Use the corner handle to resize.</p></div><div className="flex items-center gap-1"><button className="btn btn-soft p-2" onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))} aria-label="Zoom out" data-testid="button-zoom-out"><ZoomOut size={15} /></button><span className="mono min-w-12 text-center text-xs">{Math.round(zoom * 100)}%</span><button className="btn btn-soft p-2" onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))} aria-label="Zoom in" data-testid="button-zoom-in"><ZoomIn size={15} /></button><button className="btn btn-ghost px-2 text-xs" onClick={() => setZoom(1)} data-testid="button-zoom-fit">Fit</button></div></div><div className="max-h-[72vh] overflow-auto rounded bg-muted/40 p-2"><div style={{ width: `${Math.max(100, zoom * 100)}%` }}><div className="relative mx-auto aspect-[1024/711] w-full overflow-hidden rounded border border-border bg-muted" onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null; }} data-testid="template-canvas"><img src={uploadPreview} className="absolute inset-0 h-full w-full object-fill" alt="Report card template background" />{fields.map((field) => <div key={field.id} onPointerDown={(e) => onPointerDown(e, field, 'move')} className={cx('absolute flex cursor-move select-none border-2 border-primary/70 bg-primary/10 px-1', field.visible === false && 'hidden', !!selected && 'hover:bg-primary/20')} style={{ left: `${(field.x / CANVAS_WIDTH) * 100}%`, top: `${(field.y / CANVAS_HEIGHT) * 100}%`, width: `${(field.width / CANVAS_WIDTH) * 100}%`, height: `${(field.height / CANVAS_HEIGHT) * 100}%`, alignItems: field.verticalAlign === 'top' ? 'flex-start' : field.verticalAlign === 'bottom' ? 'flex-end' : 'center', justifyContent: field.align === 'left' ? 'flex-start' : field.align === 'right' ? 'flex-end' : 'center', color: field.color, fontFamily: field.fontFamily, fontSize: `${Math.max(6, field.fontSize * 0.72)}px`, fontWeight: field.fontWeight }} data-testid={`overlay-field-${field.id}`}>{field.label}<span onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, field, 'resize'); }} className="absolute -bottom-1 -right-1 h-2.5 w-2.5 cursor-se-resize rounded-sm bg-primary" /></div>)}</div></div></div></section><FieldInspector fields={fields} setField={setField} /></div></div>;
}

function FieldInspector({ fields, setField }: { fields: OverlayField[]; setField: (id: string, patch: Partial<OverlayField>) => void }) {
  const [id, setId] = useState(fields[0]?.id ?? ''); const field = fields.find((item) => item.id === id) ?? fields[0];
  if (!field) return <section className="panel p-5"><EmptyState icon={<Grid2X2 />} title="No fields yet" body="Create a template and map fields here." /></section>;
  return <section className="panel p-4"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Selected field</p><h3 className="mt-1 font-bold">Precise mapping</h3></div><Settings2 size={17} className="text-muted-foreground" /></div><select className="field mb-4" value={field.id} onChange={(e) => setId(e.target.value)} data-testid="select-overlay-field">{fields.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><div className="grid grid-cols-2 gap-3">{([['x','X'],['y','Y'],['width','Width'],['height','Height'],['fontSize','Font size']] as const).map(([key,label]) => <div key={key}><label className="field-label">{label}</label><input type="number" className="field mono py-2 text-xs" value={field[key]} onChange={(e) => setField(field.id, { [key]: Number(e.target.value) })} data-testid={`input-overlay-${key}`} /></div>)}</div><div className="mt-3 space-y-3"><div><label className="field-label">Font family</label><select className="field" value={field.fontFamily} onChange={(e) => setField(field.id, { fontFamily: e.target.value })} data-testid="select-overlay-font"><option>DM Sans</option><option>Space Mono</option><option>Georgia</option></select></div><div><label className="field-label">Weight</label><select className="field" value={field.fontWeight} onChange={(e) => setField(field.id, { fontWeight: e.target.value as 'normal' | 'bold' })} data-testid="select-overlay-weight"><option value="normal">Normal</option><option value="bold">Bold</option></select></div><div className="grid grid-cols-2 gap-3"><div><label className="field-label">Horizontal</label><select className="field" value={field.align} onChange={(e) => setField(field.id, { align: e.target.value as 'left' | 'center' | 'right' })} data-testid="select-overlay-align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div><div><label className="field-label">Vertical</label><select className="field" value={field.verticalAlign ?? 'middle'} onChange={(e) => setField(field.id, { verticalAlign: e.target.value as 'top' | 'middle' | 'bottom' })} data-testid="select-overlay-vertical-align"><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></div></div><label className="flex items-center gap-2 pt-1 text-xs"><input type="checkbox" checked={field.visible !== false} onChange={(e) => setField(field.id, { visible: e.target.checked })} data-testid="checkbox-overlay-visible" /> Visible on report card</label></div></section>;
}

function TeachersPage() {
  const teachers = useListTeachers(); const create = useCreateTeacher(); const updateAssignment = useUpdateTeacherAssignment(); const qc = useQueryClient(); const [dialog, setDialog] = useState<'create' | 'assignment' | null>(null); const [selected, setSelected] = useState<Teacher | null>(null);
  return <div className="space-y-6 rise"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Principal controls</p><h2 className="mt-1 text-3xl font-bold tracking-[-.045em]">Teachers</h2><p className="mt-2 text-sm text-muted-foreground">Create accounts and keep class access deliberate.</p></div><button className="btn btn-primary" onClick={() => setDialog('create')} data-testid="button-add-teacher"><UserPlus size={16} /> Create teacher account</button></div><section className="panel overflow-hidden"><div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Username</th><th>Assigned classes</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody>{teachers.isLoading ? <tr><td colSpan={5}><LoadingBlock lines={2} /></td></tr> : teachers.data?.map((teacher: Teacher) => <tr key={teacher.id} data-testid={`row-teacher-${teacher.id}`}><td><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-[10px] font-bold">{initials(teacher.name)}</span><b>{teacher.name}</b></div></td><td className="mono text-xs">{teacher.username}</td><td><div className="flex flex-wrap gap-1">{teacher.assignedClasses.length ? teacher.assignedClasses.map((item) => <span key={item} className="rounded bg-muted px-2 py-1 text-[10px]">{item}</span>) : <span className="text-xs text-muted-foreground">No class assignment</span>}</div></td><td><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{teacher.status}</span></td><td><div className="flex justify-end"><button className="btn btn-ghost px-2.5 py-1.5" onClick={() => { setSelected(teacher); setDialog('assignment'); }} data-testid={`button-edit-assignment-${teacher.id}`}>Edit classes</button></div></td></tr>)}</tbody></table></div></section>{dialog === 'create' && <Modal title="Create teacher account" onClose={() => setDialog(null)}><TeacherForm pending={create.isPending} onSubmit={(data) => create.mutate({ data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTeachersQueryKey() }); setDialog(null); } })} /></Modal>}{dialog === 'assignment' && selected && <Modal title={`Assigned classes · ${selected.name}`} onClose={() => setDialog(null)}><TeacherAssignmentForm teacher={selected} pending={updateAssignment.isPending} onSubmit={(assignedClasses) => updateAssignment.mutate({ teacherId: selected.id, data: { assignedClasses } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTeachersQueryKey() }); setDialog(null); } })} /></Modal>}</div>;
}
function TeacherForm({ pending, onSubmit }: { pending: boolean; onSubmit: (data: { name: string; username: string; password: string; assignedClasses: string[] }) => void }) { const [name,setName]=useState(''); const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [assigned,setAssigned]=useState(''); return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ name, username, password, assignedClasses: assigned.split(',').map((x) => x.trim()).filter(Boolean) }); }}><div><label className="field-label">Full name</label><input className="field" value={name} onChange={(e)=>setName(e.target.value)} required data-testid="input-teacher-name" /></div><div><label className="field-label">Username</label><input className="field" value={username} onChange={(e)=>setUsername(e.target.value)} required data-testid="input-teacher-username" /></div><div><label className="field-label">Temporary password</label><input type="password" minLength={8} className="field" value={password} onChange={(e)=>setPassword(e.target.value)} required data-testid="input-teacher-password" /></div><div><label className="field-label">Assigned classes <span className="font-normal">(comma separated)</span></label><input className="field" value={assigned} onChange={(e)=>setAssigned(e.target.value)} placeholder="9 / A, 10 / B" data-testid="input-teacher-classes" /></div><button className="btn btn-primary w-full" disabled={pending} data-testid="button-save-teacher">{pending ? 'Creating…' : 'Create account'}</button></form>; }
 function TeacherAssignmentForm({ teacher, pending, onSubmit }: { teacher: Teacher; pending: boolean; onSubmit: (assignedClasses: string[]) => void }) { const [assigned,setAssigned]=useState(teacher.assignedClasses.join(', ')); return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(assigned.split(',').map((x) => x.trim()).filter(Boolean)); }}><div><label className="field-label">Assigned classes <span className="font-normal">(comma separated)</span></label><input className="field" value={assigned} onChange={(e)=>setAssigned(e.target.value)} placeholder="9 / A, 10 / B" data-testid="input-edit-teacher-classes" /></div><p className="text-xs leading-5 text-muted-foreground">The teacher sees this assignment context on the dashboard and can work within these class groups.</p><button className="btn btn-primary w-full" disabled={pending} data-testid="button-save-teacher-assignment">{pending ? 'Saving…' : 'Save class assignment'}</button></form>; }

function SettingsPage() {
  const settings = useGetSchoolSettings(); const update = useUpdateSchoolSettings(); const qc = useQueryClient(); const [subjects, setSubjects] = useState(['Hindi', 'English', 'Mathematics', 'Science', 'Social Studies']); const [newSubject,setNewSubject]=useState(''); const [saved,setSaved]=useState(false);
  const [form, setForm] = useState<SchoolSettings>({ schoolName: 'M.N.I. Higher Secondary School', udiseCode: '09681301007', establishedYear: '2009', address: 'Hatim Sarai, Sambhal – 244302 (U.P.)', logoPath: '/assets/school-logo.jpeg', reportDate: '', passPercentage: 33, firstMinimum: 90, secondMinimum: 80, thirdMinimum: 70, qrColor: '#1f5d57', marksColor: '#1f5d57' });
  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);
  const setValue = (key: keyof SchoolSettings, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  const saveSettings = () => update.mutate({ data: form }, { onSuccess: (result) => { setForm(result); qc.setQueryData(getGetSchoolSettingsQueryKey(), result); setSaved(true); window.setTimeout(() => setSaved(false), 2200); } });
  return <div className="space-y-6 rise"><div><p className="eyebrow">Configuration</p><h2 className="mt-1 text-3xl font-bold tracking-[-.045em]">School settings</h2><p className="mt-2 text-sm text-muted-foreground">Keep the school identity, result rules and digital result controls in one calm place.</p></div>{settings.isLoading ? <LoadingBlock lines={5} /> : <><div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><section className="panel p-5"><div className="mb-5 flex items-center gap-3"><img src={form.logoPath || '/assets/school-logo.jpeg'} className="h-14 w-14 rounded-full object-cover" alt="School logo" /><div><p className="eyebrow">School identity</p><h3 className="font-bold">{form.schoolName}</h3></div></div><div className="space-y-4"><div><label className="field-label">Official name</label><input className="field" value={form.schoolName} onChange={(e) => setValue('schoolName', e.target.value)} data-testid="input-school-name" /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label">UDISE code</label><input className="field mono" value={form.udiseCode} onChange={(e) => setValue('udiseCode', e.target.value)} data-testid="input-udise-code" /></div><div><label className="field-label">Established</label><input className="field" value={form.establishedYear} onChange={(e) => setValue('establishedYear', e.target.value)} data-testid="input-established-year" /></div></div><div><label className="field-label">Address</label><textarea className="field min-h-20" value={form.address} onChange={(e) => setValue('address', e.target.value)} data-testid="input-school-address" /></div><div><label className="field-label">Logo path</label><input className="field" value={form.logoPath} onChange={(e) => setValue('logoPath', e.target.value)} placeholder="/assets/school-logo.jpeg" data-testid="input-logo-path" /></div><div><label className="field-label">Report date</label><input type="date" className="field" value={form.reportDate} onChange={(e) => setValue('reportDate', e.target.value)} data-testid="input-report-date" /></div></div></section><section className="panel p-5"><p className="eyebrow">Result configuration</p><h3 className="mt-1 font-bold">Subjects & grading</h3><div className="mt-5 space-y-2">{subjects.map((subject) => <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm" key={subject}><span>{subject}</span><button className="btn btn-ghost p-1.5" onClick={() => setSubjects((items) => items.filter((item) => item !== subject))} aria-label={`Remove ${subject}`} data-testid={`button-remove-subject-${subject}`}><X size={14} /></button></div>)}</div><div className="mt-4 flex gap-2"><input className="field" value={newSubject} onChange={(e)=>setNewSubject(e.target.value)} placeholder="Add subject" data-testid="input-new-subject" /><button className="btn btn-soft" onClick={() => { if (newSubject.trim()) { setSubjects((items) => [...items, newSubject.trim()]); setNewSubject(''); } }} data-testid="button-add-subject"><Plus size={15} /></button></div><div className="mt-6 border-t border-border pt-5"><label className="field-label">Pass percentage</label><div className="flex items-center gap-3"><input type="number" className="field mono" value={form.passPercentage} onChange={(e) => setValue('passPercentage', Number(e.target.value))} data-testid="input-pass-percentage" /><span className="text-sm text-muted-foreground">out of 100</span></div><div className="mt-5 grid grid-cols-3 gap-2"><div><label className="field-label">Top 1</label><input type="number" className="field mono" value={form.firstMinimum} onChange={(e) => setValue('firstMinimum', Number(e.target.value))} data-testid="input-first-threshold" /></div><div><label className="field-label">Top 2</label><input type="number" className="field mono" value={form.secondMinimum} onChange={(e) => setValue('secondMinimum', Number(e.target.value))} data-testid="input-second-threshold" /></div><div><label className="field-label">Top 3</label><input type="number" className="field mono" value={form.thirdMinimum} onChange={(e) => setValue('thirdMinimum', Number(e.target.value))} data-testid="input-third-threshold" /></div></div><p className="mt-2 text-xs text-muted-foreground">These minimums control recognition labels at 90 / 80 / 70 by default and can be changed for this school.</p></div></section></div><section className="panel p-5"><div className="flex items-center gap-3"><QrCode size={19} className="text-primary" /><div><p className="eyebrow">Public result & report output</p><h3 className="mt-1 font-bold">Digital result controls</h3></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className="field-label">QR color</label><input type="color" className="field h-10 p-1" value={form.qrColor} onChange={(e) => setValue('qrColor', e.target.value)} data-testid="input-qr-color" /></div><div><label className="field-label">Marks color</label><input type="color" className="field h-10 p-1" value={form.marksColor} onChange={(e) => setValue('marksColor', e.target.value)} data-testid="input-marks-color" /></div></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Student rows and report cards expose a QR entry point to the public result route. Signature images remain a manual report-card choice and are not auto-mapped.</p></section><button className="btn btn-primary" onClick={saveSettings} disabled={update.isPending} data-testid="button-save-settings"><Check size={15} /> {update.isPending ? 'Saving…' : saved ? 'Settings saved' : 'Save school settings'}</button></>}</div>;
}

function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) { return <div className="grid min-h-48 place-items-center p-8 text-center" data-testid="empty-state"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-secondary text-primary">{icon ?? <BookOpen size={19} />}</span><h3 className="mt-3 font-bold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>{action && <div className="mt-4">{action}</div>}</div></div>; }

function AuthenticatedApp({ user }: { user: { name: string; role: string; username: string; assignedClasses?: string[] } }) {
  const principal = user.role === 'principal';
  return <Shell user={user}><Switch><Route path="/dashboard"><DashboardPage user={user} /></Route><Route path="/students"><StudentsPage user={user} /></Route><Route path="/sessions">{principal ? <SessionsPage /> : <AccessDenied />}</Route><Route path="/templates">{principal ? <TemplatesPage /> : <AccessDenied />}</Route><Route path="/teachers">{principal ? <TeachersPage /> : <AccessDenied />}</Route><Route path="/settings">{principal ? <SettingsPage /> : <AccessDenied />}</Route><Route path="/"><DashboardPage user={user} /></Route><Route component={NotFound} /></Switch></Shell>;
}

function AccessDenied() {
  return <EmptyState icon={<ShieldCheck />} title="Principal access only" body="This area is reserved for the principal. Your account can view the assigned class, enter marks, and download report cards." />;
}

function Router() {
  const current = useGetCurrentUser();
  const [location] = useLocation();
  if (current.isLoading) return <div className="min-h-[100dvh] bg-background p-8"><div className="mx-auto max-w-3xl"><div className="skeleton h-8 w-48" /><div className="mt-6"><LoadingBlock lines={5} /></div></div></div>;
  if (location.startsWith('/result/')) return <PublicResultPage />;
  return current.data ? <AuthenticatedApp user={current.data} /> : <Switch><Route path="/"><AuthPage /></Route><Route><AuthPage /></Route></Switch>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><ErrorBoundary><Router /></ErrorBoundary></QueryClientProvider>;
}