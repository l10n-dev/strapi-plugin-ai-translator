'use strict';

const SEED_ARTICLES = [
  {
    title: 'Getting Started with AI Translation',
    description: 'Learn how AI-powered translation can help you reach a global audience faster than ever before.',
    body: '## Introduction\n\nAI translation has revolutionized how businesses communicate across languages. With modern neural machine translation, you can translate entire content libraries in minutes.\n\n## Key Benefits\n\n- **Speed**: Translate thousands of words per hour\n- **Cost**: Reduce translation costs by up to 80%\n- **Consistency**: Maintain consistent terminology across all content\n\n## Getting Started\n\nTo begin, simply connect your API key and select the target languages for your content.',
  },
  {
    title: 'Best Practices for Multilingual Content',
    description: 'Discover proven strategies for managing content across multiple languages in your Strapi project.',
    body: '## Planning Your i18n Strategy\n\nBefore you start translating, it\'s important to have a clear content strategy. Decide which content types need translation and which locales you want to support.\n\n## Content Structure Tips\n\n1. Keep sentences short and clear\n2. Avoid idioms that may not translate well\n3. Use neutral language where possible\n\n## Quality Assurance\n\nAlways review AI-generated translations with a native speaker for critical content.',
  },
  {
    title: 'SEO for International Websites',
    description: 'How to optimize your multilingual Strapi site for search engines in different markets.',
    body: '## Why International SEO Matters\n\nReaching international audiences requires more than just translation. You need to optimize for local search engines and cultural nuances.\n\n## Technical Setup\n\n- Use hreflang tags to signal language variants\n- Create locale-specific slugs\n- Register separate sitemaps per locale\n\n## Content Localization vs. Translation\n\nTranslation converts words; localization adapts meaning. Great international content does both.',
  },
  {
    title: 'Strapi v5 Content Modeling Guide',
    description: 'A comprehensive guide to designing your content types for a multilingual Strapi v5 project.',
    body: '## Introduction to Content Modeling\n\nGood content modeling is the foundation of a successful CMS project. In Strapi v5, the Document Service API makes it easy to manage localized content.\n\n## Designing for i18n\n\nWhen creating content types, mark fields as "localized" only if they genuinely differ per language. Shared fields like dates or prices should not be localized.\n\n## Relationships in Multilingual Content\n\nBe careful with relations — they work at the document level in Strapi v5, not the locale level.',
  },
  {
    title: 'Automating Your Translation Workflow',
    description: 'Set up automated translation pipelines to keep your multilingual content always up to date.',
    body: '## The Challenge of Content Freshness\n\nKeeping translations up to date is one of the biggest challenges for multilingual teams. When source content changes, all translations become outdated.\n\n## Automation Strategies\n\n- Trigger translation on content publish\n- Use incremental mode to only translate changed fields\n- Set up review workflows for critical content\n\n## Incremental Translation\n\nThe AI Translator plugin supports incremental mode — it only translates fields that have changed since the last translation, saving time and API quota.',
  },
];

const SEED_PRODUCTS = [
  {
    name: 'Pro Translation Bundle',
    description: 'Unlimited AI translations for up to 10 content types. Perfect for growing businesses that need to scale their multilingual content.',
    price: 49.99,
  },
  {
    name: 'Enterprise Localization Suite',
    description: 'Full-featured localization platform with dedicated support, custom terminology management, and translation memory for large organizations.',
    price: 199.99,
  },
  {
    name: 'Starter Pack',
    description: 'Get started with AI translation for your Strapi project. Includes 100,000 characters per month and support for up to 5 languages.',
    price: 9.99,
  },
  {
    name: 'API Access Token — Monthly',
    description: 'Monthly subscription to the l10n.dev API with priority rate limits and access to the latest translation models.',
    price: 29.99,
  },
];

const SEED_HOMEPAGE = {
  heroTitle: 'Translate Your Content with AI',
  heroSubtitle: 'Reach a global audience by publishing your Strapi content in multiple languages — powered by the l10n.dev AI translation engine.',
};

async function seedData({ strapi }) {
  // Only seed if the DB is empty
  const articleCount = await strapi.documents('api::article.article').count({ locale: 'en' });
  if (articleCount > 0) return;

  strapi.log.info('[seed] Seeding playground with sample data...');

  for (const article of SEED_ARTICLES) {
    await strapi.documents('api::article.article').create({
      locale: 'en',
      data: { ...article, publishedAt: new Date().toISOString() },
    });
  }

  for (const product of SEED_PRODUCTS) {
    await strapi.documents('api::product.product').create({
      locale: 'en',
      data: { ...product, publishedAt: new Date().toISOString() },
    });
  }

  await strapi.documents('api::homepage.homepage').create({
    locale: 'en',
    data: { ...SEED_HOMEPAGE, publishedAt: new Date().toISOString() },
  });

  strapi.log.info('[seed] Done — created 5 articles, 4 products, and 1 homepage in English.');
}

module.exports = {
  register(/* { strapi } */) {},
  async bootstrap({ strapi }) {
    await seedData({ strapi });
  },
  destroy(/* { strapi } */) {},
};
