function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  constructor(seed) {
    this.seed = String(seed);
    this.state = hashSeed(this.seed) || 0x9e3779b9;
  }

  next() {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  float(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }

  int(min, maxInclusive) {
    return Math.floor(this.float(min, maxInclusive + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(items) {
    return items[this.int(0, items.length - 1)];
  }

  shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = this.int(0, index);
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  weighted(entries) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.float(0, total);
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.value;
    }
    return entries.at(-1).value;
  }

  fork(label) {
    return new SeededRandom(`${this.seed}:${label}`);
  }
}

export function createRunSeed() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 0xffffff).toString(36).toUpperCase().padStart(4, "0");
  return `${time}-${random}`;
}

