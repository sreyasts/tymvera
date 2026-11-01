import {describe, it, expect} from 'vitest';
import {emptyPlan, blocksForDay, dayStats, saveRoutineVersion, selectDayVersion, renameTask, mergePlans, blockEnd, recordTaskTime} from '../src/planner/model';
import {progressSeries, taskTotals, groupProgress} from '../src/planner/progress';
const row=(id,weight=2,extra={})=>({id,name:id,start:'09:00',duration:120,weight,updatedAt:10,...extra});
function plan(){return {...emptyPlan(),trackingStart:'2026-11-01',templates:{weekday:{id:'weekday',name:'Weekdays',autoDays:[1,2,3,4,5],blocks:[row('study',4)],updatedAt:10},sat:{id:'sat',name:'Saturday',autoDays:[6],blocks:[row('gym',2)],updatedAt:10},sun:{id:'sun',name:'Sunday',autoDays:[0],blocks:[row('skills',4)],updatedAt:10}}};}
describe('Weighted automatic day presets',()=>{
 it('records partial hours proportionally, fills planned time, and clears it without changing the preset',()=>{
  let p=plan(); const date='2026-11-02';
  p=recordTaskTime(p,date,'study',90); expect(dayStats(blocksForDay(p,date)).percent).toBe(75); expect(p.days[date].study.completed).toBe(false);
  p=recordTaskTime(p,date,'study',120); expect(dayStats(blocksForDay(p,date)).percent).toBe(100); expect(p.days[date].study.completed).toBe(true);
  p=recordTaskTime(p,date,'study',0); expect(dayStats(blocksForDay(p,date)).percent).toBe(0); expect(p.templates.weekday.blocks[0].duration).toBe(120);
  expect(()=>recordTaskTime(p,date,'study',1441)).toThrow();expect(()=>recordTaskTime(p,date,'study',2.5)).toThrow();
 });
 it('switches weekday, Saturday and Sunday without saving daily selections',()=>{
  const p=plan(); expect(blocksForDay(p,'2026-11-02')[0].name).toBe('study'); expect(blocksForDay(p,'2026-11-07')[0].name).toBe('gym'); expect(blocksForDay(p,'2026-11-08')[0].name).toBe('skills'); expect(blocksForDay(p,'2026-10-31')).toEqual([]);
 });
 it('overrides one date and returns to automatic, preserving completions',()=>{
  let p=plan(); p.days['2026-11-07']={gym:row('gym',2,{completed:true})}; p=selectDayVersion(p,'2026-11-07','weekday');
  expect(blocksForDay(p,'2026-11-07').map(b=>b.name).sort()).toEqual(['gym','study']); expect(blocksForDay(p,'2026-11-08')[0].name).toBe('skills');
 });
 it('keeps partially logged work when switching presets',()=>{
  let p=plan();p=recordTaskTime(p,'2026-11-07','gym',30);p=selectDayVersion(p,'2026-11-07','weekday');
  expect(blocksForDay(p,'2026-11-07').find(b=>b.id==='gym')).toMatchObject({actualMinutes:30,completed:false});
 });
 it('weights by importance rather than long duration and aggregates charts consistently',()=>{
  const stats=dayStats([row('Study',4,{completed:true}),row('Rest',1,{duration:480})]); expect(stats.percent).toBe(80);
  const grouped=groupProgress(Array.from({length:35},(_,i)=>({date:`2026-11-${String((i%28)+1).padStart(2,'0')}`,done:1,total:2,minutes:120,totalWeight:5,doneWeight:4})));
  expect(grouped.every(g=>g.percent===80)).toBe(true);
 });
 it('keeps old schedule and weights after preset edits; rename preserves logged work',()=>{
  let p=plan();p=saveRoutineVersion(p,{...p.templates.weekday,blocks:[row('study',1,{duration:30})],updatedAt:20},'2026-11-05');
  expect(blocksForDay(p,'2026-11-02')[0].duration).toBe(120);expect(blocksForDay(p,'2026-11-06')[0].weight).toBe(1);
  p.days['2026-11-02']={study:row('study',4,{completed:true,actualMinutes:93})};p=renameTask(p,'study','StUdY');expect(blocksForDay(p,'2026-11-02')[0]).toMatchObject({name:'StUdY',actualMinutes:93,completed:true,weight:4});
 });
 it('splits any overnight task at midnight, including a range starting the next morning',()=>{
  const p=emptyPlan();p.days['2026-11-01']={night:row('Night shift',1,{start:'22:00',duration:480,completed:true})};
  expect(blockEnd(p.days['2026-11-01'].night)).toEqual({time:'06:00',nextDay:true});
  const series=progressSeries(p,2,'','2026-11-02');expect(series.map(d=>d.minutes)).toEqual([120,360]);expect(series.map(d=>d.done)).toEqual([1,0]);
  expect(taskTotals(p,['2026-11-02'])[0].minutes).toBe(360);
 });
 it('does not resurrect reset progress from a stale device in either merge order',()=>{
  const old=plan(),fresh={...emptyPlan(),resetAt:100,trackingStart:'2026-11-01'};expect(mergePlans(old,fresh)).toEqual(fresh);expect(mergePlans(fresh,old)).toEqual(fresh);
 });
});
