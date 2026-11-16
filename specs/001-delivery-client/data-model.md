# Data Model: Delivery Client

All types are plain data. Field names in results are camelCase for the platform's code; item fields keep the service's names because they are the contract (a platform reads them straight from the delivery documentation).

## Inputs

### Target

| Field | Type | Rule |
|---|---|---|
| `baseUrl` | string | Absolute `http` or `https` address of content-api; trailing slash optional; a path prefix is kept |
| `platformId` | string | Non-empty; encoded into the path |
| `placementId` | string | Non-empty; encoded into the path |

### Query (all optional)

| Field | Type | Rule | Sent as |
|---|---|---|---|
| `limit` | number | Whole number 1 to 50 | `limit` |
| `tags` | string[] | 1 to 50 values, each 1 to 64 of `a-z 0-9 _ : -`; empty array = not sent | `tag`, comma-joined |
| `languages` | string[] | 1 to 50 values, each 1 to 16 characters, no comma; empty array = not sent | `language`, comma-joined |
| `cursor` | string | 1 to 512 characters; a `nextCursor` from an earlier page of the same placement and filters; empty = not sent | `cursor` |

### Options (all optional)

| Field | Type | Meaning |
|---|---|---|
| `fetch` | `typeof fetch` | The function that performs the request; default is the environment's `fetch` |
| `signal` | `AbortSignal` | Cancels the request |

## Output

### Result

```text
Result = { ok: true,  page: Page }
       | { ok: false, error: DeliveryError }
```

### Page

| Field | Type | Notes |
|---|---|---|
| `items` | Item[] | In the order the service sent; may be empty |
| `nextCursor` | string \| null | From `next_cursor`; null means no more pages |

### Item (the nine fields, names as the service sends them)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `platform` | string | Owning platform |
| `title` | string | Untrusted text |
| `description` | string | Untrusted text |
| `language` | string | |
| `tags` | string[] | May be empty |
| `images` | Image[] | May be empty |
| `created_at` | string | Text as received |
| `url` | string \| null | The poster's own link out; `http` or `https` form, or null |

### Image

| Field | Type | Notes |
|---|---|---|
| `url` | string | `http` or `https` address, built by the service from the owning platform's image base |

### DeliveryError

| Field | Type | Notes |
|---|---|---|
| `kind` | `"unknown_placement"` \| `"origin_not_allowed"` \| `"bad_query"` \| `"unavailable"` \| `"network"` \| `"contract_mismatch"` \| `"invalid_target"` | What to branch on |
| `message` | string | Short text written by the SDK, never taken from the service |
| `status` | number \| undefined | HTTP status when there was an answer |
| `fields` | string[] \| undefined | Parameter names for `bad_query` (from the service's `details.fields[].field`; the SDK's own checks use `limit`, `tag`, `language`, `cursor`) and the problem field for `invalid_target` (`target` when it is not an object, else `baseUrl`, `platformId` or `placementId`; the ids `.` and `..` are refused because a URL parser folds them into the path) |
| `aborted` | true \| undefined | Set on a `network` error when the caller's signal cancelled the request |
| `serviceMessage` | string \| undefined | The service's error message as plain text, for debugging only; cut to 500 characters |
| `cause` | unknown | The original exception, if any |

## Mapping from answer to kind

| Situation | `kind` | `status` |
|---|---|---|
| 200, body passes validation | success | |
| 200, body not JSON or fails validation | `contract_mismatch` | 200 |
| 404 | `unknown_placement` | 404 |
| 403 | `origin_not_allowed` | 403 |
| 422 | `bad_query` | 422 |
| any other status (500, 503, 3xx, 400 …) | `unavailable` | the status |
| `fetch` rejects or the body cannot be read | `network` (`aborted: true` if the signal fired) | none |
| target or query refused before sending | `invalid_target` or `bad_query` | none |

A browser hides a 403 body and may surface it as a rejected `fetch`; the result is then `network`, as the spec's edge case allows.

## State

None. Each call is independent; nothing is stored between calls.
