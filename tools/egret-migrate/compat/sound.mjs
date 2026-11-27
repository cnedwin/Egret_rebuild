// SPDX-License-Identifier: Apache-2.0
/** The classic BGM channel emits soundComplete only when its owning output finishes naturally. */
export function classicSoundResource(output, EventDispatcher, scope, report) {
  let live,
    disposed = false;
  class SoundChannel extends EventDispatcher {
    #voice;
    #stopped = false;
    #volume = 1;
    constructor(offset) {
      super();
      this.#voice = output.start(offset);
      void this.#voice.ended.then(
        reason => {
          if (reason !== 'finished') this.#stopped = true;
          if (live !== this || disposed || scope.signal.aborted) return;
          live = undefined;
          if (reason === 'finished') this.dispatchEventWith('soundComplete');
        },
        error => {
          if (live === this && !disposed && !scope.signal.aborted) {
            live = undefined;
            report(error);
          }
        }
      );
    }
    get position() {
      return this.#stopped ? 0 : this.#voice.position;
    }
    get volume() {
      return this.#volume;
    }
    set volume(value) {
      if (!Number.isFinite(value) || value < 0 || value > 1)
        throw new RangeError('Expected a volume between zero and one.');
      if (live === this) this.#voice.setVolume(value);
      this.#volume = value;
    }
    stop() {
      this.#stopped = true;
      if (live !== this) return;
      live = undefined;
      this.#voice.stop();
    }
  }
  return Object.freeze({
    get length() {
      return output.seconds;
    },
    play(offset = 0, loops = 1) {
      if (disposed || scope.signal.aborted) throw new Error('The sound resource has been released.');
      if (loops !== 1 || !Number.isFinite(offset) || offset < 0 || offset >= output.seconds)
        throw new RangeError('Classic BGM accepts one playback from a position inside the soundtrack.');
      live?.stop();
      live = new SoundChannel(offset);
      return live;
    },
    close() {
      if (disposed) return;
      disposed = true;
      live?.stop();
      output.close();
    }
  });
}

/** A browser media element preserves streaming, native positions, user activation and media completion. */
export function browserClassicMusic(view, signal) {
  let current;
  return async url => {
    if (signal.aborted) throw signal.reason;
    const audio = new view.Audio();
    function release() {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    try {
      await new Promise((resolve, reject) => {
        function settle(callback, value) {
          audio.removeEventListener('loadedmetadata', ready);
          audio.removeEventListener('error', failed);
          signal.removeEventListener('abort', cancelled);
          callback(value);
        }
        const ready = () => settle(resolve);
        const failed = () => settle(reject, new Error('The browser could not open the declared soundtrack.'));
        const cancelled = () => settle(reject, signal.reason);
        audio.addEventListener('loadedmetadata', ready);
        audio.addEventListener('error', failed);
        signal.addEventListener('abort', cancelled, { once: true });
        audio.preload = 'metadata';
        audio.src = url;
        audio.load();
      });
      if (!Number.isFinite(audio.duration) || audio.duration <= 0)
        throw new Error('The soundtrack has no finite duration.');
    } catch (error) {
      release();
      throw error;
    }
    let own;
    return {
      seconds: audio.duration,
      start(offset) {
        current?.stop();
        const { promise, resolve, reject } = Promise.withResolvers();
        let active = true,
          finalPosition = 0;
        function finish(reason, error) {
          if (!active) return;
          finalPosition = reason === 'finished' ? audio.currentTime : 0;
          active = false;
          audio.removeEventListener('ended', ended);
          audio.removeEventListener('error', failed);
          if (current === voice) current = undefined;
          if (own === voice) own = undefined;
          if (error) reject(error);
          else resolve(reason);
        }
        const ended = () => {
          if (audio.ended) finish('finished');
        };
        const failed = () => finish(undefined, new Error('The browser soundtrack failed during playback.'));
        const voice = {
          ended: promise,
          get position() {
            return active ? audio.currentTime : finalPosition;
          },
          setVolume(value) {
            if (active) audio.volume = value;
          },
          stop() {
            if (active) {
              finish('stopped');
              audio.pause();
            }
          }
        };
        current = own = voice;
        audio.addEventListener('ended', ended);
        audio.addEventListener('error', failed);
        try {
          audio.currentTime = offset;
          audio.volume = 1;
          audio.play().catch(error => finish(undefined, error));
        } catch (error) {
          finish(undefined, error);
        }
        return voice;
      },
      close() {
        own?.stop();
        release();
      }
    };
  };
}

/** Android sends an actual MediaPlayer completion. Position projects its last confirmed sample between reads. */
export function androidClassicMusic(host, scope, report) {
  let current,
    next = 0,
    paused = false;
  const now = () => globalThis.performance?.now?.() ?? Date.now();
  return {
    visibility(hidden) {
      current?.visibility(hidden);
      paused = hidden;
    },
    async load(path) {
      const { seconds } = await host.call('egret.music.describe', { path }, scope.signal);
      if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('The packaged soundtrack has no finite duration.');
      let own;
      return {
        seconds,
        start(offset) {
          current?.stop();
          const id = ++next,
            ctl = new AbortController();
          let active = true,
            confirmed = false,
            position = offset,
            stamp = now(),
            ticket = 0;
          function at() {
            return Math.min(
              seconds,
              position + (active && confirmed && !paused ? Math.max(0, now() - stamp) / 1000 : 0)
            );
          }
          function sample() {
            const order = ++ticket;
            host.call('egret.music.position', { id }, ctl.signal).then(
              value => {
                if (active && order === ticket && Number.isFinite(value)) {
                  position = value;
                  stamp = now();
                  confirmed = true;
                }
              },
              error => {
                if (active && !scope.signal.aborted) report(error);
              }
            );
          }
          function retired() {
            if (!active) return;
            position = at();
            active = false;
            if (own === voice) own = undefined;
            if (current === voice) current = undefined;
          }
          const pending = host.call('egret.music.once', { path, id, offset, volume: 1 }, ctl.signal);
          const voice = {
            ended: pending.then(
              result => {
                if (result === 'finished') {
                  position = seconds;
                  confirmed = false;
                }
                retired();
                return result;
              },
              error => {
                const stopped = !active;
                retired();
                if (!stopped) throw error;
                return 'stopped';
              }
            ),
            get position() {
              return at();
            },
            setVolume(volume) {
              if (active)
                host.call('egret.music.volume', { id, volume }, ctl.signal).catch(error => {
                  if (active && !scope.signal.aborted) report(error);
                });
            },
            visibility(hidden) {
              position = at();
              stamp = now();
              ticket++;
              if (!hidden && active) sample();
            },
            stop() {
              if (active) {
                retired();
                ctl.abort();
              }
            }
          };
          current = own = voice;
          sample();
          return voice;
        },
        close() {
          own?.stop();
        }
      };
    }
  };
}
