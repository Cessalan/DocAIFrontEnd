import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DIFFICULTIES, FORMATS, describeProfile, effectiveFormats, setDifficulty, toggleFormat } from './practiceProfileModel';
import './PracticeSettingsLine.css';

/**
 * One line under the practice title saying what this chat remembers
 * ("From Cardiac 2.pdf · Multiple choice + Select all · no ordering
 * questions · harder"), and the place to change it by hand.
 *
 * It exists so she can SEE that "no ordering" was kept instead of finding
 * out on the next batch. See practiceProfileModel.js.
 */
export default function PracticeSettingsLine({ profile, guess, onChange, readOnly = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const parts = describeProfile(profile, guess);
  const formats = effectiveFormats(profile, guess);

  const label = part => (part.key === 'practiceProfile.formats'
    ? part.formats.map(f => t(`practiceProfile.format.${f}`)).join(' + ')
    : t(part.key, part.values));

  async function apply(next) {
    if (next === profile) { setStatus(t('practiceProfile.lastFormat')); return; }
    try { await onChange(next); setStatus(t('practiceProfile.saved')); }
    catch { setStatus(t('practiceProfile.saveFailed')); }
  }

  if (readOnly && !parts.length) return null;
  return (
    <div className="practice-settings" aria-label={t('practiceProfile.aria')}>
      <p className="practice-settings-line">
        {parts.map(label).join(' · ')}
        {!readOnly && onChange && (
          <button type="button" aria-expanded={open} onClick={() => { setOpen(v => !v); setStatus(''); }}>
            {open ? t('practiceProfile.done') : t('practiceProfile.adjust')}
          </button>
        )}
      </p>
      {open && (
        <div className="practice-settings-panel">
          <fieldset>
            <legend>{t('practiceProfile.typesHeading')}</legend>
            {FORMATS.map(format => (
              <label key={format}>
                <input type="checkbox" checked={formats.includes(format)}
                  onChange={e => apply(toggleFormat(profile || {}, format, e.target.checked, { guess }))} />
                {t(`practiceProfile.format.${format}`)}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{t('practiceProfile.difficultyHeading')}</legend>
            {DIFFICULTIES.map(level => (
              <label key={level}>
                <input type="radio" name="practice-difficulty" checked={profile?.difficulty === level}
                  onChange={() => apply(setDifficulty(profile || {}, level))} />
                {t(`practiceProfile.level.${level}`)}
              </label>
            ))}
          </fieldset>
          {status && <p className="practice-settings-status" role="status">{status}</p>}
        </div>
      )}
    </div>
  );
}
