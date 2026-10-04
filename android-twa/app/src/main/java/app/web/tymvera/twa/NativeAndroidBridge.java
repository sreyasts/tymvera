package app.web.tymvera.twa;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * Native Android Bridge exposed to WebView JavaScript as window.NativeAndroid.
 * Enables 100% reliable system-level notifications, precision alarms via AlarmManager,
 * haptic feedback, and Picture-in-Picture window management.
 */
public class NativeAndroidBridge {
    public static final String CHANNEL_ROUTINE_ALERTS = "tymvera_routine_alerts";
    public static final String CHANNEL_ALARMS = "tymvera_precision_alarms";

    private final Activity mActivity;
    private final WebView mWebView;

    public NativeAndroidBridge(Activity activity, WebView webView) {
        this.mActivity = activity;
        this.mWebView = webView;
    }

    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                // Routine & Milestone Notifications Channel
                NotificationChannel routineChannel = new NotificationChannel(
                        CHANNEL_ROUTINE_ALERTS,
                        "Routines & Focus Alerts",
                        NotificationManager.IMPORTANCE_HIGH
                );
                routineChannel.setDescription("Live section transitions, milestone alerts, and routine status");
                routineChannel.enableLights(true);
                routineChannel.enableVibration(true);
                routineChannel.setVibrationPattern(new long[]{0, 200, 150, 200});
                routineChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                // Precision Alarms Channel (Maximum importance for wake-up and schedule alarms)
                NotificationChannel alarmChannel = new NotificationChannel(
                        CHANNEL_ALARMS,
                        "Schedule & Wake Alarms",
                        NotificationManager.IMPORTANCE_MAX
                );
                alarmChannel.setDescription("Audible and tactile alarms for scheduled wake times and routines");
                alarmChannel.enableLights(true);
                alarmChannel.enableVibration(true);
                alarmChannel.setVibrationPattern(new long[]{0, 400, 200, 400, 200, 600});
                alarmChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                
                Uri defaultAlarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (defaultAlarmSound == null) {
                    defaultAlarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build();
                alarmChannel.setSound(defaultAlarmSound, audioAttributes);

                manager.createNotificationChannel(routineChannel);
                manager.createNotificationChannel(alarmChannel);
            }
        }
    }

    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }

    @JavascriptInterface
    public void showNotification(String title, String body, String tag, int id) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(mActivity, android.Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    return;
                }
            }

            Intent openIntent = new Intent(mActivity, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    mActivity,
                    id,
                    openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(mActivity, CHANNEL_ROUTINE_ALERTS)
                    .setSmallIcon(R.drawable.ic_notification_icon)
                    .setLargeIcon(BitmapFactory.decodeResource(mActivity.getResources(), R.mipmap.ic_launcher))
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_REMINDER)
                    .setAutoCancel(true)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setContentIntent(pendingIntent);

            NotificationManagerCompat.from(mActivity).notify(tag, id, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void scheduleAlarm(long triggerAtMillis, String title, String body, int requestCode) {
        try {
            AlarmManager alarmManager = (AlarmManager) mActivity.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(mActivity, AlarmReceiver.class);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            intent.putExtra("requestCode", requestCode);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    mActivity,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void cancelAlarm(int requestCode) {
        try {
            AlarmManager alarmManager = (AlarmManager) mActivity.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(mActivity, AlarmReceiver.class);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    mActivity,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            alarmManager.cancel(pendingIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void triggerVibration(long milliseconds) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vibratorManager = (VibratorManager) mActivity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vibratorManager != null) {
                    Vibrator vibrator = vibratorManager.getDefaultVibrator();
                    vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
                }
            } else {
                Vibrator vibrator = (Vibrator) mActivity.getSystemService(Context.VIBRATOR_SERVICE);
                if (vibrator != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        vibrator.vibrate(milliseconds);
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public void enterPipMode() {
        mActivity.runOnUiThread(() -> {
            if (mActivity instanceof MainActivity) {
                ((MainActivity) mActivity).enterPipMode();
            }
        });
    }

    @JavascriptInterface
    public void requestPermission() {
        mActivity.runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(mActivity, android.Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(mActivity,
                            new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                            101);
                }
            }
        });
    }
}
