package app.web.tymvera.twa;
import android.annotation.SuppressLint;
import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import android.view.*;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.*;
import androidx.credentials.*;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.webkit.WebViewAssetLoader;
import com.google.android.libraries.identity.googleid.*;
import com.google.firebase.*;
import com.google.firebase.auth.*;
import org.json.*;
import java.util.concurrent.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {
 private WebView web;private FirebaseAuth auth;private ValueCallback<Uri[]> fileResult;private final ExecutorService io=Executors.newSingleThreadExecutor();
 @SuppressLint("SetJavaScriptEnabled") @Override public void onCreate(Bundle state){
  super.onCreate(state);
  if(FirebaseApp.getApps(this).isEmpty())FirebaseApp.initializeApp(this,new FirebaseOptions.Builder().setApiKey("AIzaSyC_fiKeJGed5_A9969n2nIXD2Jxl0LfH2k").setApplicationId("1:376961059569:android:4651fd16adf8a4daa57750").setProjectId("mission-plustwo").build());
  auth=FirebaseAuth.getInstance();ReminderStore.channel(this);
  web=new WebView(this);setContentView(web);WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
  ViewCompat.setOnApplyWindowInsetsListener(web,(v,insets)->{androidx.core.graphics.Insets bars=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.ime());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});
  web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(true);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);web.getSettings().setSupportZoom(true);
  WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
  web.addJavascriptInterface(new Bridge(),"NativeAndroid");
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){if("appassets.androidplatform.net".equals(r.getUrl().getHost()))return loader.shouldInterceptRequest(r.getUrl());return null;}
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost()))return false;if("https".equals(u.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;}
  });
  web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){if(fileResult!=null)fileResult.onReceiveValue(null);fileResult=cb;try{startActivityForResult(params.createIntent(),41);return true;}catch(Exception e){fileResult=null;return false;}}});
  web.setDownloadListener((url,agent,disposition,mime,length)->{if(url.startsWith("blob:"))web.evaluateJavascript("fetch("+JSONObject.quote(url)+").then(r=>r.text()).then(text=>NativeAndroid.request('export','export',JSON.stringify({text})))",null);});
  web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
 }
 void reply(String id,Object value,String error){runOnUiThread(()->{if(isFinishing()||web==null)return;try{JSONObject result=new JSONObject().put("ok",error==null);if(error==null)result.put("value",value==null?JSONObject.NULL:value);else result.put("error",error);web.evaluateJavascript("window.__tymveraNativeResult&&window.__tymveraNativeResult("+JSONObject.quote(id)+","+result.toString()+")",null);}catch(Exception ignored){}});}
 private String exportText;
 private class Bridge {
  @JavascriptInterface public void request(String id,String method,String json){if(json.length()>2*1024*1024){reply(id,null,"The plan is too large.");return;}runOnUiThread(()->{try{JSONObject data=new JSONObject(json);
   switch(method){
    case "signIn":signIn(id);break;
    case "signOut":auth.signOut();ReminderStore.prefs(MainActivity.this).edit().putBoolean("enabled",false).apply();ReminderStore.schedule(MainActivity.this);reply(id,true,null);break;
    case "appearance":boolean dark=data.optBoolean("dark");web.setBackgroundColor(android.graphics.Color.parseColor(dark?"#171c19":"#f8f9f5"));WindowInsetsControllerCompat bars=WindowCompat.getInsetsController(getWindow(),web);bars.setAppearanceLightStatusBars(!dark);bars.setAppearanceLightNavigationBars(!dark);reply(id,true,null);break;
    case "status":reply(id,ReminderStore.status(MainActivity.this),null);break;
    case "saveReminders":JSONObject plan=data.getJSONObject("plan");io.execute(()->{ReminderStore.save(MainActivity.this,plan);try{reply(id,ReminderStore.status(MainActivity.this),null);}catch(Exception e){reply(id,null,"Unable to read reminder status");}});break;
    case "enableReminders":ReminderStore.prefs(MainActivity.this).edit().putBoolean("enabled",true).apply();if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},42);ReminderStore.schedule(MainActivity.this);reply(id,ReminderStore.status(MainActivity.this),null);break;
    case "disableReminders":ReminderStore.prefs(MainActivity.this).edit().putBoolean("enabled",false).apply();ReminderStore.schedule(MainActivity.this);reply(id,ReminderStore.status(MainActivity.this),null);break;
    case "alarmSettings":if(Build.VERSION.SDK_INT>=31)startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));reply(id,true,null);break;
    case "notificationSettings":startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));reply(id,true,null);break;
    case "export":exportText=data.getString("text");Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,"TYMVERA-backup.json");startActivityForResult(save,43);reply(id,true,null);break;
    default:reply(id,null,"Unknown Android action");
   }
  }catch(Exception error){reply(id,null,"Android could not complete the action. Reopen the app and retry.");}});}
 }
 private void signIn(String id){
  GetSignInWithGoogleOption option=new GetSignInWithGoogleOption.Builder("376961059569-i02u6s80j3inilhg5l3i25ct8lgcn6k2.apps.googleusercontent.com").build();
  GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();
  CredentialManager.create(this).getCredentialAsync(this,request,new CancellationSignal(),androidx.core.content.ContextCompat.getMainExecutor(this),new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
   @Override public void onResult(GetCredentialResponse result){try{GoogleIdTokenCredential credential=GoogleIdTokenCredential.createFrom(result.getCredential().getData());String token=credential.getIdToken();auth.signInWithCredential(GoogleAuthProvider.getCredential(token,null)).addOnCompleteListener(task->{if(task.isSuccessful())try{reply(id,new JSONObject().put("idToken",token),null);}catch(Exception e){reply(id,null,"Sign-in response failed");}else reply(id,null,"Google account could not be connected to Firebase. Try again.");});}catch(Exception error){reply(id,null,"No Google credential was returned. Choose a Google account and try again.");}}
   @Override public void onError(GetCredentialException error){reply(id,null,"Google sign-in was cancelled or unavailable. Check Google Play Services and your connection, then retry.");}
  });
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==41&&fileResult!=null){fileResult.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileResult=null;}if(request==43&&result==RESULT_OK&&data!=null&&data.getData()!=null&&exportText!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out!=null)out.write(exportText.getBytes(StandardCharsets.UTF_8));}catch(Exception e){new androidx.appcompat.app.AlertDialog.Builder(this).setMessage("Backup could not be saved. Try again.").setPositiveButton("OK",null).show();}exportText=null;}}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);ReminderStore.schedule(this);}
 @Override protected void onResume(){super.onResume();ReminderStore.schedule(this);if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('native-resume'))",null);}
 @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(fileResult!=null)fileResult.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("NativeAndroid");web.destroy();web=null;}io.shutdown();super.onDestroy();}
}
