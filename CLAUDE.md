# CLAUDE.md — VeilPay

## Project identity

Repository:

```text
github.com/OpenDagri/veilpay
```

Project name:

```text
VeilPay
```

Public positioning:

```text
VeilPay — Private Payroll on Starknet
```

Builder identity:

```text
OpenDagri
```

This repository is a standalone personal open-source project.

It is not an Omniflow repository.

It must remain technically, visually, operationally, and conceptually separate from Omniflow.

---

## Project

VeilPay is a standalone Starknet privacy hackathon project focused on private payroll using STRK20 privacy primitives.

The project is completely independent from Omniflow.

Do not:

- import Omniflow code
- copy Omniflow contracts
- reuse Omniflow branding
- reuse Omniflow frontend components unless explicitly approved
- reuse Omniflow package names
- reuse Omniflow infrastructure
- reuse Omniflow domains
- introduce LayerZero
- introduce OFTs
- introduce omnichain routing
- introduce cross-chain architecture
- present VeilPay as an Omniflow product
- reference internal Omniflow infrastructure or architecture unless explicitly requested

Treat this repository as a clean standalone codebase.

If functionality happens to resemble something already implemented elsewhere, implement it appropriately for VeilPay rather than creating a dependency on Omniflow.

---

# Primary objective

Build and ship a working private payroll MVP using Starknet and STRK20 privacy primitives.

The project must optimize for:

1. working code
2. end-to-end demonstrability
3. correct use of STRK20
4. clear privacy properties
5. minimal architecture
6. readable open-source code
7. fast iteration
8. reliable mainnet execution
9. strong technical proof of work
10. a clean public repository

The project does not need to become a complete payroll company.

The immediate goal is to demonstrate one strong concept extremely well.

Do not expand scope unless the core MVP already works end-to-end.

---

# Product thesis

Payroll information should not automatically become globally public simply because payment happens on-chain.

The MVP should demonstrate:

```text
Employer
   ↓
Funds private balance
   ↓
Creates payroll
   ↓
Pays multiple recipients
   ↓
Recipients receive private funds
```

The public chain should not expose the recipient-to-salary mapping beyond what is inherently exposed by the underlying STRK20 protocol.

The product is:

```text
private payroll
```

It is not:

```text
a general payment protocol
a treasury suite
a bank
a cross-chain protocol
an accounting platform
an enterprise HR system
```

The privacy property is the product.

---

# Core demo

The target demo should be understandable almost instantly.

Employer:

```text
August Payroll

Recipients: 3
Total: 750 USDC

Alice      100
Bob        250
Charlie    400

[ Pay Privately ]
```

After execution:

```text
Payroll sent successfully.

3 private payments executed.
```

Recipient:

```text
Private payroll received

+100 USDC
```

Public observer:

```text
Cannot trivially reconstruct:

- individual salary amounts
- recipient-to-amount mapping
- employer → employee payment graph
```

The product should communicate this without requiring the viewer to understand ZK cryptography or STRK20 internals.

---

# MVP scope

## MUST HAVE

- Starknet wallet connection
- correct network detection
- STRK20 integration
- shield funds
- private payment to recipient
- multiple payroll recipients
- payroll creation
- payroll review
- payroll execution
- recipient-side private balance or payment visibility
- successful Starknet mainnet interaction
- clean public frontend
- reproducible local setup
- public GitHub repository
- README
- deployed demo
- reliable demo flow
- clear transaction feedback
- clear error states

---

## IF TIME

Only implement after the MUST HAVE flow works.

Possible additions:

- CSV payroll import
- batch UX improvements
- payroll execution progress
- payroll history
- saved payroll drafts
- recipient labels
- improved recipient dashboard
- richer error reporting
- transaction explorer links
- better responsive design
- improved visual polish
- demo mode
- reusable payroll templates

---

## DO NOT TOUCH initially

Do not implement unless explicitly requested:

- vesting engine
- salary streaming
- private vesting
- termination workflows
- tax reporting
- tax proofs
- auditor access
- viewing keys
- accounting integrations
- fiat rails
- bank integrations
- multi-chain support
- LayerZero
- OFTs
- bridges
- cross-chain messaging
- custom privacy cryptography
- custom zero-knowledge circuits
- employee identity systems
- enterprise RBAC
- DAO governance
- treasury management suite
- paymasters
- gas abstraction
- session-key infrastructure
- compliance suite
- payroll SaaS subscriptions
- organization management
- multi-company tenancy

Do not implement speculative features simply because they appear in a roadmap or upstream Request for Startups.

Ship the core interaction first.

---

# Technical principles

## Prefer official primitives

Use official and current Starknet / STRK20 tooling wherever possible.

Do not reimplement cryptographic primitives.

Do not create custom privacy mechanisms when an official primitive already exists.

Before implementing functionality related to:

- STRK20
- Privacy SDK
- Privacy Wallet API
- Starknet wallet interaction
- Cairo
- account abstraction
- Starknet transactions
- mainnet deployment

inspect the current official documentation or upstream source code first.

Do not guess APIs.

Do not assume documentation examples are still valid without checking package versions.

If an integration fails repeatedly, stop modifying code blindly and inspect:

1. installed package version
2. upstream types
3. upstream source
4. official documentation
5. current examples

---

# No blind debugging

When the same issue survives two reasonable fixes:

STOP.

Do not make a third speculative modification.

Instead:

1. capture the exact error
2. identify the failing layer
3. inspect installed dependency versions
4. inspect current upstream documentation
5. inspect upstream source if documentation is ambiguous
6. compare expected API with actual implementation
7. form one concrete hypothesis
8. make one minimal change
9. retest

Never enter a loop of random modifications.

---

# Architecture

Keep architecture minimal.

Expected structure:

```text
veilpay/
│
├── app/
├── components/
├── lib/
│   ├── starknet/
│   ├── strk20/
│   └── payroll/
│
├── contracts/
│
├── public/
│
├── tests/
│
├── README.md
├── CLAUDE.md
└── .env.example
```

The exact structure may evolve when justified by actual implementation needs.

Do not create abstractions merely to make the directory tree look sophisticated.

---

# Cairo contract

A custom Cairo contract is optional.

Do not introduce a Cairo contract unless it solves a real application requirement.

Client-side orchestration is acceptable where appropriate.

If a PayrollRegistry contract is useful, keep it extremely small.

Possible public state:

- payroll cycle identifier
- employer address
- token identifier
- recipient count
- execution status
- creation timestamp
- execution timestamp

Never store confidential salary information publicly.

Never store:

```text
recipient → salary
employee identity → wallet
private note contents
private balances
secret metadata
```

in normal public Starknet storage.

Never accidentally destroy the privacy proposition through application-level metadata.

---

# Privacy review

Before implementing any payroll-related state, ask:

```text
Does publishing this value weaken payroll privacy?
```

If yes, do not put it on-chain publicly unless absolutely necessary.

Privacy must be evaluated at the complete application level, not only at the STRK20 transaction layer.

Possible privacy leaks include:

- public mappings
- predictable identifiers
- emitted events
- frontend URLs
- query parameters
- analytics
- logs
- browser storage
- public API responses
- timestamps
- recipient labels
- transaction grouping

Do not claim stronger privacy guarantees than the actual implementation provides.

---

# Snapshot rule

## CRITICAL RULE

Before every significant modification, create a recoverable snapshot.

This rule is mandatory.

A significant modification includes:

- dependency installation
- dependency upgrades
- dependency removal
- package manager changes
- architecture changes
- wallet integration changes
- STRK20 integration changes
- Cairo contract changes
- transaction-building changes
- deployment configuration changes
- environment changes
- refactors affecting multiple files
- replacement of a working implementation
- removal of working functionality
- major frontend restructuring
- routing changes
- state-management changes
- build-system changes
- configuration migrations
- changes after reaching a known-good state

Default snapshot method:

```bash
git status
git add -A
git commit -m "snapshot: <short description>"
```

Examples:

```bash
git commit -m "snapshot: starter kit running locally"
git commit -m "snapshot: wallet connection working"
git commit -m "snapshot: first STRK20 read working"
git commit -m "snapshot: first successful shield transaction"
git commit -m "snapshot: single recipient private payment working"
git commit -m "snapshot: multi recipient payroll working"
git commit -m "snapshot: mainnet demo path working"
```

The purpose is rollback, not aesthetics.

Never destroy a known-good state before preserving it.

---

# Before risky changes

Before a risky modification, report:

```text
Current state:
What currently works.

Change:
What is about to be modified.

Snapshot:
Commit/hash or known rollback point.

Expected result:
What should improve.

Risk:
What could regress.
```

Then make the smallest coherent change.

---

# Git discipline

Use small logical commits.

Preferred prefixes:

```text
snapshot:
feat:
fix:
refactor:
test:
docs:
chore:
```

Examples:

```text
snapshot: working wallet connection
feat: add STRK20 shield flow
feat: add payroll recipient model
feat: execute private recipient payment
fix: handle rejected Starknet transaction
test: add payroll amount validation
docs: document mainnet deployment
refactor: extract STRK20 transaction helpers
```

Do not combine unrelated changes into one commit.

Avoid giant commits.

Do not force-push unless explicitly requested.

Do not rewrite Git history unless explicitly requested.

Do not delete branches without explicit approval.

Do not delete tags without explicit approval.

Do not amend or squash known rollback commits if that removes useful recovery points.

---

# Repository identity

The canonical repository is:

```text
OpenDagri/veilpay
```

Do not move the project into an Omniflow repository.

Do not convert it into an Omniflow monorepo package.

Do not rename packages to:

```text
@omniflow/*
```

Prefer project-local names such as:

```text
@veilpay/*
```

only if package names are actually useful.

Do not create unnecessary packages solely for namespacing.

---

# Public identity

This repository is intended to be publicly attributable to OpenDagri.

Do not anonymize attribution.

Do not present the project as being authored by an anonymous collective.

Recommended README attribution:

```text
Built by OpenDagri.
```

A real-world display name can also be used where appropriate.

Do not artificially insert personal branding throughout the product UI.

The repository and GitHub identity are enough.

The application should primarily look like VeilPay.

---

# Branding

Project name:

```text
VeilPay
```

Descriptor:

```text
Private Payroll on Starknet
```

Preferred tone:

- minimal
- credible
- technical
- privacy-first
- not hype-driven

Avoid:

- excessive crypto jargon
- fake enterprise claims
- fake customer claims
- inflated security claims
- “military-grade privacy”
- “untraceable”
- “anonymous payments”
- unsupported compliance claims
- unsupported scalability claims

Never claim privacy properties that have not been technically demonstrated.

---

# Secrets

Never commit:

- private keys
- seed phrases
- mnemonics
- wallet recovery data
- API secrets
- production credentials
- temporary development keys
- sensitive RPC credentials

Use:

```text
.env.local
```

or equivalent ignored files.

Provide:

```text
.env.example
```

containing only variable names and safe placeholders.

Before every public push:

```bash
git status
git diff --cached
```

Inspect what is actually being committed.

When relevant, search for accidental secrets before pushing.

Never print secret values into logs.

---

# Mainnet safety

Mainnet interactions involve real assets.

Before introducing or modifying a mainnet transaction flow verify:

1. chain ID
2. network
3. target contract
4. token address
5. token decimals
6. amount
7. recipient
8. calldata
9. transaction selector
10. fee estimate when available
11. wallet account
12. application environment

Never assume an address from memory.

Contract addresses must originate from:

- verified project configuration
- official documentation
- verified upstream deployments

Do not copy addresses from random examples without verification.

For first mainnet interactions, use the smallest practical economic value.

Never send a transaction if destination, calldata, network, or amount is uncertain.

---

# Transaction debugging

For every transaction failure capture when possible:

- transaction type
- sender
- network
- contract
- selector
- relevant arguments
- wallet error
- RPC error
- transaction hash if created
- explorer result
- revert reason

Do not reduce an error to:

```text
transaction failed
```

if more information is available.

Preserve useful debug information while never leaking secrets.

---

# Development sequence

Follow this sequence unless there is a strong technical reason not to.

## Phase 1 — bootstrap

1. initialize `OpenDagri/veilpay`
2. clone/use appropriate official starter implementation where useful
3. create `.gitignore`
4. create `.env.example`
5. verify local build
6. verify dev server
7. snapshot

Target:

```text
application runs locally
```

---

## Phase 2 — wallet

1. connect Starknet wallet
2. expose connected address
3. detect network
4. handle disconnect
5. handle rejected connection
6. test
7. snapshot

Target:

```text
wallet connection is stable
```

---

## Phase 3 — STRK20 read path

1. configure official addresses
2. configure SDK
3. read relevant private/public state
4. verify against current documentation
5. test
6. snapshot

Target:

```text
application can communicate correctly with STRK20
```

---

## Phase 4 — first transaction

Execute the smallest possible valid STRK20 transaction.

Do not build payroll before this works.

Verify on-chain.

Record:

- network
- transaction hash
- contract
- action performed
- result

Snapshot immediately after success.

Target:

```text
first successful STRK20 transaction
```

This is the first major technical GO / NO-GO checkpoint.

---

## Phase 5 — single private payment

Build the smallest private payment flow:

```text
employer → one recipient
```

Verify:

- correct amount
- correct recipient
- private balance change
- error states
- on-chain execution

Snapshot.

Target:

```text
one private payroll payment works end-to-end
```

---

## Phase 6 — payroll

Extend to:

```text
employer
→ multiple recipients
→ review
→ execute
→ result
```

Do not prematurely optimize batching if repeated private operations are sufficient for the MVP.

Correctness before elegance.

Snapshot once working.

---

## Phase 7 — recipient experience

Recipient should be able to:

1. connect wallet
2. access relevant private state
3. recognize received payroll
4. understand available balance

Do not leak employer payroll metadata just to make the UI easier.

Snapshot.

---

## Phase 8 — mainnet demo

Create a reliable mainnet demo path.

Use low-value transactions.

Verify every transaction externally.

Record transaction hashes needed for submission evidence.

Snapshot:

```text
snapshot: verified mainnet demo
```

From this point onward, do not perform broad refactors.

---

## Phase 9 — polish

Only now improve:

- visual design
- README
- onboarding copy
- error messages
- responsive behavior
- demo reliability
- code organization
- documentation

No architecture rewrites.

---

# Demo freeze

Once the complete mainnet demo works:

```text
FREEZE THE CORE TRANSACTION PATH.
```

No major refactoring after demo freeze without explicit justification and a snapshot.

After freeze, prioritize:

- bug fixes
- documentation
- UX
- tests
- demo reliability

Do not turn working hackathon code into an architecture project.

---

# Frontend UX

Primary employer flow:

```text
1. Connect wallet
2. Fund private payroll balance
3. Add recipients
4. Enter amounts
5. Review payroll
6. Execute privately
7. See result
```

Primary recipient flow:

```text
1. Connect wallet
2. Access private state
3. See received payroll
```

Protocol terminology should not dominate the main interface.

Prefer:

```text
Fund private balance
Pay privately
Private balance
Payroll recipients
```

over unnecessary internal protocol terminology.

STRK20-specific details may appear in:

- advanced information
- transaction details
- developer documentation
- README
- debug interface

---

# Components

Prefer small components with clear responsibilities.

Avoid creating another giant frontend file.

Examples:

```text
WalletButton
NetworkGuard
PrivateBalance
PayrollEditor
RecipientRow
PayrollSummary
PayrollExecution
TransactionStatus
RecipientDashboard
```

Do not fragment trivial markup into dozens of useless components.

Split where responsibility becomes meaningful.

---

# State

Keep state management simple.

Prefer local/component state or lightweight application state unless complexity genuinely requires more.

Do not introduce Redux, complex event buses, or elaborate state machines without a concrete need.

Money-moving states should be explicit.

Example:

```text
idle
reviewing
awaiting_wallet
submitted
confirming
success
failed
```

Prevent duplicate transaction execution caused by double-clicks or stale state.

---

# Amount handling

Never use floating-point JavaScript arithmetic for token base-unit calculations.

Use integer-safe representations.

Always respect actual token decimals.

Validate:

- empty amount
- zero
- negative values
- malformed input
- amount above available balance
- decimal precision
- excessively large values

Do not silently round salary values.

---

# Address handling

Validate Starknet addresses appropriately.

Never silently modify a recipient address.

For every payment review, display enough of the recipient address to detect mistakes.

Do not resolve arbitrary identities to addresses unless explicitly implemented.

---

# Error handling

Errors should be actionable.

Bad:

```text
Something went wrong.
```

Better:

```text
Wallet rejected the transaction.
```

or:

```text
Insufficient private balance for this payroll.
```

Preserve detailed technical errors in developer/debug context where useful.

Do not expose secrets or sensitive internal data.

---

# Testing

Prioritize tests around value movement and state transitions.

At minimum verify:

- wallet connection
- wrong network
- wallet rejection
- invalid recipient
- invalid salary
- zero salary
- excessive salary
- insufficient balance
- STRK20 call construction
- failed transaction
- successful transaction
- payroll total calculation
- payroll state transitions
- duplicate submission prevention

For Cairo contracts, test every state-changing function.

Do not spend disproportionate hackathon time building an oversized testing framework.

---

# Code quality

Prefer:

- TypeScript
- strict useful types
- small modules
- explicit names
- predictable state flows
- centralized protocol configuration
- centralized contract addresses
- readable transaction builders
- meaningful errors

Avoid:

- giant components
- giant utility files
- magic addresses
- magic numbers
- duplicated constants
- deep inheritance
- premature factories
- speculative extensibility
- unnecessary dependencies
- swallowed errors
- broad `any`
- undocumented protocol workarounds

If a file becomes difficult to reason about, split it by responsibility.

Do not refactor merely because a file passes an arbitrary line-count threshold.

---

# Dependency discipline

Before adding a dependency ask:

```text
Do we actually need this?
```

Prefer existing installed dependencies when suitable.

Do not install a library for trivial functionality.

Before dependency upgrades:

1. inspect current version
2. understand why upgrade is needed
3. snapshot
4. upgrade only necessary packages
5. run tests
6. run build
7. verify core flows

Never perform a broad dependency update casually.

---

# Build discipline

After meaningful changes run relevant checks.

At minimum as appropriate:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Use the actual project package manager and scripts.

Do not invent commands if the repository defines different ones.

A change is not considered validated merely because the edited file looks syntactically correct.

---

# Documentation

README should eventually answer:

1. What is VeilPay?
2. What problem does it demonstrate?
3. Why does payroll benefit from privacy?
4. How does STRK20 fit?
5. What is public?
6. What remains private?
7. How does the architecture work?
8. How do I run it?
9. Where is the deployed demo?
10. Which Starknet contracts are used?
11. Which mainnet transactions demonstrate it?
12. What are the current limitations?
13. Who built it?

Do not oversell.

Clearly document known limitations.

---

# Hackathon evidence

Preserve evidence as the project evolves.

Maintain a simple record containing:

```text
transaction hash
date
network
purpose
result
```

for relevant mainnet transactions.

Do not rely on browser history to recover important submission evidence at the end.

Consider maintaining:

```text
docs/mainnet-transactions.md
```

once mainnet activity begins.

---

# External research

For protocol-specific behavior use primary sources whenever possible.

Priority:

1. official STRK20 repository
2. official STRK20 documentation
3. official Starknet documentation
4. official StarkWare material
5. upstream package source
6. canonical examples

Secondary sources can help explain concepts but must not override primary documentation.

Record important upstream facts in project documentation when they affect implementation:

- package versions
- contract addresses
- supported networks
- API assumptions
- protocol limitations

---

# Agent behavior

Before modifying the project:

1. inspect Git status
2. inspect relevant files
3. understand current implementation
4. identify current known-good state
5. decide whether a snapshot is required
6. create snapshot when required
7. state the intended change briefly
8. make the smallest coherent modification
9. run relevant checks
10. report exactly what changed
11. report exactly what was tested
12. identify anything still unverified

Never claim success solely from static inspection when runtime verification is possible.

Never silently expand scope.

Never introduce unrelated cleanup during a targeted bug fix.

Never replace working code merely because another architecture looks cleaner.

Never perform destructive changes without a rollback point.

---

# No autonomous scope creep

Do not decide independently to add:

- new protocols
- additional chains
- databases
- backend services
- indexers
- authentication systems
- analytics
- account systems
- organizations
- enterprise features
- unrelated smart contracts

If a new subsystem appears necessary, first explain:

```text
Problem:
Why current architecture cannot solve it.

Proposed addition:
What subsystem would be introduced.

Cost:
Complexity and implementation implications.

Alternative:
Simpler option if available.
```

Then wait for explicit approval before introducing major new architecture.

---

# Refactor policy

Refactoring is allowed when it directly improves delivery reliability.

Good reasons:

- code duplication causes bugs
- one component has become difficult to safely modify
- protocol logic is mixed into UI code
- testing requires isolation
- transaction state is unreliable

Bad reasons:

- a different architecture is fashionable
- generic extensibility might someday be useful
- theoretical scalability
- aesthetics alone
- desire to rewrite starter-kit code

Never perform a large refactor immediately before the deadline unless the current implementation cannot ship.

---

# Deadline behavior

As the deadline approaches, priority changes.

Early:

```text
technical risk reduction
```

Middle:

```text
complete end-to-end product
```

Late:

```text
stability
demo
docs
submission
```

Near deadline:

NO broad refactors.

NO unnecessary dependencies.

NO speculative features.

NO protocol experimentation unless required to repair the core flow.

---

# Decision hierarchy

When choosing between:

```text
polished feature
vs
working mainnet flow
```

choose:

```text
working mainnet flow
```

When choosing between:

```text
general architecture
vs
simple working implementation
```

choose:

```text
simple working implementation
```

When choosing between:

```text
another feature
vs
testing the existing flow
```

prefer testing as the deadline approaches.

When choosing between:

```text
cleaner rewrite
vs
known working implementation
```

keep the known working implementation unless there is a concrete defect.

---

# Core invariant

At every point in development, preserve the most advanced known-good working state.

Never trade a functioning milestone for speculative improvement without first creating a rollback point.

---

# Current priority

Until the first successful STRK20 transaction is confirmed, the absolute priority is:

```text
STRK20 integration
        ↓
smallest working transaction
        ↓
verified on-chain result
```

Everything else is secondary.

After that:

```text
single private payment
        ↓
multi-recipient payroll
        ↓
recipient experience
        ↓
mainnet demo
        ↓
polish
```

---

# Definition of done

VeilPay is hackathon-ready when:

- repository is public under `OpenDagri/veilpay`
- frontend is publicly accessible
- wallet flow works
- private funding flow works
- multiple recipients can be configured
- private payroll can be executed
- recipient experience works
- required mainnet activity has been completed and documented
- demo flow is reliable
- README is complete
- project limitations are documented
- no secrets exist in repository history
- build passes
- critical flows have been tested
- working state has a final snapshot

Final snapshot:

```bash
git add -A
git commit -m "snapshot: hackathon submission build"
```

Tag only when explicitly appropriate, for example:

```bash
git tag hackathon-submission
```

Do not rewrite this final known-good state afterward without creating another recoverable checkpoint.