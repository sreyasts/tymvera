package app.web.tymvera.twa;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class ReminderReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent) {
  if("tymvera.REMIND".equals(intent.getAction())) ReminderStore.deliver(context,intent);
  ReminderStore.schedule(context);
 }
}
