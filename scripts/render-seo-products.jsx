import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SeoMiniProduct from '../src/Components/SeoPractice/SeoMiniProduct';
export function renderPage(slug) {
  return renderToString(<MemoryRouter initialEntries={[`/${slug}`]}><SeoMiniProduct slug={slug} /></MemoryRouter>);
}
