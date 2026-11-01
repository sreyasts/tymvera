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
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 private void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 private Notification find(Context c,int id){for(StatusBarNotification n:c.getSystemService(NotificationManager.class).getActiveNotifications())if(n.getId()==id)return n.getNotification();return null;}
 @Override public void onStart(){
  Context c=getTargetContext();Bundle result=new Bundle();String id="";int code=Activity.RESULT_OK;
  try{
   c.getSystemService(NotificationManager.class).cancel(923401);c.getSystemService(NotificationManager.class).cancel(923402);
   ReminderStore.test(c);Notification test=find(c,923401);
   check(test!=null,"Test notification missing from Android notification manager");
   check(test.getSmallIcon().getResId()==R.drawable.ic_tymvera_monochrome,"Wrong small icon");
   check(test.color==android.graphics.Color.rgb(53,107,80),"Wrong app accent");
   check(Notification.CATEGORY_REMINDER.equals(test.category),"Wrong category");
   check(test.contentIntent!=null,"Missing tap action");
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
   result.putString("stream","PASS native app icon/accent, tap action, missed-reminder summary and real background exact-alarm delivery.\n");
  }catch(Throwable e){result.putString("stream","FAIL "+e+"\n");code=Activity.RESULT_CANCELED;}
  finally{
   if(!id.isEmpty())c.getSystemService(AlarmManager.class).cancel(ReminderStore.alarm(c,id,"",0));
   ReminderStore.prefs(c).edit().putBoolean("enabled",false).putString("scheduled_rows","[]").apply();ReminderStore.schedule(c);
  }
  finish(code,result);
 }
}
