package io.github.gossevledder.thepoint;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Update from the GitHub release: download the APK into the cache, check its SHA-256 and
 * hand it to the Android package installer. The user confirms the installation; the
 * first time Android also asks to allow installs from The Point. The release is signed
 * with the same key, so it installs over the current version and keeps all data.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String APK_TYPE = "application/vnd.android.package-archive";

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName");
        String sha256 = call.getString("sha256");
        if (url == null || !url.startsWith("https://") || fileName == null || !fileName.matches("[A-Za-z0-9._-]+\\.apk")) {
            call.reject("Ongeldige download", "invalid");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new Exception("Geen map voor de download");
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) f.delete();
                File apk = new File(dir, fileName);
                String actual = download(url, apk);
                if (sha256 != null && !sha256.isEmpty() && !sha256.equalsIgnoreCase(actual)) {
                    apk.delete();
                    call.reject("SHA-256 klopt niet", "checksum");
                    return;
                }
                install(apk);
                call.resolve();
            } catch (ActivityNotFoundException e) {
                call.reject("Geen installatieprogramma gevonden", "install");
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : e.toString(), "download");
            }
        }).start();
    }

    /** Download to `target` (following GitHub's redirect), report progress, return the SHA-256. */
    private String download(String url, File target) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(30_000);
        int status = conn.getResponseCode();
        if (status != HttpURLConnection.HTTP_OK) throw new Exception("HTTP " + status);
        long total = conn.getContentLengthLong();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[64 * 1024];
            long done = 0;
            int lastPercent = -1;
            int n;
            while ((n = in.read(buffer)) != -1) {
                out.write(buffer, 0, n);
                digest.update(buffer, 0, n);
                done += n;
                if (total > 0) {
                    int percent = (int) (done * 100 / total);
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        notifyListeners("progress", progress);
                    }
                }
            }
        } finally {
            conn.disconnect();
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : digest.digest()) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    private void install(File apk) {
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, APK_TYPE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(intent);
    }
}
