'use strict';

const path = require('node:path');

module.exports = () => ({
  'ai-translator': {
    enabled: true,
    resolve: path.resolve(process.cwd(), '..'),
  },
});
