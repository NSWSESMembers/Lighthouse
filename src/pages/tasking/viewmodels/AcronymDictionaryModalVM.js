/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

// ViewModel for the Acronym Dictionary modal
export function AcronymDictionaryModalVM(mainVM) {
    const self = this;
    self.isOpen = ko.observable(false);
    
    // Get the acronym dictionary from main VM, sorted alphabetically
    self.sortedAcronyms = ko.pureComputed(() => {
        if (!self.isOpen()) return [];
        const dictionary = mainVM.acronymDictionary || [];
        return dictionary.slice().sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
    });
}