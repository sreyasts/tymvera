package app.web.tymvera.twa;
import org.junit.Test;
import static org.junit.Assert.*;
public class ReminderPolicyTest {
 @Test public void recentUndeliveredRemindersAreRecovered(){assertTrue(ReminderPolicy.recentMiss(100000,100001,false));}
 @Test public void deliveredRemindersAreNotRepeated(){assertFalse(ReminderPolicy.recentMiss(100000,100001,true));}
 @Test public void futureAndExpiredRemindersAreNotRecovered(){assertFalse(ReminderPolicy.recentMiss(100001,100000,false));assertFalse(ReminderPolicy.recentMiss(1,13*60*60*1000L,false));}
}
