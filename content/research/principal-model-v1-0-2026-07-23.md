---
title: "The Principal Model v1.0 (July 2026)"
seo_title: "The Principal Model: User-Delegated ABAC for Agentic AI Systems, v1.0 (2026-07-23)"
description: "The original 2026-07-23 draft of the Principal Model white paper on user-delegated ABAC for AI agents. Historical; superseded."
type: reference
product: kei
---

> **Warning:** Historical version, superseded. This white paper describes an earlier Kei design and is kept for the record. It does not describe how Kei works today. For the current policy architecture, read [Where policy decisions happen—and where they are enforced](/research/policy-decision-and-enforcement).

| Version | Date | Source commit |
|---|---|---|
| 1.0, original draft | 2026-07-23 | `81fba36fa123647fce4d136d6ff36e5856cb1577` (Kei repository, `whitepaper.md`) |

Everything below the line is the paper exactly as it is at that commit, unedited. Links inside the paper are as written and may point to locations in the source repository. Every version is listed on the [Research](/research/) page.

---

<!-- verbatim:begin -->

# The Principal Model: User-Delegated Attribute-Based Access Control for Agentic AI Systems

**Enabling Sovereign Agent Governance Without Vendor Lock-in**

---

## Abstract

The proliferation of AI agents in enterprise environments has created a fundamental tension between automation capability and data governance. Current approaches to agentic AI—including commercial products like Microsoft Copilot and ChatGPT Enterprise—operate under a model where agents act with their own identity, accessing organizational data within vendor-controlled ecosystems. This architecture creates what we term "context lock-in": the accumulation of organizational memory, decision logic, and operational data within third-party systems that cannot be extracted, audited, or governed by the enterprise.

This paper presents the Principal Model, an architectural framework for user-delegated Attribute-Based Access Control (ABAC) in agentic AI systems. Under this model, AI agents operate not with their own identity, but with the delegated authority of a human principal (the user). All tool invocations are attributed to the principal, subject to ABAC policy evaluation, and subject to explicit user consent. We describe the implementation of this model in Kei, an open-core ABAC platform that enables enterprises to deploy sovereign agent infrastructure within their own Virtual Private Clouds (VPCs).

Our contributions include: (1) a formal system model defining the principal, agent, delegation, and policy concepts; (2) an architectural pattern that binds agent actions to human authorization boundaries; (3) a reference implementation demonstrating policy enforcement at every tool invocation; and (4) a security analysis comparing this approach to prior art in commercial agent platforms.

---

## 1. Introduction

### 1.1 Intended Audience

This paper is intended for platform engineers, security architects, chief technology officers (CTOs), and chief information security officers (CISOs) evaluating agentic AI infrastructure for enterprise deployment. Readers should have familiarity with access control models (RBAC, ABAC), OAuth 2.0 / OpenID Connect (OIDC) authentication flows, and general cybersecurity principles. No prior knowledge of the Kei platform is assumed.

### 1.2 Problem Statement

Enterprise AI agents require access to organizational data sources—including code repositories, project management systems, calendars, email, databases, and custom APIs—to perform useful work. Current approaches to providing this access suffer from three fundamental limitations:

1. **Context Lock-in**: Organizational workflows, decision logs, and operational memory accumulate within vendor-controlled systems. The cost of exit (migrating away from the platform) grows with usage, as the agent's contextual knowledge becomes irreplaceable.

2. **Identity Misattribution**: Agents operate with their own identity, not the identity of the user they represent. This creates ambiguity in audit trails: was this action performed by the user, or by the agent acting on the user's behalf? Existing platforms do not provide granular attribution.

3. **Absence of Policy Enforcement at Invocation**: While authentication (verifying who is using the agent) is standard, authorization (verifying whether the specific action is permitted) is typically absent or coarse-grained. Agents often have blanket access once authenticated.

These limitations are not merely technical—they have regulatory implications. Under GDPR, organizations are data controllers with specific obligations around data processing, cross-border transfers, and individual rights. Under the EU AI Act, high-risk AI systems require transparency, auditability, and human oversight. Under frameworks like NIST SP 800-207 (Zero Trust), sending inference requests to external APIs may violate the zero-trust perimeter.

### 1.3 Scope

This paper describes the Principal Model for user-delegated ABAC in agentic AI systems. We focus on:

- The architectural pattern: how agents obtain and exercise delegated authority
- The implementation: the Kei ABAC platform components
- The security properties: how this approach addresses the limitations above
- The limitations: where the current design falls short

We do not address the internal mechanics of large language models (LLMs), the design of agent workflows (e.g., ReAct, tool-use chains), or the specific implementation of downstream tools (GitHub integration, Jira integration, etc.).

### 1.4 Non-Goals

This paper does not claim to solve all security and governance challenges in agentic AI. Specifically, we do not address:

- **Model trust**: How to verify that an LLM produces trustworthy outputs
- **Prompt injection**: How to prevent malicious prompt manipulation
- **Tool safety**: How to ensure tools themselves are secure (this is the responsibility of tool implementers)
- **Data loss prevention**: How to classify and protect sensitive data within tool outputs

### 1.5 Terminology

| Term | Definition |
|------|------------|
| **Principal** | The human user who delegates authority to an AI agent |
| **Agent** | An autonomous or semi-autonomous AI system that executes actions on behalf of a principal |
| **Delegation** | The process by which a principal grants an agent authority to act on their behalf |
| **Tool** | A computational function (e.g., API call, database query) that an agent can invoke |
| **Context** | The accumulated state, memory, and conversational history that informs agent behavior |
| **Policy** | A declarative rule defining which principals may perform which actions on which resources |
| **ABAC** | Attribute-Based Access Control—an access control model where decisions are based on attributes of the subject, resource, action, and environment |
| **Sovereign Deployment** | A deployment model where the control plane runs within the organization's own infrastructure (VPC, on-premises) |

---

## 2. Background

### 2.1 Current Approaches

Enterprise AI agents today are predominantly offered as SaaS products. Microsoft Copilot, Google Workspace AI, and ChatGPT Enterprise provide agent capabilities bundled with their existing productivity ecosystems. These products share a common architectural pattern:

1. **Vendor as Identity Provider**: The agent authenticates as the enterprise tenant, not as individual users. User identity is mapped internally but not exposed as a first-class concept in authorization decisions.

2. **Data Remains in Vendor Ecosystem**: All context—conversations, document summaries, decision logs—remains within the vendor's infrastructure. Organizations cannot export their operational memory in a portable format.

3. **Coarse Authorization**: Access control is typically limited to tenant-level permissions (e.g., "all users in this tenant can use Copilot"). Granular, per-resource policies are not supported.

4. **No Sovereign Deployment Option**: Organizations cannot deploy these agents within their own VPCs. They must send data to vendor-controlled inference endpoints.

This approach is sufficient for organizations willing to accept vendor lock-in in exchange for ease of deployment. However, for organizations with stringent data sovereignty requirements, regulatory obligations, or strategic concerns about context lock-in, it is inadequate.

### 2.2 Architectural Limitations of Prior Art

The dominant commercial offerings in agentic AI suffer from architectural limitations that the Principal Model is designed to address:

| Limitation | Description | Impact |
|------------|-------------|--------|
| **No principal attribution** | Actions are attributed to the agent, not the user | Audit trails cannot answer "who really did this?" |
| **Blanket tool access** | Once authenticated, agents have access to all permitted tools | No fine-grained per-action policy enforcement |
| **SaaS-only deployment** | No self-hosted option | Violates data sovereignty requirements |
| **Opaque context storage** | Context stored in vendor databases, not portable | Cost of exit increases with usage |
| **No consent model** | User cannot explicitly authorize specific resources | No mechanism for informed delegation |

### 2.3 Related Research and Standards

The Principal Model draws on established standards and research in access control, identity management, and zero-trust architecture:

**NIST SP 800-207 (Zero Trust Architecture)**: This National Institute of Standards and Technology publication defines zero-trust as a paradigm that "assumes there is no traditional perimeter" and requires continuous verification of identity and authorization. The Principal Model aligns with zero-trust principles by enforcing policy evaluation at every tool invocation, not just at authentication.

**NIST ABAC Project**: The Attribute-Based Access Control project at NIST has produced standards (SP 800-162, SP 800-178) defining ABAC as an access control model where "subjects are assigned attributes" and "access decisions are based on attributes of the subject, object, action, and environment." Kei implements ABAC with Tailscale-style ACL syntax, a pattern that has proven effective in modern identity systems.

**OAuth 2.0 (RFC 6749)**: The OAuth 2.0 authorization framework provides the foundation for delegation in web applications. The Principal Model can be viewed as applying OAuth's delegation concept to agentic AI, but with ABAC policy enforcement at every invocation.

**Model Context Protocol (MCP)**: Anthropic's Model Context Protocol provides a standardized mechanism for AI models to connect to tools. However, MCP does not specify authorization semantics—it defines how tools are connected, not whether access should be granted. The Principal Model provides a governance layer on top of MCP.

---

## 3. System Model

This section defines the formal concepts underlying the Principal Model.

### 3.1 Principal

A **principal** is a human user who authenticates to the Kei platform via an identity provider (OIDC). The principal has:

- A unique identifier (`sub` in OIDC claims)
- An email address
- Membership in zero or more groups
- Zero or more organization memberships (for multi-tenant deployments)
- An access level defining which resources the principal can access

The principal is the unit of attribution. Every agent action is attributed to a principal, not to the agent.

### 3.2 Agent

An **agent** is a computational entity (typically an LLM-powered system) that executes actions on behalf of a principal. The agent does not have its own identity in the access control system—it operates solely as a proxy for the principal.

Agents communicate with Kei via the ABAC Engine API. When an agent wishes to perform an action, it sends an authorization request containing:

- The principal's identifier
- The action being requested (e.g., `github:write`, `jira:read`)
- The resource being targeted (e.g., `pr:123`, `jira:ticket-456`)

### 3.3 Delegation

**Delegation** is the process by which a principal grants an agent authority to act on their behalf. In Kei, delegation is implemented through:

1. **User Consent**: The principal explicitly authorizes which external services (GitHub, Jira, Calendar, Email) the agent may access. This consent is stored in the `user_consents` table and can be revoked at any time.

2. **Harness Tokens**: For machine-to-machine agent scenarios (e.g., automated workflows), the principal can generate a harness token that associates the agent with the principal's identity.

Delegation is not perpetual. The principal can revoke consent at any time, and the agent's authority is re-evaluated on every authorization request.

### 3.4 Resources and Actions

Resources are the targets of agent actions. In Kei, resources are identified by patterns (e.g., `github:repo:owner/name`, `jira:project:PROJ`).

Actions are the operations that can be performed on resources. Actions are also identified by patterns (e.g., `github:read`, `github:write`, `jira:*`).

The combination of resource patterns and action patterns in ABAC policies enables fine-grained access control.

### 3.5 Policy

A **policy** is a declarative rule that defines whether a principal may perform an action on a resource. Policies in Kei follow a Tailscale-style ACL format:

```json
{
  "src": "group:engineering",
  "dst": ["github:read", "github:write", "jira:write"],
  "action": "permit"
}
```

This policy states: principals in the `engineering` group are permitted to perform `read` and `write` operations on GitHub resources, and `write` operations on Jira resources.

Policies have a priority. When evaluating authorization, the highest-priority matching policy determines the decision.

---

## 4. Architecture

### 4.1 Design Principles

Kei is designed according to four principles:

1. **Open Core**: The access control logic is transparent and auditable. Organizations can inspect the policy engine, verify the authorization decisions, and ensure no hidden logic.

2. **Sovereign Deployment**: The entire control plane can be deployed within the organization's VPC. No data leaves the organization's perimeter unless explicitly authorized.

3. **Model Neutrality**: Kei is agnostic to the underlying LLM. Agents can use local models (Llama, Mistral, Phi-3 via Ollama or vLLM) or cloud APIs.

4. **Zero Trust by Default**: No implicit trust. Every tool invocation requires explicit authorization. Authentication (who are you?) is separate from authorization (are you permitted to do this?).

### 4.2 Architecture Overview

The Kei platform consists of three core components, deployed as microservices within a Kubernetes cluster:

```
┌─────────────────────────────────────────────────────────────────┐
│                     K8s Cluster (Local VPC)                     │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │  OIDC Bridge │   │ ABAC Engine  │   │  Config UI   │        │
│  │     (Go)     │◄─►│   (Go+PG)    │   │   (HTMX)     │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│         │                   │                                   │
│         ▼                   ▼                                   │
│  ┌──────────────┐   ┌──────────────┐                          │
│  │   External   │   │    Pedro     │◄── Agent Orchestrator    │
│  │ Identity     │   │     Tag      │    (external)            │
│  └──────────────┘   └──────────────┘                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL (CloudNativePG)                  │  │
│   users | groups | policies | audit_logs | consents         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Component Responsibilities

#### 4.3.1 OIDC Bridge (`cmd/oidc-bridge`)

The OIDC Bridge provides identity provider abstraction. It implements the OpenID Connect discovery protocol and handles OAuth 2.0 authorization flows.

**Endpoints**:
- `GET /.well-known/openid-configuration` — OIDC discovery
- `GET /authorize` — OAuth 2.0 authorization endpoint
- `POST /token` — Token exchange endpoint
- `GET /userinfo` — User claims endpoint
- `GET /jwks` — JSON Web Key Set for token verification

The OIDC Bridge authenticates users via external identity providers (e.g., GitHub OAuth) and issues JWTs that encode the user's identity. These JWTs are used by the ABAC Engine to identify the principal.

#### 4.3.2 ABAC Engine (`cmd/abac-engine`)

The ABAC Engine is the core authorization component. It evaluates every tool invocation against the policy database.

**Core Endpoints**:
- `POST /api/v1/authorize` — Evaluate an authorization request

**Authorization Request Format**:
```json
{
  "user_id": "uuid-of-principal",
  "action": "github:write",
  "resource": "pr:123"
}
```

**Authorization Response Format**:
```json
{
  "decision": "permit",
  "reason": "matched policy: group:engineering -> github:write"
}
```

**Additional Endpoints**:
- User management: `GET/POST /api/v1/users`, `GET/PUT /api/v1/users/{id}`
- Group management: `GET/POST /api/v1/groups`
- Policy management: `GET/POST/PUT/DELETE /api/v1/policies`
- Audit logs: `GET /api/v1/audit`
- Consent management: `GET/POST/PUT/DELETE /api/v1/consents`
- Agent harness tokens: `GET/POST/DELETE /api/v1/harness-tokens`

The ABAC Engine is built with Go and uses PostgreSQL for policy and audit storage. It exposes Prometheus metrics for observability.

#### 4.3.3 Config UI (`cmd/web`)

The Config UI is a web-based administration interface built with Go and HTMX (server-side templating). It provides:

- **Dashboard**: Overview of connected services
- **Connections**: OAuth setup for external services (GitHub, Jira, Calendar)
- **Permissions**: ACL policy editor
- **Audit Log**: Agent action history
- **Users/Groups**: User and group management
- **Agents**: Agent monitoring and harness token management

### 4.4 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    External Network                         │
│  (Slack, Discord, Chat interfaces)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Pedro Tag (Agent)                         │
│  - Receives user request                                    │
│  - Extracts principal identity from token                   │
│  - Calls ABAC Engine before tool execution                  │
└────────────────────────┬────────────────────────────────────┘
                         │
         POST /api/v1/authorize
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ABAC Engine                              │
│  - Validates principal identity                             │
│  - Evaluates policies against user groups                   │
│  - Checks consent status                                    │
│  - Returns PERMIT or DENY                                   │
│         │                                                   │
│         ▼ logs to                                          │
│  ┌─────────────┐                                           │
│  │ PostgreSQL  │ ◄── Policy storage + audit logs           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

The trust boundary is at the ABAC Engine. The agent (Pedro Tag) is outside the trust boundary—it must request authorization for every tool call. The ABAC Engine is the policy enforcement point.

---

## 5. Technical Mechanisms

### 5.1 Data Model

Kei uses PostgreSQL as its data store. The core schema is:

**users**: Principal records
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| external_id | VARCHAR(255) | External identity (OIDC sub) |
| email | VARCHAR(255) | User email |
| display_name | VARCHAR(255) | Display name |
| avatar_url | VARCHAR(512) | Avatar URL |
| created_at | TIMESTAMP | Creation time |

**groups**: Access groups
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Group name (e.g., "engineering") |
| description | TEXT | Group description |

**user_groups**: Principal-group membership
| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | FK to users |
| group_id | UUID | FK to groups |

**policies**: ACL rules
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Policy name |
| src_pattern | VARCHAR(255) | Source pattern (e.g., "group:engineering") |
| dst_pattern | VARCHAR(255) | Destination pattern (e.g., "github:write") |
| action | VARCHAR(50) | "permit" or "deny" |
| priority | INT | Higher = evaluated first |
| enabled | BOOLEAN | Active flag |

**audit_logs**: Authorization decisions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to users |
| action | VARCHAR(255) | Action attempted |
| resource | VARCHAR(255) | Resource targeted |
| decision | VARCHAR(50) | "permit" or "deny" |
| metadata | JSONB | Additional context |
| timestamp | TIMESTAMP | When action occurred |

**user_consents**: Delegation grants
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to users |
| org_id | UUID | FK to organizations |
| provider | VARCHAR(255) | External service (e.g., "github") |
| granted | BOOLEAN | Whether consent is granted |
| granted_at | TIMESTAMP | When consent was granted |

### 5.2 Authorization Flow

The authorization flow proceeds as follows:

1. **User Authentication**: User authenticates to the OIDC Bridge via an external IdP (e.g., GitHub). The OIDC Bridge issues a JWT containing the user's identity (`sub` claim).

2. **Agent Invocation**: User sends a request to the agent (e.g., via Slack). The agent extracts the user's identity from the JWT and constructs an authorization request.

3. **Authorization Request**: Agent calls `POST /api/v1/authorize` on the ABAC Engine with:
   - `user_id`: The principal's UUID
   - `action`: The requested action (e.g., `github:write`)
   - `resource`: The target resource (e.g., `pr:123`)

4. **Policy Evaluation**: The ABAC Engine:
   - Looks up the principal's groups
   - Iterates through enabled policies in priority order
   - Checks if any policy's `src_pattern` matches the principal's groups
   - Checks if any policy's `dst_pattern` matches the action and resource
   - Returns the first matching decision

5. **Decision**: If the decision is `permit`, the agent executes the tool and logs the action. If `deny`, the agent returns an error to the user.

6. **Audit**: Every authorization decision (both permit and deny) is logged to the `audit_logs` table with full context.

### 5.3 Authorization Model

The authorization model combines ABAC with explicit consent:

1. **Group-Based**: Policies reference groups (e.g., `group:engineering`). Principals are members of groups, and group membership determines access rights.

2. **Pattern Matching**: Both source (who) and destination (what) patterns support wildcards. For example, `github:*` matches all GitHub actions.

3. **Consent Overlay**: Even if a policy permits access, the principal must have explicitly consented to the external service. This prevents policy drift—admins cannot grant access to a service the user hasn't authorized.

4. **Deny by Default**: If no policy matches, the default decision is `deny`. This follows the principle of least privilege.

### 5.4 Failure Handling

The ABAC Engine implements defensive failure handling:

- **Database Unavailable**: If PostgreSQL is unavailable, the ABAC Engine returns `deny` (fail-secure, not fail-safe)
- **Invalid Requests**: Malformed authorization requests return HTTP 400 with generic error messages (no information leakage)
- **Rate Limiting**: The ABAC Engine enforces rate limits (10 requests/second, burst 20) to prevent abuse
- **Input Validation**: All inputs are validated for length and format before processing

### 5.5 Observability

The ABAC Engine exposes Prometheus metrics:

- `http_requests_total` — Counter of HTTP requests by method, path, status
- `http_request_duration_seconds` — Histogram of request latency
- `authorization_decisions_total` — Counter of authorization decisions by decision type and policy ID
- `db_query_duration_seconds` — Histogram of database query latency
- `consent_requests_total` — Counter of consent requests by provider and status

Audit logs are queryable via the `/api/v1/audit` endpoint, supporting filtering by user, action, resource, decision, and time range.

---

## 6. The Principal Delegation Protocol

This section describes the core innovation of the Principal Model—the mechanism by which agents obtain and exercise delegated authority.

### 6.1 Delegation Token

When a user authenticates, the OIDC Bridge issues a JWT containing:

```json
{
  "sub": "uuid-of-user",
  "email": "user@company.com",
  "exp": 1234567890,
  "iat": 1234567890
}
```

This token identifies the principal. The agent receives this token (via the user's session) and includes it in authorization requests to the ABAC Engine.

### 6.2 Consent-Based Authorization

Before an agent can access an external service on a user's behalf, the user must explicitly consent to that access. The consent flow:

1. **Initial Access Attempt**: Agent attempts to access a service (e.g., GitHub) on the user's behalf
2. **Consent Check**: ABAC Engine checks `user_consents` table for a granted consent record for this user and service
3. **No Consent Found**: ABAC Engine returns `deny` with reason `consent_required`
4. **Consent Prompt**: Agent prompts user to authorize access to the service
5. **User Authorization**: User visits Config UI, completes OAuth flow with the external service, and grants consent
6. **Consent Recorded**: Consent record is stored in `user_consents` table
7. **Retry**: Agent retries the tool call; ABAC Engine now permits

This consent model ensures that users have explicit, informed control over what their agents can access. Consent can be revoked at any time via the Config UI.

### 6.3 Agent Harness Tokens

For automated workflows (where no user is actively in the loop), Kei supports agent harness tokens. A harness token is a long-lived credential that associates an automated agent with a principal's identity.

Harness tokens are created by administrators via the Config UI and are stored hashed in the database. When an agent presents a harness token:

1. The ABAC Engine looks up the token and retrieves the associated organization
2. If the request includes a `provider_user_id`, the engine resolves it to a principal
3. The agent's requests are attributed to that principal, subject to the same ABAC policies as interactive users

Harness tokens are scoped to an organization and can be revoked at any time.

### 6.4 Policy Enforcement Point

The ABAC Engine functions as a Policy Enforcement Point (PEP). Every tool invocation passes through it:

```
Agent Tool Call → PEP (ABAC Engine) → Policy Evaluation → Decision → Tool Execution (if permitted)
```

This is distinct from authentication-only systems, where the agent authenticates once at session start and then has blanket access. The Principal Model requires explicit authorization for each action.

### 6.5 Audit Attribution

Every authorization decision is logged with the principal's identity. This enables:

- **Compliance**: Demonstrating that data access was authorized by the data subject
- **Forensics**: Reconstructing who accessed what, when, and why
- **Accountability**: Attributing actions to the human who delegated authority, not the agent

---

## 7. Security Analysis

### 7.1 Threat Model

We consider the following threat actors:

1. **External Attacker**: An attacker who cannot authenticate to the system but can send network traffic
2. **Compromised Agent**: An agent that has been compromised and is making unauthorized tool calls
3. **Malicious Insider**: A user with legitimate access who attempts to exceed their authorization
4. **Compromised Identity Provider**: An IdP that issues fraudulent tokens

### 7.2 Security Properties

#### 7.2.1 Principal Attribution

All tool invocations are attributed to the principal, not the agent. Even if an agent is compromised, the audit log identifies the human who delegated authority. This property enables accountability and forensics.

#### 7.2.2 Fail-Secure

When the ABAC Engine cannot evaluate a policy (e.g., database unavailable, malformed request), it defaults to `deny`. This prevents unauthorized access during failure conditions.

#### 7.2.3 Consent Binding

Even if an attacker compromises an agent, they cannot access external services without the principal's explicit consent. The consent table is protected by the same ABAC policies as tool access.

#### 7.2.4 Audit Completeness

Every authorization decision—whether permit or deny—is logged with full context. There is no way to execute a tool call without generating an audit record.

### 7.3 Comparison to Prior Art

| Property | Microsoft Copilot | ChatGPT Enterprise | Kei (Principal Model) |
|----------|-------------------|--------------------|-----------------------|
| Principal attribution | No | No | Yes |
| ABAC at invocation | No | No | Yes |
| Explicit consent | No | No | Yes |
| Sovereign deployment | No | No | Yes |
| Audit trails | Vendor-controlled | Vendor-controlled | Self-hosted |
| Policy format | Proprietary | Proprietary | Tailscale-style ACL |

### 7.4 Limitations of Current Implementation

The current Kei implementation uses JWTs for token representation, which have known limitations:

1. **No Revocation**: JWTs are valid until expiration. If a principal revokes consent, the agent may continue using a previously issued token until it expires. This is addressed in Section 10 (Future Enhancements).

2. **Replay Risk**: JWTs are bearer tokens. If intercepted, they can be replayed by an attacker. The current implementation does not include token binding to the presenting entity.

3. **No Proof of Possession**: JWTs do not prove that the presenter is the legitimate holder. This is a known limitation of JWT-based authentication.

These limitations are addressed in the future enhancements roadmap (Section 10).

---

## 8. Related Work

### 8.1 Microsoft Copilot

Microsoft Copilot integrates AI assistance into Microsoft 365. It operates within the Microsoft ecosystem, with data remaining in Microsoft-controlled infrastructure. Copilot does not support bring-your-own-agent (BYO Agent) deployment, does not expose ABAC policies to customers, and does not provide sovereign deployment options.

### 8.2 ChatGPT Enterprise

OpenAI's ChatGPT Enterprise provides organizational AI assistance with enhanced security and administrative controls. However, like Copilot, it operates as a SaaS product with no self-hosted option. The authorization model is tenant-level, not per-user or per-resource.

### 8.3 LangChain and Agent Frameworks

LangChain and similar frameworks provide agent development libraries. They do not include an authorization layer—developers must implement access control themselves. This creates a gap where agents have full access once authenticated.

### 8.4 Model Context Protocol (MCP)

Anthropic's MCP provides a standardized transport for connecting AI models to tools. However, MCP does not define authorization semantics. It specifies how tools are discovered and invoked, not whether access should be granted. The Principal Model can be viewed as a governance layer that enforces ABAC on top of MCP.

### 8.5 Tailscale ACLs

Kei's policy format is inspired by Tailscale's ACL system, which has proven effective in real-world deployments. Tailscale's approach—declarative policies with source and destination patterns—translates well to agentic AI access control.

---

## 9. Limitations and Open Questions

### 9.1 Adoption Friction

The Principal Model requires explicit user consent for each external service. This is a deliberate design choice for security, but it may create adoption friction. Users must complete an OAuth flow for each service (GitHub, Jira, Calendar, Email) before agents can access them.

### 9.2 Policy Complexity

As the number of principals, resources, and actions grows, policy management becomes complex. Tools for policy analysis (conflict detection, visualization, testing) are out of scope for this paper but are necessary for production deployments.

### 9.3 Tool Integration

Kei provides the authorization layer, but each tool (GitHub, Jira, Calendar) must be integrated separately. The burden of tool integration falls on the deployer.

### 9.4 Open Questions

1. **How to handle agent-to-agent delegation?** If one agent delegates to another, how should authorization be attributed?
2. **How to handle cross-org delegation?** If a user from Organization A needs access to Organization B's resources, how should policies be evaluated?
3. **How to handle policy versioning?** If policies change, should past authorization decisions be re-evaluated?

---

## 10. Future Enhancements

### 10.1 Short-Lived Access Grants with Refresh

The current JWT-based implementation has limitations: tokens cannot be revoked mid-flight, and there is no mechanism for continuous re-validation. Future versions will implement:

1. **Short-lived access tokens** (e.g., 5-minute TTL)
2. **Refresh tokens** for obtaining new access tokens
3. **Token introspection endpoint** that allows the ABAC Engine to verify token validity and check current authorization state at time of use

This pattern is standard in OAuth 2.0 (RFC 6749) and would bring Kei closer to the security properties of systems like Tailscale.

### 10.2 Ephemeral Key Handshake

For highest-security deployments, we envision an ephemeral key handshake (similar to WireGuard) where:

1. Agent and ABAC Engine perform a mutual authentication handshake
2. Session keys are established with perfect forward secrecy
3. Keys are rotated frequently (e.g., every minute)
4. Compromised keys cannot be used to decrypt past sessions or future sessions

This would eliminate the replay risk inherent in JWT-based systems.

### 10.3 Native MCP Integration

Future versions will include native support for the Model Context Protocol, providing a governance layer that enforces ABAC policies on MCP tool invocations.

### 10.4 Policy Analysis Tools

Production deployments will require tools for policy conflict detection, visualization, simulation, and testing.

---

## 11. Conclusion

The Principal Model presents a novel architectural pattern for user-delegated access control in agentic AI systems. By binding agent actions to human principals, enforcing ABAC policies at every tool invocation, and requiring explicit user consent, this model addresses the context lock-in, identity misattribution, and policy enforcement gaps in current commercial offerings.

The Kei implementation demonstrates that this model is technically feasible using standard, well-understood technologies (Go, PostgreSQL, Kubernetes, OAuth 2.0). The open-core architecture ensures that organizations can audit, verify, and extend the platform to meet their specific requirements.

We believe the Principal Model represents a necessary evolution in enterprise AI agent governance—one that prioritizes data sovereignty, user control, and regulatory compliance over vendor convenience.

---

## References

1. National Institute of Standards and Technology. "Zero Trust Architecture." NIST SP 800-207. https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf

2. National Institute of Standards and Technology. "Guide to Attribute Based Access Control (ABAC) Definition and Considerations." NIST SP 800-162.

3. European Union. "Regulation (EU) 2024/1689 (EU AI Act)." EUR-Lex. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689

4. European Union. "Regulation (EU) 2016/679 (General Data Protection Regulation)." EUR-Lex. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679

5. OAuth 2.0 Authorization Framework. RFC 6749. IETF. https://datatracker.ietf.org/doc/html/rfc6749

6. OpenID Connect Core 1.0. OpenID Foundation. https://openid.net/specs/openid-connect-core-1_0.html

7. Model Context Protocol Specification. Anthropic. https://spec.modelcontextprotocol.io/

8. Tailscale ACL Syntax. Tailscale. https://tailscale.com/kb/1018/acls

---

## Appendix A: Component Specifications

### A.1 ABAC Engine

| Property | Value |
|----------|-------|
| Language | Go 1.26 |
| Port | 8080 |
| Database | PostgreSQL 15 |
| Authentication | API key (configurable) |
| Rate Limiting | 10 req/s, burst 20 |

### A.2 OIDC Bridge

| Property | Value |
|----------|-------|
| Language | Go |
| Port | 8081 |
| Protocols | OIDC, OAuth 2.0 |
| JWT Algorithm | HS256 |

### A.3 Config UI

| Property | Value |
|----------|-------|
| Language | Go |
| Port | 8082 |
| Framework | HTMX |
| Session | Cookie-based (encrypted) |

## Appendix B: API Reference

### B.1 Authorization

```
POST /api/v1/authorize
Content-Type: application/json

{
  "user_id": "uuid",
  "action": "github:write",
  "resource": "pr:123"
}

Response:
{
  "decision": "permit",
  "reason": "matched policy: group:engineering -> github:write"
}
```

### B.2 Policy Management

```
GET /api/v1/policies

POST /api/v1/policies
Content-Type: application/json

{
  "name": "engineering github access",
  "src_pattern": "group:engineering",
  "dst_pattern": "github:*",
  "action": "permit",
  "priority": 100
}
```

### B.3 Audit Logs

```
GET /api/v1/audit?user_id=uuid&action=github:write&decision=permit
```

## Appendix C: Database Schema

The complete database schema is defined in the migrations directory (`migrations/001_initial_schema.sql`). Key tables include:

- `users` — Principal records
- `groups` — Access groups
- `user_groups` — Group membership
- `policies` — ACL rules
- `audit_logs` — Authorization decisions
- `user_consents` — Delegation grants
- `agent_harness_tokens` — Machine-to-machine credentials
- `organizations` — Multi-tenant organizations
- `organization_members` — Organization membership with roles

## Appendix D: Deployment

### D.1 Kubernetes

Kei can be deployed to Kubernetes using the manifests in `k8s/base/`. The deployment includes:

- Namespace (`kei`)
- PostgreSQL (CloudNativePG)
- OIDC Bridge deployment
- ABAC Engine deployment
- Config UI deployment
- Caddy reverse proxy configuration

### D.2 Helm

Alternatively, Kei can be deployed using the Helm chart in `helm/kei/`. This provides a single `helm install kei` command for quick deployment.

---

*Document Version: 1.0*
*Date: July 2026*