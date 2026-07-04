const { query } = require('../config/database');
const logger = require('../utils/logger');

/*
 * Project controller
 * Manages projects within organizations.
 * Each project belongs to exactly one org.
 */

const create = async (req, res, next) => {
  try {
    const { organizationId, name, description } = req.body;

    const result = await query(
      `INSERT INTO projects (organization_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [organizationId, name, description || null, req.user.id]
    );

    logger.info(`Project created: ${name} in org ${organizationId}`);

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
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

// fetch all projects that belong to a specific org
const getByOrgId = async (req, res, next) => {
  try {
    const { orgId } = req.params;

    const result = await query(
      `SELECT * FROM projects
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [orgId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // TODO: should probably also update an `updated_at` timestamp
    const result = await query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [name, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
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

// delete a project by id
const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM projects WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    logger.info(`Project deleted: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getById,
  getByOrgId,
  update,
  delete: deleteProject,
};
