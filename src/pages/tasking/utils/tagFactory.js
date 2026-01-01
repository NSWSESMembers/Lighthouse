    export function returnTagClass(groupId) {
        const tagGroupConfig = TagGroupButtonFactory[groupId] || TagGroupButtonFactory.default;
        if (tagGroupConfig) {
            return tagGroupConfig.class;
        }
    }
    export function returnTagIcon(groupId, id) {
        const tagGroupConfig = TagGroupButtonFactory[groupId] || TagGroupButtonFactory.default;
        const overrideIcon = TagIconsOverride[id] || TagIconsOverride.default;
        if (overrideIcon) {
            return overrideIcon;
        }
        return tagGroupConfig.icon;
    }

const TagIconsOverride = {
    // tagGroupId: "icon class"
    2: "fas fa-phone", // phone
    6: "fa fa-solid fa-microphone",
    10: "fas fa-piggy-bank", // police
    13: "fas fa-fire-extinguisher", //frnsw
    15: "fas fa-carrot", // SES
    11: "fas fa-ambulance", // ambo
    420: "fa fa-share-alt", // icems
    256: "fas fa-arrow-alt-circle-right", // incoming
    257: "fas fa-arrow-alt-circle-left", // outgoing

    default: null
}

const TagGroupButtonFactory = {
    default: { class: "label tag tag-default", icon: "fas fa-tag" },
    2: { class: "label tag tag-note", icon: "fas fa-pencil-alt" }, // contact type
    3: { class: "label tag tag-note", icon: "fas fa-pencil-alt" }, // contact type
    4: { class: "label tag tag-note", icon: "fas fa-pencil-alt" }, // tag note
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
    27: { class: "label tag tag-further-action", icon: "fas fa-thumbtack" }, // further action
    50: { class: "label tag tag-task", icon: "fas fa-tasks" }, // task

};