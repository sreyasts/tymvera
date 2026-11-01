import {describe,it,expect} from 'vitest';
import {createNavigationHistory} from '../src/planner/navigation';
const route=(tab='today',date='2026-11-01',manageVersions=false)=>({tab,date,manageVersions});
describe('App page history',()=>{
 it('returns through visited screens before allowing native root Back',()=>{
  const history=createNavigationHistory(route());history.visit(route('progress'));history.visit(route('account'));history.visit(route('account','2026-11-01',true));
  expect(history.back()).toEqual(route('account'));expect(history.back()).toEqual(route('progress'));expect(history.back()).toEqual(route());expect(history.back()).toBeNull();
 });
 it('does not re-add restored pages or duplicate rerenders',()=>{
  const history=createNavigationHistory(route());history.visit(route());history.visit(route('account'));const previous=history.back();history.visit(previous);expect(history.back()).toBeNull();
 });
 it('retains the original root even after a long navigation session',()=>{
  const history=createNavigationHistory(route());for(let i=0;i<150;i++)history.visit(route(i%2?'account':'progress',String(i)));
  let last,next;while((next=history.back()))last=next;expect(last).toEqual(route());
 });
 it('restores the selected day and replaces forward history after a new visit',()=>{
  const history=createNavigationHistory(route());history.visit(route('today','2026-11-02'));history.visit(route('progress','2026-11-02'));
  expect(history.back()).toEqual(route('today','2026-11-02'));history.visit(route('account','2026-11-02'));expect(history.back()).toEqual(route('today','2026-11-02'));expect(history.back()).toEqual(route());
 });
});
