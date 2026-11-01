package com.steamixtv.notflix;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Single Activity that carries the whole product: a WebView pointed at the hosted site, with the
 * same site bundled as an asset copy so the app still opens when no server answers.
 *
 * Touch and D-pad are both first-class. The shell stays out of the way of the arrow keys on
 * purpose — WebView delivers them to the page as real keydown events, which is the exact input
 * path the site's spatial navigation was written for, and consuming them here would move focus
 * twice. The keys the system swallows before the page ever sees them (channel, media transport,
 * back) are the ones translated into the site's own command bus.
 */
public class MainActivity extends Activity {
    private static final String SERVER_URL = "https://notflixlive.onrender.com/";
    /** A stable fake origin for the bundled copy. Requests stay same-origin, so ES modules, fetch
        and localStorage all behave exactly as they do on the hosted site. */
    private static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";
    private static final String ASSET_ROOT = "notflix";
    private static final String COMMAND_EVENT =
            "window.dispatchEvent(new CustomEvent('notflix-remote',{detail:{command:'%s'}}))";
    /** 'free' means nothing in the page wanted the back key, so the shell is the thing to leave. */
    private static final String BACK_PROBE =
            "(function(){var e=new CustomEvent('notflix-remote',"
                    + "{detail:{command:'back'},cancelable:true});"
                    + "return window.dispatchEvent(e)?'free':'handled';})()";

    private FrameLayout root;
    private WebView web;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private OnBackInvokedCallback backCallback;
    private boolean offline;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        web.setBackgroundColor(Color.BLACK);

        // A TV box reports leanback; a phone never does. The site reads these markers to pick the
        // D-pad interface, so one APK lands on the touch layout on a handset and the TV layout on
        // a stick or Google TV.
        String marker = isTelevision() ? " NOTFLIXAPP/1.0 ANDROIDTV" : " NOTFLIXAPP/1.0";
        configure();
        web.getSettings().setUserAgentString(web.getSettings().getUserAgentString() + marker);

        if (state != null) {
            offline = state.getBoolean("offline", false);
            web.restoreState(state);
            if (!offline) return;
        }
        web.loadUrl(targetUrl(getIntent()));
    }

    /** A shared title link opens that page; everything else, including a link from another host,
        starts at the catalog. */
    private String targetUrl(Intent intent) {
        if (offline) return LOCAL_ORIGIN + "/";
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return SERVER_URL;
        if (!"https".equals(data.getScheme()) || !"notflixlive.onrender.com".equals(data.getHost())) {
            return SERVER_URL;
        }
        return data.toString();
    }

    private void configure() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setDisplayZoomControls(false);
        // A box may run a system font scale; the layout is designed in CSS pixels, so keep them 1:1.
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String origin = uri.getScheme() + "://" + uri.getHost();
                if (!LOCAL_ORIGIN.equals(origin)) return null;
                String path = uri.getPath();
                if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
                return path.startsWith("/api/") ? proxy(uri) : fromAssets(path);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) goOffline();
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int code, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.equals(view.getUrl())) goOffline();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customCallback = callback;
                try {
                    // Chromium hands over a container that still belongs to the WebView; it has to
                    // leave it before it can fill the window.
                    if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
                    root.addView(view, new FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                    customView = view;
                    web.setVisibility(View.GONE);
                } catch (RuntimeException stillAttached) {
                    // Nothing to move: the page already owns the window, so only the bars can go.
                    customView = null;
                }
                hideSystemBars();
            }

            @Override
            public void onHideCustomView() {
                if (customView != null) {
                    root.removeView(customView);
                    customView = null;
                    web.setVisibility(View.VISIBLE);
                }
                if (customCallback != null) customCallback.onCustomViewHidden();
                customCallback = null;
                hideSystemBars();
            }

            @Override
            public void onPermissionRequest(android.webkit.PermissionRequest request) {
                // Playback only ever asks for these; nothing else gets through.
                request.grant(request.getResources());
            }
        });
    }

    /** The system asks the Activity, not the page, when a picture-in-picture window is wanted. */
    @Override
    public boolean onPictureInPictureRequested() {
        return enterPip();
    }

    private void goOffline() {
        if (offline) return;
        offline = true;
        web.loadUrl(LOCAL_ORIGIN + "/");
    }

    /** The bundled site keeps calling its own /api routes, so those travel to the real server. */
    private WebResourceResponse proxy(Uri uri) {
        HttpURLConnection connection = null;
        try {
            String query = uri.getEncodedQuery();
            URL target = new URL(SERVER_URL.substring(0, SERVER_URL.length() - 1)
                    + uri.getEncodedPath() + (query == null ? "" : "?" + query));
            connection = (HttpURLConnection) target.openConnection();
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", web.getSettings().getUserAgentString());
            InputStream body;
            String type = "application/json";
            if (connection.getResponseCode() >= 400) {
                body = connection.getErrorStream();
            } else {
                body = connection.getInputStream();
                if (connection.getContentType() != null) type = connection.getContentType();
            }
            return new WebResourceResponse(type, "utf-8",
                    body == null ? new ByteArrayInputStream(new byte[0]) : body);
        } catch (IOException failure) {
            byte[] empty = "{\"ok\":false,\"error\":\"Çevrimdışı\"}".getBytes(StandardCharsets.UTF_8);
            return new WebResourceResponse("application/json", "utf-8", new ByteArrayInputStream(empty));
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private WebResourceResponse fromAssets(String path) {
        String relative = ASSET_ROOT + (path.startsWith("/") ? path : "/" + path);
        InputStream stream;
        try {
            stream = getAssets().open(relative);
        } catch (IOException missing) {
            // An unknown path is not the shell's business; let the WebView answer it.
            return null;
        }
        return new WebResourceResponse(mimeFor(relative), "utf-8", stream);
    }

    private static String mimeFor(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0) return "application/octet-stream";
        switch (name.substring(dot + 1).toLowerCase(Locale.US)) {
            case "js":
            case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "html":
            case "htm": return "text/html";
            case "json":
            case "webmanifest": return "application/json";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "gif": return "image/gif";
            case "webp": return "image/webp";
            case "ico": return "image/x-icon";
            case "woff": return "font/woff";
            case "woff2": return "font/woff2";
            case "ttf": return "font/ttf";
            case "m3u8": return "application/vnd.apple.mpegurl";
            default: return "application/octet-stream";
        }
    }

    private boolean isTelevision() {
        if (getPackageManager().hasSystemFeature("android.software.leanback")) return true;
        int uiMode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_TYPE_MASK;
        return uiMode == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
    }

    @Override
    protected void onStop() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
            backCallback = null;
        }
        super.onStop();
    }

    @Override
    protected void onPostCreate(Bundle state) {
        super.onPostCreate(state);
        hideSystemBars();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putBoolean("offline", offline);
        web.saveState(out);
    }

    /**
     * Rotation, a keyboard sliding out or a TV switching resolution must not cost the viewer the
     * position in a film, which a recreate would do. configChanges in the manifest covers it.
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // WebView re-lays itself out; the page only needs to hear about it through CSS.
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
            return;
        }
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        String command;
        switch (event.getKeyCode()) {
            // Channel buttons are consumed by the TV input pipeline and never reach the page.
            case KeyEvent.KEYCODE_CHANNEL_UP: command = "chup"; break;
            case KeyEvent.KEYCODE_CHANNEL_DOWN: command = "chdown"; break;
            // Transport keys go to the media session unless the shell answers them. Repeats are
            // forwarded as well, so holding a key keeps zapping or seeking.
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE: command = "playpause"; break;
            case KeyEvent.KEYCODE_MEDIA_REWIND: command = "rewind"; break;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD: command = "forward"; break;
            default: return super.dispatchKeyEvent(event);
        }
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            web.evaluateJavascript(String.format(Locale.US, COMMAND_EVENT, command), null);
        }
        return true;
    }

    private void handleBack() {
        if (customView != null) {
            if (customCallback != null) customCallback.onCustomViewHidden();
            return;
        }
        // The page answers first: an open player, modal or menu is the thing to dismiss, not the
        // history entry underneath it.
        web.evaluateJavascript(BACK_PROBE, value -> {
            if (value != null && value.contains("handled")) return;
            if (web.canGoBack()) {
                web.goBack();
                return;
            }
            moveTaskToBack(true);
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            super.onBackPressed();
            return;
        }
        handleBack();
    }

    private boolean enterPip() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        try {
            enterPictureInPictureMode(new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .build());
            return true;
        } catch (RuntimeException unsupported) {
            return false;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (Intent.ACTION_VIEW.equals(intent.getAction())) web.loadUrl(targetUrl(intent));
    }

    @Override
    protected void onDestroy() {
        root.removeView(web);
        web.destroy();
        super.onDestroy();
    }
}
