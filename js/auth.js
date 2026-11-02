/**
 * Hybrid Authentication Controller & 4-Tier Chain of Command Service
 * Author: Abhinaba Das (Backend Logic, State & Firebase Lead)
 * Project: B2B Vendor Onboarding & Compliance Portal (PST_PD_116)
 * 
 * Features:
 * 1. Hybrid Firebase Auth adapter (signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut)
 * 2. Hard-coded Super Admin credential interceptor (superadmin@trustvendor.com / SuperAdmin2026!)
 * 3. Hierarchical Approval Routing (Vendor -> Manager -> Admin -> Super Admin)
 * 4. Account Pending Approval state handling
 * 5. RBAC Session Guards & Access Control
 */

(function (window) {
  'use strict';

  const SESSION_USER_KEY = 'portal_active_user';
  const HARDCODED_SUPER_ADMIN = {
    email: 'superadmin@trustvendor.com',
    password: 'SuperAdmin2026!',
    role: 'superadmin',
    name: 'Global Enterprise Root Super Admin',
    company: 'TrustVendor Global Corp'
  };

  class HybridAuthController {
    constructor() {
      this.currentUser = null;
      this.authListeners = [];
      this.initSession();
    }

    /**
     * Restores active authenticated session from sessionStorage
     */
    initSession() {
      try {
        const stored = sessionStorage.getItem(SESSION_USER_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          // Verify with LocalDB to get latest approval status
          const dbUser = window.LocalDB.getUserById(user.uid) || window.LocalDB.getUserByEmail(user.email);
          this.currentUser = dbUser || user;
          sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(this.currentUser));
        }
      } catch (err) {
        console.warn('Failed to restore auth session:', err);
        sessionStorage.removeItem(SESSION_USER_KEY);
        this.currentUser = null;
      }
    }

    /**
     * Subscribes to auth state changes
     * @param {function} callback 
     */
    onAuthStateChanged(callback) {
      if (typeof callback === 'function') {
        this.authListeners.push(callback);
        // Call immediately with current state
        callback(this.currentUser);
      }
      return () => {
        this.authListeners = this.authListeners.filter(cb => cb !== callback);
      };
    }

    notifyAuthListeners() {
      this.authListeners.forEach(cb => {
        try {
          cb(this.currentUser);
        } catch (e) {
          console.error('Error in auth state listener:', e);
        }
      });
    }

    getCurrentUser() {
      return this.currentUser;
    }

    isAuthenticated() {
      return !!this.currentUser;
    }

    isApproved() {
      return this.currentUser && this.currentUser.status === 'APPROVED';
    }

    /* =========================================================================
       1. HYBRID SIGN-IN WITH HARD-CODED SUPER ADMIN CREDENTIAL INTERCEPTOR
       ========================================================================= */

    /**
     * Signs in user with Email and Password
     * Includes Hard-Coded Super Admin Credential Interceptor
     * Runs completely offline via partitioned LocalDB identity engine
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<{ user: object, requiresApproval: boolean }>}
     */
    async signInWithEmailAndPassword(email, password) {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim();

      if (!cleanEmail || !cleanPassword) {
        throw new Error('Email address and password are required.');
      }

      // 1. HARD-CODED SUPER ADMIN CREDENTIAL INTERCEPTOR
      if (cleanEmail === HARDCODED_SUPER_ADMIN.email.toLowerCase()) {
        if (cleanPassword === HARDCODED_SUPER_ADMIN.password) {
          console.log('⚡ Hard-Coded Super Admin Credential Interceptor Activated.');
          const superAdminUser = {
            uid: 'usr_superadmin_01',
            email: HARDCODED_SUPER_ADMIN.email,
            name: HARDCODED_SUPER_ADMIN.name,
            role: 'superadmin',
            status: 'APPROVED',
            company: HARDCODED_SUPER_ADMIN.company,
            lastLogin: new Date().toISOString()
          };

          window.LocalDB.saveUser(superAdminUser);
          window.LocalDB.addAuditLog(superAdminUser.email, 'superadmin', 'Super Admin Authenticated via Interceptor', superAdminUser.uid);

          this.currentUser = superAdminUser;
          sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(superAdminUser));
          sessionStorage.setItem('portal_user_role', 'superadmin');
          this.notifyAuthListeners();

          return { user: superAdminUser, requiresApproval: false };
        } else {
          throw new Error('Invalid credentials for Super Admin account.');
        }
      }

      // 2. Offline Firebase Identity Store lookup (partitioned LocalDB)
      const existingUser = window.LocalDB.getUserByEmail(cleanEmail);

      if (!existingUser) {
        throw new Error('No registered account found with this email address. Please sign up first.');
      }

      if (existingUser.password && existingUser.password !== cleanPassword) {
        throw new Error('Invalid password. Please check your credentials and try again.');
      }

      // User exists and password matches
      existingUser.lastLogin = new Date().toISOString();
      window.LocalDB.updateUser(existingUser.uid, { lastLogin: existingUser.lastLogin });

      this.currentUser = existingUser;
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(existingUser));
      sessionStorage.setItem('portal_user_role', existingUser.role);

      window.LocalDB.addAuditLog(existingUser.email, existingUser.role, 'User Signed In', existingUser.uid, {
        status: existingUser.status
      });

      this.notifyAuthListeners();

      const requiresApproval = existingUser.status === 'PENDING_APPROVAL';
      return { user: existingUser, requiresApproval: requiresApproval };
    }

    /* =========================================================================
       2. SIGN-UP WITH HIERARCHICAL APPROVAL ROUTING
       ========================================================================= */

    /**
     * Registers a new account with Hierarchical Approval Routing
     * Hierarchy Chain:
     * - Admin -> routed to Super Admin
     * - Manager -> routed to Admin (fallback to Super Admin)
     * - Vendor -> routed to Manager (fallback to Admin / Super Admin)
     * 
     * @param {object} param0 { email, password, name, role, company, dba, category, phone }
     * @returns {Promise<object>} New user record with PENDING_APPROVAL status
     */
    async createUserWithEmailAndPassword({ email, password, name, role, company, dba = '', category = 'Logistics / Freight', phone = '' }) {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim();

      if (!cleanEmail || !cleanPassword) {
        throw new Error('Email and password are required for registration.');
      }
      if (cleanPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }
      if (!role) {
        throw new Error('User role is required (admin, manager, or vendor).');
      }

      // Prevent duplicate registrations
      const existing = window.LocalDB.getUserByEmail(cleanEmail);
      if (existing) {
        throw new Error('An account with this email address already exists. Please sign in.');
      }

      // Block registering as superadmin directly
      if (role === 'superadmin') {
        throw new Error('Super Admin accounts are pre-set and cannot be registered via public signup.');
      }

      // HIERARCHICAL APPROVAL ROUTING
      const routing = this.resolveApprovalRouting(role);
      const newUid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

      const newUser = {
        uid: newUid,
        email: cleanEmail,
        password: cleanPassword,
        name: name || cleanEmail.split('@')[0],
        role: role, // 'admin' | 'manager' | 'vendor'
        status: 'PENDING_APPROVAL', // Stage 1 Flag
        company: company || 'Independent Organization',
        dba: dba,
        category: category,
        phone: phone,
        assignedApproverRole: routing.approverRole,
        assignedApproverEmail: routing.approverEmail,
        createdAt: new Date().toISOString()
      };

      // If user is a vendor, initialize matching vendor dossier stub in vendors_db
      if (role === 'vendor') {
        const newVendorId = `VEN-${Math.floor(1000 + Math.random() * 9000)}`;
        newUser.vendorId = newVendorId;

        const vendorRecord = {
          id: newVendorId,
          userId: newUid,
          name: company || newUser.name,
          dba: dba || company,
          category: category,
          ein: '',
          email: cleanEmail,
          phone: phone,
          address: '',
          status: 'Pending Approval', // Awaiting manager approval to unlock onboarding
          tier: 'Tier 2',
          assignedManager: routing.approverEmail,
          submissionDate: new Date().toISOString(),
          progressPercent: 0,
          docs: []
        };
        window.LocalDB.saveVendor(vendorRecord);
      }

      window.LocalDB.saveUser(newUser);

      window.LocalDB.addAuditLog(
        newUser.email,
        newUser.role,
        `Account Registered (Routed to ${routing.approverRole.toUpperCase()} for approval)`,
        newUid,
        { approver: routing.approverEmail }
      );

      this.currentUser = newUser;
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(newUser));
      sessionStorage.setItem('portal_user_role', newUser.role);
      this.notifyAuthListeners();

      return newUser;
    }

    /**
     * Resolves the hierarchical approval routing target
     * @param {'admin'|'manager'|'vendor'} role 
     * @returns {{ approverRole: string, approverEmail: string }}
     */
    resolveApprovalRouting(role) {
      const allUsers = window.LocalDB.getUsers();

      if (role === 'admin') {
        // Admins always route to Super Admin
        return {
          approverRole: 'superadmin',
          approverEmail: HARDCODED_SUPER_ADMIN.email
        };
      }

      if (role === 'manager') {
        // Managers route to active Admin, or Super Admin fallback
        const activeAdmin = allUsers.find(u => u.role === 'admin' && u.status === 'APPROVED');
        return {
          approverRole: activeAdmin ? 'admin' : 'superadmin',
          approverEmail: activeAdmin ? activeAdmin.email : HARDCODED_SUPER_ADMIN.email
        };
      }

      if (role === 'vendor') {
        // Vendors route to active Manager, or Admin / Super Admin fallback
        const activeManager = allUsers.find(u => u.role === 'manager' && u.status === 'APPROVED');
        if (activeManager) {
          return { approverRole: 'manager', approverEmail: activeManager.email };
        }
        const activeAdmin = allUsers.find(u => u.role === 'admin' && u.status === 'APPROVED');
        if (activeAdmin) {
          return { approverRole: 'admin', approverEmail: activeAdmin.email };
        }
        return { approverRole: 'superadmin', approverEmail: HARDCODED_SUPER_ADMIN.email };
      }

      return { approverRole: 'superadmin', approverEmail: HARDCODED_SUPER_ADMIN.email };
    }

    /* =========================================================================
       3. APPROVAL & REJECTION ACTIONS (4-Tier Chain of Command)
       ========================================================================= */

    /**
     * Approves a pending user account
     * @param {string} targetUid 
     * @param {string} [approverNotes='']
     */
    approveAccount(targetUid, approverNotes = '') {
      if (!this.currentUser) throw new Error('Unauthorized');

      const target = window.LocalDB.getUserById(targetUid);
      if (!target) throw new Error('Target user not found');

      // Verify chain of command permission
      this.validateCanApprove(this.currentUser.role, target.role);

      const updated = window.LocalDB.updateUser(targetUid, {
        status: 'APPROVED',
        approvedBy: this.currentUser.email,
        approvedAt: new Date().toISOString(),
        approverNotes: approverNotes
      });

      // If target was a vendor, update matching vendor dossier to 'Pending Review' so they can submit docs
      if (target.role === 'vendor' && target.vendorId) {
        window.LocalDB.updateVendor(target.vendorId, {
          status: 'Pending Review',
          approvedBy: this.currentUser.email,
          approvalUnlockedAt: new Date().toISOString()
        });
      }

      window.LocalDB.addAuditLog(
        this.currentUser.email,
        this.currentUser.role,
        `Approved ${target.role.toUpperCase()} account for ${target.email}`,
        targetUid
      );

      // If active session is the approved user, update current session
      if (this.currentUser.uid === targetUid) {
        this.currentUser = updated;
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(updated));
        this.notifyAuthListeners();
      }

      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('auth:account-approved', { detail: { targetUid, target } }));
      }
      return updated;
    }

    /**
     * Rejects a pending user account with a mandatory reason
     * @param {string} targetUid 
     * @param {string} reason 
     */
    rejectAccount(targetUid, reason) {
      if (!this.currentUser) throw new Error('Unauthorized');
      if (!reason || !reason.trim()) throw new Error('Mandatory rejection reason required.');

      const target = window.LocalDB.getUserById(targetUid);
      if (!target) throw new Error('Target user not found');

      this.validateCanApprove(this.currentUser.role, target.role);

      const updated = window.LocalDB.updateUser(targetUid, {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedBy: this.currentUser.email,
        rejectedAt: new Date().toISOString()
      });

      if (target.role === 'vendor' && target.vendorId) {
        window.LocalDB.updateVendor(target.vendorId, {
          status: 'Blocked',
          tier: 'Tier 1',
          rejectionReason: reason
        });
      }

      window.LocalDB.addAuditLog(
        this.currentUser.email,
        this.currentUser.role,
        `Rejected ${target.role.toUpperCase()} account for ${target.email}: ${reason}`,
        targetUid,
        { reason }
      );

      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('auth:account-rejected', { detail: { targetUid, reason } }));
      }
      return updated;
    }

    /**
     * Validates if active role has authority to approve target role
     */
    validateCanApprove(actorRole, targetRole) {
      if (actorRole === 'superadmin') return true; // Super admin can approve anything
      if (actorRole === 'admin') {
        if (targetRole === 'manager' || targetRole === 'vendor') return true;
        throw new Error('Admins can only approve Managers and Vendors.');
      }
      if (actorRole === 'manager') {
        if (targetRole === 'vendor') return true;
        throw new Error('Managers can only approve Vendors.');
      }
      throw new Error('Unauthorized: You do not have permission to approve accounts.');
    }

    /* =========================================================================
       4. SIGNOUT & RBAC SESSION GUARDS
       ========================================================================= */

    /**
     * Signs out active user and clears session storage
     */
    signOut() {
      if (this.currentUser) {
        window.LocalDB.addAuditLog(this.currentUser.email, this.currentUser.role, 'User Signed Out', this.currentUser.uid);
      }
      this.currentUser = null;
      sessionStorage.removeItem(SESSION_USER_KEY);
      sessionStorage.removeItem('portal_user_role');
      this.notifyAuthListeners();
      console.log('🔒 User signed out. Session cleared.');
    }

    /**
     * RBAC Session Guard: Verifies user has permission to access a target view/action
     * @param {string|string[]} allowedRoles 
     * @returns {boolean}
     */
    checkRBAC(allowedRoles) {
      if (!this.currentUser) return false;
      if (this.currentUser.status !== 'APPROVED') return false;

      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      return roles.includes(this.currentUser.role);
    }
  }

  // Export singleton globally
  window.PortalAuth = new HybridAuthController();

})(window);
