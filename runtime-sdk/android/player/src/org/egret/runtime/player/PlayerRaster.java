// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorSpace;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.os.Build;
import android.util.Base64;
import java.io.IOException;
import java.io.DataInputStream;
import java.text.BreakIterator;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Prepares immutable texture inputs on the script host's worker. Both VMs use the same Android decoder and fonts. */
final class PlayerRaster {
    private final ProjectAssets assets;
    private static final int MAX_PIXELS = 1024 * 1024;
    private static final int MAX_RUNS = 256;

    PlayerRaster(ProjectAssets assets) { this.assets = assets; }

    String request(String encoded) {
        try {
            if (encoded == null || encoded.length() > 131072) throw new IOException("Oversized raster request");
            JSONObject job = new JSONObject(encoded);
            String operation = job.getString("op");
            if (operation.equals("measure")) return measure(runs(job));
            if (operation.equals("textMetrics")) return metrics(runs(job));
            if (operation.equals("graphemes")) return graphemes(job.getString("text"));
            if (operation.equals("bitmapPng")) {
                String encodedPng = job.getString("data");
                if (encodedPng.length() > 87384) throw new IOException("BitmapData PNG exceeds 64 KiB");
                byte[] png = Base64.decode(encodedPng, Base64.NO_WRAP);
                if (png.length < 24 || png.length > 65536) throw new IOException("Invalid BitmapData PNG");
                return probedImage(png, "image/png", "BitmapData");
            }
            if (operation.equals("glbJpeg")) return embeddedImage(job, "image/jpeg");
            if (operation.equals("glbPng")) return embeddedImage(job, "image/png");
            int width = dimension(job, "width"), height = dimension(job, "height");
            if ((long) width * height > MAX_PIXELS) throw new IOException("Raster exceeds pixel budget");
            if (operation.equals("png")) return png(job.getString("path"), width, height);
            if (operation.equals("text") || operation.equals("textOutline")) return text(runs(job), width, height);
            throw new IOException("Unknown raster operation");
        } catch (IOException | JSONException | IllegalArgumentException error) {
            return "{\"error\":" + JSONObject.quote(error.toString()) + "}";
        }
    }

    private static int dimension(JSONObject job, String key) throws JSONException {
        double n = job.getDouble(key);
        if (!(n >= 1 && n <= 4096 && n == Math.floor(n))) throw new IllegalArgumentException("Invalid " + key);
        return (int)n;
    }

    // The World3D reader has already validated this bufferView. Reopen just the
    // declared APK member so compressed artwork never crosses the VM as Base64.
    private String embeddedImage(JSONObject job, String expectedMimeType) throws IOException, JSONException {
        String path = job.getString("path");
        double start = job.getDouble("offset"), size = job.getDouble("length");
        if (start < 0 || size < 1 || start + size > (8 << 20) || start != Math.floor(start) || size != Math.floor(size))
            throw new IOException("Invalid GLB image range");
        byte[] bytes = new byte[(int)size];
        try (DataInputStream input = new DataInputStream(assets.openDeclared(path))) {
            for (int remaining = (int)start; remaining > 0;) {
                int skipped = input.skipBytes(remaining);
                if (skipped == 0) { input.readByte(); skipped = 1; }
                remaining -= skipped;
            }
            input.readFully(bytes);
        }
        return probedImage(bytes, expectedMimeType, path);
    }

    private static String probedImage(byte[] bytes, String expectedMimeType, String path) throws IOException {
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        int width = options.outWidth, height = options.outHeight;
        if (!expectedMimeType.equals(options.outMimeType) || width < 1 || height < 1 ||
                width > 4096 || height > 4096 || (long)width * height > MAX_PIXELS)
            throw new IOException("Unsupported embedded image size or format");
        return decode(bytes, options, path);
    }

    private String png(String path, int width, int height) throws IOException {
        byte[] bytes = assets.read(path, 8 << 20);
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        if (!"image/png".equals(options.outMimeType) || options.outWidth != width || options.outHeight != height)
            throw new IOException("PNG dimensions or format differ from the request: " + path);
        return decode(bytes, options, path);
    }

    private static String decode(byte[] bytes, BitmapFactory.Options options, String path) throws IOException {
        options.inJustDecodeBounds = false;
        options.inScaled = false;
        // Unassociated channels survive decode of translucent PNG texels.
        options.inPremultiplied = false;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        options.inPreferredColorSpace = ColorSpace.get(ColorSpace.Named.SRGB);
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        if (bitmap == null) throw new IOException("Image decode failed: " + path);
        try { return pixels(bitmap); }
        finally { bitmap.recycle(); }
    }

    private static JSONArray runs(JSONObject job) throws JSONException {
        JSONArray values = job.getJSONArray("runs");
        if (values.length() > MAX_RUNS) throw new IllegalArgumentException("Too many text runs");
        return values;
    }

    private static float number(JSONObject run, String key, double min, double max) throws JSONException {
        double n = run.getDouble(key);
        if (!(n >= min && n <= max)) throw new IllegalArgumentException("Invalid " + key);
        return (float)n;
    }

    private static String prepare(Paint paint, JSONObject run) throws JSONException {
        String text = run.getString("text");
        if (text.length() > 4096) throw new IllegalArgumentException("Text run is too long");
        int weight = run.has("weight") ? (int)number(run, "weight", 1, 1000) : 400;
        String family = run.optString("fontFamily", "sans-serif");
        if (family.isEmpty() || family.length() > 256) throw new IllegalArgumentException("Invalid font family");
        boolean italic = run.optBoolean("italic", false);
        Typeface face = family.equals("sans-serif") ? Typeface.DEFAULT : Typeface.create(family, Typeface.NORMAL);
        Typeface type = Build.VERSION.SDK_INT >= 28
            ? Typeface.create(face, weight, italic)
            : Typeface.create(face, (weight >= 600 ? Typeface.BOLD : Typeface.NORMAL) | (italic ? Typeface.ITALIC : 0));
        paint.setTypeface(type);
        paint.setTextSize(number(run, "size", 1, 256));
        paint.setTextScaleX(1f);
        return text;
    }

    private static String graphemes(String text) throws JSONException {
        if (text.length() > 8192) throw new IllegalArgumentException("Text exceeds grapheme limit");
        BreakIterator iterator = BreakIterator.getCharacterInstance(Locale.ROOT);
        iterator.setText(text);
        JSONArray ends = new JSONArray();
        iterator.first();
        for (int end = iterator.next(); end != BreakIterator.DONE; end = iterator.next()) ends.put(end);
        return new JSONObject().put("ends", ends).toString();
    }

    private static String metrics(JSONArray runs) throws JSONException {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        Rect ink = new Rect();
        JSONArray result = new JSONArray();
        for (int i = 0; i < runs.length(); i++) {
            String text = prepare(paint, runs.getJSONObject(i));
            paint.getTextBounds(text, 0, text.length(), ink);
            result.put(new JSONObject().put("width", paint.measureText(text)).put("ascent", -paint.ascent())
                .put("descent", paint.descent()).put("left", ink.left).put("top", ink.top)
                .put("right", ink.right).put("bottom", ink.bottom));
        }
        return new JSONObject().put("metrics", result).toString();
    }

    private static String measure(JSONArray runs) throws JSONException {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        JSONArray values = new JSONArray();
        for (int i = 0; i < runs.length(); i++) {
            String value = prepare(paint, runs.getJSONObject(i));
            values.put((double)paint.measureText(value));
        }
        return "{\"widths\":" + values + "}";
    }

    private static String text(JSONArray runs, int width, int height) throws JSONException {
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        try {
            Canvas canvas = new Canvas(bitmap);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
            for (int i = 0; i < runs.length(); i++) {
                JSONObject run = runs.getJSONObject(i);
                String value = prepare(paint, run);
                float x = number(run, "x", -4096, 4096), top = number(run, "y", -4096, 4096);
                float maxWidth = number(run, "maxWidth", 0, 4096);
                String rgb = run.getString("color");
                if (rgb.length() != 7 || rgb.charAt(0) != '#') throw new IllegalArgumentException("Expected #RRGGBB");
                int fillColor = Color.parseColor(rgb);
                float advance = paint.measureText(value);
                if (advance > 0 && maxWidth > 0) {
                    paint.setTextScaleX(Math.min(1f, maxWidth / advance));
                    float baseline = top - paint.ascent();
                    float stroke = run.has("strokeWidth") ? number(run, "strokeWidth", 0, 512) : 0;
                    if (stroke > 0) {
                        String outline = run.optString("strokeColor", "#000000");
                        if (!outline.matches("#[0-9a-fA-F]{6}")) throw new IllegalArgumentException("Expected #RRGGBB");
                        paint.setColor(Color.parseColor(outline));
                        paint.setStyle(Paint.Style.STROKE);
                        paint.setStrokeJoin(Paint.Join.ROUND);
                        paint.setStrokeWidth(stroke * 2);
                        canvas.drawText(value, x, baseline, paint);
                    }
                    paint.setStyle(Paint.Style.FILL);
                    paint.setColor(fillColor);
                    canvas.drawText(value, x, baseline, paint);
                }
            }
            return pixels(bitmap);
        } finally { bitmap.recycle(); }
    }

    private static String pixels(Bitmap bitmap) {
        int w = bitmap.getWidth(), h = bitmap.getHeight(), offset = 0;
        byte[] rgba = new byte[w * h * 4];
        int rows = Math.min(h, 32);
        int[] colors = new int[w * rows];
        for (int y = 0; y < h; y += rows) {
            int count = Math.min(rows, h - y);
            // getPixels gives straight ARGB ints regardless of Android's backing storage.
            bitmap.getPixels(colors, 0, w, 0, y, w, count);
            for (int i = 0; i < w * count; i++) {
                int c = colors[i];
                rgba[offset++] = (byte)(c >>> 16);
                rgba[offset++] = (byte)(c >>> 8);
                rgba[offset++] = (byte)c;
                rgba[offset++] = (byte)(c >>> 24);
            }
        }
        return "{\"width\":" + w + ",\"height\":" + h + ",\"pixels\":\"" + Base64.encodeToString(rgba, Base64.NO_WRAP) + "\"}";
    }
}
