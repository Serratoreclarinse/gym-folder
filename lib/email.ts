import { supabase } from './supabase';

export async function sendEmail(to: string, subject: string, html: string) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, html },
  });
  if (error) throw error;
  return data;
}

export const EmailTemplates = {
  welcomeClient: (name: string) => ({
    subject: 'Welcome to your coaching program!',
    html: `<h1>Welcome, ${name}!</h1><p>Your coach has added you to the platform. Get ready to crush your goals.</p>`,
  }),
  sessionReminder: (name: string, date: string) => ({
    subject: 'Session reminder',
    html: `<h2>Hi ${name},</h2><p>Reminder: you have a coaching session on <strong>${date}</strong>.</p>`,
  }),
};
