import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { budgetEstimates, inquiries, trialBookings, users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, displayName?: string | null) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Could not synchronize user profile.', { cause: error });
  }
}

export async function createBudgetEstimate(data: {
  userUid: string;
  studentCount: number;
  ageGroup: string;
  activity: string;
  frequency: string;
  extras: string;
  estimatedAmount: number;
  contactName: string;
  contactPhone: string;
  notes?: string;
}) {
  try {
    const result = await db
      .insert(budgetEstimates)
      .values({
        userUid: data.userUid,
        studentCount: data.studentCount,
        ageGroup: data.ageGroup,
        activity: data.activity,
        frequency: data.frequency,
        extras: data.extras,
        estimatedAmount: data.estimatedAmount,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        notes: data.notes || null,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in createBudgetEstimate:', error);
    throw new Error('Could not save budget estimate.', { cause: error });
  }
}

export async function getUserBudgetEstimates(userUid: string) {
  try {
    return await db
      .select()
      .from(budgetEstimates)
      .where(eq(budgetEstimates.userUid, userUid))
      .orderBy(desc(budgetEstimates.createdAt));
  } catch (error) {
    console.error('Database query failed in getUserBudgetEstimates:', error);
    throw new Error('Could not load saved budget estimates.', { cause: error });
  }
}

export async function updateBudgetEstimate(
  estimateId: number,
  userUid: string,
  data: {
    studentCount: number;
    ageGroup: string;
    activity: string;
    frequency: string;
    extras: string;
    estimatedAmount: number;
    contactName: string;
    contactPhone: string;
    notes?: string;
  }
) {
  try {
    const result = await db
      .update(budgetEstimates)
      .set({
        studentCount: data.studentCount,
        ageGroup: data.ageGroup,
        activity: data.activity,
        frequency: data.frequency,
        extras: data.extras,
        estimatedAmount: data.estimatedAmount,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        notes: data.notes || null,
      })
      .where(and(eq(budgetEstimates.id, estimateId), eq(budgetEstimates.userUid, userUid)))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in updateBudgetEstimate:', error);
    throw new Error('Could not update budget estimate.', { cause: error });
  }
}

export async function deleteBudgetEstimate(estimateId: number, userUid: string) {
  try {
    const result = await db
      .delete(budgetEstimates)
      .where(and(eq(budgetEstimates.id, estimateId), eq(budgetEstimates.userUid, userUid)))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in deleteBudgetEstimate:', error);
    throw new Error('Could not delete budget estimate.', { cause: error });
  }
}

export async function createInquiry(data: {
  userUid: string;
  name: string;
  phone: string;
  message: string;
  source: string;
}) {
  try {
    const result = await db
      .insert(inquiries)
      .values({
        userUid: data.userUid,
        name: data.name,
        phone: data.phone,
        message: data.message,
        source: data.source,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in createInquiry:', error);
    throw new Error('Could not save inquiry.', { cause: error });
  }
}

export async function getUserInquiries(userUid: string) {
  try {
    return await db
      .select()
      .from(inquiries)
      .where(eq(inquiries.userUid, userUid))
      .orderBy(desc(inquiries.createdAt));
  } catch (error) {
    console.error('Database query failed in getUserInquiries:', error);
    throw new Error('Could not load saved inquiries.', { cause: error });
  }
}

export async function createTrialBooking(data: {
  userUid: string;
  studentName: string;
  studentPhone: string;
  ageGroup: string;
  activity: string;
  preferredDate: string;
  preferredTime: string;
  calendarEventId?: string | null;
  calendarHtmlLink?: string | null;
  notes?: string;
}) {
  try {
    const result = await db
      .insert(trialBookings)
      .values({
        userUid: data.userUid,
        studentName: data.studentName,
        studentPhone: data.studentPhone,
        ageGroup: data.ageGroup,
        activity: data.activity,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        calendarEventId: data.calendarEventId || null,
        calendarHtmlLink: data.calendarHtmlLink || null,
        status: 'confirmed',
        notes: data.notes || null,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in createTrialBooking:', error);
    throw new Error('Could not save trial class booking.', { cause: error });
  }
}

export async function getUserTrialBookings(userUid: string) {
  try {
    return await db
      .select()
      .from(trialBookings)
      .where(eq(trialBookings.userUid, userUid))
      .orderBy(desc(trialBookings.createdAt));
  } catch (error) {
    console.error('Database query failed in getUserTrialBookings:', error);
    throw new Error('Could not load trial class bookings.', { cause: error });
  }
}

export async function cancelTrialBookingInDb(bookingId: number, userUid: string) {
  try {
    const result = await db
      .update(trialBookings)
      .set({ status: 'cancelled' })
      .where(and(eq(trialBookings.id, bookingId), eq(trialBookings.userUid, userUid)))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in cancelTrialBookingInDb:', error);
    throw new Error('Could not cancel trial class booking.', { cause: error });
  }
}
