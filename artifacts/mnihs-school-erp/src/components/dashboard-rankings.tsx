import { useMemo, useState } from 'react';
import { BarChart3, Medal, SlidersHorizontal, Trophy } from 'lucide-react';
import type { DashboardSummary, TopPerformer } from '@workspace/api-client-react';

type RankingTab = 'top' | 'bottom' | 'school';

function RankingTable({ items, emptyLabel }: { items: TopPerformer[]; emptyLabel: string }) {
  if (!items.length) {
    return <div className="grid min-h-32 place-items-center p-5 text-center text-sm text-muted-foreground">{emptyLabel}</div>;
  }
  return <div className="table-wrap"><table>
    <thead><tr><th>Position</th><th>Student</th><th>Class</th><th>Percentage</th></tr></thead>
    <tbody>{items.map((item, index) => <tr key={`${item.studentName}-${item.className}-${item.section}-${index}`} data-testid={`row-ranking-${item.studentName.replaceAll(' ', '-').toLowerCase()}-${index}`}>
      <td><span className="mono font-bold text-primary">#{item.position || index + 1}</span></td>
      <td className="font-bold">{item.studentName}</td>
      <td>{item.className} <span className="text-muted-foreground">/ {item.section}</span></td>
      <td className="mono">{item.percentage}%</td>
    </tr>)}</tbody>
  </table></div>;
}

export function DashboardRankings({ data }: { data: DashboardSummary }) {
  const [tab, setTab] = useState<RankingTab>('top');
  const [classFilter, setClassFilter] = useState('all');
  const classProgress = data.classProgress ?? [];
  const classes = useMemo(() => Array.from(new Set(classProgress.map((item) => item.className))).sort(), [classProgress]);
  const topByClass = data.topByClass ?? [];
  const bottomByClass = data.bottomByClass ?? [];
  const schoolTopTen = data.schoolTopTen ?? [];
  const thresholds = data.thresholds ?? [];
  const source = tab === 'top' ? topByClass : tab === 'bottom' ? bottomByClass : schoolTopTen;
  const visible = classFilter === 'all' || tab === 'school' ? source : source.filter((item) => item.className === classFilter);

  return <div className="space-y-5">
    <section className="panel overflow-hidden">
      <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
        <div><p className="eyebrow">Rankings & recognition</p><h3 className="mt-1 font-bold">Who is moving the room</h3></div>
        <div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-muted-foreground" /><select className="field w-auto py-2 text-xs" value={classFilter} onChange={(event) => setClassFilter(event.target.value)} data-testid="select-ranking-class"><option value="all">All classes</option>{classes.map((item) => <option value={item} key={item}>Class {item}</option>)}</select></div>
      </div>
      <div className="flex gap-1 border-b border-border px-5 pt-3">
        {([['top', 'Top 3 per class', Trophy], ['bottom', 'Bottom 3 per class', Medal], ['school', 'School top 10', BarChart3]] as const).map(([value, label, Icon]) => <button className={`border-b-2 px-3 pb-3 text-xs font-bold transition ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setTab(value)} key={value} data-testid={`button-ranking-${value}`}><Icon size={14} className="mr-1.5 inline" />{label}</button>)}
      </div>
      <RankingTable items={visible} emptyLabel="Rankings will appear after marks are completed." />
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <div className="panel p-5">
        <div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">Class comparison</p><h3 className="mt-1 font-bold">Completion and performance by class</h3></div><BarChart3 size={18} className="text-muted-foreground" /></div>
        <div className="space-y-4">{classProgress.map((item) => {
          const classTop = topByClass.find((rank) => rank.className === item.className);
          const classBottom = bottomByClass.find((rank) => rank.className === item.className);
          return <div className="rounded-lg border border-border p-3" key={`${item.className}-${item.section}`} data-testid={`comparison-class-${item.className}-${item.section}`}>
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">Class {item.className} <span className="font-normal text-muted-foreground">/ {item.section}</span></span><span className="mono text-xs text-primary">{item.percentage}% complete</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.percentage)}%` }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><span className="text-muted-foreground">Top result</span><b className="mt-1 block">{classTop ? `${classTop.studentName} · ${classTop.percentage}%` : 'Pending'}</b></div><div><span className="text-muted-foreground">Needs support</span><b className="mt-1 block">{classBottom ? `${classBottom.studentName} · ${classBottom.percentage}%` : 'Pending'}</b></div></div>
          </div>;
        })}</div>
      </div>
      <div className="panel p-5">
        <p className="eyebrow">Rank thresholds</p><h3 className="mt-1 font-bold">Recognition rules</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Update the minimum percentages in School settings. Rankings refresh with the next dashboard query.</p>
        <div className="mt-5 space-y-3">{thresholds.map((threshold) => <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-3" key={threshold.rank} data-testid={`threshold-${threshold.rank}`}><span className="text-sm font-bold">{threshold.label || `Rank ${threshold.rank}`}</span><span className="mono text-sm text-primary">{threshold.minimumPercentage}%+</span></div>)}</div>
      </div>
    </section>
  </div>;
}