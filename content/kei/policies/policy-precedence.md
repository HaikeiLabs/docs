---
title: Policy priority and precedence
type: reference
product: kei
nav_group: Make and maintain
nav_order: 14
---

# Policy priority and precedence

This page has moved. See **[How Kei decides](/kei/reference/how-kei-decides)** for the current reference on policy precedence, including the priority-based model, matching rules, worked examples, and a note on the planned deny-wins model.

## Summary of key points

- Kei uses a priority-based evaluation model: higher-priority policies win.
- At the same priority, deny wins over allow.
- If no enabled policy matches, desktop harnesses use their native mode (usually ask); SDK and connector calls fail closed.
- See [How Kei decides](/kei/reference/how-kei-decides) for the full reference.

![Expanded policy details showing an autogroup member deny covering an engineering grant](/assets/images/policy-docs/policy-detail-deny-overrides.png)

*The member deny covers an overlapping engineering grant.*
