/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Get dashboard statistics
 *
 * Returns system-wide statistics including user counts, role counts,
 * system status, and recent user activity.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 * @returns {Promise<void>}
 */
export async function getDashboard(req, res, next) {
  try {
    const { User, Role, Group, UserLogin, UserProfile } = req.app.get('models');

    // Get total users count
    const totalUsers = await User.count();

    // Get active users count
    const activeUsers = await User.count({
      where: { is_active: true },
    });

    // Get total roles count
    const totalRoles = await Role.count();

    // Get active roles count
    const activeRoles = await Role.count({
      where: { is_active: true },
    });

    // Get total groups count
    const totalGroups = await Group.count();

    // Get active groups count
    const activeGroups = await Group.count({
      where: { is_active: true },
    });

    // Get recent user logins (last 10)
    const recentActivity = await UserLogin.findAll({
      limit: 10,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email'],
          include: [
            {
              model: UserProfile,
              as: 'profile',
              attributes: ['first_name', 'last_name', 'display_name'],
            },
          ],
        },
      ],
    });

    // Format recent activity
    const formattedActivity = recentActivity.map(login => {
      const { user } = login;
      let displayName = '';

      if (user) {
        if (user.profile) {
          if (user.profile.display_name) {
            displayName = user.profile.display_name;
          } else if (user.profile.first_name || user.profile.last_name) {
            displayName =
              `${user.profile.first_name || ''} ${user.profile.last_name || ''}`.trim();
          }
        }

        if (!displayName) {
          displayName = user.email;
        }
      }

      return {
        id: login.id,
        user: user
          ? {
              id: user.id,
              email: user.email,
              displayName,
            }
          : null,
        action: login.success ? 'Login' : 'Failed login attempt',
        date: login.created_at,
        status: login.success ? 'success' : 'warning',
        ip: login.ip_address,
      };
    });

    // Calculate uptime (simplified - in production, use actual uptime tracking)
    const uptime = '99.9%';
    const systemStatus = 'Healthy';

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          totalRoles,
          activeRoles,
          totalGroups,
          activeGroups,
          systemStatus,
          uptime,
        },
        recentActivity: formattedActivity,
      },
    });
  } catch (error) {
    next(error);
  }
}
