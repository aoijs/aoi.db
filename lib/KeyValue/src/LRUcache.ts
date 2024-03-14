import { PriorityQueue } from "@akarui/structures";
import Data from "./data.js";

class LRUCache {
  private capacity: number;
  private cache: Map<Data["key"], Data>;
  private queue: PriorityQueue;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.queue = new PriorityQueue((a, b) => a.timestamp < b.timestamp);
  }

  get(key: string): Data | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const value = this.cache.get(key);
    this.updatePriority(key, Date.now());
    return value;
  }

  put(key: string, value: Data): void {
    if (this.cache.has(key)) {
      this.updatePriority(key, Date.now());
    } else {
      if (this.cache.size === this.capacity) {
        const evictedKey = this.queue.pop().key;
        this.cache.delete(evictedKey);
      }

      this.cache.set(key, value);
      this.queue.push({ key, timestamp: Date.now() });
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  private updatePriority(key: string, timestamp: number): void {
    const oldEntry = this.queue.findFromProp(
      (entry: { key: string }) => entry.key === key
    );
    if (oldEntry !== -1) {
      this.queue.replaceFromProp(
        { key, timestamp },
        (data: Data) => data.key === key
      );
    }
  }

  remove(key: string): void {
    this.cache.delete(key);
    this.queue.removeByProp((entry: { key: string }) => entry.key === key);
  }
  clear(): void {
    this.cache.clear();
    this.queue._heap = [];
    this.queue._keyMap.clear();
  }
}

export default LRUCache;
