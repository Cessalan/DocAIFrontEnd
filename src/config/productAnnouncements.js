// Future releases: add an entry at the top and provide English/French copy
// below. Keep IDs stable after publishing; a NEW ID announces a new release.
// Disable an old entry when its news is no longer relevant. One unseen update
// is shown per app visit, and acknowledgements are saved on the account.
export const FASTER_QUIZZES_ANNOUNCEMENT_ID = 'faster-course-quizzes-v1';
export const PRODUCT_ANNOUNCEMENTS = [
  { id: FASTER_QUIZZES_ANNOUNCEMENT_ID, audience: 'pro', enabled: true, copyKey: 'fasterQuizzes' },
];

export const productAnnouncementsEn = {
  label: 'What’s new in Pro', close: 'Close announcement', continue: 'Got it. Let’s study',
  fasterQuizzes: {
    title: 'Your course quizzes just got faster.',
    body: 'As a Pro member, you now get priority generation for quizzes from your course notes.',
    detail: 'Less waiting, more time to practise.',
    included: 'No setup. It’s already part of your membership.',
  },
};
export const productAnnouncementsFr = {
  label: 'Les nouveautés de Pro', close: 'Fermer l’annonce', continue: 'Compris. Allons réviser',
  fasterQuizzes: {
    title: 'Tes quiz de cours sont maintenant plus rapides.',
    body: 'Avec Pro, tu bénéficies maintenant de la génération prioritaire des quiz à partir de tes notes de cours.',
    detail: 'Moins d’attente, plus de temps pour pratiquer.',
    included: 'Rien à configurer. C’est déjà inclus dans ton abonnement.',
  },
};
