/** Классическая система непересекающихся множеств с path compression и union by size. */
export class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly size = new Map<string, number>();

  private ensure(key: string): void {
    if (!this.parent.has(key)) {
      this.parent.set(key, key);
      this.size.set(key, 1);
    }
  }

  find(key: string): string {
    this.ensure(key);
    let root = key;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let cur = key;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;
    const sizeA = this.size.get(rootA)!;
    const sizeB = this.size.get(rootB)!;
    const [big, small] = sizeA >= sizeB ? [rootA, rootB] : [rootB, rootA];
    this.parent.set(small, big);
    this.size.set(big, sizeA + sizeB);
  }
}
