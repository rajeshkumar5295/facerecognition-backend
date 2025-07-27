const express = require('express');
const router = express.Router();
const OrganizationController = require('../controllers/OrganizationController');
const { authenticate, authorize } = require('../middleware/auth');

// @route   GET /api/organizations
// @desc    Get all organizations
// @access  Private (Super Admin only)
router.get('/', authenticate, authorize(['super-admin']), OrganizationController.getAllOrganizations);

// @route   POST /api/organizations
// @desc    Create new organization
// @access  Private (Super Admin only)
router.post('/', authenticate, authorize(['super-admin']), OrganizationController.createOrganization);

// @route   GET /api/organizations/global-stats
// @desc    Get global organization statistics
// @access  Private (Super Admin only)
router.get('/global-stats', authenticate, authorize(['super-admin']), OrganizationController.getGlobalStats);

// @route   GET /api/organizations/by-invite/:inviteCode
// @desc    Get organization by invite code
// @access  Public
router.get('/by-invite/:inviteCode', OrganizationController.getOrganizationByInviteCode);

// @route   GET /api/organizations/:id
// @desc    Get organization by ID
// @access  Private (Super Admin or Admin of organization)
router.get('/:id', authenticate, authorize(['super-admin', 'admin']), OrganizationController.getOrganizationById);

// @route   PUT /api/organizations/:id
// @desc    Update organization
// @access  Private (Super Admin only)
router.put('/:id', authenticate, authorize(['super-admin']), OrganizationController.updateOrganization);

// @route   DELETE /api/organizations/:id
// @desc    Delete organization
// @access  Private (Super Admin only)
router.delete('/:id', authenticate, authorize(['super-admin']), OrganizationController.deleteOrganization);

// @route   GET /api/organizations/:id/users
// @desc    Get organization users with comprehensive details
// @access  Private (Admin or Super Admin)
router.get('/:id/users', authenticate, authorize(['super-admin', 'admin']), OrganizationController.getOrganizationUsers);

// @route   GET /api/organizations/:id/stats
// @desc    Get organization statistics
// @access  Private (Admin or Super Admin)
router.get('/:id/stats', authenticate, authorize(['super-admin', 'admin']), OrganizationController.getOrganizationStats);

module.exports = router; 