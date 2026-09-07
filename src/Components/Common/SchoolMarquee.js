import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LANDING_SCHOOLS,
  LOGO_MIN_PX,
  MARQUEE_ROWS,
  SCHOOL_COUNT,
  logoUrl,
  marqueeTrack,
  monogram,
  rowDuration,
  rowReversed,
  rowsOf,
  tileColor
} from './schoolWall';
import './SchoolMarquee.css';

/**
 * SchoolMarquee — the "students from 180+ nursing schools" row on the landing page.
 *
 * Social proof from a stranger's list of schools only works if the student spots
 * one she recognises, and a static grid of eight puts that bet on eight names. A
 * loop shows forty instead, so the odds of a hit go up without the page growing
 * proportionally — three shallow rows fit the whole list in roughly the height a
 * single row of eight would have taken.
 *
 * See schoolWall.js for where the count comes from, where each school's logo is
 * fetched from, and why a logo that arrives too small is dropped for a monogram.
 */

/**
 * One school's tile: the school's own logo, or its monogram.
 *
 * The logo is only trusted once it has actually loaded at a usable size — nothing
 * can know a remote icon's resolution before the bytes arrive, so the check has to
 * happen in `onLoad`. Until it passes, the img sits at opacity 0 over the monogram
 * and is faded in once it clears LOGO_MIN_PX.
 *
 * It has to be opacity and not `hidden`: Chrome does not fetch a `loading="lazy"`
 * image that is `display: none`, so hiding it that way would deadlock the gate —
 * never loaded, never measured, never shown. A tile whose logo is rejected or
 * errors keeps the monogram and looks like any other monogram tile.
 *
 * `armed` gates the request itself; see the observer in SchoolMarquee.
 */
const SchoolChip = ({ school, armed }) => {
  const [logoState, setLogoState] = useState('pending'); // 'pending' | 'ok' | 'rejected'
  const src = logoUrl(school);

  const handleLoad = (event) => {
    setLogoState(event.target.naturalWidth >= LOGO_MIN_PX ? 'ok' : 'rejected');
  };

  const showLogo = armed && Boolean(src) && logoState !== 'rejected';
  const logoVisible = showLogo && logoState === 'ok';

  return (
    <div className="school-chip">
      <span
        className={`school-chip-mark${logoVisible ? ' has-logo' : ''}`}
        style={logoVisible ? undefined : { backgroundColor: tileColor(school.name) }}
        aria-hidden="true"
      >
        <span className="school-chip-initials">{school.mark || monogram(school.name)}</span>
        {showLogo && (
          <img
            className={`school-chip-logo${logoVisible ? ' is-visible' : ''}`}
            src={src}
            alt=""
            decoding="async"
            fetchPriority="low"
            onLoad={handleLoad}
            onError={() => setLogoState('rejected')}
          />
        )}
      </span>
      <span className="school-chip-name">{school.short || school.name}</span>
    </div>
  );
};

/**
 * @param {Array}  [schools] Defaults to LANDING_SCHOOLS.
 * @param {number} [count]   Headline number; defaults to the audited SCHOOL_COUNT.
 */
const SchoolMarquee = ({ schools = LANDING_SCHOOLS, count = SCHOOL_COUNT }) => {
  const { t } = useTranslation();
  const sectionRef = useRef(null);
  const [armed, setArmed] = useState(false);
  const rows = rowsOf(schools, MARQUEE_ROWS);

  /**
   * Hold the 42 logo requests until the section is nearly in view — they are all
   * below the fold, and the hero has to paint first for a logged-out visitor.
   *
   * This has to be an observer on the *section*, not `loading="lazy"` on each img.
   * The chips are laid out far off-screen and brought into view by a CSS transform,
   * and a transform does not make the browser reconsider a lazy image: measured on
   * 2026-09-06, 25 of the 42 never loaded at all and sat on their monogram forever.
   * Once the section is close, every logo is fetched regardless of where the track
   * has translated it to.
   */
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setArmed(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setArmed(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className="school-marquee-section"
      ref={sectionRef}
      aria-labelledby="school-marquee-heading"
    >
      <div className="school-marquee-container">
        <h2 id="school-marquee-heading" className="school-marquee-title">
          {t('landing.schoolsTitle', 'Used by students from {{count}}+ nursing schools', { count })}
        </h2>
        <p className="school-marquee-subtitle">
          {t('landing.schoolsSubtitle', 'From community college ADN programs to university BSN and NP tracks')}
        </p>

        <div
          className="school-marquee"
          role="group"
          aria-label={t('landing.schoolsListLabel', 'A sample of the schools our students attend')}
        >
          {rows.map((row, rowIndex) => (
            <div
              className={`school-marquee-row${rowReversed(rowIndex) ? ' is-reversed' : ''}`}
              key={`row-${rowIndex}`}
              style={{ '--school-marquee-duration': `${rowDuration(row.length, rowIndex)}s` }}
            >
              <div className="school-marquee-track" role="list">
                {marqueeTrack(row).map((school) => (
                  <div
                    className="school-marquee-item"
                    key={school.key}
                    role={school.duplicate ? 'presentation' : 'listitem'}
                    aria-hidden={school.duplicate ? 'true' : undefined}
                  >
                    <SchoolChip school={school} armed={armed} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="school-marquee-note">
          {t(
            'landing.schoolsDisclaimer',
            'School names identify where our students study. No affiliation or endorsement is implied.'
          )}
        </p>
      </div>
    </section>
  );
};

export default SchoolMarquee;
