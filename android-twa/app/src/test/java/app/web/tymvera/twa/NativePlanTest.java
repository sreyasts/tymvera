package app.web.tymvera.twa;
import org.junit.Test;
import org.json.*;
import java.util.*;
import java.text.SimpleDateFormat;
import static org.junit.Assert.*;

public class NativePlanTest {
 private String tomorrow(){Calendar c=Calendar.getInstance();c.add(Calendar.DAY_OF_YEAR,1);return new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(c.getTime());}
 private JSONObject block(String id)throws Exception{return new JSONObject().put("id",id).put("name","Study").put("start","09:00").put("duration",30).put("updatedAt",10);}
 private JSONObject plan()throws Exception{return new JSONObject().put("routines",new JSONObject()).put("days",new JSONObject()).put("templates",new JSONObject()).put("dayModes",new JSONObject());}
 @Test public void skipsCompletedDeletedAndUntimedBlocks()throws Exception{
  JSONObject p=plan(),rows=new JSONObject().put("done",block("done").put("completed",true)).put("removed",block("removed").put("deleted",true)).put("flexible",block("flexible").put("start",""));p.getJSONObject("days").put(tomorrow(),rows);assertEquals(0,NativePlan.rows(p).length());
 }
 @Test public void projectsWeeklyRoutinesWithTheirWeekdays()throws Exception{
  JSONObject p=plan();JSONArray weekdays=new JSONArray("[0,1,2,3,4,5,6]");p.getJSONObject("routines").put("study",block("study").put("from",tomorrow()).put("days",weekdays));assertEquals(7,NativePlan.rows(p).length());
 }
 @Test public void stoppedFutureRoutineDoesNotResurrect()throws Exception{
  JSONObject p=plan();p.getJSONObject("routines").put("study",block("study").put("from",tomorrow()).put("days",new JSONArray("[0,1,2,3,4,5,6]")).put("deleted",true));assertEquals(0,NativePlan.rows(p).length());
 }
 @Test public void selectedVersionReplacesUsualTimetable()throws Exception{
  JSONObject p=plan();p.getJSONObject("templates").put("class",new JSONObject().put("blocks",new JSONArray().put(block("study").put("start","16:00"))));p.getJSONObject("dayModes").put(tomorrow(),new JSONObject().put("templateId","class"));JSONArray result=NativePlan.rows(p);assertEquals(1,result.length());assertEquals(NativePlan.time(tomorrow(),"16:00"),result.getJSONObject(0).getLong("time"));
 }
 @Test public void dayRemovalWinsOverWeeklyRoutine()throws Exception{
  JSONObject p=plan();p.getJSONObject("routines").put("study",block("study").put("from",tomorrow()).put("days",new JSONArray("[0,1,2,3,4,5,6]")));p.getJSONObject("days").put(tomorrow(),new JSONObject().put("r-study",block("r-study").put("deleted",true)));assertEquals(6,NativePlan.rows(p).length());
 }
}
