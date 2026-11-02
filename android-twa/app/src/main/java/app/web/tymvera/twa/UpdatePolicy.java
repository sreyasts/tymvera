package app.web.tymvera.twa;

import org.json.*;
import java.util.regex.*;

final class UpdatePolicy {
 private static final Pattern VERSION=Pattern.compile("[0-9]{1,6}\\.[0-9]{1,6}\\.[0-9]{1,6}");
 static int compare(String a,String b){
  if(!VERSION.matcher(a).matches()||!VERSION.matcher(b).matches())throw new IllegalArgumentException("Invalid app version");
  String[] left=a.split("\\."),right=b.split("\\.");
  for(int i=0;i<3;i++){int difference=Integer.compare(Integer.parseInt(left[i]),Integer.parseInt(right[i]));if(difference!=0)return difference;}return 0;
 }
 static JSONObject latest(JSONArray releases,String installed)throws JSONException{
  JSONObject best=null;
  for(int i=0;i<releases.length();i++){
   JSONObject release=releases.getJSONObject(i);if(release.optBoolean("draft"))continue;
   String tag=release.optString("tag_name");if(!tag.matches("v[0-9]{1,6}\\.[0-9]{1,6}\\.[0-9]{1,6}(-phone-test)?"))continue;
   JSONArray assets=release.optJSONArray("assets");if(assets==null)continue;
   for(int j=0;j<assets.length();j++){
    JSONObject asset=assets.getJSONObject(j);String name=asset.optString("name");
    if(!name.matches("TYMVERA-Android-[0-9]{1,6}\\.[0-9]{1,6}\\.[0-9]{1,6}\\.apk"))continue;
    String version=name.substring(16,name.length()-4),digest=asset.optString("digest"),url=asset.optString("browser_download_url");
    if(!tag.equals("v"+version)&&!tag.equals("v"+version+"-phone-test"))continue;
    if(!"uploaded".equals(asset.optString("state"))||!digest.matches("sha256:[0-9a-fA-F]{64}"))continue;
    if(!url.equals("https://github.com/sreyasts/tymvera/releases/download/"+tag+"/"+name))continue;
    long size=asset.optLong("size");if(size<=0||size>200*1024*1024L)continue;
    if(compare(version,installed)<=0||(best!=null&&compare(version,best.getString("version"))<=0))continue;
    best=new JSONObject().put("version",version).put("url",url).put("sha256",digest.substring(7).toLowerCase(java.util.Locale.US)).put("size",size);
   }
  }
  return best;
 }
}
