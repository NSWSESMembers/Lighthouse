import { Subject } from './subject.js';

const subjects = new Map();

// Returns the Subject for a given hub method name, creating it on first use.
// Consumers subscribe by the exact (case-sensitive) method name the server invokes.
export function getSubject(eventName) {
    if (!subjects.has(eventName)) {
        subjects.set(eventName, new Subject());
    }
    return subjects.get(eventName);
}
