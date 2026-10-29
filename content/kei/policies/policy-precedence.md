---
title: Policy priority and precedence
type: reference
product: kei
nav_group: Make and maintain
nav_order: 14
---

# Policy priority and precedence

Kei decides with **deny-overrides**, and policies no longer have a priority. This page keeps its old address; the full reference is **[How Kei decides](/kei/reference/how-kei-decides)**.

## Summary

- When several enabled policies match a request, any matching deny wins, however many allows also match and whatever order the policies were created in.
- If no policy denies and at least one allow matches, the request is allowed.
- If no enabled policy matches, desktop harnesses use their native mode (usually ask); SDK and connector calls fail closed.
- To make an exception to a broad allow, add a narrower deny. There is no priority to set.

```mermaid
flowchart TD
  A["Request"] --> B{"Does any matching<br/>policy deny?"}
  B -->|"yes"| C["Deny"]
  B -->|"no"| D{"Does any matching<br/>policy allow?"}
  D -->|"yes"| E["Allow"]
  D -->|"no"| F["Nothing matched:<br/>fail closed, or the harness's own mode"]
  classDef deny stroke-width:3px
  classDef warn stroke:#b45309,stroke-width:2px
  class C deny
  class F warn
```

![Expanded policy details showing an autogroup member deny covering an engineering grant](/assets/images/policy-docs/policy-detail-deny-overrides.png)

*The member deny covers an overlapping engineering grant.*

See [How Kei decides](/kei/reference/how-kei-decides) for worked examples and the comparison with the earlier priority model.
