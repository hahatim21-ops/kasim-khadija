// Every editable value lives here — change content without touching the logic.
export const CONFIG = {
  siteUrl: 'https://REPLACE-AFTER-DEPLOY.vercel.app', // used for og:image absolute URL
  couple: 'Kasim & Khadija',
  timezone: 'Asia/Kolkata',
  nikah: {
    start: '2026-12-10T18:15:00+05:30',
    label: 'Nikah · Al Madina Masjid',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Al+Madina+Masjid+Agripada+Mumbai',
  },
  reception: {
    start: '2026-12-11T20:30:00+05:30',
    label: 'Reception · Islam Gymkhana',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Islam+Gymkhana+Marine+Drive+Mumbai',
  },
  music: { src: '/audio/song.mp3', volume: 0.6 },

  countdown: {
    nikahLabel: 'Counting down to the Nikah',
    receptionLabel: 'Counting down to the Reception',
    doneMessage: 'JazakAllah Khair for celebrating with us',
    againLabel: 'Open again',
  },

  // Intro curtain artwork (public/images/<id>-*.webp).
  curtain: '00-curtain',

  // Book pages, front to back. The text is printed in the artwork, so alt text carries it for screen readers.
  pages: [
    { id: '01-cover', label: 'Cover', alt: "Dusty-rose book cover with a gold oval frame and the couple's Arabic monogram." },
    { id: '02-bismillah', label: 'Bismillah', alt: 'Bismillah ir-Rahman ir-Raheem. Khadija and Kasim, written in Arabic.' },
    { id: '03-invitation', label: 'Invitation', alt: 'We cordially invite you to the Nikah and Reception of Kasim, son of Arifa and Shabbir Darbar, with Khadija, daughter of Nazia and Farman Sopariwala.' },
    { id: '04-nikah', label: 'Nikah', alt: 'Nikah. Friday, 10th December, 1 Rajab 1448 AH. After Salat ul Maghrib, 6:15 PM, at Al Madina Masjid, Agripada.' },
    { id: '05-reception', label: 'Reception', alt: 'Reception. Saturday, 11th December, 2 Rajab 1448 AH. 8:30 PM onwards, at Islam Gymkhana, Marine Drive, Mumbai.' },
    { id: '06-awaiting', label: 'Awaiting your presence', alt: 'Awaiting your presence. The Sopariwala family.' },
    { id: '07-back-cover', label: 'Countdown & directions', alt: 'Back cover of the invitation book.' },
  ],
};
