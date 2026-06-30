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
    icon: 'home-outline',
    iconColor: Colors.accent,
    title: 'Dashboard',
    subtitle: 'Lahat ng importante nakikita mo dito sa isang sulyap.',
    steps: [
      { text: 'Makikita mo dito ang bilang ng iyong mga kliyente, sessions ngayong buwan, at total na oras ng training.' },
      { text: 'Kung may aktibong session na nagsimula na, lalabas ang timer card dito. Mula dito mo ma-extend, i-pause, o tapusin ang session.' },
      { text: 'Ang susunod na naka-schedule na session ay naka-display na may countdown — alam mo na kung kailan ang next client mo.' },
      { text: 'Mga booking at renewal requests ng mga kliyente ay lumalabas dito. I-tap ang "Accept" o "Decline" para sumagot.' },
      { text: 'Kung may kliyente na umabot na sa 3 strikes, lalabas ang alerto para malaman mo agad.' },
      { text: 'Bday ng mga kliyente ay ipinapakita din dito para hindi mo makalimutan.' },
    ],
  },
  {
    icon: 'people-outline',
    iconColor: '#4CAF50',
    title: 'Clients',
    subtitle: 'Listahan ng lahat ng iyong mga kliyente.',
    steps: [
      { text: 'Makikita mo rito ang lahat ng kliyente mo pati na ang kanilang larawan, pangalan, at kung ilang sessions ang natitira sa kanilang package.' },
      { text: 'I-tap ang pangalan ng kliyente para makita ang kanyang buong profile — sessions, strikes, files, at iba pa.' },
      { text: 'Sa loob ng client profile, may 3 tabs: "Sessions" (kasaysayan ng workouts), "Files" (mga larawan at dokumento), at "Details" (pakikipag-ugnayan).' },
      { text: 'Maaari kang mag-upload ng progress photos, InBody results, at iba pang files para sa bawat kliyente sa Files tab.' },
      { text: 'Maaari kang magbigay ng strike sa kliyente kung may paglabag sila sa rules. Sa ikatlong strike, awtomatikong mababawasan ang isang session sa kanilang package.' },
      { text: 'Makikita mo rin dito ang ratings na ibinigay ng kliyente sa bawat session — 1 hanggang 5 bituin.' },
    ],
  },
  {
    icon: 'calendar-outline',
    iconColor: '#9C27B0',
    title: 'Calendar',
    subtitle: 'Tingnan ang lahat ng naka-iskedyul na sessions sa isang buwan.',
    steps: [
      { text: 'Ipinapakita ang lahat ng naka-schedule na sessions sa isang kalendaryo. Bawat araw na may session ay may bilog na marka.' },
      { text: 'I-tap ang araw para makita kung sino ang kliyente at anong oras ang session.' },
      { text: 'Maaari kang mag-navigate sa nakaraang buwan o susunod na buwan gamit ang mga arrow buttons.' },
      { text: 'May shortcut din dito para mag-schedule ng bagong session nang direkta mula sa kalendaryo.' },
    ],
  },
  {
    icon: 'list-outline',
    iconColor: '#FF9800',
    title: 'Sessions',
    subtitle: 'Kasaysayan ng lahat ng naitala mong sessions.',
    steps: [
      { text: 'Lahat ng nakaraang sessions ay naka-listahan dito mula sa pinakabago hanggang pinaka-luma.' },
      { text: 'Makikita mo ang bawat session: pangalan ng kliyente, petsa, tagal, at mga exercises na ginawa.' },
      { text: 'Maaari kang mag-filter ayon sa petsa o kliyente para mas madaling hanapin ang isang partikular na session.' },
    ],
  },
  {
    icon: 'timer-outline',
    iconColor: '#00BCD4',
    title: 'Timer (Guided Workout)',
    subtitle: 'I-guide ang kliyente sa workout gamit ang live na timer.',
    steps: [
      { text: 'Pumili ng kliyente at magsimulang mag-log ng exercises kasabay ng timer na tumatakbo.' },
      { text: 'Para sa bawat exercise, ilagay ang pangalan, bilang ng sets at reps, at timbang (kung mayroon).' },
      { text: 'May rest timer na lalabas sa pagitan ng sets para malaman ng kliyente kung kailan ulit magsisimula.' },
      { text: 'Kapag tapos na ang workout, maaaring i-rate ng kliyente ang session at makita mo ang kanilang feedback.' },
      { text: 'Maaari mong i-pause ang session kung kailangan ng pahinga, at i-resume anumang oras.' },
      { text: 'Kapag natapos, ang buong workout ay awtomatikong nai-save — hindi mo na kailangang manually mag-log.' },
    ],
  },
  {
    icon: 'qr-code-outline',
    iconColor: '#FFD700',
    title: 'QR Scanner',
    subtitle: 'I-scan ang QR code ng kliyente para sa mabilis na check-in.',
    steps: [
      { text: 'Ipakita sa kliyente ang QR code sa kanilang Profile tab sa loob ng app.' },
      { text: 'Buksan ang QR Scanner tab mo, at i-scan ang QR code ng kliyente gamit ang camera ng telepono.' },
      { text: 'Kapag na-scan, awtomatikong mino-log ang check-in ng kliyente — hindi na kailangan pang manual na paghanap.' },
      { text: 'Ang QR code ay nagbabago bawat 5 minuto para sa seguridad. Hindi ito maaaring kopyahin ng iba.' },
    ],
  },
  {
    icon: 'pencil-outline',
    iconColor: Colors.accent,
    title: 'Log Session',
    subtitle: 'Mag-record ng workout session pagkatapos ng klase.',
    steps: [
      { text: 'Piliin ang kliyente, petsa ng session, at tagal (30 min, 45 min, o 1 oras).' },
      { text: 'Ilagay ang bawat exercise na ginawa: pangalan, sets, reps, at timbang. Maaari kang magdagdag ng maraming exercises.' },
      { text: 'Piliin ang uri ng session — Gym o Home training.' },
      { text: 'Maaari kang magdagdag ng notes para sa session (hal. "Focus sa legs ngayon").' },
      { text: 'Kapag nagtatala ng session para sa isang kliyente, ang sessions na natitira sa kanilang package ay awtomatikong bumababa ng isa.' },
      { text: 'Kung 3 sessions na lang ang natitira sa package ng kliyente, awtomatikong makakatanggap sila ng notification para mag-renew.' },
    ],
  },
  {
    icon: 'calendar-clear-outline',
    iconColor: '#4CAF50',
    title: 'Schedule Session',
    subtitle: 'Mag-book ng session para sa hinaharap.',
    steps: [
      { text: 'Pumili ng kliyente, petsa, at oras ng session.' },
      { text: 'Piliin ang tagal (30, 45, o 60 minuto) at uri ng session (Gym o Home).' },
      { text: 'Maaari kang magdagdag ng notes para malaman ng kliyente kung ano ang focus ng session.' },
      { text: 'Kapag nai-save, awtomatikong makakatanggap ang kliyente ng push notification na may detalye ng schedule.' },
      { text: 'Ang kliyente ay maaari ring mag-confirm ng kanilang attendance sa loob ng app.' },
    ],
  },
  {
    icon: 'megaphone-outline',
    iconColor: '#FF9800',
    title: 'Announcements',
    subtitle: 'Mag-send ng mensahe sa lahat o sa napiling mga kliyente.',
    steps: [
      { text: 'May 4 na uri ng announcement: General (pangkalahatan), Emergency (urgent), Holiday (bakasyon/walang klase), at Promo (special offer).' },
      { text: 'Maaari kang pumili kung sino ang tatanggap — lahat ng kliyente, o pumili lang ng ilang tao.' },
      { text: 'Ilagay ang title at mensahe ng announcement.' },
      { text: 'Kapag na-post, awtomatikong makakatanggap ng push notification ang lahat ng piniling kliyente.' },
      { text: 'Maaari mong i-pin ang mahalagang announcement para lagi itong makita ng mga kliyente sa kanilang home screen.' },
    ],
  },
  {
    icon: 'document-text-outline',
    iconColor: '#9C27B0',
    title: 'Templates',
    subtitle: 'I-save ang iyong paboritong workout plans para hindi na paulit-ulit i-type.',
    steps: [
      { text: 'Gumawa ng template para sa mga karaniwang workout routines (hal. "Upper Body Day", "Leg Day").' },
      { text: 'Sa bawat template, maaari kang magdagdag ng listahan ng exercises kasama ang sets, reps, at timbang.' },
      { text: 'Kapag nag-log ng session, maaari mong gamitin ang isang template para mabilis na mapunan ang exercises — hindi na kailangang i-type ulit ang lahat.' },
    ],
  },
  {
    icon: 'bar-chart-outline',
    iconColor: '#4CAF50',
    title: 'Revenue Report',
    subtitle: 'Tingnan kung magkano ang iyong kinita.',
    steps: [
      { text: 'Ipinapakita ang iyong kita buwan-buwan batay sa mga package na nabayaran ng mga kliyente.' },
      { text: 'Makikita mo ang breakdown per kliyente — sino ang nagbayad ng magkano.' },
      { text: 'Maaari kang mag-filter ayon sa buwan para makita ang isang partikular na panahon.' },
      { text: 'May option na mag-export ng PDF report — kapaki-pakinabang para sa pagmamanage ng iyong negosyo.' },
    ],
  },
  {
    icon: 'time-outline',
    iconColor: '#00BCD4',
    title: 'Availability',
    subtitle: 'Itakda ang iyong schedule — kung kailan ka bukas para sa sessions.',
    steps: [
      { text: 'Para sa bawat araw ng linggo, maaari kang magtakda ng oras kung kailan ka available (hal. Lunes, 8 AM – 5 PM).' },
      { text: 'Kapag nag-request ang kliyente ng session, malalaman nila ang iyong available na oras.' },
    ],
  },
  {
    icon: 'ban-outline',
    iconColor: Colors.accent,
    title: 'Blocked Dates',
    subtitle: 'Markahan ang mga araw na hindi ka available.',
    steps: [
      { text: 'Kung may bakasyon ka, holiday, o ibang dahilan na hindi ka makakatrain, markahan ang petsa bilang blocked.' },
      { text: 'Sa mga blocked na araw, hindi maaaring mag-schedule ng session.' },
    ],
  },
  {
    icon: 'chatbubbles-outline',
    iconColor: '#25D366',
    title: 'Chat',
    subtitle: 'Makipag-usap sa iyong mga kliyente sa loob ng app.',
    steps: [
      { text: 'Maaari kang direktang mag-message sa iyong kliyente — hindi na kailangan ng labas na app.' },
      { text: 'Makikita mo kung nabasa na ng kliyente ang iyong mensahe (double checkmark = nabasa na).' },
      { text: 'Para buksan ang chat ng isang kliyente, pumunta sa kanyang profile at i-tap ang chat icon sa taas.' },
    ],
  },
  {
    icon: 'person-outline',
    iconColor: Colors.textSecondary,
    title: 'Profile',
    subtitle: 'I-manage ang iyong personal na impormasyon.',
    steps: [
      { text: 'Maaari kang mag-update ng iyong larawan, pangalan, email, at password.' },
      { text: 'Ilagay ang iyong phone number, WhatsApp, at Instagram para makita ng mga kliyente kung paano kita makuha.' },
      { text: 'Dito mo rin mahahanap ang User Guide na ito para balikan anumang oras.' },
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

export default function CoachGuideScreen() {
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Ionicons name="book-outline" size={40} color={Colors.accent} />
        <Text style={s.heroTitle}>COACH USER GUIDE</Text>
        <Text style={s.heroSub}>
          I-tap ang bawat feature para malaman kung paano ito gamitin.
          Lahat ng kailangan mo ay nandito!
        </Text>
      </View>

      {SECTIONS.map((section) => (
        <GuideCard key={section.title} section={section} />
      ))}

      <View style={s.footer}>
        <Ionicons name="heart-outline" size={18} color={Colors.textSecondary} />
        <Text style={s.footerText}>Kaya mo yan, Coach! 💪</Text>
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
