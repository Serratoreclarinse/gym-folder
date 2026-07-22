import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Typography, ColorScheme } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

type Section = {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  steps: string[];
};

// Colors.accent and Colors.textSecondary references in SECTIONS are left as
// hardcoded hex strings since SECTIONS is a static module-level constant.
// The actual accent color (#E8001D) and textSecondary (#888) are used directly.
const SECTIONS: Section[] = [
  {
    icon: 'home-outline',
    iconColor: '#E8001D',
    title: 'Dashboard',
    subtitle: 'Your command center — everything important at a glance.',
    steps: [
      'View your active client count, sessions logged this month, and total training hours.',
      'If a session is currently running, the active timer card appears here. Extend, pause, or end the session directly from this screen.',
      'Your next scheduled session is displayed with a live countdown — always know who\'s coming in next.',
      'Booking and renewal requests from clients appear here. Tap Accept or Decline to respond.',
      'If any client reaches 3 strikes, a red alert card appears so you can take action immediately.',
      'Client birthdays are shown here so you never miss a chance to greet them.',
    ],
  },
  {
    icon: 'people-outline',
    iconColor: '#4CAF50',
    title: 'Clients',
    subtitle: 'View and manage all your clients and their full profiles.',
    steps: [
      'See all your clients with their profile photo, name, and how many sessions remain in their package.',
      'Tap a client\'s name to open their full profile — sessions, strikes, files, and contact details.',
      'Inside each client profile there are 3 tabs: Sessions (workout history), Files (photos & documents), and Details (contact info).',
      'Upload progress photos, InBody results, and other documents for each client under the Files tab.',
      'Issue a strike if a client breaks the rules. On the 3rd strike, one session is automatically deducted from their package and strikes reset to zero.',
      'View the star ratings (1–5) your clients give after each session to track their satisfaction.',
    ],
  },
  {
    icon: 'calendar-outline',
    iconColor: '#9C27B0',
    title: 'Calendar',
    subtitle: 'See all scheduled sessions in a monthly calendar view.',
    steps: [
      'Every scheduled session appears on the calendar. Days with sessions are marked with a dot.',
      'Tap any day to see who is scheduled and at what time.',
      'Navigate between months using the arrow buttons at the top.',
      'There\'s a shortcut here to schedule a new session directly from the calendar.',
    ],
  },
  {
    icon: 'list-outline',
    iconColor: '#FF9800',
    title: 'Sessions',
    subtitle: 'Full history of all logged sessions, newest first.',
    steps: [
      'All past sessions are listed here from most recent to oldest.',
      'Each session shows the client name, date, duration, and exercises performed.',
      'Filter by date or client to quickly find a specific session.',
    ],
  },
  {
    icon: 'timer-outline',
    iconColor: '#00BCD4',
    title: 'Timer / Guided Workout',
    subtitle: 'Run a live workout with your client — timer and logging in one place.',
    steps: [
      'Select a client to start. The session timer begins running immediately.',
      'Log each exercise as you go: name, sets, reps, and weight.',
      'A rest timer pops up between sets so your client knows exactly when to start again.',
      'Pause the session anytime (water break, phone call) and resume when ready.',
      'When done, tap End Session. The full workout is saved automatically — no separate logging needed.',
      'Load a saved template to instantly fill in your exercises — no need to type everything from scratch.',
    ],
  },
  {
    icon: 'qr-code-outline',
    iconColor: '#FFD700',
    title: 'QR Scanner',
    subtitle: 'Fast client check-in by scanning their personal QR code.',
    steps: [
      'Ask the client to open their Profile tab in the app to display their QR code.',
      'Open the QR Scanner tab and point your camera at the client\'s QR code.',
      'The app instantly identifies the client — no manual searching required.',
      'Each QR code refreshes every 5 minutes for security and cannot be copied or shared.',
    ],
  },
  {
    icon: 'pencil-outline',
    iconColor: '#E8001D',
    title: 'Log Session',
    subtitle: 'Manually record a session after it has been completed.',
    steps: [
      'Select the client, session date using the calendar picker, and duration (30, 45, or 60 min).',
      'Choose the session type — Gym or Home training.',
      'Add each exercise performed: name, sets, reps, and weight used.',
      'Add optional session notes (e.g. "Focused on upper body today").',
      'Once saved, the client\'s remaining sessions automatically decrease by 1.',
      'If only 3 sessions remain after logging, the client automatically receives a push notification to renew.',
    ],
  },
  {
    icon: 'calendar-clear-outline',
    iconColor: '#4CAF50',
    title: 'Schedule Session',
    subtitle: 'Book a future session for a client. They\'ll be notified instantly.',
    steps: [
      'Select a client, date, and time for the upcoming session.',
      'Choose the duration (30, 45, or 60 min) and location type (Gym or Home).',
      'Optionally add notes so the client knows what to expect (e.g. "Leg day!").',
      'Once saved, the client receives a push notification with the full schedule details.',
      'Clients can confirm their attendance directly within the app.',
    ],
  },
  {
    icon: 'megaphone-outline',
    iconColor: '#FF9800',
    title: 'Announcements',
    subtitle: 'Send messages to all or specific clients. 4 announcement types available.',
    steps: [
      'General — for everyday updates like schedule changes or reminders.',
      'Emergency — for urgent messages (e.g. cancelled session). Appears with a red highlight in the client app.',
      'Holiday — to notify clients of rest days or gym closures.',
      'Promo — for special offers or package discounts.',
      'Choose whether to send to all clients or select specific individuals.',
      'Pin an announcement to keep it visible at the top of clients\' home screens.',
    ],
  },
  {
    icon: 'document-text-outline',
    iconColor: '#9C27B0',
    title: 'Templates',
    subtitle: 'Save your go-to workout plans so you never have to retype them.',
    steps: [
      'Create a template with a name (e.g. "Push Day") and a full list of exercises with sets, reps, and weights.',
      'When logging a session or using the timer, load a template to instantly populate all exercises.',
      'Edit or delete templates anytime from the Templates screen.',
    ],
  },
  {
    icon: 'bar-chart-outline',
    iconColor: '#4CAF50',
    title: 'Revenue Report',
    subtitle: 'Track your earnings and export reports for your records.',
    steps: [
      'View your monthly revenue with a bar chart showing income trends over time.',
      'See a per-client breakdown — who paid, how much, and when.',
      'Filter by month to review a specific period.',
      'Tap Share Report to export the data — useful for bookkeeping and business management.',
    ],
  },
  {
    icon: 'time-outline',
    iconColor: '#00BCD4',
    title: 'Availability',
    subtitle: 'Set your working hours for each day of the week.',
    steps: [
      'For each day of the week, define the hours you are available for training (e.g. Monday–Saturday, 6 AM – 8 PM).',
      'Clients will see your available hours when submitting a session request.',
    ],
  },
  {
    icon: 'ban-outline',
    iconColor: '#E8001D',
    title: 'Blocked Dates',
    subtitle: 'Mark days when you are unavailable — vacation, rest days, or holidays.',
    steps: [
      'Mark specific dates as blocked if you have a vacation, holiday, or any other reason you cannot train.',
      'No sessions can be scheduled on blocked dates.',
    ],
  },
  {
    icon: 'chatbubbles-outline',
    iconColor: '#25D366',
    title: 'Chat',
    subtitle: 'Message your clients directly inside the app.',
    steps: [
      'Send and receive messages with your clients without needing a separate messaging app.',
      'A double red checkmark (✓✓) means the client has read your message.',
      'To open a client\'s chat, go to their profile and tap the chat bubble icon at the top.',
    ],
  },
  {
    icon: 'person-outline',
    iconColor: '#888',
    title: 'Profile',
    subtitle: 'Manage your personal information and account settings.',
    steps: [
      'Update your profile photo, display name, email address, and password.',
      'Add your phone number, WhatsApp, and Instagram so clients can easily reach you.',
      'This User Guide is also available here anytime you need a refresher.',
    ],
  },
];

function GuideCard({ section, colors, styles }: { section: Section; colors: ColorScheme; styles: ReturnType<typeof makeStyles> }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable style={styles.cardHeader} onPress={() => setOpen((v) => !v)}>
        <View style={[styles.iconCircle, { backgroundColor: section.iconColor + '20', borderColor: section.iconColor + '40' }]}>
          <Ionicons name={section.icon as any} size={22} color={section.iconColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>{section.title}</Text>
          <Text style={styles.cardSubtitle} numberOfLines={open ? undefined : 1}>{section.subtitle}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </Pressable>

      {open && (
        <View style={styles.steps}>
          {section.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: section.iconColor + '20' }]}>
                <Text style={[styles.stepNumText, { color: section.iconColor }]}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function CoachGuideScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Ionicons name="book-outline" size={40} color={colors.accent} />
        <Text style={s.heroTitle}>COACH USER GUIDE</Text>
        <Text style={s.heroSub}>
          Tap each section to learn how it works.{'\n'}Everything you need is right here.
        </Text>
      </View>

      {SECTIONS.map((section) => (
        <GuideCard key={section.title} section={section} colors={colors} styles={s} />
      ))}

      <View style={s.footer}>
        <Ionicons name="heart-outline" size={18} color={colors.textSecondary} />
        <Text style={s.footerText}>You've got this, Coach!</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: ColorScheme) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 48 },

    hero: {
      alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
      backgroundColor: c.surface, borderRadius: 20,
      borderWidth: 1, borderColor: c.accent + '30',
      marginBottom: 16, gap: 8,
    },
    heroTitle: {
      ...Typography.label, color: c.accent,
      fontSize: 16, fontWeight: '800', letterSpacing: 2, marginTop: 4,
    },
    heroSub: {
      ...Typography.body, color: c.textSecondary,
      textAlign: 'center', lineHeight: 22,
    },

    card: {
      backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 1, borderColor: c.border,
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
    cardTitle: { ...Typography.body, color: c.textPrimary, fontWeight: '700', marginBottom: 2 },
    cardSubtitle: { ...Typography.caption, color: c.textSecondary, lineHeight: 17 },

    steps: {
      borderTopWidth: 1, borderTopColor: c.border,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 12,
    },
    step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    stepNum: {
      width: 24, height: 24, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1,
    },
    stepNumText: { fontSize: 11, fontWeight: '800' },
    stepText: { ...Typography.body, color: c.textPrimary, flex: 1, lineHeight: 22 },

    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
    footerText: { ...Typography.body, color: c.textSecondary },
  });
}
