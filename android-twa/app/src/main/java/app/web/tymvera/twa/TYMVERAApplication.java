package app.web.tymvera.twa;

import android.app.Application;

public class TYMVERAApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        NativeAndroidBridge.createNotificationChannels(this);
    }
}
