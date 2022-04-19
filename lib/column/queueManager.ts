import { WideColumnDataValueType } from "../typings/type.js";
import { WideColumnData } from "./data.js";

export class WideColumnQueue {
  queue: {
    get: Map<string, Map<WideColumnDataValueType, WideColumnData | WideColumnDataValueType>>;
    delete: Map<string, Set<WideColumnDataValueType>>;
  };
  queued: { get: boolean; delete: boolean };
  constructor() {
    this.queue = {
      get: new Map<string, Map<WideColumnDataValueType, WideColumnData | WideColumnDataValueType>>(),
      delete: new Map<string, Set<WideColumnDataValueType>>(),
    };
    this.queued = {
      get: false,
      delete: false,
    };
  }
  addToQueue(
    method: "get" | "delete",
    path: string,
    key: WideColumnDataValueType,
    value?: WideColumnData | WideColumnDataValueType,
  ) {
    if (method === "get") {
      if (this.queue.get.has(path)) this.queue[method].set(path, new Map());
      if (!value) return;
      this.queue[method].get(path)?.set(key, value);
    } else {
      if (!this.queue.delete.has(path)) this.queue[method].set(path, new Set());

      this.queue[method].get(path)?.add(key);
    }
  }
  deletePathFromQueue(method: "get" | "delete", path: string): boolean {
    return this.queue[method].delete(path);
  }
}
