/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Core user models (factory functions)
import createUserModel from './User';
import createUserLoginModel from './UserLogin';
import createUserProfileModel from './UserProfile';

// RBAC models (factory functions)
import createRoleModel from './Role';
import createPermissionModel from './Permission';
import createGroupModel from './Group';

// Junction tables (factory functions)
import createUserRoleModel from './UserRole';
import createRolePermissionModel from './RolePermission';
import createUserGroupModel from './UserGroup';
import createGroupRoleModel from './GroupRole';

// Token models (factory functions)
import createPasswordResetTokenModel from './PasswordResetToken';

/**
 * Initialize user-related model relationships
 *
 * This function sets up all relationships between user models.
 * Called internally by the factory function.
 *
 * @param {Object} models - All model instances
 */
function initializeUserRelationships(models) {
  const {
    User,
    UserLogin,
    UserProfile,
    Role,
    Permission,
    Group,
    UserRole,
    RolePermission,
    UserGroup,
    GroupRole,
    PasswordResetToken,
  } = models;
  // ============================================================================
  // User Relationships
  // ============================================================================

  // User <-> UserLogin (One-to-Many)
  User.hasMany(UserLogin, {
    foreignKey: 'user_id',
    as: 'logins',
    onUpdate: 'cascade',
    onDelete: 'cascade',
  });
  UserLogin.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  // User <-> UserProfile (One-to-One)
  User.hasOne(UserProfile, {
    foreignKey: 'user_id',
    as: 'profile',
    onUpdate: 'cascade',
    onDelete: 'cascade',
  });
  UserProfile.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  // ============================================================================
  // RBAC Relationships
  // ============================================================================

  // User <-> Role (Many-to-Many through UserRole)
  User.belongsToMany(Role, {
    through: UserRole,
    foreignKey: 'user_id',
    otherKey: 'role_id',
    as: 'roles',
  });
  Role.belongsToMany(User, {
    through: UserRole,
    foreignKey: 'role_id',
    otherKey: 'user_id',
    as: 'users',
  });

  // Role <-> Permission (Many-to-Many through RolePermission)
  Role.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: 'role_id',
    otherKey: 'permission_id',
    as: 'permissions',
  });
  Permission.belongsToMany(Role, {
    through: RolePermission,
    foreignKey: 'permission_id',
    otherKey: 'role_id',
    as: 'roles',
  });

  // User <-> Group (Many-to-Many through UserGroup)
  User.belongsToMany(Group, {
    through: UserGroup,
    foreignKey: 'user_id',
    otherKey: 'group_id',
    as: 'groups',
  });
  Group.belongsToMany(User, {
    through: UserGroup,
    foreignKey: 'group_id',
    otherKey: 'user_id',
    as: 'users',
  });

  // Group <-> Role (Many-to-Many through GroupRole)
  Group.belongsToMany(Role, {
    through: GroupRole,
    foreignKey: 'group_id',
    otherKey: 'role_id',
    as: 'roles',
  });
  Role.belongsToMany(Group, {
    through: GroupRole,
    foreignKey: 'role_id',
    otherKey: 'group_id',
    as: 'groups',
  });

  // ============================================================================
  // Token Relationships
  // ============================================================================

  // User <-> PasswordResetToken (One-to-Many)
  User.hasMany(PasswordResetToken, {
    foreignKey: 'user_id',
    as: 'passwordResetTokens',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  });
  PasswordResetToken.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user',
  });
}

/**
 * Auth Models Factory
 *
 * Factory function for initializing user models and their relationships.
 * Called by API bootstrap during model discovery.
 *
 * This function sets up all Sequelize model relationships for the user module:
 * - User <-> UserLogin (One-to-Many)
 * - User <-> UserProfile (One-to-One)
 * - User <-> Role (Many-to-Many through UserRole)
 * - Role <-> Permission (Many-to-Many through RolePermission)
 * - User <-> Group (Many-to-Many through UserGroup)
 * - Group <-> Role (Many-to-Many through GroupRole)
 *
 * @param {Object} db - Sequelize instance for database operations
 * @returns {Object} Auth models with initialized relationships
 * @returns {Model} .User - User model
 * @returns {Model} .UserLogin - UserLogin model (OAuth providers)
 * @returns {Model} .UserProfile - UserProfile model
 * @returns {Model} .Role - Role model (RBAC)
 * @returns {Model} .Permission - Permission model (RBAC)
 * @returns {Model} .Group - Group model (RBAC)
 * @returns {Model} .UserRole - UserRole junction table
 * @returns {Model} .RolePermission - RolePermission junction table
 * @returns {Model} .UserGroup - UserGroup junction table
 * @returns {Model} .GroupRole - GroupRole junction table
 */
export default function initializeAuthModels(db) {
  // Initialize all models with sequelize instance
  const User = createUserModel(db);
  const UserLogin = createUserLoginModel(db);
  const UserProfile = createUserProfileModel(db);
  const Role = createRoleModel(db);
  const Permission = createPermissionModel(db);
  const Group = createGroupModel(db);
  const UserRole = createUserRoleModel(db);
  const RolePermission = createRolePermissionModel(db);
  const UserGroup = createUserGroupModel(db);
  const GroupRole = createGroupRoleModel(db);
  const PasswordResetToken = createPasswordResetTokenModel(db);

  // Prepare models object for relationships
  const models = {
    User,
    UserLogin,
    UserProfile,
    Role,
    Permission,
    Group,
    UserRole,
    RolePermission,
    UserGroup,
    GroupRole,
    PasswordResetToken,
  };

  // Initialize all model relationships
  initializeUserRelationships(models);

  // Return all models
  return models;
}
