import {useEffect,useLayoutEffect,useRef} from 'react';

const layers=new Map();
export function useBackLayer(active,onBack) {
  const callback=useRef(onBack);callback.current=onBack;
  useEffect(()=>{
    if(!active)return;
    const id=Symbol('back-layer');layers.set(id,()=>callback.current());
    return()=>layers.delete(id);
  },[active]);
}
function closeTopLayer() {
  const entry=[...layers.entries()].at(-1);
  if(!entry)return false;
  layers.delete(entry[0]);entry[1]();return true;
}
const sameRoute=(a,b)=>a.tab===b.tab&&a.date===b.date&&a.manageVersions===b.manageVersions;
export function createNavigationHistory(initial) {
  let current={...initial};const previous=[];
  return {
    visit(route){if(sameRoute(current,route))return;previous.push(current);if(previous.length>100)previous.splice(1,1);current={...route};},
    back(){if(!previous.length)return null;current=previous.pop();return {...current};},
  };
}
export function useAppBack(route,restore) {
  const history=useRef(null),restoreRef=useRef(restore);
  restoreRef.current=restore;
  if(!history.current)history.current=createNavigationHistory(route);
  useLayoutEffect(()=>history.current.visit(route),[route.tab,route.date,route.manageVersions]);
  const back=()=>{
    const previous=history.current.back();
    if(!previous)return false;
    restoreRef.current(previous);return true;
  };
  const backRef=useRef(back);backRef.current=back;
  useEffect(()=>{
    const handler=()=>closeTopLayer()||backRef.current();
    window.__tymveraHandleBack=handler;
    return()=>{if(window.__tymveraHandleBack===handler)delete window.__tymveraHandleBack;};
  },[]);
  return back;
}
