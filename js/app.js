/**
 * Master Application Controller & SPA View Switcher
 * Author: Abhinaba Das (Backend Logic, State & Firebase Lead)
 * Project: B2B Vendor Onboarding & Compliance Portal (PST_PD_116)
 * 
 * Milestones Implemented:
 * - Week 1: Partitioned LocalDB Engine integration, JSON State Import/Export, Repository setup
 * - Week 2: Hybrid Auth Controller, 4-Tier Enterprise Chain of Command, Modular SPA View Switcher,
 *           RBAC Session Guards, Manager Requirement Builder persistence, Dynamic Vendor DOM generator,
 *           Quota-Safe PDF metadata extraction, Strict Vendor UID data isolation, Deterministic 0-100% progress math
 */

(function (window, document) {
  'use strict';

  // Master App Controller
  const App = {
    activeCountdownInterval: null,

    init() {
      console.log('🚀 Initializing TrustVendor Master Application Controller...');

      // 1. Initialize LocalDB & Auth
      window.LocalDB.init();

      // 2. Bind Auth UI (Sign In, Sign Up, Quick Logins)
      this.bindAuthCardUI();

      // 3. Bind Super Admin & Admin queues
      this.bindApprovalQueueActions();

      // 4. Bind Manager Requirement Builder
      this.bindManagerRequirementBuilder();

      // 5. Bind Quota-Safe PDF metadata extraction & Progress calculation
      this.bindQuotaSafeUploadsAndProgress();

      // 6. Bind LocalDB JSON State Import & Export
      this.bindLocalDBStateExportImport();

      // 7. Subscribe to Auth changes and route view
      window.PortalAuth.onAuthStateChanged(user => {
        this.routeBasedOnAuth(user);
      });

      // 8. Bind global teammate custom events
      this.bindTeammateEventBridge();

      // 9. Bind logout buttons
      document.querySelectorAll('[data-action-logout]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleSignOut();
        });
      });
    },

    /* =========================================================================
       1. MODULAR SPA VIEW SWITCHER & 4-TIER RBAC ROUTER
       ========================================================================= */

    /**
     * Routes SPA view according to active authenticated user role & approval status
     * @param {object|null} user 
     */
    routeBasedOnAuth(user) {
      const viewAuth = document.getElementById('view-auth');
      const viewPending = document.getElementById('view-pending');
      const viewSuperAdmin = document.getElementById('view-superadmin');
      const viewAdmin = document.getElementById('view-admin');
      const viewManager = document.getElementById('view-manager');
      const viewVendor = document.getElementById('view-vendor');
      const appShell = document.getElementById('portalAppShell');

      // Hide all main containers first
      if (viewAuth) viewAuth.classList.add('d-none');
      if (viewPending) viewPending.classList.add('d-none');
      if (viewSuperAdmin) viewSuperAdmin.classList.add('d-none');
      if (viewAdmin) viewAdmin.classList.add('d-none');
      if (viewManager) viewManager.classList.add('d-none');
      if (viewVendor) viewVendor.classList.add('d-none');
      if (appShell) appShell.classList.add('d-none');

      // Case 1: Unauthenticated -> Show Auth View (Sign In / Sign Up)
      if (!user) {
        if (viewAuth) viewAuth.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Case 2: Authenticated but Account PENDING_APPROVAL -> Show Holding Screen
      if (user.status === 'PENDING_APPROVAL') {
        if (viewPending) {
          viewPending.classList.remove('d-none');
          this.renderPendingHoldingScreen(user);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Case 3: Account REJECTED -> Show Holding Screen with Rejection details
      if (user.status === 'REJECTED') {
        if (viewPending) {
          viewPending.classList.remove('d-none');
          this.renderRejectedHoldingScreen(user);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Case 4: Approved User -> Show Authenticated App Shell and Role Dashboard
      if (appShell) appShell.classList.remove('d-none');
      this.updateSidebarAndTopbarForUser(user);

      if (user.role === 'superadmin') {
        if (viewSuperAdmin) viewSuperAdmin.classList.remove('d-none');
        this.renderSuperAdminDashboard();
      } else if (user.role === 'admin') {
        if (viewAdmin) viewAdmin.classList.remove('d-none');
        this.renderAdminDashboard();
      } else if (user.role === 'manager') {
        if (viewManager) viewManager.classList.remove('d-none');
        this.renderManagerWorkspace();
      } else if (user.role === 'vendor') {
        if (viewVendor) viewVendor.classList.remove('d-none');
        this.renderVendorWorkspace(user);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Updates Desktop Sidebar and Topbar profile information
     * @param {object} user 
     */
    updateSidebarAndTopbarForUser(user) {
      const avatarEl = document.getElementById('sidebarUserAvatar');
      const nameEl = document.getElementById('sidebarUserName');
      const roleTextEl = document.getElementById('sidebarUserRole');
      const roleBadge = document.getElementById('sidebarRoleBadge');
      const topbarRoleBadge = document.getElementById('topbarRoleBadge');
      const topbarTitle = document.getElementById('topbarTitle');

      const initials = (user.name || user.email || 'US')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      if (avatarEl) avatarEl.textContent = initials;
      if (nameEl) nameEl.textContent = user.name || user.email;

      let roleLabel = 'User';
      let pillClass = 'role-pill-vendor';
      let icon = 'bi-person';

      if (user.role === 'superadmin') {
        roleLabel = 'Super Admin';
        pillClass = 'role-pill-superadmin';
        icon = 'bi-shield-shaded';
        if (roleTextEl) roleTextEl.textContent = 'Root Authority / Governance';
        if (topbarTitle) topbarTitle.textContent = 'Super Admin Governance Portal';
      } else if (user.role === 'admin') {
        roleLabel = 'Operations Admin';
        pillClass = 'role-pill-admin';
        icon = 'bi-shield-lock';
        if (roleTextEl) roleTextEl.textContent = 'Enterprise Operations Lead';
        if (topbarTitle) topbarTitle.textContent = 'Enterprise Operations Admin Portal';
      } else if (user.role === 'manager') {
        roleLabel = 'Procurement Manager';
        pillClass = 'role-pill-manager';
        icon = 'bi-shield-check';
        if (roleTextEl) roleTextEl.textContent = 'Sr. Procurement Lead';
        if (topbarTitle) topbarTitle.textContent = 'Procurement Compliance Dashboard';
      } else if (user.role === 'vendor') {
        roleLabel = 'External Vendor POC';
        pillClass = 'role-pill-vendor';
        icon = 'bi-building-check';
        if (roleTextEl) roleTextEl.textContent = user.company || 'External Supplier';
        if (topbarTitle) topbarTitle.textContent = 'Vendor Onboarding & Compliance Workspace';
      }

      const badgeHtml = `<i class="bi ${icon}"></i> <span>${roleLabel}</span>`;
      if (roleBadge) {
        roleBadge.className = `role-pill ${pillClass} w-100 text-center justify-content-center`;
        roleBadge.innerHTML = badgeHtml;
      }
      if (topbarRoleBadge) {
        topbarRoleBadge.className = `role-pill ${pillClass} d-none d-sm-inline-flex`;
        topbarRoleBadge.innerHTML = badgeHtml;
      }
    },

    /* =========================================================================
       2. AUTHENTICATION & LOGIN/SIGNUP UI BINDINGS
       ========================================================================= */

    bindAuthCardUI() {
      // 1. Sign In Form
      const signInForm = document.getElementById('authSignInForm');
      if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const emailInput = document.getElementById('signInEmail');
          const passwordInput = document.getElementById('signInPassword');
          const submitBtn = document.getElementById('btnSignInSubmit');
          const spinner = document.getElementById('signInSpinner');

          if (!signInForm.checkValidity()) {
            signInForm.classList.add('was-validated');
            return;
          }

          if (submitBtn) submitBtn.disabled = true;
          if (spinner) spinner.classList.remove('d-none');

          try {
            const { user, requiresApproval } = await window.PortalAuth.signInWithEmailAndPassword(
              emailInput.value,
              passwordInput.value
            );

            if (requiresApproval) {
              window.PortalUI.showToast('Account is awaiting administrative review.', 'warning', 'Pending Approval');
            } else {
              window.PortalUI.showSuccessToast(`Welcome back, ${user.name || user.email}!`, 'Signed In Successfully');
            }
          } catch (err) {
            window.PortalUI.showErrorToast(err.message, 'Authentication Error');
          } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (spinner) spinner.classList.add('d-none');
          }
        });
      }

      // 2. Sign Up Form
      const signUpForm = document.getElementById('authSignUpForm');
      if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const nameInput = document.getElementById('signUpName');
          const emailInput = document.getElementById('signUpEmail');
          const passwordInput = document.getElementById('signUpPassword');
          const roleSelect = document.getElementById('signUpRole');
          const companyInput = document.getElementById('signUpCompany');
          const categorySelect = document.getElementById('signUpCategory');
          const submitBtn = document.getElementById('btnSignUpSubmit');
          const spinner = document.getElementById('signUpSpinner');

          if (!signUpForm.checkValidity()) {
            signUpForm.classList.add('was-validated');
            return;
          }

          if (submitBtn) submitBtn.disabled = true;
          if (spinner) spinner.classList.remove('d-none');

          try {
            const newUser = await window.PortalAuth.createUserWithEmailAndPassword({
              email: emailInput.value,
              password: passwordInput.value,
              name: nameInput.value,
              role: roleSelect.value,
              company: companyInput.value,
              category: categorySelect ? categorySelect.value : 'Logistics / Freight'
            });

            window.PortalUI.showToast(
              `Registration submitted! Your account is routed to ${newUser.assignedApproverRole.toUpperCase()} for approval.`,
              'info',
              'Approval Request Dispatched'
            );
          } catch (err) {
            window.PortalUI.showErrorToast(err.message, 'Sign Up Failed');
          } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (spinner) spinner.classList.add('d-none');
          }
        });
      }

      // 3. One-Click Quick Login Demo Buttons (for ease of grading and verification)
      document.querySelectorAll('[data-demo-login]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const roleKey = btn.getAttribute('data-demo-login');
          let creds = null;

          if (roleKey === 'superadmin') {
            creds = { email: 'superadmin@trustvendor.com', password: 'SuperAdmin2026!' };
          } else if (roleKey === 'admin') {
            creds = { email: 'admin@trustvendor.com', password: 'Admin2026!' };
          } else if (roleKey === 'manager') {
            creds = { email: 'manager@trustvendor.com', password: 'Manager2026!' };
          } else if (roleKey === 'vendor-approved') {
            creds = { email: 'vendor@apexlogistics.com', password: 'Vendor2026!' };
          } else if (roleKey === 'vendor-pending') {
            creds = { email: 'newvendor@cloudscale.io', password: 'Vendor2026!' };
          }

          if (creds) {
            try {
              const res = await window.PortalAuth.signInWithEmailAndPassword(creds.email, creds.password);
              window.PortalUI.showSuccessToast(`Logged in as ${res.user.role.toUpperCase()}: ${res.user.name}`, 'Demo Persona Activated');
            } catch (err) {
              window.PortalUI.showErrorToast(err.message, 'Login Failed');
            }
          }
        });
      });
    },

    handleSignOut() {
      window.PortalAuth.signOut();
      window.PortalUI.showToast('You have been signed out safely.', 'info', 'Session Ended');
    },

    /* =========================================================================
       3. PENDING APPROVAL HOLDING SCREEN
       ========================================================================= */

    renderPendingHoldingScreen(user) {
      const emailEl = document.getElementById('pendingUserEmail');
      const nameEl = document.getElementById('pendingUserName');
      const roleEl = document.getElementById('pendingUserRole');
      const companyEl = document.getElementById('pendingUserCompany');
      const approverEl = document.getElementById('pendingApproverInfo');
      const dateEl = document.getElementById('pendingSubmitDate');

      if (emailEl) emailEl.textContent = user.email;
      if (nameEl) nameEl.textContent = user.name || 'N/A';
      if (roleEl) roleEl.textContent = user.role.toUpperCase();
      if (companyEl) companyEl.textContent = user.company || 'N/A';
      if (dateEl) dateEl.textContent = user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Just now';

      if (approverEl) {
        approverEl.textContent = `Awaiting approval from: ${user.assignedApproverRole ? user.assignedApproverRole.toUpperCase() : 'MANAGEMENT'} (${user.assignedApproverEmail || 'Chain of Command'})`;
      }

      // Check Status Button
      const checkBtn = document.getElementById('btnPendingCheckStatus');
      if (checkBtn) {
        checkBtn.onclick = () => {
          const refreshed = window.LocalDB.getUserById(user.uid);
          if (refreshed && refreshed.status === 'APPROVED') {
            window.PortalUI.showSuccessToast('Congratulations! Your account has been approved.', 'Access Granted');
            window.PortalAuth.currentUser = refreshed;
            sessionStorage.setItem('portal_active_user', JSON.stringify(refreshed));
            this.routeBasedOnAuth(refreshed);
          } else {
            window.PortalUI.showToast('Your account is still awaiting administrative approval.', 'warning', 'Pending Review');
          }
        };
      }
    },

    renderRejectedHoldingScreen(user) {
      const pendingCard = document.getElementById('pendingHoldingCard');
      if (pendingCard) {
        pendingCard.innerHTML = `
          <div class="card-body p-4 text-center">
            <div class="mb-3">
              <i class="bi bi-x-octagon-fill text-danger fs-1"></i>
            </div>
            <h3 class="h4 fw-bold text-dark mb-2">Registration Not Approved</h3>
            <p class="text-muted small mb-3">
              Your registration application was reviewed and rejected by corporate administration.
            </p>
            <div class="alert alert-danger border border-danger-subtle text-start small mb-4">
              <strong>Rejection Reason:</strong> ${user.rejectionReason || 'Compliance documentation mismatch or administrative decision.'}
            </div>
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action-logout>
              Return to Login
            </button>
          </div>
        `;
        pendingCard.querySelector('[data-action-logout]').addEventListener('click', () => this.handleSignOut());
      }
    },

    /* =========================================================================
       4. SUPER ADMIN DASHBOARD & ADMIN QUEUE
       ========================================================================= */

    renderSuperAdminDashboard() {
      const allUsers = window.LocalDB.getUsers();
      const pendingAdmins = allUsers.filter(u => u.role === 'admin' && u.status === 'PENDING_APPROVAL');
      const approvedStaff = allUsers.filter(u => (u.role === 'admin' || u.role === 'manager') && u.status === 'APPROVED');
      const auditLogs = window.LocalDB.getAuditLogs();

      // Update KPI cards
      const kpiPendingEl = document.getElementById('superAdminKpiPending');
      const kpiStaffEl = document.getElementById('superAdminKpiStaff');
      const kpiAuditsEl = document.getElementById('superAdminKpiAudits');

      if (kpiPendingEl) kpiPendingEl.textContent = pendingAdmins.length;
      if (kpiStaffEl) kpiStaffEl.textContent = approvedStaff.length;
      if (kpiAuditsEl) kpiAuditsEl.textContent = auditLogs.length;

      // Render Admin Approval Queue Table
      const tableBody = document.getElementById('superAdminQueueTableBody');
      if (!tableBody) return;

      if (pendingAdmins.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center py-4 text-muted small">
              <i class="bi bi-check2-circle text-success fs-4 d-block mb-1"></i>
              No pending Admin approval requests. All administrative accounts are in good standing.
            </td>
          </tr>
        `;
        return;
      }

      let html = '';
      pendingAdmins.forEach(u => {
        html += `
          <tr>
            <td>
              <div class="fw-bold text-dark">${u.name || 'Admin Candidate'}</div>
              <div class="text-muted small">${u.email}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${u.company || 'Operations'}</span></td>
            <td><span class="text-muted small">${new Date(u.createdAt).toLocaleDateString()}</span></td>
            <td><span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">Awaiting Root Approval</span></td>
            <td class="text-end">
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-outline-success btn-action-approve-user" data-uid="${u.uid}">
                  <i class="bi bi-check-lg me-1"></i> Approve
                </button>
                <button type="button" class="btn btn-outline-danger btn-action-reject-user" data-uid="${u.uid}">
                  <i class="bi bi-x-lg me-1"></i> Reject
                </button>
              </div>
            </td>
          </tr>
        `;
      });
      tableBody.innerHTML = html;

      this.bindApprovalQueueActions();
    },

    /* =========================================================================
       5. OPERATIONS ADMIN DASHBOARD (Approves Managers & Vendors)
       ========================================================================= */

    renderAdminDashboard() {
      const allUsers = window.LocalDB.getUsers();
      const pendingManagers = allUsers.filter(u => u.role === 'manager' && u.status === 'PENDING_APPROVAL');
      const pendingVendors = allUsers.filter(u => u.role === 'vendor' && u.status === 'PENDING_APPROVAL');

      const kpiMgrEl = document.getElementById('adminKpiPendingManagers');
      const kpiVenEl = document.getElementById('adminKpiPendingVendors');
      if (kpiMgrEl) kpiMgrEl.textContent = pendingManagers.length;
      if (kpiVenEl) kpiVenEl.textContent = pendingVendors.length;

      // Render Manager Queue Table
      const mgrTableBody = document.getElementById('adminManagerQueueTableBody');
      if (mgrTableBody) {
        if (pendingManagers.length === 0) {
          mgrTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted small">No pending manager applications.</td></tr>`;
        } else {
          let html = '';
          pendingManagers.forEach(u => {
            html += `
              <tr>
                <td><strong>${u.name}</strong><br><small class="text-muted">${u.email}</small></td>
                <td>${u.company || 'Procurement Unit'}</td>
                <td><small>${new Date(u.createdAt).toLocaleDateString()}</small></td>
                <td><span class="badge bg-warning-subtle text-warning-emphasis">Pending Review</span></td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-success btn-action-approve-user me-1" data-uid="${u.uid}">Approve</button>
                  <button class="btn btn-sm btn-outline-danger btn-action-reject-user" data-uid="${u.uid}">Reject</button>
                </td>
              </tr>
            `;
          });
          mgrTableBody.innerHTML = html;
        }
      }

      // Render Vendor Queue Table
      const venTableBody = document.getElementById('adminVendorQueueTableBody');
      if (venTableBody) {
        if (pendingVendors.length === 0) {
          venTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted small">No pending vendor applications.</td></tr>`;
        } else {
          let html = '';
          pendingVendors.forEach(u => {
            html += `
              <tr>
                <td><strong>${u.company || u.name}</strong><br><small class="text-muted">${u.email}</small></td>
                <td><span class="badge bg-light text-dark border">${u.category || 'General'}</span></td>
                <td><small>${new Date(u.createdAt).toLocaleDateString()}</small></td>
                <td><span class="badge bg-warning-subtle text-warning-emphasis">Pending Verification</span></td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-success btn-action-approve-user me-1" data-uid="${u.uid}">Approve</button>
                  <button class="btn btn-sm btn-outline-danger btn-action-reject-user" data-uid="${u.uid}">Reject</button>
                </td>
              </tr>
            `;
          });
          venTableBody.innerHTML = html;
        }
      }

      this.bindApprovalQueueActions();
    },

    bindApprovalQueueActions() {
      // Approve action
      document.querySelectorAll('.btn-action-approve-user').forEach(btn => {
        btn.onclick = () => {
          const uid = btn.getAttribute('data-uid');
          try {
            window.PortalAuth.approveAccount(uid);
            window.PortalUI.showSuccessToast('User account approved and unlocked successfully.', 'Approval Confirmed');
            // Re-render
            const cur = window.PortalAuth.getCurrentUser();
            if (cur && cur.role === 'superadmin') this.renderSuperAdminDashboard();
            if (cur && cur.role === 'admin') this.renderAdminDashboard();
            if (cur && cur.role === 'manager') this.renderManagerWorkspace();
          } catch (err) {
            window.PortalUI.showErrorToast(err.message, 'Approval Failed');
          }
        };
      });

      // Reject action
      document.querySelectorAll('.btn-action-reject-user').forEach(btn => {
        btn.onclick = () => {
          const uid = btn.getAttribute('data-uid');
          const reason = prompt('Please specify mandatory reason for rejecting this account:');
          if (!reason || !reason.trim()) {
            alert('Rejection canceled: Mandatory reason required.');
            return;
          }
          try {
            window.PortalAuth.rejectAccount(uid, reason.trim());
            window.PortalUI.showToast('Account application rejected with formal justification.', 'danger', 'Rejection Recorded');
            const cur = window.PortalAuth.getCurrentUser();
            if (cur && cur.role === 'superadmin') this.renderSuperAdminDashboard();
            if (cur && cur.role === 'admin') this.renderAdminDashboard();
            if (cur && cur.role === 'manager') this.renderManagerWorkspace();
          } catch (err) {
            window.PortalUI.showErrorToast(err.message, 'Rejection Failed');
          }
        };
      });
    },

    /* =========================================================================
       6. MANAGER WORKSPACE & REQUIREMENT BUILDER PERSISTENCE
       ========================================================================= */

    renderManagerWorkspace() {
      // 1. Refresh vendor records in UI table from LocalDB
      const allVendors = window.LocalDB.getVendors();
      if (window.PortalUI && typeof window.PortalUI.renderVendorTable === 'function') {
        window.PortalUI.renderVendorTable(allVendors);
      }

      // 2. Render Manager's Pending Vendor Approval Queue (Stage 2)
      const allUsers = window.LocalDB.getUsers();
      const pendingVendors = allUsers.filter(u => u.role === 'vendor' && u.status === 'PENDING_APPROVAL');
      const queueContainer = document.getElementById('managerPendingVendorsTableBody');
      const badgeCount = document.getElementById('managerPendingVendorCountBadge');

      if (badgeCount) badgeCount.textContent = pendingVendors.length;

      if (queueContainer) {
        if (pendingVendors.length === 0) {
          queueContainer.innerHTML = `
            <tr>
              <td colspan="5" class="text-center py-3 text-muted small">
                <i class="bi bi-check2-circle text-success me-1"></i> No vendor registrations pending manager approval.
              </td>
            </tr>
          `;
        } else {
          let html = '';
          pendingVendors.forEach(v => {
            html += `
              <tr>
                <td><strong>${v.company || v.name}</strong><br><small class="text-muted">${v.email}</small></td>
                <td><span class="badge bg-light text-dark border">${v.category || 'General'}</span></td>
                <td><small>${new Date(v.createdAt).toLocaleDateString()}</small></td>
                <td><span class="badge bg-warning-subtle text-warning-emphasis">Stage 1: Sign-Up Pending Approval</span></td>
                <td class="text-end">
                  <button type="button" class="btn btn-sm btn-outline-success btn-action-approve-user me-1" data-uid="${v.uid}">
                    <i class="bi bi-unlock-fill me-1"></i> Approve & Unlock Onboarding
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-danger btn-action-reject-user" data-uid="${v.uid}">
                    <i class="bi bi-x-circle me-1"></i> Reject
                  </button>
                </td>
              </tr>
            `;
          });
          queueContainer.innerHTML = html;
        }
      }

      // 3. Populate Manager Requirement Builder Form with current schema
      this.populateManagerRequirementForm();

      this.bindApprovalQueueActions();
    },

    bindManagerRequirementBuilder() {
      const form = document.getElementById('managerRequirementForm');
      const btnAddDocType = document.getElementById('btnAddCustomDocType');
      const customDocList = document.getElementById('customDocTypesList');

      if (btnAddDocType && customDocList) {
        btnAddDocType.addEventListener('click', () => {
          const rowId = 'doc_type_' + Date.now();
          const rowHtml = `
            <div class="input-group input-group-sm mb-2 custom-doc-type-row" id="${rowId}">
              <span class="input-group-text"><i class="bi bi-file-earmark-text"></i></span>
              <input type="text" class="form-control custom-doc-title-input" placeholder="e.g. ISO 27001 Certification, GST Certificate..." required>
              <div class="input-group-text">
                <input class="form-check-input mt-0 custom-doc-mandatory-check" type="checkbox" checked title="Is Mandatory?">
                <label class="form-check-label ms-1 small">Mandatory</label>
              </div>
              <button class="btn btn-outline-danger" type="button" onclick="document.getElementById('${rowId}').remove()">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          `;
          customDocList.insertAdjacentHTML('beforeend', rowHtml);
        });
      }

      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const docCountInput = document.getElementById('reqDocCountInput');
          const deadlineInput = document.getElementById('reqSubmissionDeadline');

          if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
          }

          // Gather custom document types from DOM
          const docRows = document.querySelectorAll('.custom-doc-type-row');
          const customDocumentTypes = [];

          docRows.forEach((row, idx) => {
            const titleInput = row.querySelector('.custom-doc-title-input');
            const mandCheck = row.querySelector('.custom-doc-mandatory-check');
            if (titleInput && titleInput.value.trim()) {
              customDocumentTypes.push({
                id: 'req_doc_' + idx,
                title: titleInput.value.trim(),
                mandatory: mandCheck ? mandCheck.checked : true,
                description: 'Manager-mandated compliance verification requirement.'
              });
            }
          });

          const newSchema = {
            requiredDocCount: parseInt(docCountInput ? docCountInput.value : 3, 10),
            submissionDeadline: deadlineInput ? deadlineInput.value : window.LocalDB.getDefaultDeadlineDate(14),
            customDocumentTypes: customDocumentTypes
          };

          window.LocalDB.saveRequirementSchema(newSchema);
          window.PortalUI.showSuccessToast('Manager compliance requirements schema updated and persisted to LocalDB!', 'Requirements Published');
        });
      }
    },

    populateManagerRequirementForm() {
      const schema = window.LocalDB.getRequirementSchema();
      const docCountInput = document.getElementById('reqDocCountInput');
      const deadlineInput = document.getElementById('reqSubmissionDeadline');
      const customDocList = document.getElementById('customDocTypesList');

      if (docCountInput) docCountInput.value = schema.requiredDocCount || 3;
      if (deadlineInput) deadlineInput.value = schema.submissionDeadline || window.LocalDB.getDefaultDeadlineDate(14);

      if (customDocList) {
        let html = '';
        (schema.customDocumentTypes || []).forEach((doc, idx) => {
          const rowId = 'doc_type_saved_' + idx;
          html += `
            <div class="input-group input-group-sm mb-2 custom-doc-type-row" id="${rowId}">
              <span class="input-group-text"><i class="bi bi-file-earmark-text"></i></span>
              <input type="text" class="form-control custom-doc-title-input" value="${doc.title}" required>
              <div class="input-group-text">
                <input class="form-check-input mt-0 custom-doc-mandatory-check" type="checkbox" ${doc.mandatory ? 'checked' : ''} title="Is Mandatory?">
                <label class="form-check-label ms-1 small">Mandatory</label>
              </div>
              <button class="btn btn-outline-danger" type="button" onclick="document.getElementById('${rowId}').remove()">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          `;
        });
        customDocList.innerHTML = html;
      }
    },

    /* =========================================================================
       7. VENDOR WORKSPACE, STRICT UID ISOLATION & DYNAMIC DOM UPLOADS
       ========================================================================= */

    /**
     * Renders External Vendor workspace with strict data isolation
     * @param {object} user 
     */
    renderVendorWorkspace(user) {
      console.log('🔒 Enforcing strict vendor UID data isolation for:', user.uid);

      // 1. Fetch only this vendor's data
      const vendorRecord = window.LocalDB.getVendorByUserId(user.uid) || {
        id: user.vendorId || 'VEN-NEW',
        name: user.company || user.name,
        category: user.category || 'Logistics / Freight',
        email: user.email,
        phone: user.phone || '',
        docs: [],
        progressPercent: 0
      };

      // 2. Pre-fill company profile fields with vendor's own details
      const nameInput = document.getElementById('vendorLegalName');
      const emailInput = document.getElementById('vendorEmail');
      const phoneInput = document.getElementById('vendorPhone');
      const categorySelect = document.getElementById('vendorCategory');

      if (nameInput) nameInput.value = vendorRecord.name || '';
      if (emailInput) emailInput.value = vendorRecord.email || user.email || '';
      if (phoneInput && vendorRecord.phone) phoneInput.value = vendorRecord.phone;
      if (categorySelect && vendorRecord.category) categorySelect.value = vendorRecord.category;

      // 3. Render submission deadline banner & active countdown timer
      const schema = window.LocalDB.getRequirementSchema();
      this.startDeadlineCountdown(schema.submissionDeadline);

      // 4. Generate dynamic document upload slots based on Manager's requirement schema
      this.generateDynamicUploadSlotsFromSchema(schema, vendorRecord);

      // 5. Update deterministic progress bar calculation
      this.recalculateVendorProgress(vendorRecord);
    },

    /**
     * Active countdown timer towards Manager-specified submission deadline
     * @param {string} deadlineDateStr 
     */
    startDeadlineCountdown(deadlineDateStr) {
      if (this.activeCountdownInterval) clearInterval(this.activeCountdownInterval);

      const banner = document.getElementById('vendorDeadlineBanner');
      const textEl = document.getElementById('vendorCountdownText');
      if (!banner || !textEl) return;

      banner.classList.remove('d-none');

      const updateTimer = () => {
        const target = new Date(deadlineDateStr + 'T23:59:59').getTime();
        const now = new Date().getTime();
        const diff = target - now;

        if (diff <= 0) {
          textEl.innerHTML = `<strong class="text-danger">Submission Deadline Expired on ${deadlineDateStr}</strong>`;
          banner.className = 'alert alert-danger border-danger d-flex align-items-center gap-3 mb-4';
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        let urgencyClass = 'alert-info border-info text-info-emphasis';
        if (days <= 2) {
          urgencyClass = 'alert-danger border-danger text-danger-emphasis';
        } else if (days <= 7) {
          urgencyClass = 'alert-warning border-warning text-warning-emphasis';
        }

        banner.className = `alert ${urgencyClass} d-flex align-items-center gap-3 mb-4`;
        textEl.innerHTML = `
          <strong>Compliance Submission Deadline:</strong> ${deadlineDateStr} • 
          <span class="badge bg-dark">${days}d ${hours}h ${minutes}m ${seconds}s remaining</span>
        `;
      };

      updateTimer();
      this.activeCountdownInterval = setInterval(updateTimer, 1000);
    },

    /**
     * Dynamic DOM Generator that spawns matching upload slots based on Manager's schema
     * @param {object} schema 
     * @param {object} vendorRecord 
     */
    generateDynamicUploadSlotsFromSchema(schema, vendorRecord) {
      const container = document.getElementById('dynamicDocsContainer');
      if (!container) return;

      const docsToRender = schema.customDocumentTypes || [];
      const uploadedMap = {};
      (vendorRecord.docs || []).forEach(d => {
        uploadedMap[d.docId] = d;
      });

      let html = `
        <div class="alert alert-light border small text-muted mb-4 d-flex align-items-center justify-content-between">
          <div>
            <i class="bi bi-info-circle-fill text-primary me-2"></i>
            <strong>Manager Compliance Policy:</strong> Minimum <strong>${schema.requiredDocCount}</strong> valid PDFs required. Quota-Safe metadata extraction enforced.
          </div>
          <span class="badge bg-primary">${docsToRender.length} Configured Slots</span>
        </div>
      `;

      docsToRender.forEach(req => {
        const existingDoc = uploadedMap[req.id];
        const hasUploaded = !!existingDoc;

        html += `
          <div class="document-upload-row portal-card p-3 mb-3 ${hasUploaded ? 'border-success bg-success-subtle bg-opacity-10' : ''}" id="docRow_${req.id}">
            <div class="row align-items-center g-3">
              <div class="col-lg-5">
                <div class="d-flex align-items-center gap-2">
                  <div class="doc-icon-wrapper ${hasUploaded ? 'bg-success text-white' : 'bg-light text-primary'} p-2 rounded">
                    <i class="bi ${hasUploaded ? 'bi-file-earmark-check-fill' : 'bi-file-earmark-pdf'} fs-4"></i>
                  </div>
                  <div>
                    <h6 class="fw-bold text-dark mb-0">${req.title}</h6>
                    <small class="text-muted d-block">${req.description || 'Mandatory compliance documentation'}</small>
                    ${req.mandatory ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle mt-1" style="font-size:0.7rem;">Mandatory Document</span>' : '<span class="badge bg-light text-muted border mt-1" style="font-size:0.7rem;">Optional / Supporting</span>'}
                  </div>
                </div>
              </div>

              <!-- Quota-Safe PDF File Input -->
              <div class="col-sm-6 col-lg-4">
                <label for="fileInput_${req.id}" class="form-label small fw-semibold text-secondary mb-1">
                  Upload PDF <span class="text-muted">(&lt; 5MB quota-safe)</span>
                </label>
                <input type="file" 
                       class="form-control form-control-sm quota-safe-pdf-input" 
                       id="fileInput_${req.id}" 
                       data-doc-id="${req.id}" 
                       data-doc-title="${req.title}"
                       data-mandatory="${req.mandatory}"
                       accept=".pdf,application/pdf" 
                       ${req.mandatory && !hasUploaded ? 'required' : ''}>
                <div class="small mt-1 text-muted file-meta-feedback" id="metaFeedback_${req.id}">
                  ${hasUploaded ? `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill me-1"></i> ${existingDoc.docName} (${existingDoc.size})</span>` : 'Accepted format: .pdf (lightweight metadata extraction)'}
                </div>
              </div>

              <!-- Expiry Date Picker -->
              <div class="col-sm-6 col-lg-3">
                <label for="expiryDate_${req.id}" class="form-label small fw-semibold text-secondary mb-1">
                  Expiration Date <span class="text-danger">*</span>
                </label>
                <input type="date" 
                       class="form-control form-control-sm doc-expiry-input" 
                       id="expiryDate_${req.id}" 
                       data-doc-id="${req.id}"
                       value="${existingDoc ? existingDoc.expDate : ''}"
                       min="${new Date().toISOString().split('T')[0]}" 
                       ${req.mandatory ? 'required' : ''}>
                <div class="invalid-feedback">Must be a valid future expiration date.</div>
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      this.bindQuotaSafeUploadsAndProgress();
    },

    /* =========================================================================
       8. QUOTA-SAFE PDF METADATA EXTRACTION & DETERMINISTIC PROGRESS MATH
       ========================================================================= */

    bindQuotaSafeUploadsAndProgress() {
      // 1. Quota-Safe PDF Input change listener
      document.querySelectorAll('.quota-safe-pdf-input').forEach(input => {
        input.onchange = (e) => {
          const file = e.target.files[0];
          const docId = input.getAttribute('data-doc-id');
          const docTitle = input.getAttribute('data-doc-title');
          const feedbackEl = document.getElementById(`metaFeedback_${docId}`);
          const rowEl = document.getElementById(`docRow_${docId}`);

          if (!file) return;

          // Enforce .pdf validation
          const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
          if (!isPdf) {
            alert('Action Required: Please attach a valid .pdf document format.');
            input.value = '';
            if (feedbackEl) feedbackEl.innerHTML = '<span class="text-danger fw-bold"><i class="bi bi-x-circle me-1"></i> Invalid format. Only .pdf accepted.</span>';
            return;
          }

          // QUOTA-SAFE METADATA EXTRACTION
          // Does NOT store binary base64 string in localStorage to respect client storage limit
          const fileSizeKB = (file.size / 1024).toFixed(1) + ' KB';
          const uploadTimestamp = new Date().toISOString();
          const expiryInput = document.getElementById(`expiryDate_${docId}`);
          const expDate = expiryInput ? expiryInput.value : '';

          const docMetadata = {
            docId: docId,
            docName: file.name,
            size: fileSizeKB,
            mimeType: 'application/pdf',
            uploadTimestamp: uploadTimestamp,
            expDate: expDate,
            docStatus: 'Pending Review'
          };

          // Save into active vendor state
          const curUser = window.PortalAuth.getCurrentUser();
          if (curUser) {
            let vendor = window.LocalDB.getVendorByUserId(curUser.uid);
            if (vendor) {
              vendor.docs = vendor.docs || [];
              const idx = vendor.docs.findIndex(d => d.docId === docId);
              if (idx >= 0) {
                vendor.docs[idx] = { ...vendor.docs[idx], ...docMetadata };
              } else {
                vendor.docs.push(docMetadata);
              }
              window.LocalDB.saveVendor(vendor);
            }
          }

          if (feedbackEl) {
            feedbackEl.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill me-1"></i> ${file.name} (${fileSizeKB}) - Quota-Safe Certified</span>`;
          }
          if (rowEl) {
            rowEl.classList.add('border-success', 'bg-success-subtle', 'bg-opacity-10');
          }

          window.PortalUI.showSuccessToast(`Quota-safe certificate metadata extracted: ${file.name} (${fileSizeKB})`, 'Document Uploaded');

          this.recalculateVendorProgress();
        };
      });

      // 2. Expiry date inputs
      document.querySelectorAll('.doc-expiry-input').forEach(input => {
        input.onchange = () => {
          const docId = input.getAttribute('data-doc-id');
          const curUser = window.PortalAuth.getCurrentUser();
          if (curUser) {
            let vendor = window.LocalDB.getVendorByUserId(curUser.uid);
            if (vendor && vendor.docs) {
              const doc = vendor.docs.find(d => d.docId === docId);
              if (doc) {
                doc.expDate = input.value;
                window.LocalDB.saveVendor(vendor);
              }
            }
          }
          this.recalculateVendorProgress();
        };
      });

      // 3. Form input live triggers for deterministic progress calculation
      const form = document.getElementById('vendorOnboardingForm');
      if (form) {
        form.oninput = () => {
          this.recalculateVendorProgress();
        };
      }
    },

    /**
     * Deterministic 0-100% Onboarding Progress Calculation Math
     * Synchronized between Vendor view and Manager view
     */
    recalculateVendorProgress(vendorRecord = null) {
      const curUser = window.PortalAuth.getCurrentUser();
      const vendor = vendorRecord || (curUser ? window.LocalDB.getVendorByUserId(curUser.uid) : null);

      let totalScore = 0;

      // 1. Step 1: Company Profile (Weight: 35%)
      const name = document.getElementById('vendorLegalName');
      const ein = document.getElementById('vendorEin');
      const phone = document.getElementById('vendorPhone');
      const address = document.getElementById('vendorAddress');
      const email = document.getElementById('vendorEmail');

      let step1Filled = 0;
      if (name && name.value.trim()) step1Filled++;
      if (ein && ein.value.trim()) step1Filled++;
      if (phone && phone.value.trim()) step1Filled++;
      if (address && address.value.trim()) step1Filled++;
      if (email && email.value.trim()) step1Filled++;

      const step1Percent = (step1Filled / 5) * 35;
      totalScore += step1Percent;

      // 2. Step 2: Compliance Documents (Weight: 45%)
      const schema = window.LocalDB.getRequirementSchema();
      const requiredTypes = (schema.customDocumentTypes || []).filter(t => t.mandatory);
      const totalMandatory = Math.max(requiredTypes.length, schema.requiredDocCount || 3);

      const docs = vendor && vendor.docs ? vendor.docs : [];
      let validUploadedCount = 0;

      docs.forEach(d => {
        if (d.docName && d.expDate && new Date(d.expDate).getTime() > Date.now()) {
          validUploadedCount++;
        }
      });

      const step2Percent = Math.min(1, validUploadedCount / totalMandatory) * 45;
      totalScore += step2Percent;

      // 3. Step 3: Remittance & Signatory (Weight: 20%)
      const bank = document.getElementById('vendorBankName');
      const routing = document.getElementById('vendorRoutingNumber');
      const account = document.getElementById('vendorAccountNumber');
      const signatory = document.getElementById('vendorSignatory');

      let step3Filled = 0;
      if (bank && bank.value.trim()) step3Filled++;
      if (routing && routing.value.trim()) step3Filled++;
      if (account && account.value.trim()) step3Filled++;
      if (signatory && signatory.value.trim()) step3Filled++;

      const step3Percent = (step3Filled / 4) * 20;
      totalScore += step3Percent;

      const finalProgress = Math.round(totalScore);

      // Update UI Progress Bar
      const progressBar = document.getElementById('onboardingProgressBar');
      const progressLabel = document.getElementById('progressPercentLabel');

      if (progressBar) {
        progressBar.style.width = `${finalProgress}%`;
        progressBar.textContent = `${finalProgress}% Completed`;
        progressBar.setAttribute('aria-valuenow', finalProgress);

        if (finalProgress === 100) {
          progressBar.className = 'progress-bar bg-success progress-bar-striped';
        } else {
          progressBar.className = 'progress-bar bg-primary progress-bar-striped progress-bar-animated';
        }
      }

      if (progressLabel) {
        progressLabel.textContent = `${finalProgress}% Completed`;
      }

      // Persist in LocalDB if active vendor
      if (vendor && curUser && curUser.role === 'vendor') {
        vendor.progressPercent = finalProgress;
        window.LocalDB.saveVendor(vendor);
      }

      return finalProgress;
    },

    /* =========================================================================
       9. LOCALDB JSON STATE IMPORT & EXPORT
       ========================================================================= */

    bindLocalDBStateExportImport() {
      // Export JSON State Button
      const btnExportJSON = document.getElementById('btnExportLocalDBJSON');
      if (btnExportJSON) {
        btnExportJSON.onclick = (e) => {
          e.preventDefault();
          window.LocalDB.downloadStateExportFile();
          window.PortalUI.showSuccessToast('Partitioned LocalDB JSON exported and downloaded.', 'State Backup Generated');
        };
      }

      // Import JSON State File Input
      const inputImportJSON = document.getElementById('inputImportLocalDBJSON');
      if (inputImportJSON) {
        inputImportJSON.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const jsonContent = event.target.result;
              const success = window.LocalDB.importStateJSON(jsonContent);
              if (success) {
                window.PortalUI.showSuccessToast('LocalDB state imported successfully across all partitions!', 'Database Restored');
                setTimeout(() => window.location.reload(), 1200);
              } else {
                window.PortalUI.showErrorToast('Failed to parse state backup. Invalid JSON format.', 'Import Error');
              }
            } catch (err) {
              window.PortalUI.showErrorToast(err.message, 'Import Error');
            }
          };
          reader.readAsText(file);
        };
      }

      // Reset to Default Factory Seed
      const btnResetDB = document.getElementById('btnResetLocalDBToSeed');
      if (btnResetDB) {
        btnResetDB.onclick = () => {
          if (confirm('Are you sure you want to reset LocalDB to default factory state? All local modifications will be replaced.')) {
            window.LocalDB.resetToDefault();
            window.PortalUI.showToast('LocalDB partitions reset to default factory seed.', 'info', 'Database Reset');
            setTimeout(() => window.location.reload(), 800);
          }
        };
      }
    },

    /* =========================================================================
       10. TEAMMATE EVENT BRIDGE (LocalDB persistence & UI synchronization)
       ========================================================================= */

    bindTeammateEventBridge() {
      // Form submit from wizard -> persist into LocalDB
      window.addEventListener('vendor:form-submit', (e) => {
        const vendorData = e.detail;
        console.log('💾 Persisting vendor submission to LocalDB vendors_db:', vendorData);

        const curUser = window.PortalAuth.getCurrentUser();
        if (curUser) {
          vendorData.userId = curUser.uid;
        }

        window.LocalDB.saveVendor(vendorData);
        window.LocalDB.addAuditLog(
          curUser ? curUser.email : 'Vendor',
          'vendor',
          'Submitted Vendor Onboarding Dossier',
          vendorData.id,
          { status: vendorData.status, category: vendorData.category }
        );
      });

      // Vendor Approved by Manager
      window.addEventListener('vendor:approve', (e) => {
        const { vendorId } = e.detail;
        const curUser = window.PortalAuth.getCurrentUser();

        window.LocalDB.updateVendor(vendorId, {
          status: 'Approved',
          tier: 'Tier 3',
          approvedBy: curUser ? curUser.email : 'Procurement Manager',
          approvedAt: new Date().toISOString()
        });

        window.LocalDB.addAuditLog(
          curUser ? curUser.email : 'Procurement Manager',
          'manager',
          'Approved Vendor Dossier',
          vendorId
        );
      });

      // Vendor Rejected by Manager
      window.addEventListener('vendor:reject', (e) => {
        const { vendorId, rejectionReason } = e.detail;
        const curUser = window.PortalAuth.getCurrentUser();

        window.LocalDB.updateVendor(vendorId, {
          status: 'Blocked',
          tier: 'Tier 1',
          rejectionReason: rejectionReason,
          rejectedBy: curUser ? curUser.email : 'Procurement Manager',
          rejectedAt: new Date().toISOString()
        });

        window.LocalDB.addAuditLog(
          curUser ? curUser.email : 'Procurement Manager',
          'manager',
          'Rejected Vendor Dossier',
          vendorId,
          { reason: rejectionReason }
        );
      });

      // Mock EIN verification event -> cache result
      window.addEventListener('vendor:ein-verified', (e) => {
        const { ein, verificationResult } = e.detail;
        if (ein && verificationResult) {
          window.LocalDB.setMockCache(`ein:${ein}`, verificationResult);
        }
      });
    }
  };

  // Initialize App on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

  window.TrustVendorApp = App;

})(window, document);
