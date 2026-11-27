// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ProjectHostServicesTest {
    private static void check(boolean value) { if (!value) throw new AssertionError(); }

    public static void main(String[] args) {
        ArrayDeque<Runnable> ui = new ArrayDeque<>();
        List<ProjectHostServices.Reply> pending = new ArrayList<>();
        List<Integer> events = new ArrayList<>();
        int[] canceled = {0};
        ProjectHostServices calls = new ProjectHostServices(Collections.singletonMap("sdk.test", (json, reply) -> {
            pending.add(reply);
            return () -> canceled[0]++;
        }), ui::add, (id, ok) -> events.add(ok ? id : -id), error -> { throw new AssertionError(error); });

        check(!calls.start(1, "sdk.unknown", "{}"));
        check(calls.start(1, "sdk.test", "{}"));
        check(!calls.start(1, "sdk.test", "{}"));
        calls.cancel(1);
        ui.remove().run();
        check(pending.isEmpty());
        check(calls.start(2, "sdk.test", "[]"));
        ui.remove().run();
        pending.get(0).resolve("\"first\"");
        pending.get(0).reject("late");
        ui.remove().run();
        check(events.equals(Collections.singletonList(2)));
        check("\"first\"".equals(calls.take(2)));
        check(calls.take(2) == null);
        check(calls.start(3, "sdk.test", "null"));
        ui.remove().run();
        calls.close();
        pending.get(1).resolve("\"obsolete\"");
        while (!ui.isEmpty()) ui.remove().run();
        check(canceled[0] == 1 && calls.take(3) == null && events.size() == 1);
        check(!calls.start(4, "sdk.test", "null"));

        List<String> retired = new ArrayList<>();
        ProjectHostServices.Handler service = new ProjectHostServices.Handler() {
            public Runnable begin(String request, ProjectHostServices.Reply reply) {
                return () -> retired.add("cancel");
            }
            public void closeSession() { retired.add("close"); }
        };
        java.util.Map<String, ProjectHostServices.Handler> routes = new java.util.HashMap<>();
        routes.put("first", service);
        routes.put("second", service);
        ProjectHostServices shared = new ProjectHostServices(routes, ui::add, (id, ok) -> {},
                error -> { throw new AssertionError(error); });
        check(shared.start(1, "first", "{}"));
        ui.remove().run();
        shared.cancel(1);
        shared.close();
        shared.close();
        while (!ui.isEmpty()) ui.remove().run();
        check(retired.equals(java.util.Arrays.asList("cancel", "close")));
    }
}
