import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { EventRow } from '../db.ts';
import {
  buildEventMeta, buildRobotsTxt, buildSitemapXml, FALLBACK_META, indexingAllowed,
  renderIndexHtml, resolveOrigin
} from '../seo/index.ts';
import type { EventService } from '../services/event.service.ts';
import type { EventRepository } from '../repositories/types.ts';

export interface SpaDeps {
  staticDir: string;
  events: EventService;
  eventRows: Pick<EventRepository, 'listAll' | 'findBySlug'>;
}

export function createSpaRoutes({ staticDir, events, eventRows }: SpaDeps): Router {
  const router = Router();
  const indexPath = path.join(staticDir, 'index.html');

  let indexTemplate: string | null = null;
  const readIndexTemplate = (): string => {
    if (indexTemplate === null) indexTemplate = fs.readFileSync(indexPath, 'utf8');
    return indexTemplate;
  };

  const eventForPath = (pathname: string): EventRow | undefined => {
    if (pathname === '/' || pathname === '/index.html') return events.defaultEvent();
    const match = /^\/e\/([^/]+)\/?$/.exec(pathname);
    return match ? eventRows.findBySlug(decodeURIComponent(match[1])) : undefined;
  };

  router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(buildRobotsTxt(resolveOrigin(req), indexingAllowed()));
  });

  router.get('/sitemap.xml', (req, res) => {
    const origin = resolveOrigin(req);
    if (!origin || !indexingAllowed()) return res.status(404).type('text/plain').send('Not found');
    res.type('application/xml').send(buildSitemapXml(eventRows.listAll(), origin));
  });

  router.get('/index.html', (_req, res) => res.redirect(301, '/'));

  router.use(express.static(staticDir, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  router.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) {
      return next();
    }
    let html: string;
    try {
      html = readIndexTemplate();
    } catch {
      return next();
    }
    const row = eventForPath(req.path);
    const meta = row ? buildEventMeta(row, resolveOrigin(req), indexingAllowed()) : FALLBACK_META;
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(renderIndexHtml(html, meta));
  });

  return router;
}
