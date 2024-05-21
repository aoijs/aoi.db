export default class Mutex {
	#lock: boolean;
	#queue: (() => void)[];

	constructor() {
		this.#lock = false;
		this.#queue = [];
	}

	lock() {
		return new Promise<void>((resolve) => {
			if (!this.#lock) {
				this.#lock = true;
				resolve();
				return;
			}
			this.#queue.push(resolve);
		});
	}

	unlock() {
		if (this.#queue.length > 0) {
			const resolve = this.#queue.shift()!;
			resolve();
			return;
		}
		this.#lock = false;
	}

	isLocked() {
		return this.#lock;
	}
}
