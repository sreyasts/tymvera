import {describe,it,expect} from 'vitest';
import {dueWebReminders,webNotificationOptions} from '../src/planner/webReminders';
import {emptyPlan} from '../src/planner/model';
const plan=()=>({...emptyPlan(),days:{'2026-11-01':{a:{id:'a',name:'Study',start:'09:00',duration:120,weight:4,updatedAt:1}}}});
describe('Web reminder projection',()=>{
 it('reminds only due timed tasks within the recent window',()=>{
  expect(dueWebReminders(plan(),new Date('2026-11-01T08:59:00'))).toHaveLength(0);
  expect(dueWebReminders(plan(),new Date('2026-11-01T09:00:00'))).toHaveLength(1);
  expect(dueWebReminders(plan(),new Date('2026-11-01T09:31:00'))).toHaveLength(0);
 });
 it('skips completed and untimed work',()=>{
  const p=plan();p.days['2026-11-01'].a.completed=true;
  expect(dueWebReminders(p,new Date('2026-11-01T09:00:00'))).toHaveLength(0);
  p.days['2026-11-01'].a.completed=false;p.days['2026-11-01'].a.start='';
  expect(dueWebReminders(p,new Date('2026-11-01T09:00:00'))).toHaveLength(0);
 });
 it('uses the app logo, monochrome badge, date route and a stable deduplication tag',()=>{
  const row=dueWebReminders(plan(),new Date('2026-11-01T09:00:00'))[0], options=webNotificationOptions(row);
  expect(options.icon).toContain('notification-logo.png?v=5');expect(options.badge).toBe('/notification-badge.png');
  expect(options.data.date).toBe('2026-11-01');expect(options.renotify).toBe(false);
  expect(options.tag).toBe(webNotificationOptions(row).tag);
 });
});
