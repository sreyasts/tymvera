package app.web.tymvera.twa;
import org.junit.Test;
import org.json.*;
import static org.junit.Assert.*;
public class UpdatePolicyTest {
 private JSONObject release(String version)throws Exception{return new JSONObject().put("tag_name","v"+version+"-phone-test").put("assets",new JSONArray().put(new JSONObject().put("name","TYMVERA-Android-"+version+".apk").put("state","uploaded").put("digest","sha256:"+new String(new char[64]).replace('\0','a')).put("size",11000000).put("browser_download_url","https://github.com/sreyasts/tymvera/releases/download/v"+version+"-phone-test/TYMVERA-Android-"+version+".apk")));}
 @Test public void currentAndOlderVersionsDoNotOfferAnUpdate()throws Exception{assertNull(UpdatePolicy.latest(new JSONArray().put(release("3.3.0")).put(release("3.2.2")),"3.3.0"));}
 @Test public void picksNewestPublishedVersionNumerically()throws Exception{JSONObject selected=UpdatePolicy.latest(new JSONArray().put(release("3.9.9")).put(release("3.10.0")),"3.3.0");assertEquals("3.10.0",selected.getString("version"));}
 @Test public void refusesDraftsWrongHostsAndMissingChecksums()throws Exception{
  JSONObject draft=release("3.4.0").put("draft",true),wrong=release("3.5.0"),missing=release("3.6.0");wrong.getJSONArray("assets").getJSONObject(0).put("browser_download_url","https://example.com/update.apk");missing.getJSONArray("assets").getJSONObject(0).remove("digest");
  assertNull(UpdatePolicy.latest(new JSONArray().put(draft).put(wrong).put(missing),"3.3.0"));
 }
 @Test public void refusesMismatchedReleaseTagsAndOversizedAssets()throws Exception{
  JSONObject wrong=release("3.4.0").put("tag_name","v3.9.0"),large=release("3.5.0");large.getJSONArray("assets").getJSONObject(0).put("size",500*1024*1024);
  assertNull(UpdatePolicy.latest(new JSONArray().put(wrong).put(large),"3.3.0"));
 }
 @Test(expected=IllegalArgumentException.class)public void rejectsMalformedVersion(){UpdatePolicy.compare("3.3.0/evil","3.3.0");}
}
