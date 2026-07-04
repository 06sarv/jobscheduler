/**
 * Middleware to parse pagination, sorting, and ordering params
 * from the query string and attach them to req.pagination.
 */
function parsePagination(req, res, next) {
  let page = parseInt(req.query.page, 10) || 1;
  let limit = parseInt(req.query.limit, 10) || 20;
  const sort = req.query.sort || null;   // which column to sort by - null means use default
  let order = (req.query.order || 'asc').toLowerCase();

  // sanity checks
  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;  // don't let anyone request a million rows

  // only allow asc or desc
  if (order !== 'asc' && order !== 'desc') {
    order = 'asc';
  }

  const offset = (page - 1) * limit;

  req.pagination = {
    page,
    limit,
    offset,
    sort,
    order
  };

  next();
}

module.exports = { parsePagination };
