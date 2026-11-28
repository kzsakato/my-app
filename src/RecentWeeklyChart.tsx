import { contributionLabels } from './canonical/contributions'
import { recentWeeklyComparison } from './canonical/analysisV14'
import type { CanonicalAppData } from './canonical/types'
export function RecentWeeklyChart({data,today,colors}:{data:CanonicalAppData;today:string;colors:string[]}) {
 const {n,rows}=recentWeeklyComparison(data,today),max=Math.max(1,...rows.map(r=>r.allocated)),ys=[35,125,215,320]
 const end=(r:number,i:number)=>190+410*rows[r].regions.slice(0,i+1).reduce((a,b)=>a+b,0)/max
 const ready=(i:number)=>rows[i].state==='AVAILABLE'&&rows[i].allocated>0
 return <section aria-label="最近の部位別トレーニング量"><h3>最近の部位別トレーニング量</h3>
 <svg className="v14-weekly" viewBox="0 0 640 380" role="img" aria-label="週固定4行・部位別積上げD、未配賦Uは棒外">
 {rows.slice(0,3).flatMap((_,r)=>ready(r)&&ready(r+1)?contributionLabels.map((_,i)=><line key={`${r}-${i}`} data-weekly-boundary={`${r}-${i}`} x1={end(r,i)} y1={ys[r]+7} x2={end(r+1,i)} y2={ys[r+1]-7} stroke={colors[i]} strokeDasharray="2 4" strokeWidth="1.3"/>):[])}
 {rows.map((row,r)=><g key={row.label} data-weekly-state={row.state}><text x="0" y={ys[r]-7}>{row.label}</text><text x="0" y={ys[r]+18}>{r===3?`N=${n}`:row.start}</text>
 {row.state!=='AVAILABLE'?<text x="190" y={ys[r]+5}>{row.state==='UNAVAILABLE'?'取得不能':'履歴不足'}</text>:<>
 {row.allocated>0?row.regions.map((v,i)=><rect key={i} data-weekly-part={`${r}-${i}`} x={i?end(r,i-1):190} y={ys[r]-7} width={410*v/max} height="14" fill={colors[i]}><title>{contributionLabels[i]} {Number(v.toFixed(2))}</title></rect>):<text x="190" y={ys[r]+5}>{row.unallocated?'D=0・実施あり':'0・実施なし'}</text>}
 <text x="0" y={ys[r]+44}>D {Number(row.allocated.toFixed(2))} / U {Number(row.unallocated.toFixed(2))}</text></>}
 </g>)}
 </svg><div className="v14-body-legend">{contributionLabels.map((label,i)=><span key={label} style={{color:colors[i]}}>● {label}</span>)}</div>
 {rows[3].state==='AVAILABLE'?<p role="status">平均未配賦：{Number(rows[3].unallocated.toFixed(2))}セット／週</p>:<p role="status">{rows[3].state==='UNAVAILABLE'?'必要な分析情報を取得できません。':'完了週の履歴が不足しています。'}</p>}
 </section>
}
