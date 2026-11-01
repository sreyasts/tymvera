import React,{useEffect,useState} from 'react';
import {dateKey} from './model';
import {hasNativeHost,nativeRequest} from './native';
export function useNativeReminders(plan,uid){
 const [status,setStatus]=useState(null),[error,setError]=useState('');
 async function refresh(){if(hasNativeHost())try{setStatus(await nativeRequest('status'));}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();window.addEventListener('native-resume',refresh);return()=>window.removeEventListener('native-resume',refresh);},[]);
 useEffect(()=>{if(!plan||!hasNativeHost())return;const timer=setTimeout(()=>{nativeRequest('saveReminders',{plan:{...plan,days:Object.fromEntries(Object.entries(plan.days).filter(([date])=>date>=dateKey())),dayModes:Object.fromEntries(Object.entries(plan.dayModes||{}).filter(([date])=>date>=dateKey()))},uid:uid||''}).then(setStatus).catch(e=>setError(e.message));},500);return()=>clearTimeout(timer);},[plan,uid]);
 async function action(method){try{await nativeRequest(method);await refresh();setError('');}catch(e){setError(e.message);}}
 return {status,error,action};
}
export default function NativeReminders({controller}){
 const {status,error,action}=controller;if(!hasNativeHost())return null;
 return <section className="settings-section"><h2>Android reminders</h2><p>Get a native notification when a timed block starts. Anytime blocks have no reminder.</p><p>{!status?'Checking Android…':!status.enabled?'Reminders are off.':!status.notificationsGranted?'Notifications are blocked in Android settings.':`${status.scheduled} upcoming reminders scheduled. ${status.exactAlarmAllowed?'Precise timing is allowed.':'Timing may be delayed until Alarms & reminders permission is allowed.'}`}</p><div className="button-row"><button className="secondary" onClick={()=>action(status?.enabled?'disableReminders':'enableReminders')}>{status?.enabled?'Turn off reminders':'Enable reminders'}</button>{status?.enabled&&!status.notificationsGranted&&<button className="secondary" onClick={()=>action('notificationSettings')}>Notification settings</button>}{status?.enabled&&!status.exactAlarmAllowed&&<button className="secondary" onClick={()=>action('alarmSettings')}>Allow precise reminders</button>}</div><p className="fine-print">Local reminders work offline and are restored after reboot. Open this app after changing schedules on the web so this phone receives the changes. Force-stop, disabled notifications, Do Not Disturb, or device restrictions can block or silence delivery.</p>{error&&<p className="error-text" role="alert">{error}</p>}</section>;
}
