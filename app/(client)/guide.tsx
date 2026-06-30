import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '@/constants/theme';

type Section = {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  steps: string[];
};

const SECTIONS: Section[] = [
  {
    icon: 'trending-up-outline',
    iconColor: Colors.accent,
    title: 'My Progress (Home)',
    subtitle: 'Your home screen — package balance, next session, and coach announcements.',
    steps: [
      'See your package details at a glance — how many sessions remain, how many you\'ve used, and whether you\'re on track with your schedule.',
      'If you have an upcoming session, it appears at the top with a live countdown timer so you always know when your next training is.',
      'Tap "Confirm Attendance" to let your coach know you\'re coming. Do this before your session starts.',
      'Tap "Cancel Session" if you can\'t make it. Important: this must be done more than 3 hours before the session. Once inside the 3-hour window, cancellations are locked.',
      'Tap "Request Session" to ask your coach for a new session. Fill in your preferred date, time, and any notes.',
      'When only 3 sessions remain in your package, a "Renew Package" button appears. Tap it to send a renewal request to your coach.',
      'Coach announcements (holidays, emergencies, promos) appear in the middle of this screen. Read them so you\'re always up to date.',
      'If you have an active strike, an orange warning banner appears at the top. 3 strikes = 1 session deducted from your package.',
    ],
  },
  {
    icon: 'barbell-outline',
    iconColor: '#FF9800',
    title: 'Workouts',
    subtitle: 'Your full workout history — every session, exercise, and set you\'ve done.',
    steps: [
      'Every past session is listed here — date, duration, and the full list of exercises performed.',
      'A summary row at the top shows your totals: sessions completed, minutes trained, and unique exercises done.',
      'Tap any month chip at the top to filter and see only the sessions from that specific month.',
      'Inside each session card you can see every exercise: name, sets, reps, and weight used.',
      'Within 48 hours after a session, a "Rate this session" button appears. Tap it to give your coach a 1–5 star rating.',
      'If you missed a scheduled session, it shows up in your history with a "NO-SHOW" badge and a note that 1 session was deducted.',
    ],
  },
  {
    icon: 'trophy-outline',
    iconColor: '#FFD700',
    title: 'Records',
    subtitle: 'Your personal bests and the progress photos uploaded by your coach.',
    steps: [
      'The top section shows your Personal Records (PRs) — the heaviest weight you\'ve lifted for each exercise, automatically tracked from your sessions.',
      'Your #1 PR gets a 🥇 gold medal, #2 gets 🥈 silver, and #3 gets 🥉 bronze.',
      'Each PR shows when you achieved it and how many times you\'ve performed that exercise.',
      'PRs update automatically after every session — no manual input needed.',
      'Scroll down to see your Progress Photos, uploaded by your coach to track your body transformation over time.',
      'Tap any photo to view it fullscreen. The date and label are shown at the bottom.',
    ],
  },
  {
    icon: 'chatbubbles-outline',
    iconColor: '#25D366',
    title: 'Messages',
    subtitle: 'Chat directly with your coach — no third-party apps needed.',
    steps: [
      'Send and receive messages with your coach without leaving the app.',
      'Type your message in the input box at the bottom and tap the send button.',
      'A single checkmark (✓) means your message was delivered. Double red checkmarks (✓✓) mean your coach has read it.',
      'All your conversation history is saved here — scroll up to revisit past messages anytime.',
    ],
  },
  {
    icon: 'person-outline',
    iconColor: Colors.textSecondary,
    title: 'Profile',
    subtitle: 'Your QR code, contact info, and account settings.',
    steps: [
      'Tap your profile photo to upload a new one from your camera roll.',
      'Your personal QR code is displayed here — show it to your coach at the start of every session for quick check-in.',
      'The QR code refreshes every 5 minutes for security. It cannot be copied or used by anyone else.',
      'Under "Contact & Social," tap Edit to add your phone number, WhatsApp, and Instagram.',
      'Your coach\'s contact details (phone and WhatsApp) are also shown here for easy access.',
      'Tap "User Guide" to come back and read this guide anytime.',
    ],
  },
  {
    icon: 'notifications-outline',
    iconColor: '#FF9800',
    title: 'Push Notifications',
    subtitle: 'Alerts sent straight to your phone — make sure notifications are turned on.',
    steps: [
      '📅 Session Scheduled — Your coach has booked a new session for you. Check My Progress for the details.',
      '⚠️ Package Almost Empty — Only 3 sessions left. Time to renew — use the "Renew Package" button on your home screen.',
      '⚡ Strike Recorded — You received a strike from your coach. The reason is included in the notification.',
      '⚡ 3 Strikes — Session Deducted — You reached 3 strikes. One session was deducted and your strike count has reset.',
      '✅ Request Accepted — Your coach accepted your booking or renewal request.',
      '❌ Request Declined — Your coach could not accommodate your request. Try a different date or message your coach.',
      '📢 Announcement — Your coach posted an update. Could be a holiday, promo, or emergency — read it right away.',
    ],
  },
  {
    icon: 'help-circle-outline',
    iconColor: '#9C27B0',
    title: 'FAQ',
    subtitle: 'Answers to the most common questions.',
    steps: [
      'Q: Why did my session count go down when I didn\'t train?\nA: Three possible reasons: (1) Your coach logged a session for you, (2) You had a no-show on a scheduled session, or (3) You accumulated 3 strikes. Check your Workouts tab to see what was recorded.',
      'Q: How do I cancel a session?\nA: Go to My Progress → find the Next Session card → tap "Cancel Session." Must be done more than 3 hours before the session starts.',
      'Q: How do I request a new session?\nA: Tap "Request Session" on the My Progress screen, fill in your preferred date and time, and send. Your coach will receive a notification and respond.',
      'Q: What happens when I get 3 strikes?\nA: One session is automatically deducted from your package and your strikes reset to zero. You\'ll receive a push notification when this happens.',
      'Q: Where are my progress photos?\nA: Go to the Records tab and scroll down to the "PROGRESS PHOTOS" section. Tap any photo to view it fullscreen.',
      'Q: I\'m not receiving notifications. What should I do?\nA: Go to your phone\'s Settings → Apps → ELEVAT3 → Notifications → enable "Allow Notifications." Then reopen the app.',
    ],
  },
];

function GuideCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.card}>
      <Pressable style={s.cardHeader} onPress={() => setOpen((v) => !v)}>
        <View style={[s.iconCircle, { backgroundColor: section.iconColor + '20', borderColor: section.iconColor + '40' }]}>
          <Ionicons name={section.icon as any} size={22} color={section.iconColor} />
        </View>
        <View style={s.headerText}>
          <Text style={s.cardTitle}>{section.title}</Text>
          <Text style={s.cardSubtitle} numberOfLines={open ? undefined : 1}>{section.subtitle}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
      </Pressable>

      {open && (
        <View style={s.steps}>
          {section.steps.map((step, i) => (
            <View key={i} style={s.step}>
              <View style={[s.stepNum, { backgroundColor: section.iconColor + '20' }]}>
                <Text style={[s.stepNumText, { color: section.iconColor }]}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ClientGuideScreen() {
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Ionicons name="book-outline" size={40} color={Colors.accent} />
        <Text style={s.heroTitle}>USER GUIDE</Text>
        <Text style={s.heroSub}>
          Tap each section to learn how it works.{'\n'}Simple, quick, and always here when you need it.
        </Text>
      </View>

      {SECTIONS.map((section) => (
        <GuideCard key={section.title} section={section} />
      ))}

      <View style={s.footer}>
        <Ionicons name="heart-outline" size={18} color={Colors.textSecondary} />
        <Text style={s.footerText}>Keep grinding! 💪</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, paddingBottom: 48 },

  hero: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
    backgroundColor: Colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.accent + '30',
    marginBottom: 16, gap: 8,
  },
  heroTitle: {
    ...Typography.label, color: Colors.accent,
    fontSize: 16, fontWeight: '800', letterSpacing: 2, marginTop: 4,
  },
  heroSub: {
    ...Typography.body, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },

  card: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 10, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, flexShrink: 0,
  },
  headerText: { flex: 1 },
  cardTitle: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  cardSubtitle: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 17 },

  steps: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 12,
  },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1,
  },
  stepNumText: { fontSize: 11, fontWeight: '800' },
  stepText: { ...Typography.body, color: Colors.textPrimary, flex: 1, lineHeight: 22 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  footerText: { ...Typography.body, color: Colors.textSecondary },
});
