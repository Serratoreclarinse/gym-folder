import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme } from '@/constants/theme';

interface Country {
  name: string;
  dialCode: string;
  flag: string;
  code: string;
}

const COUNTRIES: Country[] = [
  // GCC
  { name: 'Oman', dialCode: '+968', flag: '🇴🇲', code: 'OM' },
  { name: 'UAE', dialCode: '+971', flag: '🇦🇪', code: 'AE' },
  { name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', code: 'SA' },
  { name: 'Qatar', dialCode: '+974', flag: '🇶🇦', code: 'QA' },
  { name: 'Bahrain', dialCode: '+973', flag: '🇧🇭', code: 'BH' },
  { name: 'Kuwait', dialCode: '+965', flag: '🇰🇼', code: 'KW' },
  // Middle East
  { name: 'Jordan', dialCode: '+962', flag: '🇯🇴', code: 'JO' },
  { name: 'Lebanon', dialCode: '+961', flag: '🇱🇧', code: 'LB' },
  { name: 'Egypt', dialCode: '+20', flag: '🇪🇬', code: 'EG' },
  { name: 'Yemen', dialCode: '+967', flag: '🇾🇪', code: 'YE' },
  // South / Southeast Asia
  { name: 'Philippines', dialCode: '+63', flag: '🇵🇭', code: 'PH' },
  { name: 'India', dialCode: '+91', flag: '🇮🇳', code: 'IN' },
  { name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', code: 'PK' },
  { name: 'Sri Lanka', dialCode: '+94', flag: '🇱🇰', code: 'LK' },
  { name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', code: 'BD' },
  { name: 'Nepal', dialCode: '+977', flag: '🇳🇵', code: 'NP' },
  { name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', code: 'ID' },
  { name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', code: 'MY' },
  // Western
  { name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', code: 'GB' },
  { name: 'United States', dialCode: '+1', flag: '🇺🇸', code: 'US' },
  { name: 'Canada', dialCode: '+1', flag: '🇨🇦', code: 'CA' },
  { name: 'Australia', dialCode: '+61', flag: '🇦🇺', code: 'AU' },
  { name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', code: 'NZ' },
  { name: 'Ireland', dialCode: '+353', flag: '🇮🇪', code: 'IE' },
  { name: 'South Africa', dialCode: '+27', flag: '🇿🇦', code: 'ZA' },
];

function parsePhone(value: string): { country: Country; localNumber: string } {
  const defaultCountry = COUNTRIES[0];
  if (!value) return { country: defaultCountry, localNumber: '' };
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const c of sorted) {
    if (value.startsWith(c.dialCode)) {
      return { country: c, localNumber: value.slice(c.dialCode.length).trimStart() };
    }
  }
  return { country: defaultCountry, localNumber: value };
}

interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  colors: ColorScheme;
  inputStyle?: object;
  containerStyle?: object;
  placeholder?: string;
}

export function PhoneInput({
  value,
  onChange,
  colors,
  inputStyle,
  containerStyle,
  placeholder = 'Phone number',
}: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [country, setCountry] = useState<Country>(parsed.country);
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!value) {
      setLocalNumber('');
      setCountry(COUNTRIES[0]);
    }
  }, [value]);

  const handleNumberChange = (text: string) => {
    setLocalNumber(text);
    onChange(country.dialCode + (text.trim() ? ' ' + text.trim() : ''));
  };

  const handleCountrySelect = (c: Country) => {
    setCountry(c);
    setModalOpen(false);
    setSearch('');
    onChange(c.dialCode + (localNumber.trim() ? ' ' + localNumber.trim() : ''));
  };

  const filtered = search.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dialCode.includes(search),
      )
    : COUNTRIES;

  const baseInput: object = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.textPrimary,
    fontSize: 15,
  };

  return (
    <>
      <View style={[{ flexDirection: 'row', gap: 6 }, containerStyle]}>
        <Pressable
          onPress={() => setModalOpen(true)}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 13,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={{ fontSize: 17, lineHeight: 20 }}>{country.flag}</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '500' }}>
            {country.dialCode}
          </Text>
          <Ionicons name="chevron-down-outline" size={11} color={colors.textSecondary} />
        </Pressable>

        <TextInput
          style={[baseInput, inputStyle, { flex: 1 }]}
          value={localNumber}
          onChangeText={handleNumberChange}
          keyboardType="phone-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <Modal
        visible={modalOpen}
        transparent
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        onRequestClose={() => { setModalOpen(false); setSearch(''); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              maxHeight: '78%',
              paddingTop: 16,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                Select country
              </Text>
              <Pressable onPress={() => { setModalOpen(false); setSearch(''); }}>
                <Ionicons name="close-outline" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Search */}
            <View style={{ paddingHorizontal: 18, marginBottom: 8 }}>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: colors.textPrimary,
                  fontSize: 14,
                }}
                placeholder="Search country or code..."
                placeholderTextColor={colors.textSecondary}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>

            {/* List */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
              renderItem={({ item }) => {
                const selected = item.code === country.code;
                return (
                  <Pressable
                    onPress={() => handleCountrySelect(item)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 13,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.border,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 22, width: 30 }}>{item.flag}</Text>
                    <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 14 }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {item.dialCode}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark-outline" size={16} color={colors.accent} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
