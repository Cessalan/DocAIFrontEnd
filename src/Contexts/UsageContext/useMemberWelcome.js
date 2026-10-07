import { useCallback, useEffect, useRef, useState } from 'react';
import { acknowledgeMemberWelcome, hasSeenMemberWelcome, memberActivationKey, watchMembership } from '../../Services/MemberWelcomeService';
import { acknowledgeAnnouncement } from '../../Services/ProductAnnouncementService';
import { FASTER_QUIZZES_ANNOUNCEMENT_ID } from '../../config/productAnnouncements';

export default function useMemberWelcome(uid, onProfile) {
  const [welcome, setWelcome] = useState(null);
  const [membership, setMembership] = useState(null);
  const dismissed = useRef(null);

  useEffect(() => {
    setWelcome(null);
    setMembership(null);
    dismissed.current = null;
    if (!uid) return undefined;
    let active = true;
    const unsubscribe = watchMembership(uid, (profile) => {
      if (!active) return;
      onProfile(profile);
      setMembership({ uid, profile });
      const key = memberActivationKey(profile);
      if (key && dismissed.current !== key && !hasSeenMemberWelcome(uid, key, profile)) {
        setWelcome((current) => current?.uid === uid && current?.key === key ? current : { uid, key });
      } else {
        setWelcome(null);
      }
    }, () => { /* Quota refresh still works if the live listener is unavailable. */ });
    return () => { active = false; unsubscribe(); };
  }, [uid, onProfile]);

  const dismiss = useCallback(({ seenAnnouncementIds = [] } = {}) => {
    if (!welcome || welcome.uid !== uid) return;
    dismissed.current = welcome.key;
    setWelcome(null);
    acknowledgeMemberWelcome(uid, welcome.key).catch(() => {
      console.warn('[membership] Welcome acknowledgement will remain saved on this device.');
    });
    // Members who saw the speed reveal already know the news. If they skip
    // the reveal, the update can still reach them on their next visit.
    if (seenAnnouncementIds.includes(FASTER_QUIZZES_ANNOUNCEMENT_ID)) {
      acknowledgeAnnouncement(uid, FASTER_QUIZZES_ANNOUNCEMENT_ID).catch(() => {
        console.warn('[announcement] Dismissal will remain saved on this device.');
      });
    }
  }, [uid, welcome]);

  return { welcome: welcome?.uid === uid ? welcome : null, dismiss, profile: membership?.uid === uid ? membership.profile : null };
}
