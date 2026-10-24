/**
 * Knockout binding: dateTime24
 *
 * Usage: <div data-bind="dateTime24: someObservable"></div>
 *
 * A date box plus a 24-hour time box, bound to the same "YYYY-MM-DDTHH:mm"
 * string a datetime-local input uses. Chrome's datetime-local/time inputs
 * always follow the OS region (am/pm on many machines) and a page can't
 * change that, so the time is a plain text box instead. It accepts 1045,
 * 10:45 or 10.45; an invalid time is outlined red and isn't written. With a
 * time but no date, the date defaults to today.
 */
import ko from 'knockout';
import moment from 'moment';

/** "1045" / "10:45" / "9.05" -> "10:45" / "09:05"; null if not a valid 24-hour time. */
export function parseTime24(text) {
    const m = /^\s*(\d{1,2})[:.]?(\d{2})\s*$/.exec(text || '');
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

ko.bindingHandlers.dateTime24 = {
    init: function (element, valueAccessor) {
        const target = valueAccessor();
        element.classList.add('dt24');

        const date = document.createElement('input');
        date.type = 'date';
        date.className = 'form-control form-control-sm dt24-date';
        date.setAttribute('aria-label', 'Date');

        const time = document.createElement('input');
        time.type = 'text';
        time.inputMode = 'numeric';
        time.autocomplete = 'off';
        time.maxLength = 5;
        time.placeholder = 'HH:mm';
        time.className = 'form-control form-control-sm dt24-time';
        time.setAttribute('aria-label', 'Time (24-hour)');

        element.append(date, time);

        const write = () => {
            const t = parseTime24(time.value);
            time.classList.toggle('is-invalid', !!time.value && !t);
            if (!t) {
                if (!time.value && !date.value && ko.isWriteableObservable(target)) target(null);
                return;
            }
            if (!date.value) date.value = moment().format('YYYY-MM-DD');
            const v = `${date.value}T${t}`;
            if (ko.isWriteableObservable(target) && target() !== v) target(v);
        };
        date.addEventListener('change', write);
        time.addEventListener('input', write);
        time.addEventListener('blur', () => {
            const t = parseTime24(time.value);
            if (t) time.value = t;
        });
    },
    update: function (element, valueAccessor) {
        const v = ko.unwrap(valueAccessor());
        const [date, time] = element.querySelectorAll('input');
        const m = v ? moment(v) : null;
        if (!m || !m.isValid()) {
            date.value = '';
            if (document.activeElement !== time) time.value = '';
            return;
        }
        date.value = m.format('YYYY-MM-DD');
        const t = m.format('HH:mm');
        // Don't reformat what's being typed (e.g. "1045" while still focused).
        if (document.activeElement === time && parseTime24(time.value) === t) return;
        time.value = t;
        time.classList.remove('is-invalid');
    },
};
