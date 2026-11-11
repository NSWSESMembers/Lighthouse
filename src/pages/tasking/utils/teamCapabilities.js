// The Technical band of the SES Field Operator Training Pathway.
const TECHNICAL = [
    'SWDG-ACC', 'SWDH-ACC', 'CL1-ACC', 'CL2-ACC', 'FRL1-ACC', 'FRL2-ACC', 'FRL3-ACC', 'BOAT-ACC', 'USAR1-ACC',
    'RCR-ACC', 'GLR2-ACC', 'VR-ACC2', 'LAR-ACC', 'ASAR-ACC', 'LS-ACC', 'CFR-ACC',
];

// Beacon accreditation tag (Person.PersonCapabilityTags[].Name) -> the short
// label shown in the expanded team's Team Capabilities box, in display order:
// driver, flood rescue, chainsaw and storm first, then everything else.
// `supersededBy`: a member holding any of those tags isn't counted for this one,
// so its count is members at just that level and its label says "only"
// (unless `plainLabel`).
const CAPABILITIES = [
    { code: 'DRL3-ACC', label: 'Driver L3' },
    { code: 'DRL2-ACC', label: 'Driver L2', supersededBy: ['DRL3-ACC'], plainLabel: true },
    { code: 'DRL1-ACC', label: 'Driver L1', supersededBy: ['DRL2-ACC', 'DRL3-ACC'], plainLabel: true },
    { code: 'FRL3-ACC', label: 'FR In Water' },
    { code: 'FRL2-ACC', label: 'FR On Water' },
    { code: 'FRL1-ACC', label: 'FR Land Based', supersededBy: ['FRL2-ACC', 'FRL3-ACC'] },
    { code: 'CL2-ACC', label: 'Chainsaw L2' },
    { code: 'CL1-ACC', label: 'Chainsaw L1', supersededBy: ['CL2-ACC'] },
    { code: 'SWDH-ACC', label: 'Storm Heights' },
    { code: 'SWDG-ACC', label: 'Storm Ground', supersededBy: ['SWDH-ACC'] },
    { code: 'BOAT-ACC', label: 'Boat Operator', supersededBy: ['FRL2-ACC'] },
    { code: 'USAR1-ACC', label: 'USAR Cat 1' },
    { code: 'RCR-ACC', label: 'Road Crash Rescue' },
    { code: 'GLR2-ACC', label: 'General Land Rescue' },
    { code: 'VR-ACC2', label: 'Vertical Rescue' },
    { code: 'LAR-ACC', label: 'Large Animal Rescue' },
    { code: 'ASAR-ACC', label: 'Alpine Search' },
    { code: 'LS-ACC', label: 'Land Search' },
    { code: 'CFR-ACC', label: 'Community First Responder' },
    { code: 'HCV3-ACC', label: 'HCV Flood' },
    { code: 'HCV2-ACC', label: 'HCV General', supersededBy: ['HCV3-ACC'] },
    { code: 'HCV1-ACC', label: 'HCV Logistics', supersededBy: ['HCV2-ACC', 'HCV3-ACC'] },
    { code: 'FTL-ACC', label: 'Field Team Leader' },
    { code: 'FIELD-ACC', label: 'Field Operator', supersededBy: TECHNICAL },
    { code: 'FO', label: 'Field Foundations', supersededBy: ['FIELD-ACC', ...TECHNICAL] },
    { code: 'JR', label: 'Job Ready', supersededBy: ['FO', 'FIELD-ACC', ...TECHNICAL] },
    { code: 'BEAA-ACC', label: 'Beacon Admin' },
    { code: 'BEAI-ACC', label: 'Beacon Incident Mgmt', supersededBy: ['BEAA-ACC'] },
    { code: 'BEAF-ACC', label: 'Beacon Field', supersededBy: ['BEAI-ACC', 'BEAA-ACC'] },
];

const BY_CODE = new Map(CAPABILITIES.map((c, i) => [
    c.code,
    { ...c, label: c.supersededBy && !c.plainLabel ? `${c.label} only` : c.label, order: i },
]));

/**
 * How many of a team's members hold each capability, after superseding.
 * Tags without a table entry are still counted, under Beacon's description,
 * after the known ones.
 * @param {Array} members Beacon team Members ({ Person: { PersonCapabilityTags } })
 * @returns {Array<{code: string, label: string, count: number}>}
 */
export function teamCapabilityCounts(members) {
    const counts = new Map();
    for (const member of members || []) {
        const held = new Map((member.Person?.PersonCapabilityTags || []).map(tag => [tag.Name, tag]));
        for (const [code, tag] of held) {
            const known = BY_CODE.get(code);
            if (known?.supersededBy?.some(other => held.has(other))) continue;
            if (!counts.has(code)) {
                counts.set(code, { code, label: known?.label || tag.Description || code, count: 0, order: known?.order ?? Infinity });
            }
            counts.get(code).count += 1;
        }
    }
    return [...counts.values()]
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
        .map(({ code, label, count }) => ({ code, label, count }));
}
