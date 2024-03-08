import fsPromises from "node:fs/promises";
import fs from "node:fs";
import { join, dirname, basename } from "node:path";
import { Group } from "@akarui/structures";
import { DataType } from "./typings.js";

export default class TextFile {
  #file: string;
  #tempFile: string;
  #locked = false;
  #type : DataType = 'str:1024';
  #fd: fsPromises.FileHandle | null = null;
  #tfd: fsPromises.FileHandle | null = null;
  #lineoffsets : number[] = [];
  #queue: { fn: () => void }[] = [];
  #retries = 0;
  constructor(path: string,type: DataType ) {
    this.#file = path;
    this.#type = type;
    this.#tempFile = join(dirname(path), `.${basename(path)}.tmp`);
    fsPromises
      .open(this.#file, fs.constants.O_CREAT | fs.constants.O_RDWR)
      .then((fd) => {
        this.#fd = fd;
      });
    fsPromises
      .open(this.#tempFile, fs.constants.O_CREAT | fs.constants.O_RDWR)
      .then((fd) => {
        this.#tfd = fd;
      });
  }

  async #retry<T>(
    fn: () => Promise<T>,
    maxRetries = 10,
    delay = 100
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (this.#retries >= maxRetries) {
        this.#retries = 0;
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      this.#retries++;
      return await this.#retry(fn, maxRetries, delay * 2);
    }
  }

  async write(
    position: number,
    data: Buffer,
    bufferStartOffset = 0,
    bufferEndOffset = data.length
  ) {
    if (this.#locked) {
      await new Promise((resolve) => {
        this.#queue.push({
          fn: () => {
            this.write(position, data, bufferStartOffset, bufferEndOffset).then(
              resolve
            );
          },
        });
      });
    }
    this.#locked = true;
    try {
      await this.#tfd?.write(
        data,
        bufferStartOffset,
        bufferEndOffset,
        position
      );
      await this.#tfd?.sync();
      await this.#retry(
        async () => {
            await fsPromises.rename(this.#tempFile, this.#file);
            this.#fd = await fsPromises.open(this.#file, fs.constants.O_CREAT | fs.constants.O_RDWR);
            this.#tfd = await fsPromises.open(this.#tempFile, fs.constants.O_CREAT | fs.constants.O_RDWR);
        }

      );
    } catch (err) {
      throw err;
    } finally {
      this.#locked = false;
      const next = this.#queue.shift();
      if (next) {
        next.fn();
      }
    }
  }

  async read(
    position: number,
    length: number,
    buffer: Buffer,
    bufferStartOffset = 0
  ) {
    if (this.#locked) {
      return await new Promise((resolve) => {
        this.#queue.push({
          fn: () => {
            this.read(position, length, buffer, bufferStartOffset).then(
              resolve
            );
          },
        });
      });
    }
    this.#locked = true;
    try {
      return (await this.#fd?.read(buffer, bufferStartOffset, length, position))
        ?.buffer;
    } catch (err) {
      throw err;
    } finally {
      this.#locked = false;
      const next = this.#queue.shift();
      if (next) {
        next.fn();
      }
    }
  }

  async close() {
    await this.#fd?.close();
    await this.#tfd?.close();
  }

  async unlink() {
    await this.close();
    await fsPromises.unlink(this.#file);
    await fsPromises.unlink(this.#tempFile);
  }

  async getOffsets() {
      this.#lineoffsets = [0];
      const grp = new Group(Infinity);
      for await (const line of this.#fd!.readLines()) {
        const newoffset = this.#lineoffsets.at(-1) as number + line.length + 2; 
        this.#lineoffsets.push(newoffset);
        
        if(this.#type === 'bool' ) {
          
        }
      }
  }
}
