const pending = new Map();
let sequence = 0;
export const hasNativeHost = () => typeof window !== 'undefined' && typeof window.NativeAndroid?.request === 'function';
if (typeof window !== 'undefined') window.__tymveraNativeResult = (id, response) => {
  const request = pending.get(id); if (!request) return;
  pending.delete(id); clearTimeout(request.timer);
  if (response.ok) request.resolve(response.value); else request.reject(new Error(response.error || 'Android could not complete this action.'));
};
export function nativeRequest(method, payload={}) {
  if (!hasNativeHost()) return Promise.reject(new Error('This action is available in the Android app.'));
  return new Promise((resolve,reject)=>{
    const id=String(++sequence);
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Android did not respond. Reopen the app and try again.'));},method==='signIn'?120000:20000);
    pending.set(id,{resolve,reject,timer});
    try{window.NativeAndroid.request(id,method,JSON.stringify(payload));}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
  });
}
