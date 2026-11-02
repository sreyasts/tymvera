import React,{useEffect,useState} from 'react';
import {hasNativeHost,nativeRequest} from './native';

export function useNativeUpdates(){
 const [status,setStatus]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){try{setStatus(await nativeRequest('updateStatus'));}catch(e){setError(e.message);}}
 useEffect(()=>{
  if(!hasNativeHost())return;
  let alive=true;
  nativeRequest('updateStatus').then(value=>{if(alive)setStatus(value);return nativeRequest('checkUpdates');}).then(value=>{if(alive){setStatus(value);setError('');}}).catch(e=>{if(alive)setError(e.message);});
  const check=()=>nativeRequest('checkUpdates').then(value=>{if(alive){setStatus(value);setError('');}}).catch(e=>{if(alive)setError(e.message);});
  const resume=()=>{refresh();check();};window.addEventListener('native-resume',resume);
  const timer=setInterval(()=>{if(document.visibilityState==='visible')check();},15*60*1000);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('native-resume',resume);};
 },[]);
 useEffect(()=>{
  if(!hasNativeHost()||!['downloading','verifying'].includes(status?.state))return;
  const timer=setInterval(refresh,1500);return()=>clearInterval(timer);
 },[status?.state]);
 async function action(method){
  setBusy(true);setError('');
  try{const result=await nativeRequest(method,method==='checkUpdates'?{force:true}:{});if(result&&typeof result==='object')setStatus(result);else await refresh();}
  catch(e){setError(e.message);await refresh();}finally{setBusy(false);}
 }
 return {status,error,busy,action};
}
function UpdateButton({controller}){
 const {status,busy,action}=controller;if(!status?.available)return null;
 const working=['downloading','verifying'].includes(status.state);
 const install=['ready','permission'].includes(status.state);
 return <button className="primary compact" disabled={busy||working} onClick={()=>action(install?'installUpdate':'startUpdate')}>
  {busy?'Please wait…':status.state==='downloading'?`Downloading ${status.progress}%`:status.state==='verifying'?'Verifying…':status.state==='permission'?'Continue update':'Update'}
 </button>;
}
export function UpdateNotice({controller}){
 const {status,error}=controller;if(!hasNativeHost()||!status?.available)return null;
 return <aside className="update-notice" aria-label="App update"><div><strong>TYMVERA {status.version} is available</strong><p>{status.state==='permission'?'Allow updates from TYMVERA in Android settings, then continue.':['downloading','verifying'].includes(status.state)?'Your plan stays usable while the update downloads.':'Update the app and keep your plan and progress.'}</p>{(error||status.error)&&<p role="alert" className="error-text">{error||status.error}</p>}</div><UpdateButton controller={controller}/></aside>;
}
export default function NativeUpdates({controller}){
 if(!hasNativeHost())return null;
 const {status,error,busy,action}=controller;
 return <section className="settings-section"><h2>App version</h2><p>{status?`TYMVERA ${status.installedVersion}`:'Checking app version…'}{status?.available?` · ${status.version} available`:''}</p><div className="button-row"><button className="secondary" disabled={busy} onClick={()=>action('checkUpdates')}>{busy?'Checking…':'Check for updates'}</button><UpdateButton controller={controller}/></div>{(error||status?.error)&&<p className="error-text" role="alert">{error||status.error}</p>}<p className="fine-print">Update appears only for a newer published version. Android downloads the update, then asks you to approve installation. Your saved plan stays in place.</p></section>;
}
