package app.web.tymvera.twa;
import android.app.*;
import android.content.*;
import android.os.Build;
import android.net.Uri;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.*;
import java.util.*;
import java.text.SimpleDateFormat;

public final class ReminderStore {
 static final String CHANNEL="tymvera_blocks_v3";
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("native_reminders",0);}
 static void channel(Context c){if(Build.VERSION.SDK_INT>=26)c.getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL,"Block reminders",NotificationManager.IMPORTANCE_HIGH));}
 static boolean exact(Context c){return Build.VERSION.SDK_INT<31||c.getSystemService(AlarmManager.class).canScheduleExactAlarms();}
 static PendingIntent alarm(Context c,String id,String name,long time){Intent i=new Intent(c,ReminderReceiver.class).setAction("tymvera.REMIND").setData(Uri.parse("tymvera-alarm:"+Uri.encode(id))).putExtra("name",name).putExtra("id",id).putExtra("time",time);return PendingIntent.getBroadcast(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static synchronized void save(Context c,JSONObject plan){prefs(c).edit().putString("plan",plan.toString()).putLong("updated",System.currentTimeMillis()).commit();schedule(c);}
 static synchronized void schedule(Context c){
  channel(c);AlarmManager manager=c.getSystemService(AlarmManager.class);
  try{
   JSONArray old=new JSONArray(prefs(c).getString("scheduled","[]"));for(int n=0;n<old.length();n++)manager.cancel(alarm(c,old.getString(n),"",0));
   JSONArray scheduled=new JSONArray();if(prefs(c).getBoolean("enabled",false)&&NotificationManagerCompat.from(c).areNotificationsEnabled()){
    JSONArray rows=NativePlan.rows(new JSONObject(prefs(c).getString("plan","{}")));long now=System.currentTimeMillis();
    for(int n=0;n<Math.min(rows.length(),200);n++){JSONObject row=rows.getJSONObject(n);long when=row.optLong("time");if(when<=now)continue;String id=row.getString("id");PendingIntent pi=alarm(c,id,row.optString("name","Your block"),when);
     if(exact(c))manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);scheduled.put(id);
    }
   }prefs(c).edit().putString("scheduled",scheduled.toString()).apply();
   if(prefs(c).getBoolean("enabled",false)){Calendar next=Calendar.getInstance();next.add(Calendar.DAY_OF_YEAR,1);next.set(Calendar.HOUR_OF_DAY,0);next.set(Calendar.MINUTE,10);next.set(Calendar.SECOND,0);Intent refresh=new Intent(c,ReminderReceiver.class).setAction("tymvera.REFRESH");manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next.getTimeInMillis(),PendingIntent.getBroadcast(c,1,refresh,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));}

  }catch(Exception e){prefs(c).edit().putString("error","Reminders could not be scheduled. Reopen the app.").apply();}
 }
 static void deliver(Context c,Intent intent){
  if(!prefs(c).getBoolean("enabled",false)||!NotificationManagerCompat.from(c).areNotificationsEnabled())return;
  String id=intent.getStringExtra("id");if(id==null||prefs(c).getBoolean("done:"+id,false))return;
  // Do not deliver stale reminders hours after a device is turned back on.
  if(System.currentTimeMillis()-intent.getLongExtra("time",0)>30*60*1000L)return;
  Intent open=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
  PendingIntent click=PendingIntent.getActivity(c,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  try{NotificationManagerCompat.from(c).notify(id.hashCode(),new NotificationCompat.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_tymvera_monochrome).setContentTitle(intent.getStringExtra("name")).setContentText("Your planned block starts now.").setContentIntent(click).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).build());prefs(c).edit().putBoolean("done:"+id,true).apply();}catch(SecurityException ignored){}
 }
 static JSONObject status(Context c)throws JSONException{return new JSONObject().put("enabled",prefs(c).getBoolean("enabled",false)).put("notificationsGranted",NotificationManagerCompat.from(c).areNotificationsEnabled()).put("exactAlarmAllowed",exact(c)).put("updatedAt",prefs(c).getLong("updated",0)).put("scheduled",new JSONArray(prefs(c).getString("scheduled","[]")).length());}
}
