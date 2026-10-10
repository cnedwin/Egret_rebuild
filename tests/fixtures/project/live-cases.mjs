export function invalidLiveCases() {
  const cycle = {}; cycle.self = cycle;
  const hole = new Array(1);
  const extra = []; extra.extra = 1;
  const symbol = {}; symbol[Symbol('x')] = 1;
  const hidden = {}; Object.defineProperty(hidden, 'x', { value: 1 });
  const getterArray = []; Object.defineProperty(getterArray, '0', { get() { throw Error('must not call'); }, enumerable: true });
  const index = []; index[1] = 0;
  const arraySymbol = []; arraySymbol[Symbol('x')] = 0;
  const hiddenArray = [0]; Object.defineProperty(hiddenArray, '0', { value: 0, enumerable: false });
  const customArray = []; Object.setPrototypeOf(customArray, null);
  return [hole, extra, index, arraySymbol, hiddenArray, customArray, symbol, hidden, getterArray, Object.create({}), cycle, () => {}, undefined, 1n, new Date(), new Map(), new Uint8Array(), '\ud800', { ['\udfff']: 1 }, new Proxy({}, { ownKeys() { throw Error('SECRET SOURCE'); } })];
}
