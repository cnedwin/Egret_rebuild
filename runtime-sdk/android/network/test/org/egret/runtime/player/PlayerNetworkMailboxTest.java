// SPDX-License-Identifier: Apache-2.0
package org.egret.runtime.player;

import java.util.Base64;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.egret.runtime.network.PlayerNetwork;
import org.json.JSONObject;

/** Delay UI delivery and cleanup using the real host request table and an established binary socket. */
public final class PlayerNetworkMailboxTest {
    public interface Sender { void send() throws Exception; }

    private static void check(boolean result, String name) {
        if (!result) throw new AssertionError(name);
    }

    public static void verify(PlayerNetwork network, int socket, byte[] packet, Sender sender) throws Exception {
        LinkedBlockingQueue<Runnable> ui = new LinkedBlockingQueue<>();
        AtomicReference<CountDownLatch> offered = new AtomicReference<>();
        AtomicInteger delivered = new AtomicInteger();
        ProjectHostServices.Handler observed = (json, reply) -> network.begin(json, new ProjectHostServices.Reply() {
            @Override public void resolve(String value) {
                reply.resolve(value);
                offered.get().countDown();
            }
            @Override public void reject(String reason) { reply.reject(reason); }
        });
        ProjectHostServices host = new ProjectHostServices(Map.of(PlayerNetwork.ACTION, observed), ui::add,
            (id, ok) -> delivered.incrementAndGet(), error -> { throw error; });
        String receive = new JSONObject().put("op","receive").put("id",socket).toString();
        for (boolean cancelBeforeOffer : new boolean[]{false, true}) {
            offered.set(new CountDownLatch(1));
            check(host.start(1, PlayerNetwork.ACTION, receive), "start receive");
            ui.remove().run();
            if (cancelBeforeOffer) host.cancel(1);
            sender.send();
            check(offered.get().await(5, TimeUnit.SECONDS), "native message reached host");
            if (!cancelBeforeOffer) host.cancel(1);
            Runnable next;
            while ((next = ui.poll()) != null) next.run();
            check(host.take(1) == null && delivered.get() == 0, "JS did not receive the canceled delivery");
            check(host.start(2, PlayerNetwork.ACTION, receive), "retry receive");
            ui.remove().run();
            ui.remove().run();
            JSONObject result = new JSONObject(host.take(2));
            check(result.getString("body").equals(Base64.getEncoder().encodeToString(packet)), "same packet on retry");
            String ack = new JSONObject().put("op","ack").put("id",socket).put("sequence",result.getLong("sequence")).toString();
            check(host.start(3, PlayerNetwork.ACTION, ack), "acknowledge only after consumption");
            ui.remove().run();
            ui.remove().run();
            check("null".equals(host.take(3)), "acknowledgement accepted");
            delivered.set(0);
        }
        host.close();
    }
}
