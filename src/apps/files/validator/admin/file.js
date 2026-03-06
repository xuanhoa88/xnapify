/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Create folder schema - callable factory function
 *
 * Used by:
 * - Frontend: Create folder prompt
 * - Backend: POST /api/admin/files/folder
 */
export const createFolderFormSchema = ({ i18n, z }) =>
  z.object({
    name: z
      .string()
      .min(
        1,
        i18n.t('zod:admin.folder.NAME_REQUIRED', 'Folder name is required'),
      )
      .max(
        255,
        i18n.t('zod:admin.folder.NAME_TOO_LONG', 'Folder name is too long'),
      )
      .refine(
        val => !/[\\/:*?"<>|]/.test(val),
        i18n.t(
          'zod:admin.folder.INVALID_CHARACTERS',
          'Folder name contains invalid characters',
        ),
      ),
    parentId: z.string().uuid().nullable().optional(),
  });

/**
 * Rename file/folder schema
 */
export const renameFileFormSchema = ({ i18n, z }) =>
  z.object({
    name: z
      .string()
      .min(1, i18n.t('zod:admin.folder.NAME_REQUIRED', 'Name is required'))
      .max(255, i18n.t('zod:admin.folder.NAME_TOO_LONG', 'Name is too long'))
      .refine(
        val => !/[\\/:*?"<>|]/.test(val),
        i18n.t(
          'zod:admin.folder.INVALID_CHARACTERS',
          'Name contains invalid characters',
        ),
      ),
  });

/**
 * Share file schema
 */
export const shareFileFormSchema = ({ i18n, z }) =>
  z.object({
    shareType: z.enum(['private', 'public_link', 'shared_users'], {
      errorMap: () => ({
        message: i18n.t(
          'zod:admin.file.INVALID_SHARE_TYPE',
          'Invalid share type',
        ),
      }),
    }),
  });
