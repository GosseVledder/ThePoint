package io.github.gossevledder.thepoint;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hands text shared to the app ("Delen" in the YouTube app or Chrome) to JavaScript.
 * Handles both a cold start (the launch intent) and a share while the app is running.
 * Events are retained until the web code has registered its listener.
 */
@CapacitorPlugin(name = "ShareIntent")
public class ShareIntentPlugin extends Plugin {

    @Override
    public void load() {
        handle(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handle(intent);
    }

    private void handle(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return;
        JSObject data = new JSObject();
        data.put("text", text);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        data.put("subject", subject != null ? subject : "");
        notifyListeners("shared", data, true);
        // A later re-creation of the activity must not replay the same share.
        intent.setAction(Intent.ACTION_MAIN);
    }
}
