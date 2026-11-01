package app.web.tymvera.twa;

import android.app.*;
import android.content.*;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;
import java.text.SimpleDateFormat;
import java.util.*;
import org.json.*;

/** Emulator-only integration check. No account, network, or UI automation required. */
public class NotificationSmokeInstrumentation extends Instrumentation {
 @Override public void onCreate(Bundle args){super.onCreate(args);mode=args==null?"":args.getString("mode","");start();}
 private String mode="";
 private String js(android.webkit.WebView web,String script)throws Exception{java.util.concurrent.CountDownLatch done=new java.util.concurrent.CountDownLatch(1);String[] result={""};runOnMainSync(()->web.evaluateJavascript(script,value->{result[0]=value;done.countDown();}));check(done.await(10,java.util.concurrent.TimeUnit.SECONDS),"JavaScript response timed out");return result[0];}
 private void waitFor(android.webkit.WebView web,String expression)throws Exception{long until=System.currentTimeMillis()+30000;while(System.currentTimeMillis()<until){if("true".equals(js(web,expression)))return;Thread.sleep(100);}throw new AssertionError("Page condition failed: "+expression);}
 private void back(MainActivity activity,android.webkit.WebView web,String text)throws Exception{runOnMainSync(()->activity.getOnBackPressedDispatcher().onBackPressed());waitFor(web,"document.querySelector('h1')?.textContent.includes("+JSONObject.quote(text)+")");check(!activity.isFinishing(),"Back closed the app");}
 private void navigation()throws Exception{
  MainActivity activity=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  android.webkit.WebView web=(android.webkit.WebView)((android.view.ViewGroup)activity.findViewById(android.R.id.content)).getChildAt(0);
  waitFor(web,"typeof window.__tymveraHandleBack==='function'&&!!document.querySelector('nav button')");
  js(web,"[...document.querySelectorAll('nav button')].find(b=>b.textContent.trim()==='Progress').click()");waitFor(web,"document.querySelector('h1')?.textContent.includes('progress')");
  js(web,"[...document.querySelectorAll('nav button')].find(b=>b.textContent.trim()==='Account').click()");waitFor(web,"document.querySelector('h1')?.textContent.includes('Your space')");
  js(web,"[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Manage day presets').click()");waitFor(web,"document.querySelector('h1')?.textContent.includes('Day presets')");
  back(activity,web,"Your space");back(activity,web,"progress");back(activity,web,"Today");
  check("false".equals(js(web,"window.__tymveraHandleBack()")),"Root Back should allow leaving only after page history is exhausted");
 }
 private void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 private void checkLogo(Context c,Notification notification,String message){
  check(notification!=null&&notification.getLargeIcon()!=null,message+": no image");
  android.graphics.drawable.Drawable drawable=notification.getLargeIcon().loadDrawable(c);
  check(drawable instanceof android.graphics.drawable.BitmapDrawable,message+": not a bitmap");
  android.graphics.Bitmap actual=((android.graphics.drawable.BitmapDrawable)drawable).getBitmap(),original=ReminderStore.brandLogo(c);
  android.graphics.Bitmap expected=android.graphics.Bitmap.createScaledBitmap(original,actual.getWidth(),actual.getHeight(),true);
  long difference=0;for(int y=0;y<actual.getHeight();y++)for(int x=0;x<actual.getWidth();x++){int a=actual.getPixel(x,y),b=expected.getPixel(x,y);for(int shift=0;shift<32;shift+=8)difference+=Math.abs(((a>>>shift)&255)-((b>>>shift)&255));}
  double average=difference/(actual.getWidth()*actual.getHeight()*4.0);
  Bundle evidence=new Bundle();evidence.putString("stream","Logo pixels: supplied "+original.getWidth()+"x"+original.getHeight()+", Android "+actual.getWidth()+"x"+actual.getHeight()+", mean channel difference "+average+"\n");sendStatus(1,evidence);
  check(average<2,message+": pixel difference "+average);
 }
 private Notification find(Context c,int id){for(StatusBarNotification n:c.getSystemService(NotificationManager.class).getActiveNotifications())if(n.getId()==id)return n.getNotification();return null;}
 private Notification awaitNotification(Context c,int id,boolean large)throws Exception{long until=System.currentTimeMillis()+5000;Notification n=null;while(System.currentTimeMillis()<until){n=find(c,id);if(n!=null&&(!large||n.getLargeIcon()!=null))return n;Thread.sleep(50);}return n;}
 @Override public void onStart(){
  if("navigation".equals(mode)){Bundle result=new Bundle();try{navigation();result.putString("stream","PASS native Back: presets -> Account -> Progress -> Today; root exit allowed only after history.\n");finish(Activity.RESULT_OK,result);}catch(Throwable e){result.putString("stream","FAIL native Back: "+e+"\n");finish(Activity.RESULT_CANCELED,result);}return;}
  Context c=getTargetContext();Bundle result=new Bundle();String id="";int code=Activity.RESULT_OK;
  try{
   c.getSystemService(NotificationManager.class).cancel(923401);c.getSystemService(NotificationManager.class).cancel(923402);
   ReminderStore.test(c);Notification test=awaitNotification(c,923401,true);
   check(test!=null,"Test notification missing from Android notification manager");
   check(test.getSmallIcon().getResId()==R.drawable.ic_tymvera_monochrome,"Wrong small icon");
   check(test.color==android.graphics.Color.rgb(53,107,80),"Wrong app accent");
   check(Notification.CATEGORY_REMINDER.equals(test.category),"Wrong category");
   check(test.contentIntent!=null,"Missing tap action");
   checkLogo(c,test,"Notification card uses the wrong logo");
   c.getSystemService(NotificationManager.class).notify(923403,new androidx.core.app.NotificationCompat.Builder(c,ReminderStore.CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Legacy card branding check").setContentText("Existing notification").setContentIntent(test.contentIntent).build());
   check(awaitNotification(c,923403,false)!=null,"Legacy test card was not posted");
   ReminderStore.prefs(c).edit().putInt("notification_brand",4).apply();ReminderStore.channel(c);
   Notification refreshed=awaitNotification(c,923403,true);check(refreshed!=null&&refreshed.getLargeIcon()!=null,"Existing card was not refreshed");
   checkLogo(c,refreshed,"Existing card retained its old logo");
   String date=new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date());
   String missed=date+":smoke-missed";long now=System.currentTimeMillis();
   ReminderStore.prefs(c).edit().remove("done:"+missed).putBoolean("enabled",true).putString("plan","{}").putLong("updated",now-600000).putString("scheduled_rows",new JSONArray().put(new JSONObject().put("id",missed).put("name","Missed smoke block").put("time",now-300000)).toString()).apply();
   ReminderStore.schedule(c);
   check(find(c,923402)!=null,"Missing recent missed-reminder summary");
   check(ReminderStore.prefs(c).getBoolean("done:"+missed,false),"Missed reminder receipt not saved");
   check(ReminderStore.exact(c),"Allow exact alarms for this emulator test");
   id=date+":smoke-background";c.getSystemService(NotificationManager.class).cancel(id.hashCode());ReminderStore.prefs(c).edit().remove("done:"+id).apply();long time=System.currentTimeMillis()+20000;
   c.getSystemService(AlarmManager.class).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,time,ReminderStore.alarm(c,id,"Background smoke block",time));
   Bundle waiting=new Bundle();waiting.putString("stream","Waiting for real background alarm; device may enter idle now.\n");sendStatus(1,waiting);
   long deadline=time+25000;while(System.currentTimeMillis()<deadline&&find(c,id.hashCode())==null)Thread.sleep(500);
   check(find(c,id.hashCode())!=null,"Background exact alarm did not post a notification");
   check(ReminderStore.prefs(c).getBoolean("done:"+id,false),"Background alarm delivery receipt missing");
   result.putString("stream","PASS current full-colour card logo, old-card refresh, app icon/accent, tap action, missed-reminder summary and real background exact-alarm delivery.\n");
  }catch(Throwable e){result.putString("stream","FAIL "+e+"\n");code=Activity.RESULT_CANCELED;}
  finally{
   if(!id.isEmpty())c.getSystemService(AlarmManager.class).cancel(ReminderStore.alarm(c,id,"",0));
   ReminderStore.prefs(c).edit().putBoolean("enabled",false).putString("scheduled_rows","[]").apply();ReminderStore.schedule(c);
  }
  finish(code,result);
 }
}
