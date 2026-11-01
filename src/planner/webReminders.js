import {useEffect,useState} from 'react';
import {blocksForDay,dateKey} from './model';
import {hasNativeHost} from './native';

export function dueWebReminders(plan, now = new Date()) {
  const date=dateKey(now);
  return blocksForDay(plan,date).filter(b=>b.start && !b.completed).map(b=>{
    const time=new Date(`${date}T${b.start}:00`).getTime();
    return {id:`${plan.resetAt||0}:${date}:${b.id}:${b.start}`,date,name:b.name,time,start:b.start,duration:b.duration};
  }).filter(row=>now.getTime()>=row.time && now.getTime()-row.time<=30*60000);
}
export function webNotificationOptions(row) {
  return {body:`${row.start} · ${row.duration} planned minutes. Open your plan to log time.`,
    icon:'/icon-192.png?v=4',badge:'/notification-badge.png',tag:`tymvera:${row.id}`,
    renotify:false,data:{date:row.date},actions:[{action:'open',title:'Open plan'}]};
}
async function registration() {
  const result=await navigator.serviceWorker.getRegistration();
  if (!result?.active) throw new Error('Notifications are not ready. Reload the app and try again.');
  return result;
}
export function useWebReminders(plan,uid) {
  const key=`tymvera_web_reminders_${uid||'guest'}`;
  const supported=!hasNativeHost() && typeof Notification!=='undefined' && 'serviceWorker' in navigator && window.isSecureContext;
  const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(key)==='true';}catch{return false;}});
  const [permission,setPermission]=useState(supported?Notification.permission:'unsupported');
  const [error,setError]=useState(''),[testSent,setTestSent]=useState(false);
  useEffect(()=>{
    if (!supported || !plan || !enabled) return;
    let running=false;
    async function tick() {
      setPermission(Notification.permission);
      if (Notification.permission!=='granted' || running) return;
      running=true;
      try {
        const reg=await registration();
        for(const row of dueWebReminders(plan)) {
          const receipt=`${key}:sent:${row.id}`;
          if(localStorage.getItem(receipt))continue;
          await reg.showNotification(row.name,webNotificationOptions(row));
          localStorage.setItem(receipt,String(Date.now()));
        }
      }catch(e){setError(e.message);}finally{running=false;}
    }
    tick();const timer=setInterval(tick,15000);
    window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);
    return()=>{clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};
  },[supported,plan,enabled,key]);
  async function toggle() {
    try {
      if(!supported)throw new Error('This browser does not support notifications. Use the Android app for reminders.');
      if(!enabled) {
        const value=await Notification.requestPermission();setPermission(value);
        if(value!=='granted')throw new Error('Allow notifications for tymvera.web.app in your browser settings, then retry.');
        await registration();
      }
      localStorage.setItem(key,String(!enabled));setEnabled(!enabled);setError('');
    }catch(e){setError(e.message);}
  }
  async function test() {
    try {
      if(Notification.permission!=='granted')throw new Error('Enable web reminders first.');
      const reg=await registration();
      await reg.showNotification('TYMVERA · Test reminder',{...webNotificationOptions({id:'test',date:dateKey(),start:'Now',duration:1}),body:'Your web notifications are working. The system controls their light or dark appearance.'});
      setTestSent(true);setError('');
    }catch(e){setError(e.message);}
  }
  return {supported,enabled,permission,error,testSent,toggle,test};
}
