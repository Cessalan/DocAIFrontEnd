import React, { useState, useMemo } from 'react';
import './WebSourcesPanel.css';

/**
 * WebSourcesPanel — premium "sources from the web" card rendered in chat
 * when the backend grounds a quiz in web-search results (e.g. user named
 * a specific school or licensure board).
 *
 * Three states the parent can set via the `status` prop:
 *   "searching"  — animated skeleton, no citations yet
 *   "found"      — full panel with exam summary + citations
 *   "no_results" — honest fallback message, no citations
 *
 * Frontend never invents data: every citation must come from the
 * web_sources_found backend event.
 */
export default function WebSourcesPanel({
  status = 'found',
  school = null,
  examBoard = null,
  examSummary = '',
  citations = [],
  foundRealPapers = false,
  honestyNote = null,
  cached = false,
  fallbackMessage = null,
}) {
  const [expanded, setExpanded] = useState(false);

  const headerLabel = useMemo(() => {
    if (school && examBoard) return `${school} · ${examBoard}`;
    if (school) return school;
    if (examBoard) return examBoard;
    return 'Web research';
  }, [school, examBoard]);

  // Premium "skeleton" state shown while the research call is in flight
  if (status === 'searching') {
    return (
      <div className="web-sources-panel web-sources-panel--searching" role="status">
        <div className="web-sources-panel__header">
          <div className="web-sources-panel__icon-wrap">
            <SearchPulseIcon />
          </div>
          <div className="web-sources-panel__heading">
            <div className="web-sources-panel__eyebrow">Searching the web</div>
            <div className="web-sources-panel__title">{headerLabel}</div>
          </div>
        </div>
        <div className="web-sources-panel__skeleton-list">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (status === 'no_results') {
    return (
      <div className="web-sources-panel web-sources-panel--no-results">
        <div className="web-sources-panel__header">
          <div className="web-sources-panel__icon-wrap web-sources-panel__icon-wrap--muted">
            <SearchNoResultsIcon />
          </div>
          <div className="web-sources-panel__heading">
            <div className="web-sources-panel__eyebrow">No web sources found</div>
            <div className="web-sources-panel__title">{headerLabel}</div>
          </div>
        </div>
        <div className="web-sources-panel__honesty-note">
          {fallbackMessage || "I couldn't find specific online material for that exam — I'll generate practice at the typical standard for this kind of exam."}
        </div>
      </div>
    );
  }

  // Default "found" state
  const visibleCitations = expanded ? citations : citations.slice(0, 3);
  const hiddenCount = Math.max(0, citations.length - 3);

  return (
    <div className="web-sources-panel">
      <div className="web-sources-panel__header">
        <div className="web-sources-panel__icon-wrap">
          <WebGlobeIcon />
        </div>
        <div className="web-sources-panel__heading">
          <div className="web-sources-panel__eyebrow">
            {foundRealPapers ? 'Sources from the web' : 'Grounded in real material'}
          </div>
          <div className="web-sources-panel__title">{headerLabel}</div>
        </div>
        {cached && (
          <span className="web-sources-panel__badge web-sources-panel__badge--cached" title="Recently searched, served from cache">
            cached
          </span>
        )}
      </div>

      {examSummary && (
        <div className="web-sources-panel__summary">
          {examSummary}
        </div>
      )}

      {honestyNote && (
        <div className="web-sources-panel__honesty-note web-sources-panel__honesty-note--inline">
          {honestyNote}
        </div>
      )}

      {citations && citations.length > 0 && (
        <>
          <div className="web-sources-panel__sources-label">
            {citations.length} {citations.length === 1 ? 'source' : 'sources'}
          </div>
          <ul className="web-sources-panel__list">
            {visibleCitations.map((c, i) => (
              <CitationCard key={`${c.url}-${i}`} citation={c} index={i} />
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button
              type="button"
              className="web-sources-panel__expand-btn"
              onClick={() => setExpanded(true)}
            >
              Show {hiddenCount} more {hiddenCount === 1 ? 'source' : 'sources'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Citation card
// ──────────────────────────────────────────────────────────────────────

function CitationCard({ citation, index }) {
  const { url, title, snippet } = citation || {};
  const [faviconFailed, setFaviconFailed] = useState(false);

  const domain = useMemo(() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }, [url]);

  const faviconUrl = useMemo(() => {
    if (!domain) return null;
    // Google's public favicon service — no auth, just a CDN.
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }, [domain]);

  return (
    <li
      className="web-sources-panel__item"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <a
        className="web-sources-panel__link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <div className="web-sources-panel__favicon">
          {faviconUrl && !faviconFailed ? (
            <img
              src={faviconUrl}
              alt=""
              onError={() => setFaviconFailed(true)}
            />
          ) : (
            <DefaultFaviconIcon />
          )}
        </div>
        <div className="web-sources-panel__item-body">
          <div className="web-sources-panel__item-title" title={title}>
            {title || domain || 'Source'}
          </div>
          {domain && (
            <div className="web-sources-panel__item-domain">{domain}</div>
          )}
          {snippet && (
            <div className="web-sources-panel__item-snippet">{snippet}</div>
          )}
        </div>
        <div className="web-sources-panel__item-arrow" aria-hidden>
          <ArrowOutIcon />
        </div>
      </a>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Inline SVG icons (no extra dep)
// ──────────────────────────────────────────────────────────────────────

function WebGlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function SearchPulseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SearchNoResultsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
      <path d="M8 11h6" />
    </svg>
  );
}

function DefaultFaviconIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function ArrowOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <div className="web-sources-panel__skeleton-row">
      <div className="web-sources-panel__skeleton-favicon" />
      <div className="web-sources-panel__skeleton-text">
        <div className="web-sources-panel__skeleton-line web-sources-panel__skeleton-line--80" />
        <div className="web-sources-panel__skeleton-line web-sources-panel__skeleton-line--50" />
        <div className="web-sources-panel__skeleton-line web-sources-panel__skeleton-line--65" />
      </div>
    </div>
  );
}
