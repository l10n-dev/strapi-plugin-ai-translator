export default {
  admin: {
    type: 'admin',
    routes: [
      // Settings
      {
        method: 'GET',
        path: '/settings',
        handler: 'settings.getSettings',
        config: {
          policies: ['admin::isAuthenticatedAdmin'],
        },
      },
  {
    method: 'PUT',
    path: '/settings',
    handler: 'settings.updateSettings',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  // Content Types
  {
    method: 'GET',
    path: '/content-types',
    handler: 'content-type.list',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/content-types/:uid/entries',
    handler: 'content-type.entries',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/content-types/:uid/entries/:documentId',
    handler: 'content-type.entry',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  // Translation
  {
    method: 'POST',
    path: '/translate',
    handler: 'translation.translate',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/translate/bulk',
    handler: 'translation.translateBulk',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/translate/save',
    handler: 'translation.save',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/translate/status',
    handler: 'translation.status',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/translate/cancel',
    handler: 'translation.cancel',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
    ],
  },
};
