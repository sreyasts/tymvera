package app.web.tymvera.twa;

final class ReminderPolicy {
 static boolean recentMiss(long scheduled, long now, boolean delivered) {
  return !delivered && scheduled > 0 && scheduled <= now && now - scheduled <= 12 * 60 * 60 * 1000L;
 }
}
