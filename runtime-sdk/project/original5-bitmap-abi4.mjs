// SPDX-License-Identifier: Apache-2.0
// Egret 5.3.1 and 5.3.2 assign an ordinary own "source" property. Later cores
// construct a NativeBitmapData themselves. Both paths retain the same page lease.
export function original4BitmapData(NativeBitmapData) {
  const owners = new WeakMap();
  let uninstall;

  function install(egret) {
    const proto = egret.BitmapData.prototype;
    if ('source' in proto) throw new Error('Expected the ABI 4 BitmapData source field');
    function get() { return owners.get(this)?.value; }
    function set(value) {
      let row = owners.get(this);
      if (!row) {
        row = {data: new NativeBitmapData(), value: undefined};
        owners.set(this, row);
        // Keep Object.keys(instance) and source reads compatible with the original constructor.
        Object.defineProperty(this, 'source', {get, set, enumerable: true, configurable: true});
      }
      row.data.assign(value);
      row.value = value;
    }
    Object.defineProperty(proto, 'source', {get, set, configurable: true});
    uninstall = () => {
      if (Object.getOwnPropertyDescriptor(proto, 'source')?.set === set) delete proto.source;
    };
  }
  return {
    install,
    dataOf(value) { return owners.get(value)?.data; },
    dispose(value) { owners.get(value)?.data.assign(undefined); },
    close() { uninstall?.(); }
  };
}
