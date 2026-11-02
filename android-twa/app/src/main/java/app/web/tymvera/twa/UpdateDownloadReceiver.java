package app.web.tymvera.twa;
import android.app.DownloadManager;
import android.content.*;
public class UpdateDownloadReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  if(!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction()))return;
  long id=intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID,-1);if(id<0||id!=AppUpdater.prefs(context).getLong("download",-2))return;
  PendingResult pending=goAsync();new Thread(()->{try{AppUpdater.downloaded(context,id);}finally{pending.finish();}},"tymvera-update-verify").start();
 }
}
