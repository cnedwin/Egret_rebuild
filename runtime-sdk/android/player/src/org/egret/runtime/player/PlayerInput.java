// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.PointF;
import android.opengl.GLSurfaceView;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.SparseArray;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import org.json.JSONException;
import org.json.JSONObject;

final class PlayerInput {
    private final EgretPlayerView owner;
    private final Activity activity;
    private final SparseArray<PointF> pointers = new SparseArray<>();
    private AlertDialog editor;
    int events, edits;

    PlayerInput(EgretPlayerView owner, Activity activity, GLSurfaceView surface, ProjectAssets project) {
        this.owner = owner;
        this.activity = activity;
        surface.setOnTouchListener((view, event) -> {
            if (!owner.isPlaying()) return false;
            float sx = project.width / (float) Math.max(1, view.getWidth());
            float sy = project.height / (float) Math.max(1, view.getHeight());
            int at = event.getActionIndex();
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                case MotionEvent.ACTION_POINTER_DOWN:
                    point("down", event.getPointerId(at), event.getX(at) * sx, event.getY(at) * sy);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    for (int i = 0; i < event.getPointerCount(); i++)
                        point("move", event.getPointerId(i), event.getX(i) * sx, event.getY(i) * sy);
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_POINTER_UP:
                    point("up", event.getPointerId(at), event.getX(at) * sx, event.getY(at) * sy);
                    pointers.remove(event.getPointerId(at));
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    cancelPointers();
                    return true;
                default: return false;
            }
        });
        surface.setOnGenericMotionListener((view, event) -> {
            if (!owner.isPlaying() || event.getActionMasked() != MotionEvent.ACTION_SCROLL) return false;
            float sx = project.width / (float) Math.max(1, view.getWidth());
            float sy = project.height / (float) Math.max(1, view.getHeight());
            float unit = 48 * view.getResources().getDisplayMetrics().density;
            send("scroll", event.getPointerId(0), event.getX() * sx, event.getY() * sy,
                -event.getAxisValue(MotionEvent.AXIS_HSCROLL) * unit * sx,
                -event.getAxisValue(MotionEvent.AXIS_VSCROLL) * unit * sy, null);
            return true;
        });
    }

    private void point(String type, int id, float x, float y) {
        PointF previous = pointers.get(id);
        send(type, id, x, y, previous == null ? 0 : x - previous.x, previous == null ? 0 : y - previous.y, null);
        pointers.put(id, new PointF(x, y));
    }

    private void cancelPointers() {
        for (int i = 0; i < pointers.size(); i++) {
            PointF p = pointers.valueAt(i);
            send("cancel", pointers.keyAt(i), p.x, p.y, 0, 0, null);
        }
        pointers.clear();
    }

    private void send(String type, int id, float x, float y, float dx, float dy, String text) {
        try {
            JSONObject event = new JSONObject().put("type", type).put("id", id)
                .put("x", x).put("y", y).put("dx", dx).put("dy", dy);
            if (text != null) event.put("text", text);
            events++;
            owner.input(event);
        } catch (JSONException e) { owner.reportFailure("Invalid input: " + e); }
    }

    void edit(String initial) {
        if (!owner.isPlaying() || activity.isFinishing() || activity.isDestroyed()) return;
        if (editor != null) editor.dismiss();
        EditText field = new EditText(activity);
        field.setSingleLine(true);
        field.setImeOptions(EditorInfo.IME_ACTION_DONE);
        field.setText(initial);
        field.setSelection(field.length());
        field.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void afterTextChanged(Editable s) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                send("text", -1, 0, 0, 0, 0, s.toString());
            }
        });
        AlertDialog dialog = new AlertDialog.Builder(activity).setView(field)
            .setPositiveButton(android.R.string.ok, (d, which) -> send("submit", -1, 0, 0, 0, 0, field.getText().toString()))
            .create();
        editor = dialog;
        dialog.setOnDismissListener(d -> { if (editor == dialog) editor = null; });
        field.setOnEditorActionListener((v, action, key) -> {
            if (action != EditorInfo.IME_ACTION_DONE && (key == null || key.getKeyCode() != KeyEvent.KEYCODE_ENTER
                || key.getAction() != KeyEvent.ACTION_DOWN)) return false;
            send("submit", -1, 0, 0, 0, 0, field.getText().toString());
            dialog.dismiss();
            return true;
        });
        field.requestFocus();
        dialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
        dialog.show();
        edits++;
    }

    void stop() {
        cancelPointers();
        if (editor != null) { editor.dismiss(); editor = null; }
    }
}
