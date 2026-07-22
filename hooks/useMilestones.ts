import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Milestone = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
  group: 'sessions' | 'membership' | 'achievements';
};

const SESSION_TIERS = [
  { id: 'session_1',   emoji: '🎯', name: 'First Step',       description: '1st session completed',  count: 1   },
  { id: 'session_5',   emoji: '💪', name: 'Getting Serious',  description: '5 sessions completed',   count: 5   },
  { id: 'session_10',  emoji: '🔥', name: '10 Strong',        description: '10 sessions completed',  count: 10  },
  { id: 'session_25',  emoji: '⚡', name: 'Quarter Century',  description: '25 sessions completed',  count: 25  },
  { id: 'session_50',  emoji: '🏆', name: 'Half Century',     description: '50 sessions completed',  count: 50  },
  { id: 'session_100', emoji: '👑', name: 'Century Club',     description: '100 sessions completed', count: 100 },
];

const MEMBERSHIP_TIERS = [
  { id: 'member_1m',  emoji: '📅', name: '1 Month Member',   description: 'Training for 1 month',   days: 30  },
  { id: 'member_3m',  emoji: '🗓️', name: '3 Month Member',   description: 'Training for 3 months',  days: 90  },
  { id: 'member_6m',  emoji: '⭐', name: '6 Month Member',   description: 'Training for 6 months',  days: 180 },
  { id: 'member_1y',  emoji: '🎂', name: '1 Year Champion',  description: 'Training for 1 year',    days: 365 },
];

const ACHIEVEMENT_TIERS = [
  { id: 'goal_1',      emoji: '🎯', name: 'Goal Crusher',    description: 'Achieved 1 goal',         goalCount: 1 },
  { id: 'goal_3',      emoji: '🎯', name: 'Goal Machine',    description: 'Achieved 3 goals',        goalCount: 3 },
  { id: 'checkin_4',   emoji: '📋', name: 'Check-in Habit',  description: '4 weekly check-ins done', checkins: 4  },
  { id: 'checkin_12',  emoji: '📊', name: 'Check-in Pro',    description: '12 weekly check-ins done',checkins: 12 },
];

export function useMilestones(clientId: string, createdAt?: string) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    (async () => {
      const [sessRes, goalRes, checkinRes, profileRes] = await Promise.all([
        supabase
          .from('workout_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .neq('status', 'no_show'),
        supabase
          .from('client_goals')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('status', 'achieved'),
        supabase
          .from('weekly_checkins')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId),
        createdAt
          ? Promise.resolve({ data: { created_at: createdAt } })
          : supabase.from('profiles').select('created_at').eq('id', clientId).single(),
      ]);

      if (cancelled) return;

      const sessionCount  = sessRes.count   ?? 0;
      const goalCount     = goalRes.count    ?? 0;
      const checkinCount  = checkinRes.count ?? 0;
      const rawCreatedAt  = (profileRes as any).data?.created_at ?? createdAt;
      const memberDays    = rawCreatedAt
        ? Math.floor((Date.now() - new Date(rawCreatedAt).getTime()) / 86400000)
        : 0;

      const all: Milestone[] = [
        ...SESSION_TIERS.map((t) => ({
          id: t.id, emoji: t.emoji, name: t.name,
          description: t.description, group: 'sessions' as const,
          earned: sessionCount >= t.count,
        })),
        ...MEMBERSHIP_TIERS.map((t) => ({
          id: t.id, emoji: t.emoji, name: t.name,
          description: t.description, group: 'membership' as const,
          earned: memberDays >= t.days,
        })),
        ...ACHIEVEMENT_TIERS.map((t) => ({
          id: t.id, emoji: t.emoji, name: t.name,
          description: t.description, group: 'achievements' as const,
          earned: t.goalCount != null
            ? goalCount >= t.goalCount
            : checkinCount >= (t.checkins ?? 0),
        })),
      ];

      setMilestones(all);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [clientId, createdAt]);

  return { milestones, loading, earnedCount: milestones.filter((m) => m.earned).length };
}
