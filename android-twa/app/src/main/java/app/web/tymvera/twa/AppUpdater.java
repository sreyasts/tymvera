package app.web.tymvera.twa;

import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

/** GitHub release discovery and verified, user-approved Android self-updates. */
final class AppUpdater {
 private static final String API="https://api.github.com/repos/sreyasts/tymvera/releases?per_page=20";
 private static final int READY_NOTIFICATION=923410;
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("app_updates",0);}
 static File readyFile(Context c){return new File(new File(c.getCacheDir(),"updates"),"update.apk");}
 private static JSONObject candidate(Context c)throws JSONException{return new JSONObject(prefs(c).getString("candidate","{}"));}
 private static void error(Context c,String message){prefs(c).edit().putString("state","error").putString("error",message).putBoolean("requested",false).apply();}
 static JSONObject check(Context c,boolean force)throws Exception{
  long elapsed=System.currentTimeMillis()-prefs(c).getLong("checked",0);
  if(!force&&elapsed>=0&&elapsed<15*60*1000L)return status(c);
  HttpURLConnection connection=(HttpURLConnection)new URL(API).openConnection();
  connection.setConnectTimeout(8000);connection.setReadTimeout(8000);connection.setInstanceFollowRedirects(false);
  connection.setRequestProperty("Accept","application/vnd.github+json");connection.setRequestProperty("User-Agent","TYMVERA/"+BuildConfig.VERSION_NAME);
  try{
   if(connection.getResponseCode()!=200)throw new IOException("Updates are temporarily unavailable. Try again later.");
   ByteArrayOutputStream body=new ByteArrayOutputStream();byte[] buffer=new byte[8192];
   try(InputStream input=connection.getInputStream()){int count;while((count=input.read(buffer))!=-1){if(body.size()+count>2*1024*1024)throw new IOException("Update response was too large.");body.write(buffer,0,count);}}
   JSONObject latest=UpdatePolicy.latest(new JSONArray(body.toString("UTF-8")),BuildConfig.VERSION_NAME);
   SharedPreferences.Editor edit=prefs(c).edit().putLong("checked",System.currentTimeMillis()).remove("checkError");
   if(latest!=null)edit.putString("candidate",latest.toString());else if(!active(c))edit.remove("candidate");
   edit.apply();return status(c);
  }catch(Exception e){prefs(c).edit().putString("checkError","Could not check for updates. Check your connection and retry.").apply();throw e;}finally{connection.disconnect();}
 }
 private static boolean active(Context c){String state=prefs(c).getString("state","");return "downloading".equals(state)||"verifying".equals(state)||"ready".equals(state)||"permission".equals(state);}
 static synchronized JSONObject start(Context c)throws Exception{
  JSONObject selected=candidate(c);if(!selected.has("version")||UpdatePolicy.compare(selected.getString("version"),BuildConfig.VERSION_NAME)<=0)throw new IOException("No newer update is available.");
  if(active(c))return status(c);
  File external=c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);if(external==null)throw new IOException("Download storage is unavailable.");
  File directory=new File(external,"updates");if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Could not prepare update storage.");
  File previous=new File(directory,"update.apk");if(previous.exists()&&!previous.delete())throw new IOException("Could not clear the previous download.");
  long old=prefs(c).getLong("download",-1);if(old>=0)c.getSystemService(DownloadManager.class).remove(old);
  DownloadManager.Request request=new DownloadManager.Request(Uri.parse(selected.getString("url")))
   .setTitle("TYMVERA "+selected.getString("version")).setDescription("Downloading app update")
   .setMimeType("application/vnd.android.package-archive").setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
   .setDestinationInExternalFilesDir(c,Environment.DIRECTORY_DOWNLOADS,"updates/update.apk");
  long id=c.getSystemService(DownloadManager.class).enqueue(request);
  prefs(c).edit().putLong("download",id).putString("selected",selected.toString()).putString("state","downloading").remove("error").putBoolean("requested",true).apply();
  return status(c);
 }
 static JSONObject status(Context c)throws Exception{
  SharedPreferences p=prefs(c);JSONObject selected=new JSONObject(p.getString("selected","{}")),latest=candidate(c);
  if(selected.has("version")&&UpdatePolicy.compare(selected.getString("version"),BuildConfig.VERSION_NAME)<=0){
   long id=p.getLong("download",-1);if(id>=0)c.getSystemService(DownloadManager.class).remove(id);readyFile(c).delete();
   p.edit().remove("download").remove("selected").remove("state").remove("error").remove("pendingInstall").putBoolean("requested",false).apply();
   c.getSystemService(NotificationManager.class).cancel(READY_NOTIFICATION);
  }
  String state=p.getString("state","idle");int progress=0;
  if("downloading".equals(state)||"verifying".equals(state)){
   long id=p.getLong("download",-1);
   try(Cursor cursor=c.getSystemService(DownloadManager.class).query(new DownloadManager.Query().setFilterById(id))){
    if(cursor==null||!cursor.moveToFirst())error(c,"Download was removed. Tap Update to try again.");
    else{
     int status=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
     long total=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)),done=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
     progress=total>0?(int)Math.min(100,done*100/total):0;
     if(status==DownloadManager.STATUS_FAILED)error(c,"Download failed. Check your connection and tap Update again.");
     else if(status==DownloadManager.STATUS_SUCCESSFUL)verifyDownload(c,id);
    }
   }
  }
  state=p.getString("state","idle");
  if(("ready".equals(state)||"permission".equals(state))&&!readyFile(c).isFile()){error(c,"The downloaded update was cleared. Tap Update to download it again.");state="error";}
  boolean available=latest.has("version")&&UpdatePolicy.compare(latest.getString("version"),BuildConfig.VERSION_NAME)>0;
  return new JSONObject().put("installedVersion",BuildConfig.VERSION_NAME).put("installedCode",BuildConfig.VERSION_CODE)
   .put("available",available).put("version",active(c)&&selected.has("version")?selected.optString("version"):latest.optString("version")).put("state",state).put("progress",progress)
   .put("error",p.getString("error",p.getString("checkError",""))).put("checkedAt",p.getLong("checked",0));
 }
 static synchronized void verifyDownload(Context c,long id)throws Exception{
  SharedPreferences p=prefs(c);if(id!=p.getLong("download",-1)||(!"downloading".equals(p.getString("state",""))&&!"verifying".equals(p.getString("state",""))))return;
  JSONObject selected=new JSONObject(p.getString("selected","{}"));File part=new File(readyFile(c).getParentFile(),"update.part");
  try{
   p.edit().putString("state","verifying").apply();if(!part.getParentFile().isDirectory()&&!part.getParentFile().mkdirs())throw new IOException("Update storage unavailable");
   File external=new File(new File(c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),"updates"),"update.apk");
   if(external.length()!=selected.getLong("size"))throw new IOException("Incomplete APK");
   MessageDigest digest=MessageDigest.getInstance("SHA-256");long size=0;byte[] buffer=new byte[32768];
   try(InputStream input=new FileInputStream(external);OutputStream output=new FileOutputStream(part)){int count;while((count=input.read(buffer))!=-1){size+=count;if(size>selected.getLong("size"))throw new IOException("Oversized APK");digest.update(buffer,0,count);output.write(buffer,0,count);}}
   if(size!=selected.getLong("size")||!hex(digest.digest()).equals(selected.getString("sha256")))throw new IOException("Checksum mismatch");
   validateArchive(c,part,selected.getString("version"));
   File ready=readyFile(c);if(ready.exists()&&!ready.delete())throw new IOException("Could not replace cached APK");if(!part.renameTo(ready))throw new IOException("Could not save verified APK");
   p.edit().putString("state","ready").remove("error").apply();
  }catch(Exception e){part.delete();error(c,"The update could not be verified and was not installed. Tap Update to retry.");throw e;}
 }
 static String hex(byte[] bytes){StringBuilder value=new StringBuilder();for(byte b:bytes)value.append(String.format(java.util.Locale.US,"%02x",b&255));return value.toString();}
 @SuppressWarnings("deprecation") static void validateArchive(Context c,File apk,String version)throws Exception{
  PackageManager manager=c.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
  PackageInfo archive=manager.getPackageArchiveInfo(apk.getAbsolutePath(),flags),installed=manager.getPackageInfo(c.getPackageName(),flags);
  if(archive==null||!c.getPackageName().equals(archive.packageName)||!version.equals(archive.versionName))throw new IOException("Wrong package");
  long code=Build.VERSION.SDK_INT>=28?archive.getLongVersionCode():archive.versionCode;
  if(code<=BuildConfig.VERSION_CODE||archive.applicationInfo==null||archive.applicationInfo.minSdkVersion>Build.VERSION.SDK_INT)throw new IOException("Incompatible update");
  android.content.pm.Signature[] incoming=Build.VERSION.SDK_INT>=28&&archive.signingInfo!=null?archive.signingInfo.getApkContentsSigners():archive.signatures;
  android.content.pm.Signature[] current=Build.VERSION.SDK_INT>=28&&installed.signingInfo!=null?installed.signingInfo.getApkContentsSigners():installed.signatures;
  if(incoming==null||current==null||incoming.length!=1||current.length!=1||!Arrays.equals(incoming[0].toByteArray(),current[0].toByteArray()))throw new IOException("Wrong signing identity");
 }
 static boolean installAllowed(Context c){return Build.VERSION.SDK_INT<26||c.getPackageManager().canRequestPackageInstalls();}
 static Intent installIntent(Context c)throws Exception{
  File file=readyFile(c);JSONObject selected=new JSONObject(prefs(c).getString("selected","{}"));
  validateArchive(c,file,selected.getString("version"));
  MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[32768];try(InputStream input=new FileInputStream(file)){int count;while((count=input.read(buffer))!=-1)digest.update(buffer,0,count);}
  if(!hex(digest.digest()).equals(selected.getString("sha256")))throw new IOException("Update checksum changed");
  Uri uri=FileProvider.getUriForFile(c,c.getPackageName()+".updates",file);
  return new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
 }
 static Intent prepareInstaller(Context c)throws Exception{
  if(!readyFile(c).isFile())throw new IOException("The update is not ready yet.");
  if(!installAllowed(c))return new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+c.getPackageName()));
  try{return installIntent(c);}catch(Exception e){readyFile(c).delete();error(c,"The update could not be verified. Tap Update to download it again.");throw e;}
 }
 static void installerLaunched(Context c){
  prefs(c).edit().putBoolean("requested",false).putBoolean("pendingInstall",!installAllowed(c)).putString("state",installAllowed(c)?"ready":"permission").apply();
 }
 static void downloaded(Context c,long id){
  try{if(id!=prefs(c).getLong("download",-1))return;status(c);if(!"ready".equals(prefs(c).getString("state","")))return;
   NotificationManager manager=c.getSystemService(NotificationManager.class);String channel="tymvera_updates";
   if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel(channel,"App updates",NotificationManager.IMPORTANCE_DEFAULT));
   Intent open=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
   PendingIntent tap=PendingIntent.getActivity(c,READY_NOTIFICATION,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   NotificationManagerCompat.from(c).notify(READY_NOTIFICATION,new NotificationCompat.Builder(c,channel).setSmallIcon(R.drawable.ic_tymvera_monochrome).setLargeIcon(ReminderStore.brandLogo(c)).setColor(0xff356b50).setContentTitle("TYMVERA update ready").setContentText("Tap to install "+candidate(c).optString("version")).setContentIntent(tap).setAutoCancel(true).build());
  }catch(Exception ignored){}
 }
}
