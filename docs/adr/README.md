# Architecture Decision Records

Each file here records **one** architectural decision: what was chosen, why,
and what was turned down along the way.

## Contents

- [Why bother](#why-bother)
- [Format](#format)
- [Lifecycle](#lifecycle)
- [When to write one](#when-to-write-one)
- [Index](#index)

## Why bother

Code shows *what* a system does. It almost never shows *why* it does it that
way. Six months on, "why is there a loopback server here instead of just a
custom URL scheme?" is an expensive question: without a record you either
reconstruct the reasoning from scratch or — more often — redo the decision and
walk into the same problems again.

The key point: **an ADR records the rejected options, not only the chosen
one.** The list of what was considered and why it was dropped is the most
valuable part of the document, because those are exactly the options someone
will propose again later.

## Format

One file, one decision. Name it `NNNN-short-title.md`, with sequential numbers
that are never reused.

| Section          | Contents                                                          |
| ---------------- | ----------------------------------------------------------------- |
| **Status**       | `Proposed` / `Accepted` / `Superseded by ADR-NNNN` / `Deprecated`  |
| **Context**      | The forces at play: requirements, constraints, risks.              |
| **Decision**     | What was chosen. Present tense, stated plainly.                    |
| **Consequences** | What got better, what got worse, what now has to be maintained.    |
| **Alternatives** | Every option considered, each with a concrete reason for rejection. |

## Lifecycle

An ADR is **immutable** once accepted. If a decision becomes obsolete, do not
edit the old file — write a new one and mark the old one
`Superseded by ADR-NNNN`. The history of decisions matters as much as the
current state: it shows how the constraints changed.

A new ADR starts as `Proposed`. A person accepts it, not the author of the
draft — so `Proposed` sitting in the repository is normal and means "written
up, waiting for your agreement".

## When to write one

Write one if the decision is hard to reverse, touches several modules, has
security or cost implications, or cost you more than an hour of choosing
between options. Do not write one for a variable name or a date library.

## Index

| №                                             | Decision                                | Status                          |
| --------------------------------------------- | --------------------------------------- | ------------------------------- |
| [0001](0001-zvs-id-desktop-authentication.md) | Connecting ZVS ID in the desktop client | Accepted, partly undone by 0004 |
| [0002](0002-desktop-update-distribution.md)   | Delivering desktop updates              | Proposed                        |
| [0003](0003-zvs-id-owns-the-login-ui.md)      | ZVS ID as Zitadel's login UI            | Accepted                        |
| [0004](0004-drop-the-zvsdesk-scheme.md)       | Dropping the `zvsdesk://` scheme        | Accepted                        |

The records themselves are written in Russian. They are deliberately left as
written: an ADR is a dated record of a decision, and rewriting one after the
fact defeats the purpose of keeping it.
