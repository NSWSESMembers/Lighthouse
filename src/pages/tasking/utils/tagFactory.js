    export function returnTagClass(groupId) {
        console.log('TagGroupId:', groupId);
        const tagGroupConfig = TagGroupButtonFactory[groupId] || TagGroupButtonFactory.default;
        if (tagGroupConfig) {
            return tagGroupConfig.class;
        }
    }
    export function returnTagIcon(groupId) {
        console.log('TagGroupId:', groupId);
        const tagGroupConfig = TagGroupButtonFactory[groupId] || TagGroupButtonFactory.default;
        if (tagGroupConfig) {
            return tagGroupConfig.icon;
        }
    }

const TagGroupButtonFactory = {
    default: { class: "label tag tag-default", icon: "fas fa-tag" },
    2: { class: "label tag tag-note", icon: "fas fa-pencil" }, // contact type
    5: { class: "label tag tag-damage", icon: "fas fa-bolt" }, // Damage
    6: { class: "label tag tag-damage", icon: "fas fa-bolt" }, // Damage
    7: { class: "label tag tag-hazard", icon: "fas fa-ban" }, // something hazard
    8: { class: "label tag tag-hazard", icon: "fas fa-ban" }, // something hazard
    9: { class: "label tag tag-hazard", icon: "fas fa-ban" }, // Hazard
    10: { class: "label tag tag-hazard", icon: "fas fa-ban" }, // Hazard
    11: { class: "label tag tag-property", icon: "fas fa-home" }, // property type
    12: { class: "label tag tag-property", icon: "fas fa-home" }, // property type
    13: { class: "label tag tag-property", icon: "fas fa-home" }, // property type
    14: { class: "label tag tag-task", icon: "fas fa-tasks" }, // task
    15: { class: "label tag tag-task", icon: "fas fa-tasks" }, // task
    16: { class: "label tag tag-task", icon: "fas fa-tasks" }, // task
    18: { class: "label tag tag-aviation", icon: "fas fa-fighter-jet" }, // task
    19: { class: "label tag tag-special-needs", icon: "fas fa-wheelchair" }, // special needs
    50: { class: "label tag tag-task", icon: "fas fa-tasks" }, // task

};