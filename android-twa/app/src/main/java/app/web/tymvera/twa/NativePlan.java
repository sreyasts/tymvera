package app.web.tymvera.twa;
import org.json.*;
import java.util.*;
import java.text.SimpleDateFormat;

/** Projects the same saved routine rules locally, including per-day exceptions. */
final class NativePlan {
 static JSONObject object(JSONObject parent,String key){JSONObject o=parent.optJSONObject(key);return o==null?new JSONObject():o;}
 static long time(String date,String start)throws Exception{SimpleDateFormat f=new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.US);return f.parse(date+" "+start).getTime();}
 static JSONArray rows(JSONObject plan)throws Exception{
  JSONArray output=new JSONArray();JSONObject routines=object(plan,"routines"),days=object(plan,"days"),templates=object(plan,"templates"),modes=object(plan,"dayModes");
  Calendar calendar=Calendar.getInstance();SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd",Locale.US);String today=format.format(calendar.getTime());
  for(int offset=0;offset<8;offset++,calendar.add(Calendar.DAY_OF_YEAR,1)){
   String date=format.format(calendar.getTime());int weekday=calendar.get(Calendar.DAY_OF_WEEK)-1;
   JSONObject recorded=object(days,date),mode=object(modes,date);Map<String,JSONObject> visible=new LinkedHashMap<>();
   String templateId=mode.optString("templateId","");JSONObject template=object(templates,templateId);
   if(templateId.isEmpty()||"null".equals(templateId)){
    long latest=-1;
    for(Iterator<String> keys=templates.keys();keys.hasNext();){String key=keys.next();JSONObject candidate=templates.getJSONObject(key);JSONArray auto=candidate.optJSONArray("autoDays");boolean matches=false;if(auto!=null)for(int j=0;j<auto.length();j++)if(auto.getInt(j)==weekday)matches=true;
     if(matches&&!candidate.optBoolean("deleted")&&date.compareTo(candidate.optString("from","0000-00-00"))>=0&&candidate.optLong("updatedAt")>latest){latest=candidate.optLong("updatedAt");templateId=key;template=candidate;}
    }
   }
   if(!templateId.isEmpty()&&!"null".equals(templateId)){
    JSONArray definitions=mode.optJSONArray("blocks");if(definitions==null)definitions=template.optJSONArray("blocks");
    if(definitions!=null)for(int i=0;i<definitions.length();i++){JSONObject b=definitions.getJSONObject(i),old=recorded.optJSONObject(b.getString("id"));if(old!=null&&old.optBoolean("deleted"))continue;visible.put(b.getString("id"),old!=null&&(old.optBoolean("completed")||(old.optBoolean("customized")&&templateId.equals(old.optString("planVersionId"))))?old:b);}
    for(Iterator<String> keys=recorded.keys();keys.hasNext();){String key=keys.next();JSONObject b=recorded.getJSONObject(key);if(b.optBoolean("completed")||b.optBoolean("dayOnly"))visible.put(key,b);}
   }else{
    for(Iterator<String> keys=recorded.keys();keys.hasNext();){String key=keys.next();JSONObject b=recorded.getJSONObject(key);if(b.isNull("planVersionId")||!b.has("planVersionId")||b.optBoolean("completed")||b.optBoolean("dayOnly"))visible.put(key,b);}
    for(Iterator<String> keys=routines.keys();keys.hasNext();){String key=keys.next();JSONObject root=routines.getJSONObject(key);String id="r-"+root.getString("id");JSONObject existing=visible.get(id);if(existing!=null&&(existing.optBoolean("deleted")||existing.optBoolean("customized")||existing.optBoolean("completed")||date.compareTo(today)<=0))continue;
     JSONObject rule=null;JSONArray versions=root.optJSONArray("versions");if(versions==null)rule=root;else for(int i=0;i<versions.length();i++){JSONObject v=versions.getJSONObject(i);if(v.optString("effectiveFrom").compareTo(date)<=0&&(rule==null||v.optString("effectiveFrom").compareTo(rule.optString("effectiveFrom"))>0))rule=v;}
     boolean scheduled=false;if(rule!=null&&!rule.optBoolean("deleted")&&date.compareTo(root.optString("from",today))>=0){JSONArray weekdays=rule.optJSONArray("days");if(weekdays!=null)for(int i=0;i<weekdays.length();i++)if(weekdays.getInt(i)==weekday)scheduled=true;}
     if(scheduled)visible.put(id,rule);else visible.remove(id);
    }
   }
   for(Map.Entry<String,JSONObject> entry:visible.entrySet()){JSONObject b=entry.getValue();String start=b.optString("start");if(b.optBoolean("deleted")||b.optBoolean("completed")||!start.matches("([01][0-9]|2[0-3]):[0-5][0-9]"))continue;long when=time(date,start);if(when>System.currentTimeMillis())output.put(new JSONObject().put("id",date+":"+entry.getKey()).put("name",b.optString("name","Your block")).put("time",when));}
  }
  return output;
 }
}
