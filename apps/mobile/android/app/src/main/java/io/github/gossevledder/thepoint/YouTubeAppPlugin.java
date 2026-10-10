package io.github.gossevledder.thepoint;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Split screen: tells whether The Point shares the screen with another app, and opens a
 * video at a time in the YouTube app. With `adjacent` the YouTube app opens in (or moves
 * to) the other half of the screen instead of replacing The Point.
 */
@CapacitorPlugin(name = "YouTubeApp")
public class YouTubeAppPlugin extends Plugin {

    private static final String YOUTUBE = "com.google.android.youtube";

    @PluginMethod
    public void isInMultiWindow(PluginCall call) {
        JSObject result = new JSObject();
        result.put("value", getActivity().isInMultiWindowMode());
        call.resolve(result);
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("url ontbreekt");
            return;
        }
        boolean adjacent = Boolean.TRUE.equals(call.getBoolean("adjacent", false));
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (adjacent) intent.addFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT);
        JSObject result = new JSObject();
        try {
            intent.setPackage(YOUTUBE);
            getActivity().startActivity(intent);
            result.put("app", true);
        } catch (ActivityNotFoundException e) {
            // No YouTube app: let the browser open the link.
            intent.setPackage(null);
            try {
                getActivity().startActivity(intent);
            } catch (ActivityNotFoundException e2) {
                call.reject("Geen app om de video te openen");
                return;
            }
            result.put("app", false);
        }
        call.resolve(result);
    }
}
