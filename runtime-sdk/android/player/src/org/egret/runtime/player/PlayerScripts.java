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

final class PlayerScripts extends ScriptSession {
    private WebView web;
    private boolean starting;

    PlayerScripts(EgretPlayerView owner, Activity activity, ProjectAssets project) {
        super(owner, project);
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
        boolean timed = owner.timing.isEnabled();
        invoke((timed ? "const begin=performance.now();" : "") + "const v=EgretPlayerProject.frame(" + elapsedMs + ");"
            + (timed ? "const generation=performance.now()-begin;" : "const generation=-1;")
            + "let bytes;if(v instanceof ArrayBuffer)bytes=new Int8Array(v);"
            + "else if(ArrayBuffer.isView(v))bytes=new Int8Array(v.buffer,v.byteOffset,v.byteLength);"
            + "else throw Error('frame() must return a binary command buffer');"
            + "if(bytes.byteLength<24||bytes.byteLength>" + WorldProjectPacket.TEXTURED_LIMIT
            + "||(bytes.byteLength>" + PlayerGraphics.MAX_FRAME_BYTES + "&&new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0,true)!=="
            + WorldProjectPacket.TEXTURED_MAGIC + "))throw Error('Invalid command length');"
            // Android WebView marshals typed arrays element by element. A native-order word
            // view carries the same bits with one quarter as many array elements.
            + "if((bytes.byteOffset%4)===0&&(bytes.byteLength%4)===0){"
            + "const words=new Int32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);"
            + "EgretNativePlayer.commandWords(" + epoch + ",words,generation)"
            + "}else{EgretNativePlayer.commands(" + epoch + ",bytes,generation)}");
    }

    // Typed arrays use the device byte order. Rebuild the exact byte slice before the
    // ordinary command handler validates the stage and captures its texture pages.
    static byte[] unpackCommandWords(int[] words) {
        if (words == null || words.length < 24 / Integer.BYTES
                || words.length > WorldProjectPacket.byteLimit(ByteOrder.nativeOrder() == ByteOrder.LITTLE_ENDIAN ? words[0] : Integer.reverseBytes(words[0])) / Integer.BYTES) return null;
        byte[] frame = new byte[words.length * Integer.BYTES];
        ByteBuffer.wrap(frame).order(ByteOrder.nativeOrder()).asIntBuffer().put(words);
        return frame;
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
        assetReads.close();
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
        @JavascriptInterface public String saveRead(String key) { return readSave(key); }
        @JavascriptInterface public boolean saveWrite(String key, String value) { return writeSave(key, value); }
        @JavascriptInterface public boolean saveRemove(String key) { return removeSave(key); }
        @JavascriptInterface public String raster(String json) { return raster.request(json); }
        @JavascriptInterface public boolean readText(int id, String path) { return assetReads.start(id, path, ProjectAssetReads.Format.UTF8); }
        @JavascriptInterface public boolean readBytes(int id, String path) { return assetReads.start(id, path, ProjectAssetReads.Format.BYTES); }
        @JavascriptInterface public boolean openChunks(int id, String path) { return assetReads.start(id, path, ProjectAssetReads.Format.CHUNKS); }
        @JavascriptInterface public boolean nextChunk(int id) { return assetReads.nextChunk(id); }
        @JavascriptInterface public void cancelReadText(int id) { assetReads.cancel(id); }
        @JavascriptInterface public String takeTextResult(int id) { return assetReads.take(id); }
        @JavascriptInterface public void commandWords(int epoch, int[] words, double generationMs) {
            if (owner.ending || epoch != owner.epoch) return;
            commands(epoch, unpackCommandWords(words), generationMs);
        }
        @JavascriptInterface public void commands(int epoch, byte[] frame, double generationMs) {
            long ns = generationMs >= 0 && Double.isFinite(generationMs) ? Math.round(generationMs * 1_000_000.0) : -1;
            PlayerScripts.this.commands(epoch, frame, ns, -1);
        }
        @JavascriptInterface public void state(String json) {
            owner.ui.post(() -> owner.projectState(json));
        }
        @JavascriptInterface public void edit(String initialText) { requestEdit(initialText); }
        @JavascriptInterface public void playSound(String path) { requestSound(path); }
        @JavascriptInterface public void started() { owner.ui.post(owner::started); }
        @JavascriptInterface public void failure(String reason) { owner.reportFailure(reason); }
        @JavascriptInterface public void finished(String json) { owner.ui.post(() -> owner.finishClose(json, null)); }
        @JavascriptInterface public void closeFailure(String reason) { owner.ui.post(() -> owner.finishClose(null, reason)); }
    }
}
