'use strict';

module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'dev-admin-jwt-secret-change-me'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'dev-api-token-salt-change-me'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'dev-transfer-token-salt'),
    },
  },
});
