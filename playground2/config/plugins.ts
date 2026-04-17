import path from 'path';
import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'ai-translator': {
    enabled: true,
    resolve: path.resolve(process.cwd(), '..'),
  },
});

export default config;
