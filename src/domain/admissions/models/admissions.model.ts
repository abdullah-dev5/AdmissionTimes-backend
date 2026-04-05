/**
 * Admissions Domain - Model Layer
 * 
 * Database access layer for admissions.
 * Contains all raw SQL queries with parameterized statements.
 * 
 * Responsibilities:
 * - Execute database queries
 * - Handle pagination
 * - Handle filtering
 * - Return raw data (no transformation)
 * 
 * NO business logic - that belongs in the service layer.
 */

import { query } from '@db/connection';
import { Admission, AdmissionFilters } from '../types/admissions.types';
import { calculateOffset } from '@shared/utils/pagination';
import { SORTABLE_FIELDS, SEARCH_FIELDS } from '../constants/admissions.constants';

/**
 * Find admission by ID
 * 
 * @param id - Admission UUID
 * @param includeInactive - Whether to include inactive admissions (default: false)
 * @returns Admission record or null if not found
 */
export const findById = async (
  id: string,
  includeInactive: boolean = false
): Promise<Admission | null> => {
  const sql = includeInactive
    ? `
      SELECT
        a.*,
        u.name AS university_name,
        u.logo_url AS university_logo_url,
        u.city AS university_city,
        u.country AS university_country
      FROM admissions a
      LEFT JOIN universities u ON u.id = a.university_id
      WHERE a.id = $1
    `
    : `
      SELECT
        a.*,
        u.name AS university_name,
        u.logo_url AS university_logo_url,
        u.city AS university_city,
        u.country AS university_country
      FROM admissions a
      LEFT JOIN universities u ON u.id = a.university_id
      WHERE a.id = $1 AND a.is_active = true
    `;

  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Count admissions matching filters
 * 
 * @param filters - Filter criteria
 * @returns Total count of matching admissions
 */
export const count = async (filters: AdmissionFilters): Promise<number> => {
  const { sql, params } = buildCountQuery(filters);
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Find multiple admissions with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param sort - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Array of admission records
 */
export const findMany = async (
  filters: AdmissionFilters,
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<Admission[]> => {
  const offset = calculateOffset(page, limit);
  const { sql, params } = buildFindManyQuery(filters, sort, order, limit, offset);

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Create a new admission
 * 
 * @param data - Admission data
 * @param createdBy - User ID who created the admission
 * @returns Created admission record
 */
export const create = async (
  data: Omit<Admission, 'id' | 'created_at' | 'updated_at'>,
  createdBy: string | null = null
): Promise<Admission> => {
  const sql = `
    INSERT INTO admissions (
      university_id, title, description, program_type, degree_level,
      field_of_study, duration, tuition_fee, currency, application_fee,
      deadline, start_date, location, delivery_mode, requirements,
      created_by, verification_status, is_active
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    RETURNING *
  `;

  const params = [
    data.university_id,
    data.title,
    data.description,
    data.program_type,
    data.degree_level,
    data.field_of_study,
    data.duration,
    data.tuition_fee,
    data.currency,
    data.application_fee,
    data.deadline,
    data.start_date,
    data.location,
    data.delivery_mode,
    data.requirements ? JSON.stringify(data.requirements) : null,
    createdBy,
    data.verification_status || 'draft',
    data.is_active ?? true,
  ];

  const result = await query(sql, params);
  return result.rows[0];
};

/**
 * Update an existing admission
 * 
 * @param id - Admission UUID
 * @param data - Partial admission data to update
 * @returns Updated admission record or null if not found
 */
export const update = async (
  id: string,
  data: Partial<Omit<Admission, 'id' | 'created_at' | 'updated_at'>>
): Promise<Admission | null> => {
  // Build dynamic UPDATE query based on provided fields
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Map of field names to their parameterized values
  const fieldMap: Record<string, any> = {
    university_id: data.university_id,
    title: data.title,
    description: data.description,
    program_type: data.program_type,
    degree_level: data.degree_level,
    field_of_study: data.field_of_study,
    duration: data.duration,
    tuition_fee: data.tuition_fee,
    currency: data.currency,
    application_fee: data.application_fee,
    deadline: data.deadline,
    start_date: data.start_date,
    location: data.location,
    delivery_mode: data.delivery_mode,
    requirements: data.requirements ? JSON.stringify(data.requirements) : data.requirements,
    verification_status: data.verification_status,
    verified_at: data.verified_at,
    verified_by: data.verified_by,
    rejection_reason: data.rejection_reason,
    is_active: data.is_active,
  };

  // Build SET clause dynamically
  for (const [field, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${field} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  // If no fields to update, return null
  if (fields.length === 0) {
    const existing = await findById(id);
    return existing;
  }

  // Add id parameter
  values.push(id);

  const sql = `
    UPDATE admissions
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex} AND is_active = true
    RETURNING *
  `;

  const result = await query(sql, values);
  return result.rows[0] || null;
};

/**
 * Soft delete admission (set is_active = false)
 * 
 * @param id - Admission UUID
 * @returns Updated admission record or null if not found
 */
export const deleteById = async (id: string): Promise<Admission | null> => {
  const sql = `
    UPDATE admissions
    SET is_active = false, updated_at = NOW()
    WHERE id = $1 AND is_active = true
    RETURNING *
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Build COUNT query with filters
 * 
 * @param filters - Filter criteria
 * @returns SQL query and parameters
 */
function buildCountQuery(filters: AdmissionFilters): { sql: string; params: any[] } {
  const conditions: string[] = ['is_active = true'];
  const params: any[] = [];
  let paramIndex = 1;

  // Verification status filter
  if (filters.verification_status) {
    if (Array.isArray(filters.verification_status)) {
      const placeholders = filters.verification_status.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`verification_status IN (${placeholders})`);
      params.push(...filters.verification_status);
    } else {
      conditions.push(`verification_status = $${paramIndex++}`);
      params.push(filters.verification_status);
    }
  }

  // Created by filter
  if (filters.created_by) {
    conditions.push(`created_by = $${paramIndex++}`);
    params.push(filters.created_by);
  }

  // Owner scope filter (university visibility across linked identities)
  if ((filters.owner_user_ids && filters.owner_user_ids.length > 0) || (filters.owner_university_ids && filters.owner_university_ids.length > 0)) {
    const ownerConditions: string[] = [];

    if (filters.owner_user_ids && filters.owner_user_ids.length > 0) {
      ownerConditions.push(`created_by = ANY($${paramIndex++}::uuid[])`);
      params.push(filters.owner_user_ids);
    }

    if (filters.owner_university_ids && filters.owner_university_ids.length > 0) {
      ownerConditions.push(`university_id = ANY($${paramIndex++}::uuid[])`);
      params.push(filters.owner_university_ids);
    }

    conditions.push(`(${ownerConditions.join(' OR ')})`);
  }

  // Program type filter
  if (filters.program_type) {
    conditions.push(`program_type ILIKE $${paramIndex++}`);
    params.push(`%${filters.program_type}%`);
  }

  // Degree level filter
  if (filters.degree_level) {
    conditions.push(`degree_level ILIKE $${paramIndex++}`);
    params.push(`%${filters.degree_level}%`);
  }

  // Field of study filter
  if (filters.field_of_study) {
    conditions.push(`field_of_study ILIKE $${paramIndex++}`);
    params.push(`%${filters.field_of_study}%`);
  }

  // Location filter
  if (filters.location) {
    conditions.push(`location ILIKE $${paramIndex++}`);
    params.push(`%${filters.location}%`);
  }

  // Delivery mode filter
  if (filters.delivery_mode) {
    conditions.push(`delivery_mode = $${paramIndex++}`);
    params.push(filters.delivery_mode);
  }

  // Search filter (full-text search across multiple fields)
  if (filters.search) {
    const searchConditions = SEARCH_FIELDS.map((field, idx) => {
      return `${field} ILIKE $${paramIndex + idx}`;
    });
    conditions.push(`(${searchConditions.join(' OR ')})`);
    params.push(...SEARCH_FIELDS.map(() => `%${filters.search}%`));
    paramIndex += SEARCH_FIELDS.length;
  }

  const sql = `SELECT COUNT(*) as count FROM admissions WHERE ${conditions.join(' AND ')}`;
  return { sql, params };
}

/**
 * Build FIND MANY query with filters, sorting, and pagination
 * 
 * @param filters - Filter criteria
 * @param sort - Field to sort by
 * @param order - Sort order
 * @param limit - Items per page
 * @param offset - Offset for pagination
 * @returns SQL query and parameters
 */
function buildFindManyQuery(
  filters: AdmissionFilters,
  sort: string,
  order: 'asc' | 'desc',
  limit: number,
  offset: number
): { sql: string; params: any[] } {
  const conditions: string[] = ['a.is_active = true'];
  const params: any[] = [];
  let paramIndex = 1;

  // Apply same filters as count query
  if (filters.verification_status) {
    if (Array.isArray(filters.verification_status)) {
      const placeholders = filters.verification_status.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`a.verification_status IN (${placeholders})`);
      params.push(...filters.verification_status);
    } else {
      conditions.push(`a.verification_status = $${paramIndex++}`);
      params.push(filters.verification_status);
    }
  }

  if (filters.created_by) {
    conditions.push(`a.created_by = $${paramIndex++}`);
    params.push(filters.created_by);
  }

  // Owner scope filter (university visibility across linked identities)
  if ((filters.owner_user_ids && filters.owner_user_ids.length > 0) || (filters.owner_university_ids && filters.owner_university_ids.length > 0)) {
    const ownerConditions: string[] = [];

    if (filters.owner_user_ids && filters.owner_user_ids.length > 0) {
      ownerConditions.push(`a.created_by = ANY($${paramIndex++}::uuid[])`);
      params.push(filters.owner_user_ids);
    }

    if (filters.owner_university_ids && filters.owner_university_ids.length > 0) {
      ownerConditions.push(`a.university_id = ANY($${paramIndex++}::uuid[])`);
      params.push(filters.owner_university_ids);
    }

    conditions.push(`(${ownerConditions.join(' OR ')})`);
  }

  if (filters.program_type) {
    conditions.push(`a.program_type ILIKE $${paramIndex++}`);
    params.push(`%${filters.program_type}%`);
  }

  if (filters.degree_level) {
    conditions.push(`a.degree_level ILIKE $${paramIndex++}`);
    params.push(`%${filters.degree_level}%`);
  }

  if (filters.field_of_study) {
    conditions.push(`a.field_of_study ILIKE $${paramIndex++}`);
    params.push(`%${filters.field_of_study}%`);
  }

  if (filters.location) {
    conditions.push(`a.location ILIKE $${paramIndex++}`);
    params.push(`%${filters.location}%`);
  }

  if (filters.delivery_mode) {
    conditions.push(`a.delivery_mode = $${paramIndex++}`);
    params.push(filters.delivery_mode);
  }

  // Search filter
  if (filters.search) {
    const searchConditions = SEARCH_FIELDS.map((field, idx) => {
      return `a.${field} ILIKE $${paramIndex + idx}`;
    });
    conditions.push(`(${searchConditions.join(' OR ')})`);
    params.push(...SEARCH_FIELDS.map(() => `%${filters.search}%`));
    paramIndex += SEARCH_FIELDS.length;
  }

  // Validate sort field
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const qualifiedSortField = `a.${sortField}`;
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Add pagination parameters
  params.push(limit, offset);

  const sql = `
    SELECT
      a.*, 
      u.name AS university_name,
      u.logo_url AS university_logo_url,
      u.city AS university_city,
      u.country AS university_country
    FROM admissions a
    LEFT JOIN universities u ON u.id = a.university_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${qualifiedSortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  return { sql, params };
}
