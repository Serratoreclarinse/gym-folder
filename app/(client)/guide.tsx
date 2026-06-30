import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '@/constants/theme';

type Step = { text: string };
type Section = {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  steps: Step[];
};

const SECTIONS: Section[] = [
  {
    icon: 'trending-up-outline',
    iconColor: Colors.accent,
    title: 'My Progress (Home)',
    subtitle: 'Tingnan ang iyong package, susunod na session, at mga anunsyo ng coach.',
    steps: [
      { text: 'Sa itaas, makikita mo ang iyong package — kung ilang sessions ang natitira, ilang sessions ang nagamit mo na, at kung on track ka ba sa iyong schedule.' },
      { text: 'Kung may naka-schedule na session ka, lalabas ito sa itaas ng pahina kasama ang countdown timer — alam mo na kung gaano katagal bago ang susunod mong training!' },
      { text: 'I-tap ang "Confirm Attendance" para ipaalam sa coach na pupunta ka. Kailangan gawin ito bago ang session.' },
      { text: 'Maaari kang mag-cancel ng session — pero kailangan gawin ito ng higit sa 3 oras bago ang oras ng session. Kapag wala ka pang 3 oras, hindi na maaaring ma-cancel.' },
      { text: 'Kung may anunsyo ang coach (holiday, promo, emergency), lalabas ito sa bandang gitna ng pahina. Basahin ito para updated ka lagi.' },
      { text: 'I-tap ang "Request Session" para humingi ng bagong session sa iyong coach. Maaari kang maglagay ng gusto mong petsa at oras.' },
      { text: 'Kapag mababa na ang sessions mo (3 sessions na lang), lalabas ang "Renew Package" button para madali kang makahiling ng renewal.' },
      { text: 'Sa ibaba, makikita mo ang pinakabagong 3 sessions mo at ang contact info ng coach.' },
    ],
  },
  {
    icon: 'barbell-outline',
    iconColor: '#FF9800',
    title: 'Workouts',
    subtitle: 'Kasaysayan ng lahat ng iyong sessions.',
    steps: [
      { text: 'Makikita mo rito ang lahat ng iyong nakaraang sessions — petsa, tagal, at listahan ng mga exercises na ginawa.' },
      { text: 'May summary sa itaas — total sessions, total minuto ng training, at bilang ng iba\'t ibang exercises na nasubukan mo.' },
      { text: 'I-tap ang buwan sa tuktok para ma-filter at makita lang ang sessions ng isang partikular na buwan.' },
      { text: 'Sa loob ng bawat session card, makikita mo ang bawat exercise — sets, reps, at timbang na ginamit.' },
      { text: 'Kapag bago pa lang natapos ang iyong session (loob ng 48 oras), lalabas ang "Rate this session" button. I-tap ito para mag-bigay ng 1-5 bituin rating sa iyong coach.' },
      { text: 'Kung no-show ka sa isang session (hindi ka dumating), lalabas ito sa iyong history na may "NO-SHOW" na label at babawasan ng isang session.' },
    ],
  },
  {
    icon: 'trophy-outline',
    iconColor: '#FFD700',
    title: 'Records',
    subtitle: 'Tingnan ang iyong personal records at progress photos.',
    steps: [
      { text: 'Sa itaas ng page na ito, makikita mo ang iyong Personal Records (PR) — ang pinakamataas na timbang na nagawa mo sa bawat exercise.' },
      { text: 'Ang #1 ay may gintong medalya, #2 ay pilak, at #3 ay tanso — para alam mo kung ano ang iyong pinaka-magagandang exercise!' },
      { text: 'Para sa bawat PR, makikita mo kung kailan mo ito nakamit at ilang beses mo nang nagawa ang exercise na iyon.' },
      { text: 'Awtomatiko itong nag-a-update pagkatapos ng bawat session — hindi na kailangan pang mano-manong i-input.' },
      { text: 'Sa ibaba ng PRs, makikita mo ang iyong Progress Photos. Ito ang mga larawan na pina-upload ng iyong coach para ma-track ang iyong body transformation.' },
      { text: 'I-tap ang kahit anong larawan para makita ito nang mas malaki. Makikita mo rin ang petsa at label ng bawat larawan.' },
    ],
  },
  {
    icon: 'chatbubbles-outline',
    iconColor: '#25D366',
    title: 'Messages',
    subtitle: 'Makipag-chat sa iyong coach.',
    steps: [
      { text: 'Dito mo maaaring direktang ma-message ang iyong coach — hindi na kailangan ng ibang app tulad ng Messenger o Viber.' },
      { text: 'Makikita mo kung nabasa na ng coach ang iyong mensahe — kapag may double checkmark na pula, nabasa na niya ito.' },
      { text: 'Maaari kang magtanong tungkol sa iyong workout, schedule, o kahit anong bagay na nais mong malaman.' },
      { text: 'Ang lahat ng inyong usapan ay naka-save dito para madali kang makabalik-balik sa mga nakaraang mensahe.' },
    ],
  },
  {
    icon: 'person-outline',
    iconColor: Colors.textSecondary,
    title: 'Profile',
    subtitle: 'I-manage ang iyong account at personal na impormasyon.',
    steps: [
      { text: 'I-tap ang iyong larawan para mag-upload ng bagong profile photo.' },
      { text: 'Ang iyong QR Code ay nandito — ito ang iyong personal na barcode na gagamitin ng coach para sa check-in sa simula ng session. Ipakita ito sa coach bago mag-start.' },
      { text: 'Ang QR code ay nagbabago bawat 5 minuto para sa iyong seguridad — hindi ito maaaring gamitin ng ibang tao.' },
      { text: 'Sa "Contact & Social", maaari kang mag-lagay ng iyong phone number, WhatsApp, at Instagram para makuha ka ng coach.' },
      { text: 'Makikita mo rin dito ang contact info ng iyong coach — phone at WhatsApp.' },
      { text: 'I-tap ang "Sign Out" para lumabas sa iyong account.' },
    ],
  },
  {
    icon: 'notifications-outline',
    iconColor: '#FF9800',
    title: 'Push Notifications',
    subtitle: 'Mga notification na matatanggap mo sa iyong telepono.',
    steps: [
      { text: '📅 Session Scheduled — May bagong session na naka-schedule ang iyong coach para sa iyo.' },
      { text: '⚠️ Package Almost Empty — 3 sessions na lang ang natitira sa iyong package. Oras na para mag-renew!' },
      { text: '⚡ Strike Recorded — Nakatanggap ka ng strike mula sa iyong coach. Basahin ang dahilan.' },
      { text: '⚡ 3 Strikes — Session Deducted — 3 na ang iyong strikes. Isang session ay nabawasan sa iyong package.' },
      { text: '✅ / ❌ Request Response — Ang iyong booking o renewal request ay tinanggap o tinanggihan ng coach.' },
      { text: '📢 / ⚠️ Announcement — May bagong anunsyo ang iyong coach — holiday, emergency, o promo.' },
    ],
  },
  {
    icon: 'help-circle-outline',
    iconColor: '#9C27B0',
    title: 'Mga Madalas na Tanong (FAQ)',
    subtitle: 'Sagot sa mga karaniwang katanungan.',
    steps: [
      { text: 'Q: Bakit bumababa ang sessions ko kahit hindi pa ko nagtr-train?\nA: Posibleng may no-show na naitala ang coach para sa iyo — hindi ka dumating sa session. Makikita ito sa iyong Workouts tab.' },
      { text: 'Q: Paano ako mag-cancel ng session?\nA: Pumunta sa Home tab, hanapin ang iyong susunod na session, at i-tap ang "Cancel Session". Tandaan: kailangan gawin ito ng higit sa 3 oras bago ang session.' },
      { text: 'Q: Paano ako humingi ng bagong session?\nA: I-tap ang "Request Session" sa Home tab, at punan ang gusto mong petsa at oras. Makakatanggap ang coach ng notification tungkol sa iyong request.' },
      { text: 'Q: Bakit nag-deduct ng session sa aking package?\nA: May tatlong posibilidad: (1) Nag-log ng session ang coach, (2) No-show ka sa session, o (3) Umabot ka ng 3 strikes.' },
      { text: 'Q: Nasaan ang aking mga progress photos?\nA: Pumunta sa Records tab, mag-scroll pababa, at makikita mo ang "Progress Photos" section.' },
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
              <Text style={s.stepText}>{step.text}</Text>
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
          I-tap ang bawat seksyon para malaman kung paano gamitin ang app.
          Simple lang — kaya mo 'to!
        </Text>
      </View>

      {SECTIONS.map((section) => (
        <GuideCard key={section.title} section={section} />
      ))}

      <View style={s.footer}>
        <Ionicons name="heart-outline" size={18} color={Colors.textSecondary} />
        <Text style={s.footerText}>Kaya mo yan! Keep grinding! 💪</Text>
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
