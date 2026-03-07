import ko from 'knockout';
import $ from 'jquery';

/**
 * Acronym dictionary for emergency services and common abbreviations
 */
export const acronymDictionary = [
    { regex: 'AA', meaning: 'As Above' },
    { regex: 'ACK', meaning: 'Acknowledge' },
    { regex: 'ASNSW', meaning: 'NSW Ambulance' },
    { regex: 'ATTD', meaning: 'Attend' },
    { regex: 'B4', meaning: 'Before' },
    { regex: 'BET', meaning: 'Between' },
    { regex: 'BTW', meaning: 'Between OR By the Way' },
    { regex: 'C[4F]W', meaning: 'Concern for Welfare' },
    { regex: 'CNCLD', meaning: 'Cancelled' },
    { regex: 'CNR', meaning: 'Corner' },
    { regex: 'DEC', meaning: 'Deceased' },
    { regex: 'ETA', meaning: 'Estimated Time of Arrival' },
    { regex: 'ETC', meaning: 'Estimated Time of Completion' },
    { regex: 'FRNSW', meaning: 'NSW Fire &amp; Rescue' },
    { regex: 'FB', meaning: 'Fire Brigade' },
    { regex: 'ICEMS', meaning: 'Inter CAD Electronic Messaging System' },
    { regex: 'LOC', meaning: 'Location' },
    { regex: 'LS', meaning: 'Last Seen' },
    { regex: 'MP', meaning: 'Missing Person(s)' },
    { regex: 'NESB', meaning: 'Non-English Speaking Background' },
    { regex: 'NFA', meaning: 'No Further Action' },
    { regex: 'NK', meaning: "Not Known" },
    { regex: 'NPI', meaning: 'No Person(s) Injured' },
    { regex: 'NPT', meaning: 'No Person(s) Trapped' },
    { regex: 'NFI', meaning: 'No Further Information' },
    { regex: 'NN[2T]A', meaning: 'No Need to Attend' },
    { regex: 'NSWPF', meaning: 'NSW Police Force' },
    { regex: 'POL', meaning: 'Police' },
    { regex: 'NVS', meaning: 'No Vehicle(s) Sighted' },
    { regex: 'OPP', meaning: 'Opposite' },
    { regex: 'OTW', meaning: 'On the Way' },
    { regex: 'P[2T]P', meaning: 'Pole to Pole (Powerlines)' },
    { regex: 'P[2T]H', meaning: 'Pole to House (Powerlines)' },
    { regex: '(\\d+)?PAX', meaning: 'Passenger' },
    { regex: 'PBY', meaning: 'Passer By' },
    { regex: 'POIS?', meaning: 'Person(s) Of Interest' },
    { regex: 'RCO', meaning: 'Police Radio Rescue Coordinator' },
    { regex: 'REQ', meaning: 'Require' },
    { regex: 'VEHS?', meaning: 'Vehicle(s)' },
    { regex: 'VOIS?', meaning: 'Vehicle(s) Of Interest' },
    { regex: 'TMC', meaning: 'Transport Management Center' },
    { regex: 'NSWTMC', meaning: 'NSW Transport Management Center' },
    { regex: 'KLO4', meaning: 'Keep a Look Out For' },
    { regex: 'INFTS?', meaning: 'Informant/Caller(s)' },
    { regex: '(\\d+)?POBS?', meaning: 'Person(s) On Board' },
    { regex: 'POSS', meaning: 'Possible' },
    { regex: 'PTS?', meaning: 'Patient(s) OR Person(s) Trapped' },
    { regex: 'VICT?', meaning: 'Victim(s)' },
    { regex: 'YR', meaning: 'Years Old' },
    { regex: 'YO', meaning: 'Years Old' },
    { regex: 'YOM', meaning: 'Year Old Male' },
    { regex: 'YOF', meaning: 'Year Old Female' },
    { regex: 'THX', meaning: 'Thanks' },
];

/**
 * Register the acronymText Knockout binding handler
 * Replaces matching acronyms with <abbr> tags showing their meanings on hover
 */
export function registerAcronymTextBinding() {
    if (ko.bindingHandlers.acronymText) {
        return; // Already registered
    }

    /**
     * Attach custom tooltips to abbr elements (similar to rainviewer legend)
     */
    function attachAbbreviationTooltips(element) {
        const abbrs = element.querySelectorAll('abbr[data-meaning]');
        abbrs.forEach((abbr) => {
            const meaning = abbr.getAttribute('data-meaning');
            if (!meaning) return;

            // Position: relative is needed for absolute tooltip positioning
            abbr.style.position = 'relative';
            abbr.style.cursor = 'help';
            abbr.style.textDecoration = 'underline';
            abbr.style.textDecorationStyle = 'dotted';

            // Create tooltip div
            const tooltip = document.createElement('div');
            tooltip.style.position = 'absolute';
            tooltip.style.bottom = '100%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.marginBottom = '6px';
            tooltip.style.padding = '6px 8px';
            tooltip.style.backgroundColor = '#333';
            tooltip.style.color = '#fff';
            tooltip.style.fontSize = '11px';
            tooltip.style.fontWeight = '500';
            tooltip.style.whiteSpace = 'nowrap';
            tooltip.style.borderRadius = '3px';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.zIndex = '1001';
            tooltip.style.opacity = '0';
            tooltip.style.transition = 'opacity 0.1s ease';
            tooltip.textContent = meaning;
            abbr.appendChild(tooltip);

            // Hover handlers
            abbr.addEventListener('mouseenter', () => {
                tooltip.style.opacity = '1';
            });
            abbr.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
            });
        });
    }

    ko.bindingHandlers.acronymText = {
        init: function(element, valueAccessor) {
            ko.unwrap(valueAccessor()); // Trigger dependency tracking
            var $element = $(element);
            
            var contentOrig = $element.html();
            var contentRepl = contentOrig;
            
            // Apply acronym dictionary
            acronymDictionary.forEach(function(item) {
                contentRepl = contentRepl.replace(
                    new RegExp('\\b(' + item.regex + ')\\b', 'gi'),
                    '<abbr data-meaning="' + item.meaning + '">$1</abbr>'
                );
            });
            
            if (contentRepl != contentOrig) {
                $element.html(contentRepl);
                attachAbbreviationTooltips(element);
            }
        },
        update: function(element, valueAccessor) {
            var value = ko.unwrap(valueAccessor());
            var $element = $(element);
            
            // Reset to plain text first
            $element.text(value);
            
            var contentOrig = $element.html();
            var contentRepl = contentOrig;
            
            // Apply acronym dictionary
            acronymDictionary.forEach(function(item) {
                contentRepl = contentRepl.replace(
                    new RegExp('\\b(' + item.regex + ')\\b', 'gi'),
                    '<abbr data-meaning="' + item.meaning + '">$1</abbr>'
                );
            });
            
            if (contentRepl != contentOrig) {
                $element.html(contentRepl);
                attachAbbreviationTooltips(element);
            }
        }
    };
}
