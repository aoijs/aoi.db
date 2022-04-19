export class WideColumnMemMap {
    data;
    options;
    constructor(options, init) {
        this.data = new Map(init);
        this.options = options;
    }
    top(n = 1) {
        let data = [...this.data.values()];
        if (n === 1)
            return data[0];
        data = data.slice(0, n);
        if (data.length === 1)
            return data[0];
        return data;
    }
    bottom(n = 1) {
        let data = [...this.data.values()];
        if (n === 1)
            return data[data.length - 1];
        data = data.slice(data.length - n);
        if (data.length === 1)
            return data[0];
        return data;
    }
    set(key, value) {
        if ((this.options?.limit ?? 10000) === this.data.size)
            return;
        this.data.set(key, value);
    }
    get(key) {
        return this.data.get(key);
    }
    delete(key) {
        return this.data.delete(key);
    }
    clear() {
        return this.data.clear();
    }
    find(func) {
        for (const [key, value] of this.data) {
            ReadableStream;
            if (func(value, key, this))
                return value;
        }
    }
    filter(func) {
        const res = [];
        for (const [key, value] of this.data) {
            if (func(value, key, this)) {
                res.push(value);
            }
        }
        return res;
    }
    some(func) {
        for (const [key, value] of this.data) {
            if (func(value, key, this))
                return true;
        }
        return false;
    }
    every(func) {
        for (const [key, value] of this.data) {
            if (!func(value, key, this))
                return false;
        }
        return true;
    }
    forEach(func) {
        for (const [key, value] of this.data) {
            func(value, key, this);
        }
    }
    map(func) {
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
            if ((a[1].secondary.value ?? 0) < (b[1].secondary.value ?? 0))
                return this.options.sortOrder === "DESC" ? 1 : -1;
            else if ((a[1].secondary.value ?? 0) === (b[1].secondary.value ?? 0))
                return 0;
            else
                return this.options.sortOrder === "DESC" ? -1 : 1;
        });
        let i = 0;
        while (i < (this.options?.limit ?? 10000) && i < entries.length) {
            this.data.set(entries[i][0], entries[i][1]);
            i++;
        }
    }
    concat(...map) {
        for (const m of map) {
            for (const [key, value] of m.data) {
                this.data.set(key, value);
            }
        }
        return this;
    }
    deleteDatas(...keys) {
        for (const key of keys) {
            this.data.delete(key);
        }
        return this;
    }
    slice(start = 0, end = this.data.size) {
        return [...this.data.values()].slice(start, end);
    }
    random() {
        return [...this.data.values()][Math.floor(Math.random() * this.data.size)];
    }
}
//# sourceMappingURL=cacher.js.map