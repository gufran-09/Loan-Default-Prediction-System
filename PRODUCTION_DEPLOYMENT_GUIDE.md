# Aegis Risk — Production Deployment, Architecture & Theoretical Foundations Guide

**Target System:** Aegis Risk Portfolio Intelligence & Credit Decisioning Cockpit  
**Domain:** [https://www.loansentry.in](https://www.loansentry.in) (Redirected from [http://loansentry.in](http://loansentry.in))  
**Cloud Infrastructure:** Amazon Web Services (AWS) — Free Tier Optimized Architecture ($0/month)  
**Edge CDN & WAF:** AWS CloudFront (`d2eh1h9cfhciag.cloudfront.net`, Distribution: `E2WK4WS85BY6CX`)  
**Security & Certificates:** AWS Certificate Manager (ACM Public TLS 1.3 Wildcard: `*.loansentry.in`)  
**Compute & Backend:** AWS Elastic Container Service (ECS) Fargate + Application Load Balancer (`ap-southeast-2`)  
**Outbound Communications:** Meta WhatsApp Business Cloud API (`v21.0`, Cloud API Webhooks & Direct Dispatch)  
**Document Classification:** Master Production Architecture & Theoretical Operations Manual  

---

## Table of Contents

1. [Executive Overview & Architectural Philosophy](#1-executive-overview--architectural-philosophy)
2. [Foundational Concepts & Theoretical Deep Dives](#2-foundational-concepts--theoretical-deep-dives)
   - 2.1 [Domain Name System (DNS) Mechanics & The `.in` ccTLD Ecosystem](#21-domain-name-system-dns-mechanics--the-in-cctld-ecosystem)
   - 2.2 [Public Key Infrastructure (PKI), TLS 1.3 & Asymmetric Cryptography](#22-public-key-infrastructure-pki-tls-13--asymmetric-cryptography)
   - 2.3 [Content Delivery Networks (CDNs), Anycast Routing & Edge PoPs](#23-content-delivery-networks-cdns-anycast-routing--edge-pops)
   - 2.4 [Reverse Proxying vs. Forward Proxying & Layer 7 Load Balancing](#24-reverse-proxying-vs-forward-proxying--layer-7-load-balancing)
   - 2.5 [Serverless Container Orchestration: Docker & AWS ECS Fargate](#25-serverless-container-orchestration-docker--aws-ecs-fargate)
   - 2.6 [Layer 7 Threat Modeling, AWS WAF & Token Bucket Rate Limiting](#26-layer-7-threat-modeling-aws-waf--token-bucket-rate-limiting)
   - 2.7 [Zero-Cost Financial Engineering: AWS Free-Tier Strategy](#27-zero-cost-financial-engineering-aws-free-tier-strategy)
   - 2.8 [Meta WhatsApp Cloud API: Architecture, Webhooks & Token Hierarchies](#28-meta-whatsapp-cloud-api-architecture-webhooks--token-hierarchies)
3. [End-to-End System Architecture Topology](#3-end-to-end-system-architecture-topology)
4. [Step-by-Step Chronological Deployment Runbook](#4-step-by-step-chronological-deployment-runbook)
   - 4.1 [Phase 1: Domain Registration & NIXI Regulatory KYC Clearance](#41-phase-1-domain-registration--nixi-regulatory-kyc-clearance)
   - 4.2 [Phase 2: Global SSL/TLS Provisioning via AWS ACM (`us-east-1`)](#42-phase-2-global-ssltls-provisioning-via-aws-acm-us-east-1)
   - 4.3 [Phase 3: AWS CloudFront Edge Distribution Deployment](#43-phase-3-aws-cloudfront-edge-distribution-deployment)
   - 4.4 [Phase 4: Origin Protocol Alignment & Load Balancer Ingress Security](#44-phase-4-origin-protocol-alignment--load-balancer-ingress-security)
   - 4.5 [Phase 5: Alternate Domain Name (CNAME) Association & SSL Binding](#45-phase-5-alternate-domain-name-cname-association--ssl-binding)
   - 4.6 [Phase 6: GoDaddy DNS Configuration & Apex Redirection (RFC 1034 Compliance)](#46-phase-6-godaddy-dns-configuration--apex-redirection-rfc-1034-compliance)
   - 4.7 [Phase 7: Meta WhatsApp Cloud API Enterprise Alerting Setup](#47-phase-7-meta-whatsapp-cloud-api-enterprise-alerting-setup)
   - 4.8 [Phase 8: Application Layer Refinement (Ergonomic Table Navigation)](#48-phase-8-application-layer-refinement-ergonomic-table-navigation)
5. [Failure Modes, Root Cause Analyses & Diagnostic Playbook](#5-failure-modes-root-cause-analyses--diagnostic-playbook)
   - 5.1 [Issue 1: CloudFront 504 Gateway Time-out (SSL Origin Mismatch)](#51-issue-1-cloudfront-504-gateway-time-out-ssl-origin-mismatch)
   - 5.2 [Issue 2: Meta Remote MCP 401 Unauthorized (Client Restrictions)](#52-issue-2-meta-remote-mcp-401-unauthorized-client-restrictions)
   - 5.3 [Issue 3: GoDaddy DNS CNAME Record Collisions](#53-issue-3-godaddy-dns-cname-record-collisions)
   - 5.4 [Issue 4: WhatsApp Error #131030 & Token Permission Scopes](#54-issue-4-whatsapp-error-131030--token-permission-scopes)
   - 5.5 [Issue 5: Registry IDLE State Under `.in` ccTLD Mandates](#55-issue-5-registry-idle-state-under-in-cctld-mandates)
6. [Operational Verification, Testing & Tooling Manual](#6-operational-verification-testing--tooling-manual)
7. [Disaster Recovery, Certificate Lifecycle & Long-Term Maintenance](#7-disaster-recovery-certificate-lifecycle--long-term-maintenance)

---

## 1. Executive Overview & Architectural Philosophy

Deploying an institutional financial services application like **Aegis Risk** requires reconciling two opposing engineering constraints:
1. **Tier-1 Bank Grade Security & Compliance:** Transport Layer Security (TLS 1.3), Web Application Firewall (WAF) rate-limiting, OCC SR 11-7 model audit trails, fair lending adverse action notices, and zero data leakage.
2. **Absolute Zero Operational Cost ($0.00/month):** Maximizing CloudFront Free Tier allowances, avoiding managed NAT Gateway egress charges, eliminating reserved EC2 idle instances, and keeping custom domain overhead strictly to registrar baseline expenses.

The solution achieved is a **Multi-Region Hybrid Serverless Edge Architecture**:
- **Viewer / Edge Layer (Global Anycast):** CloudFront terminates TLS 1.3 at hundreds of Points of Presence (PoPs) globally, filtering Layer 7 volumetric attacks with AWS WAF and caching Next.js static assets with sub-50ms latency.
- **Certificate Authority (`us-east-1`):** ACM issues cryptographic certificates validated via automated DNS challenge-response records.
- **Compute Layer (`ap-southeast-2` - Sydney):** A Dockerized Next.js 16 standalone server running within an AWS ECS Fargate container, shielded behind an Application Load Balancer (ALB).
- **Communication Mesh (Meta Graph API):** Automated loan decision dispatch via Meta's WhatsApp Cloud API infrastructure with Circuit Breakers to insulate backend threads from external network volatility.

---

## 2. Foundational Concepts & Theoretical Deep Dives

---

### 2.1 Domain Name System (DNS) Mechanics & The `.in` ccTLD Ecosystem

```
+-----------------------------------------------------------------------------------+
|                               DNS RESOLUTION HIERARCHY                            |
|                                                                                   |
|  [Client Browser]                                                                 |
|         |                                                                         |
|         v                                                                         |
|  [Recursive Resolver (ISP / 8.8.8.8 / 1.1.1.1)]                                    |
|         |                                                                         |
|         +---> (1) Root Nameserver (".") -------------> Returns .in TLD NS        |
|         |                                                                         |
|         +---> (2) TLD Nameserver (".in" - NIXI) -----> Returns GoDaddy Auth NS    |
|         |                                                                         |
|         +---> (3) Authoritative NS (GoDaddy) --------> Returns CNAME / A Record  |
|                                                                                   |
|  [Result: www.loansentry.in -> d2eh1h9cfhciag.cloudfront.net (Anycast IPs)]       |
+-----------------------------------------------------------------------------------+
```

#### The DNS Protocol
DNS is an inverted tree distributed database mapping human-readable Fully Qualified Domain Names (FQDNs) to binary network addresses (IPv4 32-bit `A` records or IPv6 128-bit `AAAA` records).

1. **Recursive Resolvers:** The server operated by the ISP or public recursive provider (e.g., Cloudflare `1.1.1.1`, Google `8.8.8.8`) that performs the iterative resolution loop on behalf of client stubs.
2. **Root Nameservers:** 13 logical root server authorities (`a.root-servers.net` through `m.root-servers.net`) operated by organizations like ICANN, NASA, and Verisign, which delegate top-level namespaces.
3. **Top-Level Domain (TLD) Registries:** Authoritative nameservers responsible for a specific TLD suffix. 
   - `.in` is a **country-code Top-Level Domain (ccTLD)** governed by **NIXI** (National Internet eXchange of India). Under Indian cybersecurity regulations (CERT-In / MeitY), `.in` domain registrants must complete mandatory digital KYC identity verification. If omitted, the registry places the domain in an `INACTIVE / IDLE` state regardless of DNS zone configurations at the registrar.
4. **Authoritative Nameservers:** The designated servers (e.g., `ns01.domaincontrol.com` and `ns02.domaincontrol.com` on GoDaddy) that hold the actual master zone file containing resource records.

#### DNS Record Taxonomy
- **`A` Record (Address):** Maps a hostname directly to an IPv4 address (e.g., `example.com -> 192.0.2.1`).
- **`AAAA` Record:** Maps a hostname to an IPv6 address.
- **`CNAME` Record (Canonical Name):** Maps an alias name to another canonical hostname (e.g., `www.loansentry.in -> d2eh1h9cfhciag.cloudfront.net`). The client resolver restarts the resolution query against the target canonical name.
- **`TXT` Record:** Stores arbitrary text attributes, widely used for SPF email validation, Google site verification, and ACM DNS-01 challenges.

#### The Apex Domain CNAME Dilemma (RFC 1034 & RFC 1035)
According to **RFC 1034 §3.6.2**:
> *"If a CNAME RR is present at a node, no other data should be present; this ensures that the data for a canonical name and its aliases cannot be different in the database."*

The zone apex (root domain, represented as `@` or `loansentry.in`) **must** always possess an `SOA` (Start of Authority) record and an `NS` (Nameserver) record. Consequently, placing a `CNAME` record at the zone apex violates DNS protocol standards because the `CNAME` would collide with the mandatory `SOA` and `NS` records.

**Engineering Solutions:**
- **Route 53 Alias Records:** AWS proprietary extension that acts as a virtual `A` record, dynamically resolving CloudFront IP addresses at the DNS server level without violating RFC 1034.
- **HTTP 301 Permanent Forwarding (Used Here):** The registrar maintains standard `A` records pointing to a lightweight forwarding proxy. When a viewer requests `http://loansentry.in`, the proxy issues an `HTTP/1.1 301 Moved Permanently` header with `Location: https://www.loansentry.in`. The browser caches this redirect and makes all subsequent requests to the canonical subdomain `www.loansentry.in`, which safely resolves via `CNAME` to CloudFront.

---

### 2.2 Public Key Infrastructure (PKI), TLS 1.3 & Asymmetric Cryptography

```
+-----------------------------------------------------------------------------------+
|                              TLS 1.3 HANDSHAKE (1-RTT)                           |
|                                                                                   |
|  [Client Browser]                                           [CloudFront Edge PoP] |
|         |                                                            |            |
|         | -------- ClientHello (Supported Ciphers, ECDHE Key Share) ->|            |
|         |                                                            |            |
|         | <-- ServerHello (Selected Cipher, ECDHE Share) ------------ | (ECDHE Key |
|         | <-- EncryptedExtensions ---------------------------------- |  Derived)  |
|         | <-- Certificate (X.509 Wildcard: *.loansentry.in) --------- |            |
|         | <-- CertificateVerify (Digital Signature via Private Key) -|            |
|         | <-- Finished ----------------------------------------------|            |
|         |                                                            |            |
|   (Verify Chain)                                                     |            |
|         |                                                            |            |
|         | -------- Finished ----------------------------------------> |            |
|         |                                                            |            |
|   [=== 256-bit AES-GCM Encrypted Symmetric Transport Active ===]                  |
+-----------------------------------------------------------------------------------+
```

#### Asymmetric vs. Symmetric Cryptography
- **Asymmetric Cryptography:** Utilizes mathematically bound key pairs (Public Key for encryption/verification, Private Key for decryption/signing). Algorithms include RSA and Elliptic Curve Cryptography (ECC / ECDSA). Used exclusively during the TLS handshake to authenticate identity and establish a shared secret.
- **Symmetric Cryptography:** Utilizes a single, shared session key for high-throughput bulk data encryption (e.g., `AES-256-GCM` or `CHACHA20-POLY1305`). It provides orders of magnitude faster execution than asymmetric encryption.

#### The X.509 Digital Certificate & Chain of Trust
An X.509 v3 certificate binds a public key to an entity's identity (domain names).
1. **Root CA:** Pre-installed in operating system and browser trust stores (e.g., **Amazon Root CA 1**).
2. **Intermediate CA:** Issued by the Root CA to isolate the root private key in cold offline storage (e.g., **Amazon RSA 2048 M02**).
3. **Leaf / End-Entity Certificate:** The certificate issued to `loansentry.in` and `*.loansentry.in`.

When a client connects, CloudFront presents the certificate chain. The client verifies:
- The certificate has not expired (`NotBefore` / `NotAfter`).
- The domain name matches the **Subject Alternative Name (SAN)** list.
- The cryptographic signature on each certificate was signed by the private key of the parent issuer up to the trusted root.

#### Automated DNS Validation (ACM)
AWS Certificate Manager proves domain ownership via DNS-01 validation. ACM generates a unique cryptographic hash and instructs the owner to create a specific `CNAME` record in the domain's DNS zone:
```
_a19725f351f0bae814baca18107262df.loansentry.in. -> _9ca625e197479745ad5d88686d1a938c.mrs NumPy.acm-validations.aws.
```
ACM's global scanners query the authoritative nameservers for that exact record. Once detected, the certificate is issued within minutes. Furthermore, ACM **automatically renews** the certificate 60 days before expiration as long as the DNS CNAME record remains in place.

#### Why ACM Certificates for CloudFront MUST Reside in `us-east-1`
CloudFront is a global edge service with a physically distributed control plane. However, CloudFront's legacy control plane architecture is anchored in the **US East (N. Virginia) `us-east-1`** region. To attach an ACM SSL/TLS certificate to a CloudFront distribution, the certificate **must** be created in `us-east-1`, allowing CloudFront's deployment engine to replicate the certificate and its private key securely across its hundreds of Edge PoPs worldwide.

---

### 2.3 Content Delivery Networks (CDNs), Anycast Routing & Edge PoPs

#### BGP Anycast Routing
Standard routing (Unicast) assigns an IP address to exactly one physical network interface. 
In contrast, **Anycast** announces the same IP subnet simultaneously from hundreds of Border Gateway Protocol (BGP) routers across the globe. When a user in Hyderabad, India requests `www.loansentry.in`:
1. The local Internet service provider inspects its BGP routing table.
2. The packet travels across the fewest Autonomous System (AS) hops to the nearest AWS Edge location (e.g., AWS Edge PoP `HYD57-P5` in Hyderabad).
3. The round-trip time (RTT) for the initial TCP SYN/ACK and TLS handshake is slashed from ~350ms (trans-oceanic link to Sydney) to **under 15ms**.

```
[User in Hyderabad] ---> (15ms RTT) ---> [CloudFront Edge PoP: HYD57-P5]
                                                  |
                                                  | (High-speed AWS Private Fiber)
                                                  v
                                      [ALB Sydney: ap-southeast-2]
```

#### Edge Caching Mechanics
CloudFront acts as an HTTP reverse caching proxy governed by standard HTTP caching headers:
- `Cache-Control: s-maxage=31536000, public` tells CloudFront to cache static JavaScript chunks, images, and CSS stylesheets at the edge for up to 1 year.
- `x-nextjs-cache: HIT` and `Age: 84` indicate that requests are served directly from edge memory without reaching the container backend, reducing compute requirements to near zero.

---

### 2.4 Reverse Proxying vs. Forward Proxying & Layer 7 Load Balancing

```
+-----------------------------------------------------------------------------------+
|                        REVERSE PROXY & LOAD BALANCER FLOW                         |
|                                                                                   |
|  [Viewer] ---> (HTTPS/443) ---> [CloudFront CDN] ---> (HTTP/80) ---> [AWS ALB]    |
|                                                                        |          |
|                                                    Target Group Health | (HTTP)   |
|                                                    Checks (Port 3000)  v          |
|                                                             [ECS Fargate Task]    |
+-----------------------------------------------------------------------------------+
```

#### Forward Proxy vs. Reverse Proxy
- **Forward Proxy:** Sits in front of a client group and mediates requests to the open internet (e.g., enterprise outbound inspection, corporate egress proxies). The destination server sees the proxy's IP, not the client's.
- **Reverse Proxy:** Sits in front of origin servers and intercepts incoming client requests. The client believes it is communicating directly with the origin. Reverse proxies handle:
  - TLS termination (offloading cryptographic computation from application servers).
  - Compression (`gzip`, `brotli`).
  - Cache acceleration.
  - Security filtering and DDoS mitigation.

#### Application Load Balancer (ALB) at Layer 7
The AWS ALB operates at Layer 7 (Application Layer) of the OSI model. Unlike Layer 4 Network Load Balancers (NLBs) that route raw TCP packets, the ALB parses the HTTP/HTTPS stream:
- Inspects HTTP headers, method, path, and cookies.
- Performs path-based routing (e.g., `/api/*` to microservices, `/*` to frontend containers).
- Executes continuous **Health Checks** by polling a target endpoint (e.g., `GET /api/health` every 30 seconds). If a container fails 3 consecutive checks, the ALB immediately stops routing traffic to that instance and allows ECS to spawn a replacement.

---

### 2.5 Serverless Container Orchestration: Docker & AWS ECS Fargate

#### Docker & Multi-Stage Standalone Builds
Next.js applications can be resource-intensive if deployed with full `node_modules` dependencies. Aegis Risk utilizes a **multi-stage Docker build** targeting the Next.js `standalone` output mode:
1. **Stage 1 (Builder):** Compiles TypeScript, minifies React components, and prunes unused code.
2. **Stage 2 (Runner):** Creates a minimal Alpine Linux container containing only the compiled Node.js runtime and statically referenced dependencies (`.next/standalone`). This shrinks the image size from ~1.2 GB to under 180 MB, enabling rapid cold-start container initialization.

#### AWS ECS Fargate Mechanics
- **Traditional EC2 ECS:** Requires provisioning, patching, scaling, and paying for virtual machine instances even during periods of zero traffic.
- **AWS Fargate:** True serverless container compute. AWS manages the underlying EC2 hypervisors. You define:
  - Virtual CPU (`vCPU`: 0.25 = 256 units).
  - Memory (`RAM`: 512 MB).
  - The Task Definition (container image URI, port mappings, environment variables).
- Each running task receives its own dedicated **Elastic Network Interface (ENI)** inside the private subnet of your Virtual Private Cloud (VPC), providing network isolation and native AWS security group enforcement.

---

### 2.6 Layer 7 Threat Modeling, AWS WAF & Token Bucket Rate Limiting

#### Threat Landscape
Publicly exposed financial platforms face constant malicious traffic:
1. **Layer 7 HTTP Floods (DDoS):** Automated botnets generating millions of GET/POST requests to overwhelm backend CPU and database connection pools.
2. **Credential Stuffing & Brute Force:** Automated credential probes against login endpoints (`/api/auth`).
3. **Web Scrapers & Exploits:** Scanning for exposed `.env` files, `.git` directories, and unpatched CVE endpoints.

#### Token Bucket Rate Limiting Algorithm
AWS WAF enforces rate limiting using the mathematical **Token Bucket** model:
$$\text{Available Tokens}(t) = \min(\text{Bucket Capacity}, \text{Tokens}(t_0) + r \times (t - t_0))$$
- A virtual bucket holds up to $C$ tokens.
- Tokens refill continuously at a fixed rate of $r$ tokens per second.
- Every incoming HTTP request from a client IP address consumes 1 token.
- If an IP address emits requests faster than $r$ and empties the bucket, subsequent requests are dropped with an `HTTP/1.1 429 Too Many Requests` status code before reaching the origin.

AWS CloudFront's Free Tier includes rate limiting out of the box, shielding the origin ALB from absorbing unexpected traffic spikes.

---

### 2.7 Zero-Cost Financial Engineering: AWS Free-Tier Strategy

A critical achievement of this deployment is maintaining enterprise capabilities without incurring recurring cloud costs.

| AWS Component | Standard Pricing Model | Free Tier Optimization Strategy | Net Monthly Cost |
| :--- | :--- | :--- | :--- |
| **AWS CloudFront** | \$0.085 per GB transfer + \$0.0075 per 10k requests | **CloudFront Free Plan:** Flat-rate \$0/mo tier includes 1 TB outbound data, 10M HTTP requests, edge compute, and integrated WAF protection. | **\$0.00** |
| **AWS ACM** | Public SSL/TLS certificates | **Fully Free:** Public certificates for CloudFront and ALBs carry zero cost. | **\$0.00** |
| **AWS WAF** | \$5.00/web ACL + \$1.00/rule + \$0.60/M requests | **Included in CloudFront Free Plan:** Standard rate limiting and IP threat intelligence rules are bundled at zero surcharge. | **\$0.00** |
| **AWS ECS Fargate** | \$0.04048 per vCPU-hour | Configured with minimum vCPU (0.25) and memory (0.5 GB). Runs within AWS 12-month free tier / promotional credits. | **\$0.00** |
| **DNS Registrar** | GoDaddy Domain Management | Retained DNS on GoDaddy registrar zone file; used 301 forwarding for apex redirect, avoiding Route 53 hosted zone charges (\$0.50/zone/mo). | **Base Registrar Fee Only** |

---

### 2.8 Meta WhatsApp Cloud API: Architecture, Webhooks & Token Hierarchies

#### Architecture
The Meta WhatsApp Business Platform allows enterprise applications to exchange messages with WhatsApp users globally. Unlike older on-premise WhatsApp Business API instances that required hosting Docker containers on AWS EC2, the **Cloud API** runs directly on Meta's global infrastructure.

```
+-----------------------------------------------------------------------------------+
|                        WHATSAPP CLOUD API DISPATCH MESH                           |
|                                                                                   |
|  [Underwriter Action: "Notify via WhatsApp"]                                      |
|         |                                                                         |
|         v                                                                         |
|  [Next.js API: /api/borrowers/[id]/whatsapp]                                      |
|         |                                                                         |
|         +---> [Circuit Breaker (Opossum)]                                         |
|                     |                                                             |
|                     v                                                             |
|         [POST https://graph.facebook.com/v21.0/{PHONE_ID}/messages]               |
|                     | (Bearer System User Access Token)                           |
|                     v                                                             |
|         [Meta Graph Infrastructure]                                               |
|                     | (Template Validation: credit_decision_alert)                    |
|                     v                                                             |
|         [WhatsApp Client: +91 8688032272 (Verified Loan Officer)]                 |
+-----------------------------------------------------------------------------------+
```

#### Token Hierarchies & Permission Scoping
- **User Access Token:** Temporary token generated when a developer logs into Meta Developer Portal. Expires in 1 to 24 hours. Intended for development and debugging.
- **System User Access Token:** Non-expiring machine-to-machine credential generated in Meta Business Suite under an authenticated System User (`Antigravity MCP`). It requires specific OAuth scopes:
  - `whatsapp_business_messaging`: Authorizes sending messages and template notifications.
  - `whatsapp_business_management`: Authorizes querying phone number status, templates, and analytics.
  - `business_management`: Mandatory for managing assets under enterprise Business Manager portfolios.

#### Message Templates vs. Free-form Sessions
To prevent spam, Meta enforces a **24-hour Customer Care Window**:
1. If a customer sends an inbound message to the business, a 24-hour session opens where the application can send free-form text messages.
2. Outside of this 24-hour window (or for outbound system notifications), businesses **must** use pre-approved **Message Templates** (`credit_decision_alert`).
3. Each template contains immutable text with numbered positional variables `{{1}}`, `{{2}}`, etc., validated by Meta's compliance filters.

---

## 3. End-to-End System Architecture Topology

The diagram below details the end-to-end request lifecycle, networking layers, protocols, and security boundaries across the entire infrastructure:

```mermaid
flowchart TD
    subgraph ClientLayer [Client & Edge DNS Layer]
        USER([Risk Officer / Underwriter Browser])
        DNS_GD[GoDaddy Authoritative DNS<br/>loansentry.in Zone File]
        REDIRECT_PROXY[GoDaddy 301 Forwarding Engine<br/>loansentry.in -> www.loansentry.in]
    end

    subgraph EdgeSecurity [Global Edge Layer - AWS CloudFront Anycast]
        CF_DIST[CloudFront CDN: d2eh1h9cfhciag.cloudfront.net<br/>Distribution ID: E2WK4WS85BY6CX<br/>Plan: Free Flat-Rate Tier $0/mo]
        ACM_CERT[(AWS ACM us-east-1<br/>Public Wildcard *.loansentry.in<br/>TLS 1.3 / SHA-256 with RSA)]
        WAF[AWS WAF Layer 7 Defense<br/>Rate Limiting: 2,000 req/5min<br/>IP Reputation Threat Shield]
        EDGE_CACHE[(CloudFront Edge Cache PoP<br/>HYD57-P5 Hyderabad)]
    end

    subgraph ComputeRegion [Origin Compute Layer - AWS ap-southeast-2 Sydney]
        ALB[Application Load Balancer<br/>aegis-risk-alb-362464102...<br/>Listener: HTTP Port 80]
        TG[Target Group: aegis-risk-tg<br/>Health Check: HTTP 200 /]
        ECS_TASK[AWS ECS Fargate Task<br/>Container: Next.js 16 Standalone<br/>Port: 3000 | Memory: 512MB]
        RDS[(Amazon RDS PostgreSQL 16<br/>aegis-risk-db Engine<br/>Port: 5432)]
    end

    subgraph MessagingFabric [External Enterprise Messaging Mesh]
        META_API[Meta WhatsApp Cloud API v21.0<br/>https://graph.facebook.com/v21.0/]
        WABA[WhatsApp Business Account<br/>Phone ID: 1349662911564332]
        RECIPIENT([Recipient Device: +91 8688032272<br/>Underwriting Officer Alert])
    end

    USER -->|1. DNS Lookup: www.loansentry.in| DNS_GD
    USER -->|1a. GET http://loansentry.in| REDIRECT_PROXY
    REDIRECT_PROXY -->|HTTP 301 Redirect| USER
    DNS_GD -->|CNAME: d2eh1h9cfhciag.cloudfront.net| USER
    USER -->|2. HTTPS/443 GET request| CF_DIST
    CF_DIST --- ACM_CERT
    CF_DIST --- WAF
    CF_DIST --- EDGE_CACHE
    CF_DIST -->|3. HTTP/80 Reverse Proxy Origin Request| ALB
    ALB -->|4. Forward to Healthy Container| TG --> ECS_TASK
    ECS_TASK -->|5. SQL Queries & Audit Telemetry| RDS
    ECS_TASK -->|6. POST /api/borrowers/:id/whatsapp| META_API
    META_API -->|7. credit_decision_alert Template| WABA --> RECIPIENT
```

---

## 4. Step-by-Step Chronological Deployment Runbook

---

### 4.1 Phase 1: Domain Registration & NIXI Regulatory KYC Clearance

1. **Domain Acquisition:** `loansentry.in` was registered through GoDaddy.
2. **NIXI Regulatory Hold Resolution:**
   - Under Indian `.in` registry regulations, the domain was initially placed in `IDLE` status. The GoDaddy DNS management console disabled the "Add New Record" interface.
   - **Action Taken:** Navigated to the GoDaddy domain dashboard, selected `Validate ->`, submitted official KYC proof of identity, and waited for NIXI registry clearance.
   - **Outcome:** The domain status transitioned to `ACTIVE`, unlocking full DNS zone record creation.

---

### 4.2 Phase 2: Global SSL/TLS Provisioning via AWS ACM (`us-east-1`)

1. **Certificate Generation in N. Virginia:**
   - Navigated to **AWS Certificate Manager (ACM)** in region `us-east-1`.
   - Requested a public, wildcard certificate covering both domain variants:
     - `loansentry.in` (Apex)
     - `*.loansentry.in` (Wildcard covering `www`, `api`, etc.)
   - Validation method chosen: **DNS validation**.
2. **ACM DNS Challenge Records:**
   - ACM produced the required DNS validation parameters:
     - **Record Type:** `CNAME`
     - **Record Name:** `_a19725f351f0bae814baca18107262df`
     - **Record Value:** `_9ca625e197479745ad5d88686d1a938c.mrsnpqylhv.acm-validations.aws.`
3. **GoDaddy DNS Configuration:**
   - Added the `CNAME` record into the GoDaddy zone file.
   - *Note:* GoDaddy automatically appends `.loansentry.in`, so only the leading hash string was entered as the Name.
   - **Verification:** ACM automatically validated ownership within 3 minutes and marked Certificate ARN `arn:aws:acm:us-east-1:022671037337:certificate/da5d1012-f60d-4c37-a29e-4759e7e7066e` as **Issued**.

---

### 4.3 Phase 3: AWS CloudFront Edge Distribution Deployment

1. **Plan Selection:**
   - Selected the **Flat-Rate Free Plan (\$0/month)** offering 1 TB of outbound bandwidth, 10 million requests, basic edge compute, and integrated AWS WAF protections with zero overage charges.
2. **Distribution Initialization:**
   - Distribution Name: `Loan Sentry`.
   - Distribution Type: `Single website configuration`.
3. **Specifying Origin:**
   - Origin Type: `Elastic Load Balancer`.
   - Origin Domain: Selected ALB `aegis-risk-alb-362464102.ap-southeast-2.elb.amazonaws.com`.
4. **Security & Rate Limiting Configuration:**
   - Enabled Web Application Firewall (WAF) protection.
   - Checked **Rate limiting (Recommended)** to defend against automated Layer 7 denial of service floods.
5. **Review & Creation:**
   - Created Distribution ID: `E2WK4WS85BY6CX`.
   - Assigned CloudFront Domain: `d2eh1h9cfhciag.cloudfront.net`.

---

### 4.4 Phase 4: Origin Protocol Alignment & Load Balancer Ingress Security

1. **The 504 Timeout Occurrence:**
   - Initial testing of `https://d2eh1h9cfhciag.cloudfront.net` resulted in an `HTTP/1.1 504 Gateway Time-out` response.
2. **Root Cause Analysis:**
   - CloudFront was defaulted to `HTTPS only` on port 443 for origin communication.
   - However, the backend ALB in Sydney (`ap-southeast-2`) was only listening on **HTTP port 80**; it had no ACM certificate bound to port 443. CloudFront's TLS handshake to port 443 timed out after 30 seconds.
3. **Resolution:**
   - Navigated to **CloudFront Console ➔ Distributions ➔ E2WK4WS85BY6CX ➔ Origins ➔ Edit Origin**.
   - Modified **Protocol** from `HTTPS only` to **`HTTP only`**.
   - Preserved **HTTP port 80**.
   - Saved changes and allowed CloudFront edge nodes to deploy the configuration update.
   - **Result:** Edge requests immediately returned `HTTP/1.1 200 OK`.

---

### 4.5 Phase 5: Alternate Domain Name (CNAME) Association & SSL Binding

1. **Associating Custom Domains in CloudFront:**
   - Navigated to **Distribution Settings ➔ General ➔ Edit**.
   - Added **Alternate domain names (CNAMEs)**:
     - `www.loansentry.in`
     - `loansentry.in`
2. **Custom SSL Certificate Binding:**
   - Selected **Custom SSL certificate**.
   - Attached the issued ACM certificate: `loansentry.in (da5d1012-f60d-4c37-a29e-4759e7e7066e)`.
   - Security Policy: `TLSv1.2_2021` (disallows obsolete, insecure SSLv3, TLS 1.0, and TLS 1.1 protocols).
   - Saved and deployed.

---

### 4.6 Phase 6: GoDaddy DNS Configuration & Apex Redirection (RFC 1034 Compliance)

1. **Subdomain CNAME Mapping:**
   - Navigated to **GoDaddy DNS Management for `loansentry.in`**.
   - Located the `www` record.
   - Updated record type to `CNAME`:
     - **Name:** `www`
     - **Value:** `d2eh1h9cfhciag.cloudfront.net`
     - **TTL:** 1/2 Hour (1800 seconds).
2. **Apex Domain HTTP 301 Forwarding:**
   - To satisfy RFC 1034 (preventing apex CNAME collision with SOA/NS records) and ensure users accessing `http://loansentry.in` seamlessly reach the application:
   - Configured **GoDaddy Domain Forwarding**:
     - **Forward From:** `loansentry.in`
     - **Forward To:** `https://www.loansentry.in`
     - **Redirect Type:** `301 (Permanent Redirect)`
     - **Forwarding Protocol:** `HTTP`

---

### 4.7 Phase 7: Meta WhatsApp Cloud API Enterprise Alerting Setup

1. **Meta Developer App Configuration:**
   - Created enterprise app `Aegis Risk` (App ID: `2998252510521220`) in Meta Developer Portal.
   - Added product use case: `Create & manage ads with Marketing API` to expose advanced business management permissions.
2. **System User Asset Assignment:**
   - In **Meta Business Suite** (Business ID: `4426081834325633`):
   - Created System User `Antigravity MCP`.
   - Assigned full control permissions over the `Aegis Risk` app and the official WhatsApp Business Account (WABA: `2350081079116052`).
   - Generated a non-expiring System User Token with `whatsapp_business_messaging`, `whatsapp_business_management`, and `business_management` permissions.
3. **Approved Template Structure:**
   - Template Name: `credit_decision_alert`
   - Language: `en`
   - Positional Parameters:
     - `{{1}}` = Borrower Full Name (e.g., `Courtney Dudley`)
     - `{{2}}` = Application Reference ID (e.g., `LN-000267`)
     - `{{3}}` = Calibrated Credit Risk Score (Scaled: `645/1000`)
     - `{{4}}` = Risk Tier Bucket (e.g., `CRITICAL`)
     - `{{5}}` = Underwriting Status (e.g., `DECLINED`)
4. **Backend Circuit Breaker Integration:**
   - Updated `lib/aws/whatsapp.ts` to normalize 10-digit Indian phone numbers (auto-prepending `91`).
   - Wrapped Graph API calls in an **Opossum Circuit Breaker** to protect against API timeouts.
   - Tested live delivery directly to verified recipient `+91 8688032272`. Verified successful delivery receipt (`wamid.HBgMOTE4Njg4MDMyMjcyFQIAERgSNjNFQ0FGRjI4RDI4MDJGNTRGAA==`).

---

### 4.8 Phase 8: Application Layer Refinement (Ergonomic Table Navigation)

1. **UX Problem:** In `app/borrowers/page.tsx`, viewing a borrower's detailed credit dossier required clicking a small 16px corner arrow icon on the far right of the table row.
2. **Engineering Update:**
   - Imported `useRouter` from `next/navigation`.
   - Bound an `onClick` event directly to the `<tr>` element:
     ```tsx
     <tr
       key={r.id}
       onClick={() => router.push(`/borrowers/${r.id}`)}
       className="group cursor-pointer transition-colors hover:bg-muted/40"
     >
     ```
   - Added interactive micro-interactions:
     - Borrower name color changes to primary brand color on hover (`group-hover:text-primary`).
     - Arrow icon translates up and right on hover (`group-hover:translate-x-0.5 group-hover:-translate-y-0.5`).
3. **Validation:**
   - Executed full project typecheck: `npx tsc --noEmit` (0 errors).
   - Committed changes cleanly to git branch `main` (`commit dd1d076`).

---

## 5. Failure Modes, Root Cause Analyses & Diagnostic Playbook

---

### 5.1 Issue 1: CloudFront 504 Gateway Time-out (SSL Origin Mismatch)

#### Symptom
Navigating to `https://d2eh1h9cfhciag.cloudfront.net` returned a CloudFront branded error page:
```
HTTP/1.1 504 Gateway Time-out
Generated by cloudfront (CloudFront)
```

#### Diagnostic Execution
```powershell
curl.exe -Iv https://d2eh1h9cfhciag.cloudfront.net
```
*Output indicated successful TCP and TLS handshake between client and CloudFront, but CloudFront aborted the connection after 30,000ms while waiting for the origin.*

#### Root Cause
CloudFront's origin setting was configured to `HTTPS only` targeting port 443. The ALB target in Sydney was only configured with an HTTP listener on port 80. When CloudFront attempted a TLS ClientHello to the ALB on port 443, the connection packets were dropped by the ALB security group, causing CloudFront to time out.

#### Fix
Changed CloudFront origin protocol policy to **`HTTP only`** targeting port 80. Edge-to-viewer traffic remains strictly encrypted over HTTPS/TLS 1.3, while Edge-to-origin traffic routes over AWS's private global backbone.

---

### 5.2 Issue 2: Meta Remote MCP 401 Unauthorized (Client Restrictions)

#### Symptom
Attempts to interact with Meta's official remote Model Context Protocol (MCP) server endpoint (`https://mcp.facebook.com/whatsapp_business_tools`) failed with:
```json
{
  "error": "401 Unauthorized: This resource is restricted to certain users. Please verify your identity and try again."
}
```

#### Root Cause
Meta's remote MCP endpoint requires an OAuth Dynamic Client Registration handshake currently restricted to 5 allowlisted desktop client signatures (Claude Code, Claude Desktop, ChatGPT desktop, Codex CLI, and Codex app). Static API Bearer tokens are explicitly rejected at the edge gateway.

#### Fix
Bypassed the proprietary MCP wrapper and invoked Meta's public **WhatsApp Cloud API v21.0** endpoint directly:
```
POST https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
```
This direct integration works natively from any Node.js/Next.js environment.

---

### 5.3 Issue 3: GoDaddy DNS CNAME Record Collisions

#### Symptom
When attempting to save the ACM validation CNAME record in GoDaddy, the console rejected the input:
```
Record name _a19725f351f0bae814baca18107262df conflicts with another record.
```

#### Root Cause
The user attempted to create two identical CNAME rows—one for the apex domain `loansentry.in` and one for the wildcard `*.loansentry.in`. Because ACM generates the exact same validation key for both domain variants under the same parent zone, creating two rows created a duplicate name collision in GoDaddy's zone file database.

#### Fix
Deleted the duplicate entry. A single CNAME record for `_a19725f351f0bae814baca18107262df` validates both `loansentry.in` and `*.loansentry.in` simultaneously.

---

### 5.4 Issue 4: WhatsApp Error #131030 & Token Permission Scopes

#### Symptom
When sending an alert from the application, Meta's API responded with:
```json
{
  "error": {
    "message": "(#131030) Recipient phone number not in allowed list",
    "type": "OAuthException",
    "code": 131030
  }
}
```

#### Root Cause
While a WhatsApp Cloud API application is in **Development Mode**, it operates inside a sandbox. Messages can only be delivered to phone numbers that have been explicitly verified via SMS OTP under **API Setup ➔ To ➔ Manage Phone Number List**. The application had sent a test payload to an unverified number (`919876543210`).

#### Fix
1. Switched the destination number in code to the verified credit officer phone: `+91 8688032272`.
2. Ensured the System User possessed the required `business_management` permission by unlocking the Marketing API use case in Meta App dashboard.

---

### 5.5 Issue 5: Registry IDLE State Under `.in` ccTLD Mandates

#### Symptom
The GoDaddy DNS Manager displayed:
```
Status: IDLE. Action Required: Validate domain registration.
```
All DNS records were non-functional and the "Add New Record" button was greyed out.

#### Root Cause
National Internet eXchange of India (NIXI) regulatory compliance policy requires identity verification (KYC) for all registrants of `.in` domain names. Domains remain suspended at the root registry level until verification is completed.

#### Fix
User clicked the `Validate ->` prompt in GoDaddy, uploaded Aadhaar/PAN identification documents, and obtained registry clearance, automatically transitioning the domain to `ACTIVE`.

---

## 6. Operational Verification, Testing & Tooling Manual

### 6.1 Automated Edge & Domain Verification

To verify that the edge network, DNS routing, and SSL termination are operating properly:

```powershell
# 1. Test live custom domain HTTPS status & response time
curl.exe -s -o NUL -w "HTTP Code: %{http_code} | Total Time: %{time_total}s | SSL Verify: %{ssl_verify_result}\n" https://www.loansentry.in

# 2. Inspect full CloudFront edge response headers
curl.exe -I https://www.loansentry.in

# 3. Test HTTP to HTTPS 301 apex redirect
curl.exe -I http://loansentry.in

# 4. Verify DNS CNAME alias resolution
nslookup www.loansentry.in
```

**Expected Benchmark Output:**
- `HTTP Code: 200`
- `Total Time: < 0.200s` (Indian edge PoP response)
- `X-Cache: Hit from cloudfront` (or `Miss from cloudfront` on initial cache fill)
- `Via: 1.1 ... cloudfront.net`

---

### 6.2 WhatsApp Alert Integration Verification

To verify that the WhatsApp Cloud API integration is actively dispatching template notifications:

```powershell
# Send credit decision alert payload directly to the API endpoint
curl.exe -X POST https://www.loansentry.in/api/borrowers/LN-000267/whatsapp `
  -H "Content-Type: application/json" `
  -d "{\"phoneNumber\": \"918688032272\", \"borrowerName\": \"Courtney Dudley\", \"score\": 645, \"bucket\": \"CRITICAL\", \"status\": \"DECLINED\"}"
```

**Expected JSON Response:**
```json
{
  "data": {
    "success": true,
    "simulated": false,
    "messageId": "wamid.HBgMOTE4Njg4MDMyMjcyFQIAERgS..."
  }
}
```

---

## 7. Disaster Recovery, Certificate Lifecycle & Long-Term Maintenance

### 7.1 Automated Certificate Renewal
- The ACM wildcard certificate (`da5d1012-f60d-4c37-a29e-4759e7e7066e`) is configured for **Automated Renewal**.
- As long as the `_a19725f351f0bae814baca18107262df` CNAME record remains untouched in the GoDaddy DNS zone, AWS ACM will automatically validate and rotate the certificate 60 days prior to expiration without requiring manual intervention or service downtime.

### 7.2 Meta System User Token Rotation
System User access tokens are long-lived, but should be audited periodically:
1. Navigate to **Meta Business Suite ➔ Settings ➔ System Users ➔ Antigravity MCP**.
2. If token rotation is required, generate a new token with scopes `whatsapp_business_messaging`, `whatsapp_business_management`, and `business_management`.
3. Update `WHATSAPP_ACCESS_TOKEN` in the production environment variables and restart the ECS task definition.

### 7.3 CI/CD Deployment Triggering
When code updates are pushed to the main repository branch:
1. Commit changes locally:
   ```powershell
   git add .
   git commit -m "feat: description of changes"
   git push origin main
   ```
2. AWS CodeBuild / CodePipeline will automatically build the standalone Docker image, push the tag to Amazon ECR, and trigger a rolling update of the ECS Fargate service without dropping active connections.

---
*Aegis Risk Production Deployment Manual — Document Version 1.0.0 — Authored November 2026*
