import { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    icon:     'barbell-outline' as const,
    title:    'TRACK YOUR PROGRESS',
    subtitle: 'Every rep, every session, every milestone — logged and visible in one place.',
    color:    '#E8001D',
  },
  {
    icon:     'chatbubbles-outline' as const,
    title:    'STAY CONNECTED',
    subtitle: 'Message your coach, request sessions, and get real-time feedback anytime.',
    color:    '#4CAF50',
  },
  {
    icon:     'trending-up-outline' as const,
    title:    'SEE YOUR GAINS',
    subtitle: 'Monitor body measurements, strength records, and progress photos over time.',
    color:    '#FF9800',
  },
  {
    icon:     'flash-outline' as const,
    title:    "LET'S GET TO WORK",
    subtitle: 'Your coach is ready. Your goals are set. Time to ELEVATƎ.',
    color:    '#9C27B0',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(0);
  const dotAnim  = useRef(SLIDES.map(() => new Animated.Value(0))).current;

  const animateDot = (index: number) => {
    dotAnim.forEach((a, i) =>
      Animated.timing(a, {
        toValue:         i === index ? 1 : 0,
        duration:        200,
        useNativeDriver: false,
      }).start(),
    );
  };

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    if (idx !== current) {
      setCurrent(idx);
      animateDot(idx);
    }
  };

  const goNext = () => {
    if (current < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (current + 1) * W, animated: true });
    } else {
      handleDone();
    }
  };

  const handleDone = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true');
    router.replace('/(auth)/login');
  };

  const slide = SLIDES[current];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Skip */}
      <Pressable style={styles.skipBtn} onPress={handleDone} hitSlop={12}>
        <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
      </Pressable>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width: W }]}>
            <View style={[styles.iconWrap, { backgroundColor: s.color + '18' }]}>
              <Ionicons name={s.icon} size={64} color={s.color} />
            </View>
            <Text style={[styles.brandMark, { color: colors.accent }]}>ELEVATƎ</Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{s.title}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{s.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const width = dotAnim[i].interpolate({
            inputRange:  [0, 1],
            outputRange: [8, 24],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width,
                  backgroundColor: i === current ? colors.accent : colors.border,
                },
              ]}
            />
          );
        })}
      </View>

      {/* CTA */}
      <Pressable
        style={[styles.cta, { backgroundColor: colors.accent }]}
        onPress={goNext}
      >
        <Text style={[styles.ctaText, { color: colors.bg }]}>
          {current === SLIDES.length - 1 ? "GET STARTED" : "NEXT"}
        </Text>
        <Ionicons
          name={current === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
          size={18}
          color={colors.bg}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, paddingBottom: 48 },
  skipBtn:  { alignSelf: 'flex-end', paddingTop: 56, paddingRight: 24, paddingBottom: 8 },
  skipText: { fontSize: 14, fontWeight: '600' },

  slide:    { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 20 },
  iconWrap: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  brandMark:{ fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  title:    { fontSize: 22, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  subtitle: { fontSize: 16, lineHeight: 24, textAlign: 'center' },

  dots:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 20 },
  dot:      { height: 8, borderRadius: 4 },

  cta:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 24, paddingVertical: 16, borderRadius: 16 },
  ctaText:  { fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});
