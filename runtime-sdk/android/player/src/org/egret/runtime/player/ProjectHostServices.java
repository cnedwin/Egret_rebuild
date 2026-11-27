// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Executor;

/** Named operations supplied by the embedding Activity. One table belongs to one player session. */
public final class ProjectHostServices {
    public interface Reply {
        void resolve(String json);
        void reject(String message);
    }

    @FunctionalInterface
    public interface Handler {
        /** Runs on the UI thread. Return a UI-thread cancellation action, or null for a completed call. */
        Runnable begin(String requestJson, Reply reply);
        /** Called on the UI thread when the owning player closes, even if no requests are pending. */
        default void closeSession() {}
    }

    interface Delivery { void ready(int id, boolean ok); }

    private static final class Request {
        Runnable cancel;
        boolean complete;
        String response;
    }

    private final Map<String, Handler> handlers;
    private final Map<Integer, Request> requests = new HashMap<>();
    private final java.util.Set<Request> retiring = new java.util.HashSet<>();
    private final Executor ui;
    private final Delivery delivery;
    private final java.util.function.Consumer<RuntimeException> notifyError;
    private boolean closed;

    ProjectHostServices(Map<String, Handler> handlers, Executor ui, Delivery delivery,
                        java.util.function.Consumer<RuntimeException> notifyError) {
        this.handlers = new HashMap<>(handlers);
        for (Map.Entry<String, Handler> entry : this.handlers.entrySet()) {
            if (!entry.getKey().matches("[A-Za-z][A-Za-z0-9_.-]{0,63}"))
                throw new IllegalArgumentException("Invalid host action");
            Objects.requireNonNull(entry.getValue());
        }
        this.ui = ui;
        this.delivery = delivery;
        this.notifyError = notifyError;
    }

    synchronized boolean start(int id, String action, String json) {
        Handler handler = handlers.get(action);
        if (closed || handler == null || id <= 0 || requests.containsKey(id) || requests.size() >= 32
                || json == null || json.length() > 65536) return false;
        Request request = new Request();
        requests.put(id, request);
        ui.execute(() -> dispatch(id, request, handler, json));
        return true;
    }

    private void dispatch(int id, Request request, Handler handler, String json) {
        synchronized (this) { if (requests.get(id) != request) return; }
        Reply reply = new Reply() {
            @Override public void resolve(String text) { finish(id, request, true, text); }
            @Override public void reject(String text) { finish(id, request, false, text); }
        };
        try {
            Runnable cancel = handler.begin(json, reply);
            synchronized (this) {
                if (request.complete) return;
                if (requests.get(id) == request) { request.cancel = cancel; return; }
            }
            if (cancel != null) cancel.run();
        } catch (RuntimeException error) { reply.reject("Channel provider failed"); }
    }

    private void finish(int id, Request request, boolean ok, String text) {
        boolean valid = text != null && text.length() <= 65536;
        synchronized (this) {
            if (requests.get(id) != request || request.complete) return;
            request.complete = true;
            request.cancel = null;
            request.response = valid ? text : "Invalid channel reply";
        }
        ui.execute(() -> {
            synchronized (this) { if (requests.get(id) != request) return; }
            delivery.ready(id, valid && ok);
        });
    }

    synchronized String take(int id) {
        Request request = requests.get(id);
        if (request == null || !request.complete) return null;
        requests.remove(id);
        return request.response;
    }

    synchronized void cancel(int id) {
        Request request = requests.remove(id);
        if (request != null && request.cancel != null) {
            retiring.add(request);
            ui.execute(() -> {
                synchronized (this) { if (!retiring.remove(request)) return; }
                safely(request.cancel);
            });
        }
    }

    private void safely(Runnable action) {
        try { action.run(); } catch (RuntimeException error) { notifyError.accept(error); }
    }

    /** Called on the UI thread. Retire every ID before a provider can make a reentrant callback. */
    void close() {
        ArrayList<Runnable> cleanup = new ArrayList<>();
        java.util.Set<Handler> owners = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        synchronized (this) {
            if (closed) return;
            closed = true;
            for (Request request : requests.values()) if (request.cancel != null) cleanup.add(request.cancel);
            for (Request request : retiring) cleanup.add(request.cancel);
            requests.clear();
            retiring.clear();
            owners.addAll(handlers.values());
            handlers.clear();
        }
        for (Runnable action : cleanup) safely(action);
        for (Handler owner : owners) safely(owner::closeSession);
    }
}
