import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const budgetEstimates = pgTable('budget_estimates', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull(),
  studentCount: integer('student_count').notNull(),
  ageGroup: text('age_group').notNull(),
  activity: text('activity').notNull(),
  frequency: text('frequency').notNull(),
  extras: text('extras').notNull(),
  estimatedAmount: integer('estimated_amount').notNull(),
  contactName: text('contact_name').notNull(),
  contactPhone: text('contact_phone').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inquiries = pgTable('inquiries', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  message: text('message').notNull(),
  source: text('source').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const trialBookings = pgTable('trial_bookings', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull(),
  studentName: text('student_name').notNull(),
  studentPhone: text('student_phone').notNull(),
  ageGroup: text('age_group').notNull(),
  activity: text('activity').notNull(),
  preferredDate: text('preferred_date').notNull(),
  preferredTime: text('preferred_time').notNull(),
  calendarEventId: text('calendar_event_id'),
  calendarHtmlLink: text('calendar_html_link'),
  status: text('status').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  budgetEstimates: many(budgetEstimates),
  inquiries: many(inquiries),
  trialBookings: many(trialBookings),
}));

export const budgetEstimatesRelations = relations(budgetEstimates, ({ one }) => ({
  user: one(users, {
    fields: [budgetEstimates.userUid],
    references: [users.uid],
  }),
}));

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  user: one(users, {
    fields: [inquiries.userUid],
    references: [users.uid],
  }),
}));

export const trialBookingsRelations = relations(trialBookings, ({ one }) => ({
  user: one(users, {
    fields: [trialBookings.userUid],
    references: [users.uid],
  }),
}));
