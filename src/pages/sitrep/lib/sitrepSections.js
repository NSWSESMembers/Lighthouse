/*
  The NSW SES situation-report format (headings, order and guidance prompts
  taken from "Situation Report Template.docx" and "Sitrep guidance.docx" --
  the SITREPS acronym: Situation, Impact, Teams/Resources, Reporting,
  Execution, Prognosis, Safety). Kept as one shared list so the entry form
  (one commentary field per section) and the generated preview text render
  from the same definition rather than duplicating headings/order in two
  places.

  Wording follows the template document itself (the doc the generated
  report's own headings should match); "Resources" is the template's own
  heading for the guidance doc's "Teams" section, and "Reporting" isn't a
  separate heading in the template -- it's the closing "next situation
  report" line, handled separately in formatSitrepText.js.
*/
export const SITREP_SECTIONS = [
  {
    key: 'situation',
    heading: 'Situation',
    prompts: [
      'An outline of the circumstances leading up to the operation and damage/geographical boundaries',
      'Any significant impact that has occurred as a result of the incident/emergency',
      'Identification of any ongoing risks to personnel, community and/or environment',
    ],
  },
  {
    key: 'impact',
    heading: 'Impact',
    prompts: [
      'What are the effects on the built environment -- describe the extent and types of losses and damage?',
      'What are the effects on/issues for the community?',
      'What are the effects/issues for the responding resources?',
      'Identification of affected critical infrastructure',
      'Safety issues including monitoring and controls',
    ],
  },
  {
    key: 'resources',
    heading: 'Resources',
    prompts: [
      'What SES resource is in the area and what are they doing (including teams)?',
      'Who is involved, how many personnel from other agencies and what are they doing for SES and the community?',
    ],
  },
  {
    key: 'execution',
    heading: 'Execution',
    prompts: [
      'Strategies -- what actions are being undertaken against the operational objectives? What additional strategies locally are occurring?',
      'Clearly define the objectives, stipulating parameters of time and space.',
      'Actions to support the community, critical infrastructure/assets and any environmental protection the community relies on to stay safe.',
    ],
  },
  {
    key: 'emergingIssues',
    heading: 'Emerging Issues',
    prompts: ['Is there any community, media or local political issues emerging?', 'Is the threat/hazard situation likely to cause additional or secondary issues?'],
  },
  {
    key: 'prognosis',
    heading: 'Prognosis',
    prompts: [
      'What is likely to happen if strategies are successful? What could stop the strategies from working? What do you need?',
      'Future expectations, internally and externally.',
      'Weather forecast effects.',
    ],
  },
  {
    key: 'safety',
    heading: 'Safety',
    prompts: ['Known hazards/threats.'],
  },
];

/**
 * @returns {Record<string, string>}  {sectionKey: ''} for every section -- the initial/empty commentary state
 */
export function emptySectionCommentary() {
  return SITREP_SECTIONS.reduce((acc, section) => {
    acc[section.key] = '';
    return acc;
  }, {});
}
