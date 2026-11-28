// SPDX-License-Identifier: Apache-2.0
// Real browser text, actual touch navigation and readiness; timings are observations, not hardware guarantees.
import assert from 'node:assert/strict';

export async function verifyViewTextBudget(page) {
  const results = [];
  for (const budget of [undefined, 4]) {
    await page.evaluate(async budget => {
      const { play } = await import('@egret/engine/play');
      const { createUiSemantics } = await import('@egret/engine/ui/semantics');
      const { createUiTester } = await import('@egret/engine/ui/testing');
      const { createParagraphCache } = await import('@egret/engine/paragraph');
      const { createCanvasParagraphProvider } = await import('@egret/engine/web/paragraph');
      const errors = [],
        semantics = createUiSemantics(),
        tester = createUiTester({ semantics });
      const names = Array.from({ length: 24 }, (_, i) => 'command' + i);
      const labels = [
        '山门',
        '江湖',
        'Disciple',
        'Chronicle',
        '修习',
        '藏经',
        'School',
        'Choose',
        '委任',
        '商队',
        'Practice',
        'Hall'
      ];
      let game,
        provider,
        cache,
        view,
        index = 0,
        chosen = 0,
        ready = 0,
        version = 0,
        started = 0,
        critical = 0;
      const samples = [],
        longFrames = [],
        paragraph = { fontFamilies: ['sans-serif'], locale: 'zh', lineHeight: 20, maxLines: 2 };
      let raf, previous;
      const record = t => {
        if (previous !== undefined) samples.push([t, t - previous]);
        previous = t;
        raf = requestAnimationFrame(record);
      };
      raf = requestAnimationFrame(record);
      const observer = PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
        ? new PerformanceObserver(list => {
            for (const item of list.getEntries())
              longFrames.push([item.startTime, item.duration, item.blockingDuration]);
          })
        : undefined;
      observer?.observe({ type: 'long-animation-frame' });
      function install(next) {
        view?.close();
        index = next;
        const revision = ++version;
        ready = critical = 0;
        started = performance.now();
        // Twelve shared labels, twelve different labels, and two genuine wrapped paragraphs.
        const words = names.map((name, i) => ({
          type: 'button',
          name,
          width: 'fill',
          height: 44,
          text: labels[i % labels.length] + (i < 12 ? '' : ' ' + next + '-' + i),
          size: 14
        }));
        const rows = Array.from({ length: 4 }, (_, i) => ({
          type: 'panel',
          layout: 'row',
          height: 44,
          gap: 3,
          children: words.slice(i * 6, i * 6 + 6)
        }));
        view = game.show(
          {
            label: 'Native sheet ' + next,
            root: {
              type: 'panel',
              card: true,
              anchor: 'center',
              width: 600,
              height: 348,
              padding: 8,
              gap: 4,
              layout: 'column',
              children: [
                {
                  type: 'button',
                  name: 'next',
                  width: 'fill',
                  height: 44,
                  text: next ? '返回山门 / Return' : '江湖 / Open map'
                },
                ...rows,
                {
                  type: 'text',
                  name: 'storyA',
                  width: 'fill',
                  height: 42,
                  size: 16,
                  text: '卷宗 ' + next + '：群山之间，门派往来。 The account of several schools.',
                  paragraph
                },
                {
                  type: 'text',
                  name: 'storyB',
                  width: 'fill',
                  height: 42,
                  size: 16,
                  text: '掌门令 ' + next + '：共同事务，守卫山门。 Read the evening chronicle.',
                  paragraph
                }
              ]
            }
          },
          {
            paragraphCache: cache,
            bind: {
              next: { tap: () => install(index ? 0 : 1) },
              command0: {
                tap: () => {
                  chosen++;
                }
              }
            }
          }
        );
        const current = view;
        const readyPromises = ['next', ...names].map(name => current.textReady(name));
        if (readyPromises.some(promise => promise === undefined)) throw Error('missing native word readiness');
        void Promise.resolve(readyPromises[0])
          .then(() => {
            if (version === revision) critical = performance.now() - started;
          })
          .catch(() => {});
        void Promise.all(readyPromises)
          .then(() => {
            if (version === revision) ready = performance.now() - started;
          })
          .catch(() => {});
      }
      game = await play({
        width: 640,
        height: 360,
        backend: 'webgl2',
        audio: false,
        semantics,
        ...(budget == null ? {} : { textWorkBudgetMs: budget }),
        onError(error) {
          errors.push(error.code ?? String(error));
        },
        setup(g) {
          game = g;
          provider = createCanvasParagraphProvider(
            g.browser.scheduleTextWork === undefined ? {} : { schedule: g.browser.scheduleTextWork }
          );
          cache = createParagraphCache(g.engine.assets, { provider, maxEntries: 32 });
          install(0);
        }
      });
      window.textBudgetQA = {
        point(name) {
          const box = view.rect(name),
            r = game.canvas.getBoundingClientRect();
          return {
            x: r.left + ((box.x + box.width / 2) * r.width) / game.screen.width,
            y: r.top + ((box.y + box.height / 2) * r.height) / game.screen.height
          };
        },
        status() {
          const s = cache.getStatus();
          return {
            index,
            chosen,
            ready,
            critical,
            errors: [...errors],
            pending: s.pendingJobs,
            labels: game.browser.getLabelStatus(),
            outline: tester.outline(),
            focused: view.focused,
            next: semantics.snapshot.nodes.some(
              n =>
                n.role === 'button' &&
                n.name === (index ? '返回山门 / Return' : '江湖 / Open map') &&
                !n.hidden &&
                !n.inert
            )
          };
        },
        begin() {
          samples.length = 0;
          longFrames.length = 0;
          previous = undefined;
          started = performance.now();
        },
        result() {
          return {
            budget: budget ?? null,
            ready,
            critical,
            samples: samples.map(x => x[1]),
            longFrames: longFrames.slice(),
            errors: [...errors]
          };
        },
        async close() {
          observer?.disconnect();
          cancelAnimationFrame(raf);
          view.close();
          cache.dispose();
          provider.dispose();
          await game.dispose();
        }
      };
    }, budget ?? null);
    const status = () => page.evaluate(() => textBudgetQA.status());
    const waitReady = index =>
      page
        .waitForFunction(
          index => {
            const s = textBudgetQA.status();
            return s.index === index && s.ready > 0 && s.critical > 0 && s.pending === 0 && s.next;
          },
          index,
          { timeout: 10000 }
        )
        .catch(async cause => {
          throw Error('view ' + index + ' readiness: ' + JSON.stringify(await status()), { cause });
        });
    const tap = async name => {
      const p = await page.evaluate(name => textBudgetQA.point(name), name);
      await page.touchscreen.tap(p.x, p.y);
    };
    try {
      await waitReady(0);
      await page.evaluate(() => textBudgetQA.begin());
      await tap('next');
      await waitReady(1);
      const observation = await page.evaluate(() => textBudgetQA.result());
      assert.ok(observation.critical <= observation.ready + 10);
      assert.ok(observation.ready < 2000, 'all visible command words became ready');
      await tap('command0');
      assert.equal((await status()).chosen, 1, 'actual touch hit newly drawn command');
      assert.equal((await status()).focused, 'command0', 'actual touch retained named native focus');
      // Supersede one view before its new text work finishes; no stale input or provider failure.
      await tap('next');
      await page.waitForFunction(() => textBudgetQA.status().index === 0);
      await tap('next');
      await waitReady(1);
      assert.deepEqual((await status()).errors, []);
      results.push(observation);
    } finally {
      await page.evaluate(() => textBudgetQA.close());
    }
  }
  return results;
}
