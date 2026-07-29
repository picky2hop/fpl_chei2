/**
 * Google Apps Script scheduler for the FPL CHEI CHEI Vercel sync endpoint.
 * Configure VERCEL_SYNC_URL and FPL_SYNC_TOKEN in Script Properties.
 */
function runFplSyncScheduler() {
  var properties = PropertiesService.getScriptProperties();
  var endpoint = properties.getProperty('VERCEL_SYNC_URL');
  var token = properties.getProperty('FPL_SYNC_TOKEN');
  if (!endpoint || !token) throw new Error('Missing VERCEL_SYNC_URL or FPL_SYNC_TOKEN');

  var now = new Date();
  var local = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
  var dateKey = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
  var hour = Number(local.slice(11, 13));
  var day = Number(Utilities.formatDate(now, 'Asia/Bangkok', 'u')); // 1=Mon … 7=Sun
  var isWeekendLive = (day === 6 || day === 7) && (hour >= 18 || hour < 2);
  var isWeekdayDaily = day >= 1 && day <= 5 && hour >= 6;
  var isScheduleWindow = (day === 2 || day === 5) && hour >= 18;

  var lastDaily = properties.getProperty('LAST_DAILY_SYNC_DATE');
  var lastSchedule = properties.getProperty('LAST_SCHEDULE_SYNC_DATE');
  var shouldCall = isWeekendLive || (isWeekdayDaily && lastDaily !== dateKey) || (isScheduleWindow && lastSchedule !== dateKey);
  if (!shouldCall) return;

  var response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-fpl-sync-token': token },
    payload: JSON.stringify({ mode: 'scheduled', localTime: local }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Vercel sync failed: ' + response.getResponseCode() + ' ' + response.getContentText());
  }
  if (isWeekdayDaily && !isWeekendLive) properties.setProperty('LAST_DAILY_SYNC_DATE', dateKey);
  if (isScheduleWindow) properties.setProperty('LAST_SCHEDULE_SYNC_DATE', dateKey);
}

function installTenMinuteTrigger() {
  ScriptApp.newTrigger('runFplSyncScheduler').timeBased().everyMinutes(10).create();
}
