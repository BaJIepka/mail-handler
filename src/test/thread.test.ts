import test from "node:test";
import assert from "node:assert/strict";
import { computeThreadKeys, resolveParentId, type MessageLinks } from "../thread/compute.js";

test("два независимых разговора склеиваются письмом, ссылающимся на оба", () => {
  const a: MessageLinks = { external_id: "A", in_reply_to: null, refs: [] };
  const b: MessageLinks = { external_id: "B", in_reply_to: "A", refs: ["A"] };
  const c: MessageLinks = { external_id: "C", in_reply_to: "D", refs: ["D"] };
  const d: MessageLinks = { external_id: "D", in_reply_to: null, refs: [] };

  const beforeE = computeThreadKeys([a, b, c, d]);
  assert.equal(beforeE.get("A"), beforeE.get("B"));
  assert.equal(beforeE.get("C"), beforeE.get("D"));
  assert.notEqual(beforeE.get("A"), beforeE.get("C"));

  const e: MessageLinks = { external_id: "E", in_reply_to: null, refs: ["B", "D"] };
  const afterE = computeThreadKeys([a, b, c, d, e]);
  const key = afterE.get("A");
  for (const id of ["A", "B", "C", "D", "E"]) {
    assert.equal(afterE.get(id), key, `${id} должен оказаться в общем разговоре`);
  }
});

test("ссылки на письма, которых нет в ленте, не создают отдельных писем", () => {
  const a: MessageLinks = { external_id: "A", in_reply_to: null, refs: ["ghost-1", "ghost-2"] };
  const keys = computeThreadKeys([a]);
  assert.equal(keys.size, 1);
  assert.equal(keys.get("A"), "A");
});

test("resolveParentId: берёт последний references, когда in_reply_to отсутствует", () => {
  const known = new Set(["X", "Y"]);
  const msg: MessageLinks = { external_id: "M", in_reply_to: null, refs: ["X", "Y"] };
  assert.equal(resolveParentId(msg, known), "Y");
});

test("resolveParentId: пропускает несуществующий in_reply_to и берёт references с конца", () => {
  const known = new Set(["B"]);
  const msg: MessageLinks = { external_id: "M", in_reply_to: "Z", refs: ["A", "B"] };
  assert.equal(resolveParentId(msg, known), "B");
});

test("resolveParentId: пустое значение, если ни одна ссылка не ведёт на известное письмо", () => {
  const known = new Set<string>();
  const msg: MessageLinks = { external_id: "M", in_reply_to: "Z", refs: ["A", "B"] };
  assert.equal(resolveParentId(msg, known), null);
});

test("resolveParentId: письмо не может быть родителем самому себе", () => {
  const known = new Set(["M"]);
  const msg: MessageLinks = { external_id: "M", in_reply_to: "M", refs: [] };
  assert.equal(resolveParentId(msg, known), null);
});
