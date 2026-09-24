import { ArrowLeft, Download, FileText, QrCode, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { getGetPublicResultQueryKey, useGetPublicResult } from '@workspace/api-client-react';
import type { PublicResult } from '@workspace/api-client-react';

function LoadingResult() {
  return <main className="min-h-[100dvh] bg-background p-5 md:p-10"><div className="mx-auto max-w-4xl space-y-4"><div className="skeleton h-8 w-56" /><div className="skeleton h-40 w-full" /><div className="skeleton h-64 w-full" /></div></main>;
}

export function PublicResultPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = Number(params.studentId);
  const result = useGetPublicResult(studentId, { query: { queryKey: getGetPublicResultQueryKey(studentId), enabled: Number.isFinite(studentId) && studentId > 0 } });
  const data = result.data as PublicResult | undefined;
  if (result.isLoading) return <LoadingResult />;
  if (result.isError || !data) return <main className="grid min-h-[100dvh] place-items-center bg-background p-5"><div className="panel max-w-md p-8 text-center"><ShieldCheck className="mx-auto text-destructive" size={28} /><h1 className="mt-4 text-xl font-bold">Result unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This digital result link is invalid or is not published yet.</p><Link href="/" className="btn btn-soft mt-6" data-testid="link-result-home"><ArrowLeft size={15} /> Return to school portal</Link></div></main>;
  return <main className="min-h-[100dvh] bg-background p-5 md:p-10">
    <div className="public-result-print mx-auto max-w-4xl rise">
      <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><img src={data.school.logoPath || '/assets/school-logo.jpeg'} className="h-12 w-12 rounded-full object-cover" alt={`${data.school.schoolName} logo`} /><div><p className="eyebrow">Verified digital result</p><h1 className="text-xl font-bold">{data.school.schoolName}</h1><p className="text-xs text-muted-foreground">{data.school.address}</p></div></div><Link href="/" className="btn btn-ghost w-fit" data-testid="link-result-back"><ArrowLeft size={15} /> School portal</Link></header>
      <section className="mt-7 grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div className="panel p-5"><div className="flex items-start justify-between"><div><p className="eyebrow">Student record</p><h2 className="mt-1 text-2xl font-bold">{data.student.name}</h2><p className="mt-2 text-sm text-muted-foreground">Class {data.student.className} / {data.student.section}</p></div><QrCode className="text-primary" size={28} /></div><div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm"><div><span className="eyebrow">SR number</span><b className="mono mt-1 block">{data.student.srNumber}</b></div><div><span className="eyebrow">Position</span><b className="mono mt-1 block">#{data.marks.position || '—'}</b></div><div><span className="eyebrow">Percentage</span><b className="mono mt-1 block text-primary">{data.marks.percentage}%</b></div><div><span className="eyebrow">Grade</span><b className="mono mt-1 block">{data.marks.grade}</b></div></div></div>
        <div className="panel overflow-hidden p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Marks summary</p><h2 className="mt-1 font-bold">Official subject record</h2></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{data.marks.resultStatus}</span></div><div className="table-wrap mt-4"><table><thead><tr><th>Subject</th><th>Quarterly 1</th><th>Half yearly</th><th>Quarterly 2</th><th>Annual</th></tr></thead><tbody>{data.marks.rows.map((row) => <tr key={row.subject}><td className="font-bold">{row.subject}</td><td className="mono">{row.quarterlyOne}</td><td className="mono">{row.halfYearly}</td><td className="mono">{row.quarterlyTwo}</td><td className="mono">{row.annual}</td></tr>)}</tbody></table></div></div>
      </section>
      <section className="panel mt-5 p-5"><div className="flex items-center gap-2"><FileText size={16} className="text-primary" /><p className="eyebrow">Digital copy</p></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{data.digitalCopyText}</p><button className="btn btn-primary mt-5" onClick={() => window.print()} data-testid="button-print-public-result"><Download size={15} /> Print result</button></section>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} className="text-primary" /> Published by {data.school.schoolName}. Verify the student identity before sharing.</p>
    </div>
  </main>;
}