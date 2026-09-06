/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Widen `extensions.integrity` so a checksum can carry its format version.
 *
 * The column was STRING(64) — exactly a bare SHA-256 hex digest, with no room
 * for the `v2:` prefix that distinguishes a checksum this build can verify
 * from one written by an older algorithm. Without that distinction an
 * algorithm change made every pre-existing install fail verification and be
 * reported as tampered, permanently: the activation path refuses before
 * reaching the code that would recompute and restamp.
 *
 * Existing values are left in place. They parse as unversioned, which the
 * worker treats as "cannot verify — recompute and restamp" rather than as
 * tampering, so each extension heals on its next activation.
 */
export async function up({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.changeColumn('extensions', 'integrity', {
    type: DataTypes.STRING(128),
    allowNull: true,
    unique: true,
    comment: 'Version-tagged integrity checksum of built extension files',
  });
}

/**
 * Revert the widening.
 *
 * Any value longer than 64 characters — i.e. every checksum written since the
 * upgrade — cannot fit the narrower column, so they are cleared rather than
 * truncated into a digest that would later be compared and rejected. A cleared
 * integrity is restamped on the extension's next activation.
 */
export async function down({ context, Sequelize }) {
  const { queryInterface } = context;
  const { DataTypes } = Sequelize;

  await queryInterface.sequelize.query(
    'UPDATE extensions SET integrity = NULL WHERE integrity IS NOT NULL AND LENGTH(integrity) > 64',
  );

  await queryInterface.changeColumn('extensions', 'integrity', {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true,
    comment: 'SHA-256 integrity hash of built extension files',
  });
}
