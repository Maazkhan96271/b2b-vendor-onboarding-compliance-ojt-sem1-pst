# B2B Vendor Onboarding & Compliance Portal (ID: PST_PD_116)
## Enterprise Multi-Tenant Regulatory Verification Platform

> **Lead Frontend UI/UX Engineer:** Mohd. Maaz Khan  
> **Core Backend Logic, State & Firebase Lead:** Abhinaba Das  
> **Tech Stack:** HTML5, CSS3, Bootstrap 5.3, Bootstrap Icons, Vanilla JavaScript (ES6+), Chart.js  
> **Target Viewports:** Laptop/Desktop (`>= 992px`) & Mobile Phone (`< 768px`)  
> **Batch / Level:** 2026 Level 2 (Core) • Semester 1 OJT Demo

---

## 1. Project Overview & Scope Division

This repository contains the production-grade web application for the **B2B Vendor Onboarding & Compliance Portal (PST_PD_116)**. The portal enables procurement teams and enterprise administrators to eliminate chaotic email threads and fragmented PDFs, implementing a streamlined 4-tier chain of command, automated document expiration calculations, heuristic risk tiers, and partitioned local storage.

### Scope Division:
| Engineering Domain | Owner | Scope & Deliverables |
| :--- | :--- | :--- |
| **UI/UX & Frontend Shell** | **Mohd. Maaz Khan** | Responsive Bootstrap 5 structural shell (`.container-fluid`, sticky sidebar on laptop, off-canvas navigation on mobile), multi-step dynamic onboarding form wizard, category-driven compliance document DOM injection, native `checkValidity()` validation, sortable manager `VendorDataTable` grid, mobile stacked cards transformation, Chart.js executive analytics containers, modals (Review, Rejection reason, Audit Trail, Document Preview), accessible toast notifications, and event interface contracts. |
| **Backend Logic, State & Firebase** | **Abhinaba Das** | **Week 1 Deliverables:** Git repo initialization, `.gitignore`, Firebase Authentication configuration, Partitioned `LocalDB` storage engine (`vendors_db`, `audit_logs`, `mock_api_cache`, `system_settings`), hard-coded Super Admin credential interceptor, and JSON State Import/Export.<br>**Week 2 Deliverables:** Hybrid Auth Controller (Firebase Auth + LocalDB authority), 4-tier chain of command approval routing, "Account Pending Approval" holding screen, RBAC session guards, modular SPA view switcher, Manager Requirement Builder persistence, dynamic Vendor upload DOM generator, quota-safe PDF metadata extraction, strict vendor UID data isolation, and deterministic 0–100% progress bar math. |

---

## 2. File Architecture

```text
Org B2B/
├── .gitignore                   # Production git ignore configuration (OS, logs, node, IDE)
├── index.html                   # Master semantic HTML5 shell: 4-Tier Dashboards, Auth & Modals
├── css/
│   └── styles.css               # Corporate Trust styling (#0A2540), sticky sidebars, role pills, responsive tables
├── js/
│   ├── localdb.js               # [Abhinaba Das] Partitioned LocalDB Engine (vendors_db, audit_logs, mock_api_cache, settings, JSON import/export)
│   ├── auth.js                  # [Abhinaba Das] Offline Firebase Auth, Super Admin Interceptor, Hierarchical Routing & RBAC Guards
│   ├── ui.js                    # [Mohd. Maaz Khan] UI components, chart wrappers, tables, review modals & toast notifications
│   └── app.js                   # [Abhinaba Das] Master SPA View Switcher, Requirement Builder persistence, Quota-Safe PDF metadata & Progress Math
└── README.md                    # System documentation, architecture & verification blueprint
```

---

## 3. 4-Tier Enterprise Chain of Command

The system implements a strict 4-tier hierarchical chain of command:

1. **Super Admin (Root Governance):**
   - Logs in using hard-coded company credentials stored in database seed:
     - **Email:** `superadmin@trustvendor.com`
     - **Password:** `SuperAdmin2026!`
   - Hard-coded Credential Interceptor automatically verifies and grants root access.
   - Accesses the **Super Admin Governance Portal** to review and approve/reject Operations Admin accounts.
   - Supervises chronological immutable audit logs and system settings.

2. **Operations Admin (Tier 2):**
   - Registers via Firebase Auth.
   - Account flagged as `PENDING_APPROVAL` and routed to the Super Admin.
   - Upon Super Admin approval, accesses the **Operations Admin Portal** to approve/reject Procurement Managers and escalated Vendors.

3. **Procurement Manager (Tier 3):**
   - Registers via Firebase Auth and is approved by the Operations Admin.
   - Accesses the **Procurement Management Workspace**:
     - **Stage 2 Gate:** Approves newly registered vendor accounts to unlock their onboarding dashboard.
     - **Manager Requirement Builder:** Configures minimum document counts, custom document types (e.g. GST, ISO 27001, Carrier Liability), and submission deadlines.
     - **Master Compliance Register:** Reviews vendor dossiers, filters by risk tier and expiration horizon, inspects documents, and issues approvals or rejections with mandatory justification.

4. **External Vendor POC (Tier 4):**
   - Registers via Firebase Auth.
   - Account flagged as `PENDING_APPROVAL` and routed to the Procurement Manager.
   - Once approved by Manager, onboarding workspace is unlocked:
     - **Strict UID Data Isolation:** Vendor can ONLY access their own corporate profile, their own documents, and their own progress tracker.
     - **Manager Deadline Countdown:** Real-time countdown widget to Manager's submission deadline.
     - **Dynamic Upload Slots:** Dynamically rendered upload slots matching the Manager's configured schema.
     - **Quota-Safe PDF Extractor:** Extracts lightweight metadata (`fileName`, `fileSizeKB`, `uploadTimestamp`) to strictly prevent `localStorage` exhaustion.
     - **Deterministic 0–100% Progress Bar:** Mathematical calculation across company details (35%), mandatory document uploads (45%), and banking/signatory (20%).

---

## 4. Abhinaba Das's Core Engineering Deliverables (Weeks 1 & 2)

### 4.1 Partitioned LocalDB Storage Engine (`js/localdb.js`)
Structured into four segregated namespaces under `localStorage`:
- `vendors_db`: Master collection of vendor dossiers, certifications, and compliance risk ratings.
- `audit_logs`: Chronological immutable event logging (`{ id, timestamp, actor, role, action, targetId, details }`).
- `mock_api_cache`: Caches asynchronous IRS EIN and business registry lookups.
- `system_settings`: Stores hard-coded Super Admin credentials per company, registered user accounts, and Manager requirement schemas.

**JSON State Portability:**
- `LocalDB.exportStateJSON()`: Generates and downloads a complete JSON state backup (`trustvendor_localdb_state_YYYY-MM-DD.json`).
- `LocalDB.importStateJSON(jsonData)`: Validates and restores database state across all partitions.
- Accessible directly via the **System Settings & LocalDB State** modal.

### 4.2 Hybrid Authentication & Hierarchical Approval Routing (`js/auth.js`)
- Fully compliant with Firebase Auth interface (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged`).
- **Hard-Coded Super Admin Credential Interceptor:** Immediately authenticates `superadmin@trustvendor.com` with `SuperAdmin2026!`.
- **Hierarchical Approval Routing:**
  - Admin $\to$ Super Admin approves
  - Manager $\to$ Admin approves (or Super Admin fallback)
  - Vendor $\to$ Manager approves (or Admin/Super Admin fallback)
- **Account Pending Approval Holding Screen:** Redirects pending accounts with real-time status check and assigned approver contact.
- **RBAC Session Guards:** Restricts views and mutations strictly to authorized personas.

### 4.3 Manager Requirement Builder & Dynamic DOM Generator (`js/app.js`)
- Enables Procurement Managers to configure:
  - Required document count.
  - Custom document types (add/edit/delete).
  - Submission deadline (date picker).
- Persists schema into `LocalDB.system_settings`.
- Spawns matching upload slots on the active Vendor view and renders an active countdown timer.

### 4.4 Quota-Safe PDF Metadata Extraction & Deterministic Progress Math
- Restricts file inputs to `.pdf` format.
- Reads file name, file size in KB, and upload timestamp without saving heavy base64 strings into `localStorage`.
- Mathematically calculates 0–100% onboarding progress and synchronizes between Vendor and Manager screens.

---

## 5. Quick Verification & Demo Guide

### Method 1: Instant 1-Click Demo Logins
Open `index.html` in any browser. On the Authentication Screen, click any of the **Quick Demo Persona Switcher** buttons:
- **[Super Admin]**: Logs in as `superadmin@trustvendor.com` (Inspect Admin approval queue and audit logs).
- **[Operations Admin]**: Logs in as `admin@trustvendor.com` (Inspect Manager approval queue).
- **[Procurement Manager]**: Logs in as `manager@trustvendor.com` (Inspect Vendor approval queue, Requirement Builder, and Compliance Register).
- **[Approved Vendor]**: Logs in as `vendor@apexlogistics.com` (Inspect completed vendor dossier).
- **[Pending Vendor]**: Logs in as `newvendor@cloudscale.io` (Inspect the "Account Pending Approval" holding screen).

### Method 2: Testing the Complete End-to-End Hierarchical Flow
1. **Vendor Sign-Up (Stage 1):**
   - Click "Create Account (Sign Up)" tab.
   - Enter Name: "Alex Reed", Email: "alex@acmelogistics.com", Password: "Password123!", Role: "External Vendor", Company: "Acme Freightways".
   - Submit form. You are redirected to the **Account Pending Approval Holding Screen** (routed to Procurement Manager).
2. **Manager Approval (Stage 2):**
   - Sign out, and click **[Procurement Manager]** quick login.
   - Navigate to Tab 2: **"Vendor Sign-Up Approvals"**.
   - Notice "Acme Freightways" listed. Click **"Approve & Unlock Onboarding"**.
3. **Manager Requirement Builder:**
   - In Manager view, navigate to Tab 3: **"Requirement Builder"**.
   - Change Required Document Count to 3, set Submission Deadline, add a custom document type (e.g. "GST Certificate"), and click **"Save & Publish Requirements"**.
4. **Vendor Onboarding & Quota-Safe Uploads (Stage 3):**
   - Sign out, and sign in as `alex@acmelogistics.com` (Password: `Password123!`).
   - The workspace is now **unlocked**!
   - Note the **Submission Deadline Countdown** banner.
   - Note the dynamic upload slots generated from the Manager's schema.
   - Fill company details, click **"Verify EIN"** (Promise-based mock verification spinner runs).
   - Attach `.pdf` files: notice lightweight quota-safe metadata extracted.
   - Watch the **Deterministic Progress Bar** advance accurately from 0% to 100%.
   - Certify agreement and click **"Submit Dossier for Manager Review"**.
5. **Manager Review (Stage 4):**
   - Sign out, log back in as Manager.
   - Acme Freightways is now displayed in the Master Vendor Register with status "Pending Review".
   - Open Review Modal, inspect documents, and test Approve or Reject with mandatory reason.
6. **LocalDB JSON State Export & Import:**
   - Click **"Settings"** in the sidebar (or topbar).
   - Click **"Export Full State (Download JSON)"** to verify JSON state portability.

---

## 6. Accessibility & Code Integrity

- **WCAG 2.1 AA Compliant:** High contrast ratios, aria-live regions for toasts, keyboard navigable modals, explicit `<label for="...">` associations.
- **Git Commits & Clean History:** Repository initialized with modular file structure, `.gitignore`, and detailed milestone commits.
