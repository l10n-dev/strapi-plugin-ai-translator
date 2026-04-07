import config from './config';
import routes from './routes/admin';
import contentTypeController from './controllers/content-type';
import translationController from './controllers/translation';
import settingsController from './controllers/settings';
import contentTypeService from './services/content-type';
import translationService from './services/translation';
import settingsService from './services/settings';

export default {
  register({ strapi }: { strapi: any }) {},

  bootstrap({ strapi }: { strapi: any }) {},

  destroy({ strapi }: { strapi: any }) {},

  config,

  controllers: {
    'content-type': contentTypeController,
    translation: translationController,
    settings: settingsController,
  },

  routes,

  services: {
    'content-type': contentTypeService,
    translation: translationService,
    settings: settingsService,
  },
};
