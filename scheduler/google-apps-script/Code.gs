/**
 * Google Apps Script scheduler for the FPL CHEI CHEI Vercel sync endpoint.
 * Configure VERCEL_SYNC_URL and FPL_SYNC_TOKEN in Script Properties.
 */
function getBangkokScheduleDecision(input) {
  var minuteOfDay = input.hour * 60 + input.minute;
  var isSaturdayEvening = input.day === 6 && minuteOfDay >= 18 * 60 && minuteOfDay <= 23 * 60 + 50;
  var isSundayEarly = input.day === 7 && minuteOfDay >= 1 && minuteOfDay <= 2 * 60 + 10;
  var isSundayEvening = input.day === 7 && minuteOfDay >= 18 * 60 && minuteOfDay <= 23 * 60 + 50;
  var isMondayEarly = input.day === 1 && minuteOfDay >= 1 && minuteOfDay <= 2 * 60 + 10;
  var isLiveWindow = isSaturdayEvening || isSundayEarly || isSundayEvening || isMondayEarly;
  var lastLiveSyncMs = input.lastLiveSyncAt ? Date.parse(input.lastLiveSyncAt) : NaN;
  var liveSyncDue = isLiveWindow
    && (isNaN(lastLiveSyncMs) || input.nowMs - lastLiveSyncMs >= 20 * 60 * 1000);
  var isWeekdayDaily = input.day >= 1 && input.day <= 5 && input.hour >= 6;
  var isScheduleWindow = (input.day === 2 || input.day === 5) && input.hour >= 18;
  var fixtureShouldCall = liveSyncDue
    || (isWeekdayDaily && input.lastDaily !== input.dateKey)
    || (isScheduleWindow && input.lastSchedule !== input.dateKey);
  var fantasyPlayerStatsHourKey = input.dateKey + 'T' + ('0' + input.hour).slice(-2);
  var fantasyPlayerStatsDue = input.lastFantasyPlayerStatsAttemptHour !== fantasyPlayerStatsHourKey;

  return {
    isLiveWindow: isLiveWindow,
    isWeekdayDaily: isWeekdayDaily,
    isScheduleWindow: isScheduleWindow,
    fixtureShouldCall: fixtureShouldCall,
    fantasyPlayerStatsHourKey: fantasyPlayerStatsHourKey,
    fantasyPlayerStatsDue: fantasyPlayerStatsDue,
    shouldCall: fixtureShouldCall || fantasyPlayerStatsDue,
    updateDaily: isWeekdayDaily && !isLiveWindow,
    updateSchedule: isScheduleWindow,
    updateLive: liveSyncDue,
    updateFantasyPlayerStatsAttempt: fantasyPlayerStatsDue,
  };
}

function runFplSyncScheduler() {
  var properties = PropertiesService.getScriptProperties();
  var endpoint = properties.getProperty('VERCEL_SYNC_URL');
  var token = properties.getProperty('FPL_SYNC_TOKEN');
  if (!endpoint || !token) throw new Error('Missing VERCEL_SYNC_URL or FPL_SYNC_TOKEN');

  var now = new Date();
  var local = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
  var dateKey = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
  var hour = Number(local.slice(11, 13));
  var minute = Number(local.slice(14, 16));
  var day = Number(Utilities.formatDate(now, 'Asia/Bangkok', 'u')); // 1=Mon … 7=Sun

  var lastDaily = properties.getProperty('LAST_DAILY_SYNC_DATE');
  var lastSchedule = properties.getProperty('LAST_SCHEDULE_SYNC_DATE');
  var lastLiveSyncAt = properties.getProperty('LAST_LIVE_SYNC_AT');
  var lastFantasyPlayerStatsAttemptHour = properties.getProperty('LAST_FANTASY_PLAYER_STATS_ATTEMPT_HOUR');
  var decision = getBangkokScheduleDecision({
    day: day,
    hour: hour,
    minute: minute,
    dateKey: dateKey,
    lastDaily: lastDaily,
    lastSchedule: lastSchedule,
    lastLiveSyncAt: lastLiveSyncAt,
    lastFantasyPlayerStatsAttemptHour: lastFantasyPlayerStatsAttemptHour,
    nowMs: now.getTime(),
  });
  if (!decision.shouldCall) return;

  function callVercelSync(mode) {
    var response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-fpl-sync-token': token },
      payload: JSON.stringify({ mode: mode, localTime: local }),
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      throw new Error('Vercel sync failed: ' + response.getResponseCode());
    }
  }

  var errors = [];
  var fixtureSucceeded = false;
  if (decision.fixtureShouldCall) {
    try {
      callVercelSync('scheduled');
      fixtureSucceeded = true;
    } catch (error) {
      errors.push(error);
    }
  }

  if (decision.fantasyPlayerStatsDue) {
    // Record the attempt before calling so an upstream failure does not retry
    // every ten minutes within the same Bangkok clock hour.
    properties.setProperty('LAST_FANTASY_PLAYER_STATS_ATTEMPT_HOUR', decision.fantasyPlayerStatsHourKey);
    try {
      callVercelSync('fantasy_player_stats');
    } catch (error) {
      errors.push(error);
    }
  }

  if (fixtureSucceeded && decision.updateDaily) properties.setProperty('LAST_DAILY_SYNC_DATE', dateKey);
  if (fixtureSucceeded && decision.updateSchedule) properties.setProperty('LAST_SCHEDULE_SYNC_DATE', dateKey);
  if (fixtureSucceeded && decision.updateLive) properties.setProperty('LAST_LIVE_SYNC_AT', now.toISOString());
  if (errors.length) throw new Error('Vercel sync failed');
}

function installAutosyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runFplSyncScheduler') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  // Apps Script supports 1, 5, 10, 15, or 30 minutes, so the 10-minute
  // heartbeat plus LAST_LIVE_SYNC_AT gate produces an effective 20-minute cadence.
  ScriptApp.newTrigger('runFplSyncScheduler').timeBased().everyMinutes(10).create();
}

// Backward-compatible entry points for existing Apps Script setup instructions.
function installTwentyMinuteTrigger() {
  installAutosyncTrigger();
}

function installTenMinuteTrigger() {
  installAutosyncTrigger();
}
