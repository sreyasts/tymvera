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
 static void channel(Context c){if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel(CHANNEL,"Block reminders",NotificationManager.IMPORTANCE_HIGH);channel.setDescription("Your scheduled blocks and recent missed reminders");channel.enableVibration(true);c.getSystemService(NotificationManager.class).createNotificationChannel(channel);}refreshBranding(c);}
 static android.graphics.Bitmap brandLogo(Context c){return android.graphics.BitmapFactory.decodeResource(c.getResources(),R.drawable.tymvera_notification_logo_v5);}
 static void refreshBranding(Context c){
  if(prefs(c).getInt("notification_brand",0)>=5)return;
  try{
   for(android.service.notification.StatusBarNotification active:c.getSystemService(NotificationManager.class).getActiveNotifications()){
    Notification old=active.getNotification();android.os.Bundle extras=old.extras==null?new android.os.Bundle():old.extras;String channel=Build.VERSION.SDK_INT>=26?old.getChannelId():CHANNEL;
    if(channel==null)channel=CHANNEL;
    NotificationCompat.Builder updated=new NotificationCompat.Builder(c,channel)
     .setSmallIcon(R.drawable.ic_tymvera_monochrome).setLargeIcon(brandLogo(c)).setColor(android.graphics.Color.rgb(53,107,80)).setSubText("TYMVERA")
     .setContentTitle(extras.getCharSequence(Notification.EXTRA_TITLE)).setContentText(extras.getCharSequence(Notification.EXTRA_TEXT))
     .setStyle(new NotificationCompat.BigTextStyle().bigText(extras.getCharSequence(Notification.EXTRA_BIG_TEXT,extras.getCharSequence(Notification.EXTRA_TEXT))))
     .setContentIntent(old.contentIntent).setWhen(old.when).setAutoCancel((old.flags&Notification.FLAG_AUTO_CANCEL)!=0)
     .setCategory(old.category).setPriority(old.priority).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setOnlyAlertOnce(true).setSilent(true);
    c.getSystemService(NotificationManager.class).notify(active.getTag(),active.getId(),updated.build());
   }
   prefs(c).edit().putInt("notification_brand",5).apply();
  }catch(SecurityException ignored){}
 }
 static boolean notificationsEnabled(Context c){if(!NotificationManagerCompat.from(c).areNotificationsEnabled())return false;if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=c.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);return channel!=null&&channel.getImportance()!=NotificationManager.IMPORTANCE_NONE;}return true;}
 static boolean exact(Context c){return Build.VERSION.SDK_INT<31||c.getSystemService(AlarmManager.class).canScheduleExactAlarms();}
 static PendingIntent alarm(Context c,String id,String name,long time){Intent i=new Intent(c,ReminderReceiver.class).setAction("tymvera.REMIND").setData(Uri.parse("tymvera-alarm:"+Uri.encode(id))).putExtra("name",name).putExtra("id",id).putExtra("time",time);return PendingIntent.getBroadcast(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static synchronized void save(Context c,JSONObject plan){prefs(c).edit().putString("plan",plan.toString()).putLong("updated",System.currentTimeMillis()).commit();schedule(c);}
 static synchronized void schedule(Context c){
  channel(c);AlarmManager manager=c.getSystemService(AlarmManager.class);
  try{
   catchUp(c);
   JSONArray old=new JSONArray(prefs(c).getString("scheduled","[]"));for(int n=0;n<old.length();n++)manager.cancel(alarm(c,old.getString(n),"",0));
   JSONArray scheduled=new JSONArray(),details=new JSONArray();if(prefs(c).getBoolean("enabled",false)&&notificationsEnabled(c)){
    JSONArray rows=NativePlan.rows(new JSONObject(prefs(c).getString("plan","{}")));long now=System.currentTimeMillis();
    for(int n=0;n<Math.min(rows.length(),200);n++){JSONObject row=rows.getJSONObject(n);long when=row.optLong("time");if(when<=now)continue;String id=row.getString("id");PendingIntent pi=alarm(c,id,row.optString("name","Your block"),when);
     try{if(exact(c))manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);}catch(SecurityException revoked){manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);}scheduled.put(id);details.put(row);
    }
   }prefs(c).edit().putString("scheduled",scheduled.toString()).putString("scheduled_rows",details.toString()).remove("error").apply();
   if(prefs(c).getBoolean("enabled",false)){Calendar next=Calendar.getInstance();next.add(Calendar.DAY_OF_YEAR,1);next.set(Calendar.HOUR_OF_DAY,0);next.set(Calendar.MINUTE,10);next.set(Calendar.SECOND,0);Intent refresh=new Intent(c,ReminderReceiver.class).setAction("tymvera.REFRESH");manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next.getTimeInMillis(),PendingIntent.getBroadcast(c,1,refresh,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));}else {PendingIntent refresh=PendingIntent.getBroadcast(c,1,new Intent(c,ReminderReceiver.class).setAction("tymvera.REFRESH"),PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);if(refresh!=null)manager.cancel(refresh);}


  }catch(Exception e){prefs(c).edit().putString("error","Reminders could not be scheduled. Reopen the app.").apply();}
 }
 static void deliver(Context c,Intent intent){
  if(!prefs(c).getBoolean("enabled",false)||!notificationsEnabled(c))return;
  String id=intent.getStringExtra("id");if(id==null||prefs(c).getBoolean("done:"+id,false))return;
  // Do not deliver stale reminders hours after a device is turned back on.
  if(System.currentTimeMillis()-intent.getLongExtra("time",0)>30*60*1000L)return;
  try{NotificationManagerCompat.from(c).notify(id.hashCode(),notification(c,intent.getStringExtra("name"),"Your planned block starts now. Open your plan to log time.",id.substring(0,10)));prefs(c).edit().putBoolean("done:"+id,true).apply();}catch(SecurityException ignored){}
 }
 static Notification notification(Context c,String title,String body,String date){
  Intent open=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP).setData(Uri.parse("tymvera-notification:"+date)).putExtra("reminderDate",date);
  PendingIntent click=PendingIntent.getActivity(c,date.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  return new NotificationCompat.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_tymvera_monochrome).setLargeIcon(brandLogo(c)).setColor(android.graphics.Color.rgb(53,107,80)).setSubText("TYMVERA").setContentTitle(title).setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setContentIntent(click).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setCategory(NotificationCompat.CATEGORY_REMINDER).setPriority(NotificationCompat.PRIORITY_HIGH).build();
 }
 static void test(Context c){channel(c);if(!notificationsEnabled(c))throw new SecurityException("Notifications are blocked");String date=new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date());NotificationManagerCompat.from(c).notify(923401,notification(c,"TYMVERA · Test reminder","Notifications are working. Android controls the light or dark appearance.",date));}
 static void catchUp(Context c)throws JSONException{
  if(!prefs(c).getBoolean("enabled",false)||!notificationsEnabled(c))return;
  JSONArray rows=new JSONArray(prefs(c).getString("scheduled_rows","[]"));List<String> ids=new ArrayList<>(),names=new ArrayList<>();long now=System.currentTimeMillis();
  for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);String id=row.getString("id");if(prefs(c).getLong("updated",0)<=row.optLong("time")&&ReminderPolicy.recentMiss(row.optLong("time"),now,prefs(c).getBoolean("done:"+id,false))){ids.add(id);names.add(row.optString("name","Your block"));}}
  if(ids.isEmpty())return;
  try{String date=new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date());NotificationManagerCompat.from(c).notify(923402,notification(c,ids.size()+" recent reminder"+(ids.size()==1?"":"s")+" missed",android.text.TextUtils.join(", ",names.subList(0,Math.min(5,names.size())))+". Open your plan to review and log time.",date));android.content.SharedPreferences.Editor edit=prefs(c).edit();for(String id:ids)edit.putBoolean("done:"+id,true);edit.apply();}catch(SecurityException ignored){}
 }
 static JSONObject status(Context c)throws JSONException{return new JSONObject().put("enabled",prefs(c).getBoolean("enabled",false)).put("notificationsGranted",notificationsEnabled(c)).put("exactAlarmAllowed",exact(c)).put("updatedAt",prefs(c).getLong("updated",0)).put("error",prefs(c).getString("error","")).put("scheduled",new JSONArray(prefs(c).getString("scheduled","[]")).length());}
}
