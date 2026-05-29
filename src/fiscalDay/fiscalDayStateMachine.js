const { supabase } = require('../db/supabaseClient');

/**
 * Manage all 5 fiscal day states per spec section 3.1
 * States:
 *   FiscalDayClosed - can openDay
 *   FiscalDayOpened - can submitReceipt, closeDay
 *   FiscalDayCloseInitiated - wait, no new receipts, no new closeDay from device
 *   FiscalDayCloseFailed - can retry closeDay or submit receipts
 */

/**
 * Get current fiscal day status from Supabase
 */
async function getCurrentStatus(deviceId) {
  const { data, error } = await supabase
    .from('fiscal_days')
    .select('*')
    .eq('device_id', deviceId)
    .order('fiscal_day_no', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    throw new Error(`Failed to get current status: ${error.message}`);
  }

  return data || null;
}

/**
 * Check if can open new fiscal day
 * Only allowed from FiscalDayClosed state
 */
async function canOpenDay(deviceId) {
  const currentDay = await getCurrentStatus(deviceId);

  // If no fiscal day exists, can open
  if (!currentDay) {
    return { allowed: true, reason: 'No fiscal day exists' };
  }

  // Can only open if current day is closed
  if (currentDay.status === 'FiscalDayClosed') {
    return { allowed: true, reason: 'Current day is closed' };
  }

  return {
    allowed: false,
    reason: `Current fiscal day status is ${currentDay.status}. Must be FiscalDayClosed to open new day.`
  };
}

/**
 * Check if can submit receipt
 * Only allowed in FiscalDayOpened or FiscalDayCloseFailed states
 */
async function canSubmitReceipt(deviceId) {
  const currentDay = await getCurrentStatus(deviceId);

  if (!currentDay) {
    return {
      allowed: false,
      reason: 'No fiscal day is open. Open a fiscal day first.'
    };
  }

  if (currentDay.status === 'FiscalDayOpened' || currentDay.status === 'FiscalDayCloseFailed') {
    return { allowed: true, fiscalDayId: currentDay.id, fiscalDayNo: currentDay.fiscal_day_no };
  }

  return {
    allowed: false,
    reason: `Fiscal day status is ${currentDay.status}. Can only submit receipts when FiscalDayOpened or FiscalDayCloseFailed.`
  };
}

/**
 * Check if can close fiscal day
 * Only allowed from FiscalDayOpened or FiscalDayCloseFailed states
 */
async function canCloseDay(deviceId) {
  const currentDay = await getCurrentStatus(deviceId);

  if (!currentDay) {
    return {
      allowed: false,
      reason: 'No fiscal day is open.'
    };
  }

  if (currentDay.status === 'FiscalDayOpened' || currentDay.status === 'FiscalDayCloseFailed') {
    return { allowed: true, fiscalDayId: currentDay.id, fiscalDayNo: currentDay.fiscal_day_no };
  }

  return {
    allowed: false,
    reason: `Fiscal day status is ${currentDay.status}. Can only close when FiscalDayOpened or FiscalDayCloseFailed.`
  };
}

/**
 * Transition fiscal day to new status
 */
async function transitionTo(deviceId, fiscalDayId, newStatus) {
  const { error } = await supabase
    .from('fiscal_days')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', fiscalDayId)
    .eq('device_id', deviceId);

  if (error) {
    throw new Error(`Failed to transition to ${newStatus}: ${error.message}`);
  }

  console.log(`✅ Fiscal day transitioned to ${newStatus}`);
}

/**
 * Check if fiscal day has expired
 * True if hours since openedAt >= taxPayerDayMaxHrs
 */
function isFiscalDayExpired(openedAt, maxHours) {
  if (!openedAt || !maxHours) {
    return false;
  }

  const opened = new Date(openedAt);
  const now = new Date();
  const hoursSinceOpened = (now - opened) / (1000 * 60 * 60);

  return hoursSinceOpened >= maxHours;
}

/**
 * Check if should notify that fiscal day end is approaching
 * True if hours remaining <= taxpayerDayEndNotificationHrs
 */
function shouldNotifyEndApproaching(openedAt, maxHours, notifyHours) {
  if (!openedAt || !maxHours || !notifyHours) {
    return false;
  }

  const opened = new Date(openedAt);
  const now = new Date();
  const hoursSinceOpened = (now - opened) / (1000 * 60 * 60);
  const hoursRemaining = maxHours - hoursSinceOpened;

  return hoursRemaining <= notifyHours && hoursRemaining > 0;
}

module.exports = {
  getCurrentStatus,
  canOpenDay,
  canSubmitReceipt,
  canCloseDay,
  transitionTo,
  isFiscalDayExpired,
  shouldNotifyEndApproaching
};
