import { useCallback, useEffect, useRef, useState } from 'react';
import { acknowledgeAnnouncement, hasSeenAnnouncement, nextAnnouncement } from '../../Services/ProductAnnouncementService';

export default function useProductAnnouncement(uid, profile, suppress = false) {
  const [message, setMessage] = useState(null);
  const resolved = useRef(false);

  useEffect(() => { resolved.current = false; setMessage(null); }, [uid]);

  useEffect(() => {
    if (!uid || !profile) return;
    const tier = profile.usage?.tier === 'pro' ? 'pro' : 'free';
    if (!resolved.current) {
      // Decide once, from the first confirmed profile of this visit. This
      // avoids interrupting practice with a second dialog after upgrading.
      resolved.current = true;
      const announcement = suppress ? null : nextAnnouncement(uid, profile);
      if (announcement) setMessage({ uid, announcement });
    } else if (message?.uid === uid && (suppress
      || (message.announcement.audience !== 'all' && message.announcement.audience !== tier)
      || hasSeenAnnouncement(uid, message.announcement.id, profile))) {
      setMessage(null);
    }
  }, [uid, profile, suppress, message]);

  const dismiss = useCallback(() => {
    if (message?.uid !== uid) return;
    setMessage(null);
    acknowledgeAnnouncement(uid, message.announcement.id).catch(() => {
      console.warn('[announcement] Dismissal will remain saved on this device.');
    });
  }, [uid, message]);

  return { announcement: message?.uid === uid ? message.announcement : null, dismiss };
}
