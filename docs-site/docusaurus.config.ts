import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Hestia',
  tagline:
    'A self-hosted, family-focused chore chart — free, open source, no subscription or cloud account required.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  url: 'https://wikid82.github.io',
  baseUrl: '/Hestia/',

  organizationName: 'Wikid82',
  projectName: 'Hestia',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/', // docs are the whole site, no separate marketing homepage
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/Wikid82/Hestia/tree/development/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    metadata: [
      {
        name: 'description',
        content:
          'Hestia is a free, self-hosted, family-focused chore chart. Assign or open-claim recurring chores, track points and streaks, and keep your data on your own server — no subscription, no cloud account.',
      },
      {
        name: 'keywords',
        content:
          'self-hosted chore chart, family chore tracker, chore chart app, open source chore chart, Sweepy alternative, household chore app, self-hosted family organizer',
      },
    ],
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Hestia',
      logo: {
        alt: 'Hestia logo',
        src: 'img/hestia_banner.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/Wikid82/Hestia',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Quick start', to: '/quick-start'},
            {label: 'Features', to: '/features'},
            {label: 'Troubleshooting', to: '/troubleshooting'},
            {label: 'FAQ', to: '/faq'},
          ],
        },
        {
          title: 'Project',
          items: [
            {label: 'GitHub', href: 'https://github.com/Wikid82/Hestia'},
            {
              label: 'Issues',
              href: 'https://github.com/Wikid82/Hestia/issues',
            },
            {
              label: 'License (MIT)',
              href: 'https://github.com/Wikid82/Hestia/blob/main/LICENSE',
            },
          ],
        },
      ],
      copyright: `Hestia is free and open source software, MIT-licensed. © ${new Date().getFullYear()}.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
