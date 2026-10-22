const dayFor = (instant, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
const dayGap = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const decide = ({ lastLocalDay, currentCount, freezeCount, uploadedAt }) => {
  const localDay = dayFor(uploadedAt, 'Asia/Manila');
  const gap = lastLocalDay ? dayGap(lastLocalDay, localDay) : null;
  const sameDay = lastLocalDay === localDay;
  const canFreeze = gap === 2 && freezeCount > 0;
  return {
    localDay,
    current: sameDay ? currentCount : gap === 1 || canFreeze ? currentCount + 1 : 1,
    freezes: Math.max(0, freezeCount - (canFreeze ? 1 : 0)),
  };
};

if (dayFor('2026-10-21T15:59:59Z', 'Asia/Manila') !== '2026-10-21') throw new Error('before-midnight boundary failed');
if (dayFor('2026-10-21T16:00:00Z', 'Asia/Manila') !== '2026-10-22') throw new Error('after-midnight boundary failed');
const nextDay = decide({ lastLocalDay: '2026-10-21', currentCount: 4, freezeCount: 1, uploadedAt: '2026-10-21T16:00:00Z' });
if (nextDay.current !== 5 || nextDay.freezes !== 1 || nextDay.localDay !== '2026-10-22') throw new Error('next-day streak failed');
const frozenDay = decide({ lastLocalDay: '2026-10-20', currentCount: 4, freezeCount: 1, uploadedAt: '2026-10-22T00:00:00Z' });
if (frozenDay.current !== 5 || frozenDay.freezes !== 0) throw new Error('freeze streak failed');
const brokenDay = decide({ lastLocalDay: '2026-10-20', currentCount: 4, freezeCount: 0, uploadedAt: '2026-10-22T00:00:00Z' });
if (brokenDay.current !== 1 || brokenDay.freezes !== 0) throw new Error('broken streak failed');
console.log('PASS Asia/Manila midnight boundary');
console.log('PASS one-day continuation');
console.log('PASS two-day gap consumes one freeze');
console.log('PASS two-day gap without freeze resets streak');
