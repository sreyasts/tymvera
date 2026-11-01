import { describe, expect, it } from 'vitest';
import { parsePlannerBackup } from '../src/planner/backups';
import { emptyPlan, mergePlans, updateDay } from '../src/planner/model';

describe('Old Android and web backups', () => {
  const preset = { id:'read', name:'Read a chapter', start:'09:00', end:'09:30', days:[0,1,2,3,4,5,6] };
  const legacy = { format:'tymvera-legacy-android', version:1, history:{ '2026-10-20': {date:'2026-10-20',blocksList:[preset],blocks:{read:{status:'completed'}}} }, presets:[preset] };
  it('imports the old APK recovery format with completion history', async () => {
    const result = await parsePlannerBackup(JSON.stringify(legacy));
    expect(result.days['2026-10-20']['r-read'].completed).toBe(true);
    expect(result.days['2026-10-20']['r-read'].duration).toBe(30);
    expect(result.routines.read.name).toBe('Read a chapter');
  });
  it('retains a newer web undo when old APK completion is imported', async () => {
    const imported = await parsePlannerBackup(JSON.stringify(legacy));
    const newer = updateDay(emptyPlan(),'2026-10-20',[{...imported.days['2026-10-20']['r-read'],completed:false,updatedAt:Date.now()}]);
    expect(mergePlans(newer,imported).days['2026-10-20']['r-read'].completed).toBe(false);
  });
  it('accepts current backups and rejects empty or unrecognized files', async () => {
    expect(await parsePlannerBackup(JSON.stringify(emptyPlan()))).toEqual(emptyPlan());
    await expect(parsePlannerBackup('{}')).rejects.toThrow();
    await expect(parsePlannerBackup('invalid')).rejects.toThrow();
  });
});
