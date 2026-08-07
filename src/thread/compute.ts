import { UnionFind } from "./unionFind.js";

export interface MessageLinks {
  external_id: string;
  in_reply_to: string | null;
  refs: string[];
}

/**
 * Разговор — компонента связности по ссылкам (in_reply_to и references,
 * направление не важно). Ссылки на письма, которых нет в ленте, участвуют
 * в объединении как "виртуальные" узлы — это не влияет на корректность,
 * реальным письмам, которые они связывают, всё равно достанется общий ключ.
 */
export function computeThreadKeys(messages: MessageLinks[]): Map<string, string> {
  const uf = new UnionFind();
  for (const m of messages) {
    uf.find(m.external_id);
    if (m.in_reply_to) uf.union(m.external_id, m.in_reply_to);
    for (const ref of m.refs) uf.union(m.external_id, ref);
  }

  const groups = new Map<string, string[]>();
  for (const m of messages) {
    const root = uf.find(m.external_id);
    let group = groups.get(root);
    if (!group) groups.set(root, (group = []));
    group.push(m.external_id);
  }

  const threadKeyByRoot = new Map<string, string>();
  for (const [root, ids] of groups) {
    threadKeyByRoot.set(root, ids.reduce((a, b) => (a < b ? a : b)));
  }

  const threadKeyById = new Map<string, string>();
  for (const m of messages) {
    threadKeyById.set(m.external_id, threadKeyByRoot.get(uf.find(m.external_id))!);
  }
  return threadKeyById;
}

/**
 * parent_id по правилу задания: ссылки — сначала references (в порядке
 * следования), затем in_reply_to; идём с конца к началу, берём первую,
 * что реально есть в ленте. Письмо, на которое отвечали, может отсутствовать
 * в выгрузке — тогда parent_id указывает на ближайшего сохранившегося предка.
 */
export function resolveParentId(message: MessageLinks, knownIds: ReadonlySet<string>): string | null {
  const links = [...message.refs, ...(message.in_reply_to ? [message.in_reply_to] : [])];
  for (let i = links.length - 1; i >= 0; i--) {
    const candidate = links[i];
    if (candidate !== message.external_id && knownIds.has(candidate)) return candidate;
  }
  return null;
}
