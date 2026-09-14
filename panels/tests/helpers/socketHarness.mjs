import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

export function socketHarness() {
  const sockets = [], timers = new Map(), storage = new Map();
  let timerId = 0;
  class FakeSocket {
    static CONNECTING = 0; static OPEN = 1;
    constructor() { this.readyState = 0; this.listeners = {}; this.sent = []; sockets.push(this); }
    addEventListener(event, fn) { (this.listeners[event] ??= new Set()).add(fn); }
    emit(event, data = {}) { for (const fn of this.listeners[event] ?? []) fn(data); }
    send(data) { this.sent.push(JSON.parse(data)); }
    open() { this.readyState = 1; this.emit('open'); }
    receive(message) { this.emit('message', { data: JSON.stringify(message) }); }
    close() { this.readyState = 3; this.emit('close'); }
  }
  const exported = {};
  const context = vm.createContext({ exports: exported, WebSocket: FakeSocket,
    require: () => ({ getSocketUrl: () => 'ws://localhost:2087' }), console,
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id)
  });
  const source = fs.readFileSync(new URL('../../src/Game/Socket.ts', import.meta.url), 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { api: exported, sockets, timers, runTimers() {
    const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn());
  } };
}
