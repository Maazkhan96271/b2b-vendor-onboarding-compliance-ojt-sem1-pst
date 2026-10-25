/**
 * LocalDB Engine - Partitioned Local Storage Utility Class
 * Author: Abhinaba Das (Backend Logic, State & Firebase Lead)
 * Project: B2B Vendor Onboarding & Compliance Portal (PST_PD_116)
 * 
 * Manages partitioned namespaces:
 * 1. vendors_db       - Array of vendor profiles, compliance documents & review metadata
 * 2. audit_logs       - Chronological immutable event logs
 * 3. mock_api_cache   - Caches mock verification calls (EIN, Tax ID)
 * 4. system_settings  - Hard-coded Super Admin credentials per company, user accounts & requirement schemas
 */

(function (window) {
  'use strict';

  const STORAGE_PREFIX = 'tv_portal_';
  const PARTITIONS = {
    VENDORS: STORAGE_PREFIX + 'vendors_db',
    AUDIT_LOGS: STORAGE_PREFIX + 'audit_logs',
    MOCK_CACHE: STORAGE_PREFIX + 'mock_api_cache',
    SETTINGS: STORAGE_PREFIX + 'system_settings'
  };

  class LocalDBEngine {
    constructor() {
      this.initialized = false;
      this.init();
    }

    /**
     * Initializes the partitioned LocalDB storage engine.
     * Seeds initial demo data if partitions are empty.
     */
    init() {
      if (this.initialized) return;

      if (!localStorage.getItem(PARTITIONS.SETTINGS)) {
        this.seedInitialState();
      }

      this.initialized = true;
      console.log('✅ LocalDB Engine initialized with partitioned namespaces: vendors_db, audit_logs, mock_api_cache, system_settings');
    }

    /**
     * Low-level partition reader
     * @param {string} partitionKey 
     * @param {any} fallback 
     * @returns {any}
     */
    getPartition(partitionKey, fallback = null) {
      try {
        const raw = localStorage.getItem(partitionKey);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        console.error(`Error reading LocalDB partition [${partitionKey}]:`, err);
        return fallback;
      }
    }

    /**
     * Low-level partition writer
     * @param {string} partitionKey 
     * @param {any} data 
     */
    setPartition(partitionKey, data) {
      try {
        localStorage.setItem(partitionKey, JSON.stringify(data));
        return true;
      } catch (err) {
        console.error(`Error writing to LocalDB partition [${partitionKey}]:`, err);
        return false;
      }
    }

    /* =========================================================================
       1. VENDORS PARTITION (vendors_db)
       ========================================================================= */

    getVendors() {
      return this.getPartition(PARTITIONS.VENDORS, []);
    }

    saveVendors(vendors) {
      return this.setPartition(PARTITIONS.VENDORS, vendors);
    }

    getVendorById(vendorId) {
      const vendors = this.getVendors();
      return vendors.find(v => v.id === vendorId) || null;
    }

    getVendorByUserId(userId) {
      const vendors = this.getVendors();
      return vendors.find(v => v.userId === userId) || null;
    }

    saveVendor(vendor) {
      const vendors = this.getVendors();
      const existingIdx = vendors.findIndex(v => v.id === vendor.id);

      if (existingIdx >= 0) {
        vendors[existingIdx] = { ...vendors[existingIdx], ...vendor, lastUpdated: new Date().toISOString() };
      } else {
        vendors.unshift({
          ...vendor,
          id: vendor.id || `VEN-${Math.floor(1000 + Math.random() * 9000)}`,
          submissionDate: vendor.submissionDate || new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }

      this.saveVendors(vendors);
      return vendor;
    }

    updateVendor(vendorId, updates) {
      const vendors = this.getVendors();
      const idx = vendors.findIndex(v => v.id === vendorId);
      if (idx === -1) return null;

      vendors[idx] = { ...vendors[idx], ...updates, lastUpdated: new Date().toISOString() };
      this.saveVendors(vendors);
      return vendors[idx];
    }

    deleteVendor(vendorId) {
      const vendors = this.getVendors().filter(v => v.id !== vendorId);
      this.saveVendors(vendors);
      return true;
    }

    /* =========================================================================
       2. AUDIT LOGS PARTITION (audit_logs)
       ========================================================================= */

    getAuditLogs() {
      return this.getPartition(PARTITIONS.AUDIT_LOGS, []);
    }

    /**
     * Appends an uneditable chronological log entry
     * @param {string} actor User display name or email
     * @param {string} role User role (superadmin, admin, manager, vendor)
     * @param {string} action Description of action performed
     * @param {string} targetId Target ID (e.g. VEN-4821 or user UID)
     * @param {object} details Additional metadata or diff
     */
    addAuditLog(actor, role, action, targetId, details = {}) {
      const logs = this.getAuditLogs();
      const newEntry = {
        id: 'LOG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        actor: actor || 'System',
        role: role || 'system',
        action: action,
        targetId: targetId || 'N/A',
        details: details
      };

      logs.unshift(newEntry);
      // Quota-safe limit: keep up to 500 recent audit entries
      if (logs.length > 500) logs.pop();
      this.setPartition(PARTITIONS.AUDIT_LOGS, logs);

      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('audit:new-entry', { detail: newEntry }));
      }
      return newEntry;
    }

    /* =========================================================================
       3. MOCK API CACHE PARTITION (mock_api_cache)
       ========================================================================= */

    getMockCache(key) {
      const cache = this.getPartition(PARTITIONS.MOCK_CACHE, {});
      return cache[key] || null;
    }

    setMockCache(key, value) {
      const cache = this.getPartition(PARTITIONS.MOCK_CACHE, {});
      cache[key] = {
        data: value,
        cachedAt: new Date().toISOString()
      };
      this.setPartition(PARTITIONS.MOCK_CACHE, cache);
    }

    /* =========================================================================
       4. SYSTEM SETTINGS & AUTH USERS PARTITION (system_settings)
       ========================================================================= */

    getSystemSettings() {
      return this.getPartition(PARTITIONS.SETTINGS, {});
    }

    updateSystemSettings(updates) {
      const current = this.getSystemSettings();
      const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
      this.setPartition(PARTITIONS.SETTINGS, updated);
      return updated;
    }

    getUsers() {
      const settings = this.getSystemSettings();
      return settings.users || [];
    }

    saveUsers(users) {
      return this.updateSystemSettings({ users: users });
    }

    getUserById(uid) {
      const users = this.getUsers();
      return users.find(u => u.uid === uid) || null;
    }

    getUserByEmail(email) {
      if (!email) return null;
      const users = this.getUsers();
      return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }

    saveUser(user) {
      const users = this.getUsers();
      const idx = users.findIndex(u => u.uid === user.uid || (u.email && u.email.toLowerCase() === (user.email || '').toLowerCase()));

      if (idx >= 0) {
        users[idx] = { ...users[idx], ...user, updatedAt: new Date().toISOString() };
      } else {
        users.push({
          ...user,
          uid: user.uid || 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      this.saveUsers(users);
      return user;
    }

    updateUser(uid, updates) {
      const users = this.getUsers();
      const idx = users.findIndex(u => u.uid === uid);
      if (idx === -1) return null;

      users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveUsers(users);
      return users[idx];
    }

    /**
     * Retrieves Manager-configured compliance requirements schema
     */
    getRequirementSchema() {
      const settings = this.getSystemSettings();
      return settings.requirementSchema || {
        requiredDocCount: 3,
        submissionDeadline: this.getDefaultDeadlineDate(14),
        customDocumentTypes: [
          { id: 'w9_form', title: 'IRS Form W-9 / Taxpayer Identification', mandatory: true, description: 'Signed and dated within the current tax year.' },
          { id: 'cert_insurance', title: 'Commercial General / Carrier Liability Insurance ($1M)', mandatory: true, description: 'Certificate of Insurance with designated corporate entity.' },
          { id: 'signed_nda', title: 'Corporate Non-Disclosure Agreement (Mutual NDA)', mandatory: true, description: 'Executed bilateral non-disclosure agreement.' },
          { id: 'quality_safety_cert', title: 'Quality & Regulatory Certificate (ISO 9001 / SOC 2 / DOT)', mandatory: false, description: 'Operational compliance and audit report.' }
        ]
      };
    }

    /**
     * Persists Manager-configured compliance requirement schema
     */
    saveRequirementSchema(schema) {
      const updatedSettings = this.updateSystemSettings({ requirementSchema: schema });
      this.addAuditLog('Procurement Manager', 'manager', 'Updated Compliance Requirement Schema', 'SCHEMA', {
        docCount: schema.requiredDocCount,
        deadline: schema.submissionDeadline
      });
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('manager:requirements-updated', { detail: schema }));
      }
      return updatedSettings.requirementSchema;
    }

    getDefaultDeadlineDate(daysAhead = 14) {
      const d = new Date();
      d.setDate(d.getDate() + daysAhead);
      return d.toISOString().split('T')[0];
    }

    /* =========================================================================
       5. JSON STATE IMPORT & EXPORT PORTABILITY
       ========================================================================= */

    /**
     * Exports full database state across all partitions as a JSON string
     * @returns {string} JSON formatted state
     */
    exportStateJSON() {
      const fullState = {
        meta: {
          app: 'TrustVendor B2B Vendor Onboarding & Compliance Portal',
          id: 'PST_PD_116',
          exportTimestamp: new Date().toISOString(),
          version: '1.2.0',
          engineer: 'Abhinaba Das'
        },
        partitions: {
          vendors_db: this.getVendors(),
          audit_logs: this.getAuditLogs(),
          mock_api_cache: this.getPartition(PARTITIONS.MOCK_CACHE, {}),
          system_settings: this.getSystemSettings()
        }
      };

      return JSON.stringify(fullState, null, 2);
    }

    /**
     * Triggers client browser file download of LocalDB state JSON
     */
    downloadStateExportFile() {
      const jsonStr = this.exportStateJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `trustvendor_localdb_state_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.addAuditLog('System Admin', 'system', 'Exported LocalDB State JSON', 'DATABASE');
    }

    /**
     * Imports and validates a JSON state backup, replacing partitioned localStorage
     * @param {string|object} jsonData 
     * @returns {boolean}
     */
    importStateJSON(jsonData) {
      try {
        const stateObj = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        if (!stateObj.partitions) {
          throw new Error('Invalid LocalDB backup format: Missing partitions object.');
        }

        const { vendors_db, audit_logs, mock_api_cache, system_settings } = stateObj.partitions;

        if (vendors_db) this.setPartition(PARTITIONS.VENDORS, vendors_db);
        if (audit_logs) this.setPartition(PARTITIONS.AUDIT_LOGS, audit_logs);
        if (mock_api_cache) this.setPartition(PARTITIONS.MOCK_CACHE, mock_api_cache);
        if (system_settings) this.setPartition(PARTITIONS.SETTINGS, system_settings);

        this.addAuditLog('System Admin', 'system', 'Imported LocalDB State JSON', 'DATABASE', {
          recordsImported: (vendors_db || []).length
        });

        if (typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('localdb:state-imported', { detail: stateObj }));
        }
        return true;
      } catch (err) {
        console.error('Failed to import LocalDB state:', err);
        return false;
      }
    }

    /**
     * Resets database to factory seed data
     */
    resetToDefault() {
      localStorage.removeItem(PARTITIONS.VENDORS);
      localStorage.removeItem(PARTITIONS.AUDIT_LOGS);
      localStorage.removeItem(PARTITIONS.MOCK_CACHE);
      localStorage.removeItem(PARTITIONS.SETTINGS);
      this.seedInitialState();
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('localdb:state-imported'));
      }
    }

    /* =========================================================================
       6. INITIAL STATE SEEDING
       ========================================================================= */

    seedInitialState() {
      console.log('🌱 Seeding initial state into partitioned LocalDB storage...');

      // 1. System Settings & 4-Tier Chain of Command User Accounts
      const initialUsers = [
        // 1. Super Admin (Pre-set hardcoded company credentials)
        {
          uid: 'usr_superadmin_01',
          name: 'Global Enterprise Root Super Admin',
          email: 'superadmin@trustvendor.com',
          password: 'SuperAdmin2026!',
          role: 'superadmin',
          status: 'APPROVED',
          company: 'TrustVendor Global Corp',
          assignedApprover: null,
          createdAt: '2026-09-01T08:00:00.000Z'
        },
        // 2. Admin (Pre-set active Admin)
        {
          uid: 'usr_admin_01',
          name: 'Eleanor Vance',
          email: 'admin@trustvendor.com',
          password: 'Admin2026!',
          role: 'admin',
          status: 'APPROVED',
          company: 'TrustVendor Operations',
          assignedApprover: 'superadmin@trustvendor.com',
          createdAt: '2026-09-05T09:30:00.000Z'
        },
        // 3. Procurement Manager (Pre-set active Manager)
        {
          uid: 'usr_manager_01',
          name: 'Mohd. Maaz Khan',
          email: 'manager@trustvendor.com',
          password: 'Manager2026!',
          role: 'manager',
          status: 'APPROVED',
          company: 'TrustVendor Procurement',
          assignedApprover: 'admin@trustvendor.com',
          createdAt: '2026-09-10T11:00:00.000Z'
        },
        // 4. External Vendor (Approved Vendor with complete onboarding)
        {
          uid: 'usr_vendor_apex',
          name: 'Marcus Brody',
          email: 'vendor@apexlogistics.com',
          password: 'Vendor2026!',
          role: 'vendor',
          status: 'APPROVED',
          company: 'Apex Global Logistics Inc.',
          vendorId: 'VEN-4821',
          assignedApprover: 'manager@trustvendor.com',
          createdAt: '2026-09-15T10:00:00.000Z'
        },
        // 5. External Vendor (Pending Approval - For testing approval queues)
        {
          uid: 'usr_vendor_cloudscale',
          name: 'David Chen',
          email: 'newvendor@cloudscale.io',
          password: 'Vendor2026!',
          role: 'vendor',
          status: 'PENDING_APPROVAL',
          company: 'CloudScale Technologies LLC',
          assignedApprover: 'manager@trustvendor.com',
          createdAt: '2026-10-20T14:30:00.000Z'
        },
        // 6. Admin (Pending Approval - For testing Super Admin approval queue)
        {
          uid: 'usr_admin_pending',
          name: 'Robert Hastings',
          email: 'robert.admin@trustvendor.com',
          password: 'Admin2026!',
          role: 'admin',
          status: 'PENDING_APPROVAL',
          company: 'TrustVendor EMEA Hub',
          assignedApprover: 'superadmin@trustvendor.com',
          createdAt: '2026-10-22T08:15:00.000Z'
        },
        // 7. Manager (Pending Approval - For testing Admin approval queue)
        {
          uid: 'usr_mgr_pending',
          name: 'Sophia Patel',
          email: 'sophia.manager@trustvendor.com',
          password: 'Manager2026!',
          role: 'manager',
          status: 'PENDING_APPROVAL',
          company: 'TrustVendor Direct Sourcing',
          assignedApprover: 'admin@trustvendor.com',
          createdAt: '2026-10-23T11:20:00.000Z'
        }
      ];

      const initialSettings = {
        companyName: 'TrustVendor Global Inc.',
        industry: 'Supply Chain & Procurement',
        trackId: 'PST_PD_116',
        batchLevel: '2026 Level 2 (Core)',
        hardcodedSuperAdmin: {
          email: 'superadmin@trustvendor.com',
          password: 'SuperAdmin2026!',
          company: 'TrustVendor Global Corp'
        },
        requirementSchema: {
          requiredDocCount: 3,
          submissionDeadline: this.getDefaultDeadlineDate(14),
          customDocumentTypes: [
            { id: 'w9_form', title: 'IRS Form W-9 / Taxpayer Identification', mandatory: true, description: 'Signed and dated within current tax year.' },
            { id: 'cert_insurance', title: 'Commercial General / Carrier Liability Insurance ($1M)', mandatory: true, description: 'Certificate of Insurance with designated corporate entity.' },
            { id: 'signed_nda', title: 'Corporate Non-Disclosure Agreement (Mutual NDA)', mandatory: true, description: 'Executed bilateral non-disclosure agreement.' },
            { id: 'quality_safety_cert', title: 'Quality & Regulatory Certificate (ISO 9001 / SOC 2 / DOT)', mandatory: false, description: 'Operational compliance and audit report.' }
          ]
        },
        users: initialUsers,
        systemVersion: '1.2.0',
        seededAt: new Date().toISOString()
      };

      this.setPartition(PARTITIONS.SETTINGS, initialSettings);

      // 2. Vendors DB
      const initialVendors = [
        {
          id: 'VEN-4821',
          userId: 'usr_vendor_apex',
          name: 'Apex Global Logistics Inc.',
          dba: 'Apex Freightways',
          category: 'Logistics / Freight',
          ein: '12-3456789',
          email: 'vendor@apexlogistics.com',
          phone: '+1 (555) 234-5678',
          address: '1420 Freight Parkway, Chicago, IL 60607',
          status: 'Approved',
          tier: 'Tier 3',
          assignedManager: 'Mohd. Maaz Khan',
          submissionDate: '2026-09-15T10:00:00.000Z',
          bankName: 'JPMorgan Chase Bank',
          routingNumber: '122105155',
          accountNumber: '**** **** 4812',
          paymentTerms: 'Net 30',
          signatory: 'Marcus Brody',
          progressPercent: 100,
          docs: [
            { docId: 'w9_form', docName: 'W9_Tax_Form_2026.pdf', size: '245.2 KB', expDate: '2027-01-01', importance: 'High', docStatus: 'Approved' },
            { docId: 'cert_insurance', docName: 'COI_Carrier_Liability.pdf', size: '1.2 MB', expDate: '2026-12-15', importance: 'High', docStatus: 'Approved' },
            { docId: 'signed_nda', docName: 'Mutual_NDA_Executed.pdf', size: '380.0 KB', expDate: '2028-09-15', importance: 'Medium', docStatus: 'Approved' },
            { docId: 'quality_safety_cert', docName: 'DOT_Satisfactory_Rating.pdf', size: '480.0 KB', expDate: '2027-03-30', importance: 'Medium', docStatus: 'Approved' }
          ]
        },
        {
          id: 'VEN-5912',
          userId: 'usr_vendor_cloudscale',
          name: 'CloudScale Technologies LLC',
          dba: 'CloudScale DevOps',
          category: 'IT / Cloud Services',
          ein: '98-7654321',
          email: 'newvendor@cloudscale.io',
          phone: '+1 (555) 876-5432',
          address: '400 Silicon Valley Way, San Jose, CA 95113',
          status: 'Pending Review',
          tier: 'Tier 2',
          assignedManager: 'Mohd. Maaz Khan',
          submissionDate: '2026-10-18T14:30:00.000Z',
          bankName: 'Silicon Valley Bank',
          routingNumber: '121140399',
          accountNumber: '**** **** 9021',
          paymentTerms: 'Net 45',
          signatory: 'David Chen',
          progressPercent: 100,
          docs: [
            { docId: 'w9_form', docName: 'IRS_W9_Signed.pdf', size: '310.5 KB', expDate: '2026-12-31', importance: 'High', docStatus: 'Pending Review' },
            { docId: 'cert_insurance', docName: 'Cyber_Liability_2M.pdf', size: '1.1 MB', expDate: '2026-11-20', importance: 'High', docStatus: 'Pending Review' },
            { docId: 'signed_nda', docName: 'Executed_NDA.pdf', size: '410.0 KB', expDate: '2027-10-18', importance: 'Medium', docStatus: 'Pending Review' }
          ]
        },
        {
          id: 'VEN-6204',
          userId: 'usr_vendor_vanguard',
          name: 'Vanguard Industrial Supplies',
          dba: 'Vanguard Steel Works',
          category: 'Manufacturing / Raw Materials',
          ein: '45-6789123',
          email: 'vendor-desk@vanguard-ind.com',
          phone: '+1 (555) 456-7890',
          address: '880 Foundry Road, Cleveland, OH 44114',
          status: 'Blocked',
          tier: 'Tier 1',
          assignedManager: 'Mohd. Maaz Khan',
          submissionDate: '2026-08-01T09:15:00.000Z',
          bankName: 'PNC Bank',
          routingNumber: '041000124',
          accountNumber: '**** **** 1290',
          paymentTerms: 'Net 60',
          signatory: 'Thomas Keller',
          progressPercent: 100,
          docs: [
            { docId: 'w9_form', docName: 'W9_Vanguard.pdf', size: '180.4 KB', expDate: '2026-09-01', importance: 'High', docStatus: 'Expired' },
            { docId: 'cert_insurance', docName: 'General_Liability_COI.pdf', size: '520.3 KB', expDate: '2026-10-10', importance: 'High', docStatus: 'Expired' },
            { docId: 'quality_safety_cert', docName: 'ISO9001_Certificate.pdf', size: '890.1 KB', expDate: '2027-06-30', importance: 'Medium', docStatus: 'Approved' }
          ]
        },
        {
          id: 'VEN-7108',
          userId: 'usr_vendor_stratton',
          name: 'Stratton & Cross Consulting LLP',
          dba: 'Stratton Cross Advisory',
          category: 'Consulting / Professional Services',
          ein: '33-4455667',
          email: 'billing@strattoncross.com',
          phone: '+1 (555) 345-6789',
          address: '750 3rd Avenue, New York, NY 10017',
          status: 'Approved',
          tier: 'Tier 3',
          assignedManager: 'Mohd. Maaz Khan',
          submissionDate: '2026-09-28T16:45:00.000Z',
          bankName: 'Citibank N.A.',
          routingNumber: '021000089',
          accountNumber: '**** **** 7733',
          paymentTerms: 'Net 30',
          signatory: 'Victoria Stratton',
          progressPercent: 100,
          docs: [
            { docId: 'w9_form', docName: 'W9_2026_Certified.pdf', size: '215.0 KB', expDate: '2027-04-15', importance: 'High', docStatus: 'Approved' },
            { docId: 'cert_insurance', docName: 'Professional_Indemnity_COI.pdf', size: '1.4 MB', expDate: '2027-08-30', importance: 'High', docStatus: 'Approved' },
            { docId: 'signed_nda', docName: 'Consulting_NDA.pdf', size: '290.0 KB', expDate: '2028-09-28', importance: 'Medium', docStatus: 'Approved' }
          ]
        }
      ];

      this.setPartition(PARTITIONS.VENDORS, initialVendors);

      // 3. Audit Logs
      const initialAuditLogs = [
        {
          id: 'LOG-001',
          timestamp: '2026-09-01T08:00:00.000Z',
          actor: 'superadmin@trustvendor.com',
          role: 'superadmin',
          action: 'System Initialized',
          targetId: 'SYSTEM',
          details: { message: 'LocalDB Partitioning and 4-tier chain of command seeded.' }
        },
        {
          id: 'LOG-002',
          timestamp: '2026-09-05T09:30:00.000Z',
          actor: 'superadmin@trustvendor.com',
          role: 'superadmin',
          action: 'Approved Admin Account',
          targetId: 'usr_admin_01',
          details: { approvedUser: 'admin@trustvendor.com', role: 'admin' }
        },
        {
          id: 'LOG-003',
          timestamp: '2026-09-10T11:00:00.000Z',
          actor: 'admin@trustvendor.com',
          role: 'admin',
          action: 'Approved Procurement Manager',
          targetId: 'usr_manager_01',
          details: { approvedUser: 'manager@trustvendor.com', role: 'manager' }
        },
        {
          id: 'LOG-004',
          timestamp: '2026-09-15T10:15:00.000Z',
          actor: 'manager@trustvendor.com',
          role: 'manager',
          action: 'Approved Vendor Account',
          targetId: 'usr_vendor_apex',
          details: { company: 'Apex Global Logistics Inc.', vendorId: 'VEN-4821' }
        },
        {
          id: 'LOG-005',
          timestamp: '2026-10-18T14:35:00.000Z',
          actor: 'David Chen',
          role: 'vendor',
          action: 'Submitted Vendor Onboarding Dossier',
          targetId: 'VEN-5912',
          details: { status: 'Pending Review', documentCount: 3 }
        }
      ];

      this.setPartition(PARTITIONS.AUDIT_LOGS, initialAuditLogs);

      // 4. Mock API Cache
      const initialMockCache = {
        'ein:12-3456789': {
          data: { valid: true, businessName: 'Apex Global Logistics Inc.', status: 'Active', registry: 'IRS Business Master' },
          cachedAt: '2026-09-15T10:00:00.000Z'
        },
        'ein:98-7654321': {
          data: { valid: true, businessName: 'CloudScale Technologies LLC', status: 'Active', registry: 'California Secretary of State' },
          cachedAt: '2026-10-18T14:30:00.000Z'
        }
      };

      this.setPartition(PARTITIONS.MOCK_CACHE, initialMockCache);
    }
  }

  // Export globally as singleton
  window.LocalDB = new LocalDBEngine();

})(window);
