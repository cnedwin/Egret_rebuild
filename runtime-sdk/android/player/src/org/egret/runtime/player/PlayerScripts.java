// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

final class PlayerScripts {
    private final EgretPlayerView owner;
    private final ProjectAssets project;
    private final PlayerGraphics.Pages pages = new PlayerGraphics.Pages();
    private WebView web;
    private boolean starting;

    PlayerScripts(EgretPlayerView owner, Activity activity, ProjectAssets project) {
        this.owner = owner;
        this.project = project;
        web = new WebView(activity);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.addJavascriptInterface(new Bridge(), "EgretNativePlayer");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) {
                return project.response(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) { return true; }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError error) {
                if (r.isForMainFrame()) owner.reportFailure("Cannot open project: " + error.getDescription());
            }
            @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail detail) {
                destroy();
                owner.scriptProcessLost();
                return true;
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (!project.entry.equals(url) || starting || owner.ending) return;
                starting = true;
                evaluate("window.__egretStartup=Promise.resolve().then(()=>{"
                    + "const p=window.EgretPlayerProject;"
                    + "for(const k of ['start','frame','input','pause','resume','close'])"
                    + "if(!p||typeof p[k]!=='function')throw Error('Missing project method '+k);"
                    + "return p.start()});"
                    + "__egretStartup.then(()=>EgretNativePlayer.started(),e=>EgretNativePlayer.failure(String(e)))");
            }
        });
        // WebView runs trusted bundled scripts and never becomes the visible game surface.
        web.loadUrl(project.entry);
    }

    private void evaluate(String expression) {
        if (web != null) web.evaluateJavascript(expression, null);
    }

    void invoke(String expression) {
        evaluate("try{" + expression + "}catch(e){EgretNativePlayer.failure(String(e))}");
    }

    void frame(int epoch, double elapsedMs) {
        invoke("const v=EgretPlayerProject.frame(" + elapsedMs + ");"
            + "let bytes;if(v instanceof ArrayBuffer)bytes=new Int8Array(v);"
            + "else if(ArrayBuffer.isView(v))bytes=new Int8Array(v.buffer,v.byteOffset,v.byteLength);"
            + "else throw Error('frame() must return a binary command buffer');"
            + "if(bytes.byteLength<24||bytes.byteLength>" + PlayerGraphics.MAX_FRAME_BYTES + ")throw Error('Invalid command length');"
            + "EgretNativePlayer.commands(" + epoch + ",bytes)");
    }

    void resumeVm() { if (web != null) web.onResume(); }
    void pauseVm() { if (web != null) web.onPause(); }

    boolean requestClose() {
        if (web == null || !starting) return false;
        web.onResume();
        evaluate("Promise.resolve().then(()=>EgretPlayerProject.close())"
            + ".then(r=>EgretNativePlayer.finished(JSON.stringify(r==null?null:r)),"
            + "e=>EgretNativePlayer.closeFailure(String(e)))");
        return true;
    }

    void destroy() {
        pages.close();
        if (web != null) {
            web.removeJavascriptInterface("EgretNativePlayer");
            web.stopLoading();
            web.destroy();
            web = null;
        }
    }

    // WebView calls these methods on its dedicated Java bridge thread. No method
    // waits for the UI thread, which can be blocked waiting for the JavaScript call.
    final class Bridge {
        @JavascriptInterface public void page(int id, int width, int height, String rgba) {
            try { pages.publish(id, width, height, rgba); }
            catch (RuntimeException e) { owner.reportFailure("Cannot publish project page: " + e); }
        }
        @JavascriptInterface public void releasePage(int id) { pages.release(id); }
        @JavascriptInterface public void commands(int epoch, byte[] frame) {
            if (owner.ending || epoch != owner.epoch) return;
            if (frame == null || frame.length < 24 || frame.length > PlayerGraphics.MAX_FRAME_BYTES) {
                owner.reportFailure("Invalid command length on Android bridge");
                return;
            }
            ByteBuffer header = ByteBuffer.wrap(frame).order(ByteOrder.LITTLE_ENDIAN);
            if (header.getInt(8) != project.width || header.getInt(12) != project.height) {
                owner.reportFailure("Frame dimensions differ from the project stage");
                return;
            }
            PlayerGraphics.Frame snapshot = new PlayerGraphics.Frame(epoch, frame, pages.snapshot());
            owner.ui.post(() -> owner.enqueue(snapshot));
        }
        @JavascriptInterface public void state(String json) {
            owner.ui.post(() -> owner.projectState(json));
        }
        @JavascriptInterface public void edit(String initialText) {
            int epoch = owner.epoch;
            owner.ui.post(() -> { if (epoch == owner.epoch) owner.editor(initialText); });
        }
        @JavascriptInterface public void playSound(String path) {
            int epoch = owner.epoch;
            if (owner.ending) return;
            try {
                byte[] bytes = project.read(path, 8 << 20);
                owner.ui.post(() -> { if (epoch == owner.epoch) owner.sound(bytes); });
            } catch (Exception e) { owner.reportFailure("Cannot open project sound: " + e); }
        }
        @JavascriptInterface public void started() { owner.ui.post(owner::started); }
        @JavascriptInterface public void failure(String reason) { owner.reportFailure(reason); }
        @JavascriptInterface public void finished(String json) { owner.ui.post(() -> owner.finishClose(json, null)); }
        @JavascriptInterface public void closeFailure(String reason) { owner.ui.post(() -> owner.finishClose(null, reason)); }
    }
}
