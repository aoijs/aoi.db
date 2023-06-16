import { CacherOptions, KeyValueDatabaseOption } from "../typings/interface.js";
import { Data } from "./data.js";

export class Cacher {
  data: Map<string, Data>;
  options: CacherOptions;
  constructor(
    options: CacherOptions,
    init?: Readonly<Readonly<[string, Data][]>>,
  ) {
    this.data = new Map<string, Data>(init);
    this.options = options;
  }
  top(n = 1) {
    let data = [...this.data.values()];
    if (n === 1) return data[0];
    data = data.slice(0, n);
    if (data.length === 1) return data[0];
    return data;
  }
  bottom(n = 1) {
    let data = [...this.data.values()];
    if (n === 1) return data[data.length - 1];
    data = data.slice(data.length - n);
    if (data.length === 1) return data[0];
    return data;
  }
  set(key: string, value: Data) {
    if(!key && key !== "") return ;
    if (this.options?.sorted) {
      this.data.set(key, value);
      this.sort();
      return this;
    } else if (this.data.size < (this.options?.limit ?? 10000)) {
      this.data.set(key, value);
      return this;
    }
  }
  manualSet(key: string, value: Data) {
    if ((this.options?.limit ?? 10000) === this.data.size) return;
    if(!key && key !== "") return;
    this.data.set(key, value);
  }
  get(key: string) {
    return this.data.get(key);
  }
  delete(key: string) {
    return this.data.delete(key);
  }
  clear() {
    return this.data.clear();
  }
  find(func: (val: Data, k?: string, cacher?: this) => boolean) {
    for (const [key, value] of this.data) {
      if (func(value, key, this)) return value;
    }
  }
  filter(func: (val: Data, k?: string, cacher?: this) => boolean) {
    const res = [];
    for (const [key, value] of this.data) {
      if (func(value, key, this)) {
        res.push(value);
      }
    }
    return res;
  }
  some(func: (val: Data, k: string, cacher: this) => boolean) {
    for (const [key, value] of this.data) {
      if (func(value, key, this)) return true;
    }
    return false;
  }
  every(func: (val: Data, k: string, cacher: this) => boolean) {
    for (const [key, value] of this.data) {
      if (!func(value, key, this)) return false;
    }
    return true;
  }
  forEach(func: (val: Data, k: string, cacher: this) => void) {
    for (const [key, value] of this.data) {
      func(value, key, this);
    }
  }
  map<U>(func: (val: Data, k: string, cacher: this) => U) {
    const res = [];
    for (const [key, value] of this.data) {
      res.push(func(value, key, this));
    }
    return res;
  }
  sort() {
    let entries = [...this.data.entries()];
    this.data.clear();
    entries = entries.sort((a, b) => {
      if ((a[1].value ?? 0) < (b[1].value ?? 0)) return 1;
      else if ((a[1].value ?? 0) === (b[1].value ?? 0)) return 0;
      else return -1;
    });

    let i = 0;
    while (i < (this.options?.limit ?? 10000) && i < entries.length) {
      this.data.set(entries[i][0], entries[i][1]);
      i++;
    }
  }
}
