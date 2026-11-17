# Research: Search Option

Decisions, alternatives and reversals for this feature. D1 is the owner's standing rule for this SDK (the service is the final judge, the client checks only what the contract states exactly); D2 to D8 are defaults of the plan, open to the owner's objection.

## D1. The client checks only what the contract states exactly

**Decision**: the SDK checks that `q` is text and at most 100 characters after trimming (counted as characters). It does not check that the text holds a word.

**Why**: content-api `search-v1` states the length and "at least one word" rules. The word rule is defined by the service's own splitting (letters, marks, digits; every symbol separates), which the SDK would have to copy and keep in step. Spec 001 D7 set the rule: client checks are only those that save a round trip or avoid a silent bug; the service is the final judge.

**Alternatives**: copy the word rule into the SDK (saves a round trip for a rare input, but two copies of a rule that can drift); check nothing (a number or a 10 000-character text would cost a round trip and the service's `422`). Rejected.

## D2. The field is `q`

**Decision**: `Query.q?: string`.

**Why**: it is the service's parameter name and what a developer expects for a search. The other fields are plural words (`tags`, `languages`) because they are lists; `q` is one text.

**Alternatives**: `search` (clearer for a reader, but a second name for the same parameter), `text`. Rejected.

## D3. Empty or spaces-only text means no search (owner may reverse)

**Decision**: `q` of `""` or only spaces is treated as not given and no `q` is sent.

**Why**: this SDK already treats an empty cursor and an empty `tags` or `languages` list as absent. A visitor with an empty search box means "show everything", and a platform would otherwise have to write `if (text) query.q = text` on every call.

**Alternatives**: send it and let the service answer `422` (mirrors the service; a platform gets an error for an empty box). Easy to reverse if the owner prefers it.

## D4. Send the text as given, not trimmed

**Decision**: when `q` has anything besides spaces, the request carries it unchanged, including spaces at its ends.

**Why**: the service trims; changing the text in the SDK is a second place that touches it. Only the emptiness check and the length check look at the trimmed text.

## D5. Length is counted in characters

**Decision**: the length is the number of characters (code points) of the trimmed text, not UTF-16 units or bytes: `[...text.trim()].length`.

**Why**: the contract says characters; the service counts them the same way. Amharic and emoji must not hit the limit early.

## D6. Encoding by `URLSearchParams`

**Decision**: `q` is set with `URLSearchParams`, as every other parameter is, so `&`, `=`, `#`, `+`, `%`, quotes and newlines are encoded and cannot add or change a parameter. A lone surrogate is encoded as the replacement character by the platform and does not throw.

**Why**: it is already the SDK's method and needs no new code. A space is sent as `+`, which the service decodes as a space (checked against the hosted service in the optional live test).

## D7. The loader needs no code

**Decision**: the loader's `fetchPage` passes the query it receives to the delivery client unchanged (`src/loader/commands.ts`), so `q` works for queued and direct calls with no loader change. Tests prove it.

**Why**: the least change; a change here would be a second place for the rule.

## D8. Version 0.3.0; the tag is the owner's

**Decision**: `package.json` and `package-lock.json` go to 0.3.0 (additive change); the git tag `v0.3.0` and the change of content-api's pinned tag are later steps for the owner.

**Why**: content-api pins the SDK by tag (spec 011); nothing reaches platforms until content-api takes the new tag and deploys.

## D9. A throwing getter on the query is out of scope

**Decision**: this feature does not guard against a query object whose properties throw when read (a getter), for `q` or for any other field. `fetchPage` builds the address outside a try/catch, as it has since 001, and the no-throw tests have never covered a throwing getter.

**Why**: found in the analysis of this feature (a task assumed a guard that does not exist). It is a hostile or broken query object, not a bad value, and it applies equally to `limit`, `tags`, `languages` and `cursor`; adding a guard for one field would be inconsistent and widening it is a separate change.

**Alternatives**: wrap the builder call in `fetchPage` so every field is covered (a small change, and it would make "never throws" true for hostile objects too). The owner can ask for it as its own feature.

## Approaches started and reversed

None: no design approach was started and then reversed during the build. D1 to D9 still match what was built. One slip, found by the first build: a new local variable in `src/request.ts` took the name `search`, which the function already used further down; it was renamed `words`.
