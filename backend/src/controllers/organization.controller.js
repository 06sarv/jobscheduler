const { query } = require('../config/database');
const logger = require('../utils/logger');

// Organization controller
// Handles CRUD for orgs and member management

// helper to generate a url-friendly slug from the org name
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const create = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const slug = slugify(name);

    const result = await query(
      `INSERT INTO organizations (name, slug, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, slug, description || null, req.user.id]
    );

    const org = result.rows[0];

    // also add the creator as an owner in the members table
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [org.id, req.user.id, 'owner']
    );

    logger.info(`Organization created: ${org.name} by user ${req.user.id}`);

    return res.status(201).json({
      success: true,
      data: org,
    });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// Get all orgs the current user belongs to
const getAll = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.* FROM organizations o
       INNER JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a member to an organization
 * TODO: maybe send an invite email here later?
 */
const addMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    const result = await query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, userId, role || 'member']
    );

    logger.info(`User ${userId} added to org ${id}`);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// Remove a member from the organization
const removeMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    await query(
      `DELETE FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [id, userId]
    );

    logger.info(`User ${userId} removed from org ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getById,
  getAll,
  addMember,
  removeMember,
};
